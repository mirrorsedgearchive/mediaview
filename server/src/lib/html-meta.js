import { getPageContext } from './page-context.js';

const TITLE_OPEN = '<title>';
const TITLE_CLOSE = '</title>';
const NOSCRIPT_PLACEHOLDER = '<!-- NOSCRIPT_DIRECTORY_LIST -->';
const RENDER_CACHE = new Map();
let RENDER_CACHE_EPOCH = null;

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildMetaBlock = ({ title, description, image, url }) => {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeUrl = escapeHtml(url);
  return (
    `\n    <meta property="og:title" content="${safeTitle}">` +
    `\n    <meta property="og:description" content="${safeDescription}">` +
    `\n    <meta property="og:type" content="website">` +
    `\n    <meta property="og:image" content="${safeImage}">` +
    `\n    <meta property="og:url" content="${safeUrl}">` +
    `\n    <meta name="twitter:card" content="summary">` +
    `\n    <meta name="twitter:title" content="${safeTitle}">` +
    `\n    <meta name="twitter:description" content="${safeDescription}">` +
    `\n    <meta name="twitter:image" content="${safeImage}">`
  );
};

const findTitleBounds = (templateLower) => {
  const openIndex = templateLower.indexOf(TITLE_OPEN);
  const closeIndex = templateLower.indexOf(TITLE_CLOSE);
  if (openIndex === -1 || closeIndex === -1 || closeIndex < openIndex) {
    return null;
  }
  return {
    openIndex,
    closeIndex: closeIndex + TITLE_CLOSE.length,
  };
};

export const createIndexHtmlRenderer = (
  template,
  { baseTitle, getNoscriptContent, siteOrigin, getCacheEpoch }
) => {
  const templateLower = template.toLowerCase();
  const headEndIndex = templateLower.indexOf('</head>');
  if (headEndIndex === -1) {
    throw new Error('index.html is missing </head>');
  }
  const titleBounds = findTitleBounds(templateLower);
  const bodyEndIndex = templateLower.indexOf('</body>');

  return (req) => {
    const { origin, pathname, title } = getPageContext(req, { baseTitle, siteOrigin });
    const epoch = getCacheEpoch ? getCacheEpoch() : null;
    if (epoch !== null && epoch !== RENDER_CACHE_EPOCH) {
      RENDER_CACHE.clear();
      RENDER_CACHE_EPOCH = epoch;
    }
    const cacheKey = `${origin}|${pathname}|${title}`;
    if (epoch !== null && RENDER_CACHE.has(cacheKey)) {
      return RENDER_CACHE.get(cacheKey);
    }
    const description = baseTitle;
    const image = `${origin}/icon-192.png`;
    const url = `${origin}${pathname}`;
    const titleTag = `<title>${escapeHtml(title)}</title>`;
    const metaBlock = buildMetaBlock({ title, description, image, url });
    const noscriptContent = getNoscriptContent ? getNoscriptContent(req) : '';

    let html = template;
    if (titleBounds) {
      html =
        html.slice(0, titleBounds.openIndex) +
        titleTag +
        html.slice(titleBounds.closeIndex, headEndIndex) +
        metaBlock +
        html.slice(headEndIndex);
    } else {
      html = html.slice(0, headEndIndex) + titleTag + metaBlock + html.slice(headEndIndex);
    }

    if (!noscriptContent) {
      if (epoch !== null) {
        RENDER_CACHE.set(cacheKey, html);
      }
      return html;
    }

    const placeholderIndex = html.indexOf(NOSCRIPT_PLACEHOLDER);
    if (placeholderIndex !== -1) {
      const rendered = html.replace(NOSCRIPT_PLACEHOLDER, noscriptContent);
      if (epoch !== null) {
        RENDER_CACHE.set(cacheKey, rendered);
      }
      return rendered;
    }

    if (bodyEndIndex !== -1) {
      const rendered =
        html.slice(0, bodyEndIndex) +
        `<noscript>\n${noscriptContent}\n</noscript>\n` +
        html.slice(bodyEndIndex);
      if (epoch !== null) {
        RENDER_CACHE.set(cacheKey, rendered);
      }
      return rendered;
    }

    if (epoch !== null) {
      RENDER_CACHE.set(cacheKey, html);
    }
    return html;
  };
};
