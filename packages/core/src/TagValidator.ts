import { Token, QaIssue, AutoFixSuggestion, ValidationResult } from './index';

/**
 * TagValidator Service
 * 
 * Validates tag integrity between source and target segments and provides
 * automatic fix suggestions for common tag errors. The validator checks for:
 * - Missing tags (tags in source but not in target)
 * - Extra tags (tags in target but not in source)
 * - Tag order mismatches (same tags but different sequence)
 * 
 * For each validation error, the service can generate an AutoFixSuggestion
 * that can be applied to automatically correct the issue.
 * 
 * @example
 * const validator = new TagValidator();
 * const result = validator.validate(sourceTokens, targetTokens);
 * 
 * if (result.issues.length > 0) {
 *   console.log('Validation errors:', result.issues);
 *   console.log('Available fixes:', result.suggestions);
 *   
 *   // Apply first suggestion
 *   if (result.suggestions.length > 0) {
 *     const fixedTokens = result.suggestions[0].apply(targetTokens);
 *   }
 * }
 */
export class TagValidator {
  /**
   * Validate tag integrity between source and target tokens
   * 
   * This method performs comprehensive tag validation by comparing the tags
   * in the source and target token arrays. It checks for:
   * 
   * 1. Missing tags: Tags present in source but absent in target
   * 2. Extra tags: Tags present in target but not in source
   * 3. Tag order: Tags present in both but in different sequence
   * 
   * The validation follows a priority order:
   * - Missing/extra tag errors are checked first (severity: error)
   * - Order mismatches are only checked if no missing/extra errors exist (severity: warning)
   * 
   * For each issue found, the method generates corresponding AutoFixSuggestion
   * objects that can be used to automatically correct the problem.
   * 
   * @param sourceTokens - The source segment tokens (reference)
   * @param targetTokens - The target segment tokens (to be validated)
   * @returns ValidationResult containing issues and fix suggestions
   * 
   * @example
   * // Missing tag scenario
   * const sourceTokens = [
   *   { type: 'text', content: 'Hello ' },
   *   { type: 'tag', content: '<bold>' },
   *   { type: 'text', content: 'world' },
   *   { type: 'tag', content: '</bold>' }
   * ];
   * const targetTokens = [
   *   { type: 'text', content: 'Bonjour monde' }
   * ];
   * 
   * const result = validator.validate(sourceTokens, targetTokens);
   * // result.issues: [{ ruleId: 'tag-missing', severity: 'error', message: '...' }]
   * // result.suggestions: [{ type: 'insert', description: '...', apply: Function }]
   * 
   * @example
   * // Extra tag scenario
   * const sourceTokens = [
   *   { type: 'text', content: 'Hello world' }
   * ];
   * const targetTokens = [
   *   { type: 'text', content: 'Bonjour ' },
   *   { type: 'tag', content: '<bold>' },
   *   { type: 'text', content: 'monde' },
   *   { type: 'tag', content: '</bold>' }
   * ];
   * 
   * const result = validator.validate(sourceTokens, targetTokens);
   * // result.issues: [{ ruleId: 'tag-extra', severity: 'error', message: '...' }]
   * // result.suggestions: [{ type: 'delete', description: '...', apply: Function }]
   * 
   * @example
   * // Tag order mismatch scenario
   * const sourceTokens = [
   *   { type: 'tag', content: '<bold>' },
   *   { type: 'text', content: 'Hello' },
   *   { type: 'tag', content: '</bold>' },
   *   { type: 'tag', content: '<italic>' },
   *   { type: 'text', content: 'world' },
   *   { type: 'tag', content: '</italic>' }
   * ];
   * const targetTokens = [
   *   { type: 'tag', content: '<italic>' },
   *   { type: 'text', content: 'Bonjour' },
   *   { type: 'tag', content: '</italic>' },
   *   { type: 'tag', content: '<bold>' },
   *   { type: 'text', content: 'monde' },
   *   { type: 'tag', content: '</bold>' }
   * ];
   * 
   * const result = validator.validate(sourceTokens, targetTokens);
   * // result.issues: [{ ruleId: 'tag-order', severity: 'warning', message: '...' }]
   * // result.suggestions: [{ type: 'reorder', description: '...', apply: Function }]
   * 
   * @example
   * // Valid scenario (no issues)
   * const sourceTokens = [
   *   { type: 'tag', content: '<bold>' },
   *   { type: 'text', content: 'Hello' },
   *   { type: 'tag', content: '</bold>' }
   * ];
   * const targetTokens = [
   *   { type: 'tag', content: '<bold>' },
   *   { type: 'text', content: 'Bonjour' },
   *   { type: 'tag', content: '</bold>' }
   * ];
   * 
   * const result = validator.validate(sourceTokens, targetTokens);
   * // result.issues: []
   * // result.suggestions: []
   */
  validate(sourceTokens: Token[], targetTokens: Token[]): ValidationResult {
    const issues: QaIssue[] = [];
    const suggestions: AutoFixSuggestion[] = [];
    
    // Extract tags from both source and target
    const sourceTags = sourceTokens.filter(t => t.type === 'tag');
    const targetTags = targetTokens.filter(t => t.type === 'tag');
    
    // Check for missing tags (in source but not in target)
    const missing = sourceTags.filter(st => 
      !targetTags.some(tt => tt.content === st.content)
    );
    
    if (missing.length > 0) {
      const issue: QaIssue = {
        ruleId: 'tag-missing',
        severity: 'error',
        message: `Missing tags: ${missing.map(t => t.content).join(', ')}`
      };
      issues.push(issue);
      
      // Generate auto-fix suggestion to insert missing tags
      suggestions.push({
        type: 'insert',
        description: `Insert missing tags: ${missing.map(t => t.content).join(', ')}`,
        apply: (targetTokens: Token[]) => {
          // Append missing tags at the end
          const result = [...targetTokens];
          for (const tag of missing) {
            result.push({
              type: 'tag',
              content: tag.content,
              meta: { id: tag.content }
            });
          }
          return result;
        }
      });
    }
    
    // Check for extra tags (in target but not in source)
    const extra = targetTags.filter(tt => 
      !sourceTags.some(st => st.content === tt.content)
    );
    
    if (extra.length > 0) {
      const issue: QaIssue = {
        ruleId: 'tag-extra',
        severity: 'error',
        message: `Extra tags found: ${extra.map(t => t.content).join(', ')}`
      };
      issues.push(issue);
      
      // Generate auto-fix suggestion to remove extra tags
      suggestions.push({
        type: 'delete',
        description: `Remove extra tags: ${extra.map(t => t.content).join(', ')}`,
        apply: (targetTokens: Token[]) => {
          // Filter out extra tags
          return targetTokens.filter(t => 
            t.type !== 'tag' || sourceTags.some(st => st.content === t.content)
          );
        }
      });
    }
    
    // Check for tag order mismatch (only if no missing/extra errors)
    if (issues.length === 0) {
      const sourceTagContents = sourceTags.map(t => t.content).join('|');
      const targetTagContents = targetTags.map(t => t.content).join('|');
      
      if (sourceTagContents !== targetTagContents) {
        const issue: QaIssue = {
          ruleId: 'tag-order',
          severity: 'warning',
          message: 'Tags are present but in a different order than source'
        };
        issues.push(issue);
        
        // Generate auto-fix suggestion to reorder tags
        suggestions.push({
          type: 'reorder',
          description: 'Reorder tags to match source sequence',
          apply: (targetTokens: Token[]) => {
            // This is a simplified implementation
            // A full implementation would need to preserve text positions
            // and only reorder the tags while keeping text intact
            // For now, return tokens unchanged as a placeholder
            return targetTokens;
          }
        });
      }
    }
    
    return { issues, suggestions };
  }

  /**
   * Generate an automatic fix suggestion for a specific QA issue
   * 
   * This method takes a QA issue and generates an appropriate AutoFixSuggestion
   * that can be applied to correct the problem. The method internally calls
   * validate() to get all suggestions and then finds the one that matches
   * the given issue's ruleId.
   * 
   * @param issue - The QA issue to generate a fix for
   * @param sourceTokens - The source segment tokens (reference)
   * @param targetTokens - The target segment tokens (to be fixed)
   * @returns An AutoFixSuggestion if one can be generated, null otherwise
   * 
   * @example
   * const issue = {
   *   ruleId: 'tag-missing',
   *   severity: 'error',
   *   message: 'Missing tags: <bold>, </bold>'
   * };
   * 
   * const suggestion = validator.generateAutoFix(issue, sourceTokens, targetTokens);
   * if (suggestion) {
   *   const fixedTokens = suggestion.apply(targetTokens);
   * }
   */
  generateAutoFix(
    issue: QaIssue, 
    sourceTokens: Token[], 
    targetTokens: Token[]
  ): AutoFixSuggestion | null {
    // Run validation to get all suggestions
    const result = this.validate(sourceTokens, targetTokens);
    
    // Find the suggestion that corresponds to this issue's ruleId
    // Map ruleId to suggestion type
    const ruleIdToType: Record<string, 'insert' | 'delete' | 'reorder'> = {
      'tag-missing': 'insert',
      'tag-extra': 'delete',
      'tag-order': 'reorder'
    };
    
    const expectedType = ruleIdToType[issue.ruleId];
    if (!expectedType) {
      return null;
    }
    
    // Find the matching suggestion
    return result.suggestions.find(s => s.type === expectedType) || null;
  }
}
