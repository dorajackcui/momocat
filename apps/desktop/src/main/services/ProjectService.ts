import { CATDatabase } from '@cat/db';
import { SpreadsheetFilter, ImportOptions } from '../filters/SpreadsheetFilter';
import { Project, Segment, SegmentStatus, Token } from '@cat/core';
import { join, basename } from 'path';
import { copyFileSync, existsSync, mkdirSync } from 'fs';

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
    filePath: string, 
    srcLang: string, 
    tgtLang: string,
    options: ImportOptions
  ): Promise<Project> {
    console.log(`[ProjectService] Creating project from ${filePath}`);
    const fileName = basename(filePath);
    const projectId = this.db.createProject(fileName, srcLang, tgtLang);
    console.log(`[ProjectService] Created project record with ID: ${projectId}`);
    
    const storedPath = join(this.projectsDir, `${projectId}_${fileName}`);
    console.log(`[ProjectService] Storing original file at: ${storedPath}`);
    copyFileSync(filePath, storedPath);
    
    console.log(`[ProjectService] Importing segments using options:`, options);
    const segments = await this.filter.import(storedPath, projectId, options);
    console.log(`[ProjectService] Found ${segments.length} segments`);
    
    if (segments.length === 0) {
      // Cleanup project if no segments found to avoid empty projects
      // For now just throw error
      throw new Error('No valid segments found in the selected file. Please check if the source column contains text.');
    }
    
    this.db.bulkInsertSegments(segments);
    console.log(`[ProjectService] Bulk inserted ${segments.length} segments`);
    
    const project = this.db.getProject(projectId);
    if (!project) throw new Error('Failed to retrieve created project');
    return project;
  }

  public listProjects(): Project[] {
    return this.db.listProjects();
  }

  public getSegments(projectId: number, offset: number, limit: number): Segment[] {
    return this.db.getSegmentsPage(projectId, offset, limit);
  }

  public updateSegment(segmentId: string, targetTokens: Token[], status: SegmentStatus) {
    this.db.updateSegmentTarget(segmentId, targetTokens, status);
  }

  public async exportProject(projectId: number, outputPath: string, options: ImportOptions) {
    const project = this.db.getProject(projectId);
    if (!project) throw new Error('Project not found');
    
    const segments = this.db.getSegmentsPage(projectId, 0, 1000000); // Get all for export
    const storedPath = join(this.projectsDir, `${projectId}_${project.name}`);
    
    await this.filter.export(storedPath, segments, options, outputPath);
  }
}
