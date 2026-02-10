import type { SegmentStatus, Token } from '@cat/core';
import type { ImportOptions } from '../../shared/ipc';
import { IPC_CHANNELS } from '../../shared/ipcChannels';
import type { MainHandlerDeps } from './types';

export function registerProjectHandlers({ ipcMain, projectService }: MainHandlerDeps): void {
  ipcMain.handle(IPC_CHANNELS.project.list, () => projectService.listProjects());

  ipcMain.handle(IPC_CHANNELS.project.create, (_event, ...args) => {
    const [name, srcLang, tgtLang] = args as [string, string, string];
    return projectService.createProject(name, srcLang, tgtLang);
  });

  ipcMain.handle(IPC_CHANNELS.project.get, (_event, ...args) => {
    const [projectId] = args as [number];
    return projectService.getProject(projectId);
  });

  ipcMain.handle(IPC_CHANNELS.project.updatePrompt, (_event, ...args) => {
    const [projectId, aiPrompt] = args as [number, string | null];
    return projectService.updateProjectPrompt(projectId, aiPrompt);
  });

  ipcMain.handle(IPC_CHANNELS.project.updateAISettings, (_event, ...args) => {
    const [projectId, aiPrompt, aiTemperature] = args as [number, string | null, number | null];
    return projectService.updateProjectAISettings(projectId, aiPrompt, aiTemperature);
  });

  ipcMain.handle(IPC_CHANNELS.project.remove, (_event, ...args) => {
    const [projectId] = args as [number];
    return projectService.deleteProject(projectId);
  });

  ipcMain.handle(IPC_CHANNELS.project.getFiles, (_event, ...args) => {
    const [projectId] = args as [number];
    return projectService.listFiles(projectId);
  });

  ipcMain.handle(IPC_CHANNELS.file.get, (_event, ...args) => {
    const [fileId] = args as [number];
    return projectService.getFile(fileId);
  });

  ipcMain.handle(IPC_CHANNELS.file.remove, (_event, ...args) => {
    const [fileId] = args as [number];
    return projectService.deleteFile(fileId);
  });

  ipcMain.handle(IPC_CHANNELS.project.addFile, (_event, ...args) => {
    const [projectId, filePath, options] = args as [number, string, ImportOptions];
    return projectService.addFileToProject(projectId, filePath, options);
  });

  ipcMain.handle(IPC_CHANNELS.file.getSegments, (_event, ...args) => {
    const [fileId, offset, limit] = args as [number, number, number];
    return projectService.getSegments(fileId, offset, limit);
  });

  ipcMain.handle(IPC_CHANNELS.file.getPreview, (_event, ...args) => {
    const [filePath] = args as [string];
    return projectService.getSpreadsheetPreview(filePath);
  });

  ipcMain.handle(IPC_CHANNELS.segment.update, (_event, ...args) => {
    const [segmentId, targetTokens, status] = args as [string, Token[], SegmentStatus];
    return projectService.updateSegment(segmentId, targetTokens, status);
  });

  ipcMain.handle(IPC_CHANNELS.file.export, (_event, ...args) => {
    const [fileId, outputPath, options, forceExport] = args as [number, string, ImportOptions | undefined, boolean | undefined];
    return projectService.exportFile(fileId, outputPath, options, forceExport ?? false);
  });
}
