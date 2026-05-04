const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const os = require("os");

if (require("electron-squirrel-startup")) {
  app.quit();
}

let mainWindow = null;
const mobileWindows = new Map();

const ANDROID_PIXEL_8 = {
  name: "Pixel 8 / Android 14",
  userAgent:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36",
  width: 430,
  height: 932,
  deviceScaleFactor: 2.625,
  mobile: true,
  platform: "Android"
};

const DESKTOP_CHROME = {
  name: "Desktop Chrome / Windows",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
  width: 1280,
  height: 850,
  deviceScaleFactor: 1,
  mobile: false,
  platform: "Windows"
};

function normalizeUrl(input) {
  const raw = String(input || "").trim();

  if (!raw) {
    return "https://www.google.com";
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  if (raw.includes(".") && !raw.includes(" ")) {
    return `https://${raw}`;
  }

  return `https://www.google.com/search?q=${encodeURIComponent(raw)}`;
}

function waitForEvent(emitter, eventName) {
  return new Promise((resolve) => {
    emitter.once(eventName, resolve);
  });
}

async function safeDebuggerAttach(webContents) {
  try {
    if (!webContents.debugger.isAttached()) {
      webContents.debugger.attach("1.3");
    }
    return true;
  } catch (error) {
    console.error("No se pudo adjuntar debugger:", error.message);
    return false;
  }
}

async function sendDebuggerCommand(webContents, command, params) {
  try {
    if (!webContents || webContents.isDestroyed()) return false;
    if (!webContents.debugger.isAttached()) return false;

    await webContents.debugger.sendCommand(command, params);
    return true;
  } catch (error) {
    console.error(`Error en ${command}:`, error.message);
    return false;
  }
}

async function applyEmulation(win, profile) {
  const wc = win.webContents;

  if (!wc || wc.isDestroyed()) return;

  const attached = await safeDebuggerAttach(wc);
  if (!attached) return;

  await sendDebuggerCommand(wc, "Network.enable", {});

  await sendDebuggerCommand(wc, "Network.setUserAgentOverride", {
    userAgent: profile.userAgent,
    platform: profile.platform,
    userAgentMetadata: profile.mobile
      ? {
          brands: [
            { brand: "Chromium", version: "143" },
            { brand: "Google Chrome", version: "143" },
            { brand: "Not A(Brand", version: "24" }
          ],
          fullVersionList: [
            { brand: "Chromium", version: "143.0.0.0" },
            { brand: "Google Chrome", version: "143.0.0.0" },
            { brand: "Not A(Brand", version: "24.0.0.0" }
          ],
          platform: "Android",
          platformVersion: "14.0.0",
          architecture: "",
          model: "Pixel 8",
          mobile: true
        }
      : {
          brands: [
            { brand: "Chromium", version: "143" },
            { brand: "Google Chrome", version: "143" },
            { brand: "Not A(Brand", version: "24" }
          ],
          fullVersionList: [
            { brand: "Chromium", version: "143.0.0.0" },
            { brand: "Google Chrome", version: "143.0.0.0" },
            { brand: "Not A(Brand", version: "24.0.0.0" }
          ],
          platform: "Windows",
          platformVersion: "10.0.0",
          architecture: "x86",
          model: "",
          mobile: false
        }
  });

  await sendDebuggerCommand(wc, "Emulation.setDeviceMetricsOverride", {
    width: profile.width,
    height: profile.height,
    deviceScaleFactor: profile.deviceScaleFactor,
    mobile: profile.mobile,
    screenWidth: profile.width,
    screenHeight: profile.height,
    positionX: 0,
    positionY: 0
  });

  await sendDebuggerCommand(wc, "Emulation.setTouchEmulationEnabled", {
    enabled: profile.mobile,
    maxTouchPoints: profile.mobile ? 5 : 0
  });

  await sendDebuggerCommand(wc, "Emulation.setTimezoneOverride", {
    timezoneId: "America/Argentina/Buenos_Aires"
  });

  await sendDebuggerCommand(wc, "Emulation.setLocaleOverride", {
    locale: "es-419"
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 850,
    minWidth: 420,
    minHeight: 680,
    backgroundColor: "#09090b",
    title: "Mobile Emulation Debug",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

async function createBrowserWindow({ mode, url }) {
  const profile = mode === "desktop" ? DESKTOP_CHROME : ANDROID_PIXEL_8;
  const finalUrl = normalizeUrl(url);

  const browserWindow = new BrowserWindow({
    width: profile.width,
    height: profile.height,
    minWidth: profile.mobile ? 390 : 900,
    minHeight: profile.mobile ? 720 : 600,
    backgroundColor: "#09090b",
    title: `Mobile Browser - ${profile.name}`,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });

  const id = browserWindow.id;
  mobileWindows.set(id, browserWindow);

  browserWindow.on("closed", () => {
    mobileWindows.delete(id);
  });

  browserWindow.webContents.setUserAgent(profile.userAgent);

  browserWindow.webContents.on("did-navigate", (_event, newUrl) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("browser-url-changed", {
        id,
        url: newUrl
      });
    }
  });

  browserWindow.webContents.on("did-navigate-in-page", (_event, newUrl) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("browser-url-changed", {
        id,
        url: newUrl
      });
    }
  });

  await browserWindow.loadURL("about:blank");
  await applyEmulation(browserWindow, profile);

  browserWindow.show();

  await browserWindow.loadURL(finalUrl);

  return {
    id,
    url: finalUrl,
    mode,
    profile: profile.name
  };
}

ipcMain.handle("get-system-info", async () => {
  return {
    app: "Mobile Emulation Debug",
    node: process.version,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    v8: process.versions.v8,
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
    cpus: os.cpus().length,
    memoryGb: Math.round(os.totalmem() / 1024 / 1024 / 1024),
    generatedAt: new Date().toISOString()
  };
});

ipcMain.handle("open-browser", async (_event, payload) => {
  return createBrowserWindow(payload || {});
});

ipcMain.handle("browser-action", async (_event, payload) => {
  const { id, action, url } = payload || {};
  const win = mobileWindows.get(id);

  if (!win || win.isDestroyed()) {
    return { ok: false, error: "Ventana no encontrada" };
  }

  if (action === "back" && win.webContents.canGoBack()) {
    win.webContents.goBack();
  }

  if (action === "forward" && win.webContents.canGoForward()) {
    win.webContents.goForward();
  }

  if (action === "reload") {
    win.webContents.reload();
  }

  if (action === "navigate") {
    await win.loadURL(normalizeUrl(url));
  }

  return {
    ok: true,
    id,
    url: win.webContents.getURL()
  };
});

app.whenReady().then(() => {
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
