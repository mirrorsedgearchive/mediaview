import { memo } from 'react';
import { formatSize } from '../../lib/format.js';
import { useDirectoryPanelController } from '../hooks/useDirectoryPanelController.js';
import {
  FileList,
  Button,
  Modal,
  IconCheck2Square,
  IconCheckCircleFill,
  IconClose,
  IconDownload,
  IconFolder,
  IconFolderX,
  IconFolderOpen,
  IconShare,
  IconSearch,
  SortButtons,
} from './index.js';

const DownloadConfirmModal = memo(({ summary, onCancel, onConfirm }) => {
  const warning =
    summary?.writerMode === 'memory'
      ? 'Your browser does not support streaming this download. If the download stalls, try a smaller set or another browser.'
      : '';

  return (
    <Modal
      className="download-modal"
      backdropClassName="download-modal-backdrop"
      onClose={onCancel}
      ariaLabelledBy="download-modal-title"
      ariaLabel="Download confirmation"
    >
      <div className="download-modal-header">
        <div className="download-modal-icon" aria-hidden="true">
          <IconDownload />
        </div>
        <div>
          <div className="download-modal-title" id="download-modal-title">
            Ready to download
          </div>
          <div className="download-modal-sub">Review your selection and start the download.</div>
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
        {warning && <div className="download-modal-warning">{warning}</div>}
      </div>
      <div className="download-modal-actions">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onConfirm}>Download</Button>
      </div>
    </Modal>
  );
});

DownloadConfirmModal.displayName = 'DownloadConfirmModal';

const DownloadProgressModal = memo(({ state, progressValue, progressMax, onCancel, onDismiss }) => {
  const canClose = !['listing', 'downloading', 'finalizing'].includes(state.status);

  return (
    <Modal
      className="download-progress-modal"
      backdropClassName="download-progress-backdrop"
      onClose={canClose ? onDismiss : undefined}
      ariaLabelledBy="download-progress-title"
      ariaLabel="Download status"
    >
      <div className="download-progress-header">
        <div className="download-modal-icon" aria-hidden="true">
          <IconDownload />
        </div>
        <div>
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
            {state.status === 'listing' && 'Preparing your selected folders...'}
            {state.status === 'finalizing' && 'Finishing your download...'}
            {['warning', 'done', 'error', 'cancelled'].includes(state.status) &&
              'You can close this window when you are ready.'}
          </div>
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
            {state.currentFile && <div className="download-progress-file">{state.currentFile}</div>}
          </>
        )}
        {state.status === 'finalizing' && (
          <div className="download-progress-meta">Wrapping up your download...</div>
        )}
        {(state.status === 'warning' ||
          state.status === 'done' ||
          state.status === 'error' ||
          state.status === 'cancelled') && (
          <div className="download-progress-meta">
            {state.status === 'warning' && 'The download finished, but some items may be missing.'}
            {state.status === 'done' && 'Your files are saved to the selected download location.'}
            {state.status === 'error' && 'Could not finish the download. Please try again.'}
            {state.status === 'cancelled' && 'The download was cancelled.'}
          </div>
        )}
        {state.warning && state.status !== 'done' && (
          <div className="download-modal-warning">{state.warning}</div>
        )}
        {state.error && <div className="download-modal-warning">{state.error}</div>}
      </div>
      <div className="download-progress-actions">
        {state.status === 'listing' ||
        state.status === 'downloading' ||
        state.status === 'finalizing' ? (
          <Button variant="secondary" onClick={onCancel}>
            Cancel download
          </Button>
        ) : (
          <Button onClick={onDismiss}>Close</Button>
        )}
      </div>
    </Modal>
  );
});

DownloadProgressModal.displayName = 'DownloadProgressModal';

const DirectoryPanelHeader = memo(
  ({
    selectionMode,
    titleText,
    subLabel,
    hasError,
    sortKey,
    sortDir,
    onSortClick,
    onEnableSelection,
    onCancelSelection,
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
              <button
                type="button"
                className="panel-action-btn is-emphasis"
                onClick={onCancelSelection}
              >
                <IconClose />
                Cancel selection
              </button>
            ) : (
              <button type="button" className="panel-action-btn" onClick={onEnableSelection}>
                <IconCheck2Square />
                Select
              </button>
            )}
            <SortButtons sortKey={sortKey} sortDir={sortDir} onSortClick={onSortClick} />
          </>
        )}
      </div>
    </div>
  )
);

DirectoryPanelHeader.displayName = 'DirectoryPanelHeader';

const DirectoryPanelBody = memo(
  ({
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
    onDismissDownloadStatus,
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
    onNavigateRoot,
    lastGoodPath,
    onNavigateLastGoodPath,
    rootLabel,
    entryCount,
    sortedEntries,
    folderChildren,
    folderCustomThumbnails,
    folderContentWarnings,
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
    contextMenuEntryPath,
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
                <button
                  type="button"
                  className="context-menu-item"
                  onClick={onContextCancelSelection}
                >
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
          onDismiss={onDismissDownloadStatus}
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
                  <div className="not-found-subtitle">
                    We couldn&apos;t find anything for this search.
                  </div>
                  <div className="not-found-desc">
                    Try a different keyword or clear the search to return to your last folder.
                  </div>
                  <div className="not-found-actions">
                    <button type="button" className="state-cta" onClick={onClearSearch}>
                      Clear search
                    </button>
                  </div>
                </div>
              </div>
            )}
            {!searchLoading && !searchError && searchCount > 0 && (
              <FileList
                entries={sortedEntries}
                folderChildren={folderChildren}
                folderCustomThumbnails={folderCustomThumbnails}
                folderContentWarnings={folderContentWarnings}
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
            {status.loading && !status.error && entryCount === 0 && (
              <div className="state">Loading...</div>
            )}
            {status.error &&
              (isNotFound ? (
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
                      We could not find the path you requested. Try opening the archive root or
                      return to the last available folder.
                    </div>
                    <div className="not-found-actions">
                      {status.retryable && onRetryList && (
                        <button type="button" className="state-cta" onClick={onRetryList}>
                          Retry
                        </button>
                      )}
                      <button type="button" className="state-cta" onClick={onNavigateRoot}>
                        Go to archive root
                      </button>
                      {lastGoodPath !== null && lastGoodPath !== undefined && (
                        <button
                          type="button"
                          className="state-cta"
                          onClick={onNavigateLastGoodPath}
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
                      <button type="button" className="state-cta" onClick={onNavigateLastGoodPath}>
                        View {lastGoodPath ? lastGoodPath : rootLabel}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            {!status.error && (!status.loading || entryCount > 0) && entryCount === 0 && (
              <div className="state empty">
                <span className="state-icon" aria-hidden="true">
                  <IconFolderOpen />
                </span>
                <div className="state-title">Nothing in here</div>
              </div>
            )}
            {!status.error && (!status.loading || entryCount > 0) && entryCount > 0 && (
              <FileList
                entries={sortedEntries}
                folderChildren={folderChildren}
                folderCustomThumbnails={folderCustomThumbnails}
                folderContentWarnings={folderContentWarnings}
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
  )
);

DirectoryPanelBody.displayName = 'DirectoryPanelBody';

const DirectoryPanelSelectionBar = memo(
  ({
    selectedCount,
    canSelectAllFiles,
    isDownloading,
    hasSelection,
    onCancelSelection,
    onSelectAllFiles,
    onRequestDownload,
  }) => (
    <div className="selection-bar" role="region" aria-label="Selection mode">
      <div className="selection-bar-top">
        <div className="selection-bar-info">
          <span className="selection-bar-icon" aria-hidden="true">
            <IconCheck2Square />
          </span>
          <div className="selection-bar-summary">
            <div className="selection-bar-title">Select items</div>
            <div className="selection-bar-meta">{selectedCount} selected</div>
          </div>
        </div>
        <Button
          variant="secondary"
          className="selection-bar-cancel"
          onClick={onCancelSelection}
          disabled={isDownloading}
        >
          <IconClose />
          Cancel
        </Button>
      </div>
      <div className="selection-bar-actions">
        <Button
          variant="secondary"
          className="selection-bar-select-all"
          onClick={onSelectAllFiles}
          disabled={!canSelectAllFiles || isDownloading}
        >
          <IconCheckCircleFill />
          Select all files
        </Button>
        <Button
          className="selection-bar-download"
          onClick={onRequestDownload}
          disabled={!hasSelection || isDownloading}
        >
          <IconDownload />
          {isDownloading
            ? 'Downloading...'
            : `Download${hasSelection ? ` (${selectedCount})` : ''}`}
        </Button>
      </div>
    </div>
  )
);

DirectoryPanelSelectionBar.displayName = 'DirectoryPanelSelectionBar';

const DirectoryPanel = () => {
  const { panelClassName, headerProps, bodyProps, selectionBarProps } =
    useDirectoryPanelController();

  return (
    <div className={panelClassName}>
      <DirectoryPanelHeader {...headerProps} />
      <DirectoryPanelBody {...bodyProps} />
      {selectionBarProps && <DirectoryPanelSelectionBar {...selectionBarProps} />}
    </div>
  );
};

export default DirectoryPanel;
