import { randomUUID } from 'crypto';
import { IPC_CHANNELS } from '../../shared/ipcChannels';
import type { AIHandlerDeps } from './types';

export function registerAIHandlers({ ipcMain, projectService, jobManager }: AIHandlerDeps): void {
  ipcMain.handle(IPC_CHANNELS.ai.getSettings, () => projectService.getAISettings());

  ipcMain.handle(IPC_CHANNELS.ai.setKey, (_event, ...args) => {
    const [apiKey] = args as [string];
    return projectService.setAIKey(apiKey);
  });

  ipcMain.handle(IPC_CHANNELS.ai.clearKey, () => projectService.clearAIKey());

  ipcMain.handle(IPC_CHANNELS.ai.testConnection, (_event, ...args) => {
    const [apiKey] = args as [string | undefined];
    return projectService.testAIConnection(apiKey);
  });

  ipcMain.handle(IPC_CHANNELS.ai.translateFile, (_event, ...args) => {
    const [fileId] = args as [number];
    const jobId = randomUUID();
    jobManager.startJob(jobId, 'AI translation started');

    projectService
      .aiTranslateFile(fileId, {
        onProgress: (data) => {
          const progress = data.total === 0 ? 100 : Math.round((data.current / data.total) * 100);
          jobManager.updateProgress(jobId, {
            progress,
            message: data.message,
          });
        },
      })
      .then((result) => {
        jobManager.updateProgress(jobId, {
          progress: 100,
          status: 'completed',
          message: `AI translation completed: ${result.translated} translated, ${result.skipped} skipped, ${result.failed} failed`,
        });
      })
      .catch((error) => {
        jobManager.updateProgress(jobId, {
          progress: 100,
          status: 'failed',
          message: error instanceof Error ? error.message : String(error),
        });
      });

    return jobId;
  });

  ipcMain.handle(IPC_CHANNELS.ai.testTranslate, async (_event, ...args) => {
    const [projectId, sourceText, contextText] = args as [number, string, string | undefined];
    try {
      return await projectService.aiTestTranslate(projectId, sourceText, contextText);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        promptUsed: '',
        userMessage: sourceText
          ? [`Source:\n${sourceText}`, contextText?.trim() ? `Context: ${contextText.trim()}` : '']
              .filter(Boolean)
              .join('\n\n')
          : '',
        translatedText: '',
      };
    }
  });
}
