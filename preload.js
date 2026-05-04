const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mobileDebug", {
  getSystemInfo: () => ipcRenderer.invoke("get-system-info")
});
