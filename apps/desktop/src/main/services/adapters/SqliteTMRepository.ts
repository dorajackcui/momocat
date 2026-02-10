import { CATDatabase } from '@cat/db';
import { TMEntry } from '@cat/core';
import { TMRepository } from '../ports';

export class SqliteTMRepository implements TMRepository {
  constructor(private readonly db: CATDatabase) {}

  upsertTMEntryBySrcHash(entry: TMEntry & { tmId: string }): string {
    return this.db.upsertTMEntryBySrcHash(entry);
  }

  insertTMEntryIfAbsentBySrcHash(entry: TMEntry & { tmId: string }): string | undefined {
    return this.db.insertTMEntryIfAbsentBySrcHash(entry);
  }

  insertTMFts(tmId: string, srcText: string, tgtText: string, tmEntryId: string): void {
    this.db.insertTMFts(tmId, srcText, tgtText, tmEntryId);
  }

  replaceTMFts(tmId: string, srcText: string, tgtText: string, tmEntryId: string): void {
    this.db.replaceTMFts(tmId, srcText, tgtText, tmEntryId);
  }

  findTMEntryByHash(tmId: string, srcHash: string): TMEntry | undefined {
    return this.db.findTMEntryByHash(tmId, srcHash);
  }

  searchConcordance(projectId: number, query: string): TMEntry[] {
    return this.db.searchConcordance(projectId, query);
  }

  listTMs(type?: 'working' | 'main'): any[] {
    return this.db.listTMs(type);
  }

  createTM(name: string, srcLang: string, tgtLang: string, type: 'working' | 'main'): string {
    return this.db.createTM(name, srcLang, tgtLang, type);
  }

  deleteTM(id: string): void {
    this.db.deleteTM(id);
  }

  getTM(tmId: string): any | undefined {
    return this.db.getTM(tmId);
  }

  getTMStats(tmId: string): { entryCount: number } {
    return this.db.getTMStats(tmId);
  }

  getProjectMountedTMs(projectId: number): any[] {
    return this.db.getProjectMountedTMs(projectId);
  }

  mountTMToProject(projectId: number, tmId: string, priority?: number, permission?: string): void {
    this.db.mountTMToProject(projectId, tmId, priority, permission);
  }

  unmountTMFromProject(projectId: number, tmId: string): void {
    this.db.unmountTMFromProject(projectId, tmId);
  }
}
