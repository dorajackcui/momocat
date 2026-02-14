import { SystemPromptBuildParams, UserPromptBuildParams } from './types';

function buildCustomSourceHeader(hasProtectedMarkers: boolean): string {
  if (hasProtectedMarkers) {
    return 'Input (protected-marker format):';
  }
  return 'Input:';
}

export function buildCustomSystemPrompt(params: SystemPromptBuildParams): string {
  const trimmedProjectPrompt = params.projectPrompt?.trim();
  if (trimmedProjectPrompt) {
    return trimmedProjectPrompt;
  }

  return [
    'You are a precise text processing assistant.',
    'Follow the user-provided instruction exactly.',
    'Use context when present.',
    'Return only the final output text, without quotes or extra commentary.',
  ].join('\n');
}

export function buildCustomUserPrompt(params: UserPromptBuildParams): string {
  const userParts = [buildCustomSourceHeader(params.hasProtectedMarkers), params.sourcePayload];

  const contextText = typeof params.context === 'string' ? params.context.trim() : '';
  if (contextText) {
    userParts.push('', `Context: ${contextText}`);
  }

  if (params.validationFeedback) {
    userParts.push('', 'Validation feedback from previous attempt:', params.validationFeedback);
  }

  return userParts.join('\n');
}
