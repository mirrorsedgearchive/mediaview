import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import mime from 'mime-types';
import { THUMB_SIZES } from '../config.js';
import { isThumbablePath } from '../lib/classify.js';
import { isExcludedPath } from '../lib/exclude.js';
import { matchesEtag } from '../lib/http.js';
import { decodePathSegments, resolveSafePath, sanitizeRequestPath } from '../lib/paths.js';
import { getHashEntry, hasHashEntry } from '../lib/hash-cache.js';
import { getThumbPath } from '../lib/thumbnails.js';

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
      const thumbPath = format === 'jpg'
        ? getThumbPath(hash, size, path.basename(requestPath), '.jpg')
        : getThumbPath(hash, size, path.basename(requestPath));
      if (!fs.existsSync(thumbPath)) {
        res.status(404).json({ error: 'Thumbnail not found' });
        return;
      }
      const mimeType = mime.lookup(thumbPath) || 'application/octet-stream';
      const etag = `"${hash}"`;
      const cacheControl = 'public, max-age=21600, stale-while-revalidate=10800';
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
