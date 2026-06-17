const playwright = require("playwright");

// Función auxiliar para generar esperas aleatorias imitando la velocidad humana
const esperarTiempoHumano = (min, max) => {
  const tiempo = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, tiempo));
};

// Función para simular que el usuario lee deslizando la pantalla
async function realizarScrollHumano(page, veces = 2) {
  console.log("📜 [MOTOR] Simulando lectura con movimientos de pantalla...");
  for (let i = 0; i < veces; i++) {
    // Generamos un movimiento de scroll corto, aleatorio como un pulgar humano
    const distancia = Math.floor(Math.random() * 250) + 150; 
    await page.mouse.wheel(0, distancia);
    
    // Esperamos unos segundos aleatorios imitando que lee lo que bajó
    await esperarTiempoHumano(2000, 4000);
  }
}

async function ejecutarAccionDirigida(urlObjetivo, tipoAccion, comentarioTexto = "") {
  console.log(`🤖 [MOTOR] Iniciando tarea en la publicación...`);

  try {
    // Nos conectamos al puerto de tu perfil abierto en Electron
    const browser = await playwright.chromium.connectOverCDP("http://127.0.0.1:9222");
    const contextos = browser.contexts();
    
    if (contextos.length === 0) {
      console.warn("⚠️ Asegurate de tener un perfil abierto en Electron antes de lanzar el motor.");
      return;
    }

    const page = contextos[0].pages()[0];
    console.log("✅ [MOTOR] Conectado exitosamente a la sesión de tu cuenta.");

    // Navegamos directamente a la publicación que queremos farmear o interactuar
    console.log(`🌐 [MOTOR] Navegando al objetivo: ${urlObjetivo}`);
    await page.goto(urlObjetivo, { waitUntil: "load", timeout: 60000 });

    // 1. COMPORTAMIENTO HUMANO: No interactuamos de golpe. Primero hacemos scroll para simular interés.
    await realizarScrollHumano(page, 2);
    await esperarTiempoHumano(1500, 3000);

    // 2. EJECUCIÓN DE LA ACCIÓN SOLICITADA
    if (tipoAccion === "like") {
      console.log("👆 [MOTOR] Buscando el botón de 'Me gusta'...");
      
      // Selectores preparados para entornos web móviles (Instagram/Facebook móvil)
      const botonLike = page.locator("button:has-text('Me gusta'), [aria-label='Me gusta'], [data-testid='like-button']").first();
      await botonLike.waitFor({ state: "visible", timeout: 10000 });
      
      await botonLike.click();
      console.log("✅ [MOTOR] ¡Like enviado con éxito!");
    } 
    
    else if (tipoAccion === "comentar") {
      console.log(`✍️ [MOTOR] Intentando comentar: "${comentarioTexto}"`);
      
      // Buscamos el casillero de comentarios
      const campoComentario = page.locator("textarea, input[placeholder*='comentario'], input[placeholder*='Comenta']").first();
      await campoComentario.waitFor({ state: "visible", timeout: 10000 });
      
      await campoComentario.click();
      await esperarTiempoHumano(1000, 2000);
      
      // Escribimos simulando el tipeo de un teclado real
      await campoComentario.type(comentarioTexto, { delay: 120 });
      await page.keyboard.press("Enter");
      
      console.log("✅ [MOTOR] ¡Comentario publicado con éxito!");
    }

    // Pausa final antes de terminar para que no sea un corte abrupto
    await esperarTiempoHumano(3000, 5000);
    console.log("🏆 [MOTOR] Tarea finalizada.");

  } catch (err) {
    console.error("❌ Error ejecutando la acción:", err.message);
  }
}

// ─── PRUEBA MANUAL DE LABORATORIO ───
// Ponemos los datos de prueba acá abajo para verificar si funciona.
// Ejemplo: Ir a una publicación de Instagram o Facebook y darle Like.
const linkPublicacion = "https://www.instagram.com/p/C7uexample/"; // <-- ACÁ PEGÁS EL LINK QUE QUIERAS PROBAR
ejecutarAccionDirigida(linkPublicacion, "like");