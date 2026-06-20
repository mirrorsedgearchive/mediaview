import { SITE_ORIGIN } from '../config.js';
import { getCacheEpoch, getDirectoryEntries, hasDirectoryEntry } from './hash-cache.js';
import { isExcludedPath, isHiddenPath } from './exclude.js';
import { getPageContext, getRequestPath } from './page-context.js';

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const encodePath = (value) => {
  if (!value) return '';
  return value
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
};

const ROOT_LABEL = 'Root';
const NOSCRIPT_CACHE = new Map();
let NOSCRIPT_CACHE_EPOCH = null;

const buildBreadcrumbs = (requestPath, baseUrl) => {
  const segments = requestPath ? requestPath.split('/').filter(Boolean) : [];
  const crumbs = [];
  const rootHref = `${baseUrl}/`;
  crumbs.push(`<a href="${rootHref}">${escapeHtml(ROOT_LABEL)}</a>`);
  let current = '';
  segments.forEach((segment) => {
    current = current ? `${current}/${segment}` : segment;
    const href = `${baseUrl}/${encodePath(current)}`;
    crumbs.push(`<a href="${href}">${escapeHtml(segment)}</a>`);
  });
  return crumbs.join(' / ');
};

const buildListItems = (entries, baseUrl, basePath) => {
  if (!entries?.length) {
    return '<li>Empty folder</li>';
  }
  return entries
    .map((entry) => {
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
      const encodedPath = encodePath(relativePath);
      const href = `${baseUrl}/${encodedPath}`;
      const name = escapeHtml(entry.name);
      return entry.isDir
        ? `<li><a href="${href}">${name}/</a></li>`
        : `<li><a href="${href}">${name}</a></li>`;
    })
    .join('\n');
};

export const buildNoscriptDirectoryList = (req) => {
  if (!req?.path) return '';
  if (req.path.startsWith('/search')) return '';

  let requestPath;
  try {
    requestPath = getRequestPath(req);
    if (isExcludedPath(requestPath) || isHiddenPath(requestPath)) {
      return '';
    }
  } catch {
    return '';
  }

  const cacheKey = requestPath || '/';
  const epoch = getCacheEpoch();
  if (NOSCRIPT_CACHE_EPOCH !== epoch) {
    NOSCRIPT_CACHE.clear();
    NOSCRIPT_CACHE_EPOCH = epoch;
  }
  const cached = NOSCRIPT_CACHE.get(cacheKey);
  if (cached) return cached.html;

  if (!hasDirectoryEntry(requestPath)) {
    return '';
  }

  const entries = getDirectoryEntries(requestPath) || [];
  if (!entries.length && requestPath) {
    return '';
  }
  const { origin } = getPageContext(req, { siteOrigin: SITE_ORIGIN });
  const baseUrl = origin;
  const listItems = buildListItems(entries, baseUrl, requestPath);
  const breadcrumbs = buildBreadcrumbs(requestPath, baseUrl);

  const html =
    `<div class="noscript-directory">` +
    `<div class="noscript-breadcrumbs">${breadcrumbs}</div>` +
    `<ul>${listItems}</ul>` +
    `</div>`;
  NOSCRIPT_CACHE.set(cacheKey, { html });
  return html;
};
