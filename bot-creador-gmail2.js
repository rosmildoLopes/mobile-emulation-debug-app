const playwright = require("playwright");

const NOMBRES = ["Carlos", "Juan", "Mateo", "Lucas", "Mariano", "Nicolas", "Diego", "Esteban", "Santiago", "Facundo"];
const APELLIDOS = ["Gomez", "Rodriguez", "Fernandez", "Lopez", "Diaz", "Martinez", "Perez", "Romero", "Alvarez", "Torres"];

const generarStringAleatorio = (largo) => Math.random().toString(36).substring(2, 2 + largo);

async function iniciarCreacionGmail() {
  console.log("🤖 [BOT-GMAIL] Iniciando flujo de registro automatizado (Modo Business Bypass)...");

  const nombre = NOMBRES[Math.floor(Math.random() * NOMBRES.length)];
  const apellido = APELLIDOS[Math.floor(Math.random() * APELLIDOS.length)];
  const idUnico = generarStringAleatorio(4);
  const usuario = `${nombre.toLowerCase()}.${apellido.toLowerCase()}.${idUnico}`;
  const contrasena = `Zx.${generarStringAleatorio(6)}!99`;

  console.log(`👤 [BOT-GMAIL] Identidad Generada: ${nombre} ${apellido} (${usuario}@gmail.com)`);
  console.log(`🔑 [BOT-GMAIL] Contraseña provisional guardada: ${contrasena}`);

  try {
    const browser = await playwright.chromium.connectOverCDP("http://localhost:9222");
    const contextos = browser.contexts();
    
    if (contextos.length === 0) {
      console.warn("⚠️ Abre un perfil en Electron antes de lanzar el bot.");
      return;
    }

    const page = contextos[0].pages()[0];
    console.log("✅ [BOT-GMAIL] Enlazado a la celda móvil de Electron.");

    // URL de Bypass comercial
    const urlRegistro = "https://accounts.google.com/signup?流量=business&biz=true&fl=2";
    console.log("🌐 [BOT-GMAIL] Navegando al registro de Google Business...");
    await page.goto(urlRegistro, { waitUntil: "load", timeout: 60000 });

    // ─── NUEVO: DETECTAR Y SALTAR LA PANTALLA DE SELECCIÓN DE EMPRESA ───
    console.log("⏳ [BOT-GMAIL] Verificando presencia de pantalla de selección de tipo de cuenta...");
    const botonObtenerGmail = page.locator("button:has-text('Obtener una dirección de Gmail')").first();
    
    try {
      // Esperamos un máximo de 6 segundos a ver si aparece el botón de tu captura
      await botonObtenerGmail.waitFor({ state: "visible", timeout: 6000 });
      console.log("👆 [BOT-GMAIL] Botón 'Obtener una dirección de Gmail' detectado. Haciendo clic...");
      await botonObtenerGmail.click();
      await page.waitForTimeout(2000); // Pausa para que cargue la transición de Google
    } catch (e) {
      console.log("ℹ️ No se detectó la pantalla intermedia corporativa, continuando directamente al formulario.");
    }

    // ─── PASO 1: RELLENAR NOMBRE Y APELLIDO ───
    console.log("✍️ [BOT-GMAIL] Escribiendo Nombre...");
    const campoNombre = page.locator("input[name='firstName']").first();
    await campoNombre.waitFor({ state: "visible", timeout: 15000 });
    await campoNombre.click();
    await campoNombre.type(nombre, { delay: 120 });

    console.log("✍️ [BOT-GMAIL] Escribiendo Apellido...");
    const campoApellido = page.locator("input[name='lastName']").first();
    await campoApellido.type(apellido, { delay: 100 });

    console.log("👆 [BOT-GMAIL] Haciendo clic en Siguiente...");
    const botonSiguiente1 = page.locator("button:has-text('Siguiente'), #collectNameNext").first();
    await botonSiguiente1.click();

    // ─── PASO 2: FECHA DE NACIMIENTO Y GÉNERO ───
    console.log("⏳ [BOT-GMAIL] Esperando pantalla de datos básicos...");
    const campoDia = page.locator("input[name='day'], #day").first();
    await campoDia.waitFor({ state: "visible", timeout: 10000 });
    await campoDia.click();
    await campoDia.type(String(Math.floor(Math.random() * 27) + 1).padStart(2, '0'), { delay: 150 });

    console.log("✍️ [BOT-GMAIL] Selector de Mes...");
    const desplegableMes = page.locator("#month").first();
    await desplegableMes.click();
    await page.waitForTimeout(600); 
    const opcionEnero = page.locator("[role='option']:has-text('Enero'), [data-value='1']").first();
    await opcionEnero.dispatchEvent("click");

    console.log("✍️ [BOT-GMAIL] Escribiendo Año...");
    const campoAno = page.locator("input[name='year'], #year").first();
    await campoAno.click();
    await campoAno.type(String(Math.floor(Math.random() * 10) + 1990), { delay: 110 });

    console.log("✍️ [BOT-GMAIL] Selector de Género...");
    const desplegableGenero = page.locator("#gender").first();
    await desplegableGenero.click(); 
    await page.waitForTimeout(600);   
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(200);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(200);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(600);

    console.log("👆 [BOT-GMAIL] Avanzando a la siguiente sección...");
    const botonSiguiente2 = page.locator("button:has-text('Siguiente'), #personalDetailsNext").first();
    await botonSiguiente2.click();

    // ─── PASO 3: NOMBRE DE USUARIO ───
    console.log("⏳ [BOT-GMAIL] Esperando pantalla de Nombre de Usuario...");
    const campoUsuario = page.locator("input[name='Username'], #username").first();
    await campoUsuario.waitFor({ state: "visible", timeout: 15000 });
    await campoUsuario.click();
    
    console.log(`✍️ [BOT-GMAIL] Escribiendo correo generado: ${usuario}`);
    await campoUsuario.type(usuario, { delay: 130 });
    await page.waitForTimeout(600);

    console.log("⌨️ [BOT-GMAIL] Enviando comando 'Enter' para avanzar...");
    await page.keyboard.press("Enter");

    // ─── PASO 4: CONTRASEÑA ───
    console.log("⏳ [BOT-GMAIL] Esperando pantalla de creación de contraseña...");
    const campoPass = page.locator("input[type='password']").nth(0);
    await campoPass.waitFor({ state: "visible", timeout: 15000 });
    await campoPass.click();

    console.log(`✍️ [BOT-GMAIL] Inyectando contraseña segura: ${contrasena}`);
    await campoPass.type(contrasena, { delay: 110 });
    await page.waitForTimeout(500);
    
    console.log("✍️ [BOT-GMAIL] Inyectando confirmación de contraseña...");
    const campoConfirmPass = page.locator("input[type='password']").nth(1);
    await campoConfirmPass.click();
    await campoConfirmPass.type(contrasena, { delay: 110 });

    await page.waitForTimeout(600);
    console.log("⌨️ [BOT-GMAIL] Enviando 'Enter' para confirmar ambas contraseñas...");
    await page.keyboard.press("Enter");

    console.log("🚀 [BOT-GMAIL] Flujo completado. Verifique el estado en la ventana.");

  } catch (err) {
    console.error("❌ Error en el flujo de automatización de Gmail:", err.message);
  }
}

iniciarCreacionGmail();