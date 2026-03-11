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
  const { theme, setTheme, warnOnLargeFiles, setWarnOnLargeFiles } = useAppPreferences();
  const searchHeaderRef = useRef(null);
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
    const { selection, shouldLightbox } = await loadDirectoryRef.current(pathValue, {
      selectPath,
      openLightbox
    });
    setLightboxOpen(shouldLightbox);
    if (updateUrl) {
      setUrlState(
        {
          path: pathValue,
          preview: shouldLightbox && selection ? selection.name : ''
        },
        { replace: replaceUrl }
      );
    }
  }, [setLightboxOpen]);

  const {
    clearSearchState,
    handleSearchValueChange,
    hasSearchState,
    handleSearchSubmit,
    handleCloseSearch
  } = useAppRouting({
    baseTitle,
    currentPath,
    currentPathName,
    searchQuery,
    searchHeaderRef,
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

  const directoryDataValue = useMemo(() => ({
    directory,
    currentPath,
    currentPathName,
    status,
    lastGoodPath,
    entries: activeEntries,
    useWindowScroll: isTreeHidden
  }), [
    activeEntries,
    currentPath,
    currentPathName,
    directory,
    isTreeHidden,
    lastGoodPath,
    status
  ]);

  const directoryActionsValue = useMemo(() => ({
    onSelect: handleOpen,
    onNavigate: handleNavigate,
    onRetryList: handleRetryList
  }), [handleNavigate, handleOpen, handleRetryList]);

  const selectionStateValue = useMemo(() => ({
    selectedPath: selectionMode ? '' : (selected?.path || pendingSelectionPath),
    selectionMode,
    selectedPaths,
    selectedCount
  }), [
    pendingSelectionPath,
    selected,
    selectedCount,
    selectedPaths,
    selectionMode
  ]);

  const selectionActionsValue = useMemo(() => ({
    onToggleSelection: toggleSelection,
    onSetSelectionMode: setSelectionMode,
    onSelectAllFiles: handleSelectAllFiles
  }), [handleSelectAllFiles, setSelectionMode, toggleSelection]);

  const downloadStateValue = useMemo(() => ({
    downloadState,
    downloadPrompt
  }), [downloadPrompt, downloadState]);

  const downloadActionsValue = useMemo(() => ({
    onRequestDownload: handleRequestDownload,
    onConfirmDownload: handleConfirmDownload,
    onCancelDownloadPrompt: handleCancelDownloadPrompt,
    onCancelDownload: cancelDownload,
    onResetDownloadState: resetDownloadState
  }), [
    cancelDownload,
    handleCancelDownloadPrompt,
    handleConfirmDownload,
    handleRequestDownload,
    resetDownloadState
  ]);

  const contextMenuValue = useMemo(() => ({
    contextMenu,
    onOpenContextMenu: openContextMenu,
    onCloseContextMenu: closeContextMenu,
    onContextSelect: handleContextSelect,
    onContextDownload: handleContextDownload,
    onContextShare: handleContextShare,
    onContextCancelSelection: handleContextCancelSelection,
    onContextGoToEntry: handleContextGoToEntry
  }), [
    closeContextMenu,
    contextMenu,
    handleContextCancelSelection,
    handleContextDownload,
    handleContextShare,
    handleContextGoToEntry,
    handleContextSelect,
    openContextMenu
  ]);

  const searchStateValue = useMemo(() => ({
    searchQuery,
    searchResults,
    searchStatus
  }), [searchQuery, searchResults, searchStatus]);

  const searchActionsValue = useMemo(() => ({
    onRetrySearch: retrySearch,
    onClearSearch: handleCloseSearch
  }), [handleCloseSearch, retrySearch]);

  const viewValue = useMemo(() => ({
    viewMode,
    setViewMode,
    zoomLevel,
    setZoomLevel
  }), [setViewMode, setZoomLevel, viewMode, zoomLevel]);

  return {
    viewValue,
    appChromeProps: {
      onNavigateRoot: handleNavigateRoot,
      searchQuery,
      searchHeaderRef,
      onSearchValueChange: handleSearchValueChange,
      onSearchSubmit: handleSearchSubmit,
      onSearchClear: handleCloseSearch,
      onToggleFooter: handleToggleFooter,
      onOpenSettings: handleOpenSettings,
      showFooterToggle: !isTreeHidden,
      footerOpen,
      breadcrumbsPath: status.error ? lastGoodPath : currentPath,
      onNavigate: handleNavigate,
      isPathStale: Boolean(status.error)
    },
    providerValues: {
      directoryDataValue,
      directoryActionsValue,
      selectionStateValue,
      selectionActionsValue,
      downloadStateValue,
      downloadActionsValue,
      contextMenuValue,
      searchStateValue,
      searchActionsValue
    },
    panelsProps: {
      layoutRef,
      tree: treeData,
      treeCurrentPath: searchQuery ? null : currentPath,
      onToggleTree: handleToggle,
      onCollapseAll: collapseAll,
      onExpandCurrent: expandToCurrentPath,
      onNavigate: handleNavigate,
      treeStatus,
      onRetryTree: retryTree,
      onFooterOverlayClick: handleFooterOverlayClick
    },
    overlaysProps: {
      connectionLightboxProps: {
        open: showConnectionLightbox,
        onRetry: handleRetryConnection
      },
      lightboxProps: {
        open: lightboxOpen,
        selectedEntry,
        lightboxEntries,
        activeIndex: activeLightboxIndex,
        onClose: handleClose,
        onPrev: handlePrev,
        onNext: handleNext,
        onShareEntry: handleShareEntry,
        showSideNav: !isTreeHidden,
        showPath: true,
        onNavigatePath: handleNavigateFromLightbox,
        warnOnLargeFiles,
        onDisableLargeFileWarnings: () => setWarnOnLargeFiles(false)
      },
      settingsModalProps: {
        open: settingsOpen,
        onClose: handleCloseSettings,
        theme,
        onThemeChange: setTheme,
        warnOnLargeFiles,
        onWarnOnLargeFilesChange: setWarnOnLargeFiles
      },
      snackbarProps: {
        open: snackbar.open,
        message: snackbar.message,
        onClose: handleDismissSnackbar
      }
    },
    isTreeHidden,
    footerOpen
  };
};

export { useAppController };
