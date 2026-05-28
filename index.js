const { app, BrowserWindow, ipcMain, session, netLog } = require("electron");
const path = require("path");
const Store = require("electron-store");
const fs = require("fs"); // <-- NUEVO: Módulo nativo para manejo de archivos de backup

app.commandLine.appendSwitch("disable-blink-features", "AutomationControlled");

if (require("electron-squirrel-startup")) app.quit();

const store = new Store();

let mainWindow = null;

const proxyCredentials = new Map();
const activeSessions = new Map();

const openingProfiles = new Set();
const registeredPreloads = new Set();
const registeredHeaderHooks = new Set();

const ANDROID_GPUS = [
  {
    vendor: "Qualcomm",
    renderer: "Adreno (TM) 740",
    extensions: [
      "ANGLE_instanced_arrays",
      "EXT_blend_minmax",
      "EXT_color_buffer_half_float",
      "EXT_disjoint_timer_query",
      "EXT_float_blend",
      "EXT_frag_depth",
      "EXT_shader_texture_lod",
      "EXT_texture_compression_bptc",
      "EXT_texture_compression_rgtc",
      "EXT_texture_filter_anisotropic",
      "EXT_sRGB",
      "KHR_parallel_shader_compile",
      "OES_element_index_uint",
      "OES_fbo_render_mipmap",
      "OES_standard_derivatives",
      "OES_texture_float",
      "OES_texture_float_linear",
      "OES_texture_half_float",
      "OES_texture_half_float_linear",
      "OES_vertex_array_object",
      "WEBGL_color_buffer_float",
      "WEBGL_compressed_texture_astc",
      "WEBGL_compressed_texture_etc",
      "WEBGL_compressed_texture_etc1",
      "WEBGL_debug_renderer_info",
      "WEBGL_debug_shaders",
      "WEBGL_depth_texture",
      "WEBGL_draw_buffers",
      "WEBGL_lose_context",
      "WEBGL_multi_draw"
    ]
  },
  {
    vendor: "Qualcomm",
    renderer: "Adreno (TM) 730",
    extensions: [
      "ANGLE_instanced_arrays",
      "EXT_blend_minmax",
      "EXT_color_buffer_half_float",
      "EXT_disjoint_timer_query",
      "EXT_float_blend",
      "EXT_frag_depth",
      "EXT_shader_texture_lod",
      "EXT_texture_compression_rgtc",
      "EXT_texture_filter_anisotropic",
      "EXT_sRGB",
      "KHR_parallel_shader_compile",
      "OES_element_index_uint",
      "OES_fbo_render_mipmap",
      "OES_standard_derivatives",
      "OES_texture_float",
      "OES_texture_float_linear",
      "OES_texture_half_float",
      "OES_texture_half_float_linear",
      "OES_vertex_array_object",
      "WEBGL_color_buffer_float",
      "WEBGL_compressed_texture_astc",
      "WEBGL_compressed_texture_etc",
      "WEBGL_compressed_texture_etc1",
      "WEBGL_debug_renderer_info",
      "WEBGL_debug_shaders",
      "WEBGL_depth_texture",
      "WEBGL_draw_buffers",
      "WEBGL_lose_context"
    ]
  }
];

// ─── NUEVO: FUNCIÓN AUTOMÁTICA DE RESPALDO DE PERFILES ────────────────────────
function ejecutarBackupAutomatico() {
  try {
    const userDataPath = app.getPath("userData");
    // Definimos la carpeta destino del backup dentro del directorio de la app
    const backupDir = path.join(userDataPath, "Backups");
    
    // Si la carpeta de backups no existe, la creamos
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // 1. Respaldar la base de datos de perfiles (config.json del electron-store)
    const configPath = path.join(userDataPath, "config.json");
    if (fs.existsSync(configPath)) {
      const fecha = new Date().toISOString().slice(0, 10); // Formato YYYY-MM-DD
      const destConfigPath = path.join(backupDir, `config_backup_${fecha}.json`);
      fs.copyFileSync(configPath, destConfigPath);
      console.log(`📦 [AUTOMÁTICO] Base de datos respaldada con éxito en: ${destConfigPath}`);
    }

    // 2. Limpieza de backups viejos: Conservar solo los últimos 7 días para no saturar el SSD
    const archivos = fs.readdirSync(backupDir);
    if (archivos.length > 7) {
      archivos.sort((a, b) => {
        return fs.statSync(path.join(backupDir, a)).birthtimeMs - fs.statSync(path.join(backupDir, b)).birthtimeMs;
      });
      // Borra el archivo de copia de seguridad más antiguo si excede la cuota de una semana
      while (archivos.length > 7) {
        const antiguo = archivos.shift();
        fs.unlinkSync(path.join(backupDir, antiguo));
        console.log(`🧹 [AUTOMÁTICO] Copia antigua eliminada para ahorrar espacio: ${antiguo}`);
      }
    }
  } catch (err) {
    console.error("❌ Error ejecutando el backup automático:", err.message);
  }
}

function notifyDashboardUpdate() {
  if (mainWindow && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send(
      "sessions-updated",
      Array.from(activeSessions.entries())
    );
  }
}

function parseProxy(rawProxy) {
  if (!rawProxy || !String(rawProxy).trim()) {
    return {
      proxyRules: "",
      credentials: null
    };
  }

  let value = String(rawProxy).trim().replace(/\s/g, "");

  if (!value.includes("://")) {
    value = `socks5://${value}`;
  }

  let parsed;

  try {
    parsed = new URL(value);
  } catch (error) {
    throw new Error(`Formato de proxy inválido: ${rawProxy}`);
  }

  const protocol = parsed.protocol.replace(":", "").toLowerCase();
  const username = parsed.username ? decodeURIComponent(parsed.username) : "";
  const password = parsed.password ? decodeURIComponent(parsed.password) : "";
  const host = parsed.hostname;
  const port = parsed.port;

  if (!host || !port) {
    throw new Error(`Proxy incompleto. Debe incluir host y puerto: ${rawProxy}`);
  }

  const allowedProtocols = ["http", "https", "socks4", "socks5"];

  if (!allowedProtocols.includes(protocol)) {
    throw new Error(`Protocolo de proxy no soportado: ${protocol}`);
  }

  return {
    proxyRules: `${protocol}://${host}:${port}`,
    credentials:
      username && password
        ? {
            user: username,
            pass: password
          }
        : null
  };
}

app.on("login", (event, webContents, request, authInfo, callback) => {
  if (!authInfo.isProxy) return;

  if (!webContents || webContents.isDestroyed()) {
    console.warn("⚠️ Proxy pidió autenticación, pero no hay webContents válido.");
    return;
  }

  const ses = webContents.session;
  const creds = proxyCredentials.get(ses);

  if (!creds) {
    console.warn(
      "⚠️ Proxy pidió autenticación, pero no hay credenciales guardadas para esta sesión."
    );
    return;
  }

  event.preventDefault();
  callback(creds.user, creds.pass);

  console.log("🔑 Proxy Auth aplicado correctamente.");
});

async function applyMobileViewport(win, fingerprint) {
  const wc = win.webContents;

  try {
    if (!wc.debugger.isAttached()) {
      wc.debugger.attach("1.3");
    }

    await wc.debugger.sendCommand("Network.setUserAgentOverride", {
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36",
      platform: "Android",
      userAgentMetadata: {
        brands: [
          {
            brand: "Google Chrome",
            version: "147"
          },
          {
            brand: "Chromium",
            version: "147"
          },
          {
            brand: "Not=A?Brand",
            version: "24"
          }
        ],
        fullVersion: "147.0.7463.65",
        platform: "Android",
        platformVersion: fingerprint.platformVersion || "14.0.0",
        architecture: "arm",
        model: fingerprint.model || "Pixel 8",
        mobile: true,
        bitness: "64",
        wow64: false
      }
    });

    await wc.debugger.sendCommand("Emulation.setDeviceMetricsOverride", {
      width: 412,
      height: 915,
      deviceScaleFactor: 3,
      mobile: true,
      fitWindow: true
    });

    await wc.debugger.sendCommand("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 5
    });

    console.log("📱 Viewport móvil aplicado con ajuste vertical.");
  } catch (error) {
    console.error("❌ Mobile Viewport Error:", error.message);
  }
}

async function applyProxyToSession({ ses, profileName, proxy }) {
  let proxyConfig;

  try {
    proxyConfig = parseProxy(proxy);
  } catch (error) {
    console.error(`❌ Error en proxy [${profileName}]:`, error.message);

    try {
      await ses.setProxy({
        mode: "direct"
      });
    } catch (_) {}

    proxyCredentials.delete(ses);

    return {
      ok: false,
      error: error.message
    };
  }

  try {
    if (proxyConfig.credentials) {
      proxyCredentials.set(ses, proxyConfig.credentials);
    } else {
      proxyCredentials.delete(ses);
    }

    try {
      await ses.clearHostResolverCache();
    } catch (_) {}

    if (proxyConfig.proxyRules) {
      await ses.setProxy({
        mode: "fixed_servers",
        proxyRules: proxyConfig.proxyRules,
        proxyBypassRules: "<-loopback>"
      });

      console.log(
        `📡 Perfil [${profileName}] -> Proxy Configurado: ${proxyConfig.proxyRules}`
      );
    } else {
      await ses.setProxy({
        mode: "direct"
      });

      console.log(`📡 Perfil [${profileName}] -> Conexión Directa`);
    }

    return {
      ok: true
    };
  } catch (error) {
    console.error(`❌ Error aplicando proxy en [${profileName}]:`, error);

    return {
      ok: false,
      error: error.message
    };
  }
}

function registerPreloadForSession({ ses, partition, safeProfileId }) {
  if (registeredPreloads.has(partition)) return;

  const preloadInjectPath = path.join(__dirname, "preload-inject.js");

  try {
    if (typeof ses.registerPreloadScript === "function") {
      ses.registerPreloadScript({
        type: "frame",
        id: `preload-${safeProfileId}`,
        filePath: preloadInjectPath
      });

      console.log(`✅ registerPreloadScript aplicado: ${partition}`);
    } else if (typeof ses.setPreloads === "function") {
      ses.setPreloads([preloadInjectPath]);

      console.log(`✅ setPreloads aplicado: ${partition}`);
    } else {
      console.warn("⚠️ Esta versión de Electron no soporta registerPreloadScript ni setPreloads.");
    }

    registeredPreloads.add(partition);
  } catch (error) {
    console.error("❌ Error registrando preload:", error);
  }
}

function registerHeaderHookForSession({ ses, partition, getFingerprint }) {
  if (registeredHeaderHooks.has(partition)) return;

  try {
    ses.webRequest.onBeforeSendHeaders((details, callback) => {
      const requestHeaders = {
        ...details.requestHeaders
      };

      try {
        requestHeaders["X-Fingerprint-Data"] = JSON.stringify(getFingerprint());
      } catch (_) {}

      callback({
        cancel: false,
        requestHeaders
      });
    });

    registeredHeaderHooks.add(partition);

    console.log(`✅ Header hook registrado: ${partition}`);
  } catch (error) {
    console.error("❌ Error registrando onBeforeSendHeaders:", error);
  }
}

function attachWindowDiagnostics(win, safeProfileName) {
  win.once("ready-to-show", () => {
    console.log(`✅ Ventana lista: ${safeProfileName}`);
    win.show();
  });

  win.webContents.on("did-start-loading", () => {
    console.log(`⏳ Cargando en [${safeProfileName}]...`);
  });

  win.webContents.on("did-finish-load", () => {
    console.log(
      `✅ Carga finalizada en [${safeProfileName}]: ${win.webContents.getURL()}`
    );
  });

  win.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      console.error("❌ did-fail-load:", {
        profile: safeProfileName,
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame
      });
    }
  );

  win.webContents.on("render-process-gone", (event, details) => {
    console.error("💥 render-process-gone:", {
      profile: safeProfileName,
      details
    });
  });

  win.webContents.on("unresponsive", () => {
    console.error(`⚠️ Ventana no responde: ${safeProfileName}`);
  });

  win.webContents.on("destroyed", () => {
    console.log(`🧹 webContents destruido: ${safeProfileName}`);
  });
}

function normalizeProfileId(profileId) {
  if (profileId === undefined || profileId === null || profileId === "") {
    return Date.now();
  }

  return profileId;
}

async function createBrowserWindow({ url, profileId, profileName, proxy }) {
  const safeProfileId = normalizeProfileId(profileId);
  const safeProfileName = profileName || `Perfil ${safeProfileId}`;

  const profiles = store.get("profiles", []);
  const currentProfile = profiles.find((p) => p.id === safeProfileId) || {};

  const gpuEntry = currentProfile.fingerprint?.webgl
    ? ANDROID_GPUS.find(
        (g) => g.renderer === currentProfile.fingerprint.webgl.renderer
      ) || ANDROID_GPUS[0]
    : ANDROID_GPUS[0];

  const fingerprint = currentProfile.fingerprint || {
    hardwareConcurrency: 8,
    deviceMemory: 8,
    canvasSeed: 1.0,
    audioNoiseSeed: 0.000042,
    webgl: {
      vendor: gpuEntry.vendor,
      renderer: gpuEntry.renderer
    },
    platformVersion: "14.0.0",
    model: "Pixel 8"
  };

  const enrichedFingerprint = {
    ...fingerprint,
    webgl: {
      vendor: gpuEntry.vendor,
      renderer: gpuEntry.renderer,
      extensions: gpuEntry.extensions
    }
  };

  const partition = `persist:profile_${safeProfileId}`;
  const ses = session.fromPartition(partition);

  const proxyResult = await applyProxyToSession({
    ses,
    profileName: safeProfileName,
    proxy
  });

  if (!proxyResult.ok) {
    console.warn(
      `⚠️ Se continuará con la ventana aunque el proxy haya fallado: ${proxyResult.error}`
    );
  }

  registerPreloadForSession({
    ses,
    partition,
    safeProfileId
  });

  registerHeaderHookForSession({
    ses,
    partition,
    getFingerprint: () => enrichedFingerprint
  });

  const win = new BrowserWindow({
    width: 460,
    height: 1000,
    show: false,
    title: `Dispositivo Emulado - ${safeProfileName}`,
    resizable: true,
    maximizable: false,
    frame: true,
    autoHideMenuBar: true,
    backgroundColor: "#000000",
    webPreferences: {
      partition,
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false
    }
  });

  attachWindowDiagnostics(win, safeProfileName);

  activeSessions.set(win.id, {
    profileId: safeProfileId,
    profileName: safeProfileName,
    proxy: proxy || "Directa"
  });

  notifyDashboardUpdate();

  win.on("closed", () => {
    activeSessions.delete(win.id);
    notifyDashboardUpdate();
  });

  win.webContents.on("commit-navigation", () => {
    win.webContents
      .executeJavaScript(`
        try {
          Object.defineProperty(navigator, "platform", {
            get: () => "Linux armv8l",
            configurable: true
          });

          Object.defineProperty(navigator, "vendor", {
            get: () => "Google Inc.",
            configurable: true
          });
        } catch (e) {}
      `)
      .catch(() => {});
  });

  try {
    console.log(`🪟 Creando ventana para [${safeProfileName}]...`);

    await win.loadURL("about:blank");

    await applyMobileViewport(win, enrichedFingerprint);

    const finalUrl = url || "https://google.com";

    console.log(`🌐 Navegando [${safeProfileName}] -> ${finalUrl}`);

    await win.loadURL(finalUrl);

    return {
      ok: true,
      profileId: safeProfileId,
      profileName: safeProfileName,
      windowId: win.id
    };
  } catch (error) {
    console.error(`❌ Error cargando ventana [${safeProfileName}]:`, error);

    if (!win.isDestroyed()) {
      win.show();

      try {
        await win.loadURL(
          "data:text/html;charset=utf-8," +
            encodeURIComponent(`
              <html>
                <body style="background:#111;color:#eee;font-family:sans-serif;padding:24px;">
                  <h2>Error cargando la ventana</h2>
                  <p><strong>Perfil:</strong> ${safeProfileName}</p>
                  <p><strong>Error:</strong> ${error.message}</p>
                </body>
              </html>
            `)
        );
      } catch (_) {}
    }

    return {
      ok: false,
      error: error.message
    };
  }
}

ipcMain.handle("get-profiles", () => {
  return store.get("profiles", []);
});

ipcMain.handle("get-active-sessions", () => {
  return Array.from(activeSessions.entries());
});

ipcMain.handle("save-profile", (event, profile) => {
  const profiles = store.get("profiles", []);
  const id = profile.id || Date.now();
  const isNew = !profile.id;

  let fingerprint;

  if (isNew) {
    fingerprint = {
      hardwareConcurrency: 8,
      deviceMemory: 8,
      canvasSeed: Math.random() * 0.2 + 0.9,
      audioNoiseSeed: Math.random() * 0.00009 + 0.00001,
      webgl: {
        vendor: ANDROID_GPUS[0].vendor,
        renderer: ANDROID_GPUS[0].renderer
      },
      platformVersion: "14.0.0",
      model: "Pixel 8"
    };
  } else {
    const existing = profiles.find((p) => p.id === id);

    fingerprint =
      existing?.fingerprint || {
        hardwareConcurrency: 8,
        deviceMemory: 8,
        canvasSeed: 1.0,
        audioNoiseSeed: 0.000042,
        webgl: {
          vendor: ANDROID_GPUS[0].vendor,
          renderer: ANDROID_GPUS[0].renderer
        },
        platformVersion: "14.0.0",
        model: "Pixel 8"
      };
  }

  const normalizedProfile = {
    id,
    profileName: profile.profileName || profile.name || "Perfil sin nombre",
    name: profile.name || profile.profileName || "Perfil sin nombre",
    proxy: profile.proxy || "",
    url: profile.url || "https://google.com",
    createdAt: profile.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fingerprint
  };

  const existingIndex = profiles.findIndex((p) => p.id === normalizedProfile.id);

  if (existingIndex >= 0) {
    profiles[existingIndex] = {
      ...profiles[existingIndex],
      ...normalizedProfile
    };
  } else {
    profiles.push(normalizedProfile);
  }

  store.set("profiles", profiles);

  return profiles;
});

ipcMain.handle("delete-profile", async (event, id) => {
  const profiles = store.get("profiles", []).filter((p) => p.id !== id);
  store.set("profiles", profiles);
  return profiles;
});

ipcMain.handle("open-browser", async (event, payload) => {
  const key = String(
    payload?.profileId || payload?.profileName || payload?.name || "default"
  );

  if (openingProfiles.has(key)) {
    console.warn(`⚠️ Apertura duplicada bloqueada: ${key}`);

    return {
      ok: false,
      error: "Ese perfil ya se está abriendo."
    };
  }

  openingProfiles.add(key);

  try {
    return await createBrowserWindow(payload || {});
  } catch (error) {
    console.error("❌ open-browser error:", error);

    return {
      ok: false,
      error: error.message
    };
  } finally {
    openingProfiles.delete(key);
  }
});

ipcMain.handle("start-netlog", async () => {
  const logPath = path.join(app.getPath("userData"), "electron-netlog.json");

  try {
    await netLog.startLogging(logPath);

    console.log(`📝 NetLog iniciado: ${logPath}`);

    return {
      ok: true,
      path: logPath
    };
  } catch (error) {
    console.error("❌ Error iniciando NetLog:", error);

    return {
      ok: false,
      error: error.message
    };
  }
});

ipcMain.handle("stop-netlog", async () => {
  try {
    const logPath = await netLog.stopLogging();

    console.log(`📝 NetLog detenido: ${logPath}`);

    return {
      ok: true,
      path: logPath
    };
  } catch (error) {
    console.error("❌ Error deteniendo NetLog:", error);

    return {
      ok: false,
      error: error.message
    };
  }
});

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    backgroundColor: "#111111",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: false
    }
  });

  mainWindow.webContents.on("did-fail-load", (event, code, desc, url) => {
    console.error("❌ MainWindow did-fail-load:", {
      code,
      desc,
      url
    });
  });

  mainWindow.webContents.on("render-process-gone", (event, details) => {
    console.error("💥 MainWindow render-process-gone:", details);
  });

  mainWindow.loadFile("index.html");
}

app.whenReady().then(() => {
  // ─── LLAMADA AL INICIAR LA APP ───
  ejecutarBackupAutomatico(); 

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});