(function () {
  'use strict';

  function tabFromUrl() {
    try {
      var p = new URLSearchParams(window.location.search);
      var t = (p.get('tab') || '').toLowerCase();
      return t === 'weekly' ? 'weekly' : 'daily';
    } catch (e) {
      return 'daily';
    }
  }

  function setUrlTab(tab) {
    try {
      var u = new URL(window.location.href);
      if (tab === 'weekly') u.searchParams.set('tab', 'weekly');
      else u.searchParams.delete('tab');
      window.history.replaceState({}, '', u.pathname + u.search + u.hash);
    } catch (e) {
      /* ignore */
    }
  }

  function applyTab(tab, dailyBtn, weeklyBtn, dailyPanel, weeklyPanel) {
    var isDaily = tab === 'daily';
    dailyPanel.classList.toggle('hidden', !isDaily);
    weeklyPanel.classList.toggle('hidden', isDaily);
    dailyBtn.setAttribute('aria-selected', isDaily ? 'true' : 'false');
    weeklyBtn.setAttribute('aria-selected', !isDaily ? 'true' : 'false');
    dailyBtn.tabIndex = isDaily ? 0 : -1;
    weeklyBtn.tabIndex = !isDaily ? 0 : -1;

    var base =
      'quest-tab-btn relative min-w-0 flex-1 rounded-xl px-3 py-2.5 text-center font-display text-[10px] font-bold uppercase tracking-[0.12em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 sm:py-3 sm:text-[11px]';
    var active =
      ' border border-zinc-500 bg-zinc-800 text-zinc-50 shadow-md shadow-black/30';
    var inactive =
      ' border border-transparent text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-200';
    dailyBtn.className = base + (isDaily ? active : inactive);
    weeklyBtn.className = base + (!isDaily ? active : inactive);

    setUrlTab(tab);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var bar = document.querySelector('.quest-tab-bar');
    if (!bar) return;

    var dailyBtn = document.getElementById('quest-tab-daily');
    var weeklyBtn = document.getElementById('quest-tab-weekly');
    var dailyPanel = document.getElementById('quest-panel-daily');
    var weeklyPanel = document.getElementById('quest-panel-weekly');
    if (!dailyBtn || !weeklyBtn || !dailyPanel || !weeklyPanel) return;

    applyTab(tabFromUrl(), dailyBtn, weeklyBtn, dailyPanel, weeklyPanel);

    dailyBtn.addEventListener('click', function () {
      applyTab('daily', dailyBtn, weeklyBtn, dailyPanel, weeklyPanel);
    });
    weeklyBtn.addEventListener('click', function () {
      applyTab('weekly', dailyBtn, weeklyBtn, dailyPanel, weeklyPanel);
    });

    bar.addEventListener('keydown', function (ev) {
      var key = ev.key;
      if (key !== 'ArrowLeft' && key !== 'ArrowRight') return;
      ev.preventDefault();
      var next = key === 'ArrowRight' ? 'weekly' : 'daily';
      applyTab(next, dailyBtn, weeklyBtn, dailyPanel, weeklyPanel);
      (next === 'daily' ? dailyBtn : weeklyBtn).focus();
    });
  });
})();
