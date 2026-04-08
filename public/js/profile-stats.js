(function () {
  'use strict';

  var CAP = 99;
  var KEYS = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function showToast(message, kind) {
    var t = document.getElementById('profile-stat-toast');
    if (!t) return;
    t.textContent = message;
    t.classList.remove(
      'hidden',
      'border-emerald-200/80',
      'bg-emerald-50/90',
      'text-emerald-900',
      'border-red-200/80',
      'bg-red-50/90',
      'text-red-900'
    );
    if (kind === 'err') {
      t.classList.add('border-red-200/80', 'bg-red-50/90', 'text-red-900');
    } else {
      t.classList.add('border-emerald-200/80', 'bg-emerald-50/90', 'text-emerald-900');
    }
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () {
      t.classList.add('hidden');
    }, 2800);
  }

  function applySheet(section, stats, unspent) {
    KEYS.forEach(function (key) {
      var row = section.querySelector('[data-stat-row="' + key + '"]');
      if (!row) return;
      var v = typeof stats[key] === 'number' ? stats[key] : parseInt(String(stats[key]), 10) || 1;
      var valEl = row.querySelector('[data-stat-value]');
      if (valEl) valEl.textContent = String(v);

      var form = row.querySelector('[data-profile-stat-form]');
      var maxEl = row.querySelector('[data-stat-max]');
      var placeholder = row.querySelector('[data-stat-placeholder]');
      var canAdd = unspent > 0 && v < CAP;

      if (form) form.classList.toggle('hidden', !canAdd);
      if (maxEl) maxEl.classList.toggle('hidden', v < CAP);
      if (placeholder) placeholder.classList.toggle('hidden', canAdd || v >= CAP);
    });

    var badge = document.getElementById('profile-stat-points-badge');
    if (badge) {
      badge.classList.toggle('hidden', unspent <= 0);
      var n = badge.querySelector('[data-stat-pts-num]');
      if (n) n.textContent = String(Math.max(0, unspent));
    }
  }

  function setBusy(form, busy) {
    var btn = form.querySelector('button[type="submit"]');
    var spin = form.querySelector('.profile-stat-plus-spinner');
    var lab = form.querySelector('.profile-stat-plus-label');
    if (!btn) return;
    btn.disabled = !!busy;
    if (spin) spin.classList.toggle('hidden', !busy);
    if (lab) lab.classList.toggle('opacity-60', !!busy);
  }

  var section = document.getElementById('profile-stats-section');
  if (!section) return;

  section.querySelectorAll('[data-profile-stat-form]').forEach(function (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var statInput = form.querySelector('input[name="stat"]');
      var stat = statInput && statInput.value;
      if (!stat) return;

      setBusy(form, true);

      fetch(form.getAttribute('action') || '/profile/stat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ stat: stat }),
      })
        .then(function (res) {
          return res.text().then(function (text) {
            var data = null;
            if (text) {
              try {
                data = JSON.parse(text);
              } catch (e) {
                data = null;
              }
            }
            return { res: res, data: data };
          });
        })
        .then(function (_ref) {
          var res = _ref.res;
          var data = _ref.data;
          setBusy(form, false);
          if (!res.ok || !data || !data.ok) {
            var msg =
              data && data.error === 'cannot_allocate'
                ? 'No stat point available or stat is maxed.'
                : 'Could not add stat. Refresh and try again.';
            showToast(msg, 'err');
            return;
          }
          applySheet(section, data.stats, data.statPointsUnspent);
          showToast('Stat increased.', 'ok');
        })
        .catch(function () {
          setBusy(form, false);
          showToast('Network error. Try again.', 'err');
        });
    });
  });
})();
