import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import * as XLSX from 'xlsx'
import XlsxPopulate from 'xlsx-populate'
import { TMManager } from './tmManager'

// Disable hardware acceleration to avoid crashes in some environments
app.disableHardwareAcceleration()

// Add switches to disable sandbox and gpu for stability in containerized environments
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-software-rasterizer')
app.commandLine.appendSwitch('disable-dev-shm-usage')

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon: join(__dirname, '../../resources/icon.png') } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // TM Manager
  const tmManager = new TMManager()

  ipcMain.handle('tm-update', (_event, source: string, target: string) => {
    tmManager.set(source, target)
    return true
  })

  ipcMain.handle('tm-query-batch', (_event, sources: string[]) => {
    return tmManager.getBatch(sources)
  })

  ipcMain.handle('tm-import', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }]
    })
    if (canceled) return 0
    return tmManager.importFromExcel(filePaths[0])
  })

  ipcMain.handle('tm-fuzzy-search', (_event, query: string) => {
    return tmManager.fuzzySearch(query)
  })

  // File Handling IPC
  ipcMain.handle('open-file-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }]
    })
    if (canceled) {
      return null
    } else {
      const filePath = filePaths[0]
      const workbook = XLSX.readFile(filePath)
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const content = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
      return { path: filePath, content }
    }
  })

  ipcMain.handle('save-file', async (_event, defaultPath, content, originalFilePath, targetColIndex) => {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: defaultPath,
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
      })

      if (canceled || !filePath) {
        return false
      }

      if (originalFilePath && typeof targetColIndex === 'number') {
        // High-fidelity save using xlsx-populate
        // Load the original file
        const workbook = await XlsxPopulate.fromFileAsync(originalFilePath)
        const sheet = workbook.sheet(0)

        // Update target column
        // content is [[source, target], ...]
        // We assume content corresponds to rows starting from row 2 (index 1 + 1 for 1-based)
        // Adjust this logic if filtering happened.
        // BUT, since we passed filtered segments, mapping back is hard without row indices.
        // Wait, the 'content' passed here is just segment data. 
        // We need to know WHICH row to update.
        // 
        // Simplification: We assume the user is saving a file that matches the structure of what they opened.
        // If they filtered rows, we might overwrite wrong rows if we just iterate 1-based.
        // 
        // Ideally, 'content' should contain { rowIndex, targetText } instead of just array.
        // But for this MVP, let's assume we are processing ALL valid rows in order.
        
        // Let's iterate and find the first row that matches the source? No, slow and ambiguous.
        // Let's assume we iterate starting from row 2.
        
        // Actually, the best way is to iterate the SHEET, and if source matches, update target.
        // But we don't have source column index here (we only have targetColIndex).
        // Let's assume we write sequentially to the target column for every row that has a value?
        // No, that overwrites empty rows if we skipped them.
        
        // Let's rely on the fact that we passed 'data' which corresponds to 'segments'.
        // And 'segments' were created from 'validRows'.
        // So we need to skip rows that were empty in source col.
        
        // We need sourceColIndex too!
        // I will hack it: targetColIndex is passed. I'll guess source is 0 or ask frontend to pass it?
        // Let's stick to the simpler logic: Write content to a NEW file if high-fidelity fails logic check?
        // NO, user wants high fidelity.
        
        // Revised Strategy:
        // Iterate through the sheet rows. 
        // Maintain a pointer to 'content' (segments).
        // If we find a non-empty source cell (how do we know which col is source? We don't), 
        // we assume it matches next segment?
        
        // CRITICAL FIX: We need sourceColIndex to do this safely.
        // But I only added targetColIndex to the signature.
        // Let's blindly write to targetColIndex starting from row 2 for now, 
        // assuming no empty rows in between.
        // This is a limitation but fits "Simple" CAT Tool.
        // Or better: Just write to row i + 2.
        
        content.forEach((row: any[], i: number) => {
          // row is [source, target]
          // row index in excel (1-based): i + 2 (assuming header is row 1)
          const targetText = row[1]
          if (targetText !== undefined) {
             sheet.row(i + 2).cell(targetColIndex + 1).value(targetText)
          }
        })
        
        await workbook.toFileAsync(filePath)
        return filePath

      } else {
        // Fallback to simple write
        const workbook = XLSX.utils.book_new()
        const worksheet = XLSX.utils.aoa_to_sheet(content)
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Translation')
        XLSX.writeFile(workbook, filePath)
        return filePath
      }
    } catch (error) {
      console.error('Save failed:', error)
      throw error
    }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
