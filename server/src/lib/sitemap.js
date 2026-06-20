import fsPromises from 'node:fs/promises';
import zlib from 'node:zlib';

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n';
const URLSET_OPEN = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
const URLSET_CLOSE = '</urlset>\n';

const normalizeBaseUrl = (baseUrl) => {
  if (!baseUrl) return '';
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
};

const encodePath = (pathValue) => {
  if (!pathValue) return '/';
  const segments = pathValue.split('/').filter(Boolean);
  return `/${segments.map((segment) => encodeURIComponent(segment)).join('/')}`;
};

const buildSitemapXml = (urls) => {
  let body = '';
  urls.forEach((loc) => {
    body += `  <url><loc>${loc}</loc></url>\n`;
  });
  return `${XML_HEADER}${URLSET_OPEN}${body}${URLSET_CLOSE}`;
};

export const writeSitemap = async ({ directories, targetPath, baseUrl, gzip = false }) => {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const urls = directories.map((pathValue) => {
    const encodedPath = encodePath(pathValue);
    return normalizedBase ? `${normalizedBase}${encodedPath}` : encodedPath;
  });
  const xml = buildSitemapXml(urls);
  const tmpPath = `${targetPath}.tmp`;
  await fsPromises.writeFile(tmpPath, xml, 'utf8');
  await fsPromises.rename(tmpPath, targetPath);
  if (gzip) {
    const gzPath = `${targetPath}.gz`;
    const tmpGzPath = `${gzPath}.tmp`;
    const gzipped = await new Promise((resolve, reject) => {
      zlib.gzip(xml, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
    await fsPromises.writeFile(tmpGzPath, gzipped);
    await fsPromises.rename(tmpGzPath, gzPath);
  }
};
