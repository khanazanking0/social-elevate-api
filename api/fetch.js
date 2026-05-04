// Social Elevate – Vercel API v5

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
  const isInsta    = u.includes('instagram.com');
  const isTwitter  = u.includes('twitter.com') || u.includes('x.com') || u.includes('t.co');

  try {

    // ── YOUTUBE ──────────────────────────────────────────────
    // YTStream requires just the VIDEO ID, not the full URL
    if (isYouTube) {
      // Extract video ID
      let videoId = '';
      try {
        const p = new URL(url);
        if (p.hostname.includes('youtu.be')) {
          videoId = p.pathname.slice(1).split('?')[0];
        } else if (p.pathname.includes('/shorts/')) {
          videoId = p.pathname.split('/shorts/')[1].split('/')[0];
        } else {
          videoId = p.searchParams.get('v') || '';
        }
      } catch {}

      if (!videoId) return res.status(400).json({ error: 'Could not extract YouTube video ID. Use a standard YouTube URL like youtube.com/watch?v=xxxxx' });

      const r = await fetch(
        `https://ytstream-download-youtube-videos.p.rapidapi.com/dl?id=${videoId}`,
        { headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': 'ytstream-download-youtube-videos.p.rapidapi.com' } }
      );
      const d = await r.json();
      console.log('YTStream:', JSON.stringify(d).slice(0, 500));

      if (!r.ok || d.error || d.msg) {
        return res.status(502).json({ error: 'YouTube failed: ' + (d?.msg || d?.error || r.status) });
      }

      const links = [];
      // formats array contains both video+audio combined and adaptive streams
      (d.formats || []).forEach(f => {
        if (!f.url) return;
        const isVideo = f.mimeType?.includes('video') || f.qualityLabel;
        const isAudio = f.mimeType?.includes('audio');
        if (isVideo && !isAudio) {
          links.push({ label: f.qualityLabel || 'MP4', quality: guessQuality(f.qualityLabel, f.url), ext: 'mp4', url: f.url });
        }
      });
      // Add audio-only MP3
      (d.formats || []).forEach(f => {
        if (f.url && f.mimeType?.includes('audio') && !f.qualityLabel) {
          links.push({ label: 'MP3 Audio', quality: 'MP3', ext: 'mp3', url: f.url });
        }
      });
      // Fallback: adaptiveFormats
      if (links.length === 0) {
        (d.adaptiveFormats || []).forEach(f => {
          if (f.url && f.mimeType?.includes('video')) {
            links.push({ label: f.qualityLabel || 'MP4', quality: guessQuality(f.qualityLabel, f.url), ext: 'mp4', url: f.url });
          }
        });
      }

      if (links.length === 0) return res.status(502).json({ error: 'YouTube: no links found. Response: ' + JSON.stringify(d).slice(0, 300) });

      return res.status(200).json({
        title:     d.title || 'YouTube Video',
        thumbnail: d.thumbnail?.[0]?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        uploader:  d.channelTitle || '',
        medias:    links
      });
    }

    // ── TIKTOK ───────────────────────────────────────────────
    if (isTikTok) {
      const r = await fetch(
        `https://tiktok-video-no-watermark2.p.rapidapi.com/?url=${encodeURIComponent(url)}&hd=1`,
        { headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': 'tiktok-video-no-watermark2.p.rapidapi.com' } }
      );
      const d = await r.json();
      console.log('TikTok:', JSON.stringify(d).slice(0, 400));
      if (!r.ok || d.code !== 0) return res.status(502).json({ error: 'TikTok failed: ' + (d?.msg || r.status) });
      const v = d.data;
      const links = [];
      if (v.hdplay) links.push({ label: 'No Watermark HD', quality: 'HD',  ext: 'mp4', url: v.hdplay });
      if (v.play)   links.push({ label: 'No Watermark SD', quality: 'SD',  ext: 'mp4', url: v.play });
      if (v.music)  links.push({ label: 'MP3 Audio',       quality: 'MP3', ext: 'mp3', url: v.music });
      return res.status(200).json({ title: v.title || 'TikTok Video', thumbnail: v.cover || '', uploader: v.author?.nickname || '', medias: links });
    }

    // ── INSTAGRAM ────────────────────────────────────────────
    // Using tiktok-video-no-watermark2 which also supports Instagram
    if (isInsta) {
      const r = await fetch(
        `https://tiktok-video-no-watermark2.p.rapidapi.com/?url=${encodeURIComponent(url)}&hd=1`,
        { headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': 'tiktok-video-no-watermark2.p.rapidapi.com' } }
      );
      const d = await r.json();
      console.log('Instagram:', JSON.stringify(d).slice(0, 400));
      if (r.ok && d.code === 0 && d.data) {
        const v = d.data;
        const links = [];
        if (v.hdplay) links.push({ label: 'HD Video',  quality: 'HD',  ext: 'mp4', url: v.hdplay });
        if (v.play)   links.push({ label: 'SD Video',  quality: 'SD',  ext: 'mp4', url: v.play });
        if (v.music)  links.push({ label: 'MP3 Audio', quality: 'MP3', ext: 'mp3', url: v.music });
        // Instagram carousel (images/videos array)
        if (links.length === 0 && v.images) {
          v.images.forEach((img, i) => links.push({ label: `Image ${i+1}`, quality: 'IMG', ext: 'jpg', url: img }));
        }
        if (links.length > 0) return res.status(200).json({ title: v.title || 'Instagram Post', thumbnail: v.cover || '', uploader: v.author?.nickname || '', medias: links });
      }
      // Fallback: try as direct URL
      return res.status(502).json({ error: 'Instagram download failed. Make sure the account is public and the URL is a direct post/reel link.' });
    }

    // ── TWITTER / X ──────────────────────────────────────────
    if (isTwitter) {
      const r = await fetch(
        `https://tiktok-video-no-watermark2.p.rapidapi.com/?url=${encodeURIComponent(url)}&hd=1`,
        { headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': 'tiktok-video-no-watermark2.p.rapidapi.com' } }
      );
      const d = await r.json();
      console.log('Twitter:', JSON.stringify(d).slice(0, 400));
      if (r.ok && d.code === 0 && d.data) {
        const v = d.data;
        const links = [];
        if (v.hdplay) links.push({ label: 'HD Video',  quality: 'HD',  ext: 'mp4', url: v.hdplay });
        if (v.play)   links.push({ label: 'SD Video',  quality: 'SD',  ext: 'mp4', url: v.play });
        if (links.length > 0) return res.status(200).json({ title: v.title || 'Twitter Video', thumbnail: v.cover || '', uploader: '', medias: links });
      }
      return res.status(502).json({ error: 'Twitter/X download failed. Make sure the tweet contains a video.' });
    }

    // ── FACEBOOK ─────────────────────────────────────────────
    if (isFacebook) {
      // Try RapidAPI facebook17 first
      try {
        const r = await fetch(
          `https://facebook17.p.rapidapi.com/?url=${encodeURIComponent(url)}`,
          { headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': 'facebook17.p.rapidapi.com' } }
        );
        const d = await r.json();
        console.log('FB RapidAPI:', JSON.stringify(d).slice(0, 400));
        if (r.ok && d && (d.hd || d.sd || d.url)) {
          const links = [];
          if (d.hd) links.push({ label: 'HD Video', quality: 'HD', ext: 'mp4', url: d.hd });
          if (d.sd) links.push({ label: 'SD Video', quality: 'SD', ext: 'mp4', url: d.sd });
          if (d.url && links.length === 0) links.push({ label: 'Download', quality: 'HD', ext: 'mp4', url: d.url });
          if (links.length > 0) return res.status(200).json({ title: d.title || 'Facebook Video', thumbnail: d.thumbnail || '', uploader: '', medias: links });
        }
      } catch(e) { console.log('FB RapidAPI error:', e.message); }

      // Fallback: free fdown API
      try {
        const r = await fetch('https://fdown.isuru.eu.org/info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        const d = await r.json();
        console.log('FB fdown:', JSON.stringify(d).slice(0, 400));
        if (r.ok && d && (d.hd_url || d.sd_url || d.links)) {
          const links = [];
          if (d.hd_url) links.push({ label: 'HD Video', quality: 'HD', ext: 'mp4', url: d.hd_url });
          if (d.sd_url) links.push({ label: 'SD Video', quality: 'SD', ext: 'mp4', url: d.sd_url });
          (d.links || []).forEach(l => {
            if (l.url) links.push({ label: l.label || 'Download', quality: guessQuality(l.label, l.url), ext: 'mp4', url: l.url });
          });
          if (links.length > 0) return res.status(200).json({ title: d.title || 'Facebook Video', thumbnail: d.thumbnail || '', uploader: '', medias: links });
        }
      } catch(e) { console.log('FB fdown error:', e.message); }

      return res.status(502).json({ error: 'Facebook download failed. Make sure the video is public and not from a private group.' });
    }

    return res.status(400).json({ error: 'Unsupported platform.' });

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
