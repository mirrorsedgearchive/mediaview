import { EXCLUDED_PATTERNS, HIDDEN_PATTERNS } from '../config.js';
import { toPosix } from './paths.js';

const CUSTOM_FOLDER_THUMBNAIL_NAME = /^folder_thumb_[1-4]\.(?:jpg|png)$/;
const CONTENT_WARNING_FILE_NAME = 'content-warning.txt';

export const isCustomFolderThumbnailPath = (relativePath) => {
  if (!relativePath) return false;
  return CUSTOM_FOLDER_THUMBNAIL_NAME.test(toPosix(relativePath).split('/').pop());
};

export const isExcludedPathWithPatterns = (relativePath, patterns) => {
  if (!relativePath) return false;
  const posixPath = toPosix(relativePath);
  if (!patterns || patterns.length === 0) return false;
  const normalizedPath = posixPath.replace(/\/+$/, '');
  const segments = normalizedPath.split('/').filter(Boolean);
  return patterns.some((pattern) => {
    const normalizedPattern = toPosix(pattern).replace(/\/+$/, '');
    if (!normalizedPattern) return false;
    return segments.some((segment) => segment.startsWith(normalizedPattern));
  });
};

export const isExcludedPath = (relativePath) =>
  isExcludedPathWithPatterns(relativePath, EXCLUDED_PATTERNS);

export const isHiddenPath = (relativePath) =>
  isCustomFolderThumbnailPath(relativePath) ||
  toPosix(relativePath).split('/').pop() === CONTENT_WARNING_FILE_NAME ||
  isExcludedPathWithPatterns(relativePath, HIDDEN_PATTERNS);
