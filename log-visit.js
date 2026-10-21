module.exports = async function handler(req, res) {
  // Allow the portfolio page to call this
  const host = req.headers.host || '';
  res.setHeader('Access-Control-Allow-Origin', `https://${host}`);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Resolve real visitor IP ───────────────────────────────────────────────
  const rawForwarded = req.headers['x-forwarded-for'] || '';
  const visitorIp = rawForwarded.split(',')[0].trim()
    || req.socket?.remoteAddress
    || 'unknown';

  // Skip localhost / loopback pings (local dev)
  if (!visitorIp || visitorIp === 'unknown' || visitorIp === '::1' || visitorIp === '127.0.0.1') {
    return res.status(200).json({ ok: true, skipped: 'loopback' });
  }

  // ── Geo-enrich (ip-api.com free tier) ────────────────────────────────────
  let geo = {};
  try {
    const geoRes = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(visitorIp)}?fields=status,country,countryCode,regionName,city,isp`,
      { signal: AbortSignal.timeout(2500) }
    );
    if (geoRes.ok) {
      const d = await geoRes.json();
      if (d.status === 'success') geo = d;
    }
  } catch { /* best-effort */ }

  // ── Build visit record ────────────────────────────────────────────────────
  const body = req.body || {};
  const visit = JSON.stringify({
    ip:      visitorIp,
    city:    geo.city        || '',
    region:  geo.regionName  || '',
    country: geo.country     || '',
    cc:      geo.countryCode || '',
    isp:     geo.isp         || '',
    ua:      (req.headers['user-agent'] || '').slice(0, 250),
    ref:     (req.headers.referer || body.ref || '').slice(0, 300),
    path:    (body.path || '/').slice(0, 200),
    ts:      Date.now(),
  });

  // ── Persist to Upstash Redis ──────────────────────────────────────────────
  const upstashUrl   = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    try {
      // Pipeline: LPUSH then LTRIM to keep latest 1000 visits
      await fetch(`${upstashUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['LPUSH', 'portfolio_visits', visit],
          ['LTRIM', 'portfolio_visits', '0', '999'],
        ]),
      });
    } catch { /* non-critical */ }
  }

  return res.status(200).json({ ok: true });
};
