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
      const r = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
      if (r.ok) {
        const data = await r.json();
        return data.ip || "No disponible";
      }
    } catch (_) {}
    return "No disponible";
  }

  function clean(value, max = 900) {
    const text = String(value ?? "").trim();
    return text ? text.slice(0, max) : "No disponible";
  }

  function sendWithHiddenForm(url, payload) {
    try {
      const frameName = `discord_sink_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const iframe = document.createElement("iframe");
      iframe.name = frameName;
      iframe.style.display = "none";
      document.body.appendChild(iframe);

      const form = document.createElement("form");
      form.method = "POST";
      form.action = url;
      form.target = frameName;
      form.enctype = "multipart/form-data";
      form.style.display = "none";

      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "payload_json";
      input.value = JSON.stringify(payload);
      form.appendChild(input);
      document.body.appendChild(form);

      form.submit();
      setTimeout(() => {
        form.remove();
        iframe.remove();
      }, 15000);
      return true;
    } catch (e) {
      console.error("[Pochi] Falló el envío por formulario:", e);
      return false;
    }
  }

  async function postDiscord(payload) {
    const webhook = String(cfg.discordWebhookUrl || "").trim();
    if (!webhook) {
      console.error("[Pochi] Falta discordWebhookUrl en app-config.js");
      return false;
    }

    // Discord acepta multipart/form-data con payload_json. Esto evita el
    // preflight CORS que puede bloquear un POST application/json desde GitHub Pages.
    const makeFormData = () => {
      const fd = new FormData();
      fd.append("payload_json", JSON.stringify(payload));
      return fd;
    };

    try {
      if (navigator.sendBeacon) {
        const queued = navigator.sendBeacon(webhook, makeFormData());
        if (queued) {
          console.info("[Pochi] Visita encolada para Discord.");
          return true;
        }
      }
    } catch (e) {
      console.warn("[Pochi] sendBeacon no disponible:", e);
    }

    try {
      await fetch(webhook, {
        method: "POST",
        mode: "no-cors",
        body: makeFormData(),
        cache: "no-store",
        keepalive: true
      });
      console.info("[Pochi] Solicitud enviada a Discord.");
      return true;
    } catch (e) {
      console.warn("[Pochi] fetch directo falló, usando formulario:", e);
      return sendWithHiddenForm(webhook, payload);
    }
  }

  async function saveVisit(extra = {}) {
    const device = detectDevice();
    const ip = await getPublicIp();
    const referrer = document.referrer || "Entrada directa";

    const payload = {
      username: "Pochi · Visitas",
      allowed_mentions: { parse: [] },
      embeds: [{
        title: extra.test ? "🧪 Prueba de webhook Pochi" : "🌐 Nueva visita a Pochi",
        description: extra.test
          ? "Prueba enviada desde la página de comprobación."
          : "Alguien pulsó **clic** y entró al perfil.",
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
