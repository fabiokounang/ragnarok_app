(function () {
  'use strict';

  var vaultButtons = Array.prototype.slice.call(document.querySelectorAll('[data-vault-item]'));
  var vaultName = document.getElementById('vault-item-name');
  var vaultDesc = document.getElementById('vault-item-desc');
  var vaultUseAction = document.getElementById('vault-use-action');
  var vaultUseBtn = document.getElementById('vault-use-btn');

  function setVaultInfo(btn) {
    if (!btn || !vaultName || !vaultDesc) return;
    vaultButtons.forEach(function (b) {
      b.classList.remove('ring-2', 'ring-amber-500/70');
    });
    btn.classList.add('ring-2', 'ring-amber-500/70');
    vaultName.textContent = btn.getAttribute('data-name') || 'Item';
    vaultDesc.textContent = btn.getAttribute('data-desc') || '';
    if (vaultUseAction && vaultUseBtn) {
      var action = String(btn.getAttribute('data-vault-action') || '');
      var canUse = String(btn.getAttribute('data-can-use') || '0') === '1';
      vaultUseAction.value = action;
      vaultUseBtn.disabled = !action || !canUse;
      vaultUseBtn.classList.toggle('opacity-40', !action || !canUse);
      vaultUseBtn.textContent = !action ? 'No action' : canUse ? 'Use' : 'Unavailable';
    }
  }

  vaultButtons.forEach(function (btn) {
    btn.addEventListener('mouseenter', function () {
      setVaultInfo(btn);
    });
    btn.addEventListener('focus', function () {
      setVaultInfo(btn);
    });
    btn.addEventListener('click', function () {
      setVaultInfo(btn);
    });
  });

  var shopButtons = Array.prototype.slice.call(document.querySelectorAll('[data-shop-action]'));
  var actionInput = document.getElementById('shop-buy-action');
  var qtyInput = document.getElementById('shop-buy-qty');
  var itemName = document.getElementById('shop-item-name');
  var itemDesc = document.getElementById('shop-item-desc');
  var itemCost = document.getElementById('shop-item-cost');
  var buyBtn = document.getElementById('shop-buy-btn');

  function setShopInfo(btn) {
    if (!btn || !actionInput || !qtyInput || !itemName || !itemDesc || !itemCost || !buyBtn) return;
    shopButtons.forEach(function (b) {
      b.classList.remove('ring-2', 'ring-violet-500/70');
    });
    btn.classList.add('ring-2', 'ring-violet-500/70');

    var action = btn.getAttribute('data-shop-action') || 'daily_reroll';
    var maxRaw = Math.max(0, Number(btn.getAttribute('data-shop-max') || 0) || 0);
    var max = Math.max(1, maxRaw);
    var price = Math.max(0, Number(btn.getAttribute('data-shop-price') || 0) || 0);
    var qtyMode = String(btn.getAttribute('data-shop-qty') || 'single');

    actionInput.value = action;
    itemName.textContent = btn.getAttribute('data-shop-name') || 'Shop item';
    itemDesc.textContent = btn.getAttribute('data-shop-desc') || '';
    qtyInput.max = String(max);
    qtyInput.value = '1';
    qtyInput.disabled = qtyMode !== 'multi';
    itemCost.textContent = String(price);

    var enabled = maxRaw > 0;
    buyBtn.disabled = !enabled;
    buyBtn.classList.toggle('opacity-40', !enabled);
  }

  shopButtons.forEach(function (btn) {
    btn.addEventListener('mouseenter', function () {
      setShopInfo(btn);
    });
    btn.addEventListener('focus', function () {
      setShopInfo(btn);
    });
    btn.addEventListener('click', function () {
      setShopInfo(btn);
    });
  });

  if (shopButtons.length) setShopInfo(shopButtons[0]);
  if (vaultButtons.length) setVaultInfo(vaultButtons[0]);
})();
