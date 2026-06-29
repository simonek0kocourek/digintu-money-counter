import { Redis } from '@upstash/redis';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Initialize Redis client with automatic fallback for environment variables
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const isRedisConfigured = !!url && !!token;

const redis = new Redis({
  url: url || '',
  token: token || '',
});

let mockSession = { status: 'idle', startTime: null, accumulatedTime: 0, dateStarted: null };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers for Vercel functions
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Fallback to in-memory state if database variables are not configured yet
  if (!isRedisConfigured) {
    console.warn('Upstash Redis URL/Token is not configured. Falling back to memory.');
    if (req.method === 'GET') {
      return res.status(200).json(mockSession);
    } else if (req.method === 'POST') {
      mockSession = req.body;
      return res.status(200).json({ success: true });
    }
    return res.status(405).end();
  }

  if (req.method === 'GET') {
    try {
      const session = await redis.get('digintu_session');
      return res.status(200).json(session || { status: 'idle', startTime: null, accumulatedTime: 0, dateStarted: null });
    } catch (error) {
      console.error('Failed to get session from Redis:', error);
      return res.status(500).json({ error: 'Failed to fetch session' });
    }
  } else if (req.method === 'POST') {
    try {
      const session = req.body;
      await redis.set('digintu_session', JSON.stringify(session));
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Failed to save session to Redis:', error);
      return res.status(500).json({ error: 'Failed to update session' });
    }
  } else {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
}
