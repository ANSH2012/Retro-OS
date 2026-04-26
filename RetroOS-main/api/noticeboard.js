import { Redis } from '@upstash/redis';

// ✅ FIX: define key at top
const NOTICEBOARD_KEY = "retroos:noticeboard";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

const useRedis = Boolean(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN);

// ✅ FIX: use computed key
const localNoticeboardStore = {
  [NOTICEBOARD_KEY]: {}
};

async function getNoticeboardStore() {
  if (useRedis) return await redis.hgetall(NOTICEBOARD_KEY) || {};
  return localNoticeboardStore[NOTICEBOARD_KEY];
}

async function saveNoticeboardItems(items) {
  if (useRedis) return await redis.hset(NOTICEBOARD_KEY, items);
  Object.assign(localNoticeboardStore[NOTICEBOARD_KEY], items);
}

async function removeNoticeboardItem(id) {
  if (useRedis) return await redis.hdel(NOTICEBOARD_KEY, id);
  delete localNoticeboardStore[NOTICEBOARD_KEY][id];
}

const ADMIN_PASSWORD = process.env.ADMIN_SECRET_KEY || "RetroAdmin$123";

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ===== GET =====
    if (req.method === 'GET') {
      const posts = await getNoticeboardStore();
      const list = Object.values(posts)
        .map(p => typeof p === 'string' ? JSON.parse(p) : p)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return res.status(200).json({ success: true, posts: list });
    }

    // ===== POST =====
    if (req.method === 'POST') {
      const adminKey = req.headers['x-admin-key'];
      if (adminKey !== ADMIN_PASSWORD) {
        return res.status(403).json({ success: false, error: "Unauthorized." });
      }

      const { title, content, tag } = req.body || {};
      if (!title || !content) {
        return res.status(400).json({ success: false, error: "Title and content are required." });
      }

      const id = `nb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const post = {
        id,
        title,
        content,
        tag: tag || "info",
        timestamp: new Date().toISOString(),
      };

      await saveNoticeboardItems({ [id]: JSON.stringify(post) });

      return res.status(201).json({ success: true, post });
    }

    // ===== PUT =====
    if (req.method === 'PUT') {
      const adminKey = req.headers['x-admin-key'];
      if (adminKey !== ADMIN_PASSWORD) {
        return res.status(403).json({ success: false, error: "Unauthorized." });
      }

      const { id, title, content, tag } = req.body || {};
      if (!id || !title || !content) {
        return res.status(400).json({ success: false, error: "ID, title, and content are required." });
      }

      const existing = useRedis
        ? await redis.hget(NOTICEBOARD_KEY, id)
        : localNoticeboardStore[NOTICEBOARD_KEY][id];

      if (!existing) {
        return res.status(404).json({ success: false, error: "Post not found." });
      }

      const oldPost = typeof existing === 'string' ? JSON.parse(existing) : existing;

      const updated = {
        ...oldPost,
        title,
        content,
        tag: tag || "info",
        updatedAt: new Date().toISOString(),
      };

      await saveNoticeboardItems({ [id]: JSON.stringify(updated) });

      return res.status(200).json({ success: true, post: updated });
    }

    // ===== DELETE =====
    if (req.method === 'DELETE') {
      const adminKey = req.headers['x-admin-key'];
      if (adminKey !== ADMIN_PASSWORD) {
        return res.status(403).json({ success: false, error: "Unauthorized." });
      }

      const id = req.query?.id;
      if (!id) {
        return res.status(400).json({ success: false, error: "Post ID required." });
      }

      await removeNoticeboardItem(id);

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, error: "Method not allowed." });

  } catch (error) {
    console.error("Noticeboard API error:", error);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
}