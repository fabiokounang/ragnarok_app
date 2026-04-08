(function () {
  'use strict';

  function readBody() {
    var b = document.body;
    if (!b || b.getAttribute('data-app-music') !== '1') return null;
    var src = b.getAttribute('data-app-music-src');
    if (!src || !String(src).trim()) return null;
    var v = parseFloat(b.getAttribute('data-app-music-vol') || '0.22');
    if (!isFinite(v)) v = 0.22;
    v = Math.min(1, Math.max(0, v));
    return { src: String(src).trim(), volume: v };
  }

  function boot() {
    var cfg = readBody();
    if (!cfg) return;

    var audio = new Audio(cfg.src);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = cfg.volume;

    var started = false;
    function tryPlay() {
      if (started) return;
      started = true;
      var p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(function () {});
      }
    }

    document.addEventListener(
      'pointerdown',
      function () {
        tryPlay();
      },
      { once: true, passive: true }
    );
    document.addEventListener(
      'keydown',
      function () {
        tryPlay();
      },
      { once: true }
    );

    audio.addEventListener('error', function () {
      if (typeof console !== 'undefined' && console.debug) {
        console.debug('[ambient-music] Could not load track:', cfg.src);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
