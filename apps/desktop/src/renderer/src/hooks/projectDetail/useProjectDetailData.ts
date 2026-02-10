import { useCallback, useEffect, useState } from 'react';
import { Project, ProjectFile } from '@cat/core';
import type { MountedTB, MountedTM, TBWithStats, TMBatchMatchResult, TMWithStats } from '../../../../shared/ipc';
import { apiClient } from '../../services/apiClient';

export interface UseProjectDetailDataResult {
  project: Project | null;
  setProject: React.Dispatch<React.SetStateAction<Project | null>>;
  files: ProjectFile[];
  mountedTMs: MountedTM[];
  allMainTMs: TMWithStats[];
  mountedTBs: MountedTB[];
  allTBs: TBWithStats[];
  loading: boolean;
  loadData: () => Promise<void>;
  runMutation: <T>(fn: () => Promise<T>) => Promise<T>;
  mountTM: (tmId: string) => Promise<void>;
  unmountTM: (tmId: string) => Promise<void>;
  mountTB: (tbId: string) => Promise<void>;
  unmountTB: (tbId: string) => Promise<void>;
  commitToMainTM: (tmId: string, fileId: number) => Promise<number>;
  matchFileWithTM: (fileId: number, tmId: string) => Promise<TMBatchMatchResult>;
}

export function useProjectDetailData(projectId: number): UseProjectDetailDataResult {
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [mountedTMs, setMountedTMs] = useState<MountedTM[]>([]);
  const [allMainTMs, setAllMainTMs] = useState<TMWithStats[]>([]);
  const [mountedTBs, setMountedTBs] = useState<MountedTB[]>([]);
  const [allTBs, setAllTBs] = useState<TBWithStats[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [mutating, setMutating] = useState(false);

  const loading = loadingData || mutating;

  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const p = await apiClient.getProject(projectId);
      const f = await apiClient.getProjectFiles(projectId);
      const mounted = await apiClient.getProjectMountedTMs(projectId);
      const allMain = await apiClient.listTMs('main');
      const mountedTB = await apiClient.getProjectMountedTBs(projectId);
      const allTB = await apiClient.listTBs();

      setProject(p ?? null);
      setFiles(f);
      setMountedTMs(mounted);
      setAllMainTMs(allMain);
      setMountedTBs(mountedTB);
      setAllTBs(allTB);
    } catch (error) {
      console.error('Failed to load project details:', error);
    } finally {
      setLoadingData(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const runMutation = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    setMutating(true);
    try {
      return await fn();
    } finally {
      setMutating(false);
    }
  }, []);

  const mountTM = useCallback(
    async (tmId: string) => {
      await runMutation(async () => {
        await apiClient.mountTMToProject(projectId, tmId);
        await loadData();
      });
    },
    [loadData, projectId, runMutation]
  );

  const unmountTM = useCallback(
    async (tmId: string) => {
      await runMutation(async () => {
        await apiClient.unmountTMFromProject(projectId, tmId);
        await loadData();
      });
    },
    [loadData, projectId, runMutation]
  );

  const mountTB = useCallback(
    async (tbId: string) => {
      await runMutation(async () => {
        await apiClient.mountTBToProject(projectId, tbId);
        await loadData();
      });
    },
    [loadData, projectId, runMutation]
  );

  const unmountTB = useCallback(
    async (tbId: string) => {
      await runMutation(async () => {
        await apiClient.unmountTBFromProject(projectId, tbId);
        await loadData();
      });
    },
    [loadData, projectId, runMutation]
  );

  const commitToMainTM = useCallback(
    async (tmId: string, fileId: number) => {
      return runMutation(async () => {
        const count = await apiClient.commitToMainTM(tmId, fileId);
        await loadData();
        return count;
      });
    },
    [loadData, runMutation]
  );

  const matchFileWithTM = useCallback(
    async (fileId: number, tmId: string) => {
      return runMutation(async () => {
        const result = await apiClient.matchFileWithTM(fileId, tmId);
        await loadData();
        return result;
      });
    },
    [loadData, runMutation]
  );

  return {
    project,
    setProject,
    files,
    mountedTMs,
    allMainTMs,
    mountedTBs,
    allTBs,
    loading,
    loadData,
    runMutation,
    mountTM,
    unmountTM,
    mountTB,
    unmountTB,
    commitToMainTM,
    matchFileWithTM
  };
}
