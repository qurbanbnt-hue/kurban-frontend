export default async function handler(req, res) {
  // CORS headers
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
    
    // Log untuk debugging
    console.log('APPS_SCRIPT_URL:', APPS_SCRIPT_URL ? '***SET***' : 'NOT SET');
    
    if (!APPS_SCRIPT_URL) {
      console.error('FATAL: APPS_SCRIPT_URL tidak dikonfigurasi di environment Vercel');
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error: APPS_SCRIPT_URL missing' 
      });
    }

    const { action } = req.query;
    const targetUrl = action ? `${APPS_SCRIPT_URL}?action=${action}` : APPS_SCRIPT_URL;
    
    console.log('Forwarding to:', targetUrl.replace(/\/exec.*/, '/exec?action=***')); // Jangan log full URL

    // Kirim request ke Apps Script
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(req.body),
    });

    const text = await response.text();
    console.log('Apps Script response length:', text.length);
    console.log('First 100 chars:', text.substring(0, 100));

    // Coba parse sebagai JSON
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
    console.error('Stack:', error.stack);
    return res.status(500).json({ success: false, error: error.message });
  }
}