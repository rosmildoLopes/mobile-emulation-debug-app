const playwright = require("playwright");

/**
 * Función principal para controlar una ventana activa
 * @param {string} finalUrl - esta es la URL que el bot debe navegar
 */
async function iniciarAutomatizacion(finalUrl = "https://google.com") {
  console.log("🤖 [BOT] Intentando conectar con la ventana de Electron...");

  try {
    // Nos conectamos al puerto 9222 que abrimos en index.js
    const browser = await playwright.chromium.connectOverCDP("http://localhost:9222");
    console.log("✅ [BOT] Conexión CDP establecida con éxito.");

    // Obtenemos los contextos abiertos (las páginas web activas dentro de Electron)
    const contextos = browser.contexts();
    if (contextos.length === 0) {
      console.warn("⚠️ [BOT] No se encontraron contextos de navegación activos. Abre un perfil primero.");
      return;
    }

    // Tomamos la primera página disponible (la ventana del perfil emulado)
    const paginas = contextos[0].pages();
    if (paginas.length === 0) {
      console.warn("⚠️ [BOT] No hay páginas abiertas en este perfil.");
      return;
    }

    const page = paginas[0];
    console.log(`📱 [BOT] Control tomando sobre la ventana actual. URL de origen: ${page.url()}`);

    // --- ACCIONES DEL BOT ---
    
    console.log(`🌐 [BOT] Navegando de forma automatizada hacia: ${finalUrl}`);
    // Navegamos con una espera segura para conexiones móviles 4G
    await page.goto(finalUrl, { waitUntil: "load", timeout: 60000 });

    // Ejemplo de interacción simulando comportamiento humano:
    console.log("✍️ [BOT] Buscando campo de entrada y simulando escritura humana...");
    
    // Si la página es Google, buscamos el buscador, hacemos clic y escribimos lento
    if (finalUrl.includes("google.com")) {
      const buscador = page.locator("textarea[name='q'], input[name='q']").first();
      await buscador.waitFor({ state: "visible", timeout: 5000 });
      await buscador.click();
      
      // type() escribe carácter por carácter con un delay aleatorio para no alertar sistemas anti-bot
      await buscador.type("¿Cómo sabe AmIUnique quién soy?", { delay: 100 });
      await page.keyboard.press("Enter");
      console.log("🎉 [BOT] Simulación completada con éxito.");
    }

    // No cerramos el navegador (browser.close()) para que tu perfil de Electron siga vivo en la pantalla.
    await browser.disconnect();
    console.log("🔌 [BOT] Desconectado del puerto de depuración. La ventana queda en tus manos.");

  } catch (error) {
    console.error("❌ [BOT] Error durante la automatización:", error.message);
  }
}

iniciarAutomatizacion("https://google.com");