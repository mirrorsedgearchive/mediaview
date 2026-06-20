import { decodePathSegments, sanitizeRequestPath } from './paths.js';

const normalizeBaseUrl = (value) => (value && value.endsWith('/') ? value.slice(0, -1) : value);

const getOrigin = (req) => {
  const protoHeader = req.headers['x-forwarded-proto'];
  const hostHeader = req.headers['x-forwarded-host'];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader || req.protocol;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader || req.get('host');
  return `${proto}://${host}`;
};

const getPathBasename = (pathname) => {
  if (!pathname || pathname === '/') return '';
  const segments = pathname.split('/').filter(Boolean);
  if (!segments.length) return '';
  const decodedSegments = segments.map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  });
  return decodedSegments[decodedSegments.length - 1];
};

export const buildPageTitle = (req, baseTitle) => {
  const pathname = req.path || '/';
  if (pathname === '/search' && req.query?.q) {
    return `${baseTitle} - Search for "${req.query.q}"`;
  }
  if (pathname === '/' || !pathname) {
    return baseTitle;
  }
  const baseName = getPathBasename(pathname);
  return baseName ? `${baseTitle} - ${baseName}` : baseTitle;
};

export const getRequestPath = (req) => {
  const rawPath = (req?.path || '').replace(/^\/+/, '');
  const decodedPath = decodePathSegments(rawPath || '');
  return sanitizeRequestPath(decodedPath).replace(/\/+$/, '');
};

export const getPageContext = (req, { baseTitle, siteOrigin } = {}) => {
  const origin = normalizeBaseUrl(siteOrigin || getOrigin(req));
  const pathname = req?.path || '/';
  const title = baseTitle ? buildPageTitle(req, baseTitle) : '';
  return {
    origin,
    pathname,
    title,
  };
};
