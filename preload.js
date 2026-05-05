const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mobileDebug", {
  getProfiles: () => ipcRenderer.invoke("get-profiles"),
  saveProfile: (p) => ipcRenderer.invoke("save-profile", p),
  deleteProfile: (id) => ipcRenderer.invoke("delete-profile", id),
  openBrowser: (payload) => ipcRenderer.invoke("open-browser", payload),
  onSessionsUpdated: (callback) => {
    ipcRenderer.on('sessions-updated', (event, sessions) => callback(sessions));
  }
});