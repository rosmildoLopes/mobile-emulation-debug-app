const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const os = require("os");

if (require("electron-squirrel-startup")) {
  app.quit();
}

let mainWindow = null;

function createWindow() {
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

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
