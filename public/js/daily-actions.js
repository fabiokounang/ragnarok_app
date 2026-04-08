(function () {
  'use strict';

  function setBusy(form, busy) {
    var btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = !!busy;
    btn.setAttribute('aria-busy', busy ? 'true' : 'false');
    if (busy) btn.classList.add('is-busy');
    else btn.classList.remove('is-busy');
    var spin = btn.querySelector('.auth-btn-spinner');
    var label = btn.querySelector('.auth-btn-label');
    if (spin) spin.classList.toggle('hidden', !busy);
    if (label) label.classList.toggle('opacity-75', !!busy);
  }

  function barPct(done, total) {
    var t = Number(total) || 0;
    var d = Number(done) || 0;
    if (t <= 0) return 0;
    return Math.min(100, Math.round((d / t) * 100));
  }

  function applySummary(s) {
    if (!s) return;
    function set(id, v) {
      var el = document.getElementById(id);
      if (el) el.textContent = String(v);
    }
    set('daily-core-done', s.coreDone);
    set('daily-core-total', s.coreTotal);
    set('daily-bonus-done', s.bonusDone);
    set('daily-bonus-total', s.bonusTotal);
    var coreBar = document.getElementById('daily-core-bar');
    if (coreBar) coreBar.style.width = barPct(s.coreDone, s.coreTotal) + '%';
    var bonusBar = document.getElementById('daily-bonus-bar');
    if (bonusBar) bonusBar.style.width = barPct(s.bonusDone, s.bonusTotal) + '%';
  }

  function applyWeeklySummary(s) {
    if (!s) return;
    function set(id, v) {
      var el = document.getElementById(id);
      if (el) el.textContent = String(v);
    }
    set('weekly-regular-done', s.weeklyDone);
    set('weekly-regular-total', s.weeklyTotal);
    set('weekly-boss-done', s.bossDone);
    set('weekly-boss-total', s.bossTotal);
    var regBar = document.getElementById('weekly-regular-bar');
    if (regBar) regBar.style.width = barPct(s.weeklyDone, s.weeklyTotal) + '%';
    var bossBar = document.getElementById('weekly-boss-bar');
    if (bossBar) bossBar.style.width = barPct(s.bossDone, s.bossTotal) + '%';
  }

  function applyHeader(h) {
    if (window.RebornExpUi && typeof window.RebornExpUi.applyHeader === 'function') {
      window.RebornExpUi.applyHeader(h);
    }
  }

  function playExpRewardFx(gained) {
    if (window.RebornExpUi && typeof window.RebornExpUi.playExpRewardFx === 'function') {
      window.RebornExpUi.playExpRewardFx(gained);
    }
  }

  function replaceTaskRow(taskId, html) {
    var li = document.querySelector(
      'li.daily-task-card[data-daily-task-id="' + taskId + '"]'
    );
    if (!li || !html) return;
    li.outerHTML = html;
  }

  function replaceWeeklyTaskRow(taskId, html) {
    var li = document.querySelector(
      'li.daily-task-card[data-weekly-task-id="' + taskId + '"]'
    );
    if (!li || !html) return;
    li.outerHTML = html;
  }

  function toast(opts) {
    if (window.RebornToast && typeof window.RebornToast.show === 'function') {
      window.RebornToast.show(opts);
    }
  }

  document.addEventListener('submit', function (ev) {
    var form = ev.target;
    if (
      !form ||
      !form.getAttribute ||
      (!form.hasAttribute('data-daily-ajax') &&
        !form.hasAttribute('data-weekly-ajax'))
    ) {
      return;
    }
    var isWeekly = form.hasAttribute('data-weekly-ajax');
    ev.preventDefault();

    var fd = new FormData(form);
    var body = new URLSearchParams();
    fd.forEach(function (v, k) {
      body.append(k, v);
    });

    setBusy(form, true);

    fetch(form.getAttribute('action') || '', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      credentials: 'same-origin',
    })
      .then(function (r) {
        return r.text().then(function (text) {
          var j = null;
          try {
            j = text ? JSON.parse(text) : null;
          } catch (e) {
            j = null;
          }
          return { ok: r.ok, json: j };
        });
      })
      .then(function (res) {
        var j = res.json;
        if (!res.ok || !j || !j.ok) {
          setBusy(form, false);
          return;
        }

        if (isWeekly) {
          replaceWeeklyTaskRow(j.taskId, j.html);
          applyWeeklySummary(j.weeklySummary);
        } else {
          replaceTaskRow(j.taskId, j.html);
          applySummary(j.summary);
        }

        if (j.notify === 'quest_accepted') {
          toast({
            type: 'info',
            title: 'Quest accepted',
            message:
              'Do the work in real life, check in as you go — the last step claims your reward.',
            duration: 7000,
          });
        }

        if (j.partial) {
          toast({
            type: 'progress',
            title: 'Progress saved',
            message:
              String(j.current) +
              '/' +
              String(j.target) +
              ' — steady steps. Final check-in claims the EXP.',
            duration: 7500,
          });
        }

        if (!j.partial && j.gained != null && !j.leveledUp) {
          var msg =
            '+' + String(j.gained) + ' EXP flows into your current class.';
          if (
            !isWeekly &&
            j.baseGained != null &&
            j.streakBonus != null &&
            Number(j.streakBonus) > 0
          ) {
            msg =
              '+' +
              String(j.gained) +
              ' total (' +
              String(j.baseGained) +
              ' quest + ' +
              String(j.streakBonus) +
              ' streak).';
          }
          toast({
            type: 'success',
            title: isWeekly ? 'Weekly arc cleared' : 'Quest cleared',
            message: msg,
            duration: 7000,
          });
        }

        if (j.vaultReward && window.RebornToast && window.RebornToast.show) {
          window.RebornToast.show({
            type: 'info',
            title: j.vaultReward.title || 'Vault reward',
            message: j.vaultReward.message || 'A useful item was added to your Vault.',
            duration: 6500,
          });
        }

        if (j.header) {
          var hdr = Object.assign({}, j.header);
          if (!j.partial && j.expPctBefore != null && j.expPctAfter != null) {
            hdr.expPctBefore = j.expPctBefore;
            hdr.expPctAfter = j.expPctAfter;
          } else {
            hdr.expPctBefore = hdr.expPct;
            hdr.expPctAfter = hdr.expPct;
          }
          applyHeader(hdr);
          if (!j.partial && j.gained != null && Number(j.gained) > 0 && !j.leveledUp) {
            playExpRewardFx(j.gained);
          }
        }

        if (j.leveledUp && j.levelUp && window.RebornLevelUp) {
          window.RebornLevelUp.open(j.levelUp);
        }

        setBusy(form, false);
      })
      .catch(function () {
        setBusy(form, false);
      });
  });
})();
