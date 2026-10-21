module.exports = async function handler(req, res) {
  // ── Auth check ────────────────────────────────────────────────────────────
  const adminPassword = process.env.ADMIN_PASSWORD;
  const { pw } = req.query || {};

  if (!adminPassword || pw !== adminPassword) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(401).send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Admin Login</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',sans-serif;background:#111312;color:#f3f3ed;min-height:100vh;display:flex;align-items:center;justify-content:center}
    .card{background:#181b19;border:1px solid #2a2e2b;border-radius:16px;padding:40px;width:340px;text-align:center}
    h1{font-size:18px;margin-bottom:8px;color:#ceff46}
    p{color:#a1a79f;font-size:13px;margin-bottom:24px}
    input{width:100%;background:#111312;border:1px solid #2a2e2b;color:#f3f3ed;padding:10px 14px;border-radius:8px;font-size:14px;outline:none;margin-bottom:12px}
    input:focus{border-color:#ceff46}
    button{width:100%;background:#ceff46;color:#111312;font-weight:700;font-size:14px;padding:11px;border:none;border-radius:8px;cursor:pointer}
    button:hover{opacity:.88}
  </style>
</head>
<body>
  <div class="card">
    <h1>Visitor Dashboard</h1>
    <p>Enter your admin password to continue.</p>
    <form onsubmit="event.preventDefault();location.href='/api/visitors?pw='+encodeURIComponent(document.getElementById('pw').value)">
      <input id="pw" type="password" placeholder="Admin password" autofocus>
      <button type="submit">View Dashboard →</button>
    </form>
  </div>
</body>
</html>`);
  }

  // ── Fetch visits from Upstash ─────────────────────────────────────────────
  const upstashUrl   = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  let visits = [];
  let redisConfigured = !!(upstashUrl && upstashToken);

  if (redisConfigured) {
    try {
      const r = await fetch(`${upstashUrl}/lrange/portfolio_visits/0/999`, {
        headers: { Authorization: `Bearer ${upstashToken}` },
      });
      if (r.ok) {
        const data = await r.json();
        visits = (data.result || []).map((s) => {
          try { return JSON.parse(s); } catch { return null; }
        }).filter(Boolean);
      }
    } catch { /* show empty state */ }
  }

  // ── Parse user-agent into readable browser/OS ─────────────────────────────
  function parseUA(ua = '') {
    let browser = 'Unknown', os = 'Unknown';
    if (/Edg\//i.test(ua))          browser = 'Edge';
    else if (/OPR\//i.test(ua))     browser = 'Opera';
    else if (/Chrome\//i.test(ua))  browser = 'Chrome';
    else if (/Firefox\//i.test(ua)) browser = 'Firefox';
    else if (/Safari\//i.test(ua))  browser = 'Safari';
    else if (/MSIE|Trident/i.test(ua)) browser = 'IE';
    if (/Windows/i.test(ua))        os = 'Windows';
    else if (/Android/i.test(ua))   os = 'Android';
    else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
    else if (/Mac OS/i.test(ua))    os = 'macOS';
    else if (/Linux/i.test(ua))     os = 'Linux';
    return `${browser} / ${os}`;
  }

  function formatTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  }

  function flagEmoji(cc = '') {
    if (!cc || cc.length !== 2) return '';
    return cc.toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) + 127397));
  }

  function esc(s = '') {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const uniqueIPs    = new Set(visits.map(v => v.ip)).size;
  const countries    = [...new Set(visits.map(v => v.country).filter(Boolean))];
  const topCountry   = countries.length
    ? [...visits.reduce((m, v) => { if (v.country) m.set(v.country, (m.get(v.country)||0)+1); return m; }, new Map())]
        .sort((a,b)=>b[1]-a[1])[0][0]
    : '—';

  // ── Row HTML ─────────────────────────────────────────────────────────────
  const rowsHtml = visits.length === 0
    ? `<tr><td colspan="6" style="text-align:center;padding:40px;color:#666;">No visits logged yet. Deploy your portfolio and wait for your first visitor!</td></tr>`
    : visits.map(v => `
<tr>
  <td class="mono">${esc(v.ip)}</td>
  <td>${flagEmoji(v.cc)} ${esc(v.city || '—')}${v.region ? ', ' + esc(v.region) : ''}</td>
  <td>${esc(v.country || '—')}</td>
  <td class="isp">${esc(v.isp || '—')}</td>
  <td>${esc(parseUA(v.ua))}</td>
  <td class="time">${formatTime(v.ts)}</td>
</tr>`).join('');

  // ── Full HTML dashboard ───────────────────────────────────────────────────
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Visitor Dashboard · Aditya</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root{
      --bg:#111312;--panel:#181b19;--panel2:#1e221f;
      --text:#f3f3ed;--sub:#a1a79f;--line:#2a2e2b;
      --acid:#ceff46;--orange:#ff754c;
      --mono:'DM Mono',monospace;--sans:'Manrope',sans-serif;
    }
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:var(--sans);background:var(--bg);color:var(--text);min-height:100vh;padding:32px 24px}
    .wrap{max-width:1200px;margin:0 auto}

    /* Header */
    .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:40px;padding-bottom:24px;border-bottom:1px solid var(--line)}
    .header-left h1{font-size:24px;font-weight:800;letter-spacing:-.02em}
    .header-left h1 span{color:var(--acid)}
    .header-left p{color:var(--sub);font-size:13px;margin-top:4px}
    .badge{background:var(--panel2);border:1px solid var(--line);border-radius:20px;padding:6px 14px;font-size:12px;color:var(--sub);font-family:var(--mono)}

    /* Stats row */
    .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:32px}
    .stat{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:20px 24px}
    .stat-label{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--sub);margin-bottom:8px}
    .stat-value{font-size:28px;font-weight:800;color:var(--text)}
    .stat-value.acid{color:var(--acid)}

    /* Table */
    .table-wrap{background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden}
    .table-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--line)}
    .table-header h2{font-size:14px;font-weight:700}
    .count-badge{background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:4px 10px;font-size:12px;color:var(--sub);font-family:var(--mono)}
    table{width:100%;border-collapse:collapse}
    thead th{padding:12px 16px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--sub);border-bottom:1px solid var(--line);font-weight:600;white-space:nowrap}
    tbody tr{border-bottom:1px solid var(--line);transition:background .15s}
    tbody tr:last-child{border-bottom:none}
    tbody tr:hover{background:var(--panel2)}
    td{padding:12px 16px;font-size:13px;vertical-align:middle}
    td.mono{font-family:var(--mono);font-size:12px;color:var(--acid)}
    td.isp{color:var(--sub);font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    td.time{color:var(--sub);font-size:12px;white-space:nowrap;font-family:var(--mono)}

    /* Refresh button */
    .refresh-btn{background:var(--acid);color:#111312;font-weight:700;font-size:13px;padding:8px 18px;border:none;border-radius:8px;cursor:pointer;font-family:var(--sans);text-decoration:none}
    .refresh-btn:hover{opacity:.85}

    /* Empty / no-redis states */
    .notice{background:var(--panel2);border:1px solid #ff754c44;border-radius:12px;padding:24px;margin-bottom:32px;font-size:13px;line-height:1.7;color:var(--sub)}
    .notice strong{color:var(--orange)}
    .notice code{font-family:var(--mono);background:#111312;padding:2px 6px;border-radius:4px;font-size:12px;color:var(--acid)}

    @media(max-width:640px){
      .header{flex-direction:column;align-items:flex-start;gap:12px}
      .stats{grid-template-columns:1fr 1fr}
      td.isp,td.time{display:none}
    }
  </style>
</head>
<body>
<div class="wrap">

  <div class="header">
    <div class="header-left">
      <h1>Visitor <span>Dashboard</span></h1>
      <p>Real-time log of everyone who visited your portfolio</p>
    </div>
    <a class="refresh-btn" href="/api/visitors?pw=${esc(pw)}">↻ Refresh</a>
  </div>

  ${!redisConfigured ? `
  <div class="notice">
    <strong>⚠ Upstash Redis not configured.</strong><br>
    Add these environment variables in your Vercel project settings to start logging visits:<br><br>
    <code>UPSTASH_REDIS_REST_URL</code> — your Upstash Redis REST URL<br>
    <code>UPSTASH_REDIS_REST_TOKEN</code> — your Upstash Redis REST token<br>
    <code>ADMIN_PASSWORD</code> — a secret password to protect this page<br><br>
    Create a free Redis database at <strong>upstash.com</strong> → copy the REST URL and token.
  </div>` : ''}

  <div class="stats">
    <div class="stat">
      <div class="stat-label">Total Visits</div>
      <div class="stat-value acid">${visits.length}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Unique IPs</div>
      <div class="stat-value">${uniqueIPs}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Countries</div>
      <div class="stat-value">${countries.length}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Top Country</div>
      <div class="stat-value" style="font-size:18px">${esc(topCountry)}</div>
    </div>
  </div>

  <div class="table-wrap">
    <div class="table-header">
      <h2>Visit Log <span style="color:var(--sub);font-weight:400">(newest first)</span></h2>
      <span class="count-badge">${visits.length} / 1000</span>
    </div>
    <div style="overflow-x:auto">
      <table>
        <thead>
          <tr>
            <th>IP Address</th>
            <th>City / Region</th>
            <th>Country</th>
            <th>ISP</th>
            <th>Browser / OS</th>
            <th>Time (IST)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  </div>

</div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(html);
};
