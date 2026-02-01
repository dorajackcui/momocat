import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { CATDatabase } from '@cat/db';
import { ProjectService } from './services/ProjectService';
import { ImportOptions } from './filters/SpreadsheetFilter';
import { JobManager } from './JobManager';

// Disable hardware acceleration to avoid crashes in some environments
app.disableHardwareAcceleration();

// Add switches to disable sandbox and gpu for stability
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');

// Set UserData path early to avoid permission issues with Chromium cache
const userDataPath = is.dev 
  ? join(app.getAppPath(), '../../.cat_data') 
  : app.getPath('userData');

if (is.dev) {
  app.setPath('userData', userDataPath);
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.cat.tool');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // DB & Services
  const dbPath = join(userDataPath, 'cat_v1.db');
  const projectsDir = join(userDataPath, 'projects');
  
  try {
    if (!require('fs').existsSync(userDataPath)) {
      require('fs').mkdirSync(userDataPath, { recursive: true });
    }
    if (!require('fs').existsSync(projectsDir)) {
      require('fs').mkdirSync(projectsDir, { recursive: true });
    }
  } catch (e) {
    console.error('Failed to prepare directories:', e);
  }
  
  console.log('UserData Path:', userDataPath);
  console.log('DB Path:', dbPath);
  
  let db: CATDatabase;
  try {
    db = new CATDatabase(dbPath);
  } catch (err) {
    console.error('Failed to initialize database:', err);
    // Fallback to in-memory for dev if needed, or just exit
    throw err;
  }
  const projectService = new ProjectService(db, projectsDir);
  const jobManager = new JobManager();

  // IPC: Project Management
  ipcMain.handle('project-list', () => {
    return projectService.listProjects();
  });

  ipcMain.handle('project-create', async (_event, name: string, srcLang: string, tgtLang: string) => {
    return projectService.createProject(name, srcLang, tgtLang);
  });

  ipcMain.handle('project-get', async (_event, projectId: number) => {
    return projectService.getProject(projectId);
  });

  ipcMain.handle('project-delete', async (_event, projectId: number) => {
    return projectService.deleteProject(projectId);
  });

  ipcMain.handle('project-get-files', async (_event, projectId: number) => {
    return projectService.listFiles(projectId);
  });

  ipcMain.handle('file-get', async (_event, fileId: number) => {
    return projectService.getFile(fileId);
  });

  ipcMain.handle('file-delete', async (_event, fileId: number) => {
    return projectService.deleteFile(fileId);
  });

  ipcMain.handle('project-add-file', async (_event, projectId: number, filePath: string, options: ImportOptions) => {
    return projectService.addFileToProject(projectId, filePath, options);
  });

  ipcMain.handle('file-get-segments', (_event, fileId: number, offset: number, limit: number) => {
    return projectService.getSegments(fileId, offset, limit);
  });

  ipcMain.handle('file-get-preview', (_event, filePath: string) => {
    return projectService.getSpreadsheetPreview(filePath);
  });

  ipcMain.handle('segment-update', (_event, segmentId: string, targetTokens: any[], status: any) => {
    return projectService.updateSegment(segmentId, targetTokens, status);
  });

  ipcMain.handle('file-export', async (_event, fileId: number, outputPath: string, options: ImportOptions) => {
    return projectService.exportFile(fileId, outputPath, options);
  });

  ipcMain.handle('tm-get-100-match', async (_event, projectId: number, srcHash: string) => {
    return projectService.get100Match(projectId, srcHash);
  });

  ipcMain.handle('tm-get-matches', async (_event, projectId: number, segment: any) => {
    return projectService.findMatches(projectId, segment);
  });

  ipcMain.handle('tm-concordance', async (_event, projectId: number, query: string) => {
    return projectService.searchConcordance(projectId, query);
  });

  // TM Management IPCs
  ipcMain.handle('tm-list', async (_event, type?: 'working' | 'main') => {
    return projectService.listTMs(type);
  });

  ipcMain.handle('tm-create', async (_event, name: string, srcLang: string, tgtLang: string, type?: 'working' | 'main') => {
    return projectService.createTM(name, srcLang, tgtLang, type);
  });

  ipcMain.handle('tm-delete', async (_event, tmId: string) => {
    return projectService.deleteTM(tmId);
  });

  ipcMain.handle('tm-project-mounted', async (_event, projectId: number) => {
    return projectService.getProjectMountedTMs(projectId);
  });

  ipcMain.handle('tm-mount', async (_event, projectId: number, tmId: string, priority?: number, permission?: string) => {
    return projectService.mountTMToProject(projectId, tmId, priority, permission);
  });

  ipcMain.handle('tm-unmount', async (_event, projectId: number, tmId: string) => {
    return projectService.unmountTMFromProject(projectId, tmId);
  });

  ipcMain.handle('tm-commit-file', async (_event, tmId: string, fileId: number) => {
    return projectService.commitToMainTM(tmId, fileId);
  });

  ipcMain.handle('tm-import-preview', async (_event, filePath: string) => {
    return projectService.getTMImportPreview(filePath);
  });

  ipcMain.handle('tm-import-execute', async (_event, tmId: string, filePath: string, options: any) => {
    return projectService.importTMEntries(tmId, filePath, options);
  });

  // Listen for progress updates and broadcast to all windows
  projectService.onProgress((data) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('app-progress', data);
    });
  });

  // Listen for segment updates and broadcast to all windows
  projectService.onSegmentsUpdated((data) => {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('segments-updated', data);
    });
  });

  // IPC: Job Management
  jobManager.on('progress', (progress) => {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('job-progress', progress);
    });
  });

  // IPC: Dialogs
  ipcMain.handle('dialog-open-file', async (_event, filters: any[]) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters
    });
    return canceled ? null : filePaths[0];
  });

  ipcMain.handle('dialog-save-file', async (_event, defaultPath: string, filters: any[]) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath,
      filters
    });
    return canceled ? null : filePath;
  });

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
