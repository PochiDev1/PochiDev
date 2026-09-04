import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  const webhook = Deno.env.get("DISCORD_WEBHOOK_URL");
  if (!webhook) return new Response("Missing DISCORD_WEBHOOK_URL", { status: 500, headers: cors });

  try {
    const v = await req.json();
    const embed = {
      title: "🌐 Nueva visita a Pochi",
      color: 5763719,
      fields: [
        { name: "IP pública", value: String(v.public_ip || "No disponible").slice(0, 1024), inline: true },
        { name: "Navegador", value: String(v.browser || "Desconocido").slice(0, 1024), inline: true },
        { name: "Sistema", value: String(v.operating_system || "Desconocido").slice(0, 1024), inline: true },
        { name: "Idioma", value: String(v.language || "—").slice(0, 1024), inline: true },
        { name: "Zona horaria", value: String(v.timezone || "—").slice(0, 1024), inline: true },
        { name: "Resolución", value: String(v.screen_resolution || "—").slice(0, 1024), inline: true },
        { name: "Origen", value: String(v.referrer || "Entrada directa").slice(0, 1024), inline: false },
        { name: "Página", value: String(v.page_url || "—").slice(0, 1024), inline: false },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: "Pochi · registro de visitas" },
    };

    const r = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Pochi Visits", embeds: [embed] }),
    });

    if (!r.ok) return new Response(`Discord error ${r.status}`, { status: 502, headers: cors });
    return new Response("ok", { headers: cors });
  } catch {
    return new Response("Bad request", { status: 400, headers: cors });
  }
});
