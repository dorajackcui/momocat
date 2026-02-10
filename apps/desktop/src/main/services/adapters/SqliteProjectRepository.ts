import { CATDatabase } from '@cat/db';
import { ProjectRepository } from '../ports';

export class SqliteProjectRepository implements ProjectRepository {
  constructor(private readonly db: CATDatabase) {}

  createProject(name: string, srcLang: string, tgtLang: string): number {
    return this.db.createProject(name, srcLang, tgtLang);
  }

  listProjects(): any[] {
    return this.db.listProjects();
  }

  getProject(id: number): any | undefined {
    return this.db.getProject(id);
  }

  updateProjectPrompt(projectId: number, aiPrompt: string | null): void {
    this.db.updateProjectPrompt(projectId, aiPrompt);
  }

  updateProjectAISettings(projectId: number, aiPrompt: string | null, aiTemperature: number | null): void {
    this.db.updateProjectAISettings(projectId, aiPrompt, aiTemperature);
  }

  deleteProject(id: number): void {
    this.db.deleteProject(id);
  }

  createFile(projectId: number, name: string, importOptionsJson?: string): number {
    return this.db.createFile(projectId, name, importOptionsJson);
  }

  listFiles(projectId: number): any[] {
    return this.db.listFiles(projectId);
  }

  getFile(id: number): any | undefined {
    return this.db.getFile(id);
  }

  deleteFile(id: number): void {
    this.db.deleteFile(id);
  }
}
