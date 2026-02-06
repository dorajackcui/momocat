import { Token } from './index';

/**
 * TagNavigator Service
 * 
 * Handles keyboard navigation between tags in a segment.
 * Provides methods to navigate forward/backward through tags with wrap-around support.
 * 
 * Requirements: 3.1, 3.2
 */
export class TagNavigator {
  /**
   * Get all indices of tag tokens in a token array
   * 
   * @param tokens - Array of tokens to search
   * @returns Array of indices where tokens are of type 'tag'
   * 
   * @example
   * const tokens = [
   *   { type: 'text', content: 'Hello ' },
   *   { type: 'tag', content: '<bold>' },
   *   { type: 'text', content: 'world' },
   *   { type: 'tag', content: '</bold>' }
   * ];
   * const navigator = new TagNavigator();
   * navigator.getTagIndices(tokens); // Returns [1, 3]
   */
  getTagIndices(tokens: Token[]): number[] {
    return tokens
      .map((token, index) => token.type === 'tag' ? index : -1)
      .filter(index => index !== -1);
  }

  /**
   * Focus the next tag after the current position
   * 
   * Finds the next tag index after currentIndex. If no tag exists after
   * the current position, wraps around to the first tag.
   * 
   * @param currentIndex - Current cursor/focus position in the token array
   * @param tokens - Array of tokens to navigate
   * @returns Index of the next tag, or currentIndex if no tags exist
   * 
   * @example
   * const tokens = [
   *   { type: 'tag', content: '{1}' },
   *   { type: 'text', content: 'Hello' },
   *   { type: 'tag', content: '{2}' }
   * ];
   * const navigator = new TagNavigator();
   * navigator.focusNextTag(0, tokens); // Returns 2
   * navigator.focusNextTag(2, tokens); // Returns 0 (wraps around)
   */
  focusNextTag(currentIndex: number, tokens: Token[]): number {
    const tagIndices = this.getTagIndices(tokens);
    if (tagIndices.length === 0) return currentIndex;
    
    // Find next tag after current position
    const nextIndex = tagIndices.find(i => i > currentIndex);
    
    // Wrap to first tag if at end
    return nextIndex !== undefined ? nextIndex : tagIndices[0];
  }

  /**
   * Focus the previous tag before the current position
   * 
   * Finds the previous tag index before currentIndex. If no tag exists before
   * the current position, wraps around to the last tag.
   * 
   * @param currentIndex - Current cursor/focus position in the token array
   * @param tokens - Array of tokens to navigate
   * @returns Index of the previous tag, or currentIndex if no tags exist
   * 
   * @example
   * const tokens = [
   *   { type: 'tag', content: '{1}' },
   *   { type: 'text', content: 'Hello' },
   *   { type: 'tag', content: '{2}' }
   * ];
   * const navigator = new TagNavigator();
   * navigator.focusPreviousTag(2, tokens); // Returns 0
   * navigator.focusPreviousTag(0, tokens); // Returns 2 (wraps around)
   */
  focusPreviousTag(currentIndex: number, tokens: Token[]): number {
    const tagIndices = this.getTagIndices(tokens);
    if (tagIndices.length === 0) return currentIndex;
    
    // Find previous tag before current position
    // Reverse the array to find the last tag before current position
    const reversedIndices = [...tagIndices].reverse();
    const prevIndex = reversedIndices.find(i => i < currentIndex);
    
    // Wrap to last tag if at beginning
    return prevIndex !== undefined ? prevIndex : tagIndices[tagIndices.length - 1];
  }
}
