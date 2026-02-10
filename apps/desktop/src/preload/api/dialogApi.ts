import type { DesktopApi } from '../../shared/ipc';
import { IPC_CHANNELS } from '../../shared/ipcChannels';
import type { DesktopApiSlice, IpcRendererLike } from './types';

type DialogApiKeys = 'openFileDialog' | 'saveFileDialog';

export function createDialogApi(ipcRenderer: IpcRendererLike): DesktopApiSlice<DialogApiKeys> {
  return {
    openFileDialog: (filters) =>
      ipcRenderer.invoke(IPC_CHANNELS.dialog.openFile, filters) as ReturnType<DesktopApi['openFileDialog']>,
    saveFileDialog: (defaultPath, filters) =>
      ipcRenderer.invoke(IPC_CHANNELS.dialog.saveFile, defaultPath, filters) as ReturnType<DesktopApi['saveFileDialog']>
  };
}
