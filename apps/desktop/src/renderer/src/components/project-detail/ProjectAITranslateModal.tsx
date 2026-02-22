import { useState } from 'react';
import type { AIBatchMode, AIBatchTargetScope } from '../../../../shared/ipc';
import { Button, Modal, Select } from '../ui';

export interface ProjectAITranslateSubmit {
  mode: AIBatchMode;
  targetScope: AIBatchTargetScope;
}

interface ProjectAITranslateModalProps {
  open: boolean;
  fileName: string | null;
  onClose: () => void;
  onConfirm: (options: ProjectAITranslateSubmit) => void;
}

export function ProjectAITranslateModal({
  open,
  fileName,
  onClose,
  onConfirm,
}: ProjectAITranslateModalProps) {
  const [mode, setMode] = useState<AIBatchMode>('default');
  const [targetScope, setTargetScope] = useState<AIBatchTargetScope>('blank-only');

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="AI Translate Options"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="soft"
            className="!bg-success-soft !text-success"
            onClick={() => onConfirm({ mode, targetScope })}
          >
            Start AI Translate
          </Button>
        </>
      }
    >
      <p className="text-xs text-text-muted">
        Configure AI translation for file: <span className="font-semibold">{fileName || '-'}</span>
      </p>

      <div className="space-y-3 mt-4">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-text-muted">Translation Scope</span>
          <Select
            aria-label="Translation Scope"
            value={targetScope}
            onChange={(event) => setTargetScope(event.target.value as AIBatchTargetScope)}
          >
            <option value="blank-only">Blank Segments Only</option>
            <option value="overwrite-non-confirmed">Overwrite Non-Confirmed Segments</option>
          </Select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-text-muted">Dialogue Mode</span>
          <Select
            aria-label="Dialogue Mode"
            value={mode}
            onChange={(event) => setMode(event.target.value as AIBatchMode)}
          >
            <option value="default">No</option>
            <option value="dialogue">Yes</option>
          </Select>
        </label>
      </div>

      <p className="text-[11px] text-text-faint mt-4">
        Confirmed segments are always skipped, even in overwrite mode.
      </p>
    </Modal>
  );
}
