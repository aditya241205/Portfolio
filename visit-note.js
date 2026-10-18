module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return res.status(403).json({ error: 'Request not allowed' });
      }
    } catch {
      return res.status(403).json({ error: 'Request not allowed' });
    }
  }

  const body = req.body || {};
  if (typeof body.website === 'string' && body.website.trim()) {
    return res.status(200).json({ ok: true });
  }

  const name = typeof body.name === 'string'
    ? body.name.replace(/[\r\n\t]/g, ' ').trim().slice(0, 60)
    : '';
  if (!name || body.consent !== true) {
    return res.status(400).json({ error: 'Please enter your name and consent to share it.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    return res.status(503).json({ error: 'Visit notifications are not configured yet.' });
  }

  const safeName = name.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: ['adityaukyadav24@gmail.com'],
        subject: `Portfolio visit note from ${name}`,
        text: `${name} chose to leave their name on your portfolio.`,
        html: `<p><strong>${safeName}</strong> chose to leave their name on your portfolio.</p>`
      })
    });

    if (!response.ok) {
      return res.status(502).json({ error: 'The email service could not send the notification.' });
    }
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(502).json({ error: 'Could not send the notification. Please try again later.' });
  }
};
