import path from 'node:path';

export const PORT = process.env.PORT || 3001;
export const ROOT_DIR = process.env.ARCHIVE_ROOT
  ? path.resolve(process.env.ARCHIVE_ROOT)
  : path.resolve(process.cwd(), 'archive');
export const ROOT_NAME = path.basename(ROOT_DIR);
export const ROOT_PREFIX = ROOT_DIR.endsWith(path.sep) ? ROOT_DIR : `${ROOT_DIR}${path.sep}`;
export const CACHE_ROOT = process.env.CACHE_ROOT
  ? path.resolve(process.env.CACHE_ROOT)
  : path.join(ROOT_DIR, '.cache');
export const THUMB_DIR = path.join(CACHE_ROOT, 'thumbnails');
export const CLIENT_DIST = process.env.CLIENT_DIST
  ? path.resolve(process.env.CLIENT_DIST)
  : path.resolve(process.cwd(), '../client/dist');
export const SITEMAP_FILE = path.join(CACHE_ROOT, 'sitemap.xml');
export const SITE_ORIGIN = process.env.SITE_ORIGIN || '';
export const THUMB_EXT = '.avif';
export const THUMB_SIZES = {
  sm: 200,
  md: 400,
  lg: 600,
};
export const CONTENT_WARNING_FILE = 'content-warning.txt';
export const HASH_CACHE_SCAN_INTERVAL_MS = Number(process.env.HASH_CACHE_SCAN_INTERVAL_MS) || 60000;

const DEFAULT_EXCLUDED_PATTERNS = ['.DS_Store', '_h5ai'];
const DEFAULT_HIDDEN_PATTERNS = ['unlisted_'];

export const EXCLUDED_PATTERNS = [
  ...DEFAULT_EXCLUDED_PATTERNS,
  ...(process.env.EXCLUDED_PATTERNS || '')
    .split(',')
    .map((pattern) => pattern.trim())
    .filter(Boolean),
];

export const HIDDEN_PATTERNS = [
  ...DEFAULT_HIDDEN_PATTERNS,
  ...(process.env.HIDDEN_PATTERNS || '')
    .split(',')
    .map((pattern) => pattern.trim())
    .filter(Boolean),
];
