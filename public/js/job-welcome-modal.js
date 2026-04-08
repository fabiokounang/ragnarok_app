(function () {
  'use strict';

  function hoistRoot() {
    var root = document.getElementById('jwelcome-root');
    if (root && root.parentNode !== document.body) {
      document.body.appendChild(root);
    }
  }

  function stripWelcomeQuery() {
    var u = new URL(window.location.href);
    if (!u.searchParams.has('welcome')) return;
    u.searchParams.delete('welcome');
    var tail = u.searchParams.toString();
    window.history.replaceState({}, '', u.pathname + (tail ? '?' + tail : '') + u.hash);
  }

  function boot() {
    var root = document.getElementById('jwelcome-root');
    if (!root) return;

    hoistRoot();
    document.body.classList.add('jwelcome-open');
    root.setAttribute('aria-hidden', 'false');

    function onEsc(ev) {
      if (ev.key === 'Escape') close();
    }

    function close() {
      document.removeEventListener('keydown', onEsc);
      root.classList.add('hidden');
      root.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('jwelcome-open');
      stripWelcomeQuery();
    }

    root.querySelectorAll('[data-jwelcome-close]').forEach(function (el) {
      el.addEventListener('click', close);
    });

    document.addEventListener('keydown', onEsc);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
