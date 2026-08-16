import path from 'node:path';
import {
  getCustomFolderThumbnailEntries,
  getDirectoryEntries,
  hasDirectoryEntry,
} from '../lib/hash-cache.js';
import { isExcludedPath, isHiddenPath } from '../lib/exclude.js';
import { getContentWarning } from '../lib/content-warning.js';
import { API_CACHE_CONTROL } from '../lib/http.js';
import { decodePathSegments, sanitizeRequestPath } from '../lib/paths.js';
import { buildStats } from '../lib/stats.js';

export const registerListRoute = (app) => {
  const getRequestPath = (req) => {
    if (typeof req.params.path === 'string' || Array.isArray(req.params.path)) {
      return decodePathSegments(req.params.path);
    }
    if (typeof req.params[0] === 'string') {
      return decodePathSegments(req.params[0]);
    }
    if (typeof req.query.path === 'string') {
      return req.query.path;
    }
    return '';
  };

  const handleRequest = async (req, res) => {
    let requestPath;
    try {
      requestPath = sanitizeRequestPath(getRequestPath(req));
      if (isExcludedPath(requestPath) || isHiddenPath(requestPath)) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
    } catch (error) {
      res.status(error.statusCode || 400).json({ error: error.message });
      return;
    }

    if (!hasDirectoryEntry(requestPath) || getDirectoryEntries(requestPath) === null) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const entries = getDirectoryEntries(requestPath) || [];
    const stats = buildStats(entries);

    const children = {};
    const customThumbnails = {};
    const contentWarnings = {};
    entries
      .filter((entry) => entry.isDir)
      .forEach((entry) => {
        children[entry.path] = getDirectoryEntries(entry.path) || [];
        const folderCustomThumbnails = getCustomFolderThumbnailEntries(entry.path) || [];
        if (folderCustomThumbnails.length > 0) {
          customThumbnails[entry.path] = folderCustomThumbnails;
        }
      });

    try {
      const currentWarning = await getContentWarning(requestPath);
      if (currentWarning) contentWarnings[requestPath] = currentWarning;
      const childDirectories = entries.filter((entry) => entry.isDir);
      const childWarnings = await Promise.all(
        childDirectories.map(async (entry) => [entry.path, await getContentWarning(entry.path)])
      );
      childWarnings.forEach(([childPath, warning]) => {
        if (warning) contentWarnings[childPath] = warning;
      });
    } catch (error) {
      console.error('Content warning request failed', error);
      res.status(500).json({ error: 'Failed to read content warning' });
      return;
    }

    res.setHeader('Cache-Control', API_CACHE_CONTROL);
    res.json({
      current: {
        name: requestPath ? path.posix.basename(requestPath) : 'Archive',
        path: requestPath,
      },
      stats,
      entries,
      children,
      customThumbnails,
      ...(Object.keys(contentWarnings).length > 0 ? { contentWarnings } : {}),
    });
  };

  app.get('/api/list', handleRequest);
  app.get('/api/list/*path', handleRequest);
};
