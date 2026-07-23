const playwright = require("playwright");

const esperarTiempoHumano = (min, max) => {
  const tiempo = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, tiempo));
};

async function realizarScrollHumano(page, veces = 2) {
  console.log("📜 [FB] Simulando lectura con scroll orgánico...");
  for (let i = 0; i < veces; i++) {
    const distancia = Math.floor(Math.random() * 200) + 150; 
    await page.mouse.wheel(0, distancia);
    await esperarTiempoHumano(2000, 4000);
  }
}

async function iniciarFarmeoFacebook(nombrePerfilObjetivo, urlPublicacion, tipoAccion, textoComentario = "") {
  console.log(`🤖 [FARMEO FB] Buscando perfil: "${nombrePerfilObjetivo}"...`);

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
      console.warn(`⚠️ [FB] No se encontró la ventana activa: "${nombrePerfilObjetivo}"`);
      return;
    }

    console.log(`✅ [FB] Enlazado a [${nombrePerfilObjetivo}]. Yendo a la publicación...`);
    await page.goto(urlPublicacion, { waitUntil: "load", timeout: 60000 });

    // 1. Simular comportamiento de lectura inicial
    await realizarScrollHumano(page, 2);
    await esperarTiempoHumano(1500, 3000);

    // 2. Ejecutar Acción
    if (tipoAccion === "like") {
      console.log("👆 [FB] Intentando dar Me Gusta...");
      // Selectores optimizados para la versión m.facebook.com y facebook móvil web
      const botonLike = page.locator('//div[@data-sigil="touchable ufi-inline-like"] | //a[contains(@role, "button") and (aria-label="Me gusta" or text()="Me gusta")] | [data-testid="fb-like-button"]').first();
      await botonLike.waitFor({ state: "visible", timeout: 10000 });
      await botonLike.click();
      console.log("✅ [FB] ¡Like procesado!");
    } 
    
    else if (tipoAccion === "comentar") {
      console.log(`✍️ [FB] Dejando comentario: "${textoComentario}"`);
      const campoComentario = page.locator("textarea[name='comment_text'], [placeholder*='Escribe un comentario'], [role='textbox']").first();
      await campoComentario.waitFor({ state: "visible", timeout: 10000 });
      await campoComentario.click();
      await esperarTiempoHumano(1000, 2000);
      
      await campoComentario.type(textoComentario, { delay: 120 });
      await esperarTiempoHumano(1000, 2000);
      
      // Presionar el botón de enviar o la tecla Enter según estructura
      await page.keyboard.press("Enter");
      console.log("✅ [FB] ¡Comentario procesado!");
    }

    await esperarTiempoHumano(4000, 6000);
    console.log(`🏆 [FB] Tarea finalizada con éxito.`);

  } catch (error) {
    console.error("❌ [FARMEO FB] Error:", error.message);
  }
}

// ── CONFIGURACIÓN DE PRUEBA ──
const perfilAControlar = "Facebook_Cuenta_01"; 
const urlTest = "https://www.facebook.com/photo.php?fbid=123456789"; 
iniciarFarmeoFacebook(perfilAControlar, urlTest, "like");