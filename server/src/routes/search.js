import { searchHashCache } from '../lib/hash-cache.js';

export const registerSearchRoute = (app) => {
  app.get('/api/search', async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    try {
      const { results, truncated } = await searchHashCache(query);
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json({
        query,
        results,
        truncated,
      });
    } catch (error) {
      console.error('Search request failed', error);
      res.status(500).json({ error: 'Failed to search' });
    }
  });
};
