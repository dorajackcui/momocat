import { useState, useEffect } from 'react';
import { TMMatch } from '../components/TMPanel';

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
        if (window.api) {
          const results = await window.api.fuzzySearchTM(activeSegmentSource);
          setMatches(results);
        }
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
    try {
      if (window.api) {
        await window.api.updateTM(source, target);
      }
    } catch (error) {
      console.error('Failed to update TM:', error);
    }
  };

  const importTM = async () => {
    try {
      if (!window.api) return 0;
      const count = await window.api.importTM();
      return count;
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
