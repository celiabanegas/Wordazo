import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Traduce una palabra y prepara todo lo que necesitan los juegos en UNA sola llamada a la IA (Groq o Claude).
// El resultado se guarda en un diccionario compartido: la segunda persona que guarda la misma palabra no gasta nada.
const LANG: Record<string, string> = { en: "inglés", fr: "francés", de: "alemán", it: "italiano", pt: "portugués", es: "español" };
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
const normKey = (t: string, lang: string) => {
  let s = t.trim().toLowerCase().replace(/\s+/g, " ");
  if (lang === "en") s = s.replace(/^to /, "");
  return s;
};

function prompt(term: string, lang: string) {
  if (lang === "es") {
    return `Eres un diccionario de español culto para jóvenes que quieren ampliar su vocabulario.
Palabra: "${term}"
Responde SOLO con JSON válido con esta forma:
{"valid":true,"term":"forma correcta con tildes","translation":"definición clara, máximo 10 palabras, sin usar la palabra","alternatives":["sinónimos, máximo 3"],"examples":[{"text":"frase corta con la palabra","translation":""}],"note":"","decoys_native":[{"text":"definición falsa pero creíble, máximo 10 palabras","means":"palabra a la que corresponde esa definición"}],"decoys_target":[{"text":"palabra española poco común parecida en forma o sonido","means":"su definición breve"}]}
Reglas: examples exactamente 3. decoys_native: 5 definiciones de palabras que suenan parecido o se confunden con "${term}"; nunca una definición válida de "${term}". decoys_target: 5 palabras parecidas en forma o sonido, nunca sinónimos.
Si "${term}" no es una palabra española real, responde {"valid":false}.`;
  }
  const L = LANG[lang];
  return `Eres un diccionario de ${L} para hispanohablantes jóvenes que aprenden ${L}.
Palabra o expresión: "${term}"
Responde SOLO con JSON válido con esta forma:
{"valid":true,"term":"forma correcta (ortografía y mayúsculas correctas${lang === "en" ? "; verbos con 'to'" : ""})","translation":"traducción principal al español, 1 a 4 palabras","alternatives":["otras traducciones válidas, máximo 4"],"examples":[{"text":"frase corta y cotidiana en ${L}","translation":"su traducción al español"}],"note":"aviso breve si es un falso amigo o se confunde a menudo; si no, cadena vacía","decoys_native":[{"text":"palabra en español","means":"palabra en ${L} que significa eso"}],"decoys_target":[{"text":"palabra en ${L}","means":"su significado en español"}]}
Reglas:
- examples: exactamente 3, nivel B1, máximo 10 palabras cada una.
- decoys_native: 5 palabras en español que se podrían confundir con la traducción correcta pero que NO son traducciones válidas: la traducción de otra forma de la misma familia (p. ej. overwhelmed → agobiado, para overwhelming), la traducción de palabras de ${L} que se parecen en forma o sonido, o significados cercanos pero distintos. Nunca sinónimos de la respuesta.
- decoys_target: 5 palabras en ${L} que se parecen en forma o sonido a "${term}" o se confunden a menudo con ella (p. ej. awkward → awesome, award, backward). Nunca sinónimos.
Si "${term}" no es una palabra o expresión real de ${L}, responde {"valid":false}.`;
}

const pairs = (v: unknown) =>
  (Array.isArray(v) ? v : [])
    .map((x: { text?: unknown; means?: unknown; translation?: unknown }) => ({ text: String(x?.text ?? "").trim(), means: String(x?.means ?? x?.translation ?? "").trim() }))
    .filter((x) => x.text)
    .slice(0, 6);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let term = "", lang = "en";
  try {
    const b = await req.json();
    term = String(b.term ?? "").trim().slice(0, 80);
    lang = LANG[b.lang ?? b.deck] ? (b.lang ?? b.deck) : "en";
  } catch { return json({ error: "bad_request" }, 400); }
  if (!term) return json({ error: "bad_request" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const key = normKey(term, lang);
  const { data: hit } = await admin.from("dictionary").select("data").eq("lang", lang).eq("native", "es").eq("term_norm", key).maybeSingle();
  if (hit) return json({ ...hit.data, cached: true });

  let text = "";
  try { text = await askAI(prompt(term, lang), 900); }
  catch (e) { console.error(String(e)); return json({ error: String(e).startsWith("Error: missing_key") ? "missing_key" : "upstream" }, 502); }
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return json({ error: "bad_reply" }, 502);
  let o: Record<string, unknown>;
  try { o = JSON.parse(m[0]); } catch { return json({ error: "bad_reply" }, 502); }

  const out = {
    valid: o.valid !== false && !!o.translation,
    term: String(o.term ?? term).trim() || term,
    translation: String(o.translation ?? "").trim(),
    alternatives: (Array.isArray(o.alternatives) ? o.alternatives : []).map(String).filter(Boolean).slice(0, 4),
    examples: pairs(o.examples).slice(0, 3).map((p) => ({ text: p.text, translation: p.means })),
    note: String(o.note ?? "").trim(),
    decoys: { native: pairs(o.decoys_native), target: pairs(o.decoys_target) },
  };
  // Seguridad: descarta opciones «falsas» que en realidad son correctas (significan lo mismo que la palabra o coinciden con una traducción válida)
  const n = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/^to /, "").trim();
  const valid = new Set([out.translation, ...out.alternatives].flatMap((t) => t.split(/[,;/]/)).map(n));
  out.decoys.native = out.decoys.native.filter((d) => n(d.means) !== n(term) && n(d.means) !== n(out.term) && !valid.has(n(d.text))).slice(0, 5);
  out.decoys.target = out.decoys.target.filter((d) => n(d.text) !== n(term) && n(d.text) !== n(out.term)).slice(0, 5);
  // Solo se guardan en el diccionario las palabras válidas (las erróneas no se reutilizan)
  if (out.valid) await admin.from("dictionary").upsert({ lang, native: "es", term_norm: key, data: out });
  return json(out);
});
