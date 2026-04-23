export default async function handler(req, res) {
  // CORS
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
    
    // Logging untuk debugging (akan muncul di Vercel Logs)
    console.log('APPS_SCRIPT_URL exists:', !!APPS_SCRIPT_URL);
    
    if (!APPS_SCRIPT_URL) {
      console.error('FATAL: APPS_SCRIPT_URL tidak diset di environment');
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error: APPS_SCRIPT_URL missing' 
      });
    }

    const { action } = req.query;
    if (!action) {
      return res.status(400).json({ success: false, error: 'Parameter action diperlukan' });
    }

    const targetUrl = `${APPS_SCRIPT_URL}?action=${action}`;
    console.log('Forwarding to:', targetUrl.replace(/\/exec.*/, '/exec?action=***'));

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(req.body),
    });

    const text = await response.text();
    console.log('Apps Script response length:', text.length);
    console.log('First 150 chars:', text.substring(0, 150));

    // Coba parse JSON
    try {
      const json = JSON.parse(text);
      return res.status(200).json(json);
    } catch (parseError) {
      console.error('Respons bukan JSON. Isi:', text.substring(0, 500));
      return res.status(500).json({ 
        success: false, 
        error: 'Invalid JSON response from Apps Script',
        hint: text.substring(0, 200)
      });
    }
  } catch (error) {
    console.error('Proxy Error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}