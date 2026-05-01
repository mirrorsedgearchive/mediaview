import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { EXCLUDED_PATTERNS, ROOT_DIR, THUMB_DIR, THUMB_EXT, THUMB_SIZES } from '../config.js';
import { isThumbablePath } from './classify.js';
import {
  THUMB_ERR_LIMIT,
  getHashEntries,
  getHashEntry,
  getThumbErrCount,
  incrementThumbErrCount,
  resetThumbErrCount,
  onHashScanComplete,
} from './hash-cache.js';

const WORKER_POOL_LIMIT = 4;
const VERIFY_THUMBS_INTERVAL_MS = 60 * 60 * 1000;
const POST_SCAN_VERIFY_DELAY_MS = 5 * 1000;
const thumbnailWorkers = [];
let unsubscribeScanComplete = null;
let verifyTimer = null;
let verifyingThumbs = false;
let postScanVerifyTimer = null;
let initialScanVerified = false;

const ensureThumbDir = async () => {
  try {
    await fsPromises.mkdir(THUMB_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to ensure thumbnail directory', error);
  }
};

export const getThumbName = (hash, variant, originalName, ext = THUMB_EXT) => {
  const normalized = ext.startsWith('.') ? ext : `.${ext}`;
  return `${hash}-${variant}-${originalName}${normalized}`;
};

export const getThumbPath = (hash, variant, originalName, ext = THUMB_EXT) =>
  path.join(THUMB_DIR, getThumbName(hash, variant, originalName, ext));

export const enqueueThumbnailJobs = (paths) => {
  if (thumbnailWorkers.length === 0 || paths.length === 0) return;
  const uniquePaths = new Set(paths);
  const entries = [];
  uniquePaths.forEach((relativePath) => {
    const cached = getHashEntry(relativePath);
    if (!cached?.hash) return;
    if (getThumbErrCount(relativePath) > THUMB_ERR_LIMIT) return;
    entries.push({
      path: relativePath,
      hash: cached.hash,
      mtimeMs: cached.mtimeMs,
      size: cached.size ?? null,
    });
  });
  if (entries.length === 0) return;
  const buckets = new Map();
  entries.forEach((entry) => {
    const index = getWorkerIndex(entry.path);
    if (!buckets.has(index)) buckets.set(index, []);
    buckets.get(index).push(entry);
  });
  buckets.forEach((bucketEntries, index) => {
    const worker = thumbnailWorkers[index];
    if (!worker) return;
    worker.postMessage({ type: 'enqueue', entries: bucketEntries });
  });
};

const verifyThumbnailCoverage = () => {
  if (thumbnailWorkers.length === 0 || verifyingThumbs) return;
  verifyingThumbs = true;
  try {
    const candidates = [];
    const sizeKeys = Object.keys(THUMB_SIZES);
    const entries = getHashEntries();
    entries.forEach((entry) => {
      if (!entry?.path || !entry?.hash) return;
      if (getThumbErrCount(entry.path) > THUMB_ERR_LIMIT) return;
      if (!isThumbablePath(entry.path)) return;
      const originalName = path.basename(entry.path);
      const missing = sizeKeys.some((sizeKey) => {
        const thumbPath = getThumbPath(entry.hash, sizeKey, originalName);
        return !fs.existsSync(thumbPath);
      });
      const jpgFallbackPath = getThumbPath(entry.hash, 'md', originalName, '.jpg');
      if (missing || !fs.existsSync(jpgFallbackPath)) {
        candidates.push(entry.path);
      }
    });
    if (candidates.length > 0) {
      enqueueThumbnailJobs(candidates);
    }
  } finally {
    verifyingThumbs = false;
  }
};

const schedulePostScanVerify = () => {
  if (postScanVerifyTimer) {
    clearTimeout(postScanVerifyTimer);
  }
  postScanVerifyTimer = setTimeout(() => {
    postScanVerifyTimer = null;
    verifyThumbnailCoverage();
  }, POST_SCAN_VERIFY_DELAY_MS);
};

const getWorkerCount = () => {
  const cpuCount = os.cpus()?.length || 1;
  return Math.max(1, Math.min(WORKER_POOL_LIMIT, cpuCount));
};

const getWorkerIndex = (pathValue) => {
  if (!thumbnailWorkers.length) return 0;
  let hash = 0;
  for (let index = 0; index < pathValue.length; index += 1) {
    hash = (hash << 5) - hash + pathValue.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash) % thumbnailWorkers.length;
};

const dispatchSync = (updates, removals) => {
  if (thumbnailWorkers.length === 0) return;
  const buckets = new Map();
  updates.forEach((entry) => {
    if (!entry?.path) return;
    if (getThumbErrCount(entry.path) > THUMB_ERR_LIMIT) return;
    const index = getWorkerIndex(entry.path);
    if (!buckets.has(index)) buckets.set(index, { updates: [], removals: [] });
    buckets.get(index).updates.push(entry);
  });
  removals.forEach((entry) => {
    const pathValue = entry?.path;
    if (!pathValue) return;
    const index = getWorkerIndex(pathValue);
    if (!buckets.has(index)) buckets.set(index, { updates: [], removals: [] });
    buckets.get(index).removals.push(entry);
  });
  buckets.forEach((payload, index) => {
    if (payload.updates.length === 0 && payload.removals.length === 0) return;
    const worker = thumbnailWorkers[index];
    if (!worker) return;
    worker.postMessage({
      type: 'sync',
      entries: payload.updates,
      removals: payload.removals,
    });
  });
};

export const startThumbnailWorker = async () => {
  await ensureThumbDir();
  try {
    const workerCount = getWorkerCount();
    for (let index = 0; index < workerCount; index += 1) {
      const worker = new Worker(new URL('../worker/thumbnail-worker.js', import.meta.url), {
        workerData: {
          rootDir: ROOT_DIR,
          thumbDir: THUMB_DIR,
          excludedPatterns: EXCLUDED_PATTERNS,
          sizes: THUMB_SIZES,
          thumbExt: THUMB_EXT,
        },
      });
      worker.on('error', (error) => {
        console.error(`Thumbnail worker ${index + 1} error`, error);
      });
      worker.on('message', (message) => {
        if (message?.type === 'thumb-error' && message.path) {
          incrementThumbErrCount(message.path);
        }
        if (message?.type === 'thumb-success' && message.path) {
          resetThumbErrCount(message.path);
        }
      });
      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`Thumbnail worker ${index + 1} exited with code ${code}`);
        }
      });
      thumbnailWorkers.push(worker);
    }
    unsubscribeScanComplete?.();
    unsubscribeScanComplete = onHashScanComplete(({ updates, removals }) => {
      const hasChanges = updates.length > 0 || removals.length > 0;
      if (hasChanges) {
        dispatchSync(updates, removals);
      }
      if (!initialScanVerified) {
        initialScanVerified = true;
        schedulePostScanVerify();
        return;
      }
      if (hasChanges) {
        schedulePostScanVerify();
      }
    });
    if (!verifyTimer) {
      verifyTimer = setInterval(verifyThumbnailCoverage, VERIFY_THUMBS_INTERVAL_MS);
    }
  } catch (error) {
    console.error('Failed to start thumbnail worker', error);
  }
};
