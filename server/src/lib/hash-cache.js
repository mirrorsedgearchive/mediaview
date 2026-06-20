import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import {
  CACHE_ROOT,
  EXCLUDED_PATTERNS,
  HASH_CACHE_SCAN_INTERVAL_MS,
  ROOT_DIR,
  ROOT_NAME,
  SITE_ORIGIN,
  SITEMAP_FILE,
} from '../config.js';
import { isExcludedPath, isHiddenPath } from './exclude.js';
import { classifyFile } from './classify.js';
import { writeSitemap } from './sitemap.js';

export const HASH_CACHE_DIR = CACHE_ROOT;
export const HASH_CACHE_FILE = path.join(HASH_CACHE_DIR, 'file-hashes.json');
const MAX_WORKER_CACHE_ENTRIES = 20000;
export const THUMB_ERR_LIMIT = 2;

const HASH_CACHE = new Map();
const ENTRY_INDEX = new Map();
const DIR_CHILDREN = new Map();
const NAME_INDEX = new Map();
const hashListeners = new Set();
const scanListeners = new Set();
let cacheWorker = null;
let cacheFileWatcher = null;
let cacheWatchTimer = null;
let flushTimer = null;
let flushing = false;
let unsubscribeWorkerUpdates = null;
let dirtyGeneration = 0;
let flushedGeneration = 0;
let cacheLoaded = false;
let cacheEpoch = 0;
const cacheStatus = {
  lastScanStart: null,
  lastScanEnd: null,
  lastScanDurationMs: null,
  lastScanUpdates: 0,
  lastScanRemovals: 0,
};
let sitemapHash = null;
const pendingThumbUpdates = new Map();
const pendingThumbRemovals = new Map();
const CACHE_WATCH_DEBOUNCE_MS = 200;
const shouldWriteSitemap = () => process.env.MEDIAVIEW_MODE !== 'server';

const getParentPath = (relativePath) => {
  if (!relativePath) return null;
  const trimmed = relativePath.replace(/\/+$/, '');
  if (!trimmed) return null;
  const segments = trimmed.split('/');
  if (segments.length <= 1) return '';
  return segments.slice(0, -1).join('/');
};

const ensureDirEntry = (relativePath) => {
  const key = relativePath || '';
  const existing = ENTRY_INDEX.get(key);
  if (!existing || !existing.isDir) {
    const name = key ? path.basename(key) : ROOT_NAME;
    ENTRY_INDEX.set(key, {
      name,
      path: key,
      isDir: true,
      size: null,
      ext: '',
      type: 'dir',
    });
    NAME_INDEX.set(key, name.toLowerCase());
  } else if (existing?.name) {
    NAME_INDEX.set(key, existing.name.toLowerCase());
  }
  if (!DIR_CHILDREN.has(key)) {
    DIR_CHILDREN.set(key, new Set());
  }
  const parentPath = getParentPath(key);
  if (parentPath !== null && key !== '') {
    ensureDirEntry(parentPath);
    DIR_CHILDREN.get(parentPath).add(key);
  }
};

const upsertFileEntry = (relativePath, entry) => {
  if (!relativePath) return;
  const ext = path.extname(relativePath).toLowerCase();
  const name = path.basename(relativePath);
  ENTRY_INDEX.set(relativePath, {
    name,
    path: relativePath,
    isDir: false,
    size: entry.size ?? null,
    ext,
    type: classifyFile(ext),
  });
  NAME_INDEX.set(relativePath, name.toLowerCase());
  const parentPath = getParentPath(relativePath);
  if (parentPath !== null) {
    ensureDirEntry(parentPath);
    DIR_CHILDREN.get(parentPath).add(relativePath);
  }
};

const removeEntryIndex = (relativePath) => {
  if (relativePath === '') return false;
  const existing = ENTRY_INDEX.get(relativePath);
  if (!existing) return false;
  if (existing.isDir) {
    const children = DIR_CHILDREN.get(relativePath);
    if (children) {
      [...children].forEach((childPath) => removeEntryIndex(childPath));
    }
    DIR_CHILDREN.delete(relativePath);
  }
  ENTRY_INDEX.delete(relativePath);
  NAME_INDEX.delete(relativePath);
  const parentPath = getParentPath(relativePath);
  if (parentPath !== null) {
    DIR_CHILDREN.get(parentPath)?.delete(relativePath);
  }
  return true;
};

ensureDirEntry('');

const ensureCacheDir = async () => {
  await fsPromises.mkdir(HASH_CACHE_DIR, { recursive: true });
};

const serializeCache = () => {
  const entries = {};
  for (const [relativePath, entry] of HASH_CACHE.entries()) {
    const payload = {
      hash: entry.hash,
      mtimeMs: entry.mtimeMs,
      size: entry.size ?? null,
    };
    if ((entry.thumbErrCount ?? 0) > 0) {
      payload.thumbErrCount = entry.thumbErrCount;
    }
    entries[relativePath] = payload;
  }
  return { version: 1, entries };
};

const markDirty = () => {
  dirtyGeneration += 1;
};

const isDirty = () => dirtyGeneration !== flushedGeneration;

const writeCacheFile = async () => {
  if (flushing) return;
  if (!isDirty()) return;
  flushing = true;
  const targetGeneration = dirtyGeneration;
  try {
    await ensureCacheDir();
    const payload = JSON.stringify(serializeCache());
    const tmpPath = `${HASH_CACHE_FILE}.tmp`;
    await fsPromises.writeFile(tmpPath, payload, 'utf8');
    await fsPromises.rename(tmpPath, HASH_CACHE_FILE);
    try {
      await writeSitemapIfChanged();
    } catch (error) {
      console.error('Failed to write sitemap', error);
    }
    flushedGeneration = targetGeneration;
  } catch (error) {
    console.error('Failed to write hash cache', error);
  } finally {
    flushing = false;
    if (isDirty()) {
      scheduleFlush();
    }
  }
};

const scheduleFlush = () => {
  if (!isDirty()) return;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void writeCacheFile();
  }, 500);
};

const resetCacheState = () => {
  HASH_CACHE.clear();
  ENTRY_INDEX.clear();
  DIR_CHILDREN.clear();
  NAME_INDEX.clear();
  pendingThumbUpdates.clear();
  pendingThumbRemovals.clear();
  ensureDirEntry('');
  dirtyGeneration = 0;
  flushedGeneration = 0;
};

const applyCacheEntries = (entries) => {
  resetCacheState();
  Object.entries(entries).forEach(([relativePath, entry]) => {
    if (!entry?.hash || !Number.isFinite(entry.mtimeMs)) return;
    const thumbErrCount = Number.isFinite(entry.thumbErrCount) ? entry.thumbErrCount : 0;
    const payload = {
      hash: entry.hash,
      mtimeMs: entry.mtimeMs,
      size: entry.size ?? null,
    };
    if (thumbErrCount > 0) {
      payload.thumbErrCount = thumbErrCount;
    }
    HASH_CACHE.set(relativePath, payload);
    upsertFileEntry(relativePath, entry);
  });
};

const emitHashUpdate = (entry) => {
  hashListeners.forEach((listener) => listener(entry));
};

export const onHashUpdate = (listener) => {
  hashListeners.add(listener);
  return () => hashListeners.delete(listener);
};

export const onHashScanComplete = (listener) => {
  scanListeners.add(listener);
  return () => scanListeners.delete(listener);
};

const queueThumbUpdate = (entry, previousHash) => {
  if (!entry?.path) return;
  const existing = pendingThumbUpdates.get(entry.path);
  const nextPreviousHash = previousHash || existing?.previousHash;
  pendingThumbUpdates.set(entry.path, {
    ...entry,
    previousHash: nextPreviousHash,
  });
  pendingThumbRemovals.delete(entry.path);
};

const queueThumbRemoval = (relativePath, removalHash) => {
  if (!relativePath) return;
  const existing = pendingThumbUpdates.get(relativePath);
  const hash = removalHash || existing?.hash || existing?.previousHash || null;
  pendingThumbUpdates.delete(relativePath);
  pendingThumbRemovals.set(relativePath, { path: relativePath, hash });
};

const flushThumbQueue = () => {
  const updates = [...pendingThumbUpdates.values()];
  const removals = [...pendingThumbRemovals.values()];
  pendingThumbUpdates.clear();
  pendingThumbRemovals.clear();
  return { updates, removals };
};

export const setHashEntry = (relativePath, entry, options = {}) => {
  if (!relativePath || !entry?.hash) return;
  const existing = HASH_CACHE.get(relativePath);
  const thumbErrCount = existing?.hash === entry.hash ? (existing?.thumbErrCount ?? 0) : 0;
  const payload = {
    hash: entry.hash,
    mtimeMs: entry.mtimeMs,
    size: entry.size ?? null,
  };
  if (thumbErrCount > 0) {
    payload.thumbErrCount = thumbErrCount;
  }
  HASH_CACHE.set(relativePath, payload);
  upsertFileEntry(relativePath, entry);
  markDirty();
  if (options.emit !== false) {
    emitHashUpdate({
      path: relativePath,
      hash: entry.hash,
      mtimeMs: entry.mtimeMs,
      size: entry.size ?? null,
    });
  }
  if (options.persist !== false) {
    scheduleFlush();
  }
};

export const removeHashEntry = (relativePath, options = {}) => {
  if (!HASH_CACHE.delete(relativePath)) return;
  markDirty();
  const existing = ENTRY_INDEX.get(relativePath);
  if (existing && !existing.isDir) {
    removeEntryIndex(relativePath);
  }
  if (options.persist !== false) {
    scheduleFlush();
  }
};

export const loadHashCache = async () => {
  await ensureCacheDir();
  let loaded = false;
  try {
    const contents = await fsPromises.readFile(HASH_CACHE_FILE, 'utf8');
    const data = JSON.parse(contents);
    const entries = data?.entries || {};
    applyCacheEntries(entries);
    loaded = true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      applyCacheEntries({});
      loaded = true;
    } else {
      console.error('Failed to read hash cache', error);
    }
  } finally {
    cacheLoaded = loaded;
  }
  if (loaded) {
    cacheEpoch += 1;
    sitemapHash = null;
    try {
      await writeSitemapIfChanged();
    } catch (error) {
      console.error('Failed to write sitemap', error);
    }
  }
  return loaded;
};

export const getHashEntry = (relativePath) => HASH_CACHE.get(relativePath) || null;

export const getHashEntries = () => {
  const entries = [];
  for (const [relativePath, entry] of HASH_CACHE.entries()) {
    const payload = {
      path: relativePath,
      hash: entry.hash,
      mtimeMs: entry.mtimeMs,
      size: entry.size ?? null,
    };
    if ((entry.thumbErrCount ?? 0) > 0) {
      payload.thumbErrCount = entry.thumbErrCount;
    }
    entries.push(payload);
  }
  return entries;
};

export const hasHashEntry = (relativePath) => HASH_CACHE.has(relativePath);

export const getThumbErrCount = (relativePath) => HASH_CACHE.get(relativePath)?.thumbErrCount ?? 0;

export const incrementThumbErrCount = (relativePath) => {
  if (!relativePath) return 0;
  const existing = HASH_CACHE.get(relativePath);
  if (!existing) return 0;
  const nextCount = (existing.thumbErrCount ?? 0) + 1;
  HASH_CACHE.set(relativePath, { ...existing, thumbErrCount: nextCount });
  markDirty();
  scheduleFlush();
  return nextCount;
};

export const resetThumbErrCount = (relativePath) => {
  if (!relativePath) return;
  const existing = HASH_CACHE.get(relativePath);
  if (!existing || (existing.thumbErrCount ?? 0) === 0) return;
  const rest = { ...existing };
  delete rest.thumbErrCount;
  HASH_CACHE.set(relativePath, rest);
  markDirty();
  scheduleFlush();
};

export const hasDirectoryEntry = (relativePath) =>
  ENTRY_INDEX.get(relativePath || '')?.isDir === true;

export const getDirectoryEntries = (relativePath) => {
  const key = relativePath || '';
  const children = DIR_CHILDREN.get(key);
  if (!children) return null;
  const entries = [];
  children.forEach((childPath) => {
    const entry = ENTRY_INDEX.get(childPath);
    if (entry && !isHiddenPath(childPath)) entries.push(entry);
  });
  entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  return entries;
};

export const getDirectoryTree = () => {
  const nodes = {};
  for (const [pathValue, entry] of ENTRY_INDEX.entries()) {
    if (!entry?.isDir) continue;
    if (isHiddenPath(pathValue)) continue;
    nodes[pathValue] = {
      name: entry.name || (pathValue ? path.basename(pathValue) : ROOT_NAME),
      path: pathValue,
      parent: getParentPath(pathValue),
    };
  }
  return nodes;
};

export const setDirectoryEntry = (relativePath) => {
  if (relativePath === null || relativePath === undefined) return;
  ensureDirEntry(relativePath);
};

export const removeDirectoryEntry = (relativePath) => {
  if (!relativePath) return;
  if (ENTRY_INDEX.get(relativePath)?.isDir) {
    removeEntryIndex(relativePath);
  }
};

export const startHashCacheWorker = async () => {
  if (cacheWorker) return;
  await ensureCacheDir();
  try {
    const shouldShareInitialEntries = cacheLoaded && HASH_CACHE.size <= MAX_WORKER_CACHE_ENTRIES;
    const serialized = shouldShareInitialEntries ? serializeCache() : null;
    cacheWorker = new Worker(new URL('../worker/hash-cache-worker.js', import.meta.url), {
      workerData: {
        rootDir: ROOT_DIR,
        cacheFile: HASH_CACHE_FILE,
        excludedPatterns: EXCLUDED_PATTERNS,
        scanIntervalMs: HASH_CACHE_SCAN_INTERVAL_MS,
        initialEntries: serialized ? serialized.entries : null,
        initialEntriesLoaded: shouldShareInitialEntries,
      },
    });
    cacheWorker.on('message', (message) => {
      if (!message) return;
      if (message.type === 'hash-update' && Array.isArray(message.entries)) {
        message.entries.forEach((entry) => {
          if (!entry?.path) return;
          const previousHash = HASH_CACHE.get(entry.path)?.hash || null;
          setHashEntry(entry.path, entry, { persist: false });
          queueThumbUpdate(entry, previousHash);
        });
      }
      if (message.type === 'dir-update' && Array.isArray(message.entries)) {
        message.entries.forEach((entry) => {
          if (!entry?.path) return;
          setDirectoryEntry(entry.path);
        });
      }
      if (message.type === 'hash-remove' && Array.isArray(message.paths)) {
        message.paths.forEach((pathValue) => {
          const previousHash = HASH_CACHE.get(pathValue)?.hash || null;
          removeHashEntry(pathValue, { persist: false });
          queueThumbRemoval(pathValue, previousHash);
        });
      }
      if (message.type === 'dir-remove' && Array.isArray(message.paths)) {
        message.paths.forEach((pathValue) => removeDirectoryEntry(pathValue));
      }
      if (message.type === 'scan-start') {
        cacheStatus.lastScanStart = message.startedAt;
        cacheStatus.lastScanEnd = null;
        cacheStatus.lastScanDurationMs = null;
        cacheStatus.lastScanUpdates = 0;
        cacheStatus.lastScanRemovals = 0;
      }
      if (message.type === 'scan-complete') {
        cacheStatus.lastScanStart = message.startedAt;
        cacheStatus.lastScanEnd = message.finishedAt;
        cacheStatus.lastScanDurationMs = message.finishedAt - message.startedAt;
        cacheStatus.lastScanUpdates = message.updatedCount || 0;
        cacheStatus.lastScanRemovals = message.removedCount || 0;
        cacheEpoch += 1;
        sitemapHash = null;
        const { updates, removals } = flushThumbQueue();
        scanListeners.forEach((listener) =>
          listener({
            status: cacheStatus,
            updates,
            removals,
          })
        );
        if (isDirty()) {
          scheduleFlush();
        }
      }
    });
    unsubscribeWorkerUpdates?.();
    unsubscribeWorkerUpdates = onHashUpdate((entry) => {
      if (!cacheWorker || !entry?.path) return;
      cacheWorker.postMessage({ type: 'hash-update', entry });
    });
    cacheWorker.on('error', (error) => {
      console.error('Hash cache worker error', error);
    });
    cacheWorker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Hash cache worker exited with code ${code}`);
      }
    });
  } catch (error) {
    console.error('Failed to start hash cache worker', error);
  }
};

const scheduleCacheReload = () => {
  if (cacheWatchTimer) {
    clearTimeout(cacheWatchTimer);
  }
  cacheWatchTimer = setTimeout(() => {
    cacheWatchTimer = null;
    void loadHashCache();
  }, CACHE_WATCH_DEBOUNCE_MS);
};

export const startHashCacheFileWatcher = async () => {
  if (cacheFileWatcher) return;
  await ensureCacheDir();
  try {
    const watchDir = path.dirname(HASH_CACHE_FILE);
    cacheFileWatcher = fs.watch(watchDir, (_event, filename) => {
      if (!filename) {
        scheduleCacheReload();
        return;
      }
      const name = filename.toString();
      if (name === path.basename(HASH_CACHE_FILE) || name.endsWith('.tmp')) {
        scheduleCacheReload();
      }
    });
    cacheFileWatcher.on('error', (error) => {
      console.error('Hash cache file watcher error', error);
    });
  } catch (error) {
    console.error('Failed to watch hash cache file', error);
  }
};

export const getHashCacheStatus = () => ({
  entries: HASH_CACHE.size,
  workerRunning: Boolean(cacheWorker),
  thumbErrors: {
    limit: THUMB_ERR_LIMIT,
    paths: [...HASH_CACHE.entries()]
      .filter(([, entry]) => (entry?.thumbErrCount ?? 0) > THUMB_ERR_LIMIT)
      .map(([relativePath]) => relativePath),
  },
  lastScan: {
    startedAt: cacheStatus.lastScanStart ? new Date(cacheStatus.lastScanStart).toISOString() : null,
    finishedAt: cacheStatus.lastScanEnd ? new Date(cacheStatus.lastScanEnd).toISOString() : null,
    durationMs: cacheStatus.lastScanDurationMs,
    updates: cacheStatus.lastScanUpdates,
    removals: cacheStatus.lastScanRemovals,
  },
});

export const getCacheGeneration = () => dirtyGeneration;
export const getCacheEpoch = () => cacheEpoch;

const writeSitemapIfChanged = async () => {
  if (!shouldWriteSitemap()) return;
  const directories = [...ENTRY_INDEX.entries()]
    .filter(
      ([pathValue, entry]) => entry?.isDir && !isHiddenPath(pathValue) && !isExcludedPath(pathValue)
    )
    .map(([pathValue]) => pathValue);
  const nextHash = directories.join('\n');
  if (nextHash === sitemapHash) return;
  await writeSitemap({
    directories,
    targetPath: SITEMAP_FILE,
    baseUrl: SITE_ORIGIN,
    gzip: true,
  });
  sitemapHash = nextHash;
};

const DEFAULT_SEARCH_LIMIT = 100;
const SEARCH_CHUNK_SIZE = 500;

export const searchHashCache = async (query) => {
  const normalized = String(query || '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    return { results: [], truncated: false };
  }
  const limit = DEFAULT_SEARCH_LIMIT;
  const results = [];
  let truncated = false;
  let scanned = 0;

  for (const [pathValue, nameLower] of NAME_INDEX.entries()) {
    if (!pathValue || isHiddenPath(pathValue)) {
      continue;
    }
    scanned += 1;
    if (nameLower && nameLower.includes(normalized)) {
      const entry = ENTRY_INDEX.get(pathValue);
      if (entry) {
        results.push({
          name: entry.name,
          path: entry.path,
          isDir: entry.isDir,
          size: entry.size ?? null,
          ext: entry.ext,
          type: entry.type,
        });
      }
      if (results.length >= limit) {
        truncated = true;
        break;
      }
    }
    if (scanned % SEARCH_CHUNK_SIZE === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  results.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return { results, truncated };
};
