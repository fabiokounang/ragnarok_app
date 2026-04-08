(function () {
  'use strict';

  var stripQueryOnNextClose = false;
  var closeDelegated = false;

  function easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
  }

  function parseParams() {
    var q = new URLSearchParams(window.location.search);
    if (q.get('lvup') !== '1') return null;
    return {
      gained: parseInt(q.get('gained') || '0', 10) || 0,
      from: parseInt(q.get('from') || '1', 10) || 1,
      to: parseInt(q.get('to') || '1', 10) || 1,
      sp: parseInt(q.get('sp') || '0', 10) || 0,
      xp0: Math.min(100, Math.max(0, parseInt(q.get('xp0') || '0', 10) || 0)),
      xp1: Math.min(100, Math.max(0, parseInt(q.get('xp1') || '0', 10) || 0)),
    };
  }

  function hoistLvlupRoot() {
    var root = document.getElementById('lvlup-root');
    if (root && root.parentNode !== document.body) {
      document.body.appendChild(root);
    }
  }

  function stripQuery() {
    var u = new URL(window.location.href);
    ['gained', 'lvup', 'from', 'to', 'sp', 'xp0', 'xp1'].forEach(function (k) {
      u.searchParams.delete(k);
    });
    var tail = u.searchParams.toString();
    window.history.replaceState({}, '', u.pathname + (tail ? '?' + tail : '') + u.hash);
  }

  function hideLevelUpModal() {
    var root = document.getElementById('lvlup-root');
    if (root) {
      root.classList.add('hidden');
      root.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('lvlup-open');
    if (stripQueryOnNextClose) {
      stripQuery();
      stripQueryOnNextClose = false;
    }
  }

  function bindCloseDelegationOnce() {
    if (closeDelegated) return;
    var root = document.getElementById('lvlup-root');
    if (!root) return;
    closeDelegated = true;
    root.addEventListener('click', function (ev) {
      var el = ev.target;
      if (el && el.closest && el.closest('[data-lvlup-close]')) {
        hideLevelUpModal();
      }
    });
  }

  /**
   * @param {{ gained: number, from: number, to: number, sp: number, xp0: number, xp1: number }} data
   * @param {{ stripQueryOnClose?: boolean }} opts
   */
  function showLevelUpModal(data, opts) {
    opts = opts || {};
    var root = document.getElementById('lvlup-root');
    if (!data || !root) return;

    stripQueryOnNextClose = opts.stripQueryOnClose === true;

    root.classList.remove('hidden');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lvlup-open');

    var expDisp = document.getElementById('lvlup-exp-disp');
    var bar = document.getElementById('lvlup-exp-bar');
    var xpPct = document.getElementById('lvlup-xp-pct');
    var lvFrom = document.getElementById('lvlup-lv-from');
    var lvTo = document.getElementById('lvlup-lv-to');
    if (lvFrom) lvFrom.textContent = String(data.from);
    if (lvTo) lvTo.textContent = String(data.to);

    var spBlock = document.getElementById('lvlup-sp-block');
    var spText = document.getElementById('lvlup-sp-text');
    if (data.sp > 0 && spBlock && spText) {
      spBlock.classList.remove('hidden');
      spText.textContent =
        'You earned ' +
        data.sp +
        ' stat point' +
        (data.sp === 1 ? '' : 's') +
        '. Spend them under Character → Stats (active job).';
    } else if (spBlock) {
      spBlock.classList.add('hidden');
    }

    var sub = document.getElementById('lvlup-sub');
    if (sub) sub.textContent = 'You reached level ' + data.to + '.';

    var reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var dur = reduceMotion ? 0 : 780;
    var start = performance.now();
    function tickExp(now) {
      if (dur <= 0) {
        if (expDisp) expDisp.textContent = String(data.gained);
        return;
      }
      var t = Math.min(1, (now - start) / dur);
      var e = easeOutQuad(t);
      var val = Math.round(data.gained * e);
      if (expDisp) expDisp.textContent = String(val);
      if (t < 1) requestAnimationFrame(tickExp);
    }
    requestAnimationFrame(tickExp);

    if (bar) {
      if (reduceMotion) {
        bar.style.width = data.xp1 + '%';
      } else {
        bar.style.transition = 'none';
        bar.style.width = data.xp0 + '%';
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            bar.style.transition = 'width 0.95s cubic-bezier(0.22, 1, 0.36, 1)';
            bar.style.width = data.xp1 + '%';
          });
        });
      }
    }

    if (reduceMotion) {
      if (xpPct) xpPct.textContent = String(data.xp1);
    } else {
      var pStart = performance.now();
      function tickPct(now) {
        var t = Math.min(1, (now - pStart) / 920);
        var e = easeOutQuad(t);
        var v = Math.round(data.xp0 + (data.xp1 - data.xp0) * e);
        if (xpPct) xpPct.textContent = String(v);
        if (t < 1) requestAnimationFrame(tickPct);
      }
      requestAnimationFrame(tickPct);
    }
  }

  function runFromQuery() {
    var data = parseParams();
    if (!data) return;
    showLevelUpModal(data, { stripQueryOnClose: true });
  }

  function boot() {
    hoistLvlupRoot();
    bindCloseDelegationOnce();
    runFromQuery();
  }

  window.RebornLevelUp = {
    open: function (payload) {
      hoistLvlupRoot();
      bindCloseDelegationOnce();
      var d = payload || {};
      showLevelUpModal(
        {
          gained: parseInt(String(d.gained || 0), 10) || 0,
          from: parseInt(String(d.from || 1), 10) || 1,
          to: parseInt(String(d.to || 1), 10) || 1,
          sp: parseInt(String(d.sp || 0), 10) || 0,
          xp0: Math.min(100, Math.max(0, parseInt(String(d.xp0 ?? 0), 10) || 0)),
          xp1: Math.min(100, Math.max(0, parseInt(String(d.xp1 ?? 0), 10) || 0)),
        },
        { stripQueryOnClose: false }
      );
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
