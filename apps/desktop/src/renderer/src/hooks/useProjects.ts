import { useState, useEffect, useCallback } from 'react';
import { ProjectFile } from '../types';

export function useProjects() {
  const [projects, setProjects] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    if (!window.api) {
      console.error('window.api is not defined. Are you running in a browser instead of Electron?');
      // For v0.1 dev, let's not alert on every load, but it's a candidate for a toast
      return;
    }
    try {
      const list = await window.api.listProjects();
      setProjects(list);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const createProject = async () => {
    console.log('[useProjects] createProject triggered');
    if (!window.api) {
      alert('Desktop API not found. Please ensure you are running the app through Electron, not a standard browser.');
      return null;
    }
    const filePath = await window.api.openFileDialog([
      { name: 'Spreadsheets', extensions: ['xlsx', 'csv'] }
    ]);
    console.log('[useProjects] Selected file:', filePath);
    
    if (filePath) {
      // Use defaults to avoid prompt() which is blocked in many environments
      const srcLang = 'en-US';
      const tgtLang = 'zh-CN';
      
      const options = {
        hasHeader: true,
        sourceCol: 0,
        targetCol: 1
      };

      setLoading(true);
      try {
        const newProject = await window.api.createProject(filePath, srcLang, tgtLang, options);
        await loadProjects();
        return newProject;
      } catch (error) {
        console.error('Failed to create project:', error);
        alert('Failed to create project: ' + (error instanceof Error ? error.message : String(error)));
        return null;
      } finally {
        setLoading(false);
      }
    }
    return null;
  };

  const exportProject = async (projectId: number, fileName: string) => {
    const defaultPath = fileName.replace(/(\.xlsx|\.csv)$/i, '_translated$1');
    const outputPath = await window.api.saveFileDialog(defaultPath, [
      { name: 'Spreadsheets', extensions: ['xlsx', 'csv'] }
    ]);

    if (outputPath) {
      setLoading(true);
      try {
        await window.api.exportProject(projectId, outputPath, {
          hasHeader: true,
          sourceCol: 0,
          targetCol: 1
        });
        alert('Export successful');
      } catch (error) {
        console.error('Export failed:', error);
        alert('Export failed');
      } finally {
        setLoading(false);
      }
    }
  };

  return {
    projects,
    loading,
    loadProjects,
    createProject,
    exportProject
  };
}
