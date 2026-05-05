const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mobileDebug", {
  getProfiles: () => ipcRenderer.invoke("get-profiles"),
  saveProfile: (p) => ipcRenderer.invoke("save-profile", p),
  deleteProfile: (id) => ipcRenderer.invoke("delete-profile", id),
  openBrowser: (p) => ipcRenderer.invoke("open-browser", p),
  onSessionsUpdated: (cb) => ipcRenderer.on('sessions-updated', (e, s) => cb(s))
});