const { app, BrowserWindow, ipcMain, session } = require("electron");
const path = require("path");
const Store = require("electron-store");

app.commandLine.appendSwitch("disable-blink-features", "AutomationControlled");

if (require("electron-squirrel-startup")) app.quit();

const store = new Store();
let mainWindow = null;
const proxyCredentials = new Map();

const ANDROID_GPUS = [
  { vendor: "Qualcomm", renderer: "Adreno (TM) 740" },
  { vendor: "Qualcomm", renderer: "Adreno (TM) 730" },
  { vendor: "ARM", renderer: "Mali-G715 Immortalis-MC11" },
  { vendor: "Google", renderer: "Google Tensor GPU" }
];

function parseProxy(rawProxy) {
  if (!rawProxy || !String(rawProxy).trim()) {
    return { proxyRules: "", proxyBypassRules: "<local>;127.0.0.1;localhost", credentials: null };
  }
  let value = String(rawProxy).trim();
  if (!value.includes("://")) value = `socks5://${value}`;
  let parsed;
  try { parsed = new URL(value); } catch (e) { throw new Error(`Proxy inválido: ${rawProxy}`); }

  const protocol = parsed.protocol.replace(":", "").toLowerCase();
  const username = parsed.username ? decodeURIComponent(parsed.username) : "";
  const password = parsed.password ? decodeURIComponent(parsed.password) : "";
  const host = parsed.hostname;
  const port = parsed.port;

  return {
    proxyRules: `${protocol}://${host}:${port}`,
    proxyBypassRules: "<local>;127.0.0.1;localhost",
    credentials: username && password ? { user: username, pass: password } : null
  };
}

app.on("login", (event, webContents, request, authInfo, callback) => {
  if (!authInfo.isProxy) return;
  const creds = proxyCredentials.get(webContents.session);
  if (!creds) return;
  event.preventDefault();
  callback(creds.user, creds.pass);
});

async function applyMobileViewport(win) {
  const wc = win.webContents;
  try {
    if (!wc.debugger.isAttached()) wc.debugger.attach("1.3");

    await wc.debugger.sendCommand("Network.setUserAgentOverride", {
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36",
      platform: "Android",
      userAgentMetadata: {
        brands: [{ brand: "Google Chrome", version: "147" }, { brand: "Chromium", version: "147" }],
        platform: "Android", platformVersion: "14.0.0", architecture: "arm", model: "Pixel 8", mobile: true
      }
    });

    await wc.debugger.sendCommand("Emulation.setDeviceMetricsOverride", {
      width: 412, height: 915, deviceScaleFactor: 3, mobile: true
    });
  } catch (error) {
    console.error("Mobile Viewport Error:", error.message);
  }
}

async function applyProxyToSession({ ses, profileName, proxy }) {
  let proxyConfig;
  try { proxyConfig = parseProxy(proxy); } catch (error) {
    await ses.setProxy({ mode: "direct" });
    proxyCredentials.delete(ses);
    return { ok: false };
  }
  try {
    if (proxyConfig.credentials) proxyCredentials.set(ses, proxyConfig.credentials);
    else proxyCredentials.delete(ses);

    await ses.clearHostResolverCache();
    if (proxyConfig.proxyRules) {
      await ses.setProxy({ mode: "fixed_servers", proxyRules: proxyConfig.proxyConfig || proxyConfig.proxyRules, proxyBypassRules: proxyConfig.proxyBypassRules });
    } else {
      await ses.setProxy({ mode: "direct" });
    }
    return { ok: true };
  } catch (error) { return { ok: false }; }
}

async function createBrowserWindow({ url, profileId, profileName, proxy }) {
  const safeProfileId = profileId || Date.now();
  const safeProfileName = profileName || `Perfil ${safeProfileId}`;
  
  const profiles = store.get("profiles", []);
  const currentProfile = profiles.find(p => p.id === safeProfileId) || {};
  
  const fingerprint = currentProfile.fingerprint || {
    hardwareConcurrency: Math.random() > 0.5 ? 8 : 6,
    deviceMemory: Math.random() > 0.5 ? 8 : 12,
    canvasSeed: Math.random() * 0.2 + 0.9,
    webgl: ANDROID_GPUS[Math.floor(Math.random() * ANDROID_GPUS.length)]
  };

  const partition = `persist:profile_${safeProfileId}`;
  const ses = session.fromPartition(partition);

  await applyProxyToSession({ ses, profileName: safeProfileName, proxy });

  // INYECTOR NATIVO INMUTABLE: Pasamos las variables directamente a la precarga de la sesión
  // Esto obliga a Electron a inyectarlo de forma segura antes de que el Sandbox bloquee el proceso
  if (typeof ses.setPreloads === 'function') {
    ses.setPreloads([path.join(__dirname, "preload-inject.js")]);
  }

  // Pasamos los datos serializados mediante una cabecera HTTP interna para que el preload los lea al instante
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['X-Fingerprint-Data'] = JSON.stringify(fingerprint);
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  const win = new BrowserWindow({
    width: 412, height: 915,
    backgroundColor: "#000",
    webPreferences: {
      partition,
      contextIsolation: false, // Permitir sobreescritura nativa de prototipos
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Forzar plataforma síncronamente antes de renderizar
  win.webContents.on('commit-navigation', () => {
    win.webContents.executeJavaScript(`
      Object.defineProperty(navigator, 'platform', { get: () => 'Linux armv8l' });
      Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });
    `).catch(() => {});
  });

  await win.loadURL("about:blank");
  await applyMobileViewport(win);

  const finalUrl = url || "https://google.com";
  win.loadURL(finalUrl).catch((e) => console.log(`Error: ${e.message}`));

  return { ok: true, profileId: safeProfileId, profileName: safeProfileName };
}

ipcMain.handle("get-profiles", () => store.get("profiles", []));

ipcMain.handle("save-profile", (event, profile) => {
  const profiles = store.get("profiles", []);
  const isNew = !profile.id;
  const id = profile.id || Date.now();

  let fingerprint;
  if (isNew) {
    const randomGpu = ANDROID_GPUS[Math.floor(Math.random() * ANDROID_GPUS.length)];
    fingerprint = {
      hardwareConcurrency: Math.random() > 0.5 ? 8 : 6,
      deviceMemory: Math.random() > 0.5 ? 8 : 12,
      canvasSeed: Math.random() * 0.2 + 0.9,
      webgl: randomGpu
    };
  } else {
    const existing = profiles.find(p => p.id === id);
    fingerprint = existing?.fingerprint || {
      hardwareConcurrency: Math.random() > 0.5 ? 8 : 6,
      deviceMemory: Math.random() > 0.5 ? 8 : 12,
      canvasSeed: Math.random() * 0.2 + 0.9,
      webgl: ANDROID_GPUS[0]
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
  if (existingIndex >= 0) profiles[existingIndex] = { ...profiles[existingIndex], ...normalizedProfile };
  else profiles.push(normalizedProfile);

  store.set("profiles", profiles);
  return profiles;
});

ipcMain.handle("delete-profile", async (event, id) => {
  const profiles = store.get("profiles", []).filter((p) => p.id !== id);
  store.set("profiles", profiles); return profiles;
});

ipcMain.handle("open-browser", async (event, payload) => {
  try { return await createBrowserWindow(payload || {}); } catch (e) { return { ok: false, error: e.message }; }
});

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 900,
    backgroundColor: "#111111",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: false },
  });
  mainWindow.loadFile("index.html");
}

app.whenReady().then(() => { createMainWindow(); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });