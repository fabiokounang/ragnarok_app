(function () {
  'use strict';

  var host;
  var maxVisible = 4;

  function ensureHost() {
    if (host && host.parentNode) return host;
    host = document.createElement('div');
    host.id = 'rkn-toast-host';
    host.className = 'rkn-toast-host';
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
    return host;
  }

  function iconSvg(type) {
    if (type === 'success') {
      return '<svg class="rkn-toast__icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    if (type === 'progress') {
      return '<svg class="rkn-toast__icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke-linecap="round"/><circle cx="12" cy="12" r="3"/></svg>';
    }
    return '<svg class="rkn-toast__icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01" stroke-linecap="round"/></svg>';
  }

  function trimStack() {
    var h = ensureHost();
    while (h.children.length > maxVisible) {
      h.removeChild(h.firstChild);
    }
  }

  /**
   * @param {{ type?: string, title?: string, message?: string, duration?: number }} opts
   */
  function show(opts) {
    opts = opts || {};
    var type = opts.type || 'info';
    if (type !== 'success' && type !== 'progress') type = 'info';
    var title = String(opts.title || '').trim() || (type === 'success' ? 'Done' : 'Notice');
    var message = String(opts.message || '').trim();
    var duration =
      opts.duration === undefined || opts.duration === null ? 6500 : Number(opts.duration);

    var h = ensureHost();
    trimStack();

    var el = document.createElement('div');
    el.className = 'rkn-toast rkn-toast--' + type;
    el.setAttribute('role', 'status');

    var closeLabel = 'Dismiss notification';

    el.innerHTML =
      '<div class="rkn-toast__accent" aria-hidden="true"></div>' +
      '<div class="rkn-toast__icon" aria-hidden="true">' +
      iconSvg(type) +
      '</div>' +
      '<div class="rkn-toast__body">' +
      '<p class="rkn-toast__title">' +
      escapeHtml(title) +
      '</p>' +
      (message
        ? '<p class="rkn-toast__msg">' + escapeHtml(message) + '</p>'
        : '') +
      '</div>' +
      '<button type="button" class="rkn-toast__close" aria-label="' +
      escapeHtml(closeLabel) +
      '">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg>' +
      '</button>';

    function removeEl() {
      if (!el.parentNode) return;
      el.classList.remove('rkn-toast--visible');
      el.classList.add('rkn-toast--hiding');
      setTimeout(function () {
        el.remove();
      }, 280);
    }

    el.querySelector('.rkn-toast__close').addEventListener('click', removeEl);

    var tId;
    if (duration > 0) {
      tId = setTimeout(removeEl, duration);
      el.addEventListener('mouseenter', function () {
        clearTimeout(tId);
      });
      el.addEventListener('mouseleave', function () {
        tId = setTimeout(removeEl, Math.min(4000, duration));
      });
    }

    h.appendChild(el);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.classList.add('rkn-toast--visible');
      });
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function stripDailyQueryFlags() {
    try {
      var u = new URL(window.location.href);
      var keys = ['gained', 'notify', 'step', 'target'];
      var changed = false;
      keys.forEach(function (k) {
        if (u.searchParams.has(k)) {
          u.searchParams.delete(k);
          changed = true;
        }
      });
      if (changed) {
        var tail = u.searchParams.toString();
        window.history.replaceState({}, '', u.pathname + (tail ? '?' + tail : '') + u.hash);
      }
    } catch (e) {
      /* ignore */
    }
  }

  function consumeDailySsr() {
    var node = document.getElementById('daily-ssr-toast-data');
    if (!node || !node.textContent) return;
    try {
      var list = JSON.parse(node.textContent.trim());
      if (!Array.isArray(list)) return;
      list.forEach(function (item) {
        if (item && typeof item === 'object') show(item);
      });
    } catch (e) {
      /* ignore */
    }
    node.remove();
    stripDailyQueryFlags();
  }

  window.RebornToast = { show: show };

  function boot() {
    if (document.getElementById('daily-page')) {
      consumeDailySsr();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
