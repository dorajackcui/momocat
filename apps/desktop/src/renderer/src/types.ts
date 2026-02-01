import { Project as BaseProject } from '@cat/core';
export * from '@cat/core';

export interface ProjectFile extends BaseProject {
  progress: number;
}
