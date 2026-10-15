import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Paquetes de 6 palabras para empezar, por idioma, nivel y tema.
// Se generan una sola vez y se guardan: no cuestan nada por usuario.
const LANG: Record<string, string> = { en: "inglés", fr: "francés", de: "alemán", it: "italiano", pt: "portugués", es: "español" };
const TOPICS: Record<string, string> = {
  series: "series, películas y streaming", viajes: "viajes", redes: "redes sociales e internet", deporte: "deporte",
  clase: "el instituto y la universidad", trabajo: "el trabajo", comida: "comida y restaurantes", musica: "música y conciertos",
};
const LEVEL: Record<string, string> = { low: "principiante (A1-A2)", mid: "intermedio (B1)", high: "avanzado (B2-C1)" };
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let lang = "en", level = "mid", topic = "series", page = 1;
  try {
    const b = await req.json();
    if (LANG[b.lang]) lang = b.lang;
    if (LEVEL[b.level]) level = b.level;
    if (TOPICS[b.topic]) topic = b.topic;
    page = Math.max(1, Math.min(10, Number(b.page) || 1));
  } catch { return json({ error: "bad_request" }, 400); }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rows } = await admin.from("starter_packs").select("page, words").eq("lang", lang).eq("native", "es").eq("level", level).eq("topic", topic);
  const hit = rows?.find((r) => r.page === page);
  if (hit) return json({ words: hit.words });

  const before = (rows ?? []).filter((r) => r.page < page).flatMap((r) => (r.words as { term: string }[]).map((w) => w.term));
  const p = lang === "es"
    ? `Propón 6 palabras cultas del español, poco usadas en el día a día, que un joven de nivel ${LEVEL[level]} podría encontrarse en textos sobre ${TOPICS[topic]}.`
    : `Propón 6 palabras o expresiones de ${LANG[lang]} útiles y actuales para un hispanohablante joven de nivel ${LEVEL[level]} sobre ${TOPICS[topic]}.`;
  let text = "";
  try { text = await askAI(`${p}${before.length ? ` Que no sean ninguna de estas: ${before.join(", ")}.` : ""}
Responde SOLO con JSON: {"words":[{"term":"palabra","translation":"${lang === "es" ? "definición breve" : "traducción breve al español"}"}]}`, 400); }
  catch (e) { console.error(String(e)); return json({ error: String(e).startsWith("Error: missing_key") ? "missing_key" : "upstream" }, 502); }
  try {
    const o = JSON.parse(text.match(/\{[\s\S]*\}/)![0]);
    const words = (o.words ?? []).map((w: { term?: string; translation?: string }) => ({ term: String(w.term ?? "").trim(), translation: String(w.translation ?? "").trim() }))
      .filter((w: { term: string }) => w.term).slice(0, 6);
    if (words.length) await admin.from("starter_packs").upsert({ lang, native: "es", level, topic, page, words });
    return json({ words });
  } catch { return json({ error: "bad_reply" }, 502); }
});
