import { getDirectoryTree } from '../lib/hash-cache.js';

export const registerTreeRoute = (app) => {
  app.get('/api/tree', (req, res) => {
    try {
      const nodes = getDirectoryTree();
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json({
        nodes,
      });
    } catch (error) {
      console.error('Tree request failed', error);
      res.status(500).json({ error: 'Failed to build tree' });
    }
  });
};
