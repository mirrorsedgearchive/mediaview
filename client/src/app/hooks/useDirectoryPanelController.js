import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useContextMenuContext,
  useDirectoryActionsContext,
  useDirectoryDataContext,
  useDownloadActionsContext,
  useDownloadStateContext,
  useSearchActionsContext,
  useSearchStateContext,
  useSelectionActionsContext,
  useSelectionStateContext,
  useViewContext,
} from '../contexts/index.js';

const rootLabel = 'Archive';
const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

const sortEntries = (entries, sortKey, sortDir) => {
  const list = Array.isArray(entries) ? [...entries] : [];
  if (!list.length) return list;

  list.sort((left, right) => {
    if (left.isDir !== right.isDir) return left.isDir ? -1 : 1;

    let compare = 0;
    if (sortKey === 'name') {
      compare = collator.compare(left.name || '', right.name || '');
    } else if (sortKey === 'size') {
      compare = (left.size || 0) - (right.size || 0);
    }

    if (compare === 0) {
      compare = collator.compare(left.name || '', right.name || '');
    }

    return sortDir === 'desc' ? -compare : compare;
  });

  return list;
};

const summarizeEntries = (entries, selectedPaths) => {
  let fileCount = 0;
  let selectedFileCount = 0;

  entries.forEach((entry) => {
    if (entry?.isDir) return;
    fileCount += 1;
    if (selectedPaths?.has(entry.path)) {
      selectedFileCount += 1;
    }
  });

  return {
    entryCount: entries.length,
    canSelectAllFiles: fileCount > 0 && selectedFileCount < fileCount,
  };
};

const buildTitleText = ({
  isSearchActive,
  isNotFound,
  hasError,
  isRoot,
  directory,
  currentPathName,
}) => {
  if (isSearchActive) return 'Search results';
  if (isNotFound) return 'Not found';
  if (hasError) return '';
  if (isRoot) return rootLabel;
  return directory?.current?.name || currentPathName || rootLabel;
};

const buildSubLabel = ({
  isSearchActive,
  searchLoading,
  searchQuery,
  searchError,
  searchCount,
  searchStatus,
  hasError,
  directory,
}) => {
  if (isSearchActive) {
    if (searchLoading) {
      return `Searching "${searchQuery}"...`;
    }
    if (searchError) {
      return 'Search failed';
    }

    const resultLabel = `${searchCount} result${searchCount === 1 ? '' : 's'} for "${searchQuery}"`;
    return searchStatus?.truncated ? `${resultLabel} (showing first ${searchCount})` : resultLabel;
  }

  if (hasError) return '';
  if (!directory) return 'Loading...';
  return `${directory.stats.dirs} folders, ${directory.stats.files} files`;
};

const useDirectoryPanelController = () => {
  const {
    directory,
    currentPath,
    currentPathName,
    status,
    lastGoodPath,
    entries,
    useWindowScroll,
  } = useDirectoryDataContext() || {};
  const { onNavigate, onSelect, onRetryList } = useDirectoryActionsContext() || {};
  const { viewMode, zoomLevel } = useViewContext();
  const {
    selectedPath,
    selectionMode,
    selectedPaths,
    selectedCount = 0,
  } = useSelectionStateContext() || {};
  const { onToggleSelection, onSetSelectionMode, onSelectAllFiles } =
    useSelectionActionsContext() || {};
  const { downloadState, downloadPrompt } = useDownloadStateContext() || {};
  const {
    onRequestDownload,
    onConfirmDownload,
    onCancelDownloadPrompt,
    onCancelDownload,
    onResetDownloadState,
  } = useDownloadActionsContext() || {};
  const {
    contextMenu,
    onOpenContextMenu,
    onCloseContextMenu,
    onContextSelect,
    onContextDownload,
    onContextShare,
    onContextCancelSelection,
    onContextGoToEntry,
  } = useContextMenuContext() || {};
  const { searchQuery, searchResults, searchStatus } = useSearchStateContext() || {};
  const { onRetrySearch, onClearSearch } = useSearchActionsContext() || {};
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const panelBodyRef = useRef(null);
  const [panelBodyNode, setPanelBodyNode] = useState(null);

  const hasError = Boolean(status?.error);
  const isNotFound = status?.code === 404;
  const isSearchActive = Boolean(searchQuery);
  const searchCount = searchResults?.length || 0;
  const searchLoading = isSearchActive && searchStatus?.loading;
  const searchError = isSearchActive && searchStatus?.error;
  const isRoot = !currentPath;
  const hasSelection = selectedCount > 0;
  const isDownloading =
    downloadState?.status === 'listing' ||
    downloadState?.status === 'downloading' ||
    downloadState?.status === 'finalizing';
  const hasDownloadStatus = Boolean(downloadState?.status) && downloadState.status !== 'idle';
  const progressMax = downloadState?.totalBytes || downloadState?.totalFiles || 1;
  const progressValue = downloadState?.totalBytes
    ? downloadState?.processedBytes
    : downloadState?.processedFiles;
  const contextMenuEntryPath =
    contextMenu?.open && contextMenu?.type === 'entry' ? contextMenu.entry?.path || '' : '';
  const contentKey = isSearchActive
    ? `search:${searchQuery || 'results'}:${searchStatus?.loading ? 'loading' : 'done'}:${searchCount}`
    : `path:${currentPath || 'root'}`;

  const sortedEntries = useMemo(
    () => sortEntries(entries, sortKey, sortDir),
    [entries, sortDir, sortKey]
  );

  const { entryCount, canSelectAllFiles } = useMemo(
    () => summarizeEntries(sortedEntries, selectedPaths),
    [selectedPaths, sortedEntries]
  );

  const titleText = useMemo(
    () =>
      buildTitleText({
        isSearchActive,
        isNotFound,
        hasError,
        isRoot,
        directory,
        currentPathName,
      }),
    [currentPathName, directory, hasError, isNotFound, isRoot, isSearchActive]
  );

  const subLabel = useMemo(
    () =>
      buildSubLabel({
        isSearchActive,
        searchLoading,
        searchQuery,
        searchError,
        searchCount,
        searchStatus,
        hasError,
        directory,
      }),
    [
      directory,
      hasError,
      isSearchActive,
      searchCount,
      searchError,
      searchLoading,
      searchQuery,
      searchStatus,
    ]
  );

  const handlePanelBodyRef = useCallback((node) => {
    panelBodyRef.current = node;
    setPanelBodyNode((prev) => (prev === node ? prev : node));
  }, []);

  const handleSortClick = useCallback(
    (key) => {
      if (sortKey === key) {
        setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        return;
      }

      setSortKey(key);
      setSortDir('asc');
    },
    [sortKey]
  );

  const handleEnableSelection = useCallback(() => {
    onSetSelectionMode?.(true);
  }, [onSetSelectionMode]);

  const handleCancelSelection = useCallback(() => {
    onSetSelectionMode?.(false);
  }, [onSetSelectionMode]);

  const handleSelectAllFiles = useCallback(() => {
    onSelectAllFiles?.(sortedEntries);
  }, [onSelectAllFiles, sortedEntries]);

  const handleContextSelectAllFiles = useCallback(() => {
    onSelectAllFiles?.(sortedEntries);
    onCloseContextMenu?.();
  }, [onCloseContextMenu, onSelectAllFiles, sortedEntries]);

  const handleDismissDownloadStatus = useCallback(() => {
    onSetSelectionMode?.(false);
    onResetDownloadState?.();
  }, [onResetDownloadState, onSetSelectionMode]);

  const handleNavigateRoot = useCallback(() => {
    onNavigate?.('');
  }, [onNavigate]);

  const handleNavigateLastGoodPath = useCallback(() => {
    onNavigate?.(lastGoodPath);
  }, [lastGoodPath, onNavigate]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (downloadPrompt?.open) {
        onCancelDownloadPrompt?.();
        return;
      }
      if (hasDownloadStatus) {
        if (isDownloading) {
          onCancelDownload?.();
          return;
        }
        handleDismissDownloadStatus();
        return;
      }
      if (selectionMode) {
        onSetSelectionMode?.(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    downloadPrompt,
    handleDismissDownloadStatus,
    hasDownloadStatus,
    isDownloading,
    onCancelDownload,
    onCancelDownloadPrompt,
    onSetSelectionMode,
    selectionMode,
  ]);

  useEffect(() => {
    if (isSearchActive) return;
    const panelBody = panelBodyRef.current;
    if (!panelBody) return;
    if (panelBody.scrollHeight > panelBody.clientHeight) {
      panelBody.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, [currentPath, isSearchActive]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isSearchActive || !useWindowScroll || selectionMode || selectedPath) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [currentPath, isSearchActive, selectedPath, selectionMode, useWindowScroll]);

  const headerProps = useMemo(
    () => ({
      selectionMode,
      titleText,
      subLabel,
      hasError,
      sortKey,
      sortDir,
      onSortClick: handleSortClick,
      onEnableSelection: handleEnableSelection,
      onCancelSelection: handleCancelSelection,
    }),
    [
      handleCancelSelection,
      handleEnableSelection,
      handleSortClick,
      hasError,
      selectionMode,
      sortDir,
      sortKey,
      subLabel,
      titleText,
    ]
  );

  const bodyProps = useMemo(
    () => ({
      handlePanelBodyRef,
      contextMenu,
      onCloseContextMenu,
      canSelectAllFiles,
      onContextSelectAllFiles: handleContextSelectAllFiles,
      onContextCancelSelection,
      onContextSelect,
      onContextDownload,
      onContextShare,
      onContextGoToEntry,
      isSearchActive,
      downloadPrompt,
      downloadSummary: downloadPrompt?.summary,
      onCancelDownloadPrompt,
      onConfirmDownload,
      showProgressModal: hasDownloadStatus,
      downloadState,
      progressValue,
      progressMax,
      onCancelDownload,
      onDismissDownloadStatus: handleDismissDownloadStatus,
      contentKey,
      searchLoading,
      searchError,
      searchStatus,
      searchCount,
      onRetrySearch,
      onClearSearch,
      status,
      isNotFound,
      onRetryList,
      onNavigate,
      onNavigateRoot: handleNavigateRoot,
      lastGoodPath,
      onNavigateLastGoodPath: handleNavigateLastGoodPath,
      rootLabel,
      entryCount,
      sortedEntries,
      viewMode,
      onSelect,
      selectedPath,
      selectionMode,
      selectedPaths,
      onToggleSelection,
      onOpenContextMenu,
      contextMenuEntryPath,
      zoomLevel,
      panelBodyNode,
      useWindowScroll,
    }),
    [
      canSelectAllFiles,
      contentKey,
      contextMenu,
      contextMenuEntryPath,
      downloadPrompt,
      downloadState,
      entryCount,
      handleContextSelectAllFiles,
      handleDismissDownloadStatus,
      handleNavigateLastGoodPath,
      handleNavigateRoot,
      handlePanelBodyRef,
      hasDownloadStatus,
      isNotFound,
      isSearchActive,
      lastGoodPath,
      onCancelDownload,
      onCancelDownloadPrompt,
      onClearSearch,
      onCloseContextMenu,
      onConfirmDownload,
      onContextCancelSelection,
      onContextDownload,
      onContextGoToEntry,
      onContextSelect,
      onContextShare,
      onNavigate,
      onOpenContextMenu,
      onRetryList,
      onRetrySearch,
      onSelect,
      onToggleSelection,
      panelBodyNode,
      progressMax,
      progressValue,
      searchCount,
      searchError,
      searchLoading,
      searchStatus,
      selectedPath,
      selectedPaths,
      selectionMode,
      sortedEntries,
      status,
      useWindowScroll,
      viewMode,
      zoomLevel,
    ]
  );

  const selectionBarProps = useMemo(
    () =>
      selectionMode
        ? {
            selectedCount,
            canSelectAllFiles,
            isDownloading,
            hasSelection,
            onCancelSelection: handleCancelSelection,
            onSelectAllFiles: handleSelectAllFiles,
            onRequestDownload,
          }
        : null,
    [
      canSelectAllFiles,
      handleCancelSelection,
      handleSelectAllFiles,
      hasSelection,
      isDownloading,
      onRequestDownload,
      selectedCount,
      selectionMode,
    ]
  );

  return {
    panelClassName: `panel list-panel${selectionMode ? ' selection-active' : ''}${hasError ? ' has-error' : ''}`,
    headerProps,
    bodyProps,
    selectionBarProps,
  };
};

export { useDirectoryPanelController };
