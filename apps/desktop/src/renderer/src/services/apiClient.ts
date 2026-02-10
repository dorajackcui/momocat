import type { DesktopApi } from '../../../shared/ipc';

// Centralized renderer API boundary so UI modules do not directly depend on window globals.
export const apiClient: DesktopApi = window.api;
