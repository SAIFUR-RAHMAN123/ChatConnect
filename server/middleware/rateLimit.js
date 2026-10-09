const { HttpError } = require('../utils/httpError');

// Tiny in-memory limiter (per IP). Good enough for one server instance.
const rateLimit = ({ windowMs, max, message }) => {
  const hits = new Map();
  return (req, _res, next) => {
    const now = Date.now();
    const recent = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) return next(new HttpError(429, message));
    recent.push(now);
    hits.set(req.ip, recent);
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v[v.length - 1] > windowMs) hits.delete(k);
    next();
  };
};

module.exports = rateLimit;