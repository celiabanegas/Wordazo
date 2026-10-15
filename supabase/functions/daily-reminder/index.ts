import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// Aviso diario. Lo llama cada hora una tarea programada de la base de datos.
// Envía como máximo un aviso al día, a la hora elegida por cada usuario y solo si ese día aún no ha jugado.
Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: secrets } = await admin.from("app_secrets").select("name, value");
  const sec = Object.fromEntries((secrets ?? []).map((s) => [s.name, s.value]));
  if (!sec.cron_secret || req.headers.get("x-cron-secret") !== sec.cron_secret) return new Response("forbidden", { status: 403 });
  webpush.setVapidDetails(Deno.env.get("SUPABASE_URL")!, sec.vapid_public, sec.vapid_private);

  const { data: subs } = await admin.from("push_subscriptions").select("endpoint, p256dh, auth, user_id");
  if (!subs?.length) return new Response("0");
  const ids = [...new Set(subs.map((s) => s.user_id))];
  const { data: profiles } = await admin.from("profiles").select("user_id, reminder_on, reminder_hour, tz, last_reminder").in("user_id", ids).eq("reminder_on", true);
  let sent = 0;

  for (const p of profiles ?? []) {
    let hour = -1, today = "", yesterday = "";
    try {
      const fmt = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: p.tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
      hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: p.tz, hour: "2-digit", hourCycle: "h23" }).format(new Date()));
      today = fmt(new Date());
      yesterday = fmt(new Date(Date.now() - 86_400_000));
    } catch { continue; }
    if (hour !== p.reminder_hour || p.last_reminder === today) continue;

    const { data: played } = await admin.from("xp_days").select("day").eq("user_id", p.user_id).eq("day", today).maybeSingle();
    if (played) continue;
    const { data: st } = await admin.from("stats").select("streak, last_day").eq("user_id", p.user_id).maybeSingle();
    const { count: due } = await admin.from("words").select("id", { count: "exact", head: true })
      .eq("user_id", p.user_id).eq("status", "ok").lte("due_at", new Date().toISOString());

    const atRisk = st && st.streak > 0 && st.last_day === yesterday;
    const payload = JSON.stringify(atRisk
      ? { title: `🔥 Tu racha de ${st!.streak} ${st!.streak === 1 ? "día" : "días"} está en peligro`, body: "Una ronda de 2 minutos y la salvas." }
      : due ? { title: "Tus palabras te esperan", body: `Tienes ${due} ${due === 1 ? "palabra" : "palabras"} por repasar hoy.` }
      : { title: "¿Una ronda rápida?", body: "Dos minutos de Wordazo y sumas a tu objetivo de hoy." });

    for (const s of subs.filter((x) => x.user_id === p.user_id)) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }
    await admin.from("profiles").update({ last_reminder: today }).eq("user_id", p.user_id);
  }
  return new Response(String(sent));
});
