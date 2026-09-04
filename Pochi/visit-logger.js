(() => {
  const cfg = window.APP_CONFIG || {};

  function detectDevice() {
    const u = navigator.userAgent || "";
    return {
      browser: /Edg\//.test(u) ? "Microsoft Edge"
        : /OPR\//.test(u) ? "Opera"
        : /Firefox\//.test(u) ? "Firefox"
        : /Chrome\//.test(u) ? "Google Chrome"
        : /Safari\//.test(u) ? "Safari"
        : "Otro navegador",
      operatingSystem: /Windows/.test(u) ? "Windows"
        : /Android/.test(u) ? "Android"
        : /iPhone|iPad|iPod/.test(u) ? "iOS"
        : /Mac OS/.test(u) ? "macOS"
        : /Linux/.test(u) ? "Linux"
        : "Desconocido"
    };
  }

  async function getPublicIp() {
    try {
      const r = await fetch("https://api.ipify.org?format=json", {
        cache: "no-store"
      });
      if (r.ok) {
        const data = await r.json();
        return data.ip || "No disponible";
      }
    } catch (e) {
      console.warn("[Pochi] No se pudo obtener la IP pública.", e);
    }
    return "No disponible";
  }

  function clean(value, max = 900) {
    const text = String(value ?? "").trim();
    return text ? text.slice(0, max) : "No disponible";
  }

  function webhookWithWait(url) {
    if (!url) return "";
    return url + (url.includes("?") ? "&wait=true" : "?wait=true");
  }

  async function postDiscord(payload) {
    const webhook = webhookWithWait(cfg.discordWebhookUrl);
    if (!webhook) {
      console.error("[Pochi] Falta discordWebhookUrl en app-config.js");
      return false;
    }

    const body = JSON.stringify(payload);

    try {
      let response = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        cache: "no-store",
        keepalive: true
      });

      // Si Discord aplica rate limit, espera una vez y reintenta.
      if (response.status === 429) {
        let retryMs = 1200;
        try {
          const rate = await response.clone().json();
          const retry = Number(rate.retry_after);
          if (Number.isFinite(retry)) retryMs = retry > 100 ? retry : retry * 1000;
        } catch (_) {}
        await new Promise(resolve => setTimeout(resolve, Math.min(retryMs, 5000)));
        response = await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          cache: "no-store",
          keepalive: true
        });
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error(`[Pochi] Discord respondió ${response.status}:`, errorText);
        return false;
      }

      console.info("[Pochi] Visita enviada a Discord correctamente.");
      return true;
    } catch (e) {
      console.error("[Pochi] Falló el envío directo a Discord:", e);

      // Último intento sin esperar respuesta del servidor.
      try {
        if (navigator.sendBeacon) {
          return navigator.sendBeacon(
            cfg.discordWebhookUrl,
            new Blob([body], { type: "application/json" })
          );
        }
      } catch (_) {}
      return false;
    }
  }

  async function saveVisit() {
    const device = detectDevice();
    const ip = await getPublicIp();
    const referrer = document.referrer || "Entrada directa";

    const payload = {
      username: "Pochi · Visitas",
      allowed_mentions: { parse: [] },
      embeds: [{
        title: "🌐 Nueva visita a Pochi",
        description: "Alguien pulsó **clic** y entró al perfil.",
        fields: [
          { name: "IP pública", value: `\`${clean(ip, 100)}\``, inline: true },
          { name: "Sistema", value: clean(device.operatingSystem, 100), inline: true },
          { name: "Navegador", value: clean(device.browser, 100), inline: true },
          { name: "Resolución", value: clean(`${screen.width}×${screen.height}`, 100), inline: true },
          { name: "Idioma", value: clean(navigator.language, 100), inline: true },
          { name: "Zona horaria", value: clean(Intl.DateTimeFormat().resolvedOptions().timeZone, 100), inline: true },
          { name: "Origen", value: clean(referrer), inline: false },
          { name: "Página", value: clean(location.href), inline: false }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "Registro automático de visitas" }
      }]
    };

    return postDiscord(payload);
  }

  window.PochiVisits = { saveVisit };
})();
