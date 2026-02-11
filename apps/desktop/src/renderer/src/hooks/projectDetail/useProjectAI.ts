import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';
import { Project } from '@cat/core';
import type { JobProgressEvent } from '../../../../shared/ipc';
import { apiClient } from '../../services/apiClient';
import { feedbackService } from '../../services/feedbackService';

export const DEFAULT_AI_TEMPERATURE = 0.2;

export function normalizeTemperatureValue(value: number): number {
  return Math.max(0, Math.min(2, Number(value.toFixed(2))));
}

export function formatTemperature(value: number): string {
  return normalizeTemperatureValue(value).toString();
}

export function parseTemperatureInput(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return normalizeTemperatureValue(parsed);
}

export interface ProjectAIFlagsInput {
  promptDraft: string;
  savedPromptValue: string;
  temperatureDraft: string;
  savedTemperatureValue: string;
  testMeta: string | null;
  testUserMessage: string | null;
  testPromptUsed: string | null;
  testRawResponse: string | null;
}

export interface ProjectAIFlags {
  normalizedPromptDraft: string;
  normalizedSavedPrompt: string;
  normalizedTemperatureDraft: number | null;
  normalizedSavedTemperature: number | null;
  hasUnsavedPromptChanges: boolean;
  hasInvalidTemperature: boolean;
  hasTestDetails: boolean;
}

export function deriveProjectAIFlags(input: ProjectAIFlagsInput): ProjectAIFlags {
  const normalizedPromptDraft = input.promptDraft.trim();
  const normalizedSavedPrompt = input.savedPromptValue.trim();
  const normalizedTemperatureDraft = parseTemperatureInput(input.temperatureDraft);
  const normalizedSavedTemperature = parseTemperatureInput(input.savedTemperatureValue);
  const hasUnsavedTemperatureChanges = normalizedTemperatureDraft !== normalizedSavedTemperature;

  return {
    normalizedPromptDraft,
    normalizedSavedPrompt,
    normalizedTemperatureDraft,
    normalizedSavedTemperature,
    hasUnsavedPromptChanges:
      normalizedPromptDraft !== normalizedSavedPrompt || hasUnsavedTemperatureChanges,
    hasInvalidTemperature: normalizedTemperatureDraft === null,
    hasTestDetails: Boolean(
      input.testMeta || input.testUserMessage || input.testPromptUsed || input.testRawResponse,
    ),
  };
}

export interface AITestMetaInput {
  status?: number;
  requestId?: string;
  model?: string;
  endpoint?: string;
  ok: boolean;
}

export function buildAITestMeta(input: AITestMetaInput): string {
  const metaParts: string[] = [];
  if (typeof input.status === 'number') metaParts.push(`status: ${input.status}`);
  if (input.requestId) metaParts.push(`requestId: ${input.requestId}`);
  if (input.model) metaParts.push(`model: ${input.model}`);
  if (input.endpoint) metaParts.push(`endpoint: ${input.endpoint}`);
  metaParts.push(`ok: ${input.ok ? 'true' : 'false'}`);
  return metaParts.join(' • ');
}

export interface TrackedAIJob extends JobProgressEvent {
  fileId: number;
}

export interface ProjectAIController {
  promptDraft: string;
  setPromptDraft: Dispatch<SetStateAction<string>>;
  temperatureDraft: string;
  setTemperatureDraft: Dispatch<SetStateAction<string>>;
  promptSavedAt: string | null;
  savingPrompt: boolean;
  testSource: string;
  setTestSource: Dispatch<SetStateAction<string>>;
  testResult: string | null;
  testPromptUsed: string | null;
  testUserMessage: string | null;
  testMeta: string | null;
  testError: string | null;
  testRawResponse: string | null;
  showTestDetails: boolean;
  setShowTestDetails: Dispatch<SetStateAction<boolean>>;
  hasUnsavedPromptChanges: boolean;
  hasInvalidTemperature: boolean;
  hasTestDetails: boolean;
  savePrompt: () => Promise<void>;
  testPrompt: () => Promise<void>;
  startAITranslateFile: (fileId: number, fileName: string) => Promise<void>;
  getFileJob: (fileId: number) => TrackedAIJob | null;
}

interface UseProjectAIParams {
  project: Project | null;
  setProject: Dispatch<SetStateAction<Project | null>>;
  loadData: () => Promise<void>;
  runMutation: <T>(fn: () => Promise<T>) => Promise<T>;
}

export function useProjectAI({
  project,
  setProject,
  loadData,
  runMutation,
}: UseProjectAIParams): ProjectAIController {
  const [promptDraft, setPromptDraft] = useState('');
  const [savedPromptValue, setSavedPromptValue] = useState('');
  const [temperatureDraft, setTemperatureDraft] = useState(
    formatTemperature(DEFAULT_AI_TEMPERATURE),
  );
  const [savedTemperatureValue, setSavedTemperatureValue] = useState(
    formatTemperature(DEFAULT_AI_TEMPERATURE),
  );
  const [promptSavedAt, setPromptSavedAt] = useState<string | null>(null);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [testSource, setTestSource] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testPromptUsed, setTestPromptUsed] = useState<string | null>(null);
  const [testUserMessage, setTestUserMessage] = useState<string | null>(null);
  const [testMeta, setTestMeta] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testRawResponse, setTestRawResponse] = useState<string | null>(null);
  const [showTestDetails, setShowTestDetails] = useState(false);
  const [aiJobs, setAiJobs] = useState<Record<string, TrackedAIJob>>({});
  const [fileJobIndex, setFileJobIndex] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!project) return;
    const promptValue = project.aiPrompt || '';
    const temperatureValue =
      typeof project.aiTemperature === 'number' && Number.isFinite(project.aiTemperature)
        ? formatTemperature(project.aiTemperature)
        : formatTemperature(DEFAULT_AI_TEMPERATURE);

    setPromptDraft(promptValue);
    setSavedPromptValue(promptValue);
    setTemperatureDraft(temperatureValue);
    setSavedTemperatureValue(temperatureValue);
  }, [project]);

  useEffect(() => {
    const unsubscribe = apiClient.onJobProgress((progress: JobProgressEvent) => {
      setAiJobs((prev) => {
        if (!prev[progress.jobId]) return prev;
        return {
          ...prev,
          [progress.jobId]: {
            ...prev[progress.jobId],
            ...progress,
          },
        };
      });

      if (progress.status === 'completed' || progress.status === 'failed') {
        void loadData();
      }
    });
    return unsubscribe;
  }, [loadData]);

  const aiFlags = deriveProjectAIFlags({
    promptDraft,
    savedPromptValue,
    temperatureDraft,
    savedTemperatureValue,
    testMeta,
    testUserMessage,
    testPromptUsed,
    testRawResponse,
  });
  const normalizedPromptDraft = aiFlags.normalizedPromptDraft;
  const normalizedSavedPrompt = aiFlags.normalizedSavedPrompt;
  const normalizedSavedTemperature = aiFlags.normalizedSavedTemperature;
  const hasUnsavedPromptChanges = aiFlags.hasUnsavedPromptChanges;
  const hasInvalidTemperature = aiFlags.hasInvalidTemperature;
  const hasTestDetails = aiFlags.hasTestDetails;

  const savePrompt = useCallback(async () => {
    if (!project) return;
    const parsedTemperature = parseTemperatureInput(temperatureDraft);
    if (parsedTemperature === null) {
      feedbackService.error('Temperature must be a number between 0 and 2.');
      return;
    }

    if (
      normalizedPromptDraft === normalizedSavedPrompt &&
      normalizedSavedTemperature !== null &&
      parsedTemperature === normalizedSavedTemperature
    ) {
      return;
    }

    setSavingPrompt(true);
    try {
      await runMutation(async () => {
        const promptValue = normalizedPromptDraft.length > 0 ? normalizedPromptDraft : null;
        await apiClient.updateProjectAISettings(project.id, promptValue, parsedTemperature);
        setProject((prev) => {
          if (!prev) return prev;
          return { ...prev, aiPrompt: promptValue, aiTemperature: parsedTemperature };
        });
        setSavedPromptValue(normalizedPromptDraft);
        const normalizedTemperature = formatTemperature(parsedTemperature);
        setTemperatureDraft(normalizedTemperature);
        setSavedTemperatureValue(normalizedTemperature);
        setPromptSavedAt(new Date().toLocaleTimeString());
      });
    } catch {
      feedbackService.error('Failed to save AI settings');
    } finally {
      setSavingPrompt(false);
    }
  }, [
    normalizedPromptDraft,
    normalizedSavedPrompt,
    normalizedSavedTemperature,
    project,
    runMutation,
    setProject,
    temperatureDraft,
  ]);

  const testPrompt = useCallback(async () => {
    if (!project) return;
    const source = testSource.trim();
    if (!source) {
      feedbackService.info('Please enter test source text.');
      return;
    }

    try {
      setTestError(null);
      setTestResult(null);
      setTestMeta(null);
      setTestPromptUsed(null);
      setTestUserMessage(null);
      setTestRawResponse(null);

      const result = await apiClient.aiTestTranslate(project.id, source);
      setTestResult(result.translatedText || null);
      setTestPromptUsed(result.promptUsed);
      setTestUserMessage(result.userMessage);
      setTestError(result.error || null);
      setTestRawResponse(result.rawResponseText || null);

      setTestMeta(buildAITestMeta(result));
      setShowTestDetails(!result.ok);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setTestError(message);
      setShowTestDetails(true);
    }
  }, [project, testSource]);

  const startAITranslateFile = useCallback(async (fileId: number, fileName: string) => {
    const confirmed = await feedbackService.confirm(
      `Run AI translation for "${fileName}"? This will fill empty target segments only.`,
    );
    if (!confirmed) return;
    try {
      const jobId = await apiClient.aiTranslateFile(fileId);
      setAiJobs((prev) => ({
        ...prev,
        [jobId]: { jobId, fileId, progress: 0, status: 'running', message: 'Queued' },
      }));
      setFileJobIndex((prev) => ({ ...prev, [fileId]: jobId }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      feedbackService.error(`Failed to start AI translation: ${message}`);
    }
  }, []);

  const getFileJob = useCallback(
    (fileId: number): TrackedAIJob | null => {
      const jobId = fileJobIndex[fileId];
      if (!jobId) return null;
      return aiJobs[jobId] ?? null;
    },
    [aiJobs, fileJobIndex],
  );

  return useMemo(
    () => ({
      promptDraft,
      setPromptDraft,
      temperatureDraft,
      setTemperatureDraft,
      promptSavedAt,
      savingPrompt,
      testSource,
      setTestSource,
      testResult,
      testPromptUsed,
      testUserMessage,
      testMeta,
      testError,
      testRawResponse,
      showTestDetails,
      setShowTestDetails,
      hasUnsavedPromptChanges,
      hasInvalidTemperature,
      hasTestDetails,
      savePrompt,
      testPrompt,
      startAITranslateFile,
      getFileJob,
    }),
    [
      getFileJob,
      hasInvalidTemperature,
      hasTestDetails,
      hasUnsavedPromptChanges,
      promptDraft,
      promptSavedAt,
      savePrompt,
      savingPrompt,
      showTestDetails,
      startAITranslateFile,
      temperatureDraft,
      testError,
      testMeta,
      testPrompt,
      testPromptUsed,
      testRawResponse,
      testResult,
      testSource,
      testUserMessage,
    ],
  );
}
