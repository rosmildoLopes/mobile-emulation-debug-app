const playwright = require("playwright");

const esperarTiempoHumano = (min, max) => {
  const tiempo = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, tiempo));
};

async function iniciarFarmeoTwitter(nombrePerfilObjetivo, urlTweet, tipoAccion, textoComentario = "") {
  console.log(`🤖 [FARMEO X] Buscando perfil: "${nombrePerfilObjetivo}"...`);

  try {
    const browser = await playwright.chromium.connectOverCDP("http://127.0.0.1:9222");
    const contextos = browser.contexts();
    let page = null;

    for (const contexto of contextos) {
      for (const p of contexto.pages()) {
        try {
          const titulo = await p.title();
          if (titulo.includes(nombrePerfilObjetivo)) { page = p; break; }
        } catch (_) {}
      }
      if (page) break;
    }

    if (!page) {
      console.warn(`⚠️ [X] No se encontró la ventana activa: "${nombrePerfilObjetivo}"`);
      return;
    }

    console.log(`✅ [X] Enlazado a [${nombrePerfilObjetivo}]. Yendo al Tweet...`);
    await page.goto(urlTweet, { waitUntil: "load", timeout: 60000 });

    // Esperar a que cargue la interfaz dinámica del Tweet
    await esperarTiempoHumano(3000, 6000);

    // 2. Ejecutar Acción
    if (tipoAccion === "like") {
      console.log("👆 [X] Intentando dar Like al Tweet...");
      // Selectores basados en los atributos nativos de la plataforma X móvil
      const botonLike = page.locator("[data-testid='like'], [aria-label*='Me gusta']").first();
      await botonLike.waitFor({ state: "visible", timeout: 10000 });
      await botonLike.click();
      console.log("✅ [X] ¡Like enviado!");
    } 
    
    else if (tipoAccion === "comentar") {
      console.log(`✍️ [X] Intentando responder al Tweet...`);
      const campoRespuesta = page.locator("[data-testid='tweetTextarea_0'], [role='textbox'][placeholder*='Respuesta']").first();
      await campoRespuesta.waitFor({ state: "visible", timeout: 10000 });
      await campoRespuesta.click();
      await esperarTiempoHumano(1000, 2000);
      
      await campoRespuesta.type(textoComentario, { delay: 110 });
      await esperarTiempoHumano(1000, 1800);
      
      const botonEnviar = page.locator("[data-testid='tweetButtonInline'], button:has-text('Responder')").first();
      await botonEnviar.click();
      console.log("✅ [X] ¡Respuesta publicada!");
    }

    await esperarTiempoHumano(4000, 7000);
    console.log(`🏆 [X] Tarea finalizada.`);

  } catch (error) {
    console.error("❌ [FARMEO X] Error:", error.message);
  }
}

// ── CONFIGURACIÓN DE PRUEBA ──
const perfilAControlar = "Twitter_Cuenta_01"; 
const urlTest = "https://x.com/jack/status/20"; 
iniciarFarmeoTwitter(perfilAControlar, urlTest, "like");