import Database from 'better-sqlite3';
import { Project, ProjectFile } from '@cat/core';
import { randomUUID } from 'crypto';

export class ProjectRepo {
  constructor(private readonly db: Database.Database) {}

  public createProject(name: string, srcLang: string, tgtLang: string): number {
    console.log(`[DB] Creating project: ${name} (${srcLang} -> ${tgtLang})`);
    const result = this.db
      .prepare('INSERT INTO projects (uuid, name, srcLang, tgtLang) VALUES (?, ?, ?, ?)')
      .run(randomUUID(), name, srcLang, tgtLang);
    return result.lastInsertRowid as number;
  }

  public listProjects(): Project[] {
    return this.db.prepare('SELECT * FROM projects ORDER BY updatedAt DESC').all() as Project[];
  }

  public getProject(id: number): Project | undefined {
    return this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
  }

  public updateProjectPrompt(projectId: number, aiPrompt: string | null) {
    this.db
      .prepare(
        "UPDATE projects SET aiPrompt = ?, updatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = ?"
      )
      .run(aiPrompt, projectId);
  }

  public updateProjectAISettings(projectId: number, aiPrompt: string | null, aiTemperature: number | null) {
    this.db
      .prepare(
        "UPDATE projects SET aiPrompt = ?, aiTemperature = ?, updatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = ?"
      )
      .run(aiPrompt, aiTemperature, projectId);
  }

  public deleteProject(id: number) {
    this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  }

  public countFilesByProject(projectId: number): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM files WHERE projectId = ?').get(projectId) as {
      count: number;
    };
    return row.count;
  }

  public createFile(projectId: number, name: string, importOptionsJson?: string): number {
    const result = this.db
      .prepare('INSERT INTO files (uuid, projectId, name, importOptionsJson) VALUES (?, ?, ?, ?)')
      .run(randomUUID(), projectId, name, importOptionsJson || null);
    return result.lastInsertRowid as number;
  }

  public listFiles(projectId: number): ProjectFile[] {
    return this.db.prepare('SELECT * FROM files WHERE projectId = ? ORDER BY createdAt DESC').all(projectId) as ProjectFile[];
  }

  public getFile(id: number): (ProjectFile & { importOptionsJson?: string }) | undefined {
    return this.db.prepare('SELECT * FROM files WHERE id = ?').get(id) as
      | (ProjectFile & { importOptionsJson?: string })
      | undefined;
  }

  public deleteFile(id: number) {
    this.db.prepare('DELETE FROM files WHERE id = ?').run(id);
  }

  public updateFileStats(fileId: number) {
    const stats = this.db
      .prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed
      FROM segments
      WHERE fileId = ?
    `)
      .get(fileId) as { total: number; confirmed: number };

    this.db
      .prepare(
        "UPDATE files SET totalSegments = ?, confirmedSegments = ?, updatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = ?"
      )
      .run(stats.total, stats.confirmed, fileId);
  }

  public getProjectIdByFileId(fileId: number): number | undefined {
    const row = this.db.prepare('SELECT projectId FROM files WHERE id = ?').get(fileId) as
      | { projectId: number }
      | undefined;
    return row?.projectId;
  }
}
