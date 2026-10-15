import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Permiso de madre, padre o tutor para menores de 14 años.
// - {action:"request", guardian_email, site}  (con sesión del menor): crea la solicitud y envía el email.
// - {action:"info", token}                       (sin sesión, desde el enlace del email): datos para mostrar.
// - {action:"approve", token}                    (sin sesión): el adulto da su permiso.
// El email se envía con Resend si están configurados los secretos RESEND_API_KEY y MAIL_FROM.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let b: Record<string, string>;
  try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }

  if (b.action === "info" || b.action === "approve") {
    if (!/^[0-9a-f-]{36}$/.test(b.token ?? "")) return json({ error: "invalid" }, 400);
    const { data: c } = await admin.from("guardian_consents").select("user_id, status").eq("token", b.token).maybeSingle();
    if (!c) return json({ error: "invalid" }, 404);
    const { data: p } = await admin.from("profiles").select("display_name").eq("user_id", c.user_id).maybeSingle();
    if (b.action === "approve" && c.status !== "approved") {
      await admin.from("guardian_consents").update({ status: "approved", approved_at: new Date().toISOString() }).eq("token", b.token);
    }
    return json({ name: p?.display_name || "", status: b.action === "approve" ? "approved" : c.status });
  }

  // Solicitud del menor
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  const { data: u } = await admin.auth.getUser(jwt);
  if (!u?.user) return json({ error: "unauthorized" }, 401);
  const email = String(b.guardian_email ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email) || email === (u.user.email ?? "").toLowerCase()) return json({ error: "bad_email" }, 400);
  const site = /^https:\/\/[^\s/]+$/.test(b.site ?? "") || /^http:\/\/localhost(:\d+)?$/.test(b.site ?? "") ? b.site : "";

  const { data: prev } = await admin.from("guardian_consents").select("requested_at, guardian_email, token, status").eq("user_id", u.user.id).maybeSingle();
  if (prev?.status === "approved") return json({ sent: false, status: "approved" });
  if (prev && Date.now() - new Date(prev.requested_at).getTime() < 60_000) return json({ error: "wait" }, 429);
  const token = prev && prev.guardian_email === email ? prev.token : crypto.randomUUID();
  await admin.from("guardian_consents").upsert({ user_id: u.user.id, guardian_email: email, token, status: "pending", requested_at: new Date().toISOString() });

  const key = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("MAIL_FROM");
  if (!key || !from || !site) return json({ sent: false, reason: "no_mail_service" });
  const { data: p } = await admin.from("profiles").select("display_name").eq("user_id", u.user.id).maybeSingle();
  const name = esc(p?.display_name || "Tu hijo o hija");
  const link = `${site}/?permiso=${token}`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to: email, subject: `${name} quiere usar Wordazo`,
      html: `<p>Hola:</p><p><b>${name}</b> se ha registrado en <b>Wordazo</b>, una app para aprender vocabulario de idiomas jugando, y ha indicado este email como el de su madre, padre o tutor.</p>
<p>Como tiene menos de 14 años, necesitamos tu permiso para activar su cuenta. Guardamos solo su email, su fecha de nacimiento, su nombre de pila y su progreso. No hay chat ni publicidad.</p>
<p><a href="${link}" style="display:inline-block;background:#FFCF33;color:#2A2100;padding:12px 18px;border-radius:10px;font-weight:bold;text-decoration:none">Revisar y dar permiso</a></p>
<p>Si no sabes de qué se trata, ignora este mensaje y la cuenta no se activará.</p>`,
    }),
  });
  return json({ sent: r.ok });
});
