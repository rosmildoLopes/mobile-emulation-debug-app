const { app, BrowserWindow, ipcMain, session } = require("electron");
const path = require("path");
const os = require("os");
const Store = require("electron-store");

if (require("electron-squirrel-startup")) app.quit();

const store = new Store();
let mainWindow = null;
const activeSessions = new Map();

// Configuración de emulación Pixel 8
const ANDROID_PIXEL_8 = {
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36",
  width: 412,
  height: 915,
  deviceScaleFactor: 3,
  mobile: true,
  platform: "Android"
};

async function applyEmulation(win, profile) {
  const wc = win.webContents;
  try {
    if (!wc.debugger.isAttached()) wc.debugger.attach("1.3");

    // 1. Client Hints & User Agent (Stealth)
    await wc.debugger.sendCommand("Network.setUserAgentOverride", {
      userAgent: profile.userAgent,
      platform: profile.platform,
      userAgentMetadata: {
        brands: [
          { brand: "Google Chrome", version: "143" },
          { brand: "Not-A.Brand", version: "24" }
        ],
        fullVersionList: [{ brand: "Google Chrome", version: "143.0.6478.127" }],
        platform: profile.platform,
        platformVersion: "14.0.0",
        architecture: "arm",
        model: "Pixel 8",
        mobile: true
      }
    });

    // 2. Device Metrics
    await wc.debugger.sendCommand("Emulation.setDeviceMetricsOverride", {
      width: profile.width,
      height: profile.height,
      deviceScaleFactor: profile.deviceScaleFactor,
      mobile: true,
      screenOrientation: { type: 'portraitPrimary', angle: 0 }
    });

    // 3. Touch Emulation
    await wc.debugger.sendCommand("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 5
    });

  } catch (e) {
    console.error("Error aplicando emulación:", e);
  }
}

async function createBrowserWindow({ mode, url, profileId, profileName }) {
  const partition = `persist:profile_${profileId}`;
  
  const win = new BrowserWindow({
    width: ANDROID_PIXEL_8.width,
    height: ANDROID_PIXEL_8.height,
    title: `QA: ${profileName}`,
    backgroundColor: "#000",
    autoHideMenuBar: true,
    webPreferences: {
      partition: partition,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const winId = win.id;
  activeSessions.set(winId, { profileId, profileName, userAgent: ANDROID_PIXEL_8.userAgent });

  win.on('closed', () => {
    activeSessions.delete(winId);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sessions-updated', Array.from(activeSessions.entries()));
    }
  });

  await win.loadURL("about:blank");
  await applyEmulation(win, ANDROID_PIXEL_8);
  await win.loadURL(url || "https://whoer.net");

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sessions-updated', Array.from(activeSessions.entries()));
  }
}

// --- IPC HANDLERS ---
ipcMain.handle("get-profiles", () => store.get("profiles", []));

ipcMain.handle("save-profile", (event, profile) => {
  const profiles = store.get("profiles", []);
  profiles.push(profile);
  store.set("profiles", profiles);
  return profiles;
});

ipcMain.handle("delete-profile", async (event, id) => {
  const profiles = store.get("profiles", []).filter(p => p.id !== id);
  store.set("profiles", profiles);
  // Limpiar cookies y caché físicamente
  await session.fromPartition(`persist:profile_${id}`).clearStorageData();
  return profiles;
});

ipcMain.handle("open-browser", async (event, payload) => {
  return createBrowserWindow(payload);
});

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    backgroundColor: "#09090b",
    title: "Mobile Emulation Debug - Control Center",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile("index.html");
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});