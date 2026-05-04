// Social Elevate – Vercel API v4
// Stable, long-running APIs with confirmed endpoints

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
  const isTikTok   = u.includes('tiktok.com') || u.includes('vm.tiktok');

  try {

    // ── YOUTUBE ──────────────────────────────────────────────
    // YTStream by ytjar — stable since 2022
    // Subscribe: https://rapidapi.com/ytjar/api/ytstream-download-youtube-videos
    // Endpoint: GET /stream?url=VIDEO_URL&format=mp4&quality=720
    if (isYouTube) {
      const errors = [];

      // Try YTStream
      try {
        const r = await fetch(
          `https://ytstream-download-youtube-videos.p.rapidapi.com/dl?id=${encodeURIComponent(url)}`,
          { headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': 'ytstream-download-youtube-videos.p.rapidapi.com' } }
        );
        const d = await r.json();
        console.log('YTStream:', JSON.stringify(d).slice(0, 400));

        if (r.ok && d && !d.error && (d.formats || d.url)) {
          const links = [];
          const formats = d.formats || [];
          formats.forEach(f => {
            if (f.url && f.mimeType && f.mimeType.includes('video')) {
              links.push({ label: f.qualityLabel || f.quality || 'MP4', quality: guessQuality(f.qualityLabel, f.url), ext: 'mp4', url: f.url });
            }
          });
          formats.forEach(f => {
            if (f.url && f.mimeType && f.mimeType.includes('audio')) {
              links.push({ label: 'MP3 Audio', quality: 'MP3', ext: 'mp3', url: f.url });
            }
          });
          if (d.url && links.length === 0) links.push({ label: 'Download', quality: 'HD', ext: 'mp4', url: d.url });
          if (links.length > 0) {
            return res.status(200).json({ title: d.title || 'YouTube Video', thumbnail: d.thumbnail || `https://img.youtube.com/vi/${d.id}/hqdefault.jpg`, uploader: d.channelTitle || '', medias: links });
          }
        }
        errors.push('YTStream: ' + (d?.msg || d?.error || r.status));
      } catch(e) { errors.push('YTStream: ' + e.message); }

      // Try Youtube Search and Download (h0p3rwe) as fallback
      // Subscribe: https://rapidapi.com/h0p3rwe/api/youtube-search-and-download
      try {
        // Extract video ID
        let videoId = '';
        try {
          const p = new URL(url);
          videoId = p.hostname.includes('youtu.be') ? p.pathname.slice(1) : (p.searchParams.get('v') || '');
          if (!videoId && p.pathname.includes('/shorts/')) videoId = p.pathname.split('/shorts/')[1].split('/')[0];
        } catch {}

        if (videoId) {
          const r = await fetch(
            `https://youtube-search-and-download.p.rapidapi.com/video?id=${videoId}`,
            { headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': 'youtube-search-and-download.p.rapidapi.com' } }
          );
          const d = await r.json();
          console.log('YT fallback:', JSON.stringify(d).slice(0, 400));

          if (r.ok && d && !d.error) {
            const links = [];
            const formats = d.streamingData?.formats || d.streamingData?.adaptiveFormats || d.formats || [];
            formats.forEach(f => {
              if (f.url) links.push({ label: f.qualityLabel || f.quality || 'Download', quality: guessQuality(f.qualityLabel || f.quality, f.url), ext: f.mimeType?.includes('audio') ? 'mp3' : 'mp4', url: f.url });
            });
            if (links.length > 0) return res.status(200).json({ title: d.videoDetails?.title || 'YouTube Video', thumbnail: d.videoDetails?.thumbnail?.thumbnails?.[0]?.url || '', uploader: d.videoDetails?.author || '', medias: links });
          }
          errors.push('YT fallback: ' + (d?.message || r.status));
        }
      } catch(e) { errors.push('YT fallback: ' + e.message); }

      return res.status(502).json({ error: 'YouTube failed: ' + errors.join(' | ') + '. Subscribe to: rapidapi.com/ytjar/api/ytstream-download-youtube-videos' });
    }

    // ── TIKTOK ───────────────────────────────────────────────
    // tiktok-video-no-watermark2 by yi005 — very stable, running for years
    // Subscribe: https://rapidapi.com/yi005/api/tiktok-video-no-watermark2
    // Endpoint: GET /api?url=VIDEO_URL&hd=1
    if (isTikTok) {
      const r = await fetch(
        `https://tiktok-video-no-watermark2.p.rapidapi.com/api?url=${encodeURIComponent(url)}&hd=1`,
        { headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': 'tiktok-video-no-watermark2.p.rapidapi.com' } }
      );
      const d = await r.json();
      console.log('TikTok:', JSON.stringify(d).slice(0, 400));

      if (!r.ok || d.code !== 0) {
        return res.status(502).json({ error: 'TikTok failed: ' + (d?.msg || r.status) + '. Subscribe to: rapidapi.com/yi005/api/tiktok-video-no-watermark2' });
      }

      const v = d.data;
      const links = [];
      if (v.hdplay) links.push({ label: 'No Watermark HD', quality: 'HD',  ext: 'mp4', url: v.hdplay });
      if (v.play)   links.push({ label: 'No Watermark SD', quality: 'SD',  ext: 'mp4', url: v.play });
      if (v.music)  links.push({ label: 'MP3 Audio',       quality: 'MP3', ext: 'mp3', url: v.music });

      return res.status(200).json({ title: v.title || 'TikTok Video', thumbnail: v.cover || '', uploader: v.author?.nickname || '', medias: links });
    }

    // ── INSTAGRAM / TWITTER / OTHER ──────────────────────────
    // all-video-downloader1 — POST /all
    const body = new URLSearchParams({ url });
    const r = await fetch('https://all-video-downloader1.p.rapidapi.com/all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'x-rapidapi-key': KEY, 'x-rapidapi-host': 'all-video-downloader1.p.rapidapi.com' },
      body: body.toString()
    });
    const d = await r.json();
    console.log('General:', JSON.stringify(d).slice(0, 400));
    if (r.ok && !d.error && (d.medias || d.links || d.url)) return res.status(200).json(d);
    return res.status(502).json({ error: d?.message || d?.error || 'Could not fetch video. Status: ' + r.status });

    // ── FACEBOOK ─────────────────────────────────────────────
    if (isFacebook) {
      const errors = [];
      try {
        const r = await fetch('https://fdown.isuru.eu.org/info', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url })
        });
        const d = await r.json();
        console.log('FB:', JSON.stringify(d).slice(0, 300));
        if (r.ok && d && (d.hd_url || d.sd_url)) {
          const links = [];
          if (d.hd_url) links.push({ label: 'HD Video', quality: 'HD', ext: 'mp4', url: d.hd_url });
          if (d.sd_url) links.push({ label: 'SD Video', quality: 'SD', ext: 'mp4', url: d.sd_url });
          if (links.length > 0) return res.status(200).json({ title: d.title || 'Facebook Video', thumbnail: d.thumbnail || '', uploader: '', medias: links });
        }
        errors.push(d?.detail || r.status);
      } catch(e) { errors.push(e.message); }
      return res.status(502).json({ error: 'Facebook failed: ' + errors.join(' | ') });
    }

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
