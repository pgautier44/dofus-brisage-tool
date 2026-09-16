// Outil de suivi de rentabilité du brisage - stockage 100% local (localStorage)

const STORAGE_KEY = 'dofusBrisageData';

const RATIO_THRESHOLDS = {
  rentable: 1.2,
  relRentable: 1.0,
  relPasRentable: 0.8,
};

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { runeTypes: [], items: [], attempts: [] };
    const parsed = JSON.parse(raw);
    return {
      runeTypes: parsed.runeTypes || [],
      items: parsed.items || [],
      attempts: parsed.attempts || [],
    };
  } catch (e) {
    console.error('Impossible de lire les données locales', e);
    return { runeTypes: [], items: [], attempts: [] };
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  } catch (e) {
    console.error('Impossible de sauvegarder les données locales', e);
    alert("Erreur : impossible d'enregistrer les données (stockage local plein ou indisponible).");
  }
}

const state = {
  data: loadData(),
  sort: { column: 'ratio', direction: 'desc' },
  openDetailItemId: null,
};

function formatKamas(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Math.round(n).toLocaleString('fr-FR') + ' K';
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

function computeItemStats(item) {
  const unitCraftCost = item.craftQty > 0 ? item.craftCost / item.craftQty : null;
  const attempts = getItemAttempts(item.id);
  const count = attempts.length;

  let avgPercent = null;
  let avgValue = null;
  let ratio = null;

  if (count > 0) {
    avgPercent = attempts.reduce((s, a) => s + a.percent, 0) / count;
    avgValue = attempts.reduce((s, a) => s + attemptValue(a), 0) / count;
    if (unitCraftCost) ratio = avgValue / unitCraftCost;
  }

  return { unitCraftCost, count, avgPercent, avgValue, ratio };
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
  state.data.runeTypes.forEach((rt) => {
    const row = document.createElement('div');
    row.className = 'rune-type-row';
    row.innerHTML = `
      <span class="rt-name">${escapeHtml(rt.name)}</span>
      <input type="number" min="0" step="1" value="${rt.price}" class="rt-price-input" data-id="${rt.id}">
      <span>kamas</span>
      <button type="button" class="remove-rt-btn" data-id="${rt.id}">Supprimer</button>
    `;
    container.appendChild(row);
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
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const usedInAttempt = state.data.attempts.some((a) => a.runes.some((r) => r.typeId === id));
      if (usedInAttempt && !confirm('Cette rune est utilisée dans des essais existants. La supprimer du catalogue ne modifie pas l\'historique. Continuer ?')) {
        return;
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

// ---------- Items ----------

document.getElementById('show-add-item-btn').addEventListener('click', () => {
  document.getElementById('add-item-form').classList.toggle('hidden');
});

document.querySelectorAll('[data-cancel]').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    document.getElementById(e.target.dataset.cancel).classList.add('hidden');
  });
});

document.getElementById('add-item-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('item-name').value.trim();
  const craftCost = Number(document.getElementById('item-craft-cost').value);
  const craftQty = Number(document.getElementById('item-craft-qty').value);
  if (!name || craftQty <= 0) return;
  state.data.items.push({ id: uid(), name, craftCost, craftQty });
  saveData();
  e.target.reset();
  document.getElementById('item-craft-qty').value = 1;
  document.getElementById('add-item-form').classList.add('hidden');
  render();
});

function sortedItems() {
  const { column, direction } = state.sort;
  const rows = state.data.items.map((item) => ({ item, stats: computeItemStats(item) }));

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
      default:
        va = a.stats.ratio;
        vb = b.stats.ratio;
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
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Aucun objet pour le moment. Ajoute-en un avec "+ Nouvel objet".</td></tr>';
  } else {
    tbody.innerHTML = rows.map(({ item, stats }) => {
      const cat = classifyRatio(stats.ratio);
      const ratioLabel = stats.ratio !== null ? formatPercent(stats.ratio * 100, 0) : '—';
      return `
        <tr data-item-id="${item.id}">
          <td>${escapeHtml(item.name)}</td>
          <td>${formatKamas(stats.unitCraftCost)}</td>
          <td>${stats.count}</td>
          <td>${formatPercent(stats.avgPercent)}</td>
          <td>${formatKamas(stats.avgValue)}</td>
          <td><span class="badge ${cat.cls}" title="Ratio valeur/coût : ${ratioLabel}">${cat.label}</span></td>
          <td class="row-actions">
            <button type="button" class="add-attempt-btn" data-id="${item.id}">+ Essai</button>
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
  tbody.querySelectorAll('.toggle-detail-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      state.openDetailItemId = state.openDetailItemId === id ? null : id;
      renderDetail();
    });
  });
  tbody.querySelectorAll('.delete-item-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const item = state.data.items.find((i) => i.id === id);
      if (!confirm(`Supprimer "${item.name}" et tous ses essais associés ?`)) return;
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
    priceInput.value = prefill.price;
    priceInput.dataset.touched = '1';
  } else {
    syncDefaultPrice();
  }

  node.querySelector('.remove-rune-row-btn').addEventListener('click', () => node.remove());

  return node;
}

function openAddAttemptForm(itemId) {
  closeAddAttemptForm();
  const item = state.data.items.find((i) => i.id === itemId);
  if (!item) return;

  if (state.data.runeTypes.length === 0) {
    alert("Ajoute d'abord au moins un type de rune dans la section 'Types de runes'.");
    return;
  }

  const template = document.getElementById('add-attempt-template');
  const form = template.content.firstElementChild.cloneNode(true);
  form.dataset.itemId = itemId;
  form.querySelector('.item-name-label').textContent = item.name;

  const rowsContainer = form.querySelector('.attempt-runes-rows');
  rowsContainer.appendChild(buildRuneRow());

  form.querySelector('.add-rune-row-btn').addEventListener('click', () => {
    rowsContainer.appendChild(buildRuneRow());
  });

  form.querySelector('.cancel-btn').addEventListener('click', () => form.remove());

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const percent = Number(form.querySelector('.attempt-percent').value);
    const runes = [...rowsContainer.querySelectorAll('.rune-row')].map((row) => ({
      typeId: row.querySelector('.rune-type-select').value,
      qty: Number(row.querySelector('.rune-qty').value) || 0,
      price: Number(row.querySelector('.rune-price').value) || 0,
    })).filter((r) => r.typeId && r.qty > 0);

    state.data.attempts.push({
      id: uid(),
      itemId,
      date: new Date().toISOString(),
      percent,
      runes,
    });
    saveData();
    render();
  });

  // Insert the form right after the item's row in the table
  const row = document.querySelector(`#items-table-body tr[data-item-id="${itemId}"]`);
  const holder = document.createElement('tr');
  holder.className = 'add-attempt-holder';
  const td = document.createElement('td');
  td.colSpan = 7;
  td.appendChild(form);
  holder.appendChild(td);
  row.after(holder);
}

function closeAddAttemptForm() {
  document.querySelectorAll('.add-attempt-holder').forEach((el) => el.remove());
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
    ? '<tr><td colspan="4" class="empty-state">Aucun essai enregistré</td></tr>'
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
      return `
        <tr data-attempt-id="${a.id}">
          <td>${date}</td>
          <td>${formatPercent(a.percent)}</td>
          <td>${runesLabel}</td>
          <td>${formatKamas(value)}</td>
          <td><button type="button" class="delete-attempt-btn" data-id="${a.id}">✕</button></td>
        </tr>
      `;
    }).join('');

  container.innerHTML = `
    <div class="detail-panel">
      <h3>Historique — ${escapeHtml(item.name)}</h3>
      <table class="attempts-table">
        <thead>
          <tr><th>Date</th><th>% brisage</th><th>Runes obtenues</th><th>Valeur</th><th></th></tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;

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
  closeAddAttemptForm();
  renderItemsTable();
  renderDetail();
}

render();
