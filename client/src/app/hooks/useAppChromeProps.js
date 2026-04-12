import { useMemo } from 'react';

const useAppChromeProps = ({
  handleNavigateRoot,
  searchInputValue,
  searchQuery,
  isSearchFocused,
  handleSearchValueChange,
  handleSearchFocusChange,
  handleSearchSubmit,
  handleCloseSearch,
  handleToggleFooter,
  handleOpenSettings,
  isTreeHidden,
  footerOpen,
  status,
  lastGoodPath,
  currentPath,
  handleNavigate
}) => useMemo(() => ({
  onNavigateRoot: handleNavigateRoot,
  searchValue: searchInputValue,
  searchQuery,
  isSearchFocused,
  onSearchValueChange: handleSearchValueChange,
  onSearchFocusChange: handleSearchFocusChange,
  onSearchSubmit: handleSearchSubmit,
  onSearchClear: handleCloseSearch,
  onToggleFooter: handleToggleFooter,
  onOpenSettings: handleOpenSettings,
  showFooterToggle: !isTreeHidden,
  footerOpen,
  breadcrumbsPath: status.error ? lastGoodPath : currentPath,
  onNavigate: handleNavigate,
  isPathStale: Boolean(status.error)
}), [
  currentPath,
  footerOpen,
  handleCloseSearch,
  handleNavigate,
  handleNavigateRoot,
  handleOpenSettings,
  handleSearchFocusChange,
  handleSearchSubmit,
  handleSearchValueChange,
  handleToggleFooter,
  isSearchFocused,
  isTreeHidden,
  lastGoodPath,
  searchInputValue,
  searchQuery,
  status.error
]);

export { useAppChromeProps };
