const { app, BrowserWindow, ipcMain, session } = require("electron");
const path = require("path");
const Store = require("electron-store");

// 1. FORZAR DNS DE GOOGLE PARA SOLUCIONAR CREEPJS
app.commandLine.appendSwitch('resolver-getaddrinfo-allow-threads');
app.commandLine.appendSwitch('dns-over-https-urls', 'https://dns.google/dns-query');

if (require("electron-squirrel-startup")) app.quit();

const store = new Store();
let mainWindow = null;
const activeSessions = new Map();

const UA_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36";
app.userAgentFallback = UA_ANDROID;

async function applyStealth(win) {
  const wc = win.webContents;
  try {
    if (!wc.debugger.isAttached()) wc.debugger.attach("1.3");
    
    // Parámetros corregidos para evitar el "Invalid Parameters"
    await wc.debugger.sendCommand("Network.setUserAgentOverride", {
      userAgent: UA_ANDROID,
      acceptLanguage: "en-US,en;q=0.9",
      platform: "Android",
      userAgentMetadata: {
        brands: [
          { brand: "Google Chrome", version: "147" },
          { brand: "Not-A.Brand", version: "24" },
          { brand: "Chromium", version: "147" }
        ],
        fullVersionList: [
          { brand: "Google Chrome", version: "147.0.6912.0" },
          { brand: "Not-A.Brand", version: "24.0.0.0" },
          { brand: "Chromium", version: "147.0.6912.0" }
        ],
        platform: "Android",
        platformVersion: "14.0.0",
        architecture: "arm",
        model: "Pixel 8",
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
      screenOrientation: { type: "portraitPrimary", angle: 0 }
    });

    await wc.debugger.sendCommand("Network.enable");
  } catch (e) { console.error("Stealth Debugger Error:", e.message); }
}

async function createBrowserWindow({ url, profileId, profileName, proxy }) {
  const partition = `persist:profile_${profileId}`;
  const ses = session.fromPartition(partition);

  await ses.clearHostResolverCache();

  if (proxy && proxy.trim() !== "") {
    let proxyRules = proxy.trim();
    if (!proxyRules.includes("://")) proxyRules = "http://" + proxyRules;
    await ses.setProxy({ proxyRules });
    ses.setWebRTCIPHandlingPolicy('disable_non_proxied_udp');
  } else {
    await ses.setProxy({ proxyRules: "" });
  }

  const win = new BrowserWindow({
    width: 412, height: 915,
    backgroundColor: "#000",
    webPreferences: {
      partition: partition,
      preload: path.join(__dirname, "preload-inject.js"),
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.webContents.on('commit-navigation', () => {
    win.webContents.executeJavaScript(`
      Object.defineProperty(navigator, 'platform', { get: () => 'Linux armv8l' });
      Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });
    `);
  });

  activeSessions.set(win.id, { profileName, proxy: String(proxy || "Directa") });

  win.on('closed', () => { activeSessions.delete(win.id); });

  await win.loadURL("about:blank");
  await applyStealth(win);
  
  const finalUrl = url || "https://creepjs.com";
  win.loadURL(finalUrl).catch(e => console.log("Fallo carga:", e.message));

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