import { useCallback, useEffect, useRef } from 'react';
import { setUrlState } from '../../lib/urlState.js';
import { useUrlSync } from './useUrlSync.js';

const setMetaTagContent = (attributeName, attributeValue, content) => {
  if (!content) return;
  const selector = `meta[${attributeName}="${attributeValue}"]`;
  let metaTag = document.head?.querySelector(selector);
  if (!metaTag) {
    metaTag = document.createElement('meta');
    metaTag.setAttribute(attributeName, attributeValue);
    document.head?.appendChild(metaTag);
  }
  metaTag.setAttribute('content', content);
};

const useAppRouting = ({
  baseTitle,
  currentPath,
  currentPathName,
  searchQuery,
  searchInputValue,
  setSearchInputValue,
  setSearchFocused,
  clearSearch,
  submitSearch,
  navigateTo,
  setLightboxOpen,
  lastBrowsePath,
  setLastBrowsePath
}) => {
  const searchStateRef = useRef({ searchQuery: '', searchInput: '' });

  useEffect(() => {
    searchStateRef.current.searchQuery = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    searchStateRef.current.searchInput = searchInputValue;
  }, [searchInputValue]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const pageTitle = searchQuery
      ? `${baseTitle} - Search for "${searchQuery}"`
      : (!currentPath ? baseTitle : `${baseTitle} - ${currentPathName}`);
    const description = baseTitle;
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const url = `${origin}${pathname}`;
    const image = `${origin}/icon-192.png`;

    document.title = pageTitle;
    setMetaTagContent('property', 'og:title', pageTitle);
    setMetaTagContent('property', 'og:description', description);
    setMetaTagContent('property', 'og:image', image);
    setMetaTagContent('property', 'og:url', url);
    setMetaTagContent('name', 'twitter:title', pageTitle);
    setMetaTagContent('name', 'twitter:description', description);
    setMetaTagContent('name', 'twitter:image', image);
  }, [baseTitle, currentPath, currentPathName, searchQuery]);

  const clearSearchState = useCallback((options = {}) => {
    const { focus = false } = options;
    setSearchInputValue('');
    setSearchFocused(focus);
    searchStateRef.current.searchInput = '';
    clearSearch();
  }, [clearSearch, setSearchFocused, setSearchInputValue]);

  const handleSearchValueChange = useCallback((value) => {
    setSearchInputValue(value);
    searchStateRef.current.searchInput = value;
  }, [setSearchInputValue]);

  const handleSearchFocusChange = useCallback((focused) => {
    setSearchFocused(focused);
  }, [setSearchFocused]);

  const setSearchInput = useCallback((value) => {
    setSearchInputValue(value);
    searchStateRef.current.searchInput = value;
  }, [setSearchInputValue]);

  const hasSearchState = useCallback(
    () => Boolean(searchQuery || searchInputValue.trim()),
    [searchInputValue, searchQuery]
  );

  const applySearch = useCallback((value) => {
    const trimmed = value.trim();
    if (trimmed) {
      const fallbackPath = currentPath ?? lastBrowsePath ?? '';
      setLastBrowsePath(fallbackPath || '');
    }
    submitSearch(trimmed);
    return trimmed;
  }, [currentPath, lastBrowsePath, setLastBrowsePath, submitSearch]);

  const handleSearchSubmit = useCallback((value) => {
    const trimmed = applySearch(value);
    setSearchFocused(Boolean(trimmed));
    if (trimmed) {
      setUrlState({ search: trimmed });
    } else {
      setUrlState({ path: currentPath, preview: '' });
    }
  }, [applySearch, currentPath, setSearchFocused]);

  const handleCloseSearch = useCallback(() => {
    const returnPath = lastBrowsePath ?? '';
    clearSearchState({ focus: Boolean(searchQuery) });
    void navigateTo(returnPath);
  }, [clearSearchState, lastBrowsePath, navigateTo, searchQuery]);

  useUrlSync({
    clearSearch: clearSearchState,
    setSearchInput,
    applySearch,
    navigateTo,
    setLightboxOpen,
    searchStateRef
  });

  return {
    searchStateRef,
    clearSearchState,
    handleSearchValueChange,
    handleSearchFocusChange,
    hasSearchState,
    handleSearchSubmit,
    handleCloseSearch
  };
};

export { useAppRouting };
