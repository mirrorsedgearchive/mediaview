import { useCallback, useEffect, useRef, useState } from 'react';
import { buildFileUrl } from '../../lib/api.js';
import {
  getImageMimeType,
  getImageSupportStatus,
  isAudioPlayable,
  isVideoPlayable,
  resolveImageSupportStatus,
} from '../../lib/media.js';
import {
  getEntryExtension,
  isAudioEntry,
  isDocumentPreviewEntry,
  isImageEntry,
  isTextEntry,
  isVideoEntry,
  isViewableEntry,
} from '../../lib/fileTypes.js';

const LARGE_FILE_THRESHOLD_BYTES = 10 * 1024 * 1024;
const TEXT_PREVIEW_MAX_BYTES = 5 * 1024 * 1024;
const EMPTY_MEDIA_META = {
  width: null,
  height: null,
  duration: null,
};
const IDLE_TEXT_PREVIEW = {
  status: 'idle',
  content: '',
  html: '',
  truncated: false,
  error: '',
  retryable: false,
};
const LOADING_TEXT_PREVIEW = {
  ...IDLE_TEXT_PREVIEW,
  status: 'loading',
};

let markdownLibPromise = null;
const loadedLargeFileKeys = new Set();
const preloadedLightboxAssetKeys = new Set();
const pendingLightboxPreloads = new Map();
let pendingLightboxIdleCallbackId = null;

const resetMediaState = ({
  setDisableLargeFileWarningsChecked,
  setImagePreviewFailed,
  setLargeFileWarningDismissed,
  setMediaMeta,
  setVideoPreviewFailed,
}) => {
  setLargeFileWarningDismissed(false);
  setDisableLargeFileWarningsChecked(false);
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
  setVideoPreviewFailed,
}) => {
  resetMediaState({
    setDisableLargeFileWarningsChecked,
    setImagePreviewFailed,
    setLargeFileWarningDismissed,
    setMediaMeta,
    setVideoPreviewFailed,
  });
  setMediaLoading(false);
  setTextPreview(IDLE_TEXT_PREVIEW);
  setImageSupportStatus('supported');
};

const loadMarkdownLibs = () => {
  if (!markdownLibPromise) {
    markdownLibPromise = Promise.all([import('snarkdown'), import('xss')]).then(
      ([snarkdownModule, xssModule]) => ({
        snarkdown: snarkdownModule.default || snarkdownModule,
        xss: xssModule.default || xssModule,
      })
    );
  }
  return markdownLibPromise;
};

const cancelPendingPreload = (key) => {
  if (!key) return;
  pendingLightboxPreloads.get(key)?.abort?.();
};

const cancelPendingIdlePreload = () => {
  if (pendingLightboxIdleCallbackId === null) return;
  if (typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(pendingLightboxIdleCallbackId);
  } else {
    clearTimeout(pendingLightboxIdleCallbackId);
  }
  pendingLightboxIdleCallbackId = null;
};

const isWithinPreloadLimit = (entry) =>
  !Number.isFinite(entry?.size) || entry.size < LARGE_FILE_THRESHOLD_BYTES;

const isEligibleForAdjacentPreload = async (entry) => {
  if (!entry?.path || entry.isDir) return false;
  if (!isViewableEntry(entry)) return false;
  if (!isWithinPreloadLimit(entry)) return false;
  if (!isImageEntry(entry)) return false;

  const mimeType = getImageMimeType(entry);
  const imageStatus = getImageSupportStatus(mimeType);
  if (imageStatus === 'unsupported') return false;
  if (imageStatus === 'pending') {
    return (await resolveImageSupportStatus(mimeType)) !== 'unsupported';
  }
  return true;
};

const markPreloadedLightboxAsset = (key) => {
  pendingLightboxPreloads.delete(key);
  preloadedLightboxAssetKeys.add(key);
};

const clearPendingPreload = (key) => {
  pendingLightboxPreloads.delete(key);
};

const preloadImageAsset = (key, src, signal) => {
  const image = new Image();
  const abort = () => {
    image.onload = null;
    image.onerror = null;
    clearPendingPreload(key);
  };
  const cleanup = () => {
    image.onload = null;
    image.onerror = null;
    signal?.removeEventListener('abort', abort);
  };

  image.decoding = 'async';
  image.fetchPriority = 'low';
  image.onload = () => {
    cleanup();
    markPreloadedLightboxAsset(key);
  };
  image.onerror = () => {
    cleanup();
    clearPendingPreload(key);
  };

  signal?.addEventListener('abort', abort, { once: true });
  pendingLightboxPreloads.set(key, { abort });
  image.src = src;
};

const preloadAdjacentAsset = async (entry, signal) => {
  const key = entry?.path || '';
  if (!key || signal?.aborted) return;
  if (preloadedLightboxAssetKeys.has(key) || pendingLightboxPreloads.has(key)) return;
  const canPreload = await isEligibleForAdjacentPreload(entry);
  if (!canPreload || signal?.aborted) return;

  preloadImageAsset(key, buildFileUrl(key), signal);
};

const scheduleSpeculativePreload = (entry, signal) => {
  if (!entry?.path) return;

  const runPreload = () => {
    pendingLightboxIdleCallbackId = null;
    if (signal.aborted) return;
    void preloadAdjacentAsset(entry, signal);
  };

  cancelPendingIdlePreload();
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    pendingLightboxIdleCallbackId = window.requestIdleCallback(runPreload, { timeout: 250 });
    return;
  }
  pendingLightboxIdleCallbackId = window.setTimeout(runPreload, 120);
};

const waitForIdleSlice = (signal) =>
  new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    let settled = false;
    let idleId = null;
    let timeoutId = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', handleAbort);
      if (
        idleId !== null &&
        typeof window !== 'undefined' &&
        typeof window.cancelIdleCallback === 'function'
      ) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      resolve();
    };

    const handleAbort = () => {
      finish();
    };

    signal.addEventListener('abort', handleAbort, { once: true });
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(finish, { timeout: 300 });
      return;
    }
    timeoutId = window.setTimeout(finish, 140);
  });

const scheduleSpeculativePreloadSequence = async (entries, signal) => {
  for (const entry of entries) {
    if (!entry?.path || signal.aborted) {
      continue;
    }
    scheduleSpeculativePreload(entry, signal);
    await waitForIdleSlice(signal);
  }
};

const drainResponseBody = async (response) => {
  const reader = response.body?.getReader?.();
  if (!reader) {
    await response.arrayBuffer();
    return;
  }

  try {
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  } finally {
    reader.releaseLock?.();
  }
};

const getAdjacentPreloadEntries = (lightboxEntries, activeIndex, preloadDirection) => {
  if (activeIndex < 0) return [];
  if (preloadDirection === 'forward') {
    return [lightboxEntries[activeIndex + 1]].filter(Boolean);
  }
  if (preloadDirection === 'backward') {
    return [lightboxEntries[activeIndex - 1]].filter(Boolean);
  }
  return [lightboxEntries[activeIndex - 1], lightboxEntries[activeIndex + 1]].filter(Boolean);
};

export const useLightboxController = ({
  open,
  selectedEntry,
  lightboxEntries,
  activeIndex,
  onClose,
  onPrev,
  onNext,
  onNavigatePath,
  onDisableLargeFileWarnings,
  warnOnLargeFiles = true,
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
  const [displayedImagePath, setDisplayedImagePath] = useState('');
  const [preloadDirection, setPreloadDirection] = useState(null);
  const imageRef = useRef(null);
  const videoRef = useRef(null);
  const lightboxRef = useRef(null);
  const toolbarRef = useRef(null);
  const selectedPathRef = useRef('');

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
  const fileKey = selectedPath;
  const isLargeFile = Number.isFinite(selectedSize) && selectedSize >= LARGE_FILE_THRESHOLD_BYTES;
  const isSessionApprovedLargeFile = fileKey && loadedLargeFileKeys.has(fileKey);
  const isLargeText =
    isText && Number.isFinite(selectedSize) && selectedSize > TEXT_PREVIEW_MAX_BYTES;
  const canPreviewText = !isLargeText;
  const videoPlayable = isVideoPlayable(selectedEntry);
  const audioPlayable = isAudioPlayable(selectedEntry);
  const imageCapabilityKnown = imageSupportStatus !== 'pending';
  const canPreviewVideo = !isVideo || (videoPlayable && !videoPreviewFailed);
  const canPreviewImage = !isImage || (imageSupportStatus !== 'unsupported' && !imagePreviewFailed);
  const canPreviewAudio = !isAudio || audioPlayable;
  const canPreviewEntry =
    isViewableEntry(selectedEntry) &&
    canPreviewVideo &&
    canPreviewImage &&
    canPreviewAudio &&
    canPreviewText;
  const shouldWarnLargeFile =
    isLargeFile &&
    !isStreamable &&
    canPreviewEntry &&
    (!isImage || imageCapabilityKnown) &&
    warnOnLargeFiles;
  const shouldGateLargeFile =
    shouldWarnLargeFile && !largeFileWarningDismissed && !isSessionApprovedLargeFile;
  const shouldRenderImage = isImage && displayedImagePath === selectedPath;
  const isCurrentPreviewReady =
    !shouldGateLargeFile &&
    (() => {
      if (isImage) {
        return imageCapabilityKnown && canPreviewImage && !mediaLoading && shouldRenderImage;
      }
      if (isVideo) return canPreviewVideo && !mediaLoading;
      if (isAudio) return canPreviewAudio && Number.isFinite(mediaMeta.duration);
      if (isText) return textPreview.status === 'ready';
      return false;
    })();
  const showLargeFileWarning = shouldGateLargeFile;
  const showMediaPreview =
    !shouldGateLargeFile &&
    imageCapabilityKnown &&
    canPreviewVideo &&
    canPreviewImage &&
    (isImage || isVideo);
  const showImagePending = !shouldGateLargeFile && isImage && imageSupportStatus === 'pending';
  const showAudioPreview = !shouldGateLargeFile && isAudio && canPreviewAudio;
  const showDocumentPreview = !shouldGateLargeFile && isDocument;
  const showTextPreview = !shouldGateLargeFile && isText;
  const showUnknownPreview = !shouldGateLargeFile && !canPreviewEntry;
  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex >= 0 && activeIndex < lightboxEntries.length - 1;
  const activePosition = activeIndex >= 0 ? activeIndex + 1 : 0;
  const totalEntries = lightboxEntries.length;
  const pathValue = selectedPath;
  const pathLabel = pathValue ? `/${pathValue}` : '/';
  const dimensionsLabel = hasDimensions ? `${mediaMeta.width} × ${mediaMeta.height}` : '-- × --';

  useEffect(() => {
    selectedPathRef.current = selectedPath;
  }, [selectedPath]);

  useEffect(() => {
    if (!open) {
      setPreloadDirection(null);
      cancelPendingIdlePreload();
    }
  }, [open]);

  useEffect(() => {
    if (!open || !selectedPath || !isImage) {
      setDisplayedImagePath('');
      return undefined;
    }
    if (shouldGateLargeFile || !imageCapabilityKnown || !canPreviewImage) {
      setDisplayedImagePath('');
      return undefined;
    }

    cancelPendingIdlePreload();
    cancelPendingPreload(selectedPath);
    const isWarmedImage = preloadedLightboxAssetKeys.has(selectedPath);
    setDisplayedImagePath(isWarmedImage ? selectedPath : '');
    setMediaLoading(!isWarmedImage);

    const controller = new AbortController();

    const prepareCurrentImage = async () => {
      try {
        if (!isWarmedImage) {
          const response = await fetch(previewSource, {
            signal: controller.signal,
            priority: 'high',
          });
          if (!response.ok) {
            throw new Error('Failed to load image preview');
          }
          await drainResponseBody(response);
          preloadedLightboxAssetKeys.add(selectedPath);
        }

        if (controller.signal.aborted) return;
        setDisplayedImagePath(selectedPath);
      } catch (error) {
        if (controller.signal.aborted || error?.name === 'AbortError') return;
        setMediaLoading(false);
        setImagePreviewFailed(true);
      }
    };

    void prepareCurrentImage();

    return () => {
      controller.abort();
    };
  }, [
    canPreviewImage,
    imageCapabilityKnown,
    isImage,
    open,
    previewSource,
    selectedPath,
    shouldGateLargeFile,
  ]);

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
        setVideoPreviewFailed,
      });
      return;
    }
    if (isDirectory) {
      resetMediaState({
        setDisableLargeFileWarningsChecked,
        setImagePreviewFailed,
        setLargeFileWarningDismissed,
        setMediaMeta,
        setVideoPreviewFailed,
      });
      setMediaLoading(false);
      onClose();
      return;
    }
    resetMediaState({
      setDisableLargeFileWarningsChecked,
      setImagePreviewFailed,
      setLargeFileWarningDismissed,
      setMediaMeta,
      setVideoPreviewFailed,
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
    void resolveImageSupportStatus(selectedImageMimeType).then((status) => {
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
    if (isImage && !shouldRenderImage) return;
    if (isVideo && videoRef.current?.readyState >= 2) {
      setMediaLoading(false);
      setMediaMeta({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
        duration: videoRef.current.duration,
      });
    }
  }, [open, selectedPath, isImage, shouldRenderImage, isVideo]);

  useEffect(() => {
    if (!open || !selectedPath || !isVideo) return undefined;
    const frameId = requestAnimationFrame(() => {
      const video = videoRef.current;
      if (!video) return;
      setMediaLoading(video.readyState < 2);
    });
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [open, isVideo, selectedPath]);

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
          error.retryable =
            response.status >= 500 || response.status === 408 || response.status === 429;
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
          retryable: false,
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
          retryable,
        });
      }
    };

    void loadText();

    return () => {
      controller.abort();
    };
  }, [
    canPreviewText,
    isMarkdown,
    isText,
    open,
    previewSource,
    selectedPath,
    shouldGateLargeFile,
    textRetryToken,
  ]);

  useEffect(() => {
    if (open && isMarkdown) {
      void loadMarkdownLibs();
    }
  }, [open, isMarkdown]);

  useEffect(() => {
    if (!open || !isCurrentPreviewReady) return undefined;

    const preloadEntries = getAdjacentPreloadEntries(
      lightboxEntries,
      activeIndex,
      preloadDirection
    );
    const preloadKeys = preloadEntries.map((entry) => entry.path);
    if (!preloadKeys.length) return undefined;

    cancelPendingIdlePreload();
    const controller = new AbortController();
    void scheduleSpeculativePreloadSequence(preloadEntries, controller.signal);

    return () => {
      cancelPendingIdlePreload();
      if (selectedPathRef.current !== selectedPath) {
        controller.abort();
        preloadKeys.forEach(cancelPendingPreload);
      }
    };
  }, [activeIndex, isCurrentPreviewReady, lightboxEntries, open, preloadDirection, selectedPath]);

  const handlePrevAction = useCallback(() => {
    setPreloadDirection('backward');
    onPrev();
  }, [onPrev]);

  const handleNextAction = useCallback(() => {
    setPreloadDirection('forward');
    onNext();
  }, [onNext]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
      if (event.key === 'ArrowLeft') {
        handlePrevAction();
      }
      if (event.key === 'ArrowRight') {
        handleNextAction();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleNextAction, handlePrevAction, onClose, open]);

  useEffect(() => {
    if (!open) return undefined;
    const lightboxEl = lightboxRef.current;
    const toolbarEl = toolbarRef.current;
    if (!lightboxEl || !toolbarEl) return undefined;

    let frameId;
    const updateToolbarHeight = () => {
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

    window.addEventListener('resize', updateToolbarHeight);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateToolbarHeight);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [open, selectedPath]);

  const handleRetryTextPreview = useCallback(() => {
    setTextRetryToken((prev) => prev + 1);
  }, []);

  const handleLoadLargeFile = useCallback(() => {
    if (fileKey) {
      loadedLargeFileKeys.add(fileKey);
    }
    if (disableLargeFileWarningsChecked) {
      onDisableLargeFileWarnings?.();
    }
    setLargeFileWarningDismissed(true);
  }, [disableLargeFileWarningsChecked, fileKey, onDisableLargeFileWarnings]);

  const handleNavigateFromPath = useCallback(() => {
    onNavigatePath?.(selectedEntry);
  }, [onNavigatePath, selectedEntry]);

  const handleImageLoad = useCallback(
    (event) => {
      if (selectedPath) {
        preloadedLightboxAssetKeys.add(selectedPath);
      }
      setMediaLoading(false);
      setMediaMeta({
        width: event.currentTarget.naturalWidth,
        height: event.currentTarget.naturalHeight,
        duration: null,
      });
    },
    [selectedPath]
  );

  const handleImageError = useCallback(() => {
    setMediaLoading(false);
    setImagePreviewFailed(true);
  }, []);

  const handleVideoLoadedMetadata = useCallback((event) => {
    setMediaMeta({
      width: event.currentTarget.videoWidth,
      height: event.currentTarget.videoHeight,
      duration: event.currentTarget.duration,
    });
  }, []);

  const handleVideoLoadedData = useCallback(() => {
    setMediaLoading(false);
  }, []);

  const handleVideoError = useCallback(() => {
    setMediaLoading(false);
    setVideoPreviewFailed(true);
  }, []);

  const handleAudioLoadedMetadata = useCallback((event) => {
    setMediaMeta({
      width: null,
      height: null,
      duration: event.currentTarget.duration,
    });
  }, []);

  return {
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
    isAudio,
    isDirectory,
    isDocument,
    isImage,
    isMarkdown,
    isSvg,
    isText,
    isVideo,
    lightboxRef,
    mediaLoading,
    mediaMeta,
    pathLabel,
    pathValue,
    previewSource,
    selectedEntry,
    selectedName,
    selectedPath,
    selectedSize,
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
  };
};
