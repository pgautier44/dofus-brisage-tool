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
    return { runeTypes: [], runeCategories: [], items: [], attempts: [], sculptorItems: [], sculptorAttempts: [], forgeronItems: [], forgeronAttempts: [], jewels: [], jewelSales: [], sculptoItems: [], sculptoSales: [], brisageItems: [] };
  }

  const d = data.data || {};
  return {
    runeTypes: d.runeTypes || [],
    runeCategories: d.runeCategories || [],
    items: d.items || [],
    attempts: d.attempts || [],
    // sculptorItems/sculptorAttempts/forgeronItems/forgeronAttempts: those pages were
    // removed, but keep reading these back so a save doesn't erase that leftover data.
    sculptorItems: d.sculptorItems || [],
    sculptorAttempts: d.sculptorAttempts || [],
    forgeronItems: d.forgeronItems || [],
    forgeronAttempts: d.forgeronAttempts || [],
    jewels: d.jewels || [],
    jewelSales: d.jewelSales || [],
    sculptoItems: d.sculptoItems || [],
    sculptoSales: d.sculptoSales || [],
    brisageItems: d.brisageItems || [],
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

const RUNE_CATEGORY_PALETTE = ['#c9720f', '#2f9e44', '#1971c2', '#9c36b5', '#e8590c', '#0c8599', '#e03131', '#5c940d'];

const state = {
  // sculptorItems/sculptorAttempts/forgeronItems/forgeronAttempts are kept here (even
  // though those pages were removed) so a save never strips that data out of the
  // shared Supabase row — loadData() still reads them back in on every load.
  data: { runeTypes: [], runeCategories: [], items: [], attempts: [], sculptorItems: [], sculptorAttempts: [], forgeronItems: [], forgeronAttempts: [], jewels: [], jewelSales: [], sculptoItems: [], sculptoSales: [], brisageItems: [] },
  sort: { column: 'ratio', direction: 'desc' },
  openDetailItemId: null,
  searchQuery: '',
  foldNonProfitable: true,
  jewelrySort: { column: 'avgRatio', direction: 'desc' },
  openJewelDetailId: null,
  jewelrySearchQuery: '',
  jewelryFoldNonProfitable: true,
  sculptoSort: { column: 'avgRatio', direction: 'desc' },
  openSculptoDetailId: null,
  sculptoSearchQuery: '',
  sculptoFoldNonProfitable: true,
  brisageSort: { column: 'name', direction: 'asc' },
  brisageSearchQuery: '',
};

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function formatKamas(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Math.round(n).toLocaleString('fr-FR');
}

function formatPercent(n, decimals = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toFixed(decimals) + ' %';
}

// Greedy split of a rune line's quantity into x9/x3/unit tiers, taking the
// highest tier first (x9 is always worth more per rune than 3×x3, itself
// always worth more per rune than 9×unit).
function runeLineSplit(r) {
  const rt = state.data.runeTypes.find((t) => t.id === r.typeId);
  const x9Price = rt && rt.x9Price ? rt.x9Price : null;
  const x3Price = rt && rt.x3Price ? rt.x3Price : null;
  let qty = r.qty;

  const n9 = x9Price ? Math.floor(qty / 9) : 0;
  qty -= n9 * 9;
  const n3 = x3Price ? Math.floor(qty / 3) : 0;
  qty -= n3 * 3;
  const n1 = qty;

  return { n9, n3, n1, x9Price, x3Price };
}

function runeLineValue(r) {
  const { n9, n3, n1, x9Price, x3Price } = runeLineSplit(r);
  return n9 * (x9Price || 0) + n3 * (x3Price || 0) + n1 * r.price;
}

function attemptValue(attempt) {
  return attempt.runes.reduce((sum, r) => sum + runeLineValue(r), 0);
}

function attemptUnitCraftCost(attempt) {
  return attempt.craftQty > 0 ? attempt.craftCost / attempt.craftQty : null;
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

function runeTypeRowHtml(rt) {
  return `
    <div class="rune-type-row" draggable="true" data-id="${rt.id}">
      <span class="drag-handle" title="Glisser pour réordonner / changer de catégorie">⠿</span>
      <span class="rt-name">${escapeHtml(rt.name)}</span>
      <label class="rt-price-field">Prix
        <input type="number" min="0" step="1" value="${rt.price}" class="rt-price-input" data-id="${rt.id}">
      </label>
      <label class="rt-price-field" title="Prix de vente combiné par lot de 3 (laisser vide si non utilisé)">x3
        <input type="number" min="0" step="1" value="${rt.x3Price ?? ''}" class="rt-x3-input" data-id="${rt.id}" placeholder="—">
      </label>
      <label class="rt-price-field" title="Prix de vente combiné par lot de 9 (laisser vide si non utilisé)">x9
        <input type="number" min="0" step="1" value="${rt.x9Price ?? ''}" class="rt-x9-input" data-id="${rt.id}" placeholder="—">
      </label>
      <button type="button" class="remove-rt-btn" data-id="${rt.id}">Supprimer</button>
    </div>
  `;
}

function runeCategoryGroups() {
  const categories = state.data.runeCategories;
  const groups = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    color: cat.color,
    runes: state.data.runeTypes.filter((rt) => rt.categoryId === cat.id),
  }));
  const uncategorized = state.data.runeTypes.filter(
    (rt) => !rt.categoryId || !categories.some((c) => c.id === rt.categoryId)
  );
  if (uncategorized.length > 0 || categories.length === 0) {
    groups.push({ id: null, name: 'Sans catégorie', color: null, runes: uncategorized });
  }
  return groups;
}

function renderRuneTypes() {
  const container = document.getElementById('rune-types-list');
  if (state.data.runeTypes.length === 0 && state.data.runeCategories.length === 0) {
    container.innerHTML = '<p class="empty-state">Aucun type de rune. Ajoute-en un ci-dessous.</p>';
    return;
  }

  container.innerHTML = runeCategoryGroups().map((g) => {
    const deleteBtn = g.id
      ? `<button type="button" class="remove-category-btn" data-id="${g.id}" title="Supprimer la catégorie (les runes repassent en 'Sans catégorie')">✕</button>`
      : '';
    const rowsHtml = g.runes.length === 0
      ? '<p class="empty-state small">Glisse une rune ici</p>'
      : g.runes.map(runeTypeRowHtml).join('');
    return `
      <div class="rune-category-group" data-category-id="${g.id || ''}" style="--cat-color:${g.color || 'var(--no-data)'}">
        <div class="rune-category-header">
          <span class="cat-dot"></span>
          <span class="cat-name">${escapeHtml(g.name)}</span>
          ${deleteBtn}
        </div>
        <div class="rune-category-rows">${rowsHtml}</div>
      </div>
    `;
  }).join('');

  let draggedId = null;

  function moveRuneToCategory(targetCategoryId, insertBeforeId) {
    const arr = state.data.runeTypes;
    const fromIndex = arr.findIndex((r) => r.id === draggedId);
    if (fromIndex === -1) return;
    const [moved] = arr.splice(fromIndex, 1);
    moved.categoryId = targetCategoryId || null;

    if (insertBeforeId) {
      const idx = arr.findIndex((r) => r.id === insertBeforeId);
      arr.splice(idx, 0, moved);
    } else {
      let lastIdx = -1;
      arr.forEach((r, i) => { if (r.categoryId === (targetCategoryId || null)) lastIdx = i; });
      arr.splice(lastIdx + 1, 0, moved);
    }

    saveData();
    render();
  }

  container.querySelectorAll('.rune-type-row').forEach((row) => {
    row.addEventListener('dragstart', (e) => {
      draggedId = row.dataset.id;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => {
      container.querySelectorAll('.rune-type-row').forEach((r) => r.classList.remove('dragging', 'drag-over'));
      container.querySelectorAll('.rune-category-group').forEach((g) => g.classList.remove('drag-over-group'));
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (row.dataset.id === draggedId) return;
      row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      row.classList.remove('drag-over');
      const targetId = row.dataset.id;
      if (!draggedId || draggedId === targetId) return;

      const targetCategoryId = row.closest('.rune-category-group').dataset.categoryId || null;
      const dropBeforeTarget = e.clientY < row.getBoundingClientRect().top + row.offsetHeight / 2;
      moveRuneToCategory(targetCategoryId, dropBeforeTarget ? targetId : null);
    });
  });

  container.querySelectorAll('.rune-category-group').forEach((group) => {
    group.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!e.target.closest('.rune-type-row')) group.classList.add('drag-over-group');
    });
    group.addEventListener('dragleave', (e) => {
      if (!group.contains(e.relatedTarget)) group.classList.remove('drag-over-group');
    });
    group.addEventListener('drop', (e) => {
      e.preventDefault();
      group.classList.remove('drag-over-group');
      if (e.target.closest('.rune-type-row')) return; // handled by the row's own drop listener
      if (!draggedId) return;
      moveRuneToCategory(group.dataset.categoryId || null, null);
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

  function bindComboInput(selector, field) {
    container.querySelectorAll(selector).forEach((input) => {
      input.addEventListener('change', (e) => {
        const rt = state.data.runeTypes.find((r) => r.id === e.target.dataset.id);
        if (!rt) return;
        const raw = e.target.value;
        rt[field] = raw === '' ? null : Number(raw) || 0;
        saveData();
        render();
      });
    });
  }
  bindComboInput('.rt-x3-input', 'x3Price');
  bindComboInput('.rt-x9-input', 'x9Price');

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

  container.querySelectorAll('.remove-category-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      const cat = state.data.runeCategories.find((c) => c.id === id);
      const ok = await showConfirm(`Supprimer la catégorie "${cat.name}" ? Ses runes repasseront en "Sans catégorie".`, { danger: true });
      if (!ok) return;
      state.data.runeTypes.forEach((rt) => { if (rt.categoryId === id) rt.categoryId = null; });
      state.data.runeCategories = state.data.runeCategories.filter((c) => c.id !== id);
      saveData();
      render();
    });
  });

  const categorySelect = document.getElementById('rune-type-category');
  const previousValue = categorySelect.value;
  categorySelect.innerHTML = [
    '<option value="">Sans catégorie</option>',
    ...state.data.runeCategories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`),
  ].join('');
  if ([...categorySelect.options].some((o) => o.value === previousValue)) {
    categorySelect.value = previousValue;
  }
}

document.getElementById('rune-type-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('rune-type-name').value.trim();
  const price = Number(document.getElementById('rune-type-price').value);
  const categoryId = document.getElementById('rune-type-category').value || null;
  if (!name) return;
  state.data.runeTypes.push({ id: uid(), name, price: price || 0, categoryId });
  saveData();
  document.getElementById('rune-type-name').value = '';
  document.getElementById('rune-type-price').value = '';
  render();
});

document.getElementById('rune-category-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('rune-category-name').value.trim();
  if (!name) return;
  const color = RUNE_CATEGORY_PALETTE[state.data.runeCategories.length % RUNE_CATEGORY_PALETTE.length];
  state.data.runeCategories.push({ id: uid(), name, color });
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

// ---------- Craft pages factory (shared by Rune Pa, Sculpteur, and any future technique) ----------

document.querySelectorAll('[data-cancel]').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    document.getElementById(e.target.dataset.cancel).classList.add('hidden');
  });
});

function updateSortHeadersGeneric(tableId, sort) {
  document.querySelectorAll(`#${tableId} th[data-sort]`).forEach((th) => {
    th.classList.remove('sorted');
    th.removeAttribute('data-arrow');
    if (th.dataset.sort === sort.column) {
      th.classList.add('sorted');
      th.setAttribute('data-arrow', sort.direction === 'asc' ? '▲' : '▼');
    }
  });
}

function createCraftPage(cfg) {
  function items() { return state.data[cfg.itemsKey]; }
  function attemptsArr() { return state.data[cfg.attemptsKey]; }
  function sort() { return state[cfg.sortKey]; }

  function getAttemptsForItem(itemId) {
    return attemptsArr().filter((a) => a.itemId === itemId);
  }

  function computeStats(item) {
    const atts = getAttemptsForItem(item.id);
    const count = atts.length;

    let unitCraftCost = null; // informational: average cost per crafted item
    let avgCraftCost = null; // average TOTAL cost of the series, per essai — what profitability is judged against
    let avgPercent = null;
    let avgValue = null; // average TOTAL rune value obtained, per essai
    let ratio = null;
    let netGain = null;

    if (count > 0) {
      const unitCosts = atts.map(attemptUnitCraftCost).filter((c) => c !== null);
      if (unitCosts.length > 0) unitCraftCost = unitCosts.reduce((s, c) => s + c, 0) / unitCosts.length;

      avgCraftCost = atts.reduce((s, a) => s + a.craftCost, 0) / count;
      avgPercent = atts.reduce((s, a) => s + a.percent, 0) / count;
      avgValue = atts.reduce((s, a) => s + attemptValue(a), 0) / count;

      if (avgCraftCost) {
        ratio = avgValue / avgCraftCost;
        netGain = avgValue - avgCraftCost;
      }
    }

    return { unitCraftCost, avgCraftCost, count, avgPercent, avgValue, ratio, netGain };
  }

  function knownRuneTypeIds(itemId) {
    const seen = [];
    getAttemptsForItem(itemId).forEach((a) => {
      a.runes.forEach((r) => {
        if (!seen.includes(r.typeId) && state.data.runeTypes.some((rt) => rt.id === r.typeId)) {
          seen.push(r.typeId);
        }
      });
    });
    return seen;
  }

  function sortedRows() {
    const { column, direction } = sort();
    const q = state[cfg.searchKey];
    const list = q ? items().filter((it) => it.name.toLowerCase().includes(q)) : items();
    const rows = list.map((item) => ({ item, stats: computeStats(item) }));

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

  function buildDetailRowHtml(item) {
    if (state[cfg.openDetailKey] !== item.id) return '';

    const atts = getAttemptsForItem(item.id).slice().sort((a, b) => new Date(b.date) - new Date(a.date));

    const rowsHtml = atts.length === 0
      ? '<tr><td colspan="7" class="empty-state">Aucun essai enregistré</td></tr>'
      : atts.map((a) => {
        const runeDetailLines = a.runes.map((r) => {
          const rt = state.data.runeTypes.find((t) => t.id === r.typeId);
          const name = rt ? rt.name : '(rune supprimée)';
          const { n9, n3, n1 } = runeLineSplit(r);
          if (n9 === 0 && n3 === 0) {
            return `${r.qty}× ${name} (${formatKamas(r.price)}/u)`;
          }
          const parts = [];
          if (n9 > 0) parts.push(`${n9}×x9`);
          if (n3 > 0) parts.push(`${n3}×x3`);
          if (n1 > 0) parts.push(`${n1}×u`);
          return `${r.qty}× ${name} (${parts.join(' + ')})`;
        });
        const runesCell = a.runes.length === 0
          ? '—'
          : `<span class="runes-summary" title="${escapeHtml(runeDetailLines.join('\n'))}">${a.runes.length} rune${a.runes.length > 1 ? 's' : ''} ℹ</span>`;
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
            <td>${runesCell}</td>
            <td>${formatKamas(value)}</td>
            <td class="${netCls}">${netLabel}</td>
            <td class="row-actions">
              <button type="button" class="edit-attempt-btn" data-id="${a.id}">Modifier</button>
              <button type="button" class="delete-attempt-btn" data-id="${a.id}">✕</button>
            </td>
          </tr>
        `;
      }).join('');

    return `
      <tr class="detail-row">
        <td colspan="8">
          <div class="detail-panel">
            <h3>Historique — ${escapeHtml(item.name)}</h3>
            <table class="attempts-table">
              <thead>
                <tr><th>Date</th><th>Coût craft (série)</th><th>% brisage</th><th>Runes obtenues</th><th>Valeur runes</th><th>Résultat</th><th class="actions-col"></th></tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </td>
      </tr>
    `;
  }

  function openAddAttempt(itemId) {
    closeInlineForms();
    const item = items().find((i) => i.id === itemId);
    if (!item) return;

    if (state.data.runeTypes.length === 0) {
      showAlert("Ajoute d'abord au moins un type de rune dans la section 'Types de runes'.");
      return;
    }

    const form = buildAttemptForm(item.name, null, knownRuneTypeIds(itemId));
    form.querySelector('.cancel-btn').addEventListener('click', () => form.closest('tr').remove());

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const attempt = readAttemptForm(form);
      attemptsArr().push({ id: uid(), itemId, date: new Date().toISOString(), ...attempt });
      saveData();
      render();
    });

    insertInlineForm(form, {
      afterRowSelector: `#${cfg.tableBodyId} tr[data-item-id="${itemId}"]`,
      holderClass: 'add-attempt-holder',
      colspan: 8,
      focusSelector: '.attempt-craft-cost',
    });
  }

  function openEditAttempt(attemptId) {
    closeInlineForms();
    const attempt = attemptsArr().find((a) => a.id === attemptId);
    if (!attempt) return;
    const item = items().find((i) => i.id === attempt.itemId);
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

  function openEditItem(itemId) {
    closeInlineForms();
    const item = items().find((i) => i.id === itemId);
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
      afterRowSelector: `#${cfg.tableBodyId} tr[data-item-id="${itemId}"]`,
      holderClass: 'edit-item-holder',
      colspan: 8,
      focusSelector: '.edit-item-name',
    });
  }

  function isNonProfitable(stats) {
    return classifyRatio(stats.ratio).cls === 'pas-rentable';
  }

  function itemRowHtml(item, stats) {
    const cat = classifyRatio(stats.ratio);
    const ratioLabel = stats.ratio !== null ? formatPercent(stats.ratio * 100, 0) : '—';
    const netGainCls = stats.netGain === null ? '' : stats.netGain >= 0 ? 'gain-positive' : 'gain-negative';
    const netGainLabel = stats.netGain === null ? '—' : (stats.netGain >= 0 ? '+' : '') + formatKamas(stats.netGain);
    const isOpen = state[cfg.openDetailKey] === item.id;
    return `
      <tr data-item-id="${item.id}" class="clickable-row">
        <td>
          <span class="expand-arrow">${isOpen ? '▼' : '▶'}</span>
          <span class="name-link" title="Cliquer pour renommer">${escapeHtml(item.name)}</span>
        </td>
        <td title="Moyenne calculée à partir des essais — pour corriger une valeur, ouvre le détail puis 'Modifier' sur l'essai concerné">${formatKamas(stats.unitCraftCost)}</td>
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
          <button type="button" class="delete-item-btn" data-id="${item.id}">Supprimer</button>
        </td>
      </tr>
      ${buildDetailRowHtml(item)}
    `;
  }

  function renderTable() {
    const tbody = document.getElementById(cfg.tableBodyId);
    const rows = sortedRows();

    if (rows.length === 0) {
      const q = state[cfg.searchKey];
      const message = q
        ? `Aucun objet ne correspond à "${escapeHtml(q)}".`
        : 'Aucun objet pour le moment. Ajoute-en un avec "+ Nouvel objet".';
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state">${message}</td></tr>`;
    } else {
      const profitableRows = rows.filter(({ stats }) => !isNonProfitable(stats));
      const nonProfitableRows = rows.filter(({ stats }) => isNonProfitable(stats));
      const folded = state[cfg.foldKey];

      let html = profitableRows.map(({ item, stats }) => itemRowHtml(item, stats)).join('');

      if (nonProfitableRows.length > 0) {
        html += `
          <tr class="fold-toggle-row" data-fold-toggle="1">
            <td colspan="8">
              <span class="expand-arrow">${folded ? '▶' : '▼'}</span>
              📁 Objets non rentables (${nonProfitableRows.length})
            </td>
          </tr>
        `;
        if (!folded) {
          html += nonProfitableRows.map(({ item, stats }) => itemRowHtml(item, stats)).join('');
        }
      }

      tbody.innerHTML = html;
    }

    const foldToggleRow = tbody.querySelector('[data-fold-toggle]');
    if (foldToggleRow) {
      foldToggleRow.addEventListener('click', () => {
        state[cfg.foldKey] = !state[cfg.foldKey];
        renderTable();
      });
    }

    tbody.querySelectorAll('tr[data-item-id]').forEach((row) => {
      row.addEventListener('click', (e) => {
        const id = row.dataset.itemId;
        if (e.target.closest('.row-actions')) return;
        if (e.target.closest('.name-link')) {
          openEditItem(id);
          return;
        }
        state[cfg.openDetailKey] = state[cfg.openDetailKey] === id ? null : id;
        renderTable();
      });
    });
    tbody.querySelectorAll('.add-attempt-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => openAddAttempt(e.target.dataset.id));
    });
    tbody.querySelectorAll('.edit-attempt-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => openEditAttempt(e.target.dataset.id));
    });
    tbody.querySelectorAll('.delete-attempt-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        state.data[cfg.attemptsKey] = attemptsArr().filter((a) => a.id !== id);
        saveData();
        render();
      });
    });
    tbody.querySelectorAll('.delete-item-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        const item = items().find((i) => i.id === id);
        const ok = await showConfirm(`Supprimer "${item.name}" et tous ses essais associés ?`, { danger: true });
        if (!ok) return;
        state.data[cfg.itemsKey] = items().filter((i) => i.id !== id);
        state.data[cfg.attemptsKey] = attemptsArr().filter((a) => a.itemId !== id);
        if (state[cfg.openDetailKey] === id) state[cfg.openDetailKey] = null;
        saveData();
        render();
      });
    });

    updateSortHeadersGeneric(cfg.tableId, sort());
    renderTotals();
  }

  function renderTotals() {
    const atts = attemptsArr();
    const totalCost = atts.reduce((s, a) => s + a.craftCost, 0);
    const totalValue = atts.reduce((s, a) => s + attemptValue(a), 0);
    const net = totalValue - totalCost;

    document.getElementById(cfg.totalCostElId).textContent = formatKamas(totalCost);
    document.getElementById(cfg.totalValueElId).textContent = formatKamas(totalValue);

    const netEl = document.getElementById(cfg.totalNetElId);
    netEl.textContent = (net >= 0 ? '+' : '') + formatKamas(net);
    netEl.classList.remove('gain-positive', 'gain-negative');
    netEl.classList.add(net >= 0 ? 'gain-positive' : 'gain-negative');
  }

  document.getElementById(cfg.showAddItemBtnId).addEventListener('click', () => {
    document.getElementById(cfg.addItemFormId).classList.toggle('hidden');
  });

  document.getElementById(cfg.searchInputId).addEventListener('input', (e) => {
    state[cfg.searchKey] = e.target.value.trim().toLowerCase();
    renderTable();
  });

  document.getElementById(cfg.addItemFormId).addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById(cfg.itemNameInputId).value.trim();
    if (!name) return;
    items().push({ id: uid(), name });
    saveData();
    e.target.reset();
    document.getElementById(cfg.addItemFormId).classList.add('hidden');
    render();
  });

  document.querySelectorAll(`#${cfg.tableId} th[data-sort]`).forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      const s = sort();
      if (s.column === col) {
        s.direction = s.direction === 'asc' ? 'desc' : 'asc';
      } else {
        s.column = col;
        s.direction = col === 'name' ? 'asc' : 'desc';
      }
      renderTable();
    });
  });

  document.getElementById(cfg.refreshBtnId).addEventListener('click', async () => {
    const btn = document.getElementById(cfg.refreshBtnId);
    btn.disabled = true;
    state.data = await loadData();
    render();
    btn.disabled = false;
  });

  return { renderTable };
}

const runePaPage = createCraftPage({
  itemsKey: 'items',
  attemptsKey: 'attempts',
  sortKey: 'sort',
  searchKey: 'searchQuery',
  openDetailKey: 'openDetailItemId',
  tableId: 'items-table',
  tableBodyId: 'items-table-body',
  addItemFormId: 'add-item-form',
  itemNameInputId: 'item-name',
  showAddItemBtnId: 'show-add-item-btn',
  searchInputId: 'item-search',
  refreshBtnId: 'refresh-btn',
  totalCostElId: 'items-total-cost',
  totalValueElId: 'items-total-value',
  totalNetElId: 'items-total-net',
  foldKey: 'foldNonProfitable',
});

// ---------- Add attempt form ----------

function buildRuneRow(prefill) {
  const template = document.getElementById('rune-row-template');
  const node = template.content.firstElementChild.cloneNode(true);
  const searchInput = node.querySelector('.rune-type-search');
  const hiddenInput = node.querySelector('.rune-type-select');
  const optionsPanel = node.querySelector('.rune-type-options');
  const qtyInput = node.querySelector('.rune-qty');
  const priceInput = node.querySelector('.rune-price');

  let highlightIndex = -1;

  function runeName(id) {
    const rt = state.data.runeTypes.find((r) => r.id === id);
    return rt ? rt.name : '';
  }

  function getVisibleOptions() {
    return [...optionsPanel.querySelectorAll('.rune-option')];
  }

  function setHighlight(idx) {
    const opts = getVisibleOptions();
    opts.forEach((o, i) => o.classList.toggle('highlighted', i === idx));
    if (opts[idx]) opts[idx].scrollIntoView({ block: 'nearest' });
  }

  function renderOptions(filterText) {
    highlightIndex = -1;
    if (state.data.runeTypes.length === 0) {
      optionsPanel.innerHTML = '<div class="empty-state small">Aucune rune définie</div>';
      return;
    }
    const q = (filterText || '').trim().toLowerCase();
    const groups = runeCategoryGroups()
      .map((g) => ({ ...g, runes: g.runes.filter((rt) => rt.name.toLowerCase().includes(q)) }))
      .filter((g) => g.runes.length > 0);

    if (groups.length === 0) {
      optionsPanel.innerHTML = '<div class="empty-state small">Aucun résultat</div>';
      return;
    }
    optionsPanel.innerHTML = groups
      .map((g) => `
        <div class="rune-option-group-label">${g.color ? `<span class="cat-dot" style="--cat-color:${g.color}"></span>` : ''}${escapeHtml(g.name)}</div>
        ${g.runes.map((rt) => `<div class="rune-option" data-id="${rt.id}">${escapeHtml(rt.name)}</div>`).join('')}
      `)
      .join('');
  }

  function openPanel() {
    renderOptions('');
    optionsPanel.classList.remove('hidden');
  }

  function closePanel() {
    optionsPanel.classList.add('hidden');
  }

  function syncDefaultPrice() {
    const rt = state.data.runeTypes.find((r) => r.id === hiddenInput.value);
    if (rt && !priceInput.dataset.touched) priceInput.value = rt.price;
  }

  function selectRune(id) {
    hiddenInput.value = id;
    searchInput.value = runeName(id);
    closePanel();
    hiddenInput.dispatchEvent(new Event('change'));
  }

  hiddenInput.addEventListener('change', syncDefaultPrice);
  priceInput.addEventListener('input', () => { priceInput.dataset.touched = '1'; });

  searchInput.addEventListener('focus', () => {
    searchInput.select();
    openPanel();
  });
  searchInput.addEventListener('input', () => {
    hiddenInput.value = '';
    renderOptions(searchInput.value);
    optionsPanel.classList.remove('hidden');
  });
  searchInput.addEventListener('blur', () => {
    setTimeout(() => {
      closePanel();
      searchInput.value = hiddenInput.value ? runeName(hiddenInput.value) : '';
    }, 150);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (optionsPanel.classList.contains('hidden')) openPanel();
      const opts = getVisibleOptions();
      highlightIndex = Math.min(highlightIndex + 1, opts.length - 1);
      setHighlight(highlightIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightIndex = Math.max(highlightIndex - 1, 0);
      setHighlight(highlightIndex);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opts = getVisibleOptions();
      if (highlightIndex >= 0 && opts[highlightIndex]) selectRune(opts[highlightIndex].dataset.id);
    } else if (e.key === 'Escape') {
      closePanel();
      searchInput.blur();
    }
  });
  optionsPanel.addEventListener('mousedown', (e) => {
    const opt = e.target.closest('.rune-option');
    if (!opt) return;
    e.preventDefault();
    selectRune(opt.dataset.id);
  });

  if (state.data.runeTypes.length === 0) {
    searchInput.disabled = true;
    searchInput.placeholder = 'Aucune rune définie';
  }

  if (prefill) {
    hiddenInput.value = prefill.typeId;
    searchInput.value = runeName(prefill.typeId);
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

function closeInlineForms() {
  document.querySelectorAll(
    '.add-attempt-holder, .edit-item-holder, .edit-attempt-holder, .add-jewel-sale-holder, .edit-jewel-holder, .edit-jewel-sale-holder'
  ).forEach((el) => el.remove());
}

// ---------- Edit item form ----------

// ---------- Flip pages (buy → list → sell tracking: Bijoutier/Joaillo, Sculpteur/Sculto) ----------

function classifyFlipRatio(ratio) {
  if (ratio === null || ratio === undefined) return { label: 'Pas assez de données', cls: 'no-data' };
  if (ratio >= 1) return { label: 'Rentable', cls: 'rentable' };
  return { label: 'Pas rentable', cls: 'pas-rentable' };
}

function createFlipPage(cfg) {
  function items() { return state.data[cfg.itemsKey]; }
  function sales() { return state.data[cfg.salesKey]; }

  function getSalesForItem(itemId) {
    return sales().filter((s) => s.jewelId === itemId);
  }

  function saleIsSold(sale) {
    return sale.salePrice !== null && sale.salePrice !== undefined && !!sale.saleDate;
  }

  function saleDelay(sale) {
    if (!saleIsSold(sale)) return null;
    const ms = new Date(sale.saleDate) - new Date(sale.listedDate);
    return Math.round(ms / 86400000);
  }

  function saleGain(sale) {
    if (!saleIsSold(sale)) return null;
    return sale.salePrice - sale.purchasePrice;
  }

  function computeItemStats(item) {
    const itemSales = getSalesForItem(item.id);
    const count = itemSales.length;
    const soldSales = itemSales.filter(saleIsSold);
    const soldCount = soldSales.length;

    let avgPurchasePrice = null;
    let avgDelay = null;
    let totalGain = null;
    let avgRatio = null;

    if (count > 0) {
      avgPurchasePrice = itemSales.reduce((s, e) => s + e.purchasePrice, 0) / count;
    }
    if (soldCount > 0) {
      const totalPurchase = soldSales.reduce((s, e) => s + e.purchasePrice, 0);
      const totalSale = soldSales.reduce((s, e) => s + e.salePrice, 0);
      totalGain = totalSale - totalPurchase;
      avgDelay = soldSales.reduce((s, e) => s + saleDelay(e), 0) / soldCount;
      avgRatio = totalPurchase > 0 ? totalSale / totalPurchase : null;
    }

    return { count, soldCount, avgPurchasePrice, avgDelay, totalGain, avgRatio };
  }

  document.getElementById(cfg.showAddItemBtnId).addEventListener('click', () => {
    document.getElementById(cfg.addItemFormId).classList.toggle('hidden');
  });

  document.getElementById(cfg.searchInputId).addEventListener('input', (e) => {
    state[cfg.searchKey] = e.target.value.trim().toLowerCase();
    renderTable();
  });

  document.getElementById(cfg.addItemFormId).addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById(cfg.itemNameInputId).value.trim();
    const purchasePrice = Number(document.getElementById(cfg.itemPriceInputId).value) || 0;
    const listedDate = todayISODate();
    if (!name) return;
    const itemId = uid();
    items().push({ id: itemId, name });
    sales().push({ id: uid(), jewelId: itemId, purchasePrice, listedDate, salePrice: null, saleDate: null });
    saveData();
    e.target.reset();
    document.getElementById(cfg.addItemFormId).classList.add('hidden');
    render();
  });

  function sortedItemsForPage() {
    const { column, direction } = state[cfg.sortKey];
    const q = state[cfg.searchKey];
    const list = q ? items().filter((it) => it.name.toLowerCase().includes(q)) : items();
    const rows = list.map((item) => ({ item, stats: computeItemStats(item) }));

    rows.sort((a, b) => {
      let va, vb;
      switch (column) {
        case 'name':
          va = a.item.name.toLowerCase();
          vb = b.item.name.toLowerCase();
          break;
        case 'avgPurchasePrice':
          va = a.stats.avgPurchasePrice;
          vb = b.stats.avgPurchasePrice;
          break;
        case 'count':
          va = a.stats.count;
          vb = b.stats.count;
          break;
        case 'avgDelay':
          va = a.stats.avgDelay;
          vb = b.stats.avgDelay;
          break;
        case 'totalGain':
          va = a.stats.totalGain;
          vb = b.stats.totalGain;
          break;
        case 'avgRatio':
        default:
          va = a.stats.avgRatio;
          vb = b.stats.avgRatio;
          break;
      }
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (va < vb) return direction === 'asc' ? -1 : 1;
      if (va > vb) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return rows;
  }

  function itemRowHtml(item, stats) {
    const cat = classifyFlipRatio(stats.avgRatio);
    const ratioLabel = stats.avgRatio !== null ? formatPercent(stats.avgRatio * 100, 0) : '—';
    const gainCls = stats.totalGain === null ? '' : stats.totalGain >= 0 ? 'gain-positive' : 'gain-negative';
    const gainLabel = stats.totalGain === null ? '—' : (stats.totalGain >= 0 ? '+' : '') + formatKamas(stats.totalGain);
    const delayLabel = stats.avgDelay === null ? '—' : Math.round(stats.avgDelay) + ' j';
    // Tout est vendu (rien actuellement en vente) et le rendement est positif :
    // bon candidat pour relancer un achat.
    const isOpportunity = stats.count > 0 && stats.soldCount === stats.count && stats.avgRatio !== null && stats.avgRatio >= 1;
    const opportunityIcon = isOpportunity
      ? '<span class="opportunity-icon" title="Rentable et tout est vendu — plus rien en attente, bon candidat pour relancer un achat">🔁</span> '
      : '';
    const isOpen = state[cfg.openDetailKey] === item.id;
    const craftTooExpensiveCell = cfg.showCraftTooExpensive
      ? `<td class="brisage-checkbox-cell"><input type="checkbox" class="craft-too-expensive-checkbox" data-id="${item.id}" ${item.craftTooExpensive ? 'checked' : ''}></td>`
      : '';
    const rowCls = [
      'clickable-row',
      isOpportunity ? 'jewel-row-opportunity' : '',
      cfg.showCraftTooExpensive && item.craftTooExpensive ? 'jewel-row-craft-expensive' : '',
    ].filter(Boolean).join(' ');
    return `
      <tr data-item-id="${item.id}" class="${rowCls}">
        <td>
          <span class="expand-arrow">${isOpen ? '▼' : '▶'}</span>
          ${opportunityIcon}<span class="name-link" title="Cliquer pour renommer">${escapeHtml(item.name)}</span>
        </td>
        <td>${formatKamas(stats.avgPurchasePrice)}</td>
        <td>${stats.count}</td>
        <td>${delayLabel}</td>
        <td class="${gainCls}">${gainLabel}</td>
        <td>
          <span class="badge ${cat.cls}">${cat.label}</span>
          <div class="ratio-note">${stats.avgRatio !== null ? ratioLabel + " du prix d'achat" : ''}</div>
        </td>
        ${craftTooExpensiveCell}
        <td class="row-actions">
          <button type="button" class="add-sale-btn primary-btn" data-id="${item.id}">+ Nouvel achat</button>
          <button type="button" class="delete-item-btn" data-id="${item.id}">Supprimer</button>
        </td>
      </tr>
      ${buildDetailRowHtml(item)}
    `;
  }

  function renderTable() {
    const tbody = document.getElementById(cfg.tableBodyId);
    const rows = sortedItemsForPage();

    if (rows.length === 0) {
      const q = state[cfg.searchKey];
      const message = q
        ? `Aucun ${cfg.itemNoun} ne correspond à "${escapeHtml(q)}".`
        : `Aucun ${cfg.itemNoun} pour le moment. Ajoute-en un avec "${cfg.addButtonLabel}".`;
      tbody.innerHTML = `<tr><td colspan="${cfg.mainColspan || 7}" class="empty-state">${message}</td></tr>`;
    } else {
      const profitableRows = rows.filter(({ stats }) => classifyFlipRatio(stats.avgRatio).cls !== 'pas-rentable');
      const nonProfitableRows = rows.filter(({ stats }) => classifyFlipRatio(stats.avgRatio).cls === 'pas-rentable');
      const folded = state[cfg.foldKey];

      let html = profitableRows.map(({ item, stats }) => itemRowHtml(item, stats)).join('');

      if (nonProfitableRows.length > 0) {
        html += `
          <tr class="fold-toggle-row" data-fold-toggle="1">
            <td colspan="${cfg.mainColspan || 7}">
              <span class="expand-arrow">${folded ? '▶' : '▼'}</span>
              📁 ${cfg.itemNounPluralCap} non rentables (${nonProfitableRows.length})
            </td>
          </tr>
        `;
        if (!folded) {
          html += nonProfitableRows.map(({ item, stats }) => itemRowHtml(item, stats)).join('');
        }
      }

      tbody.innerHTML = html;
    }

    const foldToggleRow = tbody.querySelector('[data-fold-toggle]');
    if (foldToggleRow) {
      foldToggleRow.addEventListener('click', () => {
        state[cfg.foldKey] = !state[cfg.foldKey];
        renderTable();
      });
    }

    tbody.querySelectorAll('tr[data-item-id]').forEach((row) => {
      row.addEventListener('click', (e) => {
        const id = row.dataset.itemId;
        if (e.target.closest('.row-actions')) return;
        // Replacing the row's DOM mid-click (via renderTable()) stops the checkbox's own
        // pending 'change' event from ever firing, so never re-render in reaction to a
        // click that landed on it — let its own change listener handle that.
        if (e.target.closest('.craft-too-expensive-checkbox')) return;
        if (e.target.closest('.name-link')) {
          openEditItemForm(id);
          return;
        }
        state[cfg.openDetailKey] = state[cfg.openDetailKey] === id ? null : id;
        renderTable();
      });
    });
    tbody.querySelectorAll('.add-sale-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => openAddSaleForm(e.target.dataset.id));
    });
    tbody.querySelectorAll('.edit-jewel-sale-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => openEditSaleForm(e.target.dataset.id));
    });
    tbody.querySelectorAll('.delete-jewel-sale-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        state.data[cfg.salesKey] = sales().filter((s) => s.id !== id);
        saveData();
        render();
      });
    });
    tbody.querySelectorAll('.delete-item-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        const item = items().find((i) => i.id === id);
        const ok = await showConfirm(`Supprimer "${item.name}" et tous ses achats associés ?`, { danger: true });
        if (!ok) return;
        state.data[cfg.itemsKey] = items().filter((i) => i.id !== id);
        state.data[cfg.salesKey] = sales().filter((s) => s.jewelId !== id);
        if (state[cfg.openDetailKey] === id) state[cfg.openDetailKey] = null;
        saveData();
        render();
      });
    });
    tbody.querySelectorAll('.craft-too-expensive-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => {
        const item = items().find((i) => i.id === e.target.dataset.id);
        if (!item) return;
        item.craftTooExpensive = e.target.checked;
        saveData();
        renderTable();
      });
    });

    updateSortHeadersGeneric(cfg.tableId, state[cfg.sortKey]);
    renderTotals();
  }

  document.querySelectorAll(`#${cfg.tableId} th[data-sort]`).forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      const sort = state[cfg.sortKey];
      if (sort.column === col) {
        sort.direction = sort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        sort.column = col;
        sort.direction = col === 'name' ? 'asc' : 'desc';
      }
      renderTable();
    });
  });

  function buildSaleForm(itemName, prefillSale) {
    const template = document.getElementById(cfg.entryTemplateId);
    const form = template.content.firstElementChild.cloneNode(true);
    form.querySelector('.jewel-name-label').textContent = itemName;
    form.querySelector('.jewel-entry-form-title').textContent = prefillSale ? "Modifier l'achat" : 'Nouvel achat';

    if (prefillSale) {
      form.querySelector('.jewel-purchase-price').value = prefillSale.purchasePrice;
      if (prefillSale.salePrice !== null && prefillSale.salePrice !== undefined) {
        form.querySelector('.jewel-sale-price').value = prefillSale.salePrice;
      }
    }

    return form;
  }

  // Ni la date de mise en vente ni la date de vente ne se saisissent : la première
  // passe à aujourd'hui à la création puis reste figée, la seconde passe à aujourd'hui
  // dès qu'un prix de vente est renseigné pour la première fois et reste figée ensuite
  // (on ne les remet pas à jour si on corrige juste un prix sur une ligne existante).
  function readSaleForm(form, existingSale) {
    const purchasePrice = Number(form.querySelector('.jewel-purchase-price').value) || 0;
    const listedDate = (existingSale && existingSale.listedDate) || todayISODate();
    const salePriceRaw = form.querySelector('.jewel-sale-price').value;
    const salePrice = salePriceRaw === '' ? null : Number(salePriceRaw);
    const saleDate = salePrice === null ? null : (existingSale && existingSale.saleDate) || todayISODate();
    return { purchasePrice, listedDate, salePrice, saleDate };
  }

  function openAddSaleForm(itemId) {
    closeInlineForms();
    const item = items().find((i) => i.id === itemId);
    if (!item) return;

    const form = buildSaleForm(item.name);
    form.querySelector('.cancel-btn').addEventListener('click', () => form.closest('tr').remove());

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const sale = readSaleForm(form);
      sales().push({ id: uid(), jewelId: itemId, ...sale });
      saveData();
      render();
    });

    insertInlineForm(form, {
      afterRowSelector: `#${cfg.tableBodyId} tr[data-item-id="${itemId}"]`,
      holderClass: 'add-jewel-sale-holder',
      colspan: cfg.mainColspan || 7,
      focusSelector: '.jewel-purchase-price',
    });
  }

  function openEditSaleForm(saleId) {
    closeInlineForms();
    const sale = sales().find((s) => s.id === saleId);
    if (!sale) return;
    const item = items().find((i) => i.id === sale.jewelId);
    if (!item) return;

    const form = buildSaleForm(item.name, sale);
    form.querySelector('.cancel-btn').addEventListener('click', () => form.closest('tr').remove());

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      Object.assign(sale, readSaleForm(form, sale));
      saveData();
      render();
    });

    insertInlineForm(form, {
      afterRowSelector: `.jewel-sales-table tr[data-sale-id="${saleId}"]`,
      holderClass: 'edit-jewel-sale-holder',
      colspan: 8,
      focusSelector: '.jewel-purchase-price',
    });
  }

  function openEditItemForm(itemId) {
    closeInlineForms();
    const item = items().find((i) => i.id === itemId);
    if (!item) return;

    const template = document.getElementById(cfg.editTemplateId);
    const form = template.content.firstElementChild.cloneNode(true);
    form.querySelector('.jewel-name-label').textContent = item.name;
    form.querySelector('.edit-jewel-name').value = item.name;

    form.querySelector('.cancel-btn').addEventListener('click', () => form.closest('tr').remove());

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = form.querySelector('.edit-jewel-name').value.trim();
      if (!name) return;
      item.name = name;
      saveData();
      render();
    });

    insertInlineForm(form, {
      afterRowSelector: `#${cfg.tableBodyId} tr[data-item-id="${itemId}"]`,
      holderClass: 'edit-jewel-holder',
      colspan: cfg.mainColspan || 7,
      focusSelector: '.edit-jewel-name',
    });
  }

  function buildDetailRowHtml(item) {
    if (state[cfg.openDetailKey] !== item.id) return '';

    const itemSales = getSalesForItem(item.id).slice().sort((a, b) => new Date(b.listedDate) - new Date(a.listedDate));

    const rowsHtml = itemSales.length === 0
      ? '<tr><td colspan="8" class="empty-state">Aucun achat enregistré</td></tr>'
      : itemSales.map((s) => {
        const sold = saleIsSold(s);
        const gain = saleGain(s);
        const delay = saleDelay(s);
        const gainCls = gain === null ? '' : gain >= 0 ? 'gain-positive' : 'gain-negative';
        const gainLabel = gain === null ? '—' : (gain >= 0 ? '+' : '') + formatKamas(gain);
        const statusBadge = sold
          ? '<span class="badge rentable">Vendu</span>'
          : '<span class="badge no-data">En vente</span>';
        return `
          <tr data-sale-id="${s.id}">
            <td>${new Date(s.listedDate).toLocaleDateString('fr-FR')}</td>
            <td>${formatKamas(s.purchasePrice)}</td>
            <td>${statusBadge}</td>
            <td>${s.saleDate ? new Date(s.saleDate).toLocaleDateString('fr-FR') : '—'}</td>
            <td>${sold ? formatKamas(s.salePrice) : '—'}</td>
            <td>${delay === null ? '—' : delay + ' j'}</td>
            <td class="${gainCls}">${gainLabel}</td>
            <td class="row-actions">
              <button type="button" class="edit-jewel-sale-btn" data-id="${s.id}">Modifier</button>
              <button type="button" class="delete-jewel-sale-btn" data-id="${s.id}">✕</button>
            </td>
          </tr>
        `;
      }).join('');

    return `
      <tr class="detail-row">
        <td colspan="${cfg.mainColspan || 7}">
          <div class="detail-panel">
            <h3>Historique — ${escapeHtml(item.name)}</h3>
            <table class="attempts-table jewel-sales-table">
              <thead>
                <tr><th>Mise en vente</th><th>Prix d'achat</th><th>Statut</th><th>Date de vente</th><th>Prix de vente</th><th>Délai</th><th>Gain</th><th class="actions-col"></th></tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </td>
      </tr>
    `;
  }

  function renderTotals() {
    const totalInvested = sales().reduce((s, e) => s + e.purchasePrice, 0);
    const totalCollected = sales().reduce((s, e) => s + (saleIsSold(e) ? e.salePrice : 0), 0);
    const net = totalCollected - totalInvested;

    document.getElementById(cfg.totalInvestedElId).textContent = formatKamas(totalInvested);
    document.getElementById(cfg.totalCollectedElId).textContent = formatKamas(totalCollected);

    const netEl = document.getElementById(cfg.totalNetElId);
    netEl.textContent = (net >= 0 ? '+' : '') + formatKamas(net);
    netEl.classList.remove('gain-positive', 'gain-negative');
    netEl.classList.add(net >= 0 ? 'gain-positive' : 'gain-negative');
  }

  document.getElementById(cfg.refreshBtnId).addEventListener('click', async () => {
    const btn = document.getElementById(cfg.refreshBtnId);
    btn.disabled = true;
    state.data = await loadData();
    render();
    btn.disabled = false;
  });

  return { renderTable };
}

const jewelryPage = createFlipPage({
  itemsKey: 'jewels',
  salesKey: 'jewelSales',
  sortKey: 'jewelrySort',
  searchKey: 'jewelrySearchQuery',
  openDetailKey: 'openJewelDetailId',
  foldKey: 'jewelryFoldNonProfitable',
  tableId: 'jewelry-table',
  tableBodyId: 'jewelry-table-body',
  addItemFormId: 'add-jewel-form',
  itemNameInputId: 'jewel-name',
  itemPriceInputId: 'jewel-purchase-price',
  showAddItemBtnId: 'show-add-jewel-btn',
  searchInputId: 'jewel-search',
  refreshBtnId: 'jewelry-refresh-btn',
  entryTemplateId: 'jewel-entry-template',
  editTemplateId: 'edit-jewel-template',
  totalInvestedElId: 'jewelry-total-invested',
  totalCollectedElId: 'jewelry-total-collected',
  totalNetElId: 'jewelry-total-net',
  itemNoun: 'bijou',
  itemNounPluralCap: 'Bijoux',
  addButtonLabel: '+ Nouveau bijou',
  showCraftTooExpensive: true,
  mainColspan: 8,
});

const sculptoPage = createFlipPage({
  itemsKey: 'sculptoItems',
  salesKey: 'sculptoSales',
  sortKey: 'sculptoSort',
  searchKey: 'sculptoSearchQuery',
  openDetailKey: 'openSculptoDetailId',
  foldKey: 'sculptoFoldNonProfitable',
  tableId: 'sculpto-table',
  tableBodyId: 'sculpto-table-body',
  addItemFormId: 'add-sculpto-form',
  itemNameInputId: 'sculpto-name',
  itemPriceInputId: 'sculpto-purchase-price',
  showAddItemBtnId: 'show-add-sculpto-btn',
  searchInputId: 'sculpto-search',
  refreshBtnId: 'sculpto-refresh-btn',
  entryTemplateId: 'sculpto-entry-template',
  editTemplateId: 'edit-sculpto-template',
  totalInvestedElId: 'sculpto-total-invested',
  totalCollectedElId: 'sculpto-total-collected',
  totalNetElId: 'sculpto-total-net',
  itemNoun: 'objet',
  itemNounPluralCap: 'Objets',
  addButtonLabel: '+ Nouvel objet',
});

// ---------- Brisage (simple, manually-entered items — no essai tracking) ----------

document.getElementById('show-add-brisage-btn').addEventListener('click', () => {
  document.getElementById('add-brisage-form').classList.toggle('hidden');
});

document.getElementById('brisage-search').addEventListener('input', (e) => {
  state.brisageSearchQuery = e.target.value.trim().toLowerCase();
  renderBrisageTable();
});

document.getElementById('add-brisage-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('brisage-name').value.trim();
  if (!name) return;
  state.data.brisageItems.push({
    id: uid(),
    name,
    purchasePrice: Number(document.getElementById('brisage-purchase-price').value) || 0,
    craftPrice: Number(document.getElementById('brisage-craft-price').value) || 0,
    profitabilityPercent: Number(document.getElementById('brisage-profitability-percent').value) || 0,
    breakPercent: Number(document.getElementById('brisage-break-percent').value) || 0,
    stillProfitable: document.getElementById('brisage-still-profitable').checked,
  });
  saveData();
  e.target.reset();
  document.getElementById('brisage-still-profitable').checked = true;
  document.getElementById('add-brisage-form').classList.add('hidden');
  render();
});

document.querySelectorAll('#brisage-table th[data-sort]').forEach((th) => {
  th.addEventListener('click', () => {
    const col = th.dataset.sort;
    const sort = state.brisageSort;
    if (sort.column === col) {
      sort.direction = sort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      sort.column = col;
      sort.direction = col === 'name' ? 'asc' : 'desc';
    }
    renderBrisageTable();
  });
});

document.getElementById('brisage-refresh-btn').addEventListener('click', async () => {
  const btn = document.getElementById('brisage-refresh-btn');
  btn.disabled = true;
  state.data = await loadData();
  render();
  btn.disabled = false;
});

function sortedBrisageItems() {
  const { column, direction } = state.brisageSort;
  const q = state.brisageSearchQuery;
  const list = q ? state.data.brisageItems.filter((it) => it.name.toLowerCase().includes(q)) : state.data.brisageItems;
  const rows = list.slice();

  rows.sort((a, b) => {
    let va = a[column];
    let vb = b[column];
    if (column === 'name') {
      va = a.name.toLowerCase();
      vb = b.name.toLowerCase();
    } else if (column === 'stillProfitable') {
      va = a.stillProfitable ? 1 : 0;
      vb = b.stillProfitable ? 1 : 0;
    }
    if (va < vb) return direction === 'asc' ? -1 : 1;
    if (va > vb) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  return rows;
}

function brisageRowHtml(item) {
  return `
    <tr data-id="${item.id}" class="${item.stillProfitable ? '' : 'brisage-row-not-profitable'}">
      <td><input type="text" class="brisage-field brisage-name-input" data-id="${item.id}" data-field="name" value="${escapeHtml(item.name)}"></td>
      <td><input type="number" class="brisage-field" min="0" step="1" data-id="${item.id}" data-field="purchasePrice" value="${item.purchasePrice}"></td>
      <td><input type="number" class="brisage-field" min="0" step="1" data-id="${item.id}" data-field="craftPrice" value="${item.craftPrice}"></td>
      <td><input type="number" class="brisage-field" min="0" step="0.01" data-id="${item.id}" data-field="profitabilityPercent" value="${item.profitabilityPercent}"> %</td>
      <td><input type="number" class="brisage-field" min="0" step="0.01" data-id="${item.id}" data-field="breakPercent" value="${item.breakPercent}"> %</td>
      <td class="brisage-checkbox-cell">
        <input type="checkbox" class="brisage-profitable-checkbox" data-id="${item.id}" ${item.stillProfitable ? 'checked' : ''}>
      </td>
      <td class="row-actions">
        <button type="button" class="delete-brisage-btn" data-id="${item.id}">Supprimer</button>
      </td>
    </tr>
  `;
}

function renderBrisageTable() {
  const tbody = document.getElementById('brisage-table-body');
  const rows = sortedBrisageItems();

  if (rows.length === 0) {
    const q = state.brisageSearchQuery;
    const message = q
      ? `Aucun objet ne correspond à "${escapeHtml(q)}".`
      : 'Aucun objet pour le moment. Ajoute-en un avec "+ Nouvel objet".';
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">${message}</td></tr>`;
  } else {
    tbody.innerHTML = rows.map(brisageRowHtml).join('');
  }

  tbody.querySelectorAll('.brisage-field').forEach((input) => {
    input.addEventListener('change', (e) => {
      const item = state.data.brisageItems.find((it) => it.id === e.target.dataset.id);
      if (!item) return;
      const field = e.target.dataset.field;
      if (field === 'name') {
        const name = e.target.value.trim();
        if (!name) { e.target.value = item.name; return; }
        item.name = name;
      } else {
        item[field] = Number(e.target.value) || 0;
      }
      saveData();
    });
  });

  tbody.querySelectorAll('.brisage-profitable-checkbox').forEach((checkbox) => {
    checkbox.addEventListener('change', (e) => {
      const item = state.data.brisageItems.find((it) => it.id === e.target.dataset.id);
      if (!item) return;
      item.stillProfitable = e.target.checked;
      saveData();
      renderBrisageTable();
    });
  });

  tbody.querySelectorAll('.delete-brisage-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      const item = state.data.brisageItems.find((it) => it.id === id);
      const ok = await showConfirm(`Supprimer "${item.name}" ?`, { danger: true });
      if (!ok) return;
      state.data.brisageItems = state.data.brisageItems.filter((it) => it.id !== id);
      saveData();
      renderBrisageTable();
    });
  });

  updateSortHeadersGeneric('brisage-table', state.brisageSort);
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
  runePaPage.renderTable();
  jewelryPage.renderTable();
  sculptoPage.renderTable();
  renderBrisageTable();
}

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
    ...state.data,
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
