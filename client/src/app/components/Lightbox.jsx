import { useEffect, useRef, useState } from 'react';
import { buildFileUrl } from '../../lib/api.js';
import { formatSize } from '../../lib/format.js';
import {
  getImageMimeType,
  getImageSupportStatus,
  isAudioPlayable,
  isVideoPlayable,
  resolveImageSupportStatus
} from '../../lib/media.js';
import {
  getEntryExtension,
  isAudioEntry,
  isDocumentPreviewEntry,
  isImageEntry,
  isTextEntry,
  isVideoEntry,
  isViewableEntry
} from '../../lib/fileTypes.js';
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

const LARGE_FILE_THRESHOLD_BYTES = 10 * 1024 * 1024;
const TEXT_PREVIEW_MAX_BYTES = 5 * 1024 * 1024;
const EMPTY_MEDIA_META = {
  width: null,
  height: null,
  duration: null
};
const IDLE_TEXT_PREVIEW = {
  status: 'idle',
  content: '',
  html: '',
  truncated: false,
  error: '',
  retryable: false
};
const LOADING_TEXT_PREVIEW = {
  ...IDLE_TEXT_PREVIEW,
  status: 'loading'
};

const resetMediaState = ({
  setDisableLargeFileWarningsChecked,
  setImagePreviewFailed,
  setLargeFileWarningDismissed,
  setMediaLoading,
  setMediaMeta,
  setVideoPreviewFailed
}) => {
  setLargeFileWarningDismissed(false);
  setDisableLargeFileWarningsChecked(false);
  setMediaLoading(false);
  setMediaMeta(EMPTY_MEDIA_META);
  setVideoPreviewFailed(false);
  setImagePreviewFailed(false);
};

const resetClosedState = ({
  setDisableLargeFileWarningsChecked,
  setImagePreviewFailed,
  setImageSupportStatus,
  setLargeFileWarningDismissed,
  setMediaLoading,
  setMediaMeta,
  setTextPreview,
  setVideoPreviewFailed
}) => {
  resetMediaState({
    setDisableLargeFileWarningsChecked,
    setImagePreviewFailed,
    setLargeFileWarningDismissed,
    setMediaLoading,
    setMediaMeta,
    setVideoPreviewFailed
  });
  setTextPreview(IDLE_TEXT_PREVIEW);
  setImageSupportStatus('supported');
};

let markdownLibPromise = null;
const loadedLargeFileKeys = new Set();
const loadMarkdownLibs = () => {
  if (!markdownLibPromise) {
    markdownLibPromise = Promise.all([
      import('snarkdown'),
      import('xss')
    ]).then(([snarkdownModule, xssModule]) => ({
      snarkdown: snarkdownModule.default || snarkdownModule,
      xss: xssModule.default || xssModule
    }));
  }
  return markdownLibPromise;
};

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
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaMeta, setMediaMeta] = useState(EMPTY_MEDIA_META);
  const [textPreview, setTextPreview] = useState(IDLE_TEXT_PREVIEW);
  const [textRetryToken, setTextRetryToken] = useState(0);
  const [largeFileWarningDismissed, setLargeFileWarningDismissed] = useState(false);
  const [disableLargeFileWarningsChecked, setDisableLargeFileWarningsChecked] = useState(false);
  const [videoPreviewFailed, setVideoPreviewFailed] = useState(false);
  const [imagePreviewFailed, setImagePreviewFailed] = useState(false);
  const [imageSupportStatus, setImageSupportStatus] = useState('supported');
  const imageRef = useRef(null);
  const videoRef = useRef(null);
  const lightboxRef = useRef(null);
  const toolbarRef = useRef(null);

  const isDirectory = Boolean(selectedEntry?.isDir);
  const selectedPath = selectedEntry?.path || '';
  const selectedName = selectedEntry?.name || '';
  const selectedExt = getEntryExtension(selectedEntry);
  const selectedImageMimeType = getImageMimeType(selectedEntry);
  const selectedSize = selectedEntry?.size;
  const previewSource = selectedPath ? buildFileUrl(selectedPath) : '';

  const isVideo = isVideoEntry(selectedEntry);
  const isImage = isImageEntry(selectedEntry);
  const isSvg = isImage && selectedExt === '.svg';
  const isAudio = isAudioEntry(selectedEntry);
  const isDocument = isDocumentPreviewEntry(selectedEntry);
  const isText = isTextEntry(selectedEntry);
  const isStreamable = isVideo || isAudio;
  const isMarkdown = isText && selectedExt === '.md';
  const shouldShowDimensions = isImage || isVideo;
  const hasDimensions = Number.isFinite(mediaMeta.width) && Number.isFinite(mediaMeta.height);
  const placeholderDimensions = '-- × --';
  const fileKey = selectedPath;
  const isLargeFile = Number.isFinite(selectedSize)
    && selectedSize >= LARGE_FILE_THRESHOLD_BYTES;
  const isSessionApprovedLargeFile = fileKey && loadedLargeFileKeys.has(fileKey);
  const isLargeText = isText
    && Number.isFinite(selectedSize)
    && selectedSize > TEXT_PREVIEW_MAX_BYTES;
  const canPreviewText = !isLargeText;
  const videoPlayable = isVideoPlayable(selectedEntry);
  const audioPlayable = isAudioPlayable(selectedEntry);
  const imageCapabilityKnown = imageSupportStatus !== 'pending';
  const canPreviewVideo = !isVideo || (videoPlayable && !videoPreviewFailed);
  const canPreviewImage = !isImage
    || (imageSupportStatus !== 'unsupported' && !imagePreviewFailed);
  const canPreviewAudio = !isAudio || audioPlayable;
  const canPreviewEntry = isViewableEntry(selectedEntry)
    && canPreviewVideo
    && canPreviewImage
    && canPreviewAudio
    && canPreviewText;
  const shouldWarnLargeFile = isLargeFile
    && !isStreamable
    && canPreviewEntry
    && (!isImage || imageCapabilityKnown)
    && warnOnLargeFiles;
  const shouldGateLargeFile = shouldWarnLargeFile
    && !largeFileWarningDismissed
    && !isSessionApprovedLargeFile;

  useEffect(() => {
    if (!open) {
      resetClosedState({
        setDisableLargeFileWarningsChecked,
        setImagePreviewFailed,
        setImageSupportStatus,
        setLargeFileWarningDismissed,
        setMediaLoading,
        setMediaMeta,
        setTextPreview,
        setVideoPreviewFailed
      });
      return;
    }
    if (isDirectory) {
      resetMediaState({
        setDisableLargeFileWarningsChecked,
        setImagePreviewFailed,
        setLargeFileWarningDismissed,
        setMediaLoading,
        setMediaMeta,
        setVideoPreviewFailed
      });
      onClose();
      return;
    }
    resetMediaState({
      setDisableLargeFileWarningsChecked,
      setImagePreviewFailed,
      setLargeFileWarningDismissed,
      setMediaLoading,
      setMediaMeta,
      setVideoPreviewFailed
    });
  }, [isDirectory, onClose, open, selectedPath]);

  useEffect(() => {
    if (!open || !selectedPath || !isImage) {
      setImageSupportStatus('supported');
      return undefined;
    }
    const nextStatus = getImageSupportStatus(selectedImageMimeType);
    setImageSupportStatus(nextStatus);
    if (nextStatus !== 'pending') {
      return undefined;
    }
    let cancelled = false;
    void resolveImageSupportStatus(selectedImageMimeType)
      .then((status) => {
        if (!cancelled) {
          setImageSupportStatus(status);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isImage, open, selectedImageMimeType, selectedPath]);

  useEffect(() => {
    if (!open || !fileKey) return;
    if (!isLargeFile || isStreamable || !canPreviewEntry) return;
    if (!shouldGateLargeFile) {
      loadedLargeFileKeys.add(fileKey);
    }
  }, [canPreviewEntry, fileKey, isLargeFile, isStreamable, open, shouldGateLargeFile]);

  useEffect(() => {
    if (!open || !selectedPath) return;
    if (isImage && imageRef.current?.complete) {
      setMediaLoading(false);
      setMediaMeta({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
        duration: null
      });
    }
    if (isVideo && videoRef.current?.readyState >= 2) {
      setMediaLoading(false);
      setMediaMeta({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
        duration: videoRef.current.duration
      });
    }
  }, [open, isImage, isVideo, selectedPath]);

  useEffect(() => {
    if (!open || !selectedPath) return undefined;
    if (!isImage && !isVideo) return undefined;
    const frameId = requestAnimationFrame(() => {
      if (isImage) {
        const img = imageRef.current;
        if (!img) return;
        setMediaLoading(!(img.complete && img.naturalWidth > 0));
      } else {
        const video = videoRef.current;
        if (!video) return;
        setMediaLoading(video.readyState < 2);
      }
    });
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [open, isImage, isVideo, selectedPath]);

  useEffect(() => {
    if (!open || !selectedPath || !isText) {
      setTextPreview(IDLE_TEXT_PREVIEW);
      return undefined;
    }
    if (shouldGateLargeFile || !canPreviewText) {
      setTextPreview(IDLE_TEXT_PREVIEW);
      return undefined;
    }
    const controller = new AbortController();
    const loadText = async () => {
      setTextPreview(LOADING_TEXT_PREVIEW);
      try {
        const response = await fetch(previewSource, { signal: controller.signal });
        if (!response.ok) {
          const error = new Error('Failed to load text preview');
          error.status = response.status;
          error.retryable = response.status >= 500 || response.status === 408 || response.status === 429;
          throw error;
        }
        const content = await response.text();
        if (controller.signal.aborted) return;
        let html = '';
        if (isMarkdown) {
          const { snarkdown, xss } = await loadMarkdownLibs();
          if (controller.signal.aborted) return;
          html = xss(snarkdown(content));
        }
        setTextPreview({
          status: 'ready',
          content,
          html,
          truncated: false,
          error: '',
          retryable: false
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        const retryable = typeof error?.retryable === 'boolean' ? error.retryable : true;
        setTextPreview({
          status: 'error',
          content: '',
          html: '',
          truncated: false,
          error: error.message,
          retryable
        });
      }
    };
    loadText();
    return () => {
      controller.abort();
    };
  }, [canPreviewText, isMarkdown, isText, open, previewSource, selectedPath, shouldGateLargeFile, textRetryToken]);

  useEffect(() => {
    if (open && isMarkdown) {
      void loadMarkdownLibs();
    }
  }, [open, isMarkdown]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
      if (event.key === 'ArrowLeft') {
        onPrev();
      }
      if (event.key === 'ArrowRight') {
        onNext();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose, onPrev, onNext]);

  useEffect(() => {
    if (!open) return undefined;
    const lightboxEl = lightboxRef.current;
    const toolbarEl = toolbarRef.current;
    if (!lightboxEl || !toolbarEl) return undefined;

    let frameId;
    const updateToolbarHeight = () => {
      if (!lightboxEl || !toolbarEl) return;
      const nextHeight = Math.ceil(toolbarEl.getBoundingClientRect().height);
      lightboxEl.style.setProperty('--lightbox-toolbar-height', `${nextHeight}px`);
    };

    updateToolbarHeight();

    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        if (frameId) cancelAnimationFrame(frameId);
        frameId = requestAnimationFrame(updateToolbarHeight);
      });
      observer.observe(toolbarEl);
    }

    const handleResize = () => updateToolbarHeight();
    window.addEventListener('resize', handleResize);

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', handleResize);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [open, selectedEntry?.path]);

  if (!open || !selectedEntry || isDirectory) return null;

  const pathValue = selectedPath;
  const pathLabel = pathValue ? `/${pathValue}` : '/';

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
            onClick={onPrev}
            disabled={activeIndex <= 0}
            aria-label="Previous item"
          >
            <IconChevronLeft />
          </button>
          <button
            type="button"
            className="lightbox-side-nav lightbox-side-nav-next"
            onClick={onNext}
            disabled={activeIndex >= lightboxEntries.length - 1}
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
          {shouldGateLargeFile && (
            <LightboxLargeFileWarning
              sizeLabel={formatSize(selectedSize)}
              disableWarningsChecked={disableLargeFileWarningsChecked}
              onToggleDisableWarnings={setDisableLargeFileWarningsChecked}
              onLoadFile={() => {
                if (fileKey) loadedLargeFileKeys.add(fileKey);
                if (disableLargeFileWarningsChecked) {
                  onDisableLargeFileWarnings?.();
                }
                setLargeFileWarningDismissed(true);
              }}
              onClose={onClose}
            />
          )}
          {!shouldGateLargeFile && imageCapabilityKnown && canPreviewVideo && canPreviewImage && (isImage || isVideo) && (
            <div className={`lightbox-media${mediaLoading ? ' is-loading' : ''}${isSvg ? ' is-svg' : ''}`}>
              {mediaLoading && <div className="media-loader" aria-hidden="true" />}
              {isImage && (
                <img
                  key={previewSource}
                  ref={imageRef}
                  src={previewSource}
                  alt={selectedName}
                  loading="eager"
                  onLoad={(event) => {
                    setMediaLoading(false);
                    setMediaMeta({
                      width: event.currentTarget.naturalWidth,
                      height: event.currentTarget.naturalHeight,
                      duration: null
                    });
                  }}
                  onError={() => {
                    setMediaLoading(false);
                    setImagePreviewFailed(true);
                  }}
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
                  onLoadedMetadata={(event) => {
                    setMediaMeta({
                      width: event.currentTarget.videoWidth,
                      height: event.currentTarget.videoHeight,
                      duration: event.currentTarget.duration
                    });
                  }}
                  onLoadedData={() => setMediaLoading(false)}
                  onError={() => {
                    setMediaLoading(false);
                    setVideoPreviewFailed(true);
                  }}
                />
              )}
            </div>
          )}
          {!shouldGateLargeFile && isImage && imageSupportStatus === 'pending' && (
            <div className="lightbox-media is-loading">
              <div className="media-loader" aria-hidden="true" />
            </div>
          )}
          {!shouldGateLargeFile && isAudio && canPreviewAudio && (
            <audio
              controls
              autoPlay
              src={previewSource}
              preload="metadata"
              onLoadedMetadata={(event) => {
                setMediaMeta({
                  width: null,
                  height: null,
                  duration: event.currentTarget.duration
                });
              }}
            />
          )}
          {!shouldGateLargeFile && isDocument && (
            <iframe
              className="lightbox-iframe"
              src={previewSource}
              title={selectedName}
            />
          )}
          {!shouldGateLargeFile && isText && (
            <div className={`lightbox-text${isMarkdown ? ' lightbox-markdown' : ''}`}>
              {textPreview.status === 'loading' && <div>Loading preview...</div>}
              {textPreview.status === 'error' && (
                <div className="lightbox-error">
                  <span>{textPreview.error}</span>
                  {textPreview.retryable && (
                    <button
                      type="button"
                      className="lightbox-retry"
                      onClick={() => setTextRetryToken((prev) => prev + 1)}
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
          {!shouldGateLargeFile && !canPreviewEntry && (
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
              {iconForEntry(selectedEntry)}
            </span>
            <div className="lightbox-meta-text">
              <span className="lightbox-name">{selectedEntry.name}</span>
              <div className="lightbox-meta-sub">
                {Number.isFinite(selectedSize) && selectedSize > 0 && (
                  <span className="lightbox-size">{formatSize(selectedSize)}</span>
                )}
                {shouldShowDimensions && (
                  <span
                    className={`lightbox-dimensions${hasDimensions ? '' : ' is-loading'}`}
                    aria-hidden={!hasDimensions}
                  >
                    {hasDimensions
                      ? `${mediaMeta.width} × ${mediaMeta.height}`
                      : placeholderDimensions}
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
                    onClick={() => onNavigatePath?.(selectedEntry)}
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
            {activeIndex >= 0 && lightboxEntries.length > 0 && (
              <span className="lightbox-count">
                {activeIndex + 1} / {lightboxEntries.length}
              </span>
            )}
            <button
              type="button"
              className="lightbox-nav"
              onClick={onPrev}
              disabled={activeIndex <= 0}
              aria-label="Previous item"
            >
              <IconChevronLeft />
            </button>
            <button
              type="button"
              className="lightbox-nav"
              onClick={onNext}
              disabled={activeIndex >= lightboxEntries.length - 1}
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
            onClick={() => onShareEntry?.(selectedEntry)}
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
