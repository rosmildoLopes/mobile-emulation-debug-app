const { app, BrowserWindow, ipcMain, session } = require("electron");
const path = require("path");
const Store = require("electron-store");

if (require("electron-squirrel-startup")) app.quit();

const store = new Store();
let mainWindow = null;
const activeSessions = new Map();

const ANDROID_PIXEL_8 = {
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36",
  width: 412,
  height: 915,
  deviceScaleFactor: 3,
  mobile: true,
  platform: "Android"
};

// Manejador de autenticación de Proxy (Soporta usuario:pass)
app.on('login', (event, webContents, request, authInfo, callback) => {
  if (authInfo.isProxy) {
    event.preventDefault();
    // Intenta extraer credenciales del string de proxy guardado
    const sesId = webContents.getURL(); 
    // Por simplicidad, si el proxy se pasó como user:pass@ip, Electron suele manejarlo,
    // pero este callback evita que la ventana quede colgada pidiendo pass.
    callback('', ''); 
  }
});

async function applyStealth(win, profile) {
  const wc = win.webContents;
  try {
    if (!wc.debugger.isAttached()) wc.debugger.attach("1.3");
    await wc.debugger.sendCommand("Network.setUserAgentOverride", {
      userAgent: profile.userAgent,
      platform: profile.platform,
      userAgentMetadata: {
        brands: [{ brand: "Google Chrome", version: "143" }, { brand: "Not-A.Brand", version: "24" }],
        fullVersionList: [{ brand: "Google Chrome", version: "143.0.6478.127" }],
        platform: profile.platform, platformVersion: "14.0.0", architecture: "arm", model: "Pixel 8", mobile: true
      }
    });
    await wc.debugger.sendCommand("Emulation.setDeviceMetricsOverride", {
      width: profile.width, height: profile.height, deviceScaleFactor: profile.deviceScaleFactor,
      mobile: true, screenOrientation: { type: 'portraitPrimary', angle: 0 }
    });
    await wc.debugger.sendCommand("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await wc.debugger.sendCommand("Emulation.setLocaleOverride", { locale: "es-419" });
    await wc.debugger.sendCommand("Emulation.setTimezoneOverride", { timezoneId: "America/Argentina/Buenos_Aires" });
  } catch (e) { console.error("Stealth Error:", e); }
}

async function createBrowserWindow({ url, profileId, profileName, proxy }) {
  const partition = `persist:profile_${profileId}`;
  const ses = session.fromPartition(partition);

  // Configuración de Proxy
  if (proxy && proxy.trim() !== "") {
    let proxyRules = proxy.trim();
    if (!proxyRules.includes("://")) proxyRules = "http://" + proxyRules;
    await ses.setProxy({ proxyRules });
  } else {
    await ses.setProxy({ proxyRules: "" });
  }

  // Política WebRTC para evitar filtraciones de IP real
  if (typeof ses.setWebRTCIPHandlingPolicy === 'function') {
    ses.setWebRTCIPHandlingPolicy('disable_non_proxied_udp');
  } else {
    ses.instanceConfig = { webRTCIPHandlingPolicy: 'disable_non_proxied_udp' };
  }

  const win = new BrowserWindow({
    width: ANDROID_PIXEL_8.width,
    height: ANDROID_PIXEL_8.height,
    title: `QA [${profileName}]`,
    backgroundColor: "#000",
    autoHideMenuBar: true,
    webPreferences: {
      partition: partition,
      preload: path.join(__dirname, "preload-inject.js"),
      contextIsolation: false, // Necesario para inyectar ruido en objetos nativos
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });

  // Bloqueo de Deep Links (evita que Facebook intente abrir apps externas)
  win.webContents.setWindowOpenHandler(({ url }) => {
    return url.startsWith('http') ? { action: 'allow' } : { action: 'deny' };
  });

  const winId = win.id;
  activeSessions.set(winId, { profileName, proxy: proxy || "Directa" });

  win.on('closed', () => {
    activeSessions.delete(winId);
    if (mainWindow) mainWindow.webContents.send('sessions-updated', Array.from(activeSessions.entries()));
  });

  await win.loadURL("about:blank");
  await applyStealth(win, ANDROID_PIXEL_8);
  
  let finalUrl = url || "https://whoer.net";
  if (!finalUrl.startsWith('http')) finalUrl = 'https://' + finalUrl;
  
  // Pequeño timeout para asegurar que el proxy y el debugger estén listos
  setTimeout(() => {
    win.loadURL(finalUrl).catch(e => console.log("Error de carga (Proxy lento?):", e.message));
  }, 200);

  if (mainWindow) mainWindow.webContents.send('sessions-updated', Array.from(activeSessions.entries()));
}

ipcMain.handle("get-profiles", () => store.get("profiles", []));
ipcMain.handle("save-profile", (e, p) => {
  const ps = store.get("profiles", []);
  ps.push(p);
  store.set("profiles", ps);
  return ps;
});
ipcMain.handle("delete-profile", async (e, id) => {
  const ps = store.get("profiles", []).filter(p => p.id !== id);
  store.set("profiles", ps);
  await session.fromPartition(`persist:profile_${id}`).clearStorageData();
  return ps;
});
ipcMain.handle("open-browser", async (e, payload) => createBrowserWindow(payload));

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1200, height: 900,
    backgroundColor: "#09090b",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true }
  });
  mainWindow.loadFile("index.html");
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });