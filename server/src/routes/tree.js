import { getDirectoryTree } from '../lib/hash-cache.js';
import { API_CACHE_CONTROL } from '../lib/http.js';

export const registerTreeRoute = (app) => {
  app.get('/api/tree', (req, res) => {
    try {
      const nodes = getDirectoryTree();
      res.setHeader('Cache-Control', API_CACHE_CONTROL);
      res.json({
        nodes,
      });
    } catch (error) {
      console.error('Tree request failed', error);
      res.status(500).json({ error: 'Failed to build tree' });
    }
  });
};
