import { formatSize } from '../../lib/format.js';
import { useLightboxController } from '../hooks/useLightboxController.js';
import {
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconFolder,
  IconInfoCircle,
  IconShare,
  iconForEntry,
  LightboxLargeFileWarning
} from './index.js';

const Lightbox = ({
  open,
  selectedEntry,
  lightboxEntries,
  activeIndex,
  onClose,
  onPrev,
  onNext,
  onShareEntry,
  showSideNav = false,
  showPath = false,
  onNavigatePath,
  warnOnLargeFiles = true,
  onDisableLargeFileWarnings
}) => {
  const {
    activePosition,
    canGoNext,
    canGoPrev,
    dimensionsLabel,
    disableLargeFileWarningsChecked,
    handleAudioLoadedMetadata,
    handleImageError,
    handleImageLoad,
    handleLoadLargeFile,
    handleNavigateFromPath,
    handleNextAction,
    handlePrevAction,
    handleRetryTextPreview,
    handleVideoError,
    handleVideoLoadedData,
    handleVideoLoadedMetadata,
    hasDimensions,
    imageRef,
    isDirectory,
    isDocument,
    isMarkdown,
    isSvg,
    isVideo,
    lightboxRef,
    mediaLoading,
    pathLabel,
    pathValue,
    previewSource,
    selectedName,
    selectedPath,
    selectedSize,
    selectedEntry: currentEntry,
    setDisableLargeFileWarningsChecked,
    shouldRenderImage,
    shouldShowDimensions,
    showAudioPreview,
    showDocumentPreview,
    showImagePending,
    showLargeFileWarning,
    showMediaPreview,
    showTextPreview,
    showUnknownPreview,
    textPreview,
    toolbarRef,
    totalEntries,
    videoRef,
  } = useLightboxController({
    activeIndex,
    lightboxEntries,
    onClose,
    onDisableLargeFileWarnings,
    onNavigatePath,
    onNext,
    onPrev,
    open,
    selectedEntry,
    warnOnLargeFiles
  });

  if (!open || !currentEntry || isDirectory) return null;

  return (
    <div
      className={`lightbox${showSideNav ? ' has-side-nav' : ''}`}
      ref={lightboxRef}
      role="dialog"
      aria-modal="true"
    >
      <button type="button" className="lightbox-backdrop" onClick={onClose} aria-label="Close preview" />
      {showSideNav && (
        <>
          <button
            type="button"
            className="lightbox-side-nav lightbox-side-nav-prev"
            onClick={handlePrevAction}
            disabled={!canGoPrev}
            aria-label="Previous item"
          >
            <IconChevronLeft />
          </button>
          <button
            type="button"
            className="lightbox-side-nav lightbox-side-nav-next"
            onClick={handleNextAction}
            disabled={!canGoNext}
            aria-label="Next item"
          >
            <IconChevronRight />
          </button>
        </>
      )}
      <div className="lightbox-stage">
        <div
          className={`lightbox-body${isDocument ? ' is-document' : ''}${mediaLoading ? ' is-loading' : ''}`}
        >
          <button
            type="button"
            className="lightbox-body-dismiss"
            onClick={onClose}
            aria-label="Close preview"
          />
          {showLargeFileWarning && (
            <LightboxLargeFileWarning
              sizeLabel={formatSize(selectedSize)}
              disableWarningsChecked={disableLargeFileWarningsChecked}
              onToggleDisableWarnings={setDisableLargeFileWarningsChecked}
              onLoadFile={handleLoadLargeFile}
              onClose={onClose}
            />
          )}
          {showMediaPreview && (
            <div className={`lightbox-media${mediaLoading ? ' is-loading' : ''}${isSvg ? ' is-svg' : ''}`}>
              {mediaLoading && <div className="media-loader" aria-hidden="true" />}
              {shouldRenderImage && (
                <img
                  key={selectedPath}
                  ref={imageRef}
                  src={previewSource}
                  alt={selectedName}
                  loading="eager"
                  fetchPriority="high"
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                />
              )}
              {isVideo && (
                <video
                  controls
                  autoPlay
                  key={previewSource}
                  ref={videoRef}
                  src={previewSource}
                  preload="metadata"
                  onLoadedMetadata={handleVideoLoadedMetadata}
                  onLoadedData={handleVideoLoadedData}
                  onError={handleVideoError}
                />
              )}
            </div>
          )}
          {showImagePending && (
            <div className="lightbox-media is-loading">
              <div className="media-loader" aria-hidden="true" />
            </div>
          )}
          {showAudioPreview && (
            <audio
              controls
              autoPlay
              src={previewSource}
              preload="metadata"
              onLoadedMetadata={handleAudioLoadedMetadata}
            />
          )}
          {showDocumentPreview && (
            <iframe
              className="lightbox-iframe"
              src={previewSource}
              title={selectedName}
            />
          )}
          {showTextPreview && (
            <div className={`lightbox-text${isMarkdown ? ' lightbox-markdown' : ''}`}>
              {textPreview.status === 'loading' && <div>Loading preview...</div>}
              {textPreview.status === 'error' && (
                <div className="lightbox-error">
                  <span>{textPreview.error}</span>
                  {textPreview.retryable && (
                    <button
                      type="button"
                      className="lightbox-retry"
                      onClick={handleRetryTextPreview}
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}
              {textPreview.status === 'ready' && (
                <>
                  {textPreview.truncated && <div className="lightbox-note">Showing first 64 KB.</div>}
                  {isMarkdown ? (
                    <div
                      className="lightbox-markdown-body"
                      dangerouslySetInnerHTML={{ __html: textPreview.html }}
                    />
                  ) : (
                    <pre>{textPreview.content}</pre>
                  )}
                </>
              )}
            </div>
          )}
          {showUnknownPreview && (
            <div className="lightbox-unknown">
              <span className="lightbox-unknown-icon" aria-hidden="true">
                <IconInfoCircle />
              </span>
              <div className="lightbox-unknown-content">
                <div className="lightbox-unknown-title">Preview unavailable</div>
                <div className="lightbox-unknown-copy">
                  This type can&apos;t be previewed here. Use Download to open it.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="lightbox-toolbar" ref={toolbarRef}>
        <div className="lightbox-meta">
          <div className="lightbox-meta-left">
            <span className="lightbox-type-icon" aria-hidden="true">
              {iconForEntry(currentEntry)}
            </span>
            <div className="lightbox-meta-text">
              <span className="lightbox-name">{currentEntry.name}</span>
              <div className="lightbox-meta-sub">
                {Number.isFinite(selectedSize) && selectedSize > 0 && (
                  <span className="lightbox-size">{formatSize(selectedSize)}</span>
                )}
                {shouldShowDimensions && (
                  <span
                    className={`lightbox-dimensions${hasDimensions ? '' : ' is-loading'}`}
                    aria-hidden={!hasDimensions}
                  >
                    {dimensionsLabel}
                  </span>
                )}
              </div>
              {showPath && pathValue && (
                <div className="lightbox-meta-path">
                  <span className="lightbox-location-icon" aria-hidden="true">
                    <IconFolder />
                  </span>
                  <button
                    type="button"
                    className="lightbox-path"
                    onClick={handleNavigateFromPath}
                  >
                    {pathLabel}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="lightbox-controls">
          <div className="lightbox-nav-group" role="group" aria-label="Navigation">
            {activePosition > 0 && totalEntries > 0 && (
              <span className="lightbox-count">
                {activePosition} / {totalEntries}
              </span>
            )}
            <button
              type="button"
              className="lightbox-nav"
              onClick={handlePrevAction}
              disabled={!canGoPrev}
              aria-label="Previous item"
            >
              <IconChevronLeft />
            </button>
            <button
              type="button"
              className="lightbox-nav"
              onClick={handleNextAction}
              disabled={!canGoNext}
              aria-label="Next item"
            >
              <IconChevronRight />
            </button>
          </div>
          <a
            className="lightbox-download"
            href={previewSource}
            download={selectedName}
          >
            <IconDownload />
            Download
          </a>
          <button
            type="button"
            className="lightbox-share"
            onClick={() => onShareEntry?.(currentEntry)}
          >
            <IconShare />
            Share
          </button>
          <button type="button" className="lightbox-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default Lightbox;
