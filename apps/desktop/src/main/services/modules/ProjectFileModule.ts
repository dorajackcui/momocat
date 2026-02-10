import { basename, join } from 'path';
import { copyFile, mkdir, rm, unlink } from 'fs/promises';
import { Segment, validateSegmentTags } from '@cat/core';
import { ImportOptions, ProjectRepository, SegmentRepository, SpreadsheetGateway, SpreadsheetPreviewData } from '../ports';

export class ProjectFileModule {
  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly segmentRepo: SegmentRepository,
    private readonly filter: SpreadsheetGateway,
    private readonly projectsDir: string
  ) {}

  private async ensureDirectory(path: string) {
    await mkdir(path, { recursive: true });
  }

  private isFileNotFoundError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT';
  }

  public async createProject(name: string, srcLang: string, tgtLang: string) {
    await this.ensureDirectory(this.projectsDir);
    const projectId = this.projectRepo.createProject(name, srcLang, tgtLang);

    const projectDir = join(this.projectsDir, projectId.toString());
    await this.ensureDirectory(projectDir);

    const project = this.projectRepo.getProject(projectId);
    if (!project) {
      throw new Error('Failed to retrieve created project');
    }

    return project;
  }

  public listProjects() {
    return this.projectRepo.listProjects();
  }

  public getProject(projectId: number) {
    return this.projectRepo.getProject(projectId);
  }

  public updateProjectPrompt(projectId: number, aiPrompt: string | null) {
    this.projectRepo.updateProjectPrompt(projectId, aiPrompt);
  }

  public updateProjectAISettings(projectId: number, aiPrompt: string | null, aiTemperature: number | null) {
    this.projectRepo.updateProjectAISettings(projectId, aiPrompt, aiTemperature);
  }

  public async deleteProject(projectId: number) {
    this.projectRepo.deleteProject(projectId);

    const projectDir = join(this.projectsDir, projectId.toString());
    await rm(projectDir, { recursive: true, force: true });
  }

  public async addFileToProject(projectId: number, filePath: string, options: ImportOptions) {
    const project = this.projectRepo.getProject(projectId);
    if (!project) throw new Error('Project not found');

    const fileName = basename(filePath);
    const projectDir = join(this.projectsDir, projectId.toString());
    await this.ensureDirectory(this.projectsDir);
    await this.ensureDirectory(projectDir);

    let fileId: number | undefined;
    let storedPath: string | undefined;

    try {
      fileId = this.projectRepo.createFile(projectId, fileName, JSON.stringify(options));
      storedPath = join(projectDir, `${fileId}_${fileName}`);
      await copyFile(filePath, storedPath);

      const segments = await this.filter.import(storedPath, projectId, fileId, options);
      if (segments.length === 0) {
        throw new Error('No valid segments found in the selected file.');
      }

      this.segmentRepo.bulkInsertSegments(segments);

      const file = this.projectRepo.getFile(fileId);
      if (!file) throw new Error('Failed to retrieve created file');

      return file;
    } catch (error) {
      const originalError = error instanceof Error ? error : new Error(String(error));
      const cleanupErrors: Error[] = [];

      if (fileId !== undefined) {
        try {
          this.projectRepo.deleteFile(fileId);
        } catch (cleanupError) {
          console.warn('[ProjectFileModule] Failed to cleanup file record after import failure:', cleanupError);
          cleanupErrors.push(cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError)));
        }
      }

      if (storedPath) {
        try {
          await unlink(storedPath);
        } catch (cleanupError) {
          if (!this.isFileNotFoundError(cleanupError)) {
            console.warn('[ProjectFileModule] Failed to cleanup copied file after import failure:', cleanupError);
            cleanupErrors.push(
              cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError))
            );
          }
        }
      }

      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          [originalError, ...cleanupErrors],
          `[ProjectFileModule] Import failed and cleanup encountered ${cleanupErrors.length} error(s)`
        );
      }

      throw originalError;
    }
  }

  public listFiles(projectId: number) {
    return this.projectRepo.listFiles(projectId);
  }

  public getFile(fileId: number) {
    return this.projectRepo.getFile(fileId);
  }

  public async deleteFile(fileId: number) {
    const file = this.projectRepo.getFile(fileId);
    if (!file) return;

    this.projectRepo.deleteFile(fileId);

    const filePath = join(this.projectsDir, file.projectId.toString(), `${file.id}_${file.name}`);
    try {
      await unlink(filePath);
    } catch (error) {
      if (!this.isFileNotFoundError(error)) {
        throw error;
      }
    }
  }

  public async getSpreadsheetPreview(filePath: string): Promise<SpreadsheetPreviewData> {
    return this.filter.getPreview(filePath);
  }

  public async exportFile(fileId: number, outputPath: string, options?: ImportOptions, forceExport: boolean = false) {
    const file = this.projectRepo.getFile(fileId);
    if (!file) throw new Error('File not found');

    const project = this.projectRepo.getProject(file.projectId);
    if (!project) throw new Error('Project not found');

    const finalOptions = options || (file.importOptionsJson ? JSON.parse(file.importOptionsJson) : null);
    if (!finalOptions) {
      throw new Error('Export options not found for this file. Please specify columns.');
    }

    const segments = this.segmentRepo.getSegmentsPage(fileId, 0, 1000000);
    const errors: { row: number; message: string }[] = [];

    for (const seg of segments) {
      const issues = validateSegmentTags(seg);
      const criticalErrors = issues.filter(i => i.severity === 'error');
      if (criticalErrors.length > 0) {
        errors.push({
          row: seg.meta.rowRef || 0,
          message: criticalErrors.map(e => e.message).join('; ')
        });
      }
    }

    if (errors.length > 0 && !forceExport) {
      const errorMsg = errors.slice(0, 5).map(e => `Row ${e.row}: ${e.message}`).join('\n');
      const error = new Error(`Export blocked by QA errors:\n${errorMsg}${errors.length > 5 ? `\n...and ${errors.length - 5} more.` : ''}`);
      Object.assign(error, { qaErrors: errors });
      throw error;
    }

    const storedPath = join(this.projectsDir, file.projectId.toString(), `${file.id}_${file.name}`);
    await this.filter.export(storedPath, segments as Segment[], finalOptions, outputPath);
  }
}
