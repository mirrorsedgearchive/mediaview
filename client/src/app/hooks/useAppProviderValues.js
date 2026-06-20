import { useMemo } from 'react';

const useAppProviderValues = ({
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
  setZoomLevel,
}) => {
  const directoryDataValue = useMemo(
    () => ({
      directory,
      currentPath,
      currentPathName,
      status,
      lastGoodPath,
      entries: activeEntries,
      useWindowScroll: isTreeHidden,
    }),
    [activeEntries, currentPath, currentPathName, directory, isTreeHidden, lastGoodPath, status]
  );

  const directoryActionsValue = useMemo(
    () => ({
      onSelect: handleOpen,
      onNavigate: handleNavigate,
      onRetryList: handleRetryList,
    }),
    [handleNavigate, handleOpen, handleRetryList]
  );

  const selectionStateValue = useMemo(
    () => ({
      selectedPath: selectionMode ? '' : selected?.path || pendingSelectionPath,
      selectionMode,
      selectedPaths,
      selectedCount,
    }),
    [pendingSelectionPath, selected, selectedCount, selectedPaths, selectionMode]
  );

  const selectionActionsValue = useMemo(
    () => ({
      onToggleSelection: toggleSelection,
      onSetSelectionMode: setSelectionMode,
      onSelectAllFiles: handleSelectAllFiles,
    }),
    [handleSelectAllFiles, setSelectionMode, toggleSelection]
  );

  const downloadStateValue = useMemo(
    () => ({
      downloadState,
      downloadPrompt,
    }),
    [downloadPrompt, downloadState]
  );

  const downloadActionsValue = useMemo(
    () => ({
      onRequestDownload: handleRequestDownload,
      onConfirmDownload: handleConfirmDownload,
      onCancelDownloadPrompt: handleCancelDownloadPrompt,
      onCancelDownload: cancelDownload,
      onResetDownloadState: resetDownloadState,
    }),
    [
      cancelDownload,
      handleCancelDownloadPrompt,
      handleConfirmDownload,
      handleRequestDownload,
      resetDownloadState,
    ]
  );

  const contextMenuValue = useMemo(
    () => ({
      contextMenu,
      onOpenContextMenu: openContextMenu,
      onCloseContextMenu: closeContextMenu,
      onContextSelect: handleContextSelect,
      onContextDownload: handleContextDownload,
      onContextShare: handleContextShare,
      onContextCancelSelection: handleContextCancelSelection,
      onContextGoToEntry: handleContextGoToEntry,
    }),
    [
      closeContextMenu,
      contextMenu,
      handleContextCancelSelection,
      handleContextDownload,
      handleContextShare,
      handleContextGoToEntry,
      handleContextSelect,
      openContextMenu,
    ]
  );

  const searchStateValue = useMemo(
    () => ({
      searchQuery,
      searchResults,
      searchStatus,
    }),
    [searchQuery, searchResults, searchStatus]
  );

  const searchActionsValue = useMemo(
    () => ({
      onRetrySearch: retrySearch,
      onClearSearch: handleCloseSearch,
    }),
    [handleCloseSearch, retrySearch]
  );

  const viewValue = useMemo(
    () => ({
      viewMode,
      setViewMode,
      zoomLevel,
      setZoomLevel,
    }),
    [setViewMode, setZoomLevel, viewMode, zoomLevel]
  );

  return {
    viewValue,
    providerValues: {
      directoryDataValue,
      directoryActionsValue,
      selectionStateValue,
      selectionActionsValue,
      downloadStateValue,
      downloadActionsValue,
      contextMenuValue,
      searchStateValue,
      searchActionsValue,
    },
  };
};

export { useAppProviderValues };
