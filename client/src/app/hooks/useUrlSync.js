import { useEffect, useRef } from 'react';
import { readUrlState } from '../../lib/urlState.js';

export const useUrlSync = ({
  clearSearch,
  setSearchInput,
  applySearch,
  navigateTo,
  setLightboxOpen,
  searchStateRef,
}) => {
  const callbacksRef = useRef({
    clearSearch,
    setSearchInput,
    applySearch,
    navigateTo,
    setLightboxOpen,
    searchStateRef,
  });

  useEffect(() => {
    callbacksRef.current = {
      clearSearch,
      setSearchInput,
      applySearch,
      navigateTo,
      setLightboxOpen,
      searchStateRef,
    };
  }, [applySearch, clearSearch, navigateTo, searchStateRef, setLightboxOpen, setSearchInput]);

  useEffect(() => {
    const applyUrlState = () => {
      const {
        clearSearch: currentClearSearch,
        setSearchInput: currentSetSearchInput,
        applySearch: currentApplySearch,
        navigateTo: currentNavigateTo,
        setLightboxOpen: currentSetLightboxOpen,
        searchStateRef: currentSearchStateRef,
      } = callbacksRef.current;
      const urlState = readUrlState();
      if (urlState.search) {
        currentSetSearchInput(urlState.search);
        currentApplySearch(urlState.search);
        currentSetLightboxOpen(false);
        return;
      }
      const { searchQuery: currentQuery, searchInput: currentInput } =
        currentSearchStateRef.current;
      if (currentQuery || currentInput.trim()) {
        currentClearSearch();
      }
      const derivedPath = urlState.path;
      void currentNavigateTo(derivedPath, {
        selectPath: urlState.preview,
        updateUrl: false,
        fromUrl: true,
      });
    };
    applyUrlState();
    const handlePop = () => applyUrlState();
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);
};
