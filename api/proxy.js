// api/proxy.js
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Tangani preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Hanya izinkan POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
    if (!APPS_SCRIPT_URL) {
      console.error('❌ APPS_SCRIPT_URL is not set in environment');
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error: APPS_SCRIPT_URL missing' 
      });
    }

    const { action } = req.query;
    const targetUrl = action ? `${APPS_SCRIPT_URL}?action=${action}` : APPS_SCRIPT_URL;

    console.log(`📡 Proxying to: ${targetUrl.replace(/\/exec.*/, '/exec?action=***')}`);

    // Gunakan fetch versi Node.js
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(req.body),
    });

    const text = await response.text();
    console.log(`📦 Response status: ${response.status}, length: ${text.length}`);

    // Cek apakah respons kosong
    if (!text) {
      return res.status(500).json({ success: false, error: 'Apps Script returned empty response' });
    }

    // Coba parse JSON
    try {
      const json = JSON.parse(text);
      return res.status(200).json(json);
    } catch (parseError) {
      console.error('❌ Response is not JSON:', text.substring(0, 200));
      return res.status(500).json({
        success: false,
        error: 'Invalid JSON response from Apps Script',
        hint: text.substring(0, 100)
      });
    }
  } catch (error) {
    console.error('🔥 Proxy error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}