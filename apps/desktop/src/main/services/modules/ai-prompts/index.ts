import { ProjectType } from '@cat/core';
import { buildCustomSystemPrompt, buildCustomUserPrompt } from './customPromptTemplate';
import { buildReviewSystemPrompt, buildReviewUserPrompt } from './reviewPromptTemplate';
import { buildTranslationSystemPrompt, buildTranslationUserPrompt } from './translationPromptTemplate';
import { SystemPromptBuildParams, UserPromptBuildParams } from './types';

export function normalizeProjectType(projectType?: ProjectType): ProjectType {
  if (projectType === 'review') {
    return 'review';
  }
  if (projectType === 'custom') {
    return 'custom';
  }
  return 'translation';
}

export function getAIProgressVerb(projectType: ProjectType): string {
  const normalizedType = normalizeProjectType(projectType);

  if (normalizedType === 'review') {
    return 'Reviewing';
  }
  if (normalizedType === 'custom') {
    return 'Processing';
  }
  return 'Translating';
}

export function buildAISystemPrompt(
  projectType: ProjectType,
  params: SystemPromptBuildParams,
): string {
  const normalizedType = normalizeProjectType(projectType);

  if (normalizedType === 'review') {
    return buildReviewSystemPrompt(params);
  }
  if (normalizedType === 'custom') {
    return buildCustomSystemPrompt(params);
  }
  return buildTranslationSystemPrompt(params);
}

export function buildAIUserPrompt(projectType: ProjectType, params: UserPromptBuildParams): string {
  const normalizedType = normalizeProjectType(projectType);

  if (normalizedType === 'review') {
    return buildReviewUserPrompt(params);
  }
  if (normalizedType === 'custom') {
    return buildCustomUserPrompt(params);
  }
  return buildTranslationUserPrompt(params);
}
