import {
  getEntryExtension,
  isAudioEntry,
  isVideoEntry
} from './fileTypes.js';

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

const videoSupportCache = new Map();
const audioSupportCache = new Map();
const imageSupportCache = new Map();
const pendingImageSupportCache = new Map();

const getImageDecoder = () => {
  if (typeof window === 'undefined' || typeof window.ImageDecoder === 'undefined') {
    return null;
  }
  return window.ImageDecoder;
};

const getMimeType = (entry, mimeTypes) => {
  const ext = getEntryExtension(entry);
  return mimeTypes[ext] || '';
};

const probeCanPlayType = (tagName, mimeType, cache) => {
  if (!mimeType) return true;
  if (cache.has(mimeType)) {
    return cache.get(mimeType);
  }
  const probe = document.createElement(tagName);
  const result = probe.canPlayType(mimeType);
  const playable = result === 'probably' || result === 'maybe';
  cache.set(mimeType, playable);
  return playable;
};

export const getImageMimeType = (entry) => {
  return getMimeType(entry, IMAGE_MIME_TYPES);
};

export const isVideoPlayable = (entry) => {
  if (!isVideoEntry(entry)) return true;
  if (typeof document === 'undefined') return true;
  const ext = getEntryExtension(entry);
  if (ext === '.mkv') return true;
  return probeCanPlayType('video', getMimeType(entry, VIDEO_MIME_TYPES), videoSupportCache);
};

export const isAudioPlayable = (entry) => {
  if (!isAudioEntry(entry)) return true;
  if (typeof document === 'undefined') return true;
  return probeCanPlayType('audio', getMimeType(entry, AUDIO_MIME_TYPES), audioSupportCache);
};

export const getImageSupportStatus = (mimeType) => {
  if (typeof document === 'undefined') return 'supported';
  if (!mimeType) return 'supported';
  if (mimeType === 'image/svg+xml') return 'supported';
  if (imageSupportCache.has(mimeType)) {
    return imageSupportCache.get(mimeType);
  }
  return getImageDecoder()?.isTypeSupported ? 'pending' : 'supported';
};

export const resolveImageSupportStatus = async (mimeType) => {
  if (!mimeType || mimeType === 'image/svg+xml') {
    return 'supported';
  }
  const cachedStatus = imageSupportCache.get(mimeType);
  if (cachedStatus && cachedStatus !== 'pending') {
    return cachedStatus;
  }
  const ImageDecoderCtor = getImageDecoder();
  if (!ImageDecoderCtor?.isTypeSupported) {
    imageSupportCache.set(mimeType, 'supported');
    return 'supported';
  }
  if (pendingImageSupportCache.has(mimeType)) {
    return pendingImageSupportCache.get(mimeType);
  }
  imageSupportCache.set(mimeType, 'pending');
  const pendingStatus = ImageDecoderCtor.isTypeSupported(mimeType)
    .then((supported) => {
      const resolvedStatus = supported ? 'supported' : 'unsupported';
      imageSupportCache.set(mimeType, resolvedStatus);
      pendingImageSupportCache.delete(mimeType);
      return resolvedStatus;
    })
    .catch(() => {
      imageSupportCache.set(mimeType, 'supported');
      pendingImageSupportCache.delete(mimeType);
      return 'supported';
    });
  pendingImageSupportCache.set(mimeType, pendingStatus);
  return pendingStatus;
};
