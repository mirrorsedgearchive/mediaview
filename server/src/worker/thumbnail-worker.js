import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { parentPort, workerData } from 'node:worker_threads';
import sharp from 'sharp';
import { IMAGE_EXTS, THUMB_VIDEO_EXTS } from '../lib/classify.js';
import { isExcludedPathWithPatterns } from '../lib/exclude.js';

const { rootDir, thumbDir, excludedPatterns, sizes, thumbExt } = workerData;
const sizeEntries = Object.entries(sizes);
const pending = new Set();
const queue = [];
let processing = false;
let ffmpegAvailable = null;
let ffprobeAvailable = null;
const hashCache = new Map();
const THUMB_ASPECT = { width: 3, height: 2 };
const STATUS_INTERVAL_MS = 10 * 1000;
let queueStatusTimer = null;
let queueProcessedCount = 0;
let queueCreatedCount = 0;
let queueCurrentPath = '';

const getThumbHeight = (width) => Math.round((width * THUMB_ASPECT.height) / THUMB_ASPECT.width);

const toPosix = (value) => value.split(path.sep).join('/');

const isExcludedPath = (relativePath) => isExcludedPathWithPatterns(relativePath, excludedPatterns);

const ensureThumbDir = async () => {
  await fsPromises.mkdir(thumbDir, { recursive: true });
};

const dropPending = (relativePath) => {
  if (!relativePath) return;
  pending.delete(relativePath);
  for (let index = queue.length - 1; index >= 0; index -= 1) {
    if (queue[index] === relativePath) {
      queue.splice(index, 1);
    }
  }
};

const deleteThumbFiles = async (relativePath, hash) => {
  if (!relativePath || !hash) return;
  const originalName = path.basename(relativePath);
  let deletedCount = 0;
  await Promise.all(
    sizeEntries.map(([variant]) => {
      const attempts = [];
      const avifName = `${hash}-${variant}-${originalName}${thumbExt}`;
      const avifPath = path.join(thumbDir, avifName);
      attempts.push(
        fsPromises
          .unlink(avifPath)
          .then(() => {
            deletedCount += 1;
          })
          .catch((error) => {
            if (error?.code === 'ENOENT') return;
            console.error(`Thumbnail worker failed to delete thumbnail for ${relativePath}`, error);
          })
      );
      const jpgName = `${hash}-${variant}-${originalName}.jpg`;
      const jpgPath = path.join(thumbDir, jpgName);
      attempts.push(
        fsPromises
          .unlink(jpgPath)
          .then(() => {
            deletedCount += 1;
          })
          .catch((error) => {
            if (error?.code === 'ENOENT') return;
            console.error(
              `Thumbnail worker failed to delete jpg thumbnail for ${relativePath}`,
              error
            );
          })
      );
      return Promise.all(attempts);
    })
  );
  return deletedCount;
};

const enqueueEntries = (entries) => {
  entries.forEach((entry) => {
    const relativePath = entry?.path;
    if (
      !relativePath ||
      !entry?.hash ||
      pending.has(relativePath) ||
      isExcludedPath(relativePath)
    ) {
      return;
    }
    hashCache.set(relativePath, {
      hash: entry.hash,
      mtimeMs: entry.mtimeMs,
      size: entry.size ?? null,
    });
    pending.add(relativePath);
    queue.push(relativePath);
  });
  if (!processing) {
    void processQueue();
  }
};

const enqueuePaths = (paths) => {
  const entries = [];
  paths.forEach((relativePath) => {
    const cached = hashCache.get(relativePath);
    if (!cached?.hash) return;
    entries.push({ path: relativePath, ...cached });
  });
  enqueueEntries(entries);
};

const startQueueStatus = () => {
  if (queueStatusTimer) return;
  queueProcessedCount = 0;
  queueCreatedCount = 0;
  queueCurrentPath = '';
  queueStatusTimer = setInterval(() => {
    if (!processing) return;
    const currentLabel = queueCurrentPath || 'pending';
    console.log(
      `Thumbnail worker queue: ${queueProcessedCount} files processed, ${queueCreatedCount} thumbnails created, current ${currentLabel}`
    );
  }, STATUS_INTERVAL_MS);
};

const stopQueueStatus = () => {
  if (!queueStatusTimer) return;
  clearInterval(queueStatusTimer);
  queueStatusTimer = null;
};

const generateThumbnails = async (relativePath, hash, options = {}) => {
  const absolutePath = path.join(rootDir, relativePath);
  const stats = await fsPromises.stat(absolutePath);
  if (!stats.isFile()) return;
  const ext = path.extname(relativePath).toLowerCase();
  if (!IMAGE_EXTS.has(ext)) return;

  const cachedHash = hash || hashCache.get(relativePath)?.hash;
  if (!cachedHash) return;
  const originalName = path.basename(relativePath);
  const variants = options.force
    ? sizeEntries
    : sizeEntries.filter(([variant]) => {
        const thumbName = `${cachedHash}-${variant}-${originalName}${thumbExt}`;
        return !fs.existsSync(path.join(thumbDir, thumbName));
      });
  let created = 0;
  if (variants.length === 0) {
    const mdEntry = sizeEntries.find(([v]) => v === 'md');
    if (mdEntry) {
      const [, width] = mdEntry;
      const height = getThumbHeight(width);
      const jpgName = `${cachedHash}-md-${originalName}.jpg`;
      const jpgPath = path.join(thumbDir, jpgName);
      if (options.force || !fs.existsSync(jpgPath)) {
        await sharp(absolutePath)
          .resize({ width, height, fit: 'cover', position: 'centre' })
          .jpeg({ quality: 80 })
          .toFile(jpgPath);
        created += 1;
      }
    }
    return { hash: cachedHash, created };
  }
  for (const [variant, width] of variants) {
    const height = getThumbHeight(width);
    const thumbName = `${cachedHash}-${variant}-${originalName}${thumbExt}`;
    const thumbPath = path.join(thumbDir, thumbName);
    await sharp(absolutePath)
      .resize({ width, height, fit: 'cover', position: 'centre' })
      .avif({ quality: 50, effort: 6, chromaSubsampling: '4:2:0' })
      .toFile(thumbPath);
    created += 1;
  }

  const mdEntry = sizeEntries.find(([v]) => v === 'md');
  if (mdEntry) {
    const [, mdWidth] = mdEntry;
    const mdHeight = getThumbHeight(mdWidth);
    const jpgName = `${cachedHash}-md-${originalName}.jpg`;
    const jpgPath = path.join(thumbDir, jpgName);
    if (options.force || !fs.existsSync(jpgPath)) {
      await sharp(absolutePath)
        .resize({ width: mdWidth, height: mdHeight, fit: 'cover', position: 'centre' })
        .jpeg({ quality: 80 })
        .toFile(jpgPath);
      created += 1;
    }
  }

  return { hash: cachedHash, created };
};

const ensureFfmpeg = () => {
  if (ffmpegAvailable !== null) return ffmpegAvailable;
  const result = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  ffmpegAvailable = result.status === 0;
  return ffmpegAvailable;
};

const ensureFfprobe = () => {
  if (ffprobeAvailable !== null) return ffprobeAvailable;
  const result = spawnSync('ffprobe', ['-version'], { stdio: 'ignore' });
  ffprobeAvailable = result.status === 0;
  return ffprobeAvailable;
};

const getVideoDurationSeconds = (absolutePath) => {
  if (!ensureFfprobe()) return null;
  const result = spawnSync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    absolutePath,
  ]);
  if (result.status !== 0) return null;
  const output = String(result.stdout || '').trim();
  const duration = Number.parseFloat(output);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  return duration;
};

const extractVideoFrame = (absolutePath) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    const duration = getVideoDurationSeconds(absolutePath);
    const midpoint = duration ? Math.max(0, duration / 2) : 10;
    const process = spawn('ffmpeg', [
      '-ss',
      String(midpoint),
      '-i',
      absolutePath,
      '-frames:v',
      '1',
      '-f',
      'image2pipe',
      '-vcodec',
      'png',
      'pipe:1',
    ]);
    process.stdout.on('data', (chunk) => chunks.push(chunk));
    process.stdout.on('error', reject);
    process.stderr.on('data', () => {});
    process.on('error', reject);
    process.on('close', (code) => {
      if (code !== 0 || chunks.length === 0) {
        reject(new Error('ffmpeg failed'));
        return;
      }
      resolve(Buffer.concat(chunks));
    });
  });

const generateVideoThumbnails = async (relativePath, hash, options = {}) => {
  if (!ensureFfmpeg()) return;
  const absolutePath = path.join(rootDir, relativePath);
  const stats = await fsPromises.stat(absolutePath);
  if (!stats.isFile()) return;
  const ext = path.extname(relativePath).toLowerCase();
  if (!THUMB_VIDEO_EXTS.has(ext)) return;

  const cachedHash = hash || hashCache.get(relativePath)?.hash;
  if (!cachedHash) return;
  const originalName = path.basename(relativePath);
  const variants = options.force
    ? sizeEntries
    : sizeEntries.filter(([variant]) => {
        const thumbName = `${cachedHash}-${variant}-${originalName}${thumbExt}`;
        return !fs.existsSync(path.join(thumbDir, thumbName));
      });
  if (variants.length === 0) {
    // If no avif variants need creating, ensure medium JPG exists.
    const mdEntry = sizeEntries.find(([v]) => v === 'md');
    let created = 0;
    if (mdEntry) {
      const [, width] = mdEntry;
      const height = getThumbHeight(width);
      const jpgName = `${cachedHash}-md-${originalName}.jpg`;
      const jpgPath = path.join(thumbDir, jpgName);
      if (options.force || !fs.existsSync(jpgPath)) {
        const frameBuffer = await extractVideoFrame(absolutePath);
        await sharp(frameBuffer)
          .resize({ width, height, fit: 'cover', position: 'centre' })
          .jpeg({ quality: 80 })
          .toFile(jpgPath);
        created += 1;
      }
    }
    return { hash: cachedHash, created };
  }
  const frameBuffer = await extractVideoFrame(absolutePath);

  let created = 0;
  for (const [variant, width] of variants) {
    const height = getThumbHeight(width);
    const thumbName = `${cachedHash}-${variant}-${originalName}${thumbExt}`;
    const thumbPath = path.join(thumbDir, thumbName);
    await sharp(frameBuffer)
      .resize({ width, height, fit: 'cover', position: 'centre' })
      .avif({ quality: 50, effort: 6, chromaSubsampling: '4:2:0' })
      .toFile(thumbPath);
    created += 1;
  }

  // Ensure medium JPG fallback exists for videos as well.
  const mdEntry = sizeEntries.find(([v]) => v === 'md');
  if (mdEntry) {
    const [, mdWidth] = mdEntry;
    const mdHeight = getThumbHeight(mdWidth);
    const jpgName = `${cachedHash}-md-${originalName}.jpg`;
    const jpgPath = path.join(thumbDir, jpgName);
    if (options.force || !fs.existsSync(jpgPath)) {
      await sharp(frameBuffer)
        .resize({ width: mdWidth, height: mdHeight, fit: 'cover', position: 'centre' })
        .jpeg({ quality: 80 })
        .toFile(jpgPath);
      created += 1;
    }
  }

  return { hash: cachedHash, created };
};

const processQueue = async () => {
  processing = true;
  if (queue.length > 0) {
    startQueueStatus();
  }
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) continue;
    try {
      queueCurrentPath = next;
      queueProcessedCount += 1;
      const ext = path.extname(next).toLowerCase();
      const cachedHash = hashCache.get(next)?.hash;
      if (THUMB_VIDEO_EXTS.has(ext)) {
        const result = await generateVideoThumbnails(next, cachedHash);
        queueCreatedCount += result?.created || 0;
        if (result?.hash) {
          parentPort?.postMessage({ type: 'thumb-success', path: next });
        }
      } else {
        const result = await generateThumbnails(next, cachedHash);
        queueCreatedCount += result?.created || 0;
        if (result?.hash) {
          parentPort?.postMessage({ type: 'thumb-success', path: next });
        }
      }
    } catch (error) {
      console.error(`Thumbnail worker failed to generate thumbnail for ${next}`, error);
      parentPort?.postMessage({ type: 'thumb-error', path: next });
    } finally {
      pending.delete(next);
    }
  }
  if (queueProcessedCount > 0 || queueCreatedCount > 0) {
    console.log(
      `Thumbnail worker queue complete: ${queueProcessedCount} files processed, ${queueCreatedCount} thumbnails created`
    );
  }
  stopQueueStatus();
  processing = false;
};

const scanTree = async () => {
  const stack = [''];
  while (stack.length > 0) {
    const current = stack.pop();
    const absolutePath = path.join(rootDir, current);
    let dirEntries;
    try {
      dirEntries = await fsPromises.readdir(absolutePath, { withFileTypes: true });
    } catch (error) {
      console.error('Thumbnail worker failed to read directory', error);
      continue;
    }
    for (const dirent of dirEntries) {
      const relativePath = toPosix(path.join(current, dirent.name));
      if (isExcludedPath(relativePath)) {
        continue;
      }
      if (dirent.isDirectory()) {
        stack.push(relativePath);
      } else if (dirent.isFile()) {
        enqueuePaths([relativePath]);
      }
    }
  }
};

await ensureThumbDir();

parentPort?.on('message', (message) => {
  if (!message) return;
  if (message.type === 'enqueue') {
    if (Array.isArray(message.entries)) {
      enqueueEntries(message.entries);
    } else if (Array.isArray(message.paths)) {
      enqueuePaths(message.paths);
    }
  }
  if (message.type === 'hash-update' && message.entry?.path) {
    hashCache.set(message.entry.path, {
      hash: message.entry.hash,
      mtimeMs: message.entry.mtimeMs,
      size: message.entry.size ?? null,
    });
  }
  if (
    message.type === 'sync' &&
    Array.isArray(message.entries) &&
    Array.isArray(message.removals)
  ) {
    const updates = message.entries;
    const removals = message.removals;
    void (async () => {
      let processedCount = 0;
      let createdCount = 0;
      let deletedCount = 0;
      for (const entry of updates) {
        if (!entry?.path || !entry?.hash) continue;
        processedCount += 1;
        try {
          dropPending(entry.path);
          const previousHash = entry.previousHash || hashCache.get(entry.path)?.hash;
          if (previousHash && previousHash !== entry.hash) {
            deletedCount += await deleteThumbFiles(entry.path, previousHash);
          }
          hashCache.set(entry.path, {
            hash: entry.hash,
            mtimeMs: entry.mtimeMs,
            size: entry.size ?? null,
          });
          const ext = path.extname(entry.path).toLowerCase();
          if (IMAGE_EXTS.has(ext) || THUMB_VIDEO_EXTS.has(ext)) {
            const force = !previousHash || previousHash !== entry.hash;
            if (THUMB_VIDEO_EXTS.has(ext)) {
              const result = await generateVideoThumbnails(entry.path, entry.hash, { force });
              createdCount += result?.created || 0;
              if (result?.hash) {
                parentPort?.postMessage({ type: 'thumb-success', path: entry.path });
              }
            } else {
              const result = await generateThumbnails(entry.path, entry.hash, { force });
              createdCount += result?.created || 0;
              if (result?.hash) {
                parentPort?.postMessage({ type: 'thumb-success', path: entry.path });
              }
            }
          }
        } catch (error) {
          console.error(`Thumbnail worker failed to sync thumbnail for ${entry.path}`, error);
          parentPort?.postMessage({ type: 'thumb-error', path: entry.path });
        }
      }
      for (const pathValue of removals) {
        const removalPath = pathValue?.path || pathValue;
        if (!removalPath) continue;
        processedCount += 1;
        dropPending(removalPath);
        const removalHash = pathValue?.hash || hashCache.get(removalPath)?.hash;
        if (removalHash) {
          deletedCount += await deleteThumbFiles(removalPath, removalHash);
        }
        hashCache.delete(removalPath);
      }
      if (processedCount > 0) {
        console.log(
          `Thumbnail worker sync complete: ${processedCount} files processed, ${createdCount} created, ${deletedCount} removed`
        );
      }
    })();
  }
  if (message.type === 'scan') {
    void scanTree();
  }
});
