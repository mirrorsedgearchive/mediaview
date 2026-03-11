import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { IconClose, IconGear, IconInfoCircle, IconSearch, ViewToggle } from './index.js';
import { useViewContext } from '../contexts/index.js';

const AppHeader = forwardRef(({
  onNavigateRoot,
  searchQuery,
  onSearchValueChange,
  onSearchSubmit,
  onSearchClear,
  onToggleFooter,
  onOpenSettings,
  showFooterToggle,
  footerOpen
}, ref) => {
  const { viewMode, setViewMode, zoomLevel, setZoomLevel } = useViewContext();
  const inputRef = useRef(null);
  const [searchValue, setSearchValue] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchValueRef = useRef('');
  const hasSearchText = Boolean(searchValue.trim() || searchQuery);
  const isSearchOpen = isSearchFocused || hasSearchText;
  const showStaging = import.meta.env.VITE_SHOW_STAGING === 'true';

  useImperativeHandle(ref, () => ({
    setSearchValue: (value) => {
      searchValueRef.current = value;
      setSearchValue(value);
      onSearchValueChange?.(value);
    },
    getSearchValue: () => searchValueRef.current,
    setSearchFocused: (value) => {
      setIsSearchFocused(value);
      if (value) {
        inputRef.current?.focus();
      }
    }
  }), [onSearchValueChange]);

  useEffect(() => {
    if (isSearchFocused) {
      inputRef.current?.focus();
    }
  }, [isSearchFocused]);

  const handleSearchBlur = () => {
    if (!searchValue.trim() && !searchQuery) {
      setIsSearchFocused(false);
    }
  };

  const handleSearchOpen = () => {
    setIsSearchFocused(true);
    inputRef.current?.focus();
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    onSearchSubmit(searchValue);
    if (searchValue.trim()) {
      setIsSearchFocused(true);
    }
  };

  const handleSearchClear = () => {
    searchValueRef.current = '';
    setSearchValue('');
    onSearchValueChange?.('');
    onSearchClear?.();
    inputRef.current?.focus();
    if (!searchQuery) {
      setIsSearchFocused(false);
    }
  };

  return (
    <header className="topbar">
      <button
        type="button"
        className="brand"
        onClick={onNavigateRoot}
        aria-label="Go to archive root"
      >
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 1000 1000" role="img" aria-hidden="true">
            <path
              className="brand-mark-path"
              d="M2.834 97.434s4.5 87.038 271.204 353.74l-88.128 192.08 236.146-68.892 125.37 330.002L684.12 557.446h315.268s-126.598-166.16-416.9-236.144C292.18 252.272 133.932 210.392 2.832 97.434"            />
          </svg>
        </span>
        <div>
          <div className="brand-title">
            <p>The Mirror&apos;s Edge <b>Archive</b></p>
            {showStaging && <span className="brand-subtitle">STAGING</span>}
          </div>
        </div>
      </button>
      <div className={`topbar-controls ${isSearchOpen ? 'search-active' : 'search-collapsed'}`}>
        <form className="search" onSubmit={handleSearchSubmit}>
          <button type="button" className="search-toggle" onClick={handleSearchOpen}>
            <span className="search-icon" aria-hidden="true">
              <IconSearch />
            </span>
            <span className="search-label-full">Search the archive</span>
            <span className="search-label-short">Search</span>
          </button>
          <span className="search-icon desktop" aria-hidden="true">
            <IconSearch />
          </span>
          <input
            ref={inputRef}
            type="search"
            placeholder="Search the archive"
            value={searchValue}
            onChange={(event) => {
              const { value } = event.target;
              searchValueRef.current = value;
              setSearchValue(value);
              onSearchValueChange?.(value);
            }}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={handleSearchBlur}
          />
          <button
            type="button"
            className={`search-clear${hasSearchText ? '' : ' is-hidden'}`}
            onClick={handleSearchClear}
            aria-label="Close search results"
            title="Close search results"
          >
            <IconClose />
          </button>
        </form>
        {showFooterToggle && (
          <button
            type="button"
            className={`topbar-info${footerOpen ? ' is-active' : ''}`}
            onClick={onToggleFooter}
            aria-label="Info & legel"
            title="Info & legal"
          >
            <IconInfoCircle />
          </button>
        )}
        <button
          type="button"
          className="topbar-settings"
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
        >
          <IconGear />
        </button>
        <ViewToggle
          viewMode={viewMode}
          onChange={setViewMode}
          zoomLevel={zoomLevel}
          onZoomChange={setZoomLevel}
        />
      </div>
    </header>
  );
});

AppHeader.displayName = 'AppHeader';

export default AppHeader;
