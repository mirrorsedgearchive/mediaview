import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatSize } from '../../lib/format.js';
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
  useViewContext
} from '../contexts/index.js';
import {
  FileList,
  IconCheck2Square,
  IconCheckCircleFill,
  IconClose,
  IconDownload,
  IconFolder,
  IconFolderX,
  IconFolderOpen,
  IconShare,
  IconSearch,
  SortButtons
} from './index.js';

const DownloadConfirmModal = ({ summary, onCancel, onConfirm }) => {
  const warning = summary?.writerMode === 'memory'
    ? 'Your browser does not support streaming this download. If the download stalls, try a smaller set or another browser.'
    : '';

  return (
    <>
      <button
        type="button"
        className="download-modal-backdrop"
        onClick={onCancel}
        aria-label="Close download confirmation"
      />
      <div
        className="download-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-modal-title"
      >
        <div className="download-modal-header">
          <div className="download-modal-title" id="download-modal-title">
            Ready to download
          </div>
          <div className="download-modal-sub">
            Review your selection and start the download.
          </div>
        </div>
        <div className="download-modal-body">
          <div className="download-modal-row">
            <span>Items</span>
            <strong>{summary.totalFiles}</strong>
          </div>
          <div className="download-modal-row">
            <span>Total size</span>
            <strong>{formatSize(summary.totalBytes)}</strong>
          </div>
          {warning && (
            <div className="download-modal-warning">{warning}</div>
          )}
        </div>
        <div className="download-modal-actions">
          <button
            type="button"
            className="download-modal-btn is-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="download-modal-btn"
            onClick={onConfirm}
          >
            Download
          </button>
        </div>
      </div>
    </>
  );
};

const DownloadProgressModal = ({
  state,
  progressValue,
  progressMax,
  onCancel,
  onDismiss
}) => (
  <>
    {state.status === 'listing'
      || state.status === 'downloading'
      || state.status === 'finalizing' ? (
        <div className="download-progress-backdrop" aria-hidden="true" />
      ) : (
        <button
          type="button"
          className="download-progress-backdrop"
          onClick={onDismiss}
          aria-label="Close download status"
        />
      )}
    <div
      className="download-progress-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="download-progress-title"
    >
      <div className="download-progress-header">
        <div className="download-progress-title" id="download-progress-title">
          {state.status === 'listing' && 'Preparing download'}
          {state.status === 'downloading' && 'Downloading files'}
          {state.status === 'finalizing' && 'Finishing download'}
          {state.status === 'warning' && 'Download finished with warnings'}
          {state.status === 'done' && 'Download complete'}
          {state.status === 'error' && 'Download failed'}
          {state.status === 'cancelled' && 'Download cancelled'}
        </div>
        <div className="download-progress-sub">
          {(state.status === 'listing'
            || state.status === 'downloading'
            || state.status === 'finalizing')
            ? 'Preparing your selected files, please wait.'
            : 'You can close this window when you are ready.'}
        </div>
      </div>
      <div className="download-progress-body">
        {state.status === 'listing' && (
          <div className="download-progress-meta">
            <span>{state.processedDirs} folders scanned</span>
            <span>{state.queuedDirs} remaining</span>
          </div>
        )}
        {state.status === 'downloading' && (
          <>
            <div className="download-progress-meta">
              <span>
                {state.processedFiles} / {state.totalFiles} files
              </span>
              {state.totalBytes > 0 && (
                <span>
                  {formatSize(state.processedBytes)} / {formatSize(state.totalBytes)}
                </span>
              )}
            </div>
            <progress value={progressValue} max={progressMax} />
            {state.currentFile && (
              <div className="download-progress-file">{state.currentFile}</div>
            )}
          </>
        )}
        {state.status === 'finalizing' && (
          <div className="download-progress-meta">
            Wrapping up your download...
          </div>
        )}
        {(state.status === 'warning'
          || state.status === 'done'
          || state.status === 'error'
          || state.status === 'cancelled') && (
          <div className="download-progress-meta">
            {state.status === 'warning' && 'The download finished, but some items may be missing.'}
            {state.status === 'done' && 'Your files are saved to the selected download location.'}
            {state.status === 'error' && 'Could not not finish the download. Please try again.'}
            {state.status === 'cancelled' && 'The download was cancelled.'}
          </div>
        )}
        {state.warning && state.status !== 'done' && (
          <div className="download-modal-warning">{state.warning}</div>
        )}
        {state.error && (
          <div className="download-modal-warning">{state.error}</div>
        )}
      </div>
      <div className="download-progress-actions">
        {(state.status === 'listing'
          || state.status === 'downloading'
          || state.status === 'finalizing') ? (
          <button type="button" className="download-modal-btn is-secondary" onClick={onCancel}>
            Cancel download
          </button>
        ) : (
          <button type="button" className="download-modal-btn" onClick={onDismiss}>
            Close
          </button>
        )}
      </div>
    </div>
  </>
);

const DirectoryPanelHeader = ({
  selectionMode,
  titleText,
  subLabel,
  hasError,
  canSelectAllFiles,
  sortKey,
  sortDir,
  onSortClick,
  onSetSelectionMode,
  onSelectAllFiles
}) => (
  <div className="panel-header">
    <div>
      {selectionMode && (
        <span className="panel-header-icon" aria-hidden="true">
          <IconCheck2Square />
        </span>
      )}
      <span className="panel-title">{titleText}</span>
      <span className="panel-sub">{subLabel}</span>
    </div>
    <div className="panel-actions">
      {!hasError && (
        <>
          {selectionMode ? (
            <>
              <button
                type="button"
                className="panel-action-btn"
                onClick={onSelectAllFiles}
                disabled={!canSelectAllFiles}
              >
                <IconCheckCircleFill />
                Select all files
              </button>
              <button
                type="button"
                className="panel-action-btn is-emphasis"
                onClick={() => onSetSelectionMode(false)}
              >
                <IconClose />
                Cancel selection
              </button>
            </>
          ) : (
            <button
              type="button"
              className="panel-action-btn"
              onClick={() => onSetSelectionMode(true)}
            >
              <IconCheck2Square />
              Select
            </button>
          )}
          <SortButtons sortKey={sortKey} sortDir={sortDir} onSortClick={onSortClick} />
        </>
      )}
    </div>
  </div>
);

const DirectoryPanelBody = ({
  handlePanelBodyRef,
  contextMenu,
  onCloseContextMenu,
  canSelectAllFiles,
  onContextSelectAllFiles,
  onContextCancelSelection,
  onContextSelect,
  onContextDownload,
  onContextShare,
  onContextGoToEntry,
  isSearchActive,
  downloadPrompt,
  downloadSummary,
  onCancelDownloadPrompt,
  onConfirmDownload,
  showProgressModal,
  downloadState,
  progressValue,
  progressMax,
  onCancelDownload,
  onSetSelectionMode,
  onResetDownloadState,
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
  lastGoodPath,
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
  zoomLevel,
  panelBodyNode,
  useWindowScroll,
  contextMenuEntryPath
}) => (
  <div className="panel-body" ref={handlePanelBodyRef}>
    {contextMenu?.open && (
      <>
        <button
          type="button"
          className="context-menu-backdrop"
          onClick={onCloseContextMenu}
          aria-label="Close menu"
        />
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          role="menu"
        >
          {contextMenu.type === 'selection' ? (
            <>
              <button
                type="button"
                className="context-menu-item"
                onClick={onContextSelectAllFiles}
                disabled={!canSelectAllFiles}
              >
                <span className="context-menu-icon" aria-hidden="true">
                  <IconCheckCircleFill />
                </span>
                Select all files
              </button>
              <button type="button" className="context-menu-item" onClick={onContextCancelSelection}>
                <span className="context-menu-icon" aria-hidden="true">
                  <IconClose />
                </span>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="button" className="context-menu-item" onClick={onContextSelect}>
                <span className="context-menu-icon" aria-hidden="true">
                  <IconCheckCircleFill />
                </span>
                Select
              </button>
              <button type="button" className="context-menu-item" onClick={onContextDownload}>
                <span className="context-menu-icon" aria-hidden="true">
                  <IconDownload />
                </span>
                Download
              </button>
              <button type="button" className="context-menu-item" onClick={onContextShare}>
                <span className="context-menu-icon" aria-hidden="true">
                  <IconShare />
                </span>
                Share
              </button>
              {isSearchActive && (
                <button type="button" className="context-menu-item" onClick={onContextGoToEntry}>
                  <span className="context-menu-icon" aria-hidden="true">
                    <IconFolder />
                  </span>
                  Go to file in folder
                </button>
              )}
            </>
          )}
        </div>
      </>
    )}
    {downloadPrompt?.open && downloadSummary && (
      <DownloadConfirmModal
        summary={downloadSummary}
        onCancel={onCancelDownloadPrompt}
        onConfirm={onConfirmDownload}
      />
    )}
    {showProgressModal && (
      <DownloadProgressModal
        state={downloadState}
        progressValue={progressValue}
        progressMax={progressMax}
        onCancel={onCancelDownload}
        onDismiss={() => {
          onSetSelectionMode(false);
          onResetDownloadState();
        }}
      />
    )}
    <div className="directory-content" key={contentKey}>
      {isSearchActive ? (
        <>
          {searchLoading && <div className="state">Searching...</div>}
          {searchError && (
            <div className="state error">
              <div>{searchStatus.error}</div>
              {searchStatus.retryable && onRetrySearch && (
                <button type="button" className="state-cta" onClick={onRetrySearch}>
                  Retry search
                </button>
              )}
            </div>
          )}
          {!searchLoading && !searchError && searchCount === 0 && (
            <div className="not-found">
              <div className="not-found-copy">
                <div className="not-found-title">
                  <span className="not-found-title-icon" aria-hidden="true">
                    <IconSearch />
                  </span>
                  No results
                </div>
                <div className="not-found-subtitle">We couldn&apos;t find anything for this search.</div>
                <div className="not-found-desc">
                  Try a different keyword or clear the search to return to your last folder.
                </div>
                <div className="not-found-actions">
                  <button
                    type="button"
                    className="state-cta"
                    onClick={onClearSearch}
                  >
                    Clear search
                  </button>
                </div>
              </div>
            </div>
          )}
          {!searchLoading && !searchError && searchCount > 0 && (
            <FileList
              entries={sortedEntries}
              viewMode={viewMode}
              onSelect={onSelect}
              selectedPath={selectedPath}
              selectionMode={selectionMode}
              selectedPaths={selectedPaths}
              onToggleSelection={onToggleSelection}
              onOpenContextMenu={onOpenContextMenu}
              contextMenuEntryPath={contextMenuEntryPath}
              zoomLevel={zoomLevel}
              scrollParent={panelBodyNode}
              useWindowScroll={useWindowScroll}
            />
          )}
        </>
      ) : (
        <>
          {status.loading && !status.error && <div className="state">Loading...</div>}
          {status.error && (
            isNotFound ? (
              <div className="not-found">
                <div className="not-found-copy">
                  <div className="not-found-title">
                    <span className="not-found-title-icon" aria-hidden="true">
                      <IconFolderX />
                    </span>
                    404
                  </div>
                  <div className="not-found-subtitle">You&apos;ve lost your way.</div>
                  <div className="not-found-desc">
                    We could not find the path you requested. Try opening the archive root or return
                    to the last available folder.
                  </div>
                  <div className="not-found-actions">
                    {status.retryable && onRetryList && (
                      <button type="button" className="state-cta" onClick={onRetryList}>
                        Retry
                      </button>
                    )}
                    <button
                      type="button"
                      className="state-cta"
                      onClick={() => onNavigate('')}
                    >
                      Go to archive root
                    </button>
                    {lastGoodPath !== null && lastGoodPath !== undefined && (
                      <button
                        type="button"
                        className="state-cta"
                        onClick={() => onNavigate(lastGoodPath)}
                      >
                        Go to last available folder
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="state error">
                <div>{status.error}</div>
                <div className="state-actions">
                  {status.retryable && onRetryList && (
                    <button type="button" className="state-cta" onClick={onRetryList}>
                      Retry
                    </button>
                  )}
                  {lastGoodPath !== null && lastGoodPath !== undefined && (
                    <button
                      type="button"
                      className="state-cta"
                      onClick={() => onNavigate(lastGoodPath)}
                    >
                      View {lastGoodPath ? lastGoodPath : rootLabel}
                    </button>
                  )}
                </div>
              </div>
            )
          )}
          {!status.loading && !status.error && entryCount === 0 && (
            <div className="state empty">
              <span className="state-icon" aria-hidden="true">
                <IconFolderOpen />
              </span>
              <div className="state-title">Nothing in here</div>
            </div>
          )}
          {!status.loading && !status.error && entryCount > 0 && (
            <FileList
              entries={sortedEntries}
              viewMode={viewMode}
              onSelect={onSelect}
              selectedPath={selectedPath}
              selectionMode={selectionMode}
              selectedPaths={selectedPaths}
              onToggleSelection={onToggleSelection}
              onOpenContextMenu={onOpenContextMenu}
              contextMenuEntryPath={contextMenuEntryPath}
              zoomLevel={zoomLevel}
              scrollParent={panelBodyNode}
              useWindowScroll={useWindowScroll}
            />
          )}
        </>
      )}
    </div>
  </div>
);

const DirectoryPanel = () => {
  const {
    directory,
    currentPath,
    currentPathName,
    status,
    lastGoodPath,
    entries,
    useWindowScroll
  } = useDirectoryDataContext() || {};
  const { onNavigate, onSelect, onRetryList } = useDirectoryActionsContext() || {};
  const rootLabel = 'Archive';
  const { viewMode, zoomLevel } = useViewContext();
  const {
    selectedPath,
    selectionMode,
    selectedPaths,
    selectedCount = 0
  } = useSelectionStateContext() || {};
  const {
    onToggleSelection,
    onSetSelectionMode,
    onSelectAllFiles
  } = useSelectionActionsContext() || {};
  const {
    downloadState,
    downloadPrompt
  } = useDownloadStateContext() || {};
  const {
    onRequestDownload,
    onConfirmDownload,
    onCancelDownloadPrompt,
    onCancelDownload,
    onResetDownloadState
  } = useDownloadActionsContext() || {};
  const {
    contextMenu,
    onOpenContextMenu,
    onCloseContextMenu,
    onContextSelect,
    onContextDownload,
    onContextShare,
    onContextCancelSelection,
    onContextGoToEntry
  } = useContextMenuContext() || {};
  const { searchQuery, searchResults, searchStatus } = useSearchStateContext() || {};
  const { onRetrySearch, onClearSearch } = useSearchActionsContext() || {};
  const hasError = Boolean(status.error);
  const isNotFound = status?.code === 404;
  const isSearchActive = Boolean(searchQuery);
  const searchCount = searchResults?.length || 0;
  const searchLoading = isSearchActive && searchStatus?.loading;
  const searchError = isSearchActive && searchStatus?.error;
  const isRoot = !currentPath;
  const hasSelection = selectedCount > 0;
  const isDownloading = downloadState?.status === 'listing'
    || downloadState?.status === 'downloading'
    || downloadState?.status === 'finalizing';
  const hasDownloadStatus = downloadState?.status && downloadState.status !== 'idle';
  const progressMax = downloadState?.totalBytes || downloadState?.totalFiles || 1;
  const progressValue = downloadState?.totalBytes
    ? downloadState?.processedBytes
    : downloadState?.processedFiles;
  const downloadSummary = downloadPrompt?.summary;
  const showProgressModal = hasDownloadStatus;
  const contextMenuEntryPath = contextMenu?.open && contextMenu?.type === 'entry'
    ? (contextMenu.entry?.path || '')
    : '';
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const titleText = isSearchActive
    ? 'Search results'
    : isNotFound
      ? 'Not found'
      : (hasError ? '' : (isRoot ? rootLabel : (directory?.current?.name || currentPathName || rootLabel)));
  const searchResultLabel = `${searchCount} result${searchCount === 1 ? '' : 's'} for "${searchQuery}"`;
  const contentKey = isSearchActive
    ? `search:${searchQuery || 'results'}:${searchStatus?.loading ? 'loading' : 'done'}:${searchResults?.length || 0}`
    : `path:${currentPath || 'root'}`;
  const subLabel = isSearchActive
    ? (
      searchLoading
        ? `Searching "${searchQuery}"...`
        : searchError
          ? 'Search failed'
          : `${searchResultLabel}${searchStatus?.truncated ? ` (showing first ${searchCount})` : ''}`
    )
    : (hasError
      ? ''
      : directory
        ? `${directory.stats.dirs} folders, ${directory.stats.files} files`
        : 'Loading...');
  const baseEntries = useMemo(
    () => (Array.isArray(entries) ? entries : []),
    [entries]
  );
  const collator = useMemo(() => new Intl.Collator(undefined, { sensitivity: 'base' }), []);
  const sortedEntries = useMemo(() => {
    if (!baseEntries.length) return baseEntries;
    const list = [...baseEntries];
    list.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      let compare = 0;
      if (sortKey === 'name') {
        compare = collator.compare(a.name || '', b.name || '');
      } else if (sortKey === 'size') {
        compare = (a.size || 0) - (b.size || 0);
      }
      if (compare === 0) {
        compare = collator.compare(a.name || '', b.name || '');
      }
      return sortDir === 'desc' ? -compare : compare;
    });
    return list;
  }, [baseEntries, collator, sortKey, sortDir]);
  const entryCount = sortedEntries.length;
  const fileEntries = useMemo(
    () => sortedEntries.filter((entry) => !entry?.isDir),
    [sortedEntries]
  );
  const canSelectAllFiles = fileEntries.length > 0;
  const panelBodyRef = useRef(null);
  const [panelBodyNode, setPanelBodyNode] = useState(null);
  const handlePanelBodyRef = useCallback((node) => {
    panelBodyRef.current = node;
    setPanelBodyNode((prev) => (prev === node ? prev : node));
  }, []);

  const handleSortClick = useCallback((key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir('asc');
  }, [sortKey]);

  const handleSelectAllFiles = useCallback(() => {
    onSelectAllFiles?.(sortedEntries);
  }, [onSelectAllFiles, sortedEntries]);

  const handleContextSelectAllFiles = useCallback(() => {
    onSelectAllFiles?.(sortedEntries);
    onCloseContextMenu?.();
  }, [onCloseContextMenu, onSelectAllFiles, sortedEntries]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (downloadPrompt?.open) {
        onCancelDownloadPrompt();
        return;
      }
      if (hasDownloadStatus) {
        if (isDownloading) {
          onCancelDownload();
          return;
        }
        onSetSelectionMode(false);
        onResetDownloadState();
        return;
      }
      if (selectionMode) {
        onSetSelectionMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    downloadPrompt,
    hasDownloadStatus,
    isDownloading,
    onCancelDownload,
    onCancelDownloadPrompt,
    onResetDownloadState,
    onSetSelectionMode,
    selectionMode
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
    if (isSearchActive) return;
    if (!useWindowScroll) return;
    if (selectionMode) return;
    if (selectedPath) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [currentPath, isSearchActive, selectedPath, selectionMode, useWindowScroll]);

  return (
    <div
      className={`panel list-panel${selectionMode ? ' selection-active' : ''}${hasError ? ' has-error' : ''}`}
    >
      <DirectoryPanelHeader
        selectionMode={selectionMode}
        titleText={titleText}
        subLabel={subLabel}
        hasError={hasError}
        canSelectAllFiles={canSelectAllFiles}
        sortKey={sortKey}
        sortDir={sortDir}
        onSortClick={handleSortClick}
        onSetSelectionMode={onSetSelectionMode}
        onSelectAllFiles={handleSelectAllFiles}
      />
      <DirectoryPanelBody
        handlePanelBodyRef={handlePanelBodyRef}
        contextMenu={contextMenu}
        onCloseContextMenu={onCloseContextMenu}
        canSelectAllFiles={canSelectAllFiles}
        onContextSelectAllFiles={handleContextSelectAllFiles}
        onContextCancelSelection={onContextCancelSelection}
        onContextSelect={onContextSelect}
        onContextDownload={onContextDownload}
        onContextShare={onContextShare}
        onContextGoToEntry={onContextGoToEntry}
        isSearchActive={isSearchActive}
        downloadPrompt={downloadPrompt}
        downloadSummary={downloadSummary}
        onCancelDownloadPrompt={onCancelDownloadPrompt}
        onConfirmDownload={onConfirmDownload}
        showProgressModal={showProgressModal}
        downloadState={downloadState}
        progressValue={progressValue}
        progressMax={progressMax}
        onCancelDownload={onCancelDownload}
        onSetSelectionMode={onSetSelectionMode}
        onResetDownloadState={onResetDownloadState}
        contentKey={contentKey}
        searchLoading={searchLoading}
        searchError={searchError}
        searchStatus={searchStatus}
        searchCount={searchCount}
        onRetrySearch={onRetrySearch}
        onClearSearch={onClearSearch}
        status={status}
        isNotFound={isNotFound}
        onRetryList={onRetryList}
        onNavigate={onNavigate}
        lastGoodPath={lastGoodPath}
        rootLabel={rootLabel}
        entryCount={entryCount}
        sortedEntries={sortedEntries}
        viewMode={viewMode}
        onSelect={onSelect}
        selectedPath={selectedPath}
        selectionMode={selectionMode}
        selectedPaths={selectedPaths}
        onToggleSelection={onToggleSelection}
        onOpenContextMenu={onOpenContextMenu}
        contextMenuEntryPath={contextMenuEntryPath}
        zoomLevel={zoomLevel}
        panelBodyNode={panelBodyNode}
        useWindowScroll={useWindowScroll}
      />
      {selectionMode && (
        <div
          className="selection-bar"
          role="region"
          aria-label="Selection mode"
        >
          <div className="selection-bar-info">
            <span className="selection-bar-icon" aria-hidden="true">
              <IconCheck2Square />
            </span>
            <div className="selection-bar-title">Select items</div>
          </div>
          <div className="selection-bar-actions">
            <button
              type="button"
              className="panel-action-btn"
              onClick={() => onSetSelectionMode(false)}
              disabled={isDownloading}
            >
              <IconClose />
              Cancel
            </button>
            <button
              type="button"
              className="panel-action-btn is-primary"
              onClick={onRequestDownload}
              disabled={!hasSelection || isDownloading}
            >
              <IconDownload />
              {isDownloading ? 'Downloading...' : `Download${hasSelection ? ` (${selectedCount})` : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DirectoryPanel;
