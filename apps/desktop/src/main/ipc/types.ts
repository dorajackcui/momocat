import type { Dialog } from 'electron';
import type { ProjectService } from '../services/ProjectService';
import type { JobManager } from '../JobManager';

export interface IpcMainLike {
  handle: (channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) => void;
}

export interface MainHandlerDeps {
  ipcMain: IpcMainLike;
  projectService: ProjectService;
}

export interface AIHandlerDeps extends MainHandlerDeps {
  jobManager: JobManager;
}

export interface DialogHandlerDeps {
  ipcMain: IpcMainLike;
  dialog: Pick<Dialog, 'showOpenDialog' | 'showSaveDialog'>;
}
