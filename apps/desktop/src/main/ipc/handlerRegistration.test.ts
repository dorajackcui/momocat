import { describe, expect, it, vi } from 'vitest';
import type { ProjectService } from '../services/ProjectService';
import type { JobManager } from '../JobManager';
import { IPC_CHANNELS } from '../../shared/ipcChannels';
import { registerProjectHandlers } from './projectHandlers';
import { registerTMHandlers } from './tmHandlers';
import { registerTBHandlers } from './tbHandlers';
import { registerAIHandlers } from './aiHandlers';
import { registerDialogHandlers } from './dialogHandlers';

describe('IPC handler registration smoke', () => {
  it('registers all domain channels via modular handlers', () => {
    const handle = vi.fn();
    const ipcMain = { handle };
    const projectService = {} as ProjectService;
    const jobManager = {} as JobManager;

    registerProjectHandlers({ ipcMain, projectService });
    registerTMHandlers({ ipcMain, projectService });
    registerTBHandlers({ ipcMain, projectService });
    registerAIHandlers({ ipcMain, projectService, jobManager });
    registerDialogHandlers({
      ipcMain,
      dialog: {
        showOpenDialog: vi.fn(),
        showSaveDialog: vi.fn()
      }
    });

    const registeredChannels = new Set(handle.mock.calls.map((call) => call[0] as string));

    const expectedChannels = [
      ...Object.values(IPC_CHANNELS.project),
      ...Object.values(IPC_CHANNELS.file),
      ...Object.values(IPC_CHANNELS.segment),
      ...Object.values(IPC_CHANNELS.tm),
      ...Object.values(IPC_CHANNELS.tb),
      ...Object.values(IPC_CHANNELS.ai),
      ...Object.values(IPC_CHANNELS.dialog)
    ];

    expect(registeredChannels.size).toBe(expectedChannels.length);
    expectedChannels.forEach((channel) => {
      expect(registeredChannels.has(channel)).toBe(true);
    });
  });
});
