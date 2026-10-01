// Outil de suivi de rentabilité du brisage - données partagées via Supabase (Postgres),
// pour être accessibles depuis plusieurs appareils avec le même lien.

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
    return { runeTypes: [], runeCategories: [], items: [], attempts: [], sculptorItems: [], sculptorAttempts: [], forgeronItems: [], forgeronAttempts: [], jewels: [], jewelSales: [], sculptoItems: [], sculptoSales: [], brisageItems: [], runeTransItems: [], runeTransSales: [], jewelryLastWindow: { min: null, max: null }, sculptoLastWindow: { min: null, max: null }, runeTransLastWindow: { min: null, max: null } };
  }

  const d = data.data || {};
  return {
    // runeTypes/runeCategories: the "Types de runes" page that used these was removed,
    // but keep reading them back so a save doesn't erase that leftover data.
    runeTypes: d.runeTypes || [],
    runeCategories: d.runeCategories || [],
    // items/attempts: the "Rune Pa" page that used these was removed, but keep reading
    // them back so a save doesn't erase that leftover data.
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
    runeTransItems: d.runeTransItems || [],
    runeTransSales: d.runeTransSales || [],
    jewelryLastWindow: d.jewelryLastWindow || { min: null, max: null },
    sculptoLastWindow: d.sculptoLastWindow || { min: null, max: null },
    runeTransLastWindow: d.runeTransLastWindow || { min: null, max: null },
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
  // runeTypes/runeCategories (Types de runes), items/attempts (Rune Pa), and
  // sculptorItems/sculptorAttempts/forgeronItems/forgeronAttempts are kept here (even
  // though those pages were removed) so a save never strips that data out of the
  // shared Supabase row — loadData() still reads them back in on every load.
  data: { runeTypes: [], runeCategories: [], items: [], attempts: [], sculptorItems: [], sculptorAttempts: [], forgeronItems: [], forgeronAttempts: [], jewels: [], jewelSales: [], sculptoItems: [], sculptoSales: [], brisageItems: [], runeTransItems: [], runeTransSales: [], jewelryLastWindow: { min: null, max: null }, sculptoLastWindow: { min: null, max: null }, runeTransLastWindow: { min: null, max: null } },
  jewelrySort: { column: 'avgRatio', direction: 'desc' },
  openJewelDetailId: null,
  jewelrySearchQuery: '',
  jewelryFoldNonProfitable: true,
  jewelryFoldArchived: true,
  sculptoSort: { column: 'avgRatio', direction: 'desc' },
  openSculptoDetailId: null,
  sculptoSearchQuery: '',
  sculptoFoldNonProfitable: true,
  sculptoFoldArchived: true,
  runeTransSort: { column: 'avgRatio', direction: 'desc' },
  openRuneTransDetailId: null,
  runeTransSearchQuery: '',
  runeTransFoldNonProfitable: true,
  runeTransFoldArchived: true,
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
    '.add-jewel-sale-holder, .edit-jewel-holder, .edit-jewel-sale-holder'
  ).forEach((el) => el.remove());
}

// ---------- Flip pages (buy → list → sell tracking: Bijoutier/Joaillo, Sculpteur/Sculto, Rune trans) ----------

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

  // "Dernière fenêtre testée" — a manually-entered level min/max, purely a note to self
  // about which level window on the market was last checked. Not derived from anything.
  function syncLastWindowInputs() {
    if (!cfg.lastWindowKey) return;
    const current = state.data[cfg.lastWindowKey] || {};
    const minInput = document.getElementById(cfg.levelMinInputId);
    const maxInput = document.getElementById(cfg.levelMaxInputId);
    if (document.activeElement !== minInput) minInput.value = current.min ?? '';
    if (document.activeElement !== maxInput) maxInput.value = current.max ?? '';
  }

  if (cfg.lastWindowKey) {
    const minInput = document.getElementById(cfg.levelMinInputId);
    const maxInput = document.getElementById(cfg.levelMaxInputId);
    const saveWindow = () => {
      state.data[cfg.lastWindowKey] = {
        min: minInput.value === '' ? null : Number(minInput.value),
        max: maxInput.value === '' ? null : Number(maxInput.value),
      };
      saveData();
    };
    minInput.addEventListener('change', saveWindow);
    maxInput.addEventListener('change', saveWindow);
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
      item.archived ? 'jewel-row-archived' : '',
    ].filter(Boolean).join(' ');
    const actionsHtml = item.archived
      ? `
        <button type="button" class="unarchive-item-btn" data-id="${item.id}">Désarchiver</button>
        <button type="button" class="delete-item-btn" data-id="${item.id}">Supprimer</button>
      `
      : `
        <button type="button" class="add-sale-btn primary-btn" data-id="${item.id}">+ Nouvel achat</button>
        <button type="button" class="archive-item-btn" data-id="${item.id}">Archiver</button>
        <button type="button" class="delete-item-btn" data-id="${item.id}">Supprimer</button>
      `;
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
        <td class="row-actions">${actionsHtml}</td>
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
      const archivedRows = rows.filter(({ item }) => item.archived);
      const activeRows = rows.filter(({ item }) => !item.archived);
      const profitableRows = activeRows.filter(({ stats }) => classifyFlipRatio(stats.avgRatio).cls !== 'pas-rentable');
      const nonProfitableRows = activeRows.filter(({ stats }) => classifyFlipRatio(stats.avgRatio).cls === 'pas-rentable');
      const folded = state[cfg.foldKey];
      const archiveFolded = state[cfg.archiveFoldKey];

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

      if (archivedRows.length > 0) {
        html += `
          <tr class="fold-toggle-row" data-archive-fold-toggle="1">
            <td colspan="${cfg.mainColspan || 7}">
              <span class="expand-arrow">${archiveFolded ? '▶' : '▼'}</span>
              🗄️ ${cfg.itemNounPluralCap} archivés (${archivedRows.length})
            </td>
          </tr>
        `;
        if (!archiveFolded) {
          html += archivedRows.map(({ item, stats }) => itemRowHtml(item, stats)).join('');
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

    const archiveFoldToggleRow = tbody.querySelector('[data-archive-fold-toggle]');
    if (archiveFoldToggleRow) {
      archiveFoldToggleRow.addEventListener('click', () => {
        state[cfg.archiveFoldKey] = !state[cfg.archiveFoldKey];
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
    tbody.querySelectorAll('.archive-item-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const item = items().find((i) => i.id === e.target.dataset.id);
        if (!item) return;
        item.archived = true;
        saveData();
        renderTable();
      });
    });
    tbody.querySelectorAll('.unarchive-item-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const item = items().find((i) => i.id === e.target.dataset.id);
        if (!item) return;
        item.archived = false;
        saveData();
        renderTable();
      });
    });

    updateSortHeadersGeneric(cfg.tableId, state[cfg.sortKey]);
    renderTotals();
    syncLastWindowInputs();
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
  archiveFoldKey: 'jewelryFoldArchived',
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
  lastWindowKey: 'jewelryLastWindow',
  levelMinInputId: 'jewelry-level-min',
  levelMaxInputId: 'jewelry-level-max',
});

const sculptoPage = createFlipPage({
  itemsKey: 'sculptoItems',
  salesKey: 'sculptoSales',
  sortKey: 'sculptoSort',
  searchKey: 'sculptoSearchQuery',
  openDetailKey: 'openSculptoDetailId',
  foldKey: 'sculptoFoldNonProfitable',
  archiveFoldKey: 'sculptoFoldArchived',
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
  showCraftTooExpensive: true,
  mainColspan: 8,
  lastWindowKey: 'sculptoLastWindow',
  levelMinInputId: 'sculpto-level-min',
  levelMaxInputId: 'sculpto-level-max',
});

const runeTransPage = createFlipPage({
  itemsKey: 'runeTransItems',
  salesKey: 'runeTransSales',
  sortKey: 'runeTransSort',
  searchKey: 'runeTransSearchQuery',
  openDetailKey: 'openRuneTransDetailId',
  foldKey: 'runeTransFoldNonProfitable',
  archiveFoldKey: 'runeTransFoldArchived',
  tableId: 'runetrans-table',
  tableBodyId: 'runetrans-table-body',
  addItemFormId: 'add-runetrans-form',
  itemNameInputId: 'runetrans-name',
  itemPriceInputId: 'runetrans-craft-cost',
  showAddItemBtnId: 'show-add-runetrans-btn',
  searchInputId: 'runetrans-search',
  refreshBtnId: 'runetrans-refresh-btn',
  entryTemplateId: 'runetrans-entry-template',
  editTemplateId: 'edit-runetrans-template',
  totalInvestedElId: 'runetrans-total-invested',
  totalCollectedElId: 'runetrans-total-collected',
  totalNetElId: 'runetrans-total-net',
  itemNoun: 'objet',
  itemNounPluralCap: 'Objets',
  addButtonLabel: '+ Nouvel objet',
  showCraftTooExpensive: true,
  mainColspan: 8,
  lastWindowKey: 'runeTransLastWindow',
  levelMinInputId: 'runetrans-level-min',
  levelMaxInputId: 'runetrans-level-max',
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
  const stillProfitable = document.getElementById('brisage-still-profitable').checked;
  state.data.brisageItems.push({
    id: uid(),
    name,
    purchasePrice: Number(document.getElementById('brisage-purchase-price').value) || 0,
    craftPrice: Number(document.getElementById('brisage-craft-price').value) || 0,
    profitabilityPercent: Number(document.getElementById('brisage-profitability-percent').value) || 0,
    breakPercent: Number(document.getElementById('brisage-break-percent').value) || 0,
    stillProfitable,
    uncheckedSince: stillProfitable ? null : todayISODate(),
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

const BRISAGE_RECHECK_DAYS = 7;

// Unchecking "encore rentable" is meant as a temporary flag (e.g. a price spike) — it
// re-checks itself automatically after a week to prompt giving it another look. Runs on
// every render (there's no server-side cron on a static site), so it takes effect the
// next time anyone has the page open after the 7 days elapse, not the instant they pass.
function recheckBrisageProfitableFlags() {
  let changed = false;
  state.data.brisageItems.forEach((item) => {
    if (!item.stillProfitable && item.uncheckedSince) {
      const ageDays = (Date.now() - new Date(item.uncheckedSince).getTime()) / 86400000;
      if (ageDays >= BRISAGE_RECHECK_DAYS) {
        item.stillProfitable = true;
        item.uncheckedSince = null;
        changed = true;
      }
    }
  });
  if (changed) saveData();
}

function brisageProfitableAgeNote(item) {
  if (item.stillProfitable || !item.uncheckedSince) return '';
  const ageDays = Math.floor((Date.now() - new Date(item.uncheckedSince).getTime()) / 86400000);
  const remaining = Math.max(0, BRISAGE_RECHECK_DAYS - ageDays);
  return `<div class="ratio-note">Décoché ${ageDays === 0 ? "aujourd'hui" : `il y a ${ageDays} j`} (recoché dans ${remaining} j)</div>`;
}

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
        ${brisageProfitableAgeNote(item)}
      </td>
      <td class="row-actions">
        <button type="button" class="delete-brisage-btn" data-id="${item.id}">Supprimer</button>
      </td>
    </tr>
  `;
}

function renderBrisageTable() {
  recheckBrisageProfitableFlags();
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
      item.uncheckedSince = e.target.checked ? null : todayISODate();
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
  closeInlineForms();
  jewelryPage.renderTable();
  sculptoPage.renderTable();
  runeTransPage.renderTable();
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
