const IMAGE_EXTS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.avif',
  '.tiff',
  '.tif',
  '.heic',
  '.ico',
]);
const VIDEO_EXTS = new Set([
  '.mp4',
  '.m4v',
  '.webm',
  '.mov',
  '.mkv',
  '.avi',
  '.mpg',
  '.mpeg',
  '.wmv',
  '.flv',
  '.f4v',
  '.3gp',
  '.3g2',
  '.ogv',
  '.mts',
  '.m2ts',
  '.ts',
  '.vob',
  '.rm',
  '.rmvb',
  '.asf',
  '.mxf',
  '.m1v',
  '.m2v',
]);
const AUDIO_EXTS = new Set([
  '.mp3',
  '.m4a',
  '.aac',
  '.wav',
  '.flac',
  '.ogg',
  '.wma',
  '.alac',
  '.aiff',
]);
const ARCHIVE_EXTS = new Set([
  '.zip',
  '.rar',
  '.7z',
  '.tar',
  '.gz',
  '.tgz',
  '.bz2',
  '.tbz',
  '.tbz2',
  '.xz',
  '.txz',
  '.lz',
  '.lzma',
  '.z',
  '.zst',
  '.iso',
  '.cab',
  '.arj',
  '.ace',
  '.jar',
  '.war',
  '.ear',
  '.apk',
  '.ipa',
]);
const DOC_EXTS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.odt',
  '.ods',
  '.odp',
]);
const DOC_PREVIEW_EXTS = new Set(['.pdf']);
const TEXT_EXTS = new Set(['.txt', '.md', '.json', '.csv', '.log']);

export const VIEWABLE_TYPES = new Set(['image', 'video', 'audio', 'text']);

export const getEntryExtension = (entry) => {
  if (!entry) return '';
  const rawExt =
    entry.ext ||
    (entry.name && entry.name.includes('.') ? entry.name.slice(entry.name.lastIndexOf('.')) : '');
  return rawExt ? rawExt.toLowerCase() : '';
};

export const isVideoEntry = (entry) => {
  if (!entry || entry.isDir) return false;
  if (entry.type === 'video') return true;
  const ext = getEntryExtension(entry);
  return VIDEO_EXTS.has(ext);
};

export const isAudioEntry = (entry) => {
  if (!entry || entry.isDir) return false;
  if (entry.type === 'audio') return true;
  const ext = getEntryExtension(entry);
  return AUDIO_EXTS.has(ext);
};

export const isImageEntry = (entry) => {
  if (!entry || entry.isDir) return false;
  if (entry.type === 'image') return true;
  const ext = getEntryExtension(entry);
  return IMAGE_EXTS.has(ext);
};

export const isDocumentEntry = (entry) => {
  if (!entry || entry.isDir) return false;
  if (entry.type === 'document') return true;
  const ext = getEntryExtension(entry);
  return DOC_EXTS.has(ext);
};

export const isDocumentPreviewEntry = (entry) => {
  if (!entry || entry.isDir) return false;
  const ext = getEntryExtension(entry);
  return DOC_PREVIEW_EXTS.has(ext);
};

export const isTextEntry = (entry) => {
  if (!entry || entry.isDir) return false;
  if (entry.type === 'text') return true;
  const ext = getEntryExtension(entry);
  return TEXT_EXTS.has(ext);
};

export const isArchiveEntry = (entry) => {
  if (!entry || entry.isDir) return false;
  if (entry.type === 'archive') return true;
  const ext = getEntryExtension(entry);
  return ARCHIVE_EXTS.has(ext);
};

export const isViewableEntry = (entry) =>
  Boolean(
    entry &&
    !entry.isDir &&
    (VIEWABLE_TYPES.has(entry.type) ||
      isImageEntry(entry) ||
      isVideoEntry(entry) ||
      isAudioEntry(entry) ||
      isDocumentPreviewEntry(entry) ||
      isTextEntry(entry))
  );

export const fileTypeLabel = (entry) => {
  if (entry.isDir) return 'Folder';
  if (isImageEntry(entry)) return 'Image';
  if (isVideoEntry(entry)) return 'Video';
  if (isAudioEntry(entry)) return 'Audio';
  if (isArchiveEntry(entry)) return 'Archive';
  if (isDocumentEntry(entry)) return 'Document';
  if (isTextEntry(entry)) return 'Text';
  switch (entry.type) {
    case 'audio':
      return 'Audio';
    case 'document':
      return 'Document';
    case 'text':
      return 'Text';
    default:
      return 'File';
  }
};
