import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBasename } from '../../lib/format.js';
import { setUrlState } from '../../lib/urlState.js';
import { buildPreviewUrlForEntry, copyToClipboard, tryNativeShare } from '../../lib/share.js';
import { useDirectoryData } from './useDirectoryData.js';
import { useBatchDownload } from './useBatchDownload.js';
import { useAppPreferences } from './useAppPreferences.js';
import { useAppRouting } from './useAppRouting.js';
import { useContextMenu } from './useContextMenu.js';
import { useDownloadPrompt } from './useDownloadPrompt.js';
import { useLightboxState } from './useLightboxState.js';
import { useMediaQuery } from './useMediaQuery.js';
import { useAppProviderValues } from './useAppProviderValues.js';
import { useAppChromeProps } from './useAppChromeProps.js';
import { useAppPanelsProps } from './useAppPanelsProps.js';
import { useAppOverlaysProps } from './useAppOverlaysProps.js';

const useAppController = () => {
  const {
    directory,
    currentPath,
    lastGoodPath,
    status,
    selection,
    tree,
    search,
    view,
    actions
  } = useDirectoryData();
  const { selected, setSelected, pendingSelection } = selection;
  const {
    data: treeData,
    status: treeStatus,
    handleToggle,
    collapseAll,
    expandToCurrentPath,
    retryTree
  } = tree;
  const {
    query: searchQuery,
    submit: submitSearch,
    clear: clearSearch,
    results: searchResults,
    status: searchStatus,
    retry: retrySearch
  } = search;
  const {
    mode: viewMode,
    setMode: setViewMode,
    zoom: zoomLevel,
    setZoom: setZoomLevel
  } = view;
  const { loadDirectory } = actions;
  const {
    selectionMode,
    selectedPaths,
    selectedCount,
    setSelectionMode,
    toggleSelection,
    setSelectionEntries,
    addSelectionEntries,
    discoverSelection,
    downloadSelection,
    cancelDownload,
    resetDownloadState,
    downloadState
  } = useBatchDownload();
  const [lastBrowsePath, setLastBrowsePath] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [footerOpen, setFooterOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchInputValue, setSearchInputValue] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const { theme, setTheme, warnOnLargeFiles, setWarnOnLargeFiles } = useAppPreferences();
  const layoutRef = useRef(null);
  const loadDirectoryRef = useRef(loadDirectory);
  const isSearchMode = Boolean(searchQuery);
  const baseTitle = "The Mirror's Edge Archive";
  const currentPathName = currentPath ? getBasename(currentPath) : 'Archive';
  const pendingSelectionPath = pendingSelection || '';
  const activeEntries = useMemo(() => (
    searchQuery
      ? searchResults
      : (directory?.entries || [])
  ), [directory?.entries, searchQuery, searchResults]);
  const isTreeHidden = useMediaQuery('(max-width: 1100px)');

  useEffect(() => {
    loadDirectoryRef.current = loadDirectory;
  }, [loadDirectory]);

  useEffect(() => {
    const layoutEl = layoutRef.current;
    if (!layoutEl) return undefined;
    if (!isTreeHidden && footerOpen) {
      layoutEl.setAttribute('data-footer-overlay', 'true');
    } else {
      layoutEl.removeAttribute('data-footer-overlay');
    }
    return undefined;
  }, [footerOpen, isTreeHidden]);

  const handleFooterOverlayClick = useCallback(() => {
    setFooterOpen(false);
  }, []);

  const handleToggleFooter = useCallback(() => {
    setFooterOpen((prev) => !prev);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const navigateTo = useCallback(async (pathValue, options = {}) => {
    const {
      selectPath = '',
      updateUrl = true,
      replaceUrl = false,
      openLightbox = true
    } = options;
    const { selection: nextSelection, shouldLightbox } = await loadDirectoryRef.current(pathValue, {
      selectPath,
      openLightbox
    });
    setLightboxOpen(shouldLightbox);
    if (updateUrl) {
      setUrlState(
        {
          path: pathValue,
          preview: shouldLightbox && nextSelection ? nextSelection.name : ''
        },
        { replace: replaceUrl }
      );
    }
  }, []);

  const {
    clearSearchState,
    handleSearchValueChange,
    handleSearchFocusChange,
    hasSearchState,
    handleSearchSubmit,
    handleCloseSearch
  } = useAppRouting({
    baseTitle,
    currentPath,
    currentPathName,
    searchQuery,
    searchInputValue,
    setSearchInputValue,
    setSearchFocused: setIsSearchFocused,
    clearSearch,
    submitSearch,
    navigateTo,
    setLightboxOpen,
    lastBrowsePath,
    setLastBrowsePath
  });

  const handleNavigate = useCallback((pathValue, options = {}) => {
    if (hasSearchState()) {
      clearSearchState();
    }
    return navigateTo(pathValue, options);
  }, [clearSearchState, hasSearchState, navigateTo]);

  const handleNavigateRoot = useCallback(() => {
    if (hasSearchState()) {
      clearSearchState();
    }
    void navigateTo('');
  }, [clearSearchState, hasSearchState, navigateTo]);

  const {
    selectedEntry,
    lightboxEntries,
    activeLightboxIndex,
    handleOpen,
    handleClose,
    handlePrev,
    handleNext,
    handleNavigateFromLightbox
  } = useLightboxState({
    entries: activeEntries,
    currentPath,
    isSearchMode,
    selected,
    setSelected,
    onNavigate: handleNavigate,
    lightboxOpen,
    setLightboxOpen
  });

  const {
    downloadPrompt,
    setDownloadPrompt,
    handleRequestDownload,
    handleConfirmDownload,
    handleCancelDownloadPrompt
  } = useDownloadPrompt({ discoverSelection, downloadSelection });

  const handleDismissSnackbar = useCallback(() => {
    setSnackbar({ open: false, message: '' });
  }, []);

  const showSnackbar = useCallback((message) => {
    setSnackbar({ open: true, message });
  }, []);

  const handleShareEntry = useCallback(async (entry) => {
    if (!entry?.path) return;
    const previewUrl = buildPreviewUrlForEntry(entry);
    const nativeShareResult = await tryNativeShare({
      title: entry.name || 'Shared file',
      url: previewUrl
    });
    if (nativeShareResult.shared || nativeShareResult.cancelled) return;
    try {
      await copyToClipboard(previewUrl);
      showSnackbar('Preview link copied to clipboard.');
    } catch {
      showSnackbar('Could not copy link to clipboard.');
    }
  }, [showSnackbar]);

  const {
    contextMenu,
    openContextMenu,
    closeContextMenu,
    handleContextSelect,
    handleContextDownload,
    handleContextShare,
    handleContextCancelSelection,
    handleContextGoToEntry
  } = useContextMenu({
    setSelectionMode,
    setSelectionEntries,
    discoverSelection,
    setDownloadPrompt,
    onNavigateToEntry: handleNavigateFromLightbox,
    onShareEntry: handleShareEntry
  });

  useEffect(() => {
    if (selectionMode) {
      setSelected(null);
    }
  }, [selectionMode, setSelected]);

  const handleSelectAllFiles = useCallback((entries) => {
    const filesInView = Array.isArray(entries)
      ? entries.filter((entry) => entry?.path && !entry.isDir)
      : [];
    setSelectionMode(true);
    addSelectionEntries(filesInView);
  }, [addSelectionEntries, setSelectionMode]);

  const handleRetryList = useCallback(() => {
    void loadDirectory(currentPath, { force: true });
  }, [currentPath, loadDirectory]);

  const handleRetryConnection = useCallback(() => {
    retryTree?.();
    void loadDirectory(currentPath, { force: true });
  }, [currentPath, loadDirectory, retryTree]);

  const showConnectionLightbox = (
    ((status.error && status.retryable) || (treeStatus.error && treeStatus.retryable))
    && !status.loading
    && !treeStatus.loading
  );

  const { viewValue, providerValues } = useAppProviderValues({
    directory,
    currentPath,
    currentPathName,
    status,
    lastGoodPath,
    activeEntries,
    isTreeHidden,
    handleOpen,
    handleNavigate,
    handleRetryList,
    selectionMode,
    selected,
    pendingSelectionPath,
    selectedPaths,
    selectedCount,
    toggleSelection,
    setSelectionMode,
    handleSelectAllFiles,
    downloadState,
    downloadPrompt,
    handleRequestDownload,
    handleConfirmDownload,
    handleCancelDownloadPrompt,
    cancelDownload,
    resetDownloadState,
    contextMenu,
    openContextMenu,
    closeContextMenu,
    handleContextSelect,
    handleContextDownload,
    handleContextShare,
    handleContextCancelSelection,
    handleContextGoToEntry,
    searchQuery,
    searchResults,
    searchStatus,
    retrySearch,
    handleCloseSearch,
    viewMode,
    setViewMode,
    zoomLevel,
    setZoomLevel
  });

  const appChromeProps = useAppChromeProps({
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
  });

  const panelsProps = useAppPanelsProps({
    layoutRef,
    treeData,
    searchQuery,
    currentPath,
    handleToggle,
    collapseAll,
    expandToCurrentPath,
    handleNavigate,
    treeStatus,
    retryTree,
    handleFooterOverlayClick
  });

  const overlaysProps = useAppOverlaysProps({
    showConnectionLightbox,
    handleRetryConnection,
    lightboxOpen,
    selectedEntry,
    lightboxEntries,
    activeLightboxIndex,
    handleClose,
    handlePrev,
    handleNext,
    handleShareEntry,
    isTreeHidden,
    handleNavigateFromLightbox,
    warnOnLargeFiles,
    setWarnOnLargeFiles,
    settingsOpen,
    handleCloseSettings,
    theme,
    setTheme,
    snackbar,
    handleDismissSnackbar
  });

  return {
    viewValue,
    appChromeProps,
    providerValues,
    panelsProps,
    overlaysProps,
    isTreeHidden,
    footerOpen
  };
};

export { useAppController };
