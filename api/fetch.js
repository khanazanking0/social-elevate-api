// Social Elevate – Vercel API v3
// Confirmed working endpoints per platform

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const KEY = process.env.RAPID_API_KEY;
  if (!KEY) return res.status(503).json({ error: 'API not configured' });

  const u = url.toLowerCase();
  const isYouTube  = u.includes('youtube.com') || u.includes('youtu.be');
  const isFacebook = u.includes('facebook.com') || u.includes('fb.watch') || u.includes('fb.com');

  try {

    // ── YOUTUBE ──────────────────────────────────────────────
    // Confirmed endpoint: GET /download?video=VIDEO_ID
    // host: youtube-search-download3.p.rapidapi.com
    // Subscribe: rapidapi.com/boztek-technology-boztek-technology-default/api/youtube-search-download3
    if (isYouTube) {
      // Extract video ID from URL
      let videoId = '';
      try {
        const parsed = new URL(url);
        if (parsed.hostname.includes('youtu.be')) {
          videoId = parsed.pathname.replace('/', '');
        } else {
          videoId = parsed.searchParams.get('v') || '';
        }
        // Handle shorts
        if (!videoId && parsed.pathname.includes('/shorts/')) {
          videoId = parsed.pathname.split('/shorts/')[1].split('/')[0];
        }
      } catch {}

      if (!videoId) return res.status(400).json({ error: 'Could not extract YouTube video ID from URL' });

      const r = await fetch(`https://youtube-search-download3.p.rapidapi.com/download?video=${videoId}`, {
        headers: {
          'x-rapidapi-key':  KEY,
          'x-rapidapi-host': 'youtube-search-download3.p.rapidapi.com'
        }
      });
      const d = await r.json();
      console.log('YouTube:', JSON.stringify(d).slice(0, 400));

      if (!r.ok || d.error) {
        return res.status(502).json({ error: 'YouTube failed: ' + (d?.message || d?.error || r.status) + '. Make sure you subscribed to: rapidapi.com/boztek-technology-boztek-technology-default/api/youtube-search-download3' });
      }

      // Response: { mp4: [{url, quality}], mp3: [{url}], title, thumbnail }
      const links = [];
      (d.mp4 || []).forEach(v => {
        if (v.url) links.push({ label: v.quality || 'MP4', quality: guessQuality(v.quality, v.url), ext: 'mp4', url: v.url });
      });
      (d.mp3 || []).forEach(a => {
        if (a.url) links.push({ label: 'MP3 Audio', quality: 'MP3', ext: 'mp3', url: a.url });
      });
      // Fallback if different shape
      if (links.length === 0) {
        const formats = d.formats || d.links || d.videos || d.items || [];
        formats.forEach(f => {
          const furl = f.url || f.link || f.download_url;
          if (furl) links.push({ label: f.quality || f.format || 'Download', quality: guessQuality(f.quality, furl), ext: guessExt(furl, f.quality), url: furl });
        });
      }
      if (links.length === 0 && d.url) links.push({ label: 'Download', quality: 'HD', ext: 'mp4', url: d.url });

      if (links.length === 0) return res.status(502).json({ error: 'YouTube: no download links in response. Raw: ' + JSON.stringify(d).slice(0, 200) });

      return res.status(200).json({ title: d.title || 'YouTube Video', thumbnail: d.thumbnail || d.thumb || '', uploader: d.channel || d.author || '', medias: links });
    }

    // ── FACEBOOK ─────────────────────────────────────────────
    if (isFacebook) {
      const errors = [];

      // Free public API (no key)
      try {
        const r = await fetch('https://fdown.isuru.eu.org/info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        const d = await r.json();
        console.log('FB1:', JSON.stringify(d).slice(0, 300));
        if (r.ok && d && (d.hd_url || d.sd_url || d.download_url)) {
          const links = [];
          if (d.hd_url) links.push({ label: 'HD Video', quality: 'HD', ext: 'mp4', url: d.hd_url });
          if (d.sd_url) links.push({ label: 'SD Video', quality: 'SD', ext: 'mp4', url: d.sd_url });
          if (d.download_url && links.length === 0) links.push({ label: 'Download', quality: 'HD', ext: 'mp4', url: d.download_url });
          if (links.length > 0) return res.status(200).json({ title: d.title || 'Facebook Video', thumbnail: d.thumbnail || '', uploader: '', medias: links });
        }
        errors.push('FB1: ' + (d?.detail || d?.message || r.status));
      } catch(e) { errors.push('FB1: ' + e.message); }

      // RapidAPI Facebook fallback
      try {
        const r = await fetch(`https://facebook17.p.rapidapi.com/?url=${encodeURIComponent(url)}`, {
          headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': 'facebook17.p.rapidapi.com' }
        });
        const d = await r.json();
        console.log('FB2:', JSON.stringify(d).slice(0, 300));
        if (r.ok && d && (d.hd || d.sd || d.url)) {
          const links = [];
          if (d.hd) links.push({ label: 'HD Video', quality: 'HD', ext: 'mp4', url: d.hd });
          if (d.sd) links.push({ label: 'SD Video', quality: 'SD', ext: 'mp4', url: d.sd });
          if (d.url && links.length === 0) links.push({ label: 'Download', quality: 'HD', ext: 'mp4', url: d.url });
          if (links.length > 0) return res.status(200).json({ title: d.title || 'Facebook Video', thumbnail: d.thumbnail || '', uploader: '', medias: links });
        }
        errors.push('FB2: ' + (d?.message || r.status));
      } catch(e) { errors.push('FB2: ' + e.message); }

      return res.status(502).json({ error: 'Facebook download failed. Make sure the video is public. ' + errors.join(' | ') });
    }

    // ── TIKTOK / INSTAGRAM / TWITTER ─────────────────────────
    // Confirmed: POST /all with form body
    const body = new URLSearchParams({ url });
    const r = await fetch('https://all-video-downloader1.p.rapidapi.com/all', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/x-www-form-urlencoded',
        'x-rapidapi-key':  KEY,
        'x-rapidapi-host': 'all-video-downloader1.p.rapidapi.com'
      },
      body: body.toString()
    });
    const d = await r.json();
    console.log('TikTok/Insta/Twitter:', JSON.stringify(d).slice(0, 400));

    if (!r.ok || d.error) {
      return res.status(502).json({ error: d?.message || d?.error || 'Could not fetch video. Status: ' + r.status });
    }
    if (d.medias || d.links || d.url) return res.status(200).json(d);
    return res.status(502).json({ error: 'No download links found. Raw: ' + JSON.stringify(d).slice(0, 200) });

  } catch(e) {
    console.error('Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

function guessQuality(label, url) {
  const s = ((label||'') + ' ' + (url||'')).toLowerCase();
  if (s.includes('mp3') || s.includes('audio')) return 'MP3';
  if (s.includes('1080') || s.includes('hd'))   return 'HD';
  if (s.includes('720'))                         return 'HD';
  if (s.includes('480') || s.includes('360') || s.includes('sd')) return 'SD';
  return 'HD';
}

function guessExt(url, label) {
  const s = ((label||'') + ' ' + (url||'')).toLowerCase();
  if (s.includes('mp3') || s.includes('audio')) return 'mp3';
  if ((url||'').includes('.webm'))               return 'webm';
  return 'mp4';
}
