import type { Segment } from '@cat/core';
import type { TBImportOptions } from '../../shared/ipc';
import { IPC_CHANNELS } from '../../shared/ipcChannels';
import type { MainHandlerDeps } from './types';

export function registerTBHandlers({ ipcMain, projectService }: MainHandlerDeps): void {
  ipcMain.handle(IPC_CHANNELS.tb.getMatches, (_event, ...args) => {
    const [projectId, segment] = args as [number, Segment];
    return projectService.findTermMatches(projectId, segment);
  });

  ipcMain.handle(IPC_CHANNELS.tb.list, () => projectService.listTBs());

  ipcMain.handle(IPC_CHANNELS.tb.create, (_event, ...args) => {
    const [name, srcLang, tgtLang] = args as [string, string, string];
    return projectService.createTB(name, srcLang, tgtLang);
  });

  ipcMain.handle(IPC_CHANNELS.tb.remove, (_event, ...args) => {
    const [tbId] = args as [string];
    return projectService.deleteTB(tbId);
  });

  ipcMain.handle(IPC_CHANNELS.tb.getMountedByProject, (_event, ...args) => {
    const [projectId] = args as [number];
    return projectService.getProjectMountedTBs(projectId);
  });

  ipcMain.handle(IPC_CHANNELS.tb.mount, (_event, ...args) => {
    const [projectId, tbId, priority] = args as [number, string, number | undefined];
    return projectService.mountTBToProject(projectId, tbId, priority);
  });

  ipcMain.handle(IPC_CHANNELS.tb.unmount, (_event, ...args) => {
    const [projectId, tbId] = args as [number, string];
    return projectService.unmountTBFromProject(projectId, tbId);
  });

  ipcMain.handle(IPC_CHANNELS.tb.importPreview, (_event, ...args) => {
    const [filePath] = args as [string];
    return projectService.getTBImportPreview(filePath);
  });

  ipcMain.handle(IPC_CHANNELS.tb.importExecute, (_event, ...args) => {
    const [tbId, filePath, options] = args as [string, string, TBImportOptions];
    return projectService.importTBEntries(tbId, filePath, options);
  });
}
