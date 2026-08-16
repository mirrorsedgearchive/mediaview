import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { CONTENT_WARNING_FILE } from '../config.js';
import { resolveSafePath, toPosix } from './paths.js';

const getPathChain = (relativePath) => {
  const segments = toPosix(relativePath).split('/').filter(Boolean);
  const paths = [''];
  let current = '';
  segments.forEach((segment) => {
    current = current ? `${current}/${segment}` : segment;
    paths.push(current);
  });
  return paths;
};

export const getContentWarning = async (relativePath) => {
  const candidates = getPathChain(relativePath).reverse();
  for (const candidate of candidates) {
    const warningPath = path.join(resolveSafePath(candidate), CONTENT_WARNING_FILE);
    try {
      const content = await fsPromises.readFile(warningPath, 'utf8');
      return { path: toPosix(candidate), content };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return null;
};
