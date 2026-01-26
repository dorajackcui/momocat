import fs from 'fs';
import { join, basename, extname } from 'path';
import { dialog } from 'electron';
import Database from 'better-sqlite3';
import * as XLSX from 'xlsx';
import { TMManager } from './tmManager';

export interface ProjectFile {
  id: number;
  name: string;
  originalPath: string;
  storedPath: string;
  progress: number; // 0-100
  createdAt: string;
}

export class ProjectManager {
  private db: Database.Database;
  private projectsDir: string;
  private tmManager: TMManager;

  constructor(tmManager: TMManager) {
    this.tmManager = tmManager;
    // Setup projects directory in resources
    this.projectsDir = join(__dirname, '../../resources/projects');
    if (!fs.existsSync(this.projectsDir)) {
      fs.mkdirSync(this.projectsDir, { recursive: true });
    }

    // Use the same DB as TM or a new one? Let's use tm.db for simplicity as it's already in resources
    const dbPath = join(__dirname, '../../resources/tm.db');
    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        originalPath TEXT,
        storedPath TEXT,
        progress INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
      )
      .run();
  }

  public getFiles(): ProjectFile[] {
    return this.db.prepare('SELECT * FROM files ORDER BY createdAt DESC').all() as ProjectFile[];
  }

  public async addFiles(): Promise<ProjectFile[]> {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
    });

    if (canceled) return [];

    const addedFiles: ProjectFile[] = [];
    const insert = this.db.prepare(
      'INSERT INTO files (name, originalPath, storedPath) VALUES (?, ?, ?)',
    );

    for (const filePath of filePaths) {
      const fileName = basename(filePath);
      // Create a unique stored filename to prevent collisions
      const uniqueName = `${Date.now()}_${fileName}`;
      const storedPath = join(this.projectsDir, uniqueName);

      // Copy file
      fs.copyFileSync(filePath, storedPath);

      // Initialize empty progress sidecar (.json)
      // We will parse the excel file to get initial structure
      const workbook = XLSX.readFile(storedPath);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      // Default to columns 0 and 1 if they exist
      // We store the raw data structure in the sidecar for consistency
      const progressData = {
        colMapping: { source: 0, target: 1 },
        segments: [], // Will be populated on first open or pre-translate
        rawGridData: rawData, // Cache raw data? Or read from excel every time?
        // Better to cache rawData in JSON so we don't depend on Excel parsing logic every time
        // and we can store "isTmMatch" flags.
      };
      
      fs.writeFileSync(`${storedPath}.json`, JSON.stringify(progressData, null, 2));

      const result = insert.run(fileName, filePath, storedPath);
      addedFiles.push({
        id: result.lastInsertRowid as number,
        name: fileName,
        originalPath: filePath,
        storedPath: storedPath,
        progress: 0,
        createdAt: new Date().toISOString(),
      });
    }

    return addedFiles;
  }

  public deleteFile(id: number): boolean {
    const file = this.db.prepare('SELECT storedPath FROM files WHERE id = ?').get(id) as { storedPath: string };
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
      console.error('Error deleting file:', e);
    }

    this.db.prepare('DELETE FROM files WHERE id = ?').run(id);
    return true;
  }

  public getFileContent(id: number): any {
    const file = this.db.prepare('SELECT storedPath FROM files WHERE id = ?').get(id) as { storedPath: string };
    if (!file) throw new Error('File not found');

    const sidecarPath = `${file.storedPath}.json`;
    if (fs.existsSync(sidecarPath)) {
      // Load from sidecar
      const data = JSON.parse(fs.readFileSync(sidecarPath, 'utf-8'));
      // If segments are empty (first load), we might want to initialize them here
      // But let's leave that to the frontend or a specific init step.
      return { ...data, filePath: file.storedPath };
    }
    
    // Fallback (shouldn't happen if addFiles works correctly)
    throw new Error('Project data corrupted');
  }

  public saveProgress(id: number, segments: any[], colMapping: any) {
    const file = this.db.prepare('SELECT storedPath FROM files WHERE id = ?').get(id) as { storedPath: string };
    if (!file) return;

    const sidecarPath = `${file.storedPath}.json`;
    
    // Read existing to preserve rawGridData
    let data: any = {};
    if (fs.existsSync(sidecarPath)) {
       data = JSON.parse(fs.readFileSync(sidecarPath, 'utf-8'));
    }
    
    data.segments = segments;
    data.colMapping = colMapping;
    
    fs.writeFileSync(sidecarPath, JSON.stringify(data, null, 2));
    
    // Update progress percentage
    const total = segments.length;
    const translated = segments.filter(s => s.target && s.target.trim() !== '').length;
    const progress = total > 0 ? Math.round((translated / total) * 100) : 0;
    
    this.db.prepare('UPDATE files SET progress = ? WHERE id = ?').run(progress, id);
  }

  public async batchMatchTM(id: number): Promise<number> {
    const content = this.getFileContent(id);
    const { segments, rawGridData, colMapping } = content;
    
    let segmentsToProcess = segments;
    
    // If segments are empty, initialize them from rawGridData
    if (!segments || segments.length === 0) {
        // Assuming default 0/1 mapping or stored mapping
        const sourceIdx = colMapping?.source || 0;
        const targetIdx = colMapping?.target || 1;
        
        // Skip header
        const dataRows = rawGridData.slice(1);
        segmentsToProcess = dataRows.map((row: any[], index: number) => ({
            id: index,
            source: row[sourceIdx] ? String(row[sourceIdx]) : '',
            target: row[targetIdx] ? String(row[targetIdx]) : '',
            isTmMatch: false
        }));
    }
    
    const sources = segmentsToProcess.map(s => s.source).filter(s => s);
    const matches = this.tmManager.getBatch(sources);
    
    let matchCount = 0;
    const updatedSegments = segmentsToProcess.map(seg => {
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
