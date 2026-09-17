// Outil de suivi de rentabilité du brisage - données partagées via Supabase (Postgres),
// pour être accessibles depuis plusieurs appareils avec le même lien.

const RATIO_THRESHOLDS = {
  rentable: 1.2,
  relRentable: 1.0,
  relPasRentable: 0.8,
};

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchRemoteData() {
  return supabaseClient.from('app_state').select('data').eq('id', 'default').single();
}

async function loadData() {
  let { data, error } = await fetchRemoteData();

  if (error) {
    // A fresh page load can race the browser's network stack — retry once before giving up.
    await sleep(800);
    ({ data, error } = await fetchRemoteData());
  }

  if (error) {
    console.error('Impossible de charger les données', error);
    showAlert("Impossible de charger les données depuis le serveur. Vérifie ta connexion internet puis clique sur 'Actualiser'.");
    return { runeTypes: [], items: [], attempts: [] };
  }

  const d = data.data || {};
  return {
    runeTypes: d.runeTypes || [],
    items: d.items || [],
    attempts: d.attempts || [],
  };
}

async function saveData() {
  const { error } = await supabaseClient
    .from('app_state')
    .update({ data: state.data, updated_at: new Date().toISOString() })
    .eq('id', 'default');

  if (error) {
    console.error('Impossible de sauvegarder les données', error);
    showAlert("Erreur : impossible d'enregistrer les données sur le serveur. Vérifie ta connexion internet — ce changement n'a pas été sauvegardé.");
  }
}

// ---------- Custom modal (native confirm/alert are unreliable in sandboxed embeds) ----------

function showModal({ message, confirmLabel, cancelLabel, danger = false }) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modal-overlay');
    const msgEl = document.getElementById('modal-message');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const confirmBtn = document.getElementById('modal-confirm-btn');

    msgEl.textContent = message;
    confirmBtn.textContent = confirmLabel;
    confirmBtn.classList.toggle('danger-btn', danger);
    cancelBtn.hidden = !cancelLabel;
    if (cancelLabel) cancelBtn.textContent = cancelLabel;
    overlay.classList.remove('hidden');

    function cleanup(result) {
      overlay.classList.add('hidden');
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlayClick);
      resolve(result);
    }
    function onConfirm() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onOverlayClick(e) { if (e.target === overlay) cleanup(false); }

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlayClick);
    confirmBtn.focus();
  });
}

function showConfirm(message, { danger = false } = {}) {
  return showModal({ message, confirmLabel: 'Confirmer', cancelLabel: 'Annuler', danger });
}

function showAlert(message) {
  return showModal({ message, confirmLabel: 'OK', cancelLabel: null });
}

const state = {
  data: { runeTypes: [], items: [], attempts: [] },
  sort: { column: 'netGain', direction: 'desc' },
  openDetailItemId: null,
  searchQuery: '',
};

function formatKamas(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Math.round(n).toLocaleString('fr-FR');
}

function formatPercent(n, decimals = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toFixed(decimals) + ' %';
}

function getItemAttempts(itemId) {
  return state.data.attempts.filter((a) => a.itemId === itemId);
}

function attemptValue(attempt) {
  return attempt.runes.reduce((sum, r) => sum + r.qty * r.price, 0);
}

function attemptUnitCraftCost(attempt) {
  return attempt.craftQty > 0 ? attempt.craftCost / attempt.craftQty : null;
}

function computeItemStats(item) {
  const attempts = getItemAttempts(item.id);
  const count = attempts.length;

  let unitCraftCost = null; // informational: average cost per crafted item
  let avgCraftCost = null; // average TOTAL cost of the series, per essai — what profitability is judged against
  let avgPercent = null;
  let avgValue = null; // average TOTAL rune value obtained, per essai
  let ratio = null;
  let netGain = null;

  if (count > 0) {
    const unitCosts = attempts.map(attemptUnitCraftCost).filter((c) => c !== null);
    if (unitCosts.length > 0) unitCraftCost = unitCosts.reduce((s, c) => s + c, 0) / unitCosts.length;

    avgCraftCost = attempts.reduce((s, a) => s + a.craftCost, 0) / count;
    avgPercent = attempts.reduce((s, a) => s + a.percent, 0) / count;
    avgValue = attempts.reduce((s, a) => s + attemptValue(a), 0) / count;

    if (avgCraftCost) {
      ratio = avgValue / avgCraftCost;
      netGain = avgValue - avgCraftCost;
    }
  }

  return { unitCraftCost, avgCraftCost, count, avgPercent, avgValue, ratio, netGain };
}

function classifyRatio(ratio) {
  if (ratio === null || ratio === undefined) {
    return { label: 'Pas assez de données', cls: 'no-data' };
  }
  if (ratio >= RATIO_THRESHOLDS.rentable) return { label: 'Rentable', cls: 'rentable' };
  if (ratio >= RATIO_THRESHOLDS.relRentable) return { label: 'Relativement rentable', cls: 'rel-rentable' };
  if (ratio >= RATIO_THRESHOLDS.relPasRentable) return { label: 'Relativement pas rentable', cls: 'rel-pas-rentable' };
  return { label: 'Pas rentable', cls: 'pas-rentable' };
}

// ---------- Rune types ----------

function renderRuneTypes() {
  const container = document.getElementById('rune-types-list');
  if (state.data.runeTypes.length === 0) {
    container.innerHTML = '<p class="empty-state">Aucun type de rune. Ajoute-en un ci-dessous.</p>';
    return;
  }
  container.innerHTML = '';
  state.data.runeTypes.forEach((rt, index) => {
    const row = document.createElement('div');
    row.className = 'rune-type-row';
    row.innerHTML = `
      <div class="reorder-btns">
        <button type="button" class="move-rt-btn" data-id="${rt.id}" data-dir="up" title="Monter" ${index === 0 ? 'disabled' : ''}>▲</button>
        <button type="button" class="move-rt-btn" data-id="${rt.id}" data-dir="down" title="Descendre" ${index === state.data.runeTypes.length - 1 ? 'disabled' : ''}>▼</button>
      </div>
      <span class="rt-name">${escapeHtml(rt.name)}</span>
      <input type="number" min="0" step="1" value="${rt.price}" class="rt-price-input" data-id="${rt.id}">
      <span>kamas</span>
      <button type="button" class="remove-rt-btn" data-id="${rt.id}">Supprimer</button>
    `;
    container.appendChild(row);
  });

  container.querySelectorAll('.move-rt-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const dir = e.target.dataset.dir;
      const index = state.data.runeTypes.findIndex((r) => r.id === id);
      const swapWith = dir === 'up' ? index - 1 : index + 1;
      if (swapWith < 0 || swapWith >= state.data.runeTypes.length) return;
      const arr = state.data.runeTypes;
      [arr[index], arr[swapWith]] = [arr[swapWith], arr[index]];
      saveData();
      render();
    });
  });

  container.querySelectorAll('.rt-price-input').forEach((input) => {
    input.addEventListener('change', (e) => {
      const rt = state.data.runeTypes.find((r) => r.id === e.target.dataset.id);
      if (rt) {
        rt.price = Number(e.target.value) || 0;
        saveData();
        render();
      }
    });
  });

  container.querySelectorAll('.remove-rt-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      const usedInAttempt = state.data.attempts.some((a) => a.runes.some((r) => r.typeId === id));
      if (usedInAttempt) {
        const ok = await showConfirm(
          "Cette rune est utilisée dans des essais existants. La supprimer du catalogue ne modifie pas l'historique. Continuer ?",
          { danger: true }
        );
        if (!ok) return;
      }
      state.data.runeTypes = state.data.runeTypes.filter((r) => r.id !== id);
      saveData();
      render();
    });
  });
}

document.getElementById('rune-type-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('rune-type-name').value.trim();
  const price = Number(document.getElementById('rune-type-price').value);
  if (!name) return;
  state.data.runeTypes.push({ id: uid(), name, price: price || 0 });
  saveData();
  e.target.reset();
  render();
});

// ---------- Tabs ----------

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach((b) => {
      const isActive = b === btn;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-selected', String(isActive));
    });
    document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
      panel.classList.toggle('hidden', panel.dataset.tabPanel !== tab);
    });
  });
});

// ---------- Items ----------

document.getElementById('show-add-item-btn').addEventListener('click', () => {
  document.getElementById('add-item-form').classList.toggle('hidden');
});

document.querySelectorAll('[data-cancel]').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    document.getElementById(e.target.dataset.cancel).classList.add('hidden');
  });
});

document.getElementById('item-search').addEventListener('input', (e) => {
  state.searchQuery = e.target.value.trim().toLowerCase();
  renderItemsTable();
});

document.getElementById('add-item-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('item-name').value.trim();
  if (!name) return;
  state.data.items.push({ id: uid(), name });
  saveData();
  e.target.reset();
  document.getElementById('add-item-form').classList.add('hidden');
  render();
});

function sortedItems() {
  const { column, direction } = state.sort;
  const items = state.searchQuery
    ? state.data.items.filter((item) => item.name.toLowerCase().includes(state.searchQuery))
    : state.data.items;
  const rows = items.map((item) => ({ item, stats: computeItemStats(item) }));

  rows.sort((a, b) => {
    let va, vb;
    switch (column) {
      case 'name':
        va = a.item.name.toLowerCase();
        vb = b.item.name.toLowerCase();
        break;
      case 'unitCraftCost':
        va = a.stats.unitCraftCost;
        vb = b.stats.unitCraftCost;
        break;
      case 'count':
        va = a.stats.count;
        vb = b.stats.count;
        break;
      case 'avgPercent':
        va = a.stats.avgPercent;
        vb = b.stats.avgPercent;
        break;
      case 'avgValue':
        va = a.stats.avgValue;
        vb = b.stats.avgValue;
        break;
      case 'ratio':
        va = a.stats.ratio;
        vb = b.stats.ratio;
        break;
      case 'netGain':
      default:
        va = a.stats.netGain;
        vb = b.stats.netGain;
        break;
    }
    // Nulls always last regardless of direction
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    if (va < vb) return direction === 'asc' ? -1 : 1;
    if (va > vb) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  return rows;
}

function renderItemsTable() {
  const tbody = document.getElementById('items-table-body');
  const rows = sortedItems();

  if (rows.length === 0) {
    const message = state.searchQuery
      ? `Aucun objet ne correspond à "${escapeHtml(state.searchQuery)}".`
      : 'Aucun objet pour le moment. Ajoute-en un avec "+ Nouvel objet".';
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">${message}</td></tr>`;
  } else {
    tbody.innerHTML = rows.map(({ item, stats }) => {
      const cat = classifyRatio(stats.ratio);
      const ratioLabel = stats.ratio !== null ? formatPercent(stats.ratio * 100, 0) : '—';
      const netGainCls = stats.netGain === null ? '' : stats.netGain >= 0 ? 'gain-positive' : 'gain-negative';
      const netGainLabel = stats.netGain === null ? '—' : (stats.netGain >= 0 ? '+' : '') + formatKamas(stats.netGain);
      return `
        <tr data-item-id="${item.id}">
          <td>${escapeHtml(item.name)}</td>
          <td title="Moyenne calculée à partir des essais — pour corriger une valeur, ouvre 'Détails' puis 'Modifier' sur l'essai concerné">${formatKamas(stats.unitCraftCost)}</td>
          <td>${stats.count}</td>
          <td>${formatPercent(stats.avgPercent)}</td>
          <td>${formatKamas(stats.avgValue)}</td>
          <td class="${netGainCls}">${netGainLabel}</td>
          <td>
            <span class="badge ${cat.cls}">${cat.label}</span>
            <div class="ratio-note">${stats.ratio !== null ? ratioLabel + ' du coût de craft de la série' : ''}</div>
          </td>
          <td class="row-actions">
            <button type="button" class="add-attempt-btn primary-btn" data-id="${item.id}">+ Nouvel essai</button>
            <button type="button" class="edit-item-btn" data-id="${item.id}">Renommer</button>
            <button type="button" class="toggle-detail-btn" data-id="${item.id}">Détails</button>
            <button type="button" class="delete-item-btn" data-id="${item.id}">Supprimer</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  tbody.querySelectorAll('.add-attempt-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => openAddAttemptForm(e.target.dataset.id));
  });
  tbody.querySelectorAll('.edit-item-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => openEditItemForm(e.target.dataset.id));
  });
  tbody.querySelectorAll('.toggle-detail-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      state.openDetailItemId = state.openDetailItemId === id ? null : id;
      renderDetail();
    });
  });
  tbody.querySelectorAll('.delete-item-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      const item = state.data.items.find((i) => i.id === id);
      const ok = await showConfirm(`Supprimer "${item.name}" et tous ses essais associés ?`, { danger: true });
      if (!ok) return;
      state.data.items = state.data.items.filter((i) => i.id !== id);
      state.data.attempts = state.data.attempts.filter((a) => a.itemId !== id);
      if (state.openDetailItemId === id) state.openDetailItemId = null;
      saveData();
      render();
    });
  });

  updateSortHeaders();
}

function updateSortHeaders() {
  document.querySelectorAll('#items-table th[data-sort]').forEach((th) => {
    th.classList.remove('sorted');
    th.removeAttribute('data-arrow');
    if (th.dataset.sort === state.sort.column) {
      th.classList.add('sorted');
      th.setAttribute('data-arrow', state.sort.direction === 'asc' ? '▲' : '▼');
    }
  });
}

document.querySelectorAll('#items-table th[data-sort]').forEach((th) => {
  th.addEventListener('click', () => {
    const col = th.dataset.sort;
    if (state.sort.column === col) {
      state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      state.sort.column = col;
      state.sort.direction = col === 'name' ? 'asc' : 'desc';
    }
    renderItemsTable();
  });
});

// ---------- Add attempt form ----------

function buildRuneRow(prefill) {
  const template = document.getElementById('rune-row-template');
  const node = template.content.firstElementChild.cloneNode(true);
  const select = node.querySelector('.rune-type-select');

  if (state.data.runeTypes.length === 0) {
    select.innerHTML = '<option value="">Aucune rune définie</option>';
  } else {
    select.innerHTML = state.data.runeTypes
      .map((rt) => `<option value="${rt.id}">${escapeHtml(rt.name)}</option>`)
      .join('');
  }

  const qtyInput = node.querySelector('.rune-qty');
  const priceInput = node.querySelector('.rune-price');

  function syncDefaultPrice() {
    const rt = state.data.runeTypes.find((r) => r.id === select.value);
    if (rt && !priceInput.dataset.touched) priceInput.value = rt.price;
  }

  select.addEventListener('change', syncDefaultPrice);
  priceInput.addEventListener('input', () => { priceInput.dataset.touched = '1'; });

  if (prefill) {
    select.value = prefill.typeId;
    qtyInput.value = prefill.qty;
    if (prefill.price !== undefined) {
      priceInput.value = prefill.price;
      priceInput.dataset.touched = '1';
    } else {
      syncDefaultPrice();
    }
  } else {
    syncDefaultPrice();
  }

  node.querySelector('.remove-rune-row-btn').addEventListener('click', () => node.remove());

  return node;
}

function buildAttemptForm(itemName, prefillAttempt, knownRuneTypeIds) {
  const template = document.getElementById('add-attempt-template');
  const form = template.content.firstElementChild.cloneNode(true);
  form.querySelector('.item-name-label').textContent = itemName;
  form.querySelector('.attempt-form-title').textContent = prefillAttempt ? "Modifier l'essai" : 'Nouvel essai de brisage';

  const rowsContainer = form.querySelector('.attempt-runes-rows');

  if (prefillAttempt) {
    form.querySelector('.attempt-craft-cost').value = prefillAttempt.craftCost;
    form.querySelector('.attempt-craft-qty').value = prefillAttempt.craftQty;
    form.querySelector('.attempt-percent').value = prefillAttempt.percent;
    if (prefillAttempt.runes.length === 0) {
      rowsContainer.appendChild(buildRuneRow());
    } else {
      prefillAttempt.runes.forEach((r) => rowsContainer.appendChild(buildRuneRow(r)));
    }
  } else if (knownRuneTypeIds && knownRuneTypeIds.length > 0) {
    // Pré-remplit une ligne par rune déjà obtenue sur de précédents essais de cet objet,
    // quantité vide par défaut (= aucune obtenue cette fois, sauf si renseignée).
    knownRuneTypeIds.forEach((typeId) => rowsContainer.appendChild(buildRuneRow({ typeId, qty: '' })));
  } else {
    rowsContainer.appendChild(buildRuneRow());
  }

  form.querySelector('.add-rune-row-btn').addEventListener('click', () => {
    rowsContainer.appendChild(buildRuneRow());
  });

  return form;
}

function knownRuneTypeIdsForItem(itemId) {
  const seen = [];
  getItemAttempts(itemId).forEach((a) => {
    a.runes.forEach((r) => {
      if (!seen.includes(r.typeId) && state.data.runeTypes.some((rt) => rt.id === r.typeId)) {
        seen.push(r.typeId);
      }
    });
  });
  return seen;
}

function readAttemptForm(form) {
  const craftCost = Number(form.querySelector('.attempt-craft-cost').value) || 0;
  const craftQty = Number(form.querySelector('.attempt-craft-qty').value) || 0;
  const percent = Number(form.querySelector('.attempt-percent').value);
  const runes = [...form.querySelectorAll('.rune-row')].map((row) => ({
    typeId: row.querySelector('.rune-type-select').value,
    qty: Number(row.querySelector('.rune-qty').value) || 0,
    price: Number(row.querySelector('.rune-price').value) || 0,
  })).filter((r) => r.typeId && r.qty > 0);
  return { craftCost, craftQty, percent, runes };
}

function insertInlineForm(form, { afterRowSelector, holderClass, colspan, focusSelector }) {
  const row = document.querySelector(afterRowSelector);
  const holder = document.createElement('tr');
  holder.className = holderClass;
  const td = document.createElement('td');
  td.colSpan = colspan;
  td.appendChild(form);
  holder.appendChild(td);
  row.after(holder);

  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  form.querySelector(focusSelector).focus();
}

function openAddAttemptForm(itemId) {
  closeInlineForms();
  const item = state.data.items.find((i) => i.id === itemId);
  if (!item) return;

  if (state.data.runeTypes.length === 0) {
    showAlert("Ajoute d'abord au moins un type de rune dans la section 'Types de runes'.");
    return;
  }

  const form = buildAttemptForm(item.name, null, knownRuneTypeIdsForItem(itemId));
  form.querySelector('.cancel-btn').addEventListener('click', () => form.closest('tr').remove());

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const attempt = readAttemptForm(form);
    state.data.attempts.push({ id: uid(), itemId, date: new Date().toISOString(), ...attempt });
    saveData();
    render();
  });

  insertInlineForm(form, {
    afterRowSelector: `#items-table-body tr[data-item-id="${itemId}"]`,
    holderClass: 'add-attempt-holder',
    colspan: 8,
    focusSelector: '.attempt-craft-cost',
  });
}

function openEditAttemptForm(attemptId) {
  closeInlineForms();
  const attempt = state.data.attempts.find((a) => a.id === attemptId);
  if (!attempt) return;
  const item = state.data.items.find((i) => i.id === attempt.itemId);
  if (!item) return;

  const form = buildAttemptForm(item.name, attempt);
  form.querySelector('.cancel-btn').addEventListener('click', () => form.closest('tr').remove());

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    Object.assign(attempt, readAttemptForm(form));
    saveData();
    render();
  });

  insertInlineForm(form, {
    afterRowSelector: `.attempts-table tr[data-attempt-id="${attemptId}"]`,
    holderClass: 'edit-attempt-holder',
    colspan: 7,
    focusSelector: '.attempt-craft-cost',
  });
}

function closeInlineForms() {
  document.querySelectorAll('.add-attempt-holder, .edit-item-holder, .edit-attempt-holder').forEach((el) => el.remove());
}

// ---------- Edit item form ----------

function openEditItemForm(itemId) {
  closeInlineForms();
  const item = state.data.items.find((i) => i.id === itemId);
  if (!item) return;

  const template = document.getElementById('edit-item-template');
  const form = template.content.firstElementChild.cloneNode(true);
  form.querySelector('.item-name-label').textContent = item.name;
  form.querySelector('.edit-item-name').value = item.name;

  form.querySelector('.cancel-btn').addEventListener('click', () => form.closest('tr').remove());

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.querySelector('.edit-item-name').value.trim();
    if (!name) return;
    item.name = name;
    saveData();
    render();
  });

  insertInlineForm(form, {
    afterRowSelector: `#items-table-body tr[data-item-id="${itemId}"]`,
    holderClass: 'edit-item-holder',
    colspan: 8,
    focusSelector: '.edit-item-name',
  });
}

// ---------- Item detail (attempt history) ----------

function renderDetail() {
  const container = document.getElementById('item-detail-container');
  if (!state.openDetailItemId) {
    container.innerHTML = '';
    return;
  }
  const item = state.data.items.find((i) => i.id === state.openDetailItemId);
  if (!item) {
    container.innerHTML = '';
    return;
  }
  const attempts = getItemAttempts(item.id).slice().sort((a, b) => new Date(b.date) - new Date(a.date));

  const rowsHtml = attempts.length === 0
    ? '<tr><td colspan="7" class="empty-state">Aucun essai enregistré</td></tr>'
    : attempts.map((a) => {
      const runesLabel = a.runes.length === 0
        ? '—'
        : a.runes.map((r) => {
          const rt = state.data.runeTypes.find((t) => t.id === r.typeId);
          const name = rt ? rt.name : '(rune supprimée)';
          return `${r.qty}× ${escapeHtml(name)} (${formatKamas(r.price)}/u)`;
        }).join(', ');
      const value = attemptValue(a);
      const date = new Date(a.date).toLocaleDateString('fr-FR');
      const unitCost = attemptUnitCraftCost(a);
      const netGain = value - a.craftCost;
      const netCls = netGain >= 0 ? 'gain-positive' : 'gain-negative';
      const netLabel = (netGain >= 0 ? '+' : '') + formatKamas(netGain);
      return `
        <tr data-attempt-id="${a.id}">
          <td>${date}</td>
          <td>${formatKamas(a.craftCost)}<div class="ratio-note">${formatKamas(unitCost)}/u × ${a.craftQty}</div></td>
          <td>${formatPercent(a.percent)}</td>
          <td>${runesLabel}</td>
          <td>${formatKamas(value)}</td>
          <td class="${netCls}">${netLabel}</td>
          <td class="row-actions">
            <button type="button" class="edit-attempt-btn" data-id="${a.id}">Modifier</button>
            <button type="button" class="delete-attempt-btn" data-id="${a.id}">✕</button>
          </td>
        </tr>
      `;
    }).join('');

  container.innerHTML = `
    <div class="detail-panel">
      <h3>Historique — ${escapeHtml(item.name)}</h3>
      <table class="attempts-table">
        <thead>
          <tr><th>Date</th><th>Coût craft (série)</th><th>% brisage</th><th>Runes obtenues</th><th>Valeur runes</th><th>Résultat</th><th class="actions-col"></th></tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;

  container.querySelectorAll('.edit-attempt-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => openEditAttemptForm(e.target.dataset.id));
  });
  container.querySelectorAll('.delete-attempt-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      state.data.attempts = state.data.attempts.filter((a) => a.id !== id);
      saveData();
      render();
    });
  });
}

// ---------- Utils ----------

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function render() {
  renderRuneTypes();
  closeInlineForms();
  renderItemsTable();
  renderDetail();
}

document.getElementById('refresh-btn').addEventListener('click', async () => {
  const btn = document.getElementById('refresh-btn');
  btn.disabled = true;
  state.data = await loadData();
  render();
  btn.disabled = false;
});

// ---------- Legacy localStorage import (pre-Supabase data left on a browser) ----------

const LEGACY_STORAGE_KEY = 'dofusBrisageData';

function mergeById(baseArr, incomingArr) {
  const existingIds = new Set(baseArr.map((x) => x.id));
  return [...baseArr, ...incomingArr.filter((x) => !existingIds.has(x.id))];
}

function readLegacyData() {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const legacy = {
      runeTypes: parsed.runeTypes || [],
      items: parsed.items || [],
      attempts: parsed.attempts || [],
    };
    const hasData = legacy.runeTypes.length || legacy.items.length || legacy.attempts.length;
    return hasData ? legacy : null;
  } catch (e) {
    console.error('Anciennes données locales illisibles', e);
    return null;
  }
}

function checkLegacyData() {
  if (readLegacyData()) {
    document.getElementById('legacy-import-banner').classList.remove('hidden');
  }
}

document.getElementById('import-legacy-btn').addEventListener('click', async () => {
  const legacy = readLegacyData();
  if (!legacy) return;
  const btn = document.getElementById('import-legacy-btn');
  btn.disabled = true;
  state.data = {
    runeTypes: mergeById(state.data.runeTypes, legacy.runeTypes),
    items: mergeById(state.data.items, legacy.items),
    attempts: mergeById(state.data.attempts, legacy.attempts),
  };
  await saveData();
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  document.getElementById('legacy-import-banner').classList.add('hidden');
  render();
  btn.disabled = false;
});

document.getElementById('dismiss-legacy-btn').addEventListener('click', () => {
  document.getElementById('legacy-import-banner').classList.add('hidden');
});

async function init() {
  state.data = await loadData();
  render();
  document.body.classList.remove('loading');
  checkLegacyData();
}

init();
