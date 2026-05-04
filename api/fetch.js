// Vercel Serverless Function — proxies RapidAPI for Social Elevate
// Deploy free at vercel.com — add RAPID_API_KEY in Vercel environment variables

export default async function handler(req, res) {
  // Allow requests from your Hostinger site
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const RAPID_API_KEY = process.env.RAPID_API_KEY;
  if (!RAPID_API_KEY) return res.status(503).json({ error: 'API not configured' });

  try {
    const body = new URLSearchParams({ url });
    if (url.toLowerCase().includes('facebook') || url.toLowerCase().includes('fb.')) {
      body.set('app', 'fbl');
    }

    const apiRes = await fetch('https://all-video-downloader1.p.rapidapi.com/all', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/x-www-form-urlencoded',
        'x-rapidapi-key':  RAPID_API_KEY,
        'x-rapidapi-host': 'all-video-downloader1.p.rapidapi.com'
      },
      body: body.toString()
    });

    const data = await apiRes.json();
    if (!apiRes.ok) return res.status(502).json({ error: data.message || 'API error' });
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
