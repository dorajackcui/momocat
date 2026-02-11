import { useState } from 'react';
import type { ImportOptions, SpreadsheetPreviewData } from '../../../../shared/ipc';
import { apiClient } from '../../services/apiClient';
import { feedbackService } from '../../services/feedbackService';

interface UseProjectFileImportParams {
  projectId: number;
  loadData: () => Promise<void>;
  runMutation: <T>(fn: () => Promise<T>) => Promise<T>;
}

interface UseProjectFileImportResult {
  isSelectorOpen: boolean;
  previewData: SpreadsheetPreviewData;
  openFileImport: () => Promise<void>;
  closeSelector: () => void;
  confirmImport: (options: ImportOptions) => Promise<void>;
}

export function useProjectFileImport({
  projectId,
  loadData,
  runMutation,
}: UseProjectFileImportParams): UseProjectFileImportResult {
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [pendingFilePath, setPendingFilePath] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<SpreadsheetPreviewData>([]);

  const openFileImport = async () => {
    const filePath = await apiClient.openFileDialog([
      { name: 'Spreadsheets', extensions: ['xlsx', 'csv'] },
    ]);
    if (!filePath) return;

    try {
      await runMutation(async () => {
        const preview = await apiClient.getFilePreview(filePath);
        setPreviewData(preview);
        setPendingFilePath(filePath);
        setIsSelectorOpen(true);
      });
    } catch (error) {
      feedbackService.error(
        `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const closeSelector = () => {
    setIsSelectorOpen(false);
  };

  const confirmImport = async (options: ImportOptions) => {
    if (!pendingFilePath) return;
    try {
      await runMutation(async () => {
        setIsSelectorOpen(false);
        await apiClient.addFileToProject(projectId, pendingFilePath, options);
        await loadData();
        setPendingFilePath(null);
      });
    } catch (error) {
      feedbackService.error(
        `Failed to add file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  return {
    isSelectorOpen,
    previewData,
    openFileImport,
    closeSelector,
    confirmImport,
  };
}
