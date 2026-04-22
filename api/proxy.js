export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
    if (!APPS_SCRIPT_URL) {
      throw new Error('APPS_SCRIPT_URL tidak dikonfigurasi di environment Vercel');
    }

    const { action } = req.query;
    const targetUrl = action ? `${APPS_SCRIPT_URL}?action=${action}` : APPS_SCRIPT_URL;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(req.body),
    });

    const text = await response.text();
    try {
      const json = JSON.parse(text);
      res.status(200).json(json);
    } catch (e) {
      res.status(500).json({ success: false, error: 'Respons bukan JSON', raw: text.substring(0, 200) });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}