const playwright = require("playwright");

// Datos aleatorios para las identidades
const NOMBRES = ["Carlos", "Juan", "Mateo", "Lucas", "Mariano", "Nicolas", "Diego", "Esteban", "Santiago", "Facundo"];
const APELLIDOS = ["Gomez", "Rodriguez", "Fernandez", "Lopez", "Diaz", "Martinez", "Perez", "Romero", "Alvarez", "Torres"];
const generarStringAleatorio = (largo) => Math.random().toString(36).substring(2, 2 + largo);

// ─── SIMULACIÓN DE API GRATUITA PARA DESARROLLO (MOCK) ───
async function comprarNumeroSMS() {
  console.log("🛠️ [MOCK-SMS] Simulando compra de número... (Gratis para pruebas)");
  return {
    id: "999999",
    phone: "+541123456789" 
  };
}

async function consultarCodigoSMS(pedidoId) {
  console.log("🛠️ [MOCK-SMS] Simulando espera del código de verificación en segundo plano...");
  await new Promise(resolve => setTimeout(resolve, 3000));
  return "123456";
}

async function iniciarFabrica() {
  console.log("🤖 [FÁBRICA] Iniciando creación automatizada de identidad...");

  const nombre = NOMBRES[Math.floor(Math.random() * NOMBRES.length)];
  const apellido = APELLIDOS[Math.floor(Math.random() * APELLIDOS.length)];
  const idUnico = generarStringAleatorio(4);
  const usuario = `${nombre.toLowerCase()}.${apellido.toLowerCase()}.${idUnico}`;
  const contrasena = `Zx.${generarStringAleatorio(6)}!99`;

  console.log(`👤 [FÁBRICA] Identidad: ${nombre} ${apellido} | Email: ${usuario}@gmail.com | Pass: ${contrasena}`);

  try {
    // Conexión forzada por IPv4 local explícita
    const browser = await playwright.chromium.connectOverCDP("http://127.0.0.1:9222");
    const contextos = browser.contexts();
    
    if (contextos.length === 0) {
      console.warn("⚠️ Abre un perfil en Electron antes de lanzar el bot.");
      return;
    }

    const page = contextos[0].pages()[0];
    console.log("✅ [FÁBRICA] Enlazado al Antidetect Electron.");

    console.log("🌐 [FÁBRICA] Navegando al portal de acceso...");
    // Utilizamos la URL base de inicio de sesión para activar el flujo alternativo menos restrictivo
    await page.goto("https://accounts.google.com/v3/signin/identifier?continue=https%3A%2F%2Fmail.google.com%2Fmail%2F&service=mail&flowName=GlifWebSignIn&flowEntry=ServiceLogin", { waitUntil: "load", timeout: 60000 });

    // Interacción inicial para desplegar las opciones de registro
    console.log("👆 [FÁBRICA] Desplegando opciones de 'Crear cuenta'...");
    const botonCrear = page.locator("button:has-text('Crear cuenta'), span:has-text('Crear cuenta')").first();
    await botonCrear.waitFor({ state: "visible", timeout: 15000 });
    await botonCrear.click();
    await page.waitForTimeout(800);
   
    // Selección directa mediante comandos de teclado nativos para uso personal
    console.log("⌨️ [FÁBRICA] Seleccionando opción 'Para mi uso personal'...");
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");
    
    // Espera prudencial para la transición de pantallas
    await page.waitForTimeout(3000);

    // ─── PASO 1: NOMBRE Y APELLIDO ───
    console.log("✍️ [FÁBRICA] Escribiendo Nombre y Apellido...");
    const campoNombre = page.locator("input[name='firstName']").first();
    await campoNombre.waitFor({ state: "visible", timeout: 15000 });
    await campoNombre.click();
    await campoNombre.type(nombre, { delay: 120 });

    const campoApellido = page.locator("input[name='lastName']").first();
    await campoApellido.type(apellido, { delay: 100 });

    console.log("👆 [FÁBRICA] Haciendo clic en Siguiente...");
    const botonSiguiente1 = page.locator("button:has-text('Siguiente'), #collectNameNext").first();
    await botonSiguiente1.click();

    // ─── PASO 2: FECHA DE NACIMIENTO Y GÉNERO ───
    console.log("⏳ [FÁBRICA] Esperando pantalla de datos básicos...");
    const campoDia = page.locator("input[name='day'], #day").first();
    await campoDia.waitFor({ state: "visible", timeout: 10000 });
    await campoDia.click();
    await campoDia.type(String(Math.floor(Math.random() * 27) + 1).padStart(2, '0'), { delay: 150 });

    console.log("✍️ [FÁBRICA] Selector de Mes...");
    const desplegableMes = page.locator("#month").first();
    await desplegableMes.click();
    await page.waitForTimeout(600); 
    const opcionEnero = page.locator("[role='option']:has-text('Enero'), [data-value='1']").first();
    await opcionEnero.dispatchEvent("click");

    console.log("✍️ [FÁBRICA] Escribiendo Año...");
    const campoAno = page.locator("input[name='year'], #year").first();
    await campoAno.click();
    await campoAno.type(String(Math.floor(Math.random() * 10) + 1990), { delay: 110 });

    console.log("✍️ [FÁBRICA] Selector de Género (Mecánico)...");
    const desplegableGenero = page.locator("#gender").first();
    await desplegableGenero.click(); 
    await page.waitForTimeout(600);   
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(200);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(200);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(600);

    console.log("👆 [FÁBRICA] Avanzando desde datos básicos...");
    const botonSiguiente2 = page.locator("button:has-text('Siguiente'), #personalDetailsNext").first();
    await botonSiguiente2.click();

    // ─── PASO 3: NOMBRE DE USUARIO ───
    console.log("⏳ [FÁBRICA] Esperando pantalla de Nombre de Usuario...");
    const campoUsuario = page.locator("input[name='Username'], #username").first();
    await campoUsuario.waitFor({ state: "visible", timeout: 15000 });
    await campoUsuario.click();
    
    console.log(`✍️ [FÁBRICA] Escribiendo correo generado: ${usuario}`);
    await campoUsuario.type(usuario, { delay: 130 });
    await page.waitForTimeout(600);

    console.log("⌨️ [FÁBRICA] Enviando 'Enter' para avanzar...");
    await page.keyboard.press("Enter");

    // ─── PASO 4: CONTRASEÑA ───
    console.log("⏳ [FÁBRICA] Esperando pantalla de creación de contraseña...");
    const campoPass = page.locator("input[type='password']").nth(0);
    await campoPass.waitFor({ state: "visible", timeout: 15000 });
    await campoPass.click();

    console.log(`✍️ [FÁBRICA] Inyectando contraseña segura: ${contrasena}`);
    await campoPass.type(contrasena, { delay: 110 });
    await page.waitForTimeout(500);
    
    console.log("✍️ [FÁBRICA] Inyectando confirmación de contraseña...");
    const campoConfirmPass = page.locator("input[type='password']").nth(1);
    await campoConfirmPass.click();
    await campoConfirmPass.type(contrasena, { delay: 110 });

    await page.waitForTimeout(600);
    console.log("⌨️ [FÁBRICA] Enviando 'Enter' para confirmar contraseñas...");
    await page.keyboard.press("Enter");

    // ─── PASO 5: EL MURO DEL TELÉFONO / QR ───
    console.log("⏳ [FÁBRICA] Esperando pantalla de desafío telefónico...");
    const campoTelefono = page.locator("input[type='tel'], #phoneNumberId").first();
    await campoTelefono.waitFor({ state: "visible", timeout: 20000 });

    console.log("📞 [MOCK-SMS] Solicitando compra de número virtual de prueba...");
    const pedidoSMS = await comprarNumeroSMS();
    console.log(`✅ [MOCK-SMS] Número adquirido: ${pedidoSMS.phone}`);

    console.log("✍️ [FÁBRICA] Inyectando número en la pantalla...");
    await campoTelefono.click();
    await campoTelefono.type(pedidoSMS.phone, { delay: 100 });
    await page.keyboard.press("Enter");

    // ─── PASO 6: CONSULTAR EL CÓDIGO SMS ───
    console.log("⏳ [FÁBRICA] Esperando simulación de despacho de código...");
    let codigoRecibido = null;
    
    for (let intento = 1; intento <= 3; intento++) {
      await page.waitForTimeout(2000);
      codigoRecibido = await consultarCodigoSMS(pedidoSMS.id);
      if (codigoRecibido) {
        console.log(`🎉 [MOCK-SMS] Código simulado obtenido: ${codigoRecibido}`);
        break;
      }
    }

    console.log("✍️ [FÁBRICA] Ingresando código de verificación ficticio...");
    const campoCodigo = page.locator("input[id='code'], input[name='code']").first();
    await campoCodigo.waitFor({ state: "visible", timeout: 10000 });
    await campoCodigo.type(codigoRecibido, { delay: 120 });
    await page.keyboard.press("Enter");

    console.log("🏆 [FÁBRICA] Simulación terminada con éxito.");

  } catch (err) {
    console.error("❌ Fallo crítico en el recorrido de la fábrica:", err.message);
  }
}

// Ejecutamos la fábrica
iniciarFabrica();