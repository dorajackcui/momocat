import { Token, TagMetadata, getTagDisplayInfo } from './index';

/**
 * TagManager Service
 * 
 * Central service for tag operations including insertion, deletion, movement,
 * and pairing. Implements an event emitter pattern to notify listeners of
 * tag state changes.
 * 
 * Events emitted:
 * - 'tagInserted': { tagIndex: number, tag: Token }
 * - 'tagDeleted': { tagIndex: number }
 * - 'tagMoved': { fromIndex: number, toPosition: number }
 */
export class TagManager {
  private listeners: Map<string, Function[]> = new Map();

  /**
   * Register an event handler for a specific event type
   * 
   * @param event - The event name to listen for
   * @param handler - The callback function to execute when the event is emitted
   * 
   * @example
   * tagManager.on('tagInserted', (data) => {
   *   console.log('Tag inserted at index:', data.tagIndex);
   * });
   */
  on(event: string, handler: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  /**
   * Emit an event to all registered handlers
   * 
   * @param event - The event name to emit
   * @param data - The data to pass to event handlers
   * 
   * @example
   * tagManager.emit('tagInserted', { tagIndex: 2, tag: newTag });
   */
  emit(event: string, data: any): void {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  /**
   * Insert a single tag at the specified cursor position
   * 
   * This method inserts a tag token into the target token array at the position
   * corresponding to the cursor position in the display text. It handles the
   * conversion from character position to token array index.
   * 
   * Tags are considered to have zero width for cursor positioning purposes.
   * When inserting at a position where tags already exist, the new tag is
   * inserted after all existing tags at that position.
   * 
   * @param targetTokens - The current array of target tokens
   * @param tagContent - The tag content to insert (e.g., "<bold>", "{1}")
   * @param cursorPosition - The character position in the display text where the tag should be inserted
   * @returns A new array of tokens with the tag inserted
   * 
   * @example
   * const tokens = [{ type: 'text', content: 'Hello world' }];
   * const newTokens = tagManager.insertTag(tokens, '<bold>', 6);
   * // Result: [
   * //   { type: 'text', content: 'Hello ' },
   * //   { type: 'tag', content: '<bold>', meta: { id: '<bold>' } },
   * //   { type: 'text', content: 'world' }
   * // ]
   * 
   * Emits: 'tagInserted' event with { tagIndex: number, tag: Token }
   */
  insertTag(targetTokens: Token[], tagContent: string, cursorPosition: number): Token[] {
    const newTag: Token = {
      type: 'tag',
      content: tagContent,
      meta: { id: tagContent }
    };
    
    // Handle empty array
    if (targetTokens.length === 0) {
      this.emit('tagInserted', { tagIndex: 0, tag: newTag });
      return [newTag];
    }
    
    // Find insertion point in token array based on cursor position
    // Tags have zero width, so we only count text tokens
    let charCount = 0;
    
    for (let i = 0; i < targetTokens.length; i++) {
      const token = targetTokens[i];
      
      // Skip tags - they don't contribute to cursor position
      if (token.type !== 'text') {
        continue;
      }
      
      const tokenLength = token.content.length;
      
      // Check if cursor is before this text token
      if (cursorPosition <= charCount) {
        // Insert before this token (and before any tags that precede it at this position)
        let insertIndex = i;
        // Move back past any tags
        while (insertIndex > 0 && targetTokens[insertIndex - 1].type === 'tag') {
          insertIndex--;
        }
        
        const newTokens = [...targetTokens];
        newTokens.splice(insertIndex, 0, newTag);
        this.emit('tagInserted', { tagIndex: insertIndex, tag: newTag });
        return newTokens;
      }
      
      // Check if cursor is within this text token
      if (cursorPosition < charCount + tokenLength) {
        const positionInToken = cursorPosition - charCount;
        
        // Split the text token
        const beforeText = token.content.substring(0, positionInToken);
        const afterText = token.content.substring(positionInToken);
        
        const newTokens = [...targetTokens];
        newTokens.splice(i, 1, 
          { type: 'text', content: beforeText },
          newTag,
          { type: 'text', content: afterText }
        );
        
        this.emit('tagInserted', { tagIndex: i + 1, tag: newTag });
        return newTokens;
      }
      
      // Check if cursor is right after this text token
      if (cursorPosition === charCount + tokenLength) {
        // Insert after this token and after any tags that follow it
        let insertIndex = i + 1;
        while (insertIndex < targetTokens.length && targetTokens[insertIndex].type === 'tag') {
          insertIndex++;
        }
        
        const newTokens = [...targetTokens];
        newTokens.splice(insertIndex, 0, newTag);
        this.emit('tagInserted', { tagIndex: insertIndex, tag: newTag });
        return newTokens;
      }
      
      charCount += tokenLength;
    }
    
    // If we get here, cursor is beyond all text - insert at end
    const newTokens = [...targetTokens];
    newTokens.push(newTag);
    this.emit('tagInserted', { tagIndex: newTokens.length - 1, tag: newTag });
    return newTokens;
  }

  /**
   * Delete a tag at the specified index
   * 
   * This method removes a tag token from the target token array at the given index.
   * The method validates that the index is valid and that the token at that index
   * is actually a tag before performing the deletion.
   * 
   * @param targetTokens - The current array of target tokens
   * @param tagIndex - The index of the tag to delete in the token array
   * @returns A new array of tokens with the tag removed
   * 
   * @example
   * const tokens = [
   *   { type: 'text', content: 'Hello ' },
   *   { type: 'tag', content: '<bold>' },
   *   { type: 'text', content: 'world' }
   * ];
   * const newTokens = tagManager.deleteTag(tokens, 1);
   * // Result: [
   * //   { type: 'text', content: 'Hello ' },
   * //   { type: 'text', content: 'world' }
   * // ]
   * 
   * Emits: 'tagDeleted' event with { tagIndex: number }
   */
  deleteTag(targetTokens: Token[], tagIndex: number): Token[] {
    // Validate index
    if (tagIndex < 0 || tagIndex >= targetTokens.length) {
      console.warn(`Invalid tag index: ${tagIndex}`);
      return targetTokens;
    }
    
    // Validate that the token at this index is actually a tag
    if (targetTokens[tagIndex].type !== 'tag') {
      console.warn(`Token at index ${tagIndex} is not a tag`);
      return targetTokens;
    }
    
    // Create new array without the tag at the specified index
    const newTokens = targetTokens.filter((_, i) => i !== tagIndex);
    
    // Emit event
    this.emit('tagDeleted', { tagIndex });
    
    return newTokens;
  }

  /**
   * Move a tag from one position to another in the token array
   * 
   * This method reorders tags via drag-and-drop operations. It removes the tag
   * from its current position (fromIndex) and inserts it at the new position
   * (toPosition). The method validates that the fromIndex points to a tag token
   * before performing the move.
   * 
   * Note: The toPosition is the final position where the tag should appear in
   * the resulting array. If toPosition > fromIndex, the position accounts for
   * the removal of the tag from fromIndex.
   * 
   * @param targetTokens - The current array of target tokens
   * @param fromIndex - The current index of the tag to move
   * @param toPosition - The target position where the tag should be moved
   * @returns A new array of tokens with the tag moved to the new position
   * 
   * @example
   * const tokens = [
   *   { type: 'tag', content: '<bold>' },
   *   { type: 'text', content: 'Hello' },
   *   { type: 'tag', content: '</bold>' },
   *   { type: 'text', content: ' world' }
   * ];
   * const newTokens = tagManager.moveTag(tokens, 0, 2);
   * // Result: [
   * //   { type: 'text', content: 'Hello' },
   * //   { type: 'tag', content: '<bold>' },
   * //   { type: 'tag', content: '</bold>' },
   * //   { type: 'text', content: ' world' }
   * // ]
   * 
   * Emits: 'tagMoved' event with { fromIndex: number, toPosition: number }
   */
  moveTag(targetTokens: Token[], fromIndex: number, toPosition: number): Token[] {
    // Validate fromIndex
    if (fromIndex < 0 || fromIndex >= targetTokens.length) {
      console.warn(`Invalid fromIndex: ${fromIndex}`);
      return targetTokens;
    }
    
    // Validate that the token at fromIndex is actually a tag
    if (targetTokens[fromIndex].type !== 'tag') {
      console.warn(`Token at index ${fromIndex} is not a tag`);
      return targetTokens;
    }
    
    // Validate toPosition
    if (toPosition < 0 || toPosition >= targetTokens.length) {
      console.warn(`Invalid toPosition: ${toPosition}`);
      return targetTokens;
    }
    
    // If fromIndex and toPosition are the same, no move needed
    if (fromIndex === toPosition) {
      return targetTokens;
    }
    
    // Create new array and perform the move
    const newTokens = [...targetTokens];
    const [movedTag] = newTokens.splice(fromIndex, 1);
    
    // Determine insertion position based on move direction and distance
    // When moving backward or to adjacent position forward: insert at toPosition
    // When moving forward by more than 1: insert at toPosition - 1 (to account for the removal)
    const insertPosition = toPosition <= fromIndex + 1 ? toPosition : toPosition - 1;
    
    newTokens.splice(insertPosition, 0, movedTag);
    
    // Emit event
    this.emit('tagMoved', { fromIndex, toPosition });
    
    return newTokens;
  }

  /**
   * Find the paired tag for a given tag index
   * 
   * This method locates the matching opening or closing tag for a paired tag.
   * For opening tags (e.g., `<bold>`), it finds the corresponding closing tag (e.g., `</bold>`).
   * For closing tags, it finds the corresponding opening tag.
   * For standalone tags (e.g., `{1}`, `<br/>`, `%s`), it returns undefined.
   * 
   * The method handles nested tags correctly by tracking nesting depth when searching
   * for the matching pair. For example, in `<b><i>text</i></b>`, the opening `<b>`
   * correctly pairs with the closing `</b>`, not the intermediate `</i>`.
   * 
   * @param tokens - The array of tokens to search within
   * @param tagIndex - The index of the tag to find a pair for
   * @returns The index of the paired tag, or undefined if no pair exists (standalone tag)
   * 
   * @example
   * const tokens = [
   *   { type: 'tag', content: '<bold>' },
   *   { type: 'text', content: 'Hello' },
   *   { type: 'tag', content: '</bold>' }
   * ];
   * 
   * const pairedIndex = tagManager.findPairedTag(tokens, 0);
   * // Returns: 2 (the closing tag)
   * 
   * const reversePairedIndex = tagManager.findPairedTag(tokens, 2);
   * // Returns: 0 (the opening tag)
   * 
   * @example
   * // Standalone tag
   * const tokens = [
   *   { type: 'tag', content: '{1}' },
   *   { type: 'text', content: 'Hello' }
   * ];
   * 
   * const pairedIndex = tagManager.findPairedTag(tokens, 0);
   * // Returns: undefined (standalone tag has no pair)
   * 
   * @example
   * // Nested tags
   * const tokens = [
   *   { type: 'tag', content: '<b>' },
   *   { type: 'tag', content: '<i>' },
   *   { type: 'text', content: 'text' },
   *   { type: 'tag', content: '</i>' },
   *   { type: 'tag', content: '</b>' }
   * ];
   * 
   * const pairedIndex = tagManager.findPairedTag(tokens, 0);
   * // Returns: 4 (the outer closing </b>, not the inner </i>)
   */
  findPairedTag(tokens: Token[], tagIndex: number): number | undefined {
    // Validate index
    if (tagIndex < 0 || tagIndex >= tokens.length) {
      console.warn(`Invalid tag index: ${tagIndex}`);
      return undefined;
    }
    
    const tag = tokens[tagIndex];
    
    // Validate that the token is actually a tag
    if (tag.type !== 'tag') {
      console.warn(`Token at index ${tagIndex} is not a tag`);
      return undefined;
    }
    
    // Check if this is a paired opening tag (e.g., <bold>, <italic>)
    const pairedStartMatch = tag.content.match(/^<([^/>]+)>$/);
    
    // Check if this is a paired closing tag (e.g., </bold>, </italic>)
    const pairedEndMatch = tag.content.match(/^<\/([^>]+)>$/);
    
    if (pairedStartMatch) {
      // This is an opening tag - find the corresponding closing tag
      const tagName = pairedStartMatch[1];
      const closingPattern = `</${tagName}>`;
      let nestingLevel = 0;
      
      // Search forward from the current position
      for (let i = tagIndex + 1; i < tokens.length; i++) {
        if (tokens[i].type !== 'tag') continue;
        
        const currentContent = tokens[i].content;
        
        // Check if this is another opening tag with the same name (nested)
        if (currentContent === tag.content) {
          nestingLevel++;
        }
        // Check if this is the closing tag we're looking for
        else if (currentContent === closingPattern) {
          if (nestingLevel === 0) {
            // Found the matching closing tag
            return i;
          } else {
            // This closes a nested tag, decrement nesting level
            nestingLevel--;
          }
        }
      }
      
      // No matching closing tag found
      return undefined;
    } else if (pairedEndMatch) {
      // This is a closing tag - find the corresponding opening tag
      const tagName = pairedEndMatch[1];
      const openingPattern = `<${tagName}>`;
      let nestingLevel = 0;
      
      // Search backward from the current position
      for (let i = tagIndex - 1; i >= 0; i--) {
        if (tokens[i].type !== 'tag') continue;
        
        const currentContent = tokens[i].content;
        
        // Check if this is another closing tag with the same name (nested)
        if (currentContent === tag.content) {
          nestingLevel++;
        }
        // Check if this is the opening tag we're looking for
        else if (currentContent === openingPattern) {
          if (nestingLevel === 0) {
            // Found the matching opening tag
            return i;
          } else {
            // This opens a nested tag, decrement nesting level
            nestingLevel--;
          }
        }
      }
      
      // No matching opening tag found
      return undefined;
    }
    
    // This is a standalone tag (e.g., {1}, <br/>, %s, %d)
    // Standalone tags have no pair
    return undefined;
  }

  /**
   * Get complete metadata for a tag token
   * 
   * This method combines display information from getTagDisplayInfo with pairing
   * information from findPairedTag to create a complete TagMetadata object for
   * any tag. The metadata includes the tag's index, type (paired-start, paired-end,
   * or standalone), pairing information, and display text.
   * 
   * The method is useful for UI components that need comprehensive information
   * about a tag to render it correctly with appropriate styling, tooltips, and
   * interaction handlers.
   * 
   * @param token - The tag token to get metadata for
   * @param index - The index of the tag in the token array
   * @param allTokens - The complete array of tokens containing this tag
   * @returns A TagMetadata object with complete tag information
   * 
   * @example
   * const tokens = [
   *   { type: 'tag', content: '<bold>' },
   *   { type: 'text', content: 'Hello' },
   *   { type: 'tag', content: '</bold>' }
   * ];
   * 
   * const metadata = tagManager.getTagMetadata(tokens[0], 0, tokens);
   * // Returns: {
   * //   index: 0,
   * //   type: 'paired-start',
   * //   pairedIndex: 2,
   * //   isPaired: true,
   * //   displayText: '[1'
   * // }
   * 
   * @example
   * // Standalone tag
   * const tokens = [
   *   { type: 'tag', content: '{1}' },
   *   { type: 'text', content: 'Hello' }
   * ];
   * 
   * const metadata = tagManager.getTagMetadata(tokens[0], 0, tokens);
   * // Returns: {
   * //   index: 0,
   * //   type: 'standalone',
   * //   pairedIndex: undefined,
   * //   isPaired: false,
   * //   displayText: '⟨1⟩'
   * // }
   */
  getTagMetadata(token: Token, index: number, allTokens: Token[]): TagMetadata {
    // Get display information for the tag
    const tagInfo = getTagDisplayInfo(token.content, index);
    
    // Find the paired tag index (if any)
    const pairedIndex = this.findPairedTag(allTokens, index);
    
    // Combine all information into TagMetadata
    return {
      index,
      type: tagInfo.type,
      pairedIndex,
      isPaired: pairedIndex !== undefined,
      displayText: tagInfo.display,
      validationState: token.meta?.validationState
    };
  }

  /**
   * Copy a tag's content for clipboard operations
   * 
   * This method returns the tag content as a string, suitable for copying
   * to the clipboard. The content can later be pasted and parsed back into
   * a tag token.
   * 
   * @param tag - The tag token to copy
   * @returns The tag content string
   * 
   * @example
   * const tag = { type: 'tag', content: '<bold>', meta: { id: '<bold>' } };
   * const copied = tagManager.copyTag(tag);
   * // Returns: '<bold>'
   */
  copyTag(tag: Token): string {
    return tag.content;
  }

  /**
   * Insert all source tags at the specified cursor position
   * 
   * This method inserts all tags from the source token array into the target
   * token array at the cursor position, preserving their original order and
   * spacing as they appear in the source.
   * 
   * @param targetTokens - The current array of target tokens
   * @param sourceTags - Array of tag tokens from the source segment
   * @param cursorPosition - The character position in the display text where tags should be inserted
   * @returns A new array of tokens with all tags inserted
   * 
   * @example
   * const targetTokens = [{ type: 'text', content: 'Bonjour monde' }];
   * const sourceTags = [
   *   { type: 'tag', content: '<bold>' },
   *   { type: 'tag', content: '</bold>' }
   * ];
   * const newTokens = tagManager.insertAllTags(targetTokens, sourceTags, 8);
   * // Result: [
   * //   { type: 'text', content: 'Bonjour ' },
   * //   { type: 'tag', content: '<bold>', meta: { id: '<bold>' } },
   * //   { type: 'tag', content: '</bold>', meta: { id: '</bold>' } },
   * //   { type: 'text', content: 'monde' }
   * // ]
   * 
   * Emits: 'tagInserted' event for each tag inserted
   */
  insertAllTags(targetTokens: Token[], sourceTags: Token[], cursorPosition: number): Token[] {
    if (sourceTags.length === 0) {
      return targetTokens;
    }
    
    // Find the insertion point once
    let charCount = 0;
    let insertIndex = 0;
    
    // Handle empty array
    if (targetTokens.length === 0) {
      // Insert all tags at the beginning
      const newTags = sourceTags.map(tag => ({
        type: 'tag' as const,
        content: tag.content,
        meta: { id: tag.content }
      }));
      
      newTags.forEach((tag, idx) => {
        this.emit('tagInserted', { tagIndex: idx, tag });
      });
      
      return newTags;
    }
    
    // Find insertion point based on cursor position
    for (let i = 0; i < targetTokens.length; i++) {
      const token = targetTokens[i];
      
      // Skip tags - they don't contribute to cursor position
      if (token.type !== 'text') {
        continue;
      }
      
      const tokenLength = token.content.length;
      
      // Check if cursor is before this text token
      if (cursorPosition <= charCount) {
        // Insert before this token (and before any tags that precede it at this position)
        insertIndex = i;
        while (insertIndex > 0 && targetTokens[insertIndex - 1].type === 'tag') {
          insertIndex--;
        }
        break;
      }
      
      // Check if cursor is within this text token
      if (cursorPosition < charCount + tokenLength) {
        const positionInToken = cursorPosition - charCount;
        
        // Split the text token and insert all tags in between
        const beforeText = token.content.substring(0, positionInToken);
        const afterText = token.content.substring(positionInToken);
        
        const newTags = sourceTags.map(tag => ({
          type: 'tag' as const,
          content: tag.content,
          meta: { id: tag.content }
        }));
        
        const newTokens = [...targetTokens];
        newTokens.splice(i, 1, 
          { type: 'text', content: beforeText },
          ...newTags,
          { type: 'text', content: afterText }
        );
        
        newTags.forEach((tag, idx) => {
          this.emit('tagInserted', { tagIndex: i + 1 + idx, tag });
        });
        
        return newTokens;
      }
      
      // Check if cursor is right after this text token
      if (cursorPosition === charCount + tokenLength) {
        // Insert after this token and after any tags that follow it
        insertIndex = i + 1;
        while (insertIndex < targetTokens.length && targetTokens[insertIndex].type === 'tag') {
          insertIndex++;
        }
        break;
      }
      
      charCount += tokenLength;
    }
    
    // If we get here without breaking, cursor is beyond all text - insert at end
    if (insertIndex === 0 && charCount < cursorPosition) {
      insertIndex = targetTokens.length;
    }
    
    // Insert all tags at the determined position
    const newTags = sourceTags.map(tag => ({
      type: 'tag' as const,
      content: tag.content,
      meta: { id: tag.content }
    }));
    
    const newTokens = [...targetTokens];
    newTokens.splice(insertIndex, 0, ...newTags);
    
    newTags.forEach((tag, idx) => {
      this.emit('tagInserted', { tagIndex: insertIndex + idx, tag });
    });
    
    return newTokens;
  }
}
