import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import mime from 'mime-types';
import { THUMB_SIZES } from '../config.js';
import { isThumbablePath } from '../lib/classify.js';
import { isExcludedPath } from '../lib/exclude.js';
import { matchesEtag, MEDIA_CACHE_CONTROL } from '../lib/http.js';
import { decodePathSegments, resolveSafePath, sanitizeRequestPath } from '../lib/paths.js';
import { getHashEntry, getThumbErrCount, hasHashEntry, THUMB_ERR_LIMIT } from '../lib/hash-cache.js';
import { getThumbPath } from '../lib/thumbnails.js';

const buildThumbnailMissEtag = (hash, size, format = '') =>
  `"thumb-miss-${hash}-${size}-${format || 'default'}"`;

const resolveThumbPath = (hash, size, originalName, format = '') =>
  format === 'jpg'
    ? getThumbPath(hash, size, originalName, '.jpg')
    : getThumbPath(hash, size, originalName);

const parseThumbnailRequest = (req) => {
  if (typeof req.params.size === 'string' && (typeof req.params.path === 'string' || Array.isArray(req.params.path))) {
    const rawSize = req.params.size.toString().toLowerCase();
    const decodedPath = decodePathSegments(req.params.path);
    if (rawSize === 'jpg') {
      return { requestPath: decodedPath, size: 'md', format: 'jpg' };
    }
    if (THUMB_SIZES[rawSize]) {
      return { requestPath: decodedPath, size: rawSize };
    }
    const err = new Error('Invalid thumbnail size');
    err.statusCode = 400;
    throw err;
  }
  const err = new Error('Missing size');
  err.statusCode = 400;
  throw err;
};

export const registerThumbnailRoute = (app) => {
  const handleRequest = async (req, res) => {
    let parsed;
    let requestPath;
    let size;
    try {
      parsed = parseThumbnailRequest(req);
      requestPath = sanitizeRequestPath(parsed.requestPath || '');
      size = String(parsed.size || 'sm').toLowerCase();
    } catch (error) {
      res.status(error.statusCode || 400).json({ error: error.message });
      return;
    }
    if (!THUMB_SIZES[size]) {
      res.status(400).json({ error: 'Invalid thumbnail size' });
      return;
    }
    let absolutePath;
    try {
      if (isExcludedPath(requestPath)) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      if (!hasHashEntry(requestPath)) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      absolutePath = resolveSafePath(requestPath);
    } catch (error) {
      res.status(error.statusCode || 400).json({ error: error.message });
      return;
    }

    try {
      const stats = await fsPromises.stat(absolutePath);
      if (!stats.isFile()) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      if (!isThumbablePath(requestPath)) {
        res.status(415).json({ error: 'Unsupported media type' });
        return;
      }
      const cached = getHashEntry(requestPath);
      if (!cached?.hash) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      const hash = cached.hash;
      const format = parsed.format || '';
      const thumbPath = resolveThumbPath(hash, size, path.basename(requestPath), format);
      if (!fs.existsSync(thumbPath)) {
        const thumbErrCount = getThumbErrCount(requestPath);
        if (thumbErrCount > THUMB_ERR_LIMIT) {
          const missEtag = buildThumbnailMissEtag(hash, size, format);
          res.setHeader('ETag', missEtag);
          res.setHeader('Last-Modified', stats.mtime.toUTCString());
          res.setHeader('Cache-Control', MEDIA_CACHE_CONTROL);
          if (matchesEtag(req.headers['if-none-match'], missEtag)) {
            res.status(304).end();
            return;
          }
        } else {
          res.setHeader('Cache-Control', 'no-store');
        }
        res.status(404).json({ error: 'Thumbnail not found' });
        return;
      }
      const mimeType = mime.lookup(thumbPath) || 'application/octet-stream';
      const etag = `"${hash}"`;
      const cacheControl = MEDIA_CACHE_CONTROL;
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', cacheControl);
      if (matchesEtag(req.headers['if-none-match'], etag)) {
        res.status(304).end();
        return;
      }
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Cache-Control': cacheControl,
      });
      fs.createReadStream(thumbPath).pipe(res);
    } catch (error) {
      console.error('Thumbnail request failed', error);
      res.status(500).json({ error: 'Failed to load thumbnail' });
    }
  };

  app.get('/api/thumbnail/:size/*path', handleRequest);
};
