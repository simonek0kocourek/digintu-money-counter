import { Redis } from '@upstash/redis';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface WorkDay {
  id: string;
  date: string;
  hours: number;
  earned: number;
}

// Initialize Redis client
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const isRedisConfigured = !!url && !!token;

const redis = new Redis({
  url: url || '',
  token: token || '',
});

let mockHistory: WorkDay[] = [];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Fallback to in-memory history if database variables are not configured yet
  if (!isRedisConfigured) {
    console.warn('Upstash Redis URL/Token is not configured. Falling back to memory.');
    if (req.method === 'GET') {
      return res.status(200).json(mockHistory);
    } else if (req.method === 'POST') {
      const { date, hours, earned } = req.body;
      const newDay: WorkDay = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        date,
        hours,
        earned,
      };
      mockHistory.push(newDay);
      return res.status(200).json(mockHistory);
    } else if (req.method === 'DELETE') {
      const { id } = req.query;
      if (id && typeof id === 'string') {
        mockHistory = mockHistory.filter((day) => day.id !== id);
      } else {
        mockHistory = [];
      }
      return res.status(200).json(mockHistory);
    }
    return res.status(405).end();
  }

  const HISTORY_KEY = 'digintu_work_days_history';

  if (req.method === 'GET') {
    try {
      const history = await redis.get(HISTORY_KEY);
      return res.status(200).json(history || []);
    } catch (error) {
      console.error('Failed to get history from Redis:', error);
      return res.status(500).json({ error: 'Failed to fetch history' });
    }
  } else if (req.method === 'POST') {
    try {
      const { date, hours, earned } = req.body;
      if (!date || hours === undefined || earned === undefined) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      const rawHistory = await redis.get(HISTORY_KEY);
      const history = (rawHistory ? (typeof rawHistory === 'string' ? JSON.parse(rawHistory) : rawHistory) : []) as WorkDay[];

      const newDay: WorkDay = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        date,
        hours,
        earned,
      };

      history.push(newDay);
      await redis.set(HISTORY_KEY, JSON.stringify(history));

      return res.status(200).json(history);
    } catch (error) {
      console.error('Failed to save history entry to Redis:', error);
      return res.status(500).json({ error: 'Failed to save history entry' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.query;

      // If an ID is provided, delete that specific row
      if (id && typeof id === 'string') {
        const rawHistory = await redis.get(HISTORY_KEY);
        const history = (rawHistory ? (typeof rawHistory === 'string' ? JSON.parse(rawHistory) : rawHistory) : []) as WorkDay[];
        
        const updatedHistory = history.filter((day) => day.id !== id);
        await redis.set(HISTORY_KEY, JSON.stringify(updatedHistory));
        return res.status(200).json(updatedHistory);
      } else {
        // If no ID is provided, clear the entire leaderboard history
        await redis.set(HISTORY_KEY, JSON.stringify([]));
        return res.status(200).json([]);
      }
    } catch (error) {
      console.error('Failed to delete history from Redis:', error);
      return res.status(500).json({ error: 'Failed to perform delete operation' });
    }
  } else {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
}
