import { useEffect, useRef, useState } from 'react';
import { buildFileUrl } from '../../lib/api.js';
import { formatSize } from '../../lib/format.js';
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
  iconForEntry
} from './index.js';
import LightboxLargeFileWarning from './LightboxLargeFileWarning.jsx';

const LARGE_FILE_THRESHOLD_BYTES = 10 * 1024 * 1024;
const TEXT_PREVIEW_MAX_BYTES = 5 * 1024 * 1024;
const VIDEO_MIME_TYPES = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.asf': 'video/x-ms-asf',
  '.wmv': 'video/x-ms-wmv',
  '.flv': 'video/x-flv',
  '.f4v': 'video/x-f4v',
  '.mpg': 'video/mpeg',
  '.mpeg': 'video/mpeg',
  '.3gp': 'video/3gpp',
  '.3g2': 'video/3gpp2',
  '.ogv': 'video/ogg',
  '.mts': 'video/mp2t',
  '.m2ts': 'video/mp2t',
  '.ts': 'video/mp2t',
  '.vob': 'video/mpeg',
  '.rm': 'video/vnd.rn-realvideo',
  '.rmvb': 'video/vnd.rn-realvideo',
  '.mxf': 'video/mxf',
  '.m1v': 'video/mpeg',
  '.m2v': 'video/mpeg'
};
const IMAGE_MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.heic': 'image/heic',
  '.ico': 'image/x-icon'
};
const AUDIO_MIME_TYPES = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.wma': 'audio/x-ms-wma',
  '.alac': 'audio/x-alac',
  '.aiff': 'audio/aiff'
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

const videoSupportCache = new Map();
const isVideoPlayable = (entry) => {
  if (!isVideoEntry(entry)) return true;
  if (typeof document === 'undefined') return true;
  const ext = getEntryExtension(entry);
  if (ext === '.mkv') return true;
  const mimeType = VIDEO_MIME_TYPES[ext];
  if (!mimeType) return true;
  if (videoSupportCache.has(mimeType)) {
    return videoSupportCache.get(mimeType);
  }
  const probe = document.createElement('video');
  const result = probe.canPlayType(mimeType);
  const playable = result === 'probably' || result === 'maybe';
  videoSupportCache.set(mimeType, playable);
  return playable;
};

const imageSupportCache = new Map();
const supportsImageMime = (mimeType) => {
  if (imageSupportCache.has(mimeType)) {
    return imageSupportCache.get(mimeType);
  }
  let supported = true;
  if (mimeType === 'image/webp' || mimeType === 'image/avif') {
    try {
      const canvas = document.createElement('canvas');
      const dataUrl = canvas.toDataURL(mimeType);
      supported = dataUrl.startsWith(`data:${mimeType}`);
    } catch {
      supported = false;
    }
  }
  imageSupportCache.set(mimeType, supported);
  return supported;
};

const isImagePlayable = (entry) => {
  if (!isImageEntry(entry)) return true;
  if (typeof document === 'undefined') return true;
  const ext = getEntryExtension(entry);
  const mimeType = IMAGE_MIME_TYPES[ext];
  if (!mimeType) return true;
  return supportsImageMime(mimeType);
};

const audioSupportCache = new Map();
const isAudioPlayable = (entry) => {
  if (!isAudioEntry(entry)) return true;
  if (typeof document === 'undefined') return true;
  const ext = getEntryExtension(entry);
  const mimeType = AUDIO_MIME_TYPES[ext];
  if (!mimeType) return true;
  if (audioSupportCache.has(mimeType)) {
    return audioSupportCache.get(mimeType);
  }
  const probe = document.createElement('audio');
  const result = probe.canPlayType(mimeType);
  const playable = result === 'probably' || result === 'maybe';
  audioSupportCache.set(mimeType, playable);
  return playable;
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
  const [mediaMeta, setMediaMeta] = useState({ width: null, height: null, duration: null });
  const [textPreview, setTextPreview] = useState({
    status: 'idle',
    content: '',
    html: '',
    truncated: false,
    error: '',
    retryable: false
  });
  const [textRetryToken, setTextRetryToken] = useState(0);
  const [largeFileWarningDismissed, setLargeFileWarningDismissed] = useState(false);
  const [disableLargeFileWarningsChecked, setDisableLargeFileWarningsChecked] = useState(false);
  const [videoPreviewFailed, setVideoPreviewFailed] = useState(false);
  const [imagePreviewFailed, setImagePreviewFailed] = useState(false);
  const imageRef = useRef(null);
  const videoRef = useRef(null);
  const lightboxRef = useRef(null);
  const toolbarRef = useRef(null);

  const isVideo = isVideoEntry(selectedEntry);
  const isImage = isImageEntry(selectedEntry);
  const isSvg = isImage && getEntryExtension(selectedEntry) === '.svg';
  const isAudio = isAudioEntry(selectedEntry);
  const isDocument = isDocumentPreviewEntry(selectedEntry);
  const isText = isTextEntry(selectedEntry);
  const isStreamable = isVideo || isAudio;
  const isMarkdown = isText && getEntryExtension(selectedEntry) === '.md';
  const shouldShowDimensions = isImage || isVideo;
  const hasDimensions = Number.isFinite(mediaMeta.width) && Number.isFinite(mediaMeta.height);
  const placeholderDimensions = '-- × --';
  const fileKey = selectedEntry?.path || '';
  const isLargeFile = Number.isFinite(selectedEntry?.size)
    && selectedEntry.size >= LARGE_FILE_THRESHOLD_BYTES;
  const isSessionApprovedLargeFile = fileKey && loadedLargeFileKeys.has(fileKey);
  const isLargeText = isText
    && Number.isFinite(selectedEntry?.size)
    && selectedEntry.size > TEXT_PREVIEW_MAX_BYTES;
  const canPreviewText = !isLargeText;
  const videoPlayable = isVideoPlayable(selectedEntry);
  const imagePlayable = isImagePlayable(selectedEntry);
  const audioPlayable = isAudioPlayable(selectedEntry);
  const canPreviewVideo = !isVideo || (videoPlayable && !videoPreviewFailed);
  const canPreviewImage = !isImage || (imagePlayable && !imagePreviewFailed);
  const canPreviewAudio = !isAudio || audioPlayable;
  const canPreviewEntry = isViewableEntry(selectedEntry)
    && canPreviewVideo
    && canPreviewImage
    && canPreviewAudio
    && canPreviewText;
  const shouldWarnLargeFile = isLargeFile && !isStreamable && canPreviewEntry && warnOnLargeFiles;
  const shouldGateLargeFile = shouldWarnLargeFile
    && !largeFileWarningDismissed
    && !isSessionApprovedLargeFile;

  useEffect(() => {
    if (!open) {
      setLargeFileWarningDismissed(false);
      setDisableLargeFileWarningsChecked(false);
      setVideoPreviewFailed(false);
      setImagePreviewFailed(false);
      return;
    }
    if (selectedEntry?.isDir) {
      setLargeFileWarningDismissed(false);
      setDisableLargeFileWarningsChecked(false);
      onClose();
      return;
    }
    setLargeFileWarningDismissed(false);
    setDisableLargeFileWarningsChecked(false);
    setMediaLoading(false);
    setMediaMeta({ width: null, height: null, duration: null });
    setVideoPreviewFailed(false);
    setImagePreviewFailed(false);
  }, [onClose, open, selectedEntry]);

  useEffect(() => {
    if (!open || !fileKey) return;
    if (!isLargeFile || isStreamable || !canPreviewEntry) return;
    if (!shouldGateLargeFile) {
      loadedLargeFileKeys.add(fileKey);
    }
  }, [canPreviewEntry, fileKey, isLargeFile, isStreamable, open, shouldGateLargeFile]);

  useEffect(() => {
    if (!open || !selectedEntry) return;
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
  }, [open, selectedEntry, isImage, isVideo]);

  useEffect(() => {
    if (!open || !selectedEntry) return undefined;
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
  }, [open, selectedEntry, isImage, isVideo]);

  useEffect(() => {
    if (!open || !selectedEntry || !isText) {
      setTextPreview({
        status: 'idle',
        content: '',
        html: '',
        truncated: false,
        error: '',
        retryable: false
      });
      return undefined;
    }
    if (shouldGateLargeFile || !canPreviewText) {
      setTextPreview({
        status: 'idle',
        content: '',
        html: '',
        truncated: false,
        error: '',
        retryable: false
      });
      return undefined;
    }
    let isActive = true;
    const loadText = async () => {
      setTextPreview({
        status: 'loading',
        content: '',
        html: '',
        truncated: false,
        error: '',
        retryable: false
      });
      try {
        const response = await fetch(buildFileUrl(selectedEntry.path));
        if (!response.ok) {
          const error = new Error('Failed to load text preview');
          error.status = response.status;
          error.retryable = response.status >= 500 || response.status === 408 || response.status === 429;
          throw error;
        }
        const content = await response.text();
        if (!isActive) return;
        let html = '';
        if (isMarkdown) {
          const { snarkdown, xss } = await loadMarkdownLibs();
          if (!isActive) return;
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
        if (!isActive) return;
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
      isActive = false;
    };
  }, [open, selectedEntry, shouldGateLargeFile, canPreviewText, isText, isMarkdown, textRetryToken]);

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

  if (!open || !selectedEntry || selectedEntry.isDir) return null;

  const previewSource = buildFileUrl(selectedEntry.path);
  const pathValue = selectedEntry?.path || '';
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
              sizeLabel={formatSize(selectedEntry.size)}
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
          {!shouldGateLargeFile && canPreviewVideo && canPreviewImage && (isImage || isVideo) && (
            <div className={`lightbox-media${mediaLoading ? ' is-loading' : ''}${isSvg ? ' is-svg' : ''}`}>
              {mediaLoading && <div className="media-loader" aria-hidden="true" />}
              {isImage && (
                <img
                  key={previewSource}
                  ref={imageRef}
                  src={previewSource}
                  alt={selectedEntry.name}
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
              title={selectedEntry.name}
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
                {Number.isFinite(selectedEntry.size) && selectedEntry.size > 0 && (
                  <span className="lightbox-size">{formatSize(selectedEntry.size)}</span>
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
            href={buildFileUrl(selectedEntry.path)}
            download={selectedEntry.name}
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
