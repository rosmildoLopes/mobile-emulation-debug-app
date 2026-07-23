const playwright = require("playwright");

// Tiempos de espera aleatorios imitando comportamiento humano (en milisegundos)
const esperarTiempoHumano = (min, max) => {
  const tiempo = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, tiempo));
};

async function iniciarFarmeoTikTok(nombrePerfilObjetivo, urlVideo, tipoAccion, textoComentario = "") {
  console.log(`🤖 [FARMEO] Iniciando motor de interacciones enfocado en: "${nombrePerfilObjetivo}"...`);

  try {
    // Nos conectamos al puerto 9222 de tu aplicación de Electron
    const browser = await playwright.chromium.connectOverCDP("http://127.0.0.1:9222");
    const contextos = browser.contexts();
    
    let page = null;

    // BUSCADOR DE VENTANA ESPECÍFICA: Recorremos los perfiles abiertos buscando el título correcto
    for (const contexto of contextos) {
      const paginas = contexto.pages();
      for (const p of paginas) {
        try {
          const titulo = await p.title();
          // Tu index.js titula las ventanas como "Dispositivo Emulado - NombreDelPerfil"
          if (titulo.includes(nombrePerfilObjetivo)) {
            page = p;
            break;
          }
        } catch (_) {
          // Ignora páginas temporales o en carga intermedia que puedan dar error al leer el título
        }
      }
      if (page) break;
    }

    if (!page) {
      console.warn(`⚠️ [FARMEO] No se encontró ninguna ventana activa con el nombre: "${nombrePerfilObjetivo}"`);
      console.log("👉 Asegúrate de abrir el perfil desde tu Dashboard antes de lanzar el bot.");
      return;
    }

    console.log(`✅ [FARMEO] Enlazado exitosamente al perfil específico: [${nombrePerfilObjetivo}]`);

    // Navegamos al video objetivo (usamos la versión móvil de TikTok)
    console.log(`🌐 [FARMEO] Yendo al video: ${urlVideo}`);
    await page.goto(urlVideo, { waitUntil: "load", timeout: 60000 });

    // 1. SIMULAR REPRODUCCIÓN: Nos quedamos "mirando" el video entre 6 y 12 segundos
    const tiempoVisualizacion = Math.floor(Math.random() * 6000) + 6000;
    console.log(`⏳ [FARMEO] Simulando retención de visualización por ${tiempoVisualizacion / 1000} segundos...`);
    await page.waitForTimeout(tiempoVisualizacion);

    // 2. EJECUTAR LA ACCIÓN SOLICITADA
    if (tipoAccion === "like") {
      console.log("👆 [FARMEO] Intentando dar Like...");
      
      // Selectores comunes para el botón de Me Gusta en la interfaz web de TikTok
      const botonLike = page.locator("[data-e2e='like-icon'], [aria-label='Me gusta este vídeo']").first();
      await botonLike.waitFor({ state: "visible", timeout: 10000 });
      
      await botonLike.click();
      console.log("✅ [FARMEO] ¡Like aplicado de forma orgánica!");
    } 
    
    else if (tipoAccion === "comentar") {
      console.log(`✍ *[FARMEO] Intentando dejar comentario: "${textoComentario}"`);
      
      // Buscamos el cuadro de texto para comentar
      const campoComentario = page.locator("[data-e2e='comment-input'], textarea[placeholder*='comentario']").first();
      await campoComentario.waitFor({ state: "visible", timeout: 10000 });
      
      await campoComentario.click();
      await esperarTiempoHumano(1000, 2500); // Pausa antes de escribir
      
      // Escribimos con retraso simulando teclado real
      await campoComentario.type(textoComentario, { delay: 130 });
      await esperarTiempoHumano(800, 1500);
      
      // Presionamos el botón de enviar comentario
      const botonEnviar = page.locator("[data-e2e='comment-post'], button:has-text('Publicar')").first();
      await botonEnviar.click();
      console.log("✅ [FARMEO] ¡Comentario publicado con éxito!");
    }

    // 3. PAUSA FINAL: Esperamos un poco antes de salir para no levantar sospechas
    await esperarTiempoHumano(4000, 7000);
    console.log(`🏆 [FARMEO] Tarea completada con éxito para el perfil [${nombrePerfilObjetivo}].`);

  } catch (error) {
    console.error("❌ [FÁBRICA-FARMEO] Error crítico en la interacción:", error.message);
  }
}

// ─── CONFIGURACIÓN DE EJECUCIÓN ───
// 1. Cambia "Tiktok_Cuenta_01" por el nombre exacto de tu perfil abierto en Electron.
// 2. Cambia la URL por el video real de TikTok que quieras interactuar.
const perfilAControlar = "Tiktok_Cuenta_01"; 
const videoTest = "https://www.tiktok.com/@tiktok/video/7123456789012345678"; 

iniciarFarmeoTikTok(perfilAControlar, videoTest, "like");