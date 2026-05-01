export const HTML_CACHE_CONTROL = 'no-cache';
export const API_CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=30';
export const PUBLIC_ASSET_CACHE_CONTROL = 'public, max-age=3600, stale-while-revalidate=86400';
export const IMMUTABLE_ASSET_CACHE_CONTROL = 'public, max-age=31536000, immutable';
export const MEDIA_CACHE_CONTROL = 'public, max-age=21600, stale-while-revalidate=10800';

export const matchesEtag = (headerValue, etag) => {
  if (!headerValue) return false;
  const candidates = headerValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => (value.startsWith('W/') ? value.slice(2) : value));
  return candidates.includes('*') || candidates.includes(etag);
};
