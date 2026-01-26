import { useState, useEffect, useCallback } from 'react';
import { ProjectFile } from '../types';

export function useProjects() {
  const [files, setFiles] = useState<ProjectFile[]>([]);

  const loadFiles = useCallback(async () => {
    if (window.api) {
      try {
        const fileList = await window.api.getFiles();
        setFiles(fileList);
      } catch (error) {
        console.error('Failed to load files:', error);
      }
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const addFiles = async () => {
    if (window.api) {
      try {
        const newFiles = await window.api.addFiles();
        if (newFiles.length > 0) {
          setFiles((prev) => [...newFiles, ...prev]);
        }
      } catch (error) {
        console.error('Failed to add files:', error);
      }
    }
  };

  const deleteFile = async (id: number) => {
    if (confirm('Are you sure you want to delete this file?')) {
      if (window.api) {
        await window.api.deleteFile(id);
        setFiles((prev) => prev.filter((f) => f.id !== id));
        return true;
      }
    }
    return false;
  };

  const batchMatch = async (id: number) => {
    try {
      const count = await window.api.batchMatchTM(id);
      alert(`Batch match completed. ${count} segments updated.`);
      loadFiles(); // Refresh to potentially show progress updates (if backend calculated them)
    } catch (error) {
      console.error('Batch match failed:', error);
      alert('Batch match failed');
    }
  };

  const updateFileProgress = useCallback((id: number, progress: number) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, progress } : f)));
  }, []);

  return {
    files,
    loadFiles,
    addFiles,
    deleteFile,
    batchMatch,
    updateFileProgress,
  };
}
