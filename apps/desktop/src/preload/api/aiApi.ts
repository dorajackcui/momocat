import type { DesktopApi } from '../../shared/ipc';
import { IPC_CHANNELS } from '../../shared/ipcChannels';
import type { DesktopApiSlice, IpcRendererLike } from './types';

type AIApiKeys =
  | 'getAISettings'
  | 'setAIKey'
  | 'clearAIKey'
  | 'getProxySettings'
  | 'setProxySettings'
  | 'testAIConnection'
  | 'aiTranslateSegment'
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
    getProxySettings: () =>
      ipcRenderer.invoke(IPC_CHANNELS.ai.getProxySettings) as ReturnType<
        DesktopApi['getProxySettings']
      >,
    setProxySettings: (settings) =>
      ipcRenderer.invoke(IPC_CHANNELS.ai.setProxySettings, settings) as ReturnType<
        DesktopApi['setProxySettings']
      >,
    testAIConnection: (apiKey) =>
      ipcRenderer.invoke(IPC_CHANNELS.ai.testConnection, apiKey) as ReturnType<
        DesktopApi['testAIConnection']
      >,
    aiTranslateSegment: (segmentId) =>
      ipcRenderer.invoke(IPC_CHANNELS.ai.translateSegment, segmentId) as ReturnType<
        DesktopApi['aiTranslateSegment']
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
