import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import { handleFileRequest } from './routes/file.js';
import { registerHashCacheRoute } from './routes/hash-cache.js';
import { registerHealthRoute } from './routes/health.js';
import { registerListRoute } from './routes/list.js';
import { registerSearchRoute } from './routes/search.js';
import { registerTreeRoute } from './routes/tree.js';
import { registerThumbnailRoute } from './routes/thumbnail.js';
import { registerSitemapRoute } from './routes/sitemap.js';
import { isExcludedPath } from './lib/exclude.js';
import { getCacheEpoch, hasHashEntry } from './lib/hash-cache.js';
import { CLIENT_DIST } from './config.js';
import {
  HTML_CACHE_CONTROL,
  IMMUTABLE_ASSET_CACHE_CONTROL,
  PUBLIC_ASSET_CACHE_CONTROL,
} from './lib/http.js';
import { decodePathSegments, sanitizeRequestPath } from './lib/paths.js';
import { createIndexHtmlRenderer } from './lib/html-meta.js';
import { buildNoscriptDirectoryList } from './lib/noscript-list.js';

const BASE_TITLE = "The Mirror's Edge Archive";
const CONTENT_SECURITY_POLICY = {
  useDefaults: true,
  directives: {
    'connect-src': ["'self'"],
    'font-src': ["'self'"],
    'frame-src': ["'self'"],
    'img-src': ["'self'", 'data:'],
    'manifest-src': ["'self'"],
    'media-src': ["'self'"],
    'style-src': ["'self'"],
    'style-src-attr': ["'unsafe-inline'"],
  },
};

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');

  app.use(
    compression({
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        const type = res.getHeader('Content-Type');
        if (typeof type === 'string' && type.startsWith('video/')) return false;
        return compression.filter(req, res);
      },
    })
  );

  if (process.env.NODE_ENV === 'production') {
    app.use(
      helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        contentSecurityPolicy: CONTENT_SECURITY_POLICY,
      })
    );
  }

  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  registerHealthRoute(app);
  registerHashCacheRoute(app);
  registerListRoute(app);
  registerSearchRoute(app);
  registerTreeRoute(app);
  registerThumbnailRoute(app);
  registerSitemapRoute(app);

  const shouldHandleFile = (requestPath) => {
    if (!requestPath) return false;
    if (isExcludedPath(requestPath)) return false;
    return hasHashEntry(requestPath);
  };

  app.get('/*path', async (req, res, next) => {
    if (req.path.startsWith('/api')) {
      next();
      return;
    }
    let requestPath;
    try {
      requestPath = sanitizeRequestPath(decodePathSegments(req.path));
    } catch {
      next();
      return;
    }
    if (!shouldHandleFile(requestPath)) {
      next();
      return;
    }
    await handleFileRequest(req, res, requestPath);
  });

  if (fs.existsSync(CLIENT_DIST)) {
    const indexHtmlPath = path.join(CLIENT_DIST, 'index.html');
    const indexHtmlTemplate = fs.readFileSync(indexHtmlPath, 'utf-8');
    const renderIndexHtml = createIndexHtmlRenderer(indexHtmlTemplate, {
      baseTitle: BASE_TITLE,
      getNoscriptContent: (req) => buildNoscriptDirectoryList(req),
      getCacheEpoch,
    });
    const assetCacheControl = (res, filePath) => {
      const relativePath = path.relative(CLIENT_DIST, filePath).split(path.sep).join('/');
      res.setHeader(
        'Cache-Control',
        filePath.endsWith('.html')
          ? HTML_CACHE_CONTROL
          : relativePath.startsWith('assets/')
            ? IMMUTABLE_ASSET_CACHE_CONTROL
            : PUBLIC_ASSET_CACHE_CONTROL
      );
    };

    app.use(express.static(CLIENT_DIST, { index: false, setHeaders: assetCacheControl }));

    app.get('/', (req, res) => {
      const html = renderIndexHtml(req);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', HTML_CACHE_CONTROL);
      res.send(html);
    });

    app.get('/*path', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      const html = renderIndexHtml(req);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', HTML_CACHE_CONTROL);
      res.send(html);
    });
  }

  return app;
};
