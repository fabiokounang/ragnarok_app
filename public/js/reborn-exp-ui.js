(function () {
  'use strict';

  function prefersReducedMotion() {
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function playExpRewardFx(gained) {
    var n = Number(gained) || 0;
    if (n <= 0 || prefersReducedMotion()) return;
    var wrap = document.getElementById('app-header-exp-wrap');
    if (wrap) {
      var el = document.createElement('span');
      el.className = 'rb-exp-float';
      el.textContent = '+' + String(n) + ' EXP';
      el.setAttribute('role', 'presentation');
      wrap.appendChild(el);
      requestAnimationFrame(function () {
        el.classList.add('rb-exp-float--go');
      });
      window.setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 1100);
    }
    var fill = document.getElementById('app-header-exp-fill');
    if (fill) {
      fill.classList.remove('rb-exp-fill--pulse');
      void fill.offsetWidth;
      fill.classList.add('rb-exp-fill--pulse');
      window.setTimeout(function () {
        fill.classList.remove('rb-exp-fill--pulse');
      }, 900);
    }
  }

  function applyHeader(h) {
    if (!h) return;
    var fill = document.getElementById('app-header-exp-fill');
    var txt = document.getElementById('app-header-exp-text');
    var lv = document.getElementById('app-header-level-num');
    var top = document.getElementById('app-header-top-stats');
    var unspent = document.getElementById('app-header-unspent');
    var astraEl = document.getElementById('app-header-astra');
    if (txt) txt.textContent = h.expCountTxt;
    if (lv) lv.textContent = String(h.level);
    if (astraEl && h.astraBalance != null) astraEl.textContent = String(h.astraBalance);
    if (top && h.topStats && h.topStats.length) {
      top.innerHTML = h.topStats
        .map(function (row, i) {
          var dot =
            i > 0
              ? '<span class="text-slate-300" aria-hidden="true">·</span>'
              : '';
          return dot + '<span>' + row.label + ' ' + row.v + '</span>';
        })
        .join('');
    }
    if (unspent) {
      var n = Number(h.statPointsUnspent) || 0;
      if (n > 0) {
        unspent.classList.remove('hidden');
        unspent.textContent = '+' + n + ' pts';
      } else {
        unspent.classList.add('hidden');
      }
    }
    if (fill) {
      var reduce =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var base = Number(h.expPct);
      var x0 = Math.min(
        100,
        Math.max(0, Number(h.expPctBefore != null ? h.expPctBefore : base))
      );
      var x1 = Math.min(
        100,
        Math.max(0, Number(h.expPctAfter != null ? h.expPctAfter : base))
      );
      if (reduce || x0 === x1) {
        fill.style.transition = '';
        fill.style.width = x1 + '%';
      } else {
        fill.style.transition = 'none';
        fill.style.width = x0 + '%';
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            fill.style.transition = 'width 0.85s cubic-bezier(0.22, 1, 0.36, 1)';
            fill.style.width = x1 + '%';
          });
        });
      }
    }
  }

  window.RebornExpUi = {
    applyHeader: applyHeader,
    playExpRewardFx: playExpRewardFx,
    prefersReducedMotion: prefersReducedMotion,
  };
})();
