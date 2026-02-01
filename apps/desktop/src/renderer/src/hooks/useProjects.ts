import { useState, useEffect, useCallback } from 'react';
import { Project } from '@cat/core';

export interface ProjectWithStats extends Project {
  progress: number;
  fileCount: number;
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    if (!window.api) {
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

  const createProject = async (name: string, srcLang: string, tgtLang: string) => {
    console.log('[useProjects] createProject triggered:', name);
    if (!window.api) {
      alert('Desktop API not found.');
      return null;
    }

    setLoading(true);
    try {
      const newProject = await window.api.createProject(name, srcLang, tgtLang);
      await loadProjects();
      return newProject;
    } catch (error) {
      console.error('Failed to create project:', error);
      alert('Failed to create project: ' + (error instanceof Error ? error.message : String(error)));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deleteProject = async (projectId: number) => {
    if (!window.api) return;
    if (!confirm('Are you sure you want to delete this project? This will remove all files and translations.')) return;

    setLoading(true);
    try {
      await window.api.deleteProject(projectId);
      await loadProjects();
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('Failed to delete project');
    } finally {
      setLoading(false);
    }
  };

  return {
    projects,
    loading,
    loadProjects,
    createProject,
    deleteProject
  };
}
