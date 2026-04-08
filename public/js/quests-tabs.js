(function () {
  'use strict';

  function getTabFromUrl() {
    try {
      var p = new URLSearchParams(window.location.search);
      var t = String(p.get('qtab') || '').toLowerCase();
      if (t === 'progress' || t === 'finish') return t;
      return 'open';
    } catch (e) {
      return 'open';
    }
  }

  function setTabOnUrl(tab) {
    try {
      var u = new URL(window.location.href);
      if (tab === 'open') u.searchParams.delete('qtab');
      else u.searchParams.set('qtab', tab);
      window.history.replaceState({}, '', u.pathname + u.search + u.hash);
    } catch (e) {
      /* ignore */
    }
  }

  function applyTab(tab, refs) {
    var tabs = ['open', 'progress', 'finish'];
    tabs.forEach(function (k) {
      var selected = k === tab;
      refs.btn[k].setAttribute('aria-selected', selected ? 'true' : 'false');
      refs.btn[k].tabIndex = selected ? 0 : -1;
      refs.panel[k].classList.toggle('hidden', !selected);
      refs.btn[k].classList.toggle('border-zinc-500', selected);
      refs.btn[k].classList.toggle('bg-zinc-800', selected);
      refs.btn[k].classList.toggle('text-zinc-100', selected);
      refs.btn[k].classList.toggle('border-transparent', !selected);
      refs.btn[k].classList.toggle('text-zinc-400', !selected);
    });
    setTabOnUrl(tab);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var bar = document.querySelector('.quest-board-tabbar');
    if (!bar) return;
    var refs = {
      btn: {
        open: document.getElementById('qb-tab-open'),
        progress: document.getElementById('qb-tab-progress'),
        finish: document.getElementById('qb-tab-finish'),
      },
      panel: {
        open: document.getElementById('qb-panel-open'),
        progress: document.getElementById('qb-panel-progress'),
        finish: document.getElementById('qb-panel-finish'),
      },
    };
    if (!refs.btn.open || !refs.btn.progress || !refs.btn.finish) return;
    if (!refs.panel.open || !refs.panel.progress || !refs.panel.finish) return;

    applyTab(getTabFromUrl(), refs);
    refs.btn.open.addEventListener('click', function () {
      applyTab('open', refs);
    });
    refs.btn.progress.addEventListener('click', function () {
      applyTab('progress', refs);
    });
    refs.btn.finish.addEventListener('click', function () {
      applyTab('finish', refs);
    });

    bar.addEventListener('keydown', function (ev) {
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      ev.preventDefault();
      var order = ['open', 'progress', 'finish'];
      var active = order.find(function (k) {
        return refs.btn[k].getAttribute('aria-selected') === 'true';
      });
      var idx = Math.max(0, order.indexOf(active));
      var next = ev.key === 'ArrowRight' ? Math.min(2, idx + 1) : Math.max(0, idx - 1);
      applyTab(order[next], refs);
      refs.btn[order[next]].focus();
    });
  });
})();
