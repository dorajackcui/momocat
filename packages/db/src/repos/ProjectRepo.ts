import Database from 'better-sqlite3';
import {
  DEFAULT_PROJECT_QA_SETTINGS,
  Project,
  ProjectAIModel,
  ProjectQASettings,
  ProjectType,
} from '@cat/core';
import { randomUUID } from 'crypto';
import type { FileSegmentStatusStats, ProjectFileRecord } from '../types';

interface FileWithSegmentStatsRow extends Omit<ProjectFileRecord, 'segmentStatusStats'> {
  qaProblemSegments?: number | null;
  confirmedSegmentsForBar?: number | null;
  inProgressSegments?: number | null;
}

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
    const rows = this.db
      .prepare(
        `
        SELECT
          f.*,
          COALESCE(s.qaProblemSegments, 0) as qaProblemSegments,
          COALESCE(s.confirmedSegmentsForBar, 0) as confirmedSegmentsForBar,
          COALESCE(s.inProgressSegments, 0) as inProgressSegments
        FROM files f
        LEFT JOIN (
          SELECT
            fileId,
            SUM(CASE WHEN qaIssuesJson IS NOT NULL AND qaIssuesJson <> '' AND qaIssuesJson <> '[]' THEN 1 ELSE 0 END) as qaProblemSegments,
            SUM(CASE
              WHEN status = 'confirmed' AND (qaIssuesJson IS NULL OR qaIssuesJson = '' OR qaIssuesJson = '[]')
              THEN 1
              ELSE 0
            END) as confirmedSegmentsForBar,
            SUM(CASE
              WHEN status IN ('draft', 'translated', 'reviewed') AND (qaIssuesJson IS NULL OR qaIssuesJson = '' OR qaIssuesJson = '[]')
              THEN 1
              ELSE 0
            END) as inProgressSegments
          FROM segments
          GROUP BY fileId
        ) s ON s.fileId = f.id
        WHERE f.projectId = ?
        ORDER BY f.createdAt DESC
        `,
      )
      .all(projectId) as FileWithSegmentStatsRow[];

    return rows.map((row) => {
      const qaProblemSegments = Math.max(0, Number(row.qaProblemSegments ?? 0));
      const confirmedSegmentsForBar = Math.max(0, Number(row.confirmedSegmentsForBar ?? 0));
      const inProgressSegments = Math.max(0, Number(row.inProgressSegments ?? 0));
      const newSegments = Math.max(
        0,
        row.totalSegments - qaProblemSegments - confirmedSegmentsForBar - inProgressSegments,
      );
      const segmentStatusStats: FileSegmentStatusStats = {
        totalSegments: row.totalSegments,
        qaProblemSegments,
        confirmedSegmentsForBar,
        inProgressSegments,
        newSegments,
      };

      return {
        id: row.id,
        uuid: row.uuid,
        projectId: row.projectId,
        name: row.name,
        totalSegments: row.totalSegments,
        confirmedSegments: row.confirmedSegments,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        importOptionsJson: row.importOptionsJson ?? null,
        segmentStatusStats,
      };
    });
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
