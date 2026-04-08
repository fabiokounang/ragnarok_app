(function () {
  function softCurrencyName() {
    var root = document.querySelector('.quests-page');
    return (root && root.getAttribute('data-soft-currency')) || 'Astra';
  }

  function bumpTabCount(tabId, delta) {
    var tab = document.getElementById(tabId);
    if (!tab) return;
    var m = tab.textContent.match(/\((\d+)\)/);
    if (!m) return;
    var n = Math.max(0, parseInt(m[1], 10) + delta);
    tab.textContent = tab.textContent.replace(/\(\d+\)/, '(' + n + ')');
  }

  function setQbSubmitBusy(form, busy) {
    var btn = form.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = !!busy;
      btn.setAttribute('aria-busy', busy ? 'true' : 'false');
    }
  }

  function prefersReducedMotion() {
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function openModal(modal) {
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modal.setAttribute('aria-hidden', 'false');
    if (prefersReducedMotion()) {
      modal.classList.add('qb-modal--open');
      return;
    }
    requestAnimationFrame(function () {
      modal.classList.add('qb-modal--open');
    });
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('qb-modal--open');
    var done = function () {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      modal.setAttribute('aria-hidden', 'true');
    };
    if (prefersReducedMotion()) {
      done();
      return;
    }
    window.setTimeout(done, 220);
  }

  document.addEventListener('submit', function (ev) {
    var form = ev.target;
    if (!form || !form.getAttribute || !form.hasAttribute('data-qb-ajax')) return;
    ev.preventDefault();
    var fd = new FormData(form);
    var body = new URLSearchParams();
    fd.forEach(function (v, k) {
      body.append(k, v);
    });
    setQbSubmitBusy(form, true);
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
        setQbSubmitBusy(form, false);
        if (!res.ok || !j || !j.ok) {
          if (window.RebornToast && window.RebornToast.show) {
            window.RebornToast.show({
              type: 'error',
              title: 'Quest board',
              message: 'Could not submit. Try again or refresh the page.',
              duration: 6000,
            });
          }
          return;
        }
        if (j.submitted && !j.autoApproved) {
          window.location.assign('/quests?qb=submitted');
          return;
        }
        if (!j.autoApproved) return;

        var cur = softCurrencyName();
        var msgParts = [];
        if (j.gained != null && Number(j.gained) > 0) {
          msgParts.push('+' + j.gained + ' EXP flows into your current class.');
        }
        if (j.rewardAstra != null && Number(j.rewardAstra) > 0) {
          msgParts.push('+' + j.rewardAstra + ' ' + cur + '.');
        }
        if (!j.leveledUp && msgParts.length && window.RebornToast && window.RebornToast.show) {
          window.RebornToast.show({
            type: 'success',
            title: 'Board quest complete',
            message: msgParts.join(' '),
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

        if (j.header && window.RebornExpUi) {
          var hdr = Object.assign({}, j.header);
          if (j.expPctBefore != null && j.expPctAfter != null) {
            hdr.expPctBefore = j.expPctBefore;
            hdr.expPctAfter = j.expPctAfter;
          } else {
            hdr.expPctBefore = hdr.expPct;
            hdr.expPctAfter = hdr.expPct;
          }
          window.RebornExpUi.applyHeader(hdr);
          if (j.gained != null && Number(j.gained) > 0 && !j.leveledUp) {
            window.RebornExpUi.playExpRewardFx(j.gained);
          }
        }

        if (j.leveledUp && j.levelUp && window.RebornLevelUp) {
          window.RebornLevelUp.open(j.levelUp);
        }

        var card = form.closest('.qb-card');
        if (card && card.parentNode) {
          card.parentNode.removeChild(card);
        }
        bumpTabCount('qb-tab-progress', -1);
        bumpTabCount('qb-tab-finish', 1);
      })
      .catch(function () {
        setQbSubmitBusy(form, false);
      });
  });

  const createModal = document.querySelector('[data-qb-modal="create"]');
  const detailModal = document.querySelector('[data-qb-modal="detail"]');
  if (!createModal && !detailModal) return;

  const openCreate = () => openModal(createModal);
  const closeCreate = () => closeModal(createModal);

  document.querySelectorAll('[data-qb-open="create"]').forEach((btn) => btn.addEventListener('click', openCreate));
  document.querySelectorAll('[data-qb-close="create"]').forEach((btn) => btn.addEventListener('click', closeCreate));

  if (createModal) {
    createModal.addEventListener('click', (e) => {
      if (e.target === createModal) closeCreate();
    });
  }

  const detailTitle = document.getElementById('qb-detail-title');
  const detailQuestName = document.getElementById('qb-detail-quest-name');
  const detailIssuer = document.getElementById('qb-detail-issuer');
  const detailDesc = document.getElementById('qb-detail-desc');
  const detailReward = document.getElementById('qb-detail-reward');
  const detailTrack = document.getElementById('qb-detail-track');
  const detailExpiry = document.getElementById('qb-detail-expiry');
  const detailRequirement = document.getElementById('qb-detail-requirement');
  const detailWhy = document.getElementById('qb-detail-why');
  const detailAcceptForm = document.getElementById('qb-detail-accept-form');
  const currency = detailModal ? detailModal.getAttribute('data-qb-currency') || 'Astra' : 'Astra';

  const whyReward = (track, cadence) => {
    const t = String(track || 'META').toUpperCase();
    const c = String(cadence || 'daily').toLowerCase();
    if (c === 'weekly') return 'Weekly quest gives higher reward because it expects deeper effort and longer commitment.';
    if (t === 'INT') return 'INT quest rewards practical learning you can apply in real life.';
    if (t === 'STR') return 'STR quest rewards physical consistency and discipline.';
    if (t === 'DIS') return 'DIS quest rewards rhythm and habit consistency.';
    if (t === 'SPR') return 'SPR quest rewards recovery and focus quality.';
    return 'Reward is balanced by scope, cadence, and board economy guardrails.';
  };

  const tierLabel = (tierRaw) => {
    const t = Math.max(0, Math.min(3, Number(tierRaw) || 0));
    if (t <= 0) return 'Any tier';
    if (t === 1) return 'First job+';
    if (t === 2) return 'Second job+';
    return 'Third job+';
  };

  const openDetail = () => openModal(detailModal);
  const closeDetail = () => closeModal(detailModal);

  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest('[data-qb-open-detail="1"]') : null;
    if (!btn) return;
    const id = btn.getAttribute('data-qb-id') || '0';
    const status = String(btn.getAttribute('data-qb-status') || 'open').toLowerCase();
    const variant =
      status === 'accepted' || status === 'submitted'
        ? 'progress'
        : status === 'approved' || status === 'rejected' || status === 'expired' || status === 'cancelled'
        ? 'finish'
        : 'open';
    if (detailModal) {
      detailModal.setAttribute('data-qb-variant', variant);
    }
    const qTitle = btn.getAttribute('data-qb-title') || 'Quest detail';
    if (detailQuestName) detailQuestName.textContent = qTitle;
    if (detailTitle) {
      if (variant === 'progress') detailTitle.textContent = 'Quest In Progress';
      else if (variant === 'finish') detailTitle.textContent = 'Quest Report';
      else detailTitle.textContent = 'Quest Available';
    }
    if (detailIssuer) detailIssuer.textContent = btn.getAttribute('data-qb-issuer') || '-';
    if (detailDesc) detailDesc.textContent = btn.getAttribute('data-qb-desc') || '-';
    if (detailReward) {
      detailReward.textContent =
        '+' + (btn.getAttribute('data-qb-reward-exp') || '0') + ' EXP · +' + (btn.getAttribute('data-qb-reward-astra') || '0') + ' ' + currency;
    }
    const track = btn.getAttribute('data-qb-track') || 'META';
    const cadence = btn.getAttribute('data-qb-cadence') || 'daily';
    const reqLevel = Math.max(1, Number(btn.getAttribute('data-qb-req-level') || 1) || 1);
    const reqTier = Math.max(0, Number(btn.getAttribute('data-qb-req-tier') || 0) || 0);
    const canAccept = (btn.getAttribute('data-qb-can-accept') || '1') === '1';
    if (detailTrack) detailTrack.textContent = track + ' · ' + cadence;
    if (detailExpiry) detailExpiry.textContent = btn.getAttribute('data-qb-expiry') || 'No expiry';
    if (detailRequirement) detailRequirement.textContent = 'Lv ' + reqLevel + ' · ' + tierLabel(reqTier);
    if (detailWhy) {
      detailWhy.textContent =
        variant === 'open' && !canAccept
          ? 'You posted this quest, so it cannot be accepted by your own account.'
          : whyReward(track, cadence);
    }
    if (detailAcceptForm) {
      detailAcceptForm.setAttribute('action', '/quests/board/' + id + '/accept');
      detailAcceptForm.classList.toggle('hidden', variant !== 'open' || !canAccept);
    }
    openDetail();
  });

  document.querySelectorAll('[data-qb-close="detail"]').forEach((btn) => btn.addEventListener('click', closeDetail));
  if (detailModal) {
    detailModal.addEventListener('click', (e) => {
      if (e.target === detailModal) closeDetail();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeCreate();
    closeDetail();
  });
})();
