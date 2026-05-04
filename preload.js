const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mobileDebug", {
  getSystemInfo: () => ipcRenderer.invoke("get-system-info"),
  openBrowser: (payload) => ipcRenderer.invoke("open-browser", payload),
  browserAction: (payload) => ipcRenderer.invoke("browser-action", payload),
  onBrowserUrlChanged: (callback) => {
    ipcRenderer.on("browser-url-changed", (_event, data) => callback(data));
  }
});
