import { config } from "./config.js";

export function rateLimit({ windowMs, limit }) {
  const requests = new Map();
  return (req, res, next) => {
    const key = req.ip || "unknown";
    const now = Date.now();
    for (const [ip, bucket] of requests) {
      if (bucket.resetAt < now) requests.delete(ip);
    }
    const entry = requests.get(key) || { count: 0, resetAt: now + windowMs };
    if (entry.resetAt < now) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }
    entry.count += 1;
    requests.set(key, entry);
    if (entry.count > limit) {
      return res.status(429).json({ error: "Too many requests" });
    }
    return next();
  };
}

export function requireAdmin(req, res, next) {
  if (!config.adminKey || req.headers["x-admin-key"] !== config.adminKey) {
    return res.status(403).json({ error: "Admin key invalid" });
  }
  return next();
}

export function validateOrigin(req, res, next) {
  const origin = req.headers.origin;
  if (!origin || origin === config.clientOrigin) {
    return next();
  }
  return res.status(403).json({ error: "Origin not allowed" });
}
