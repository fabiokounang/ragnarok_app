(function () {
  'use strict';

  function sumSelectedExp(form) {
    var total = 0;
    form.querySelectorAll('.morning-pick-cb:checked').forEach(function (cb) {
      var n = Number(cb.getAttribute('data-base-exp'));
      if (Number.isFinite(n)) total += n;
    });
    return total;
  }

  function updateSum(form) {
    var out = document.getElementById('morning-pick-exp-sum');
    if (!out) return;
    out.textContent = String(sumSelectedExp(form));
  }

  function enforceMax(form) {
    var max = parseInt(form.getAttribute('data-max-picks') || '3', 10);
    if (!Number.isFinite(max) || max < 1) max = 3;
    var boxes = Array.prototype.slice.call(form.querySelectorAll('.morning-pick-cb'));
    var checked = boxes.filter(function (b) {
      return b.checked;
    });
    if (checked.length <= max) return;
    var last = checked[checked.length - 1];
    last.checked = false;
  }

  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (!t || !t.classList || !t.classList.contains('morning-pick-cb')) return;
    var form = t.closest('#daily-morning-pick-form');
    if (!form) return;
    enforceMax(form);
    updateSum(form);
  });

  document.addEventListener('submit', function (ev) {
    var form = ev.target;
    if (!form || form.id !== 'daily-morning-pick-form') return;
    var n = form.querySelectorAll('.morning-pick-cb:checked').length;
    if (n < 1) {
      ev.preventDefault();
      if (window.RebornToast && typeof window.RebornToast.show === 'function') {
        window.RebornToast.show({
          type: 'progress',
          title: 'Pick at least one',
          message: 'Choose one to three quests from the morning board.',
          duration: 5000,
        });
      }
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('daily-morning-pick-form');
    if (form) updateSum(form);
  });
})();
