import { getBasename, getDirname } from './format.js';
import { buildUrlState } from './urlState.js';

export const buildPreviewUrlForEntry = (entry, origin) => {
  if (!entry?.path) return '';
  const resolvedOrigin = origin || window.location.origin;
  const previewPath = getDirname(entry.path);
  const previewName = entry.name || getBasename(entry.path);
  const previewStateUrl = buildUrlState({ path: previewPath, preview: previewName });
  return new URL(previewStateUrl, resolvedOrigin).toString();
};

export const tryNativeShare = async ({ title, url }) => {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return { shared: false, cancelled: false };
  }
  try {
    await navigator.share({ title, url });
    return { shared: true, cancelled: false };
  } catch (error) {
    if (error?.name === 'AbortError') {
      return { shared: false, cancelled: true };
    }
    return { shared: false, cancelled: false, error };
  }
};

export const copyToClipboard = async (value) => {
  const writeText = navigator?.clipboard?.writeText;
  if (typeof writeText !== 'function') {
    throw new Error('Clipboard API is unavailable.');
  }
  await writeText.call(navigator.clipboard, value);
};
