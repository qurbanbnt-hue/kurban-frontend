// api/proxy.js
export default async function handler(req, res) {
  // 1. Atur header CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 2. Tangani preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3. Hanya izinkan POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 4. Ambil URL Apps Script dari environment variable
    const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
    if (!APPS_SCRIPT_URL) {
      throw new Error('APPS_SCRIPT_URL tidak dikonfigurasi.');
    }

    // 5. Ambil action dari query parameter (jika ada) atau dari body
    const { action } = req.query;
    const fullUrl = action ? `${APPS_SCRIPT_URL}?action=${action}` : APPS_SCRIPT_URL;

    // 6. Teruskan permintaan ke Apps Script
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(req.body), // kirim body asli
    });

    // 7. Baca respons dan kirimkan kembali ke frontend
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      res.status(200).json(json);
    } catch (e) {
      res.status(200).send(text);
    }
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}