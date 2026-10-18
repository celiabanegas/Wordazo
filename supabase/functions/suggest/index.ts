import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Sugerencias «Para ti»: se calculan una vez por semana y por usuario, no cada vez que se abre la pantalla.
const LANG: Record<string, string> = { en: "inglés", fr: "francés", de: "alemán", it: "italiano", pt: "portugués", es: "español culto" };
const LEVEL: Record<string, string> = { low: "principiante", mid: "intermedio", high: "avanzado" };
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Modelo de IA: usa Claude si existe ANTHROPIC_API_KEY; si no, Groq (gratis) con GROQ_API_KEY.
async function askAI(prompt: string, maxTokens: number): Promise<string> {
  const claude = Deno.env.get("ANTHROPIC_API_KEY");
  let groq = Deno.env.get("GROQ_API_KEY");
  if (!claude && !groq) {
    // Clave guardada en la tabla interna app_secrets (sin acceso desde la app)
    const a = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data } = await a.from("app_secrets").select("value").eq("name", "groq_api_key").maybeSingle();
    groq = data?.value;
  }
  if (claude) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": claude, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-5-5", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
    });
    if (!r.ok) throw new Error(`upstream ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return ((await r.json()).content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
  }
  if (groq) {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groq}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("GROQ_MODEL") ?? "openai/gpt-oss-120b",
        max_tokens: maxTokens + 800, temperature: 0.3, reasoning_effort: "low", include_reasoning: false,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Respondes siempre con un único objeto JSON válido, sin texto adicional." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!r.ok) throw new Error(`upstream ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return (await r.json()).choices?.[0]?.message?.content ?? "";
  }
  throw new Error("missing_key");
}
const monday = () => { const d = new Date(); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0, 10); };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  const { data: u } = await admin.auth.getUser(jwt);
  if (!u?.user) return json({ error: "unauthorized" }, 401);
  const uid = u.user.id;
  let lang = "en", page = 1;
  try { const b = await req.json(); if (LANG[b.lang]) lang = b.lang; page = Math.max(1, Math.min(5, Number(b.page) || 1)); } catch { /* por defecto inglés */ }

  // Se guardan por semana. Cada página son 9 nuevas; se piden más solo cuando el usuario quiere más (máximo 5 por semana).
  const week = monday();
  const { data: cached } = await admin.from("user_suggestions").select("items").eq("user_id", uid).eq("lang", lang).eq("week", week).maybeSingle();
  const prev = ((cached?.items ?? []) as { term: string; page?: number }[]);
  const pages = prev.length ? Math.max(...prev.map((i) => i.page ?? 1)) : 0;
  if (page <= pages) return json({ items: prev.filter((i) => (i.page ?? 1) === page) });
  if (page > pages + 1) return json({ items: [] });

  const [{ data: words }, { data: prof }] = await Promise.all([
    admin.from("words").select("term, fails, box").eq("user_id", uid).eq("deck", lang).order("created_at", { ascending: false }).limit(60),
    admin.from("profiles").select("level").eq("user_id", uid).maybeSingle(),
  ]);
  if (!words || words.length < 3) return json({ items: [] }); // con pocas palabras se usan los paquetes de inicio

  const terms = words.map((w) => w.term);
  const hard = words.filter((w) => w.fails >= 2 && w.box <= 2).map((w) => w.term).slice(0, 10);
  let text = "";
  try { text = await askAI(`Un hispanohablante joven de nivel ${LEVEL[prof?.level ?? "mid"]} aprende ${LANG[lang]}.
Ya tiene guardadas: ${terms.join(", ")}.${hard.length ? ` Le cuestan: ${hard.join(", ")}.` : ""}${prev.length ? ` Ya le propusiste (no las repitas): ${prev.map((i) => i.term).join(", ")}.` : ""}
Propón 9 palabras o expresiones nuevas de ${LANG[lang]} que le convenga aprender ahora y que NO estén en su lista. Mezcla palabras parecidas o relacionadas con las suyas, alternativas más usadas, falsos amigos frecuentes y vocabulario de los mismos temas.
Responde SOLO con JSON: {"items":[{"term":"palabra","translation":"${lang === "es" ? "definición breve" : "traducción breve al español"}","reason":"motivo en máximo 5 palabras, p. ej. «Parecida a thorough» o «Falso amigo frecuente»"}]}`, 700); }
  catch (e) { console.error(String(e)); return json({ error: String(e).startsWith("Error: missing_key") ? "missing_key" : "upstream" }, 502); }
  try {
    const have = new Set([...terms, ...prev.map((i) => i.term)].map((t) => t.toLowerCase()));
    const o = JSON.parse(text.match(/\{[\s\S]*\}/)![0]);
    const items = (o.items ?? [])
      .map((i: { term?: string; translation?: string; reason?: string }) => ({ term: String(i.term ?? "").trim(), translation: String(i.translation ?? "").trim(), reason: String(i.reason ?? "").trim() }))
      .filter((i: { term: string }) => i.term && !have.has(i.term.toLowerCase())).slice(0, 9)
      .map((i: object) => ({ ...i, page }));
    await admin.from("user_suggestions").upsert({ user_id: uid, lang, week, items: [...prev, ...items] });
    return json({ items });
  } catch { return json({ error: "bad_reply" }, 502); }
});
