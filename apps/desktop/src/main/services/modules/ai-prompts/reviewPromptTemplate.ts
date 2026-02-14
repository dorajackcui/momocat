import { SystemPromptBuildParams, UserPromptBuildParams } from './types';

function buildReviewBasePromptRules(srcLang: string, tgtLang: string): string[] {
  return [
    `Review and improve the provided ${tgtLang} text, using ${srcLang} as source language.`,
    'The source can include protected markers such as {1>, <2}, {3}.',
    'Never translate, remove, reorder, renumber, or rewrite protected markers.',
    'Keep all tags, placeholders, and formatting exactly as they appear in the source.',
    'Return only the reviewed text, without quotes or extra commentary.',
    'If no edit is needed, returning the original text is allowed.',
  ];
}

function buildReviewLanguageInstruction(srcLang: string, tgtLang: string): string {
  return `Original text language: ${srcLang}. Translation text language: ${tgtLang}.`;
}

function buildReviewSourceHeader(srcLang: string, hasProtectedMarkers: boolean): string {
  if (hasProtectedMarkers) {
    return `Source (${srcLang}, protected-marker format):`;
  }
  return `Source (${srcLang}):`;
}

export function buildReviewSystemPrompt(params: SystemPromptBuildParams): string {
  const trimmedProjectPrompt = params.projectPrompt?.trim();
  const languageInstruction = buildReviewLanguageInstruction(params.srcLang, params.tgtLang);

  if (trimmedProjectPrompt) {
    return `${languageInstruction}\n${trimmedProjectPrompt}`;
  }

  const base = buildReviewBasePromptRules(params.srcLang, params.tgtLang).join('\n');
  return `You are a professional reviewer.\n${base}`;
}

export function buildReviewUserPrompt(params: UserPromptBuildParams): string {
  const userParts = [
    buildReviewSourceHeader(params.srcLang, params.hasProtectedMarkers),
    params.sourcePayload,
  ];

  const contextText = typeof params.context === 'string' ? params.context.trim() : '';
  userParts.push('', `Context: ${contextText}`);

  if (params.validationFeedback) {
    userParts.push('', 'Validation feedback from previous attempt:', params.validationFeedback);
  }

  return userParts.join('\n');
}
