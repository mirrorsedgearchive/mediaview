import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { parentPort, workerData } from 'node:worker_threads';
import { isExcludedPathWithPatterns } from '../lib/exclude.js';

const {
  rootDir,
  cacheFile,
  excludedPatterns,
  scanIntervalMs,
  initialEntries,
  initialEntriesLoaded,
} = workerData;
const BATCH_SIZE = 200;
const SCAN_INTERVAL_MS = Number(scanIntervalMs) > 0 ? Number(scanIntervalMs) : 60 * 1000;
const WATCH_DEBOUNCE_MS = 1500;
const FALLBACK_SCAN_INTERVAL_MS = Math.max(SCAN_INTERVAL_MS, 5 * 60 * 1000);
let scanTimer = null;
let watchTimer = null;
let fallbackTimer = null;
let watcher = null;
let watching = false;
let scanning = false;
let scanQueued = false;
let scanId = 0;
let progressTimer = null;
let processedFileCount = 0;
let currentFilePath = '';
const cache = new Map();

const toPosix = (value) => value.split(path.sep).join('/');
const cacheRelativePath = cacheFile ? toPosix(path.relative(rootDir, cacheFile)) : null;
const cacheRelativeDir =
  cacheRelativePath && !cacheRelativePath.startsWith('..')
    ? path.posix.dirname(cacheRelativePath)
    : null;

const isExcludedPath = (relativePath) => isExcludedPathWithPatterns(relativePath, excludedPatterns);

const hashFile = async (absolutePath) => {
  const handle = await fsPromises.open(absolutePath, 'r');
  try {
    const hash = crypto.createHash('sha256');
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let bytesRead = 0;
    do {
      ({ bytesRead } = await handle.read(buffer, 0, buffer.length, null));
      if (bytesRead > 0) {
        hash.update(buffer.subarray(0, bytesRead));
      }
    } while (bytesRead > 0);
    return hash.digest('hex');
  } finally {
    await handle.close().catch(() => {});
  }
};

const applyCacheEntries = (entries) => {
  if (!entries) return;
  Object.entries(entries).forEach(([relativePath, entry]) => {
    if (!entry?.hash || !Number.isFinite(entry.mtimeMs)) return;
    cache.set(relativePath, {
      kind: 'file',
      hash: entry.hash,
      mtimeMs: entry.mtimeMs,
      size: entry.size ?? null,
      lastSeenScanId: 0,
    });
  });
};

const loadCache = async () => {
  if (initialEntriesLoaded) {
    applyCacheEntries(initialEntries || {});
    return;
  }
  try {
    const contents = await fsPromises.readFile(cacheFile, 'utf8');
    const data = JSON.parse(contents);
    applyCacheEntries(data?.entries || {});
  } catch (error) {
    if (error.code !== 'ENOENT') {
      // ignore parse errors and missing file
    }
  }
};

const scanTree = async (currentScanId) => {
  const updates = [];
  const dirUpdates = [];
  let fileUpdateCount = 0;
  let dirUpdateCount = 0;

  const flushUpdates = () => {
    if (updates.length === 0) return;
    fileUpdateCount += updates.length;
    parentPort?.postMessage({ type: 'hash-update', entries: updates.splice(0, updates.length) });
  };

  const flushDirUpdates = () => {
    if (dirUpdates.length === 0) return;
    dirUpdateCount += dirUpdates.length;
    parentPort?.postMessage({
      type: 'dir-update',
      entries: dirUpdates.splice(0, dirUpdates.length),
    });
  };

  const ensureDir = (relativePath) => {
    const cached = cache.get(relativePath);
    if (!cached || cached.kind !== 'dir') {
      cache.set(relativePath, { kind: 'dir', lastSeenScanId: currentScanId });
      dirUpdates.push({ path: relativePath });
      if (dirUpdates.length >= BATCH_SIZE) {
        flushDirUpdates();
      }
      return;
    }
    cached.lastSeenScanId = currentScanId;
  };

  const stack = [''];
  ensureDir('');
  while (stack.length > 0) {
    const current = stack.pop();
    const absolutePath = path.join(rootDir, current);
    let dir;
    try {
      dir = await fsPromises.opendir(absolutePath);
    } catch (error) {
      console.error('Hash cache scan failed to read directory', error);
      continue;
    }
    try {
      for await (const dirent of dir) {
        const relativePath = toPosix(path.join(current, dirent.name));
        if (isExcludedPath(relativePath)) continue;
        if (dirent.isDirectory()) {
          ensureDir(relativePath);
          stack.push(relativePath);
          continue;
        }
        if (!dirent.isFile()) continue;
        processedFileCount += 1;
        currentFilePath = relativePath;
        const filePath = path.join(rootDir, relativePath);
        let stats;
        try {
          stats = await fsPromises.stat(filePath);
        } catch (error) {
          console.error('Hash cache scan failed to stat file', error);
          continue;
        }
        const cached = cache.get(relativePath);
        if (cached && cached.kind === 'file' && cached.mtimeMs === stats.mtimeMs) {
          cached.lastSeenScanId = currentScanId;
          continue;
        }
        try {
          const hash = await hashFile(filePath);
          cache.set(relativePath, {
            kind: 'file',
            hash,
            mtimeMs: stats.mtimeMs,
            size: stats.size,
            lastSeenScanId: currentScanId,
          });
          updates.push({ path: relativePath, hash, mtimeMs: stats.mtimeMs, size: stats.size });
          if (updates.length >= BATCH_SIZE) {
            flushUpdates();
          }
        } catch (error) {
          console.error('Hash cache scan failed to hash file', error);
        }
      }
    } finally {
      await dir.close().catch(() => {});
    }
  }

  flushUpdates();
  flushDirUpdates();

  const fileRemovals = [];
  const dirRemovals = [];
  for (const [cachedPath, cachedEntry] of cache.entries()) {
    if (cachedEntry?.lastSeenScanId === currentScanId) {
      continue;
    }
    if (cachedEntry?.kind === 'dir') {
      dirRemovals.push(cachedPath);
    } else {
      fileRemovals.push(cachedPath);
    }
  }
  if (fileRemovals.length > 0) {
    parentPort?.postMessage({ type: 'hash-remove', paths: fileRemovals });
    fileRemovals.forEach((relativePath) => cache.delete(relativePath));
  }
  if (dirRemovals.length > 0) {
    parentPort?.postMessage({ type: 'dir-remove', paths: dirRemovals });
    dirRemovals.forEach((relativePath) => cache.delete(relativePath));
  }
  return {
    updatedCount: fileUpdateCount + dirUpdateCount,
    removedCount: fileRemovals.length + dirRemovals.length,
    fileUpdatedCount: fileUpdateCount,
    fileRemovedCount: fileRemovals.length,
    dirUpdatedCount: dirUpdateCount,
    dirRemovedCount: dirRemovals.length,
  };
};

const scheduleScan = () => {
  if (scanTimer) return;
  scanTimer = setTimeout(() => {
    scanTimer = null;
    void runScan();
  }, SCAN_INTERVAL_MS);
};

const scheduleFallbackScan = () => {
  if (fallbackTimer) return;
  fallbackTimer = setTimeout(() => {
    fallbackTimer = null;
    void runScan();
  }, FALLBACK_SCAN_INTERVAL_MS);
};

const scheduleWatchScan = () => {
  if (watchTimer) clearTimeout(watchTimer);
  watchTimer = setTimeout(() => {
    watchTimer = null;
    void runScan();
  }, WATCH_DEBOUNCE_MS);
};

const stopWatching = () => {
  watcher?.close();
  watcher = null;
  watching = false;
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
};

const startWatching = () => {
  if (watching) return;
  try {
    watcher = fs.watch(rootDir, { recursive: true }, (_event, filename) => {
      if (!filename) {
        scheduleFallbackScan();
        return;
      }
      if (filename && cacheRelativeDir) {
        const relativePath = toPosix(String(filename));
        if (relativePath === cacheRelativeDir || relativePath.startsWith(`${cacheRelativeDir}/`)) {
          return;
        }
      }
      scheduleWatchScan();
    });
    watcher.on('error', () => {
      stopWatching();
      scheduleScan();
    });
    watching = true;
  } catch {
    stopWatching();
  }
};

const runScan = async () => {
  if (scanning) {
    scanQueued = true;
    return;
  }
  if (scanTimer) {
    clearTimeout(scanTimer);
    scanTimer = null;
  }
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
  scanning = true;
  processedFileCount = 0;
  currentFilePath = '';
  if (!progressTimer) {
    progressTimer = setInterval(() => {
      const currentLabel = currentFilePath || 'pending';
      console.log(`Scan progress: ${processedFileCount} files processed, current ${currentLabel}`);
    }, 10 * 1000);
  }
  const currentScanId = scanId + 1;
  scanId = currentScanId;
  const startedAt = Date.now();
  parentPort?.postMessage({ type: 'scan-start', startedAt });
  let result = { updatedCount: 0, removedCount: 0 };
  try {
    result = await scanTree(currentScanId);
  } catch (error) {
    console.error('Hash cache scan failed', error);
  }
  const finishedAt = Date.now();
  parentPort?.postMessage({
    type: 'scan-complete',
    startedAt,
    finishedAt,
    updatedCount: result.updatedCount,
    removedCount: result.removedCount,
  });
  const changedFiles = (result.fileUpdatedCount || 0) + (result.fileRemovedCount || 0);
  const changedDirs = (result.dirUpdatedCount || 0) + (result.dirRemovedCount || 0);
  if (changedFiles > 0) {
    console.log(
      `Scan complete: ${changedFiles} files changed (updated ${result.fileUpdatedCount || 0}, removed ${result.fileRemovedCount || 0}), ${changedDirs} dirs changed (updated ${result.dirUpdatedCount || 0}, removed ${result.dirRemovedCount || 0})`
    );
  }
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  scanning = false;
  if (scanQueued) {
    scanQueued = false;
    void runScan();
    return;
  }
  if (watching) {
    scheduleFallbackScan();
  } else {
    scheduleScan();
  }
};

await loadCache();
startWatching();
void runScan();

parentPort?.on('message', (message) => {
  if (!message) return;
  if (message.type === 'hash-update' && message.entry?.path) {
    const existing = cache.get(message.entry.path);
    cache.set(message.entry.path, {
      kind: 'file',
      hash: message.entry.hash,
      mtimeMs: message.entry.mtimeMs,
      size: message.entry.size ?? null,
      lastSeenScanId: existing?.lastSeenScanId ?? scanId,
    });
  }
  if (message.type === 'hash-remove' && Array.isArray(message.paths)) {
    message.paths.forEach((relativePath) => cache.delete(relativePath));
  }
  if (message.type === 'scan') {
    void runScan();
  }
});
