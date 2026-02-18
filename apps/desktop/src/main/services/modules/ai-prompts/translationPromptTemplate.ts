import { SystemPromptBuildParams, UserPromptBuildParams } from './types';

function buildTranslationBasePromptRules(srcLang: string, tgtLang: string): string[] {
  return [
    `Translate from ${srcLang} to ${tgtLang}.`,
    'The source can include protected markers such as {1>, <2}, {3}.',
    'Never translate, remove, reorder, renumber, or rewrite protected markers.',
    'Keep all tags, placeholders, and formatting exactly as they appear in the source.',
    'Return only the translated text, without quotes or extra commentary.',
    'Do not copy the source text unless it is already in the target language.',
  ];
}

function buildTranslationSourceHeader(srcLang: string, hasProtectedMarkers: boolean): string {
  if (hasProtectedMarkers) {
    return `Source (${srcLang}, protected-marker format):`;
  }
  return `Source (${srcLang}):`;
}

export function buildTranslationSystemPrompt(params: SystemPromptBuildParams): string {
  const trimmedProjectPrompt = params.projectPrompt?.trim();
  const base = buildTranslationBasePromptRules(params.srcLang, params.tgtLang).join('\n');

  if (!trimmedProjectPrompt) {
    return `You are a professional translator.\n${base}`;
  }

  return `${trimmedProjectPrompt}\n${base}`;
}

export function buildTranslationUserPrompt(params: UserPromptBuildParams): string {
  const userParts = [
    buildTranslationSourceHeader(params.srcLang, params.hasProtectedMarkers),
    params.sourcePayload,
  ];

  const contextText = typeof params.context === 'string' ? params.context.trim() : '';
  if (contextText) {
    userParts.push('', `Context: ${contextText}`);
  }

  if (params.tmReference) {
    userParts.push(
      '',
      'TM Reference (best match):',
      `- Similarity: ${params.tmReference.similarity}% | TM: ${params.tmReference.tmName}`,
      `- Source: ${params.tmReference.sourceText}`,
      `- Target: ${params.tmReference.targetText}`,
    );
  }

  if (params.tbReferences && params.tbReferences.length > 0) {
    userParts.push('', 'Terminology References (hit terms):');
    for (const reference of params.tbReferences) {
      const note = typeof reference.note === 'string' ? reference.note.trim() : '';
      const noteSuffix = note ? ` (note: ${note})` : '';
      userParts.push(`- ${reference.srcTerm} => ${reference.tgtTerm}${noteSuffix}`);
    }
  }

  if (params.validationFeedback) {
    userParts.push('', 'Validation feedback from previous attempt:', params.validationFeedback);
  }

  return userParts.join('\n');
}
