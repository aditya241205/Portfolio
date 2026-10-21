module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const adminPassword = process.env.ADMIN_PASSWORD;
  const { pw } = req.query || {};

  if (!adminPassword || pw !== adminPassword) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const upstashUrl   = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  let visits = [];
  if (upstashUrl && upstashToken) {
    try {
      const r = await fetch(`${upstashUrl}/lrange/portfolio_visits/0/199`, {
        headers: { Authorization: `Bearer ${upstashToken}` },
      });
      if (r.ok) {
        const data = await r.json();
        visits = (data.result || [])
          .map((s) => { try { return JSON.parse(s); } catch { return null; } })
          .filter(Boolean);
      }
    } catch { /* return empty */ }
  }

  return res.status(200).json({ visits, configured: !!(upstashUrl && upstashToken) });
};
