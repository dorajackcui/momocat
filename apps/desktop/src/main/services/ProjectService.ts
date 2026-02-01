import { CATDatabase } from '@cat/db';
import { SpreadsheetFilter, ImportOptions } from '../filters/SpreadsheetFilter';
import { Project, ProjectFile, Segment, SegmentStatus, Token } from '@cat/core';
import { join, basename } from 'path';
import { copyFileSync, existsSync, mkdirSync, rmSync, unlinkSync } from 'fs';

export class ProjectService {
  private db: CATDatabase;
  private filter: SpreadsheetFilter;
  private projectsDir: string;

  constructor(db: CATDatabase, projectsDir: string) {
    this.db = db;
    this.filter = new SpreadsheetFilter();
    this.projectsDir = projectsDir;
    if (!existsSync(this.projectsDir)) {
      mkdirSync(this.projectsDir, { recursive: true });
    }
  }

  public async createProject(
    name: string, 
    srcLang: string, 
    tgtLang: string
  ): Promise<Project> {
    console.log(`[ProjectService] Creating project: ${name}`);
    const projectId = this.db.createProject(name, srcLang, tgtLang);
    
    // Create a dedicated folder for this project
    const projectDir = join(this.projectsDir, projectId.toString());
    if (!existsSync(projectDir)) {
      mkdirSync(projectDir, { recursive: true });
    }
    
    const project = this.db.getProject(projectId);
    if (!project) throw new Error('Failed to retrieve created project');
    return project;
  }

  public async addFileToProject(
    projectId: number,
    filePath: string,
    options: ImportOptions
  ): Promise<ProjectFile> {
    const project = this.db.getProject(projectId);
    if (!project) throw new Error('Project not found');

    console.log(`[ProjectService] Adding file ${filePath} to project ${projectId}`);
    const fileName = basename(filePath);
    const fileId = this.db.createFile(projectId, fileName);
    
    // Store in project-specific subfolder
    const projectDir = join(this.projectsDir, projectId.toString());
    if (!existsSync(projectDir)) {
      mkdirSync(projectDir, { recursive: true });
    }
    
    const storedPath = join(projectDir, `${fileId}_${fileName}`);
    console.log(`[ProjectService] Storing original file at: ${storedPath}`);
    copyFileSync(filePath, storedPath);
    
    console.log(`[ProjectService] Importing segments...`);
    const segments = await this.filter.import(storedPath, projectId, fileId, options);
    console.log(`[ProjectService] Found ${segments.length} segments`);
    
    if (segments.length === 0) {
      throw new Error('No valid segments found in the selected file.');
    }
    
    this.db.bulkInsertSegments(segments);
    
    const file = this.db.getFile(fileId);
    if (!file) throw new Error('Failed to retrieve created file');
    return file;
  }

  public listProjects() {
    return this.db.listProjects();
  }

  public listFiles(projectId: number) {
    return this.db.listFiles(projectId);
  }

  public getFile(fileId: number) {
    return this.db.getFile(fileId);
  }

  public getProject(projectId: number) {
    return this.db.getProject(projectId);
  }

  public async deleteProject(projectId: number) {
    console.log(`[ProjectService] Deleting project: ${projectId}`);
    this.db.deleteProject(projectId);
    
    const projectDir = join(this.projectsDir, projectId.toString());
    if (existsSync(projectDir)) {
      rmSync(projectDir, { recursive: true, force: true });
    }
  }

  public async deleteFile(fileId: number) {
    const file = this.db.getFile(fileId);
    if (!file) return;

    console.log(`[ProjectService] Deleting file: ${fileId} (${file.name})`);
    this.db.deleteFile(fileId);
    
    const filePath = join(this.projectsDir, file.projectId.toString(), `${file.id}_${file.name}`);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  public getSegments(fileId: number, offset: number, limit: number): Segment[] {
    return this.db.getSegmentsPage(fileId, offset, limit);
  }

  public async getSpreadsheetPreview(filePath: string): Promise<any[][]> {
    return this.filter.getPreview(filePath);
  }

  public updateSegment(segmentId: string, targetTokens: Token[], status: SegmentStatus) {
    this.db.updateSegmentTarget(segmentId, targetTokens, status);
  }

  public async exportFile(fileId: number, outputPath: string, options: ImportOptions) {
    const file = this.db.getFile(fileId);
    if (!file) throw new Error('File not found');
    
    const project = this.db.getProject(file.projectId);
    if (!project) throw new Error('Project not found');

    const segments = this.db.getSegmentsPage(fileId, 0, 1000000);
    const storedPath = join(this.projectsDir, file.projectId.toString(), `${file.id}_${file.name}`);
    
    await this.filter.export(storedPath, segments, options, outputPath);
  }
}
