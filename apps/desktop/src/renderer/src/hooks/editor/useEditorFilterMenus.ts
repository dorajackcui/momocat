import { useCallback, useEffect, useRef, useState } from 'react';

export function useEditorFilterMenus() {
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const closeMenus = useCallback(() => {
    setIsFilterMenuOpen(false);
    setIsSortMenuOpen(false);
  }, []);

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
    if (!isFilterMenuOpen && !isSortMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (filterMenuRef.current?.contains(target) || sortMenuRef.current?.contains(target)) return;
      closeMenus();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenus();
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [closeMenus, isFilterMenuOpen, isSortMenuOpen]);

  return {
    isFilterMenuOpen,
    isSortMenuOpen,
    filterMenuRef,
    sortMenuRef,
    setIsFilterMenuOpen,
    setIsSortMenuOpen,
    toggleFilterMenu,
    toggleSortMenu,
    closeMenus,
  };
}
