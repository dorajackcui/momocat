"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const api = {
  openFile: () => electron.ipcRenderer.invoke("open-file-dialog"),
  saveFile: (defaultPath, content, originalPath, targetColIndex) => electron.ipcRenderer.invoke("save-file", defaultPath, content, originalPath, targetColIndex),
  updateTM: (source, target) => electron.ipcRenderer.invoke("tm-update", source, target),
  queryTMBatch: (sources) => electron.ipcRenderer.invoke("tm-query-batch", sources),
  importTM: () => electron.ipcRenderer.invoke("tm-import"),
  fuzzySearchTM: (query) => electron.ipcRenderer.invoke("tm-fuzzy-search", query),
  // Project Management APIs
  getFiles: () => electron.ipcRenderer.invoke("project-get-files"),
  addFiles: () => electron.ipcRenderer.invoke("project-add-files"),
  deleteFile: (id) => electron.ipcRenderer.invoke("project-delete-file", id),
  openProjectFile: (id) => electron.ipcRenderer.invoke("project-open-file", id),
  saveProgress: (id, segments, colMapping) => electron.ipcRenderer.invoke("project-save-progress", id, segments, colMapping),
  batchMatchTM: (id) => electron.ipcRenderer.invoke("project-batch-tm-match", id)
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}
