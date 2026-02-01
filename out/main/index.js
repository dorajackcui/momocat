"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const XLSX = require("xlsx");
const XlsxPopulate = require("xlsx-populate");
const fs = require("fs");
const Database = require("better-sqlite3");
const fastestLevenshtein = require("fastest-levenshtein");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const XLSX__namespace = /* @__PURE__ */ _interopNamespaceDefault(XLSX);
class TMManager {
  db;
  constructor() {
    const dbDir = path.join(__dirname, "../../resources");
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, "tm.db");
    console.log("TM Database Path:", dbPath);
    this.db = new Database(dbPath);
    this.init();
  }
  init() {
    this.db.pragma("journal_mode = WAL");
    this.db.prepare(
      `
      CREATE TABLE IF NOT EXISTS translations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT UNIQUE,
        target TEXT
      )
    `
    ).run();
    this.db.prepare(
      `
      CREATE VIRTUAL TABLE IF NOT EXISTS tm_search 
      USING fts5(source, content='translations', content_rowid='id', tokenize='trigram');
    `
    ).run();
    this.db.prepare(
      `
      CREATE TRIGGER IF NOT EXISTS translations_ai AFTER INSERT ON translations BEGIN
        INSERT INTO tm_search(rowid, source) VALUES (new.id, new.source);
      END;
    `
    ).run();
    this.db.prepare(
      `
      CREATE TRIGGER IF NOT EXISTS translations_ad AFTER DELETE ON translations BEGIN
        INSERT INTO tm_search(tm_search, rowid, source) VALUES('delete', old.id, old.source);
      END;
    `
    ).run();
    this.db.prepare(
      `
      CREATE TRIGGER IF NOT EXISTS translations_au AFTER UPDATE ON translations BEGIN
        INSERT INTO tm_search(tm_search, rowid, source) VALUES('delete', old.id, old.source);
        INSERT INTO tm_search(rowid, source) VALUES (new.id, new.source);
      END;
    `
    ).run();
  }
  get(source) {
    const stmt = this.db.prepare("SELECT target FROM translations WHERE source = ?");
    const result = stmt.get(source);
    return result?.target;
  }
  set(source, target) {
    if (!source || !target) return;
    const stmt = this.db.prepare(
      "INSERT OR REPLACE INTO translations (source, target) VALUES (?, ?)"
    );
    stmt.run(source, target);
  }
  getBatch(sources) {
    if (sources.length === 0) return {};
    const result = {};
    const CHUNK_SIZE = 900;
    for (let i = 0; i < sources.length; i += CHUNK_SIZE) {
      const chunk = sources.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk.map(() => "?").join(",");
      const stmt = this.db.prepare(
        `SELECT source, target FROM translations WHERE source IN (${placeholders})`
      );
      const rows = stmt.all(...chunk);
      for (const row of rows) {
        result[row.source] = row.target;
      }
    }
    return result;
  }
  importFromExcel(filePath) {
    try {
      const workbook = XLSX__namespace.readFile(filePath);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX__namespace.utils.sheet_to_json(worksheet, { header: 1 });
      let count = 0;
      const insert = this.db.prepare(
        "INSERT OR REPLACE INTO translations (source, target) VALUES (?, ?)"
      );
      const insertMany = this.db.transaction((rows2) => {
        for (const row of rows2) {
          const source = row[0] ? String(row[0]).trim() : "";
          const target = row[1] ? String(row[1]).trim() : "";
          if (source && target) {
            insert.run(source, target);
            count++;
          }
        }
      });
      insertMany(rows);
      return count;
    } catch (error) {
      console.error("Import failed:", error);
      throw error;
    }
  }
  fuzzySearch(query, threshold = 70, limit = 5) {
    if (!query) return [];
    const ftsLimit = 50;
    const ftsStmt = this.db.prepare(`
      SELECT t.source, t.target 
      FROM tm_search s
      JOIN translations t ON s.rowid = t.id
      WHERE tm_search MATCH ? 
      ORDER BY rank
      LIMIT ?
    `);
    let candidates = [];
    try {
      const escapedQuery = query.replace(/"/g, '""');
      candidates = ftsStmt.all(`"${escapedQuery}"`, ftsLimit);
    } catch (e) {
      console.error("FTS query error:", e);
      return [];
    }
    const matches = [];
    for (const candidate of candidates) {
      const source = candidate.source;
      const lenDiff = Math.abs(source.length - query.length);
      if (lenDiff / query.length > (100 - threshold) / 100) {
        continue;
      }
      const dist = fastestLevenshtein.distance(query, source);
      const maxLen = Math.max(query.length, source.length);
      if (maxLen === 0) continue;
      const similarity = (1 - dist / maxLen) * 100;
      if (similarity >= threshold) {
        matches.push({
          source,
          target: candidate.target,
          score: Math.round(similarity)
        });
      }
    }
    return matches.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
class ProjectManager {
  db;
  projectsDir;
  tmManager;
  constructor(tmManager) {
    this.tmManager = tmManager;
    this.projectsDir = path.join(__dirname, "../../resources/projects");
    if (!fs.existsSync(this.projectsDir)) {
      fs.mkdirSync(this.projectsDir, { recursive: true });
    }
    const dbPath = path.join(__dirname, "../../resources/tm.db");
    this.db = new Database(dbPath);
    this.init();
  }
  init() {
    this.db.prepare(
      `
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        originalPath TEXT,
        storedPath TEXT,
        progress INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
    ).run();
  }
  getFiles() {
    return this.db.prepare("SELECT * FROM files ORDER BY createdAt DESC").all();
  }
  async addFiles() {
    const { canceled, filePaths } = await electron.dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Excel Files", extensions: ["xlsx", "xls"] }]
    });
    if (canceled) return [];
    const addedFiles = [];
    const insert = this.db.prepare(
      "INSERT INTO files (name, originalPath, storedPath) VALUES (?, ?, ?)"
    );
    for (const filePath of filePaths) {
      const fileName = path.basename(filePath);
      const uniqueName = `${Date.now()}_${fileName}`;
      const storedPath = path.join(this.projectsDir, uniqueName);
      fs.copyFileSync(filePath, storedPath);
      const workbook = XLSX__namespace.readFile(storedPath);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawData = XLSX__namespace.utils.sheet_to_json(worksheet, { header: 1 });
      const progressData = {
        colMapping: { source: 0, target: 1 },
        segments: [],
        // Will be populated on first open or pre-translate
        rawGridData: rawData
        // Cache raw data? Or read from excel every time?
        // Better to cache rawData in JSON so we don't depend on Excel parsing logic every time
        // and we can store "isTmMatch" flags.
      };
      fs.writeFileSync(`${storedPath}.json`, JSON.stringify(progressData, null, 2));
      const result = insert.run(fileName, filePath, storedPath);
      addedFiles.push({
        id: result.lastInsertRowid,
        name: fileName,
        originalPath: filePath,
        storedPath,
        progress: 0,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    return addedFiles;
  }
  deleteFile(id) {
    const file = this.db.prepare("SELECT storedPath FROM files WHERE id = ?").get(id);
    if (!file) return false;
    try {
      if (fs.existsSync(file.storedPath)) {
        fs.unlinkSync(file.storedPath);
      }
      const sidecarPath = `${file.storedPath}.json`;
      if (fs.existsSync(sidecarPath)) {
        fs.unlinkSync(sidecarPath);
      }
    } catch (e) {
      console.error("Error deleting file:", e);
    }
    this.db.prepare("DELETE FROM files WHERE id = ?").run(id);
    return true;
  }
  getFileContent(id) {
    const file = this.db.prepare("SELECT storedPath FROM files WHERE id = ?").get(id);
    if (!file) throw new Error("File not found");
    const sidecarPath = `${file.storedPath}.json`;
    if (fs.existsSync(sidecarPath)) {
      const data = JSON.parse(fs.readFileSync(sidecarPath, "utf-8"));
      return { ...data, filePath: file.storedPath };
    }
    throw new Error("Project data corrupted");
  }
  saveProgress(id, segments, colMapping) {
    const file = this.db.prepare("SELECT storedPath FROM files WHERE id = ?").get(id);
    if (!file) return;
    const sidecarPath = `${file.storedPath}.json`;
    let data = {};
    if (fs.existsSync(sidecarPath)) {
      data = JSON.parse(fs.readFileSync(sidecarPath, "utf-8"));
    }
    data.segments = segments;
    data.colMapping = colMapping;
    fs.writeFileSync(sidecarPath, JSON.stringify(data, null, 2));
    const total = segments.length;
    const translated = segments.filter((s) => s.target && s.target.trim() !== "").length;
    const progress = total > 0 ? Math.round(translated / total * 100) : 0;
    this.db.prepare("UPDATE files SET progress = ? WHERE id = ?").run(progress, id);
  }
  async batchMatchTM(id) {
    const content = this.getFileContent(id);
    const { segments, rawGridData, colMapping } = content;
    let segmentsToProcess = segments;
    if (!segments || segments.length === 0) {
      const sourceIdx = colMapping?.source || 0;
      const targetIdx = colMapping?.target || 1;
      const dataRows = rawGridData.slice(1);
      segmentsToProcess = dataRows.map((row, index) => ({
        id: index,
        source: row[sourceIdx] ? String(row[sourceIdx]) : "",
        target: row[targetIdx] ? String(row[targetIdx]) : "",
        isTmMatch: false
      }));
    }
    const sources = segmentsToProcess.map((s) => s.source).filter((s) => s);
    const matches = this.tmManager.getBatch(sources);
    let matchCount = 0;
    const updatedSegments = segmentsToProcess.map((seg) => {
      if (!seg.target && seg.source && matches[seg.source]) {
        matchCount++;
        return { ...seg, target: matches[seg.source], isTmMatch: true };
      }
      return seg;
    });
    this.saveProgress(id, updatedSegments, colMapping);
    return matchCount;
  }
}
electron.app.disableHardwareAcceleration();
electron.app.commandLine.appendSwitch("no-sandbox");
electron.app.commandLine.appendSwitch("disable-gpu");
electron.app.commandLine.appendSwitch("disable-software-rasterizer");
electron.app.commandLine.appendSwitch("disable-dev-shm-usage");
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...process.platform === "linux" ? { icon: path.join(__dirname, "../../resources/icon.png") } : {},
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.electron");
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  electron.ipcMain.on("ping", () => console.log("pong"));
  const tmManager = new TMManager();
  const projectManager = new ProjectManager(tmManager);
  electron.ipcMain.handle("tm-update", (_event, source, target) => {
    tmManager.set(source, target);
    return true;
  });
  electron.ipcMain.handle("tm-query-batch", (_event, sources) => {
    return tmManager.getBatch(sources);
  });
  electron.ipcMain.handle("tm-import", async () => {
    const { canceled, filePaths } = await electron.dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Excel Files", extensions: ["xlsx", "xls"] }]
    });
    if (canceled) return 0;
    return tmManager.importFromExcel(filePaths[0]);
  });
  electron.ipcMain.handle("tm-fuzzy-search", (_event, query) => {
    return tmManager.fuzzySearch(query);
  });
  electron.ipcMain.handle("project-get-files", () => {
    return projectManager.getFiles();
  });
  electron.ipcMain.handle("project-add-files", async () => {
    return projectManager.addFiles();
  });
  electron.ipcMain.handle("project-delete-file", (_event, id) => {
    return projectManager.deleteFile(id);
  });
  electron.ipcMain.handle("project-open-file", (_event, id) => {
    return projectManager.getFileContent(id);
  });
  electron.ipcMain.handle("project-save-progress", (_event, id, segments, colMapping) => {
    projectManager.saveProgress(id, segments, colMapping);
    return true;
  });
  electron.ipcMain.handle("project-batch-tm-match", async (_event, id) => {
    return projectManager.batchMatchTM(id);
  });
  electron.ipcMain.handle("open-file-dialog", async () => {
    const { canceled, filePaths } = await electron.dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Excel Files", extensions: ["xlsx", "xls"] }]
    });
    if (canceled) {
      return null;
    } else {
      const filePath = filePaths[0];
      const workbook = XLSX__namespace.readFile(filePath);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const content = XLSX__namespace.utils.sheet_to_json(worksheet, { header: 1 });
      return { path: filePath, content };
    }
  });
  electron.ipcMain.handle(
    "save-file",
    async (_event, defaultPath, content, originalFilePath, targetColIndex) => {
      try {
        const { canceled, filePath } = await electron.dialog.showSaveDialog({
          defaultPath,
          filters: [{ name: "Excel Files", extensions: ["xlsx"] }]
        });
        if (canceled || !filePath) {
          return false;
        }
        if (originalFilePath && typeof targetColIndex === "number") {
          const workbook = await XlsxPopulate.fromFileAsync(originalFilePath);
          const sheet = workbook.sheet(0);
          content.forEach((row, i) => {
            const targetText = row[1];
            if (targetText !== void 0) {
              sheet.row(i + 2).cell(targetColIndex + 1).value(targetText);
            }
          });
          await workbook.toFileAsync(filePath);
          return filePath;
        } else {
          const workbook = XLSX__namespace.utils.book_new();
          const worksheet = XLSX__namespace.utils.aoa_to_sheet(content);
          XLSX__namespace.utils.book_append_sheet(workbook, worksheet, "Translation");
          XLSX__namespace.writeFile(workbook, filePath);
          return filePath;
        }
      } catch (error) {
        console.error("Save failed:", error);
        throw error;
      }
    }
  );
  createWindow();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
