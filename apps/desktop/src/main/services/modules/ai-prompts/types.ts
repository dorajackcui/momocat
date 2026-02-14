export interface SystemPromptBuildParams {
  srcLang: string;
  tgtLang: string;
  projectPrompt?: string;
}

export interface UserPromptBuildParams {
  srcLang: string;
  sourcePayload: string;
  hasProtectedMarkers: boolean;
  context?: string;
  validationFeedback?: string;
}
