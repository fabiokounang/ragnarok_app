(function () {
  'use strict';

  var dataEl = document.getElementById('choose-job-data');
  var dialog = document.getElementById('choose-job-dialog');
  if (!dataEl || !dialog) return;

  var jobs;
  try {
    jobs = JSON.parse(dataEl.textContent || '[]');
  } catch (e) {
    return;
  }

  var titleEl = dialog.querySelector('[data-job-dialog-title]');
  var descEl = dialog.querySelector('[data-job-dialog-desc]');
  var evolutionEl = dialog.querySelector('[data-job-dialog-evolution]');
  var closeEls = dialog.querySelectorAll('[data-job-dialog-close]');
  var bodyScrollEl = dialog.querySelector('.ro-job-dialog-body');

  function clearEl(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function formatGates(gateLevels) {
    return gateLevels.map(function (L) {
      return 'L' + L + '+';
    }).join(' · ');
  }

  function routeTitle(path) {
    var s = path.steps;
    if (s.length >= 4) {
      return s[1] + ' → ' + s[2] + ' → ' + s[3];
    }
    if (s.length === 3) {
      return s[1] + ' → ' + s[2];
    }
    return s[s.length - 1] || 'Route';
  }

  function resolveJob(slug, idAttr) {
    var job = null;
    var s = slug != null ? String(slug).trim() : '';
    if (s) {
      job = jobs.find(function (j) {
        return j.slug === s;
      });
    }
    if (!job && idAttr != null && String(idAttr).trim() !== '') {
      var n = parseInt(String(idAttr), 10);
      if (Number.isFinite(n)) {
        job = jobs.find(function (j) {
          return Number(j.id) === n;
        });
      }
    }
    return job;
  }

  function renderEvolution(job) {
    clearEl(evolutionEl);
    var paths = job.evolutionPaths;

    if (paths && paths.length) {
      paths.forEach(function (path, idx) {
        var card = document.createElement('div');
        card.className =
          'mb-3 rounded-xl border border-[#2c5282]/15 bg-gradient-to-br from-white/95 to-sky-50/40 px-3 py-3 shadow-sm last:mb-0 sm:px-4 sm:py-3.5';

        var h = document.createElement('p');
        h.className =
          'font-display text-[9px] font-bold uppercase tracking-[0.18em] text-[#2c5282]';
        h.textContent = 'Route ' + (idx + 1) + ' — ' + routeTitle(path);
        card.appendChild(h);

        var chain = document.createElement('p');
        chain.className =
          'mt-2 font-robody text-[15px] font-semibold leading-snug tracking-wide text-[#154065] sm:text-base';
        chain.textContent = path.steps.join(' › ');
        card.appendChild(chain);

        var gates = document.createElement('p');
        gates.className =
          'mt-1.5 font-robody text-[11px] leading-snug text-slate-500 sm:text-[12px]';
        gates.textContent = 'Level gates (in-app progression): ' + formatGates(path.gateLevels);
        card.appendChild(gates);

        evolutionEl.appendChild(card);
      });
    } else {
      var p = document.createElement('p');
      p.className =
        'font-robody text-[15px] leading-relaxed text-slate-600 sm:text-base';
      var strong = document.createElement('strong');
      strong.className = 'font-semibold text-[#4c1d95]';
      strong.textContent = job.name || 'This class';
      p.appendChild(strong);
      p.appendChild(
        document.createTextNode(
          ' has no 2nd or 3rd job branches in the database yet — a flexible all-rounder path. Ideal if you want a balanced mix of habits without committing to one specialty.'
        )
      );
      evolutionEl.appendChild(p);
    }
  }

  function openManual(slug, idAttr) {
    var job = resolveJob(slug, idAttr);

    titleEl.textContent = '';
    descEl.textContent = '';
    clearEl(evolutionEl);

    if (!job) {
      titleEl.textContent = 'Class manual';
      descEl.textContent =
        'Could not load this class. Try refreshing the page. If the problem continues, contact support.';
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
        requestAnimationFrame(function () {
          if (bodyScrollEl) bodyScrollEl.scrollTop = 0;
        });
      }
      return;
    }

    titleEl.textContent = job.name;
    descEl.textContent = job.description || 'No description for this class yet.';
    renderEvolution(job);

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
      requestAnimationFrame(function () {
        if (bodyScrollEl) bodyScrollEl.scrollTop = 0;
      });
    }
  }

  document.querySelectorAll('.choose-job-manual-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var slug = btn.getAttribute('data-job-slug');
      var idAttr = btn.getAttribute('data-job-id');
      openManual(slug, idAttr);
    });
  });

  function closeDialog() {
    if (typeof dialog.close === 'function') dialog.close();
  }

  closeEls.forEach(function (b) {
    b.addEventListener('click', closeDialog);
  });

  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) closeDialog();
  });
})();
