export interface SystemPromptBuildParams {
  srcLang: string;
  tgtLang: string;
  projectPrompt?: string;
}

export interface PromptTMReference {
  similarity: number;
  tmName: string;
  sourceText: string;
  targetText: string;
}

export interface PromptTBReference {
  srcTerm: string;
  tgtTerm: string;
  note?: string | null;
}

export interface UserPromptBuildParams {
  srcLang: string;
  sourcePayload: string;
  hasProtectedMarkers: boolean;
  context?: string;
  currentTranslationPayload?: string;
  refinementInstruction?: string;
  validationFeedback?: string;
  tmReference?: PromptTMReference;
  tbReferences?: PromptTBReference[];
}
