// Social Elevate – Vercel API Function v2
// Per-platform dedicated APIs

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
    if (isYouTube) {
      const errors = [];

      // Try YouTube Media Downloader (DataFanatic)
      try {
        const r = await fetch(`https://youtube-media-downloader.p.rapidapi.com/v2/video/details?videoId=${encodeURIComponent(url)}`, {
          headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': 'youtube-media-downloader.p.rapidapi.com' }
        });
        const d = await r.json();
        console.log('YT1:', JSON.stringify(d).slice(0, 300));
        if (r.ok && d && (d.videos || d.audios)) {
          const links = [];
          (d.videos?.items || []).forEach(v => {
            if (v.url) links.push({ label: v.quality || 'MP4', quality: guessQuality(v.quality, v.url), ext: 'mp4', url: v.url });
          });
          (d.audios?.items || []).forEach(a => {
            if (a.url) links.push({ label: 'MP3 Audio', quality: 'MP3', ext: 'mp3', url: a.url });
          });
          if (links.length > 0) return res.status(200).json({ title: d.title || 'YouTube Video', thumbnail: d.thumbnails?.[0]?.url || '', uploader: d.channel?.name || '', medias: links });
        }
        errors.push('YT1: ' + (d?.message || r.status));
      } catch(e) { errors.push('YT1: ' + e.message); }

      // Try YouTube Quick Video Downloader (apisales)
      try {
        const r = await fetch(`https://youtube-quick-video-downloader.p.rapidapi.com/youtube-downloader/?url=${encodeURIComponent(url)}`, {
          headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': 'youtube-quick-video-downloader.p.rapidapi.com' }
        });
        const d = await r.json();
        console.log('YT2:', JSON.stringify(d).slice(0, 300));
        if (r.ok && d && !d.error) {
          const links = [];
          const formats = d.formats || d.links || d.videos || [];
          formats.forEach(f => {
            if (f.url || f.link) links.push({
              label: f.quality || f.format || 'Download',
              quality: guessQuality(f.quality, f.url || f.link),
              ext: guessExt(f.url || f.link, f.quality),
              url: f.url || f.link
            });
          });
          if (d.url && links.length === 0) links.push({ label: 'Download', quality: 'HD', ext: 'mp4', url: d.url });
          if (links.length > 0) return res.status(200).json({ title: d.title || 'YouTube Video', thumbnail: d.thumbnail || '', uploader: d.author || '', medias: links });
        }
        errors.push('YT2: ' + (d?.message || r.status));
      } catch(e) { errors.push('YT2: ' + e.message); }

      console.log('YouTube failed:', errors);
      return res.status(502).json({ error: 'YouTube download failed: ' + errors.join(' | ') });
    }

    // ── FACEBOOK ─────────────────────────────────────────────
    if (isFacebook) {
      const errors = [];

      // Try free public API first
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
          if (d.hd_url)       links.push({ label: 'HD Video', quality: 'HD', ext: 'mp4', url: d.hd_url });
          if (d.sd_url)       links.push({ label: 'SD Video', quality: 'SD', ext: 'mp4', url: d.sd_url });
          if (d.download_url && links.length === 0) links.push({ label: 'Download', quality: 'HD', ext: 'mp4', url: d.download_url });
          if (links.length > 0) return res.status(200).json({ title: d.title || 'Facebook Video', thumbnail: d.thumbnail || '', uploader: '', medias: links });
        }
        errors.push('FB1: ' + (d?.detail || r.status));
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

      console.log('Facebook failed:', errors);
      return res.status(502).json({ error: 'Facebook download failed. Make sure the video is public. ' + errors.join(' | ') });
    }

    // ── TIKTOK / INSTAGRAM / TWITTER ─────────────────────────
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
    console.log('General:', JSON.stringify(d).slice(0, 300));
    if (r.ok && d && !d.error && (d.medias || d.links || d.url)) return res.status(200).json(d);
    return res.status(502).json({ error: d?.message || d?.error || 'Could not fetch video.' });

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
