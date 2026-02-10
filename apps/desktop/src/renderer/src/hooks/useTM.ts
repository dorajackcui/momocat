import { useState, useEffect } from 'react';
import { TMMatch } from '../components/TMPanel';
import { apiClient } from '../services/apiClient';

export function useTM(activeSegmentSource: string | undefined) {
  const [matches, setMatches] = useState<TMMatch[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMatches = async () => {
      if (!activeSegmentSource) {
        setMatches([]);
        return;
      }

      setLoading(true);
      try {
        // Legacy hook: no active project context is available here.
        // Keep behavior non-breaking by returning no matches.
        setMatches([]);
      } catch (error) {
        console.error('TM search failed:', error);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchMatches, 300);
    return () => clearTimeout(timer);
  }, [activeSegmentSource]);

  const updateTM = async (source: string, target: string) => {
    void source;
    void target;
    try {
      // Deprecated legacy API path retained as a no-op to keep callers stable.
      await Promise.resolve();
    } catch (error) {
      console.error('Failed to update TM:', error);
    }
  };

  const importTM = async () => {
    try {
      // Legacy hook: no longer supported; keep return contract.
      void apiClient;
      return 0;
    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    }
  };

  return {
    matches,
    loading,
    updateTM,
    importTM,
  };
}
