import Database from 'better-sqlite3';
import {
  DEFAULT_PROJECT_QA_SETTINGS,
  Project,
  ProjectAIModel,
  ProjectQASettings,
  ProjectType,
} from '@cat/core';
import { randomUUID } from 'crypto';
import type { ProjectFileRecord } from '../types';

export class ProjectRepo {
  constructor(private readonly db: Database.Database) {}

  private toProject(row: (Project & { qaSettingsJson?: string | null }) | undefined): Project | undefined {
    if (!row) return undefined;
    const { qaSettingsJson, ...rest } = row;
    let qaSettings: ProjectQASettings | null = null;
    try {
      const parsed = qaSettingsJson ? (JSON.parse(qaSettingsJson) as Partial<ProjectQASettings>) : null;
      qaSettings = parsed
        ? {
            enabledRuleIds: Array.isArray(parsed.enabledRuleIds)
              ? (parsed.enabledRuleIds as ProjectQASettings['enabledRuleIds'])
              : DEFAULT_PROJECT_QA_SETTINGS.enabledRuleIds,
            instantQaOnConfirm:
              typeof parsed.instantQaOnConfirm === 'boolean'
                ? parsed.instantQaOnConfirm
                : Boolean(parsed.instantQaOnConfirm),
          }
        : DEFAULT_PROJECT_QA_SETTINGS;
    } catch {
      qaSettings = DEFAULT_PROJECT_QA_SETTINGS;
    }

    return {
      ...rest,
      qaSettings,
    };
  }

  public createProject(
    name: string,
    srcLang: string,
    tgtLang: string,
    projectType: ProjectType = 'translation',
  ): number {
    console.log(`[DB] Creating project: ${name} (${srcLang} -> ${tgtLang}, ${projectType})`);
    const result = this.db
      .prepare(
        'INSERT INTO projects (uuid, name, srcLang, tgtLang, projectType, qaSettingsJson) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        randomUUID(),
        name,
        srcLang,
        tgtLang,
        projectType,
        JSON.stringify(DEFAULT_PROJECT_QA_SETTINGS),
      );
    return result.lastInsertRowid as number;
  }

  public listProjects(): Project[] {
    const rows = this.db
      .prepare('SELECT * FROM projects ORDER BY updatedAt DESC')
      .all() as Array<Project & { qaSettingsJson?: string | null }>;
    return rows.map((row) => this.toProject(row) as Project);
  }

  public getProject(id: number): Project | undefined {
    const row = this.db
      .prepare('SELECT * FROM projects WHERE id = ?')
      .get(id) as (Project & { qaSettingsJson?: string | null }) | undefined;
    return this.toProject(row);
  }

  public updateProjectPrompt(projectId: number, aiPrompt: string | null) {
    this.db
      .prepare(
        "UPDATE projects SET aiPrompt = ?, updatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = ?"
      )
      .run(aiPrompt, projectId);
  }

  public updateProjectAISettings(
    projectId: number,
    aiPrompt: string | null,
    aiTemperature: number | null,
    aiModel: ProjectAIModel | null,
  ) {
    this.db
      .prepare(
        "UPDATE projects SET aiPrompt = ?, aiTemperature = ?, aiModel = ?, updatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = ?"
      )
      .run(aiPrompt, aiTemperature, aiModel, projectId);
  }

  public updateProjectQASettings(projectId: number, qaSettings: ProjectQASettings) {
    this.db
      .prepare(
        "UPDATE projects SET qaSettingsJson = ?, updatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = ?",
      )
      .run(JSON.stringify(qaSettings), projectId);
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

  public listFiles(projectId: number): ProjectFileRecord[] {
    return this.db.prepare('SELECT * FROM files WHERE projectId = ? ORDER BY createdAt DESC').all(projectId) as ProjectFileRecord[];
  }

  public getFile(id: number): ProjectFileRecord | undefined {
    return this.db.prepare('SELECT * FROM files WHERE id = ?').get(id) as
      | ProjectFileRecord
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

  public getProjectTypeByFileId(fileId: number): ProjectType | undefined {
    const row = this.db
      .prepare(
        `
          SELECT p.projectType as projectType
          FROM files f
          JOIN projects p ON p.id = f.projectId
          WHERE f.id = ?
        `,
      )
      .get(fileId) as { projectType?: ProjectType } | undefined;

    return row?.projectType;
  }
}
