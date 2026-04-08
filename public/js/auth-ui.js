(function () {
  'use strict';

  document.querySelectorAll('[data-auth-form]').forEach(function (form) {
    form.addEventListener('submit', function () {
      var btn = form.querySelector('button[type="submit"]');
      if (!btn || btn.disabled) return;
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.classList.add('is-busy');
      var spin = btn.querySelector('.auth-btn-spinner');
      var label = btn.querySelector('.auth-btn-label');
      if (spin) spin.classList.remove('hidden');
      if (label) label.classList.add('opacity-75');
    });
  });

  document.querySelectorAll('[data-password-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-password-toggle');
      var input = id && document.getElementById(id);
      if (!input) return;
      var show = input.getAttribute('type') === 'password';
      input.setAttribute('type', show ? 'text' : 'password');
      btn.setAttribute('aria-pressed', show ? 'true' : 'false');
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      var on = btn.querySelector('.auth-toggle-icon--on');
      var off = btn.querySelector('.auth-toggle-icon--off');
      if (on && off) {
        on.classList.toggle('hidden', !show);
        off.classList.toggle('hidden', show);
      }
    });
  });
})();
