const playwright = require("playwright");

const esperarTiempoHumano = (min, max) => {
  const tiempo = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, tiempo));
};

async function iniciarFarmeoInstagram(nombrePerfilObjetivo, urlPost, tipoAccion, textoComentario = "") {
  console.log(`🤖 [FARMEO IG] Buscando perfil: "${nombrePerfilObjetivo}"...`);

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
      console.warn(`⚠️ [IG] No se encontró la ventana activa: "${nombrePerfilObjetivo}"`);
      return;
    }

    console.log(`✅ [IG] Enlazado a [${nombrePerfilObjetivo}]. Yendo al post...`);
    await page.goto(urlPost, { waitUntil: "load", timeout: 60000 });

    // Simular visualización del post antes de interactuar
    await esperarTiempoHumano(3000, 6000);

    // 2. Ejecutar Acción
    if (tipoAccion === "like") {
      console.log("👆 [IG] Buscando el corazón de Me Gusta...");
      // Selectores específicos para el icono de Me Gusta en Instagram Móvil Web
      const botonLike = page.locator("span[*='Like'], [aria-label='Me gusta'], svg[aria-label='Me gusta']").first();
      await botonLike.waitFor({ state: "visible", timeout: 10000 });
      await botonLike.click();
      console.log("✅ [IG] ¡Like aplicado!");
    } 
    
    else if (tipoAccion === "comentar") {
      console.log(`✍️ [IG] Intentando escribir comentario...`);
      const campoComentario = page.locator("textarea[placeholder*='comentario'], textarea[placeholder*='Comenta']").first();
      await campoComentario.waitFor({ state: "visible", timeout: 10000 });
      await campoComentario.click();
      await esperarTiempoHumano(1000, 2000);
      
      await campoComentario.type(textoComentario, { delay: 140 });
      await esperarTiempoHumano(800, 1500);
      
      // En Instagram móvil web suele aparecer un botón "Publicar" al lado del texto
      const botonPublicar = page.locator("button:has-text('Publicar'), button[type='submit']").first();
      await botonPublicar.click();
      console.log("✅ [IG] ¡Comentario publicado!");
    }

    await esperarTiempoHumano(4000, 7000);
    console.log(`🏆 [IG] Tarea finalizada.`);

  } catch (error) {
    console.error("❌ [FARMEO IG] Error:", error.message);
  }
}

// ── CONFIGURACIÓN DE PRUEBA ──
const perfilAControlar = "Instagram_Cuenta_01"; 
const urlTest = "https://www.instagram.com/p/C7uExample/"; 
iniciarFarmeoInstagram(perfilAControlar, urlTest, "like");