// Shared video-source helpers.
//
// Cloudflare Stream serves clips from its global CDN far faster than
// proxying Drive bytes through the Render app server. When a clip has a
// Cloudflare playback URL, the <video> element should point STRAIGHT at
// the CDN — skipping the /api/videos/:id/stream redirect (which costs a
// Render round-trip on every single video).
//
// Stored playback URL form (set by lib/cloudflare-stream.js):
//   https://customer-XXXX.cloudflarestream.com/<uid>/downloads/default.mp4
//
// From that base we also derive the poster thumbnail. A poster makes the
// card look loaded instantly while the video itself buffers — the single
// biggest perceived-speed win.
(function (global) {
  // Base = everything up to and including the <uid> path segment.
  function cfBase(streamUrl) {
    if (!streamUrl) return null;
    const m = streamUrl.match(
      /^(https:\/\/customer-[^/]+\.cloudflarestream\.com\/[^/]+)\//,
    );
    return m ? m[1] : null;
  }

  // Cloudflare-generated poster frame. ~1s in so it's not a black frame.
  function cfThumb(streamUrl) {
    const base = cfBase(streamUrl);
    return base ? base + '/thumbnails/thumbnail.jpg?time=1s&height=960' : null;
  }

  // Fastest playable source for a video row: the Cloudflare CDN URL when
  // present, else the app's Drive-proxy endpoint (used while a clip is
  // still transcoding, or for the rare Drive-only clip).
  function videoSrc(v) {
    if (v && v.stream_playback_url) return v.stream_playback_url;
    return '/api/videos/' + encodeURIComponent(v.id) + '/stream';
  }

  // Poster image: Cloudflare thumbnail if the clip is on the CDN, else the
  // app's Drive-thumbnail endpoint (already CDN-redirected server-side).
  function posterSrc(v) {
    if (v && v.stream_playback_url) {
      const t = cfThumb(v.stream_playback_url);
      if (t) return t;
    }
    return '/api/videos/' + encodeURIComponent(v.id) + '/thumb?size=960';
  }

  // Still-image source (for image-kind rows). Always use the thumb
  // endpoint — never proxy full-resolution image bytes through Render.
  function imageSrc(v) {
    return '/api/videos/' + encodeURIComponent(v.id) + '/thumb?size=1280';
  }

  // Cloudflare Stream HLS manifest — adaptive bitrate, starts at low
  // quality instantly and ramps up. The "TikTok" delivery format.
  function hlsSrc(streamUrl) {
    const base = cfBase(streamUrl);
    return base ? base + '/manifest/video.m3u8' : null;
  }

  // Attach the best playback source to a <video>. Priority:
  //   1. Cloudflare HLS via hls.js   (Chrome/Firefox/Edge — adaptive)
  //   2. Cloudflare HLS natively     (Safari/iOS — adaptive, no library)
  //   3. Progressive MP4 / Drive proxy (fallback)
  // Always sets a poster so the card looks loaded instantly.
  // Returns the hls.js instance (or null) so the caller can destroy it
  // when the element is removed — call detachVideo() for that.
  function attachVideo(videoEl, v) {
    videoEl.poster = posterSrc(v);
    const hls = v && v.stream_playback_url ? hlsSrc(v.stream_playback_url) : null;

    // Safari / iOS: native HLS, no library needed.
    if (hls && videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = hls;
      return null;
    }
    // Chrome / Firefox / Edge: hls.js if it loaded.
    if (hls && global.Hls && global.Hls.isSupported()) {
      const inst = new global.Hls({
        capLevelToPlayerSize: true, // never fetch 4K for a phone-size player
        maxBufferLength: 12,        // clips are short — don't over-buffer
        startLevel: -1,             // auto: pick the right rung for the link
      });
      inst.loadSource(hls);
      inst.attachMedia(videoEl);
      videoEl._hls = inst;
      return inst;
    }
    // No HLS available — progressive MP4 straight from the CDN.
    videoEl.src = videoSrc(v);
    return null;
  }

  // Tear down an hls.js instance attached by attachVideo(). Safe to call
  // on any <video> — no-ops if there's nothing attached.
  function detachVideo(videoEl) {
    if (videoEl && videoEl._hls) {
      try {
        videoEl._hls.destroy();
      } catch (e) {
        /* ignore */
      }
      videoEl._hls = null;
    }
  }

  global.VideoSource = {
    videoSrc, posterSrc, imageSrc, cfThumb, hlsSrc, attachVideo, detachVideo,
  };
})(window);
