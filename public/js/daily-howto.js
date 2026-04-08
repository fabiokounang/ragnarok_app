(function () {
  'use strict';

  var activeModal = null;
  var activeTrigger = null;
  var prevFocus = null;
  var onKeydown = null;

  function ensureModalOnBody(modal) {
    if (modal && modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }
  }

  function closeModal() {
    if (!activeModal) return;

    activeModal.classList.add('hidden');
    activeModal.setAttribute('aria-hidden', 'true');

    if (activeTrigger) activeTrigger.setAttribute('aria-expanded', 'false');
    if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();

    document.body.style.overflow = '';
    if (onKeydown) {
      document.removeEventListener('keydown', onKeydown);
      onKeydown = null;
    }
    activeModal = null;
    activeTrigger = null;
    prevFocus = null;
  }

  function openModal(modal, trigger) {
    if (!modal) return;
    if (activeModal && activeModal !== modal) closeModal();

    ensureModalOnBody(modal);
    prevFocus = document.activeElement;
    activeModal = modal;
    activeTrigger = trigger || null;

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';

    var closeBtn = modal.querySelector('[data-guide-close]');
    if (closeBtn && typeof closeBtn.focus === 'function') closeBtn.focus();

    onKeydown = function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    };
    document.addEventListener('keydown', onKeydown);
  }

  function onReady() {
    var triggers = document.querySelectorAll('[data-guide-trigger][data-guide-target]');
    if (!triggers.length) return;

    triggers.forEach(function (trigger) {
      var id = String(trigger.getAttribute('data-guide-target') || '').trim();
      if (!id) return;
      var modal = document.getElementById(id);
      if (!modal) return;

      ensureModalOnBody(modal);
      trigger.addEventListener('click', function () {
        openModal(modal, trigger);
      });

      var backdrop = modal.querySelector('[data-guide-backdrop]');
      if (backdrop) backdrop.addEventListener('click', closeModal);

      var closeBtn = modal.querySelector('[data-guide-close]');
      if (closeBtn) closeBtn.addEventListener('click', closeModal);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();

