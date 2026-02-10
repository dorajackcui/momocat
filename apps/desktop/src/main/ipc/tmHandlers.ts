import type { Segment } from '@cat/core';
import type { TMImportOptions, TMType } from '../../shared/ipc';
import { IPC_CHANNELS } from '../../shared/ipcChannels';
import type { MainHandlerDeps } from './types';

export function registerTMHandlers({ ipcMain, projectService }: MainHandlerDeps): void {
  ipcMain.handle(IPC_CHANNELS.tm.get100Match, (_event, ...args) => {
    const [projectId, srcHash] = args as [number, string];
    return projectService.get100Match(projectId, srcHash);
  });

  ipcMain.handle(IPC_CHANNELS.tm.getMatches, (_event, ...args) => {
    const [projectId, segment] = args as [number, Segment];
    return projectService.findMatches(projectId, segment);
  });

  ipcMain.handle(IPC_CHANNELS.tm.concordance, (_event, ...args) => {
    const [projectId, query] = args as [number, string];
    return projectService.searchConcordance(projectId, query);
  });

  ipcMain.handle(IPC_CHANNELS.tm.list, (_event, ...args) => {
    const [type] = args as [TMType | undefined];
    return projectService.listTMs(type);
  });

  ipcMain.handle(IPC_CHANNELS.tm.create, (_event, ...args) => {
    const [name, srcLang, tgtLang, type] = args as [string, string, string, TMType | undefined];
    return projectService.createTM(name, srcLang, tgtLang, type);
  });

  ipcMain.handle(IPC_CHANNELS.tm.remove, (_event, ...args) => {
    const [tmId] = args as [string];
    return projectService.deleteTM(tmId);
  });

  ipcMain.handle(IPC_CHANNELS.tm.getMountedByProject, (_event, ...args) => {
    const [projectId] = args as [number];
    return projectService.getProjectMountedTMs(projectId);
  });

  ipcMain.handle(IPC_CHANNELS.tm.mount, (_event, ...args) => {
    const [projectId, tmId, priority, permission] = args as [number, string, number | undefined, string | undefined];
    return projectService.mountTMToProject(projectId, tmId, priority, permission);
  });

  ipcMain.handle(IPC_CHANNELS.tm.unmount, (_event, ...args) => {
    const [projectId, tmId] = args as [number, string];
    return projectService.unmountTMFromProject(projectId, tmId);
  });

  ipcMain.handle(IPC_CHANNELS.tm.commitFile, (_event, ...args) => {
    const [tmId, fileId] = args as [string, number];
    return projectService.commitToMainTM(tmId, fileId);
  });

  ipcMain.handle(IPC_CHANNELS.tm.matchFile, (_event, ...args) => {
    const [fileId, tmId] = args as [number, string];
    return projectService.batchMatchFileWithTM(fileId, tmId);
  });

  ipcMain.handle(IPC_CHANNELS.tm.importPreview, (_event, ...args) => {
    const [filePath] = args as [string];
    return projectService.getTMImportPreview(filePath);
  });

  ipcMain.handle(IPC_CHANNELS.tm.importExecute, (_event, ...args) => {
    const [tmId, filePath, options] = args as [string, string, TMImportOptions];
    return projectService.importTMEntries(tmId, filePath, options);
  });
}
