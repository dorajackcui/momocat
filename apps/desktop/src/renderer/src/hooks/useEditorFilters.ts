import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Segment, serializeTokensToEditorText } from '@cat/core';
import {
  EditorFilterCriteria,
  EditorMatchMode,
  EditorQualityFilter,
  EditorQuickPreset,
  EditorSortBy,
  EditorSortDirection,
  EditorStatusFilter,
  SearchableEditorSegment,
  countActiveFilterFields,
  createDefaultEditorFilterCriteria,
  filterSearchableSegments,
  getQuickPresetPatch,
  sortSearchableSegments,
} from '../components/editorFilterUtils';

const SEARCH_DEBOUNCE_MS = 120;
const FILTER_STATE_STORAGE_KEY_PREFIX = 'editor-filter-state:v1:file:';

export const FILTER_STATUS_OPTIONS: Array<{ value: EditorStatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'draft', label: 'Draft' },
  { value: 'confirmed', label: 'Confirmed' },
];

export const FILTER_MATCH_MODE_OPTIONS: Array<{ value: EditorMatchMode; label: string }> = [
  { value: 'contains', label: 'Contains' },
  { value: 'exact', label: 'Exact' },
  { value: 'regex', label: 'Regex' },
];

export const FILTER_QUALITY_OPTIONS: Array<{ value: EditorQualityFilter; label: string }> = [
  { value: 'qa_error', label: 'QA error' },
  { value: 'qa_warning', label: 'QA warning' },
  { value: 'save_error', label: 'Save error' },
];

export const FILTER_QUICK_PRESET_OPTIONS: Array<{ value: EditorQuickPreset; label: string }> = [
  { value: 'untranslated', label: '未翻译' },
  { value: 'confirmed', label: '已确认' },
  { value: 'issues', label: '有问题段' },
];

export const FILTER_SORT_OPTIONS: Array<{
  sortBy: EditorSortBy;
  sortDirection: EditorSortDirection;
  label: string;
}> = [
  { sortBy: 'default', sortDirection: 'asc', label: 'Default order' },
  { sortBy: 'source_length', sortDirection: 'asc', label: 'Source length: short to long' },
  { sortBy: 'source_length', sortDirection: 'desc', label: 'Source length: long to short' },
  { sortBy: 'target_length', sortDirection: 'asc', label: 'Target length: short to long' },
  { sortBy: 'target_length', sortDirection: 'desc', label: 'Target length: long to short' },
];

export interface UseEditorFiltersParams {
  fileId: number;
  segments: Segment[];
  segmentSaveErrors: Record<string, string>;
  activeSegmentId: string | null;
  setActiveSegmentId: (segmentId: string) => void;
}

interface PersistedFilterShape {
  sourceQuery: string;
  targetQuery: string;
  status: EditorStatusFilter;
  matchMode: EditorMatchMode;
  qualityFilters: EditorQualityFilter[];
  quickPreset: EditorQuickPreset;
  sortBy: EditorSortBy;
  sortDirection: EditorSortDirection;
}

const STATUS_VALUES = new Set(FILTER_STATUS_OPTIONS.map((item) => item.value));
const MATCH_MODE_VALUES = new Set(FILTER_MATCH_MODE_OPTIONS.map((item) => item.value));
const QUALITY_VALUES = new Set(FILTER_QUALITY_OPTIONS.map((item) => item.value));
const QUICK_PRESET_VALUES = new Set(FILTER_QUICK_PRESET_OPTIONS.map((item) => item.value));
const SORT_BY_VALUES = new Set<EditorSortBy>(['default', 'source_length', 'target_length']);
const SORT_DIRECTION_VALUES = new Set<EditorSortDirection>(['asc', 'desc']);

export function buildEditorFilterStorageKey(fileId: number): string {
  return `${FILTER_STATE_STORAGE_KEY_PREFIX}${fileId}`;
}

export function sanitizePersistedEditorFilterState(raw: unknown): EditorFilterCriteria {
  const defaults = createDefaultEditorFilterCriteria();
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  const parsed = raw as Partial<PersistedFilterShape>;
  const sourceQuery =
    typeof parsed.sourceQuery === 'string' ? parsed.sourceQuery : defaults.sourceQuery;
  const targetQuery =
    typeof parsed.targetQuery === 'string' ? parsed.targetQuery : defaults.targetQuery;
  const status = STATUS_VALUES.has(parsed.status as EditorStatusFilter)
    ? (parsed.status as EditorStatusFilter)
    : defaults.status;
  const matchMode = MATCH_MODE_VALUES.has(parsed.matchMode as EditorMatchMode)
    ? (parsed.matchMode as EditorMatchMode)
    : defaults.matchMode;
  const quickPreset = QUICK_PRESET_VALUES.has(parsed.quickPreset as EditorQuickPreset)
    ? (parsed.quickPreset as EditorQuickPreset)
    : defaults.quickPreset;
  const qualityFilters = Array.isArray(parsed.qualityFilters)
    ? parsed.qualityFilters.filter((value): value is EditorQualityFilter =>
        QUALITY_VALUES.has(value as EditorQualityFilter),
      )
    : defaults.qualityFilters;
  const sortBy = SORT_BY_VALUES.has(parsed.sortBy as EditorSortBy)
    ? (parsed.sortBy as EditorSortBy)
    : defaults.sortBy;
  const sortDirection = SORT_DIRECTION_VALUES.has(parsed.sortDirection as EditorSortDirection)
    ? (parsed.sortDirection as EditorSortDirection)
    : defaults.sortDirection;

  return {
    sourceQuery,
    targetQuery,
    status,
    matchMode,
    qualityFilters,
    quickPreset,
    sortBy,
    sortDirection,
  };
}

export function buildSearchableEditorSegments(
  segments: Segment[],
  segmentSaveErrors: Record<string, string>,
): SearchableEditorSegment[] {
  return segments.map((segment, index) => {
    const sourceText = serializeTokensToEditorText(segment.sourceTokens, segment.sourceTokens)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    const targetText = serializeTokensToEditorText(segment.targetTokens, segment.sourceTokens)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    const qaIssues = segment.qaIssues || [];
    const hasQaError = qaIssues.some((issue) => issue.severity === 'error');
    const hasQaWarning = qaIssues.some((issue) => issue.severity === 'warning');
    const hasSaveError = Boolean(segmentSaveErrors[segment.segmentId]);
    const isUntranslated = targetText.trim().length === 0;
    const hasIssue = hasQaError || hasQaWarning || hasSaveError;

    return {
      segment,
      originalIndex: index,
      sourceText,
      targetText,
      hasQaError,
      hasQaWarning,
      hasSaveError,
      isUntranslated,
      hasIssue,
    };
  });
}

export function useEditorFilters({
  fileId,
  segments,
  segmentSaveErrors,
  activeSegmentId,
  setActiveSegmentId,
}: UseEditorFiltersParams) {
  const [filterState, setFilterState] = useState<EditorFilterCriteria>(
    createDefaultEditorFilterCriteria,
  );
  const [debouncedSourceQuery, setDebouncedSourceQuery] = useState('');
  const [debouncedTargetQuery, setDebouncedTargetQuery] = useState('');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const filterStateHydratedRef = useRef(false);

  const searchableSegments = useMemo(
    () => buildSearchableEditorSegments(segments, segmentSaveErrors),
    [segments, segmentSaveErrors],
  );

  const effectiveCriteria = useMemo(
    () => ({
      ...filterState,
      sourceQuery: debouncedSourceQuery,
      targetQuery: debouncedTargetQuery,
    }),
    [filterState, debouncedSourceQuery, debouncedTargetQuery],
  );

  const matchedSegments = useMemo(
    () => filterSearchableSegments(searchableSegments, effectiveCriteria),
    [searchableSegments, effectiveCriteria],
  );

  const filteredSegments = useMemo(
    () => sortSearchableSegments(matchedSegments, filterState.sortBy, filterState.sortDirection),
    [matchedSegments, filterState.sortBy, filterState.sortDirection],
  );

  const activeFilterCount = countActiveFilterFields(filterState);
  const hasActiveFilter = activeFilterCount > 0 || filterState.sortBy !== 'default';

  const clearFilters = useCallback(() => {
    const defaults = createDefaultEditorFilterCriteria();
    setFilterState(defaults);
    setDebouncedSourceQuery(defaults.sourceQuery);
    setDebouncedTargetQuery(defaults.targetQuery);
    setIsFilterMenuOpen(false);
    setIsSortMenuOpen(false);
  }, []);

  const setSourceQueryInput = useCallback((value: string) => {
    setFilterState((prev) => ({ ...prev, sourceQuery: value }));
  }, []);

  const setTargetQueryInput = useCallback((value: string) => {
    setFilterState((prev) => ({ ...prev, targetQuery: value }));
  }, []);

  const handleStatusFilterChange = useCallback((nextStatus: EditorStatusFilter) => {
    setFilterState((prev) => ({
      ...prev,
      status: nextStatus,
      quickPreset: 'none',
    }));
  }, []);

  const handleMatchModeChange = useCallback((nextMode: EditorMatchMode) => {
    setFilterState((prev) => ({
      ...prev,
      matchMode: nextMode,
    }));
  }, []);

  const toggleQualityFilter = useCallback((quality: EditorQualityFilter) => {
    setFilterState((prev) => {
      const qualityFilters = prev.qualityFilters.includes(quality)
        ? prev.qualityFilters.filter((item) => item !== quality)
        : [...prev.qualityFilters, quality];
      return {
        ...prev,
        qualityFilters,
        quickPreset: 'none',
      };
    });
  }, []);

  const applyQuickPreset = useCallback((preset: EditorQuickPreset) => {
    const patch = getQuickPresetPatch(preset);
    setFilterState((prev) => ({
      ...prev,
      status: patch.status,
      qualityFilters: patch.qualityFilters,
      quickPreset: patch.quickPreset,
    }));
  }, []);

  const handleSortChange = useCallback(
    (sortBy: EditorSortBy, sortDirection: EditorSortDirection) => {
      setFilterState((prev) => ({
        ...prev,
        sortBy,
        sortDirection,
      }));
      setIsSortMenuOpen(false);
    },
    [],
  );

  const toggleFilterMenu = useCallback(() => {
    setIsFilterMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        setIsSortMenuOpen(false);
      }
      return next;
    });
  }, []);

  const toggleSortMenu = useCallback(() => {
    setIsSortMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        setIsFilterMenuOpen(false);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    filterStateHydratedRef.current = false;
    const defaults = createDefaultEditorFilterCriteria();
    const storageKey = buildEditorFilterStorageKey(fileId);

    const resetToDefault = () => {
      setFilterState(defaults);
      setDebouncedSourceQuery(defaults.sourceQuery);
      setDebouncedTargetQuery(defaults.targetQuery);
    };

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        resetToDefault();
      } else {
        const parsed = JSON.parse(raw) as unknown;
        const nextState = sanitizePersistedEditorFilterState(parsed);
        setFilterState(nextState);
        setDebouncedSourceQuery(nextState.sourceQuery);
        setDebouncedTargetQuery(nextState.targetQuery);
      }
    } catch (error) {
      console.warn('[useEditorFilters] Failed to hydrate filter state from localStorage', error);
      resetToDefault();
    } finally {
      filterStateHydratedRef.current = true;
      setIsFilterMenuOpen(false);
      setIsSortMenuOpen(false);
    }
  }, [fileId]);

  useEffect(() => {
    if (!isFilterMenuOpen && !isSortMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (filterMenuRef.current?.contains(target) || sortMenuRef.current?.contains(target)) return;
      setIsFilterMenuOpen(false);
      setIsSortMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFilterMenuOpen(false);
        setIsSortMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isFilterMenuOpen, isSortMenuOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSourceQuery(filterState.sourceQuery);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [filterState.sourceQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedTargetQuery(filterState.targetQuery);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [filterState.targetQuery]);

  useEffect(() => {
    if (!filterStateHydratedRef.current) return;
    const storageKey = buildEditorFilterStorageKey(fileId);

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(filterState));
    } catch (error) {
      console.warn('[useEditorFilters] Failed to persist filter state to localStorage', error);
    }
  }, [fileId, filterState]);

  useEffect(() => {
    if (filteredSegments.length === 0) return;
    if (
      activeSegmentId &&
      filteredSegments.some((item) => item.segment.segmentId === activeSegmentId)
    ) {
      return;
    }

    setActiveSegmentId(filteredSegments[0].segment.segmentId);
  }, [activeSegmentId, filteredSegments, setActiveSegmentId]);

  return {
    sourceQueryInput: filterState.sourceQuery,
    targetQueryInput: filterState.targetQuery,
    matchMode: filterState.matchMode,
    statusFilter: filterState.status,
    qualityFilters: filterState.qualityFilters,
    quickPreset: filterState.quickPreset,
    sortBy: filterState.sortBy,
    sortDirection: filterState.sortDirection,
    isFilterMenuOpen,
    isSortMenuOpen,
    filterMenuRef,
    sortMenuRef,
    filteredSegments,
    activeFilterCount,
    hasActiveFilter,
    toggleFilterMenu,
    toggleSortMenu,
    setSourceQueryInput,
    setTargetQueryInput,
    handleStatusFilterChange,
    handleMatchModeChange,
    toggleQualityFilter,
    applyQuickPreset,
    handleSortChange,
    clearFilters,
    debouncedSourceQuery,
    debouncedTargetQuery,
  };
}
