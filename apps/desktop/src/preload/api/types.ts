import type { IpcRendererEvent } from 'electron';
import type { DesktopApi } from '../../shared/ipc';

export interface IpcRendererLike {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  on: (channel: string, listener: (event: IpcRendererEvent, ...args: unknown[]) => void) => void;
  removeListener: (channel: string, listener: (event: IpcRendererEvent, ...args: unknown[]) => void) => void;
}

export type DesktopApiSlice<K extends keyof DesktopApi> = Pick<DesktopApi, K>;
