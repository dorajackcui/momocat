import type { DesktopApi } from '../../shared/ipc';
import { IPC_CHANNELS } from '../../shared/ipcChannels';
import type { DesktopApiSlice, IpcRendererLike } from './types';

type AIApiKeys =
  | 'getAISettings'
  | 'setAIKey'
  | 'clearAIKey'
  | 'testAIConnection'
  | 'aiTranslateFile'
  | 'aiTestTranslate';

export function createAIApi(ipcRenderer: IpcRendererLike): DesktopApiSlice<AIApiKeys> {
  return {
    getAISettings: () =>
      ipcRenderer.invoke(IPC_CHANNELS.ai.getSettings) as ReturnType<DesktopApi['getAISettings']>,
    setAIKey: (apiKey) =>
      ipcRenderer.invoke(IPC_CHANNELS.ai.setKey, apiKey) as ReturnType<DesktopApi['setAIKey']>,
    clearAIKey: () =>
      ipcRenderer.invoke(IPC_CHANNELS.ai.clearKey) as ReturnType<DesktopApi['clearAIKey']>,
    testAIConnection: (apiKey) =>
      ipcRenderer.invoke(IPC_CHANNELS.ai.testConnection, apiKey) as ReturnType<
        DesktopApi['testAIConnection']
      >,
    aiTranslateFile: (fileId) =>
      ipcRenderer.invoke(IPC_CHANNELS.ai.translateFile, fileId) as ReturnType<
        DesktopApi['aiTranslateFile']
      >,
    aiTestTranslate: (projectId, sourceText, contextText) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.ai.testTranslate,
        projectId,
        sourceText,
        contextText,
      ) as ReturnType<DesktopApi['aiTestTranslate']>,
  };
}
