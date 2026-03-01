import { Segment, serializeTokensToDisplayText } from '@cat/core';
import type { AIBatchTargetScope } from '../../../../shared/ipc';

export function resolveBatchTargetScope(scope?: AIBatchTargetScope): AIBatchTargetScope {
  return scope === 'overwrite-non-confirmed' ? scope : 'blank-only';
}

export function isTranslatableSegment(segment: Segment, targetScope: AIBatchTargetScope): boolean {
  const sourceText = serializeTokensToDisplayText(segment.sourceTokens).trim();
  if (!sourceText) return false;
  if (segment.status === 'confirmed') return false;
  if (targetScope === 'overwrite-non-confirmed') return true;
  const existingTarget = serializeTokensToDisplayText(segment.targetTokens).trim();
  return existingTarget.length === 0;
}
