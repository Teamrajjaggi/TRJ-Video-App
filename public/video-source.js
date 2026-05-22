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
  // height=1280 keeps the poster sharp enough that the hand-off to the
  // full-res video is invisible.
  function cfThumb(streamUrl) {
    const base = cfBase(streamUrl);
    return base ? base + '/thumbnails/thumbnail.jpg?time=1s&height=1280' : null;
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

  // Attach playback source to a <video>. Uses the Cloudflare CDN MP4 at
  // full source resolution — ONE quality. No adaptive "starts blurry then
  // sharpens" ramp (which iOS Safari does when fed an HLS manifest). For
  // short review clips on a CDN, single-quality MP4 is the right call.
  function attachVideo(videoEl, v) {
    videoEl.poster = posterSrc(v);
    videoEl.src = videoSrc(v);
    return null;
  }

  // No-op kept so callers (app.js renderDeck) don't need changing —
  // there are no hls.js instances to tear down anymore.
  function detachVideo(videoEl) {
    /* nothing to detach — playback is plain MP4 */
  }

  // A poster <img> that fills its (position:relative) parent and removes
  // itself the moment the given <video> actually renders frames.
  //
  // Why an overlay instead of the native <video poster> attribute: iOS
  // Safari dismisses the poster attribute as soon as play() is called —
  // well before the first frame decodes — so the card flashes black for
  // 1-3 seconds. This overlay stays put until the real 'playing' event,
  // closing that gap on every browser.
  function posterOverlay(v, videoEl) {
    const img = document.createElement('img');
    img.src = posterSrc(v);
    img.alt = '';
    img.decoding = 'async';
    img.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;' +
      'pointer-events:none;z-index:1;transition:opacity .2s;';
    videoEl.addEventListener(
      'playing',
      function () {
        img.style.opacity = '0';
        setTimeout(function () {
          img.remove();
        }, 250);
      },
      { once: true },
    );
    return img;
  }

  // Build a list-page video preview: a position:relative wrapper (class
  // "pv") holding the <video> plus a poster overlay. The <video> is
  // exposed as wrapper._video so the caller can wire autoplay / clicks.
  function buildListVideo(v) {
    const wrap = document.createElement('div');
    wrap.className = 'pv';
    const video = document.createElement('video');
    video.src = videoSrc(v);
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'metadata';
    wrap.appendChild(video);
    wrap.appendChild(posterOverlay(v, video));
    wrap._video = video;
    return wrap;
  }

  // Shared autoplay-on-scroll. A video registered here plays (muted) when
  // it scrolls into view and pauses when it leaves — the TikTok-style
  // feel for the review list pages. One IntersectionObserver per page.
  let _io = null;
  function _autoplayObserver() {
    if (_io) return _io;
    _io = new IntersectionObserver(
      function (entries) {
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i];
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            e.target.play().catch(function () {});
          } else {
            e.target.pause();
          }
        }
      },
      { threshold: [0, 0.6] },
    );
    return _io;
  }

  // Register a <video> for scroll-triggered autoplay. The element should
  // already be muted + loop + playsInline (browsers only autoplay muted
  // video). Returns nothing.
  function autoplayInView(videoEl) {
    _autoplayObserver().observe(videoEl);
  }

  global.VideoSource = {
    videoSrc, posterSrc, imageSrc, cfThumb,
    attachVideo, detachVideo, autoplayInView,
    posterOverlay, buildListVideo,
  };
})(window);
