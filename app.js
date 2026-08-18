const DEFAULT_NUMBER_COUNT = 160;
const STORAGE_KEY = 'rifa-state-v1';
const CONFIG_KEY = 'rifa-config-v1';

const seedData = [
  { number: 1, status: 'reserved', name: 'Daniel Felipe', phone: '321 000 0001', value: 20000, downPayment: 10000, notes: 'Se paga en dos cuotas', date: '2026-08-15', playDate: '2026-09-20' },
  { number: 12, status: 'paid', name: 'María Gómez', phone: '300 111 2222', value: 15000, downPayment: 15000, notes: 'Pagado al contado', date: '2026-08-14', playDate: '2026-09-20' },
  { number: 25, status: 'reserved', name: 'Luis Pérez', phone: '305 333 4444', value: 25000, downPayment: 8000, notes: 'Pendiente restante', date: '2026-08-16', playDate: '2026-09-27' },
  { number: 65, status: 'paid', name: 'Ana Torres', phone: '312 555 6666', value: 18000, downPayment: 18000, notes: 'Pago completo', date: '2026-08-13', playDate: '2026-09-28' },
  { number: 120, status: 'reserved', name: 'Carlos Rojas', phone: '318 777 8888', value: 30000, downPayment: 15000, notes: 'Cuota mensual', date: '2026-08-10', playDate: '2026-09-30' },
  { number: 145, status: 'paid', name: 'Sofía Restrepo', phone: '314 999 0000', value: 22000, downPayment: 22000, notes: 'Entregó total', date: '2026-08-12', playDate: '2026-10-05' }
];

const $ = (selector) => document.querySelector(selector);

// Load config first so state can use its numberCount when building numbers
const initialConfig = loadConfig();
const state = {
  config: initialConfig,
  // Start with no numbers until a raffle is explicitly opened/created
  numbers: [],
  selectedNumber: null,
  selectedStatus: 'reserved',
  currentRaffleId: null
};

function loadConfig() {
  const saved = localStorage.getItem(CONFIG_KEY);
  if (!saved) {
    return {
        raffleMode: 'rifada',
      ticketPrice: 5000,
      numberCount: DEFAULT_NUMBER_COUNT,
      playDate: new Date().toISOString().slice(0,10),
      productImage: ''
    };
  }

  try {
    const parsed = JSON.parse(saved);
    return {
      raffleMode: parsed.raffleMode || 'rifada',
      ticketPrice: Number(parsed.ticketPrice) || 5000,
      numberCount: Number(parsed.numberCount) || DEFAULT_NUMBER_COUNT,
      playDate: parsed.playDate || new Date().toISOString().slice(0,10),
      prize: parsed.prize || '',
      productImage: parsed.productImage || ''
    };
  } catch (error) {
    return {
      raffleMode: 'rifada',
      ticketPrice: 5000,
      numberCount: DEFAULT_NUMBER_COUNT,
      playDate: new Date().toISOString().slice(0,10),
      prize: '',
      productImage: ''
    };
  }
}

function saveConfig() {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(state.config));
  // Also persist into active raffle if exists
  if (state.currentRaffleId) {
    const raffles = loadRaffles();
    const idx = raffles.findIndex((r) => r.id === state.currentRaffleId);
    if (idx >= 0) {
      raffles[idx].config = state.config;
      saveRaffles(raffles);
    }
  }
}

function initializeNumbers(count, start = 1) {
  const c = Number(count) || DEFAULT_NUMBER_COUNT;
  let s = Number(start);
  if (!Number.isFinite(s)) s = 1; // keep default if start isn't numeric
  return Array.from({ length: c }, (_, index) => {
    const number = s + index;
    const base = {
      number,
      name: '',
      phone: '',
      value: 0,
      downPayment: 0,
      status: 'available',
      notes: '',
      date: '',
      playDate: ''
    };

    // Do not apply seed/sample data here — initialize clean available numbers
    return base;
  });
}

function loadState(config) {
  const saved = localStorage.getItem(STORAGE_KEY);
  const count = (config && Number(config.numberCount)) || DEFAULT_NUMBER_COUNT;
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length === count) {
        // If legacy saved state exists, do NOT automatically use it to populate paid/reserved entries.
        // Return a clean list instead to avoid showing old history.
        return initializeNumbers(count);
      }
    } catch (error) {
      console.warn('No se pudo cargar el estado guardado.', error);
    }
  }

  return initializeNumbers(count);
}

const RAFFLES_KEY = 'rifa-collection-v1';

function loadRaffles() {
  const saved = localStorage.getItem(RAFFLES_KEY);
  try {
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.warn('No se pudo leer las rifas guardadas.', e);
    return [];
  }
}

let syncTimeout = null;
function syncRafflesToServer(raffles) {
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      await fetch('/api/raffles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raffles, full_sync: true })
      });
    } catch (e) {
      console.warn('Error sincronizando con el servidor:', e);
    }
  }, 150);
}

function saveRaffles(raffles) {
  const now = Date.now();
  const withTimestamps = (raffles || []).map((r) => {
    if (r.id === state.currentRaffleId) {
      return { ...r, updatedAt: now };
    }
    return r.updatedAt ? r : { ...r, updatedAt: now };
  });
  localStorage.setItem(RAFFLES_KEY, JSON.stringify(withTimestamps));
  syncRafflesToServer(withTimestamps);
}

function getRaffleById(id) {
  const raffles = loadRaffles();
  return raffles.find((r) => r.id === id);
}

function setActiveRaffle(id) {
  const raffles = loadRaffles();
  const r = raffles.find((x) => x.id === id);
  if (!r) return false;
  state.config = r.config;
  const defaultPrice = Number((state.config && state.config.ticketPrice) || 0);

  // Auto-reparar números que tengan valor en 0
  state.numbers = (r.numbers || []).map((item) => {
    const fixed = { ...item };
    if (!fixed.value || Number(fixed.value) <= 0) {
      fixed.value = defaultPrice;
    }
    if (fixed.status === 'paid' && (!fixed.downPayment || Number(fixed.downPayment) <= 0)) {
      fixed.downPayment = fixed.value;
    }
    return fixed;
  });

  r.numbers = state.numbers;
  state.currentRaffleId = id;
  // persist current config to the legacy CONFIG_KEY for compatibility
  localStorage.setItem(CONFIG_KEY, JSON.stringify(state.config));
  renderEverything();
  return true;
}

function migrateExistingRaffle() {
  const raffles = loadRaffles();
  if (raffles.length) return; // already migrated
  // create a clean raffle from current config (do not carry over legacy reserved/paid numbers)
  const id = String(Date.now());
  const raffle = {
    id,
    name: `Rifa ${formatDate(new Date().toISOString())}`,
    migrated: true,
    config: state.config,
    numbers: initializeNumbers(state.config.numberCount || DEFAULT_NUMBER_COUNT),
    winner: null,
    updatedAt: Date.now()
  };
  raffles.push(raffle);
  saveRaffles(raffles);
  state.currentRaffleId = id;

  // Remove legacy single-state storage to avoid showing old history elsewhere
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    /* ignore */
  }
}

function saveState() {
  const now = Date.now();
  if (state.currentRaffleId) {
    const raffles = loadRaffles();
    const idx = raffles.findIndex((r) => r.id === state.currentRaffleId);
    if (idx >= 0) {
      raffles[idx].numbers = state.numbers;
      raffles[idx].config = state.config;
      raffles[idx].updatedAt = now;
      saveRaffles(raffles);
      return;
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.numbers));
}

function formatMoney(value) {
  if (!value) return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(Number(value));
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const s = String(dateString).trim();
  // bare YYYY-MM-DD should be treated as local date
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (Number.isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  }

  // If it's an ISO datetime (contains 'T'), parse and then convert to the local date components
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const parsed = new Date(s);
    if (Number.isNaN(parsed.getTime())) return dateString;
    const localDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(localDate);
  }

  // Fallback: try Date constructor
  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function getNumberById(number) {
  return state.numbers.find((item) => item.number === number);
}

function getStatusCounts() {
  return state.numbers.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, { available: 0, reserved: 0, paid: 0 });
}

function getTotalRevenue() {
  const defaultPrice = Number((state.config && state.config.ticketPrice) || 0);
  return state.numbers.reduce((total, item) => {
    if (item.status === 'paid') {
      const val = Number(item.value || 0);
      const down = Number(item.downPayment || 0);
      if (val > 0) return total + val;
      if (down > 0) return total + down;
      return total + defaultPrice;
    }
    if (item.status === 'reserved') {
      return total + Number(item.downPayment || 0);
    }
    return total;
  }, 0);
}

function ensureConfigSet() {
  const setupModal = $('#setupModal');
  if (!state.config || !state.config.ticketPrice) {
    setupModal.classList.remove('hidden');
    setupModal.setAttribute('aria-hidden', 'false');
    return false;
  }

  setupModal.classList.add('hidden');
  setupModal.setAttribute('aria-hidden', 'true');
  // Keep header title blank for admin UI; ticket itself displays 'RIFA'
  $('#raffleTitle').textContent = '';
  return true;
}

function renderStats() {
  const counts = getStatusCounts();
  $('#availableCount').textContent = counts.available;
  $('#reservedCount').textContent = counts.reserved;
  $('#paidCount').textContent = counts.paid;
  $('#revenueTotal').textContent = formatMoney(getTotalRevenue());

  // Percent sold (reservados + pagados) / total
  const total = state.numbers.length || 1;
  const sold = (counts.reserved || 0) + (counts.paid || 0);
  const percent = Math.round((sold / total) * 100);
  const percentEl = $('#percentSold');
  if (percentEl) percentEl.textContent = `${percent}%`;
}

function renderGrid(query = '') {
  const grid = $('#numberGrid');
  grid.innerHTML = '';

  // If there are no numbers (no raffle selected), hide the grid and return
  if (!state.numbers || state.numbers.length === 0) {
    grid.classList.add('hidden');
    return;
  }

  grid.classList.remove('hidden');
  const normalizedQuery = query.trim().toLowerCase();

  state.numbers.forEach((entry) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `number-btn ${entry.status}`;
    button.dataset.number = entry.number;
    button.title = `${entry.number}\n${entry.name || 'Disponible'}\n${entry.status === 'reserved' ? 'Reservado' : entry.status === 'paid' ? 'Pagado' : 'Disponible'}\n${entry.downPayment ? `${formatMoney(entry.downPayment)} abonados` : ''}`.trim();

    const matchesQuery = normalizedQuery === '' ||
      String(entry.number).includes(normalizedQuery) ||
      (entry.name || '').toLowerCase().includes(normalizedQuery) ||
      (entry.phone || '').toLowerCase().includes(normalizedQuery);

    if (matchesQuery && normalizedQuery) {
      button.classList.add('highlight');
    }

    const label = document.createElement('span');
    label.textContent = String(entry.number).padStart(2, '0');

    // No status text under the number - color indicates state (available=light gray, reserved=yellow, paid=dark green)
    button.append(label);
    button.addEventListener('click', () => openNumberModal(entry.number));
    grid.appendChild(button);
  });
}

function renderSearchResults(query = '') {
  const results = $('#searchResults');
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    results.classList.add('hidden');
    results.innerHTML = '';
    return;
  }

  const matches = state.numbers.filter((item) => {
    const haystack = `${item.number} ${item.name || ''} ${item.phone || ''}`.toLowerCase();
    return haystack.includes(normalized);
  });

  if (!matches.length) {
    results.classList.remove('hidden');
    results.innerHTML = '<h3>No se encontraron coincidencias</h3>';
    return;
  }

  const topResults = matches.slice(0, 12);
  const chips = topResults.map((item) => {
    const nameText = item.name ? `${item.name} · ${item.number}` : `Número ${item.number}`;
    return `<button class="result-pill" type="button" data-number="${item.number}">${nameText}</button>`;
  }).join('');

  results.classList.remove('hidden');
  results.innerHTML = `<h3>Resultados</h3><div class="result-list">${chips}</div>`;

  results.querySelectorAll('.result-pill').forEach((button) => {
    button.addEventListener('click', () => {
      const number = Number(button.dataset.number);
      openNumberModal(number);
      $('#searchInput').value = String(number);
      renderGrid(String(number));
    });
  });
}

function closeModal() {
  $('#numberModal').classList.add('hidden');
  $('#numberModal').setAttribute('aria-hidden', 'true');
  $('#modalBody').innerHTML = '';
  state.selectedNumber = null;
}

function buildBasicForm(number) {
  // Ensure default state when opening the reservation form
  state.selectedStatus = 'reserved';
  const form = document.createElement('form');
  form.className = 'form-grid';

  const fields = [
    { label: 'Nombre', name: 'name', type: 'text', value: '', required: true },
    { label: 'Teléfono', name: 'phone', type: 'tel', value: '' },
    { label: 'Valor', name: 'value', type: 'number', value: Number(state.config.ticketPrice) || 0 }
  ];

  fields.forEach((field) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'field';

    const label = document.createElement('label');
    label.textContent = field.label;
    if (field.required) label.setAttribute('for', `${field.name}-${number}`);

    const input = document.createElement('input');
    input.type = field.type;
    input.name = field.name;
    input.id = `${field.name}-${number}`;
    input.value = field.value;
    if (field.required) input.required = true;

    wrapper.append(label, input);
    form.appendChild(wrapper);
  });

  const statusWrap = document.createElement('div');
  statusWrap.className = 'field';
  const statusLabel = document.createElement('label');
  statusLabel.textContent = 'Estado';
  const segmented = document.createElement('div');
  segmented.className = 'segmented';

  const reserveBtn = document.createElement('button');
  reserveBtn.type = 'button';
  reserveBtn.className = 'segment-btn active';
  reserveBtn.dataset.status = 'reserved';
  reserveBtn.textContent = 'Reservar';

  const paidBtn = document.createElement('button');
  paidBtn.type = 'button';
  paidBtn.className = 'segment-btn';
  paidBtn.dataset.status = 'paid';
  paidBtn.textContent = 'Marcar como pagado';

  segmented.append(reserveBtn, paidBtn);
  statusWrap.append(statusLabel, segmented);
  form.appendChild(statusWrap);

  reserveBtn.addEventListener('click', () => {
    reserveBtn.classList.add('active');
    paidBtn.classList.remove('active');
    state.selectedStatus = 'reserved';
  });

  paidBtn.addEventListener('click', () => {
    paidBtn.classList.add('active');
    reserveBtn.classList.remove('active');
    state.selectedStatus = 'paid';
  });

  const actions = document.createElement('div');
  actions.className = 'field actions';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'primary-btn';
  saveBtn.textContent = 'Guardar';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'secondary-btn';
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.addEventListener('click', closeModal);

  actions.append(saveBtn, cancelBtn);
  form.appendChild(actions);

  // Add a checkbox to ask whether the client abona (pays a down payment) when reserving
  const abonoWrap = document.createElement('div');
  abonoWrap.className = 'field';
  const abonoLabel = document.createElement('label');
  abonoLabel.textContent = '¿Abona ahora?';
  const abonoInput = document.createElement('input');
  abonoInput.type = 'checkbox';
  abonoInput.name = 'abono';
  abonoInput.id = `abono-${number}`;
  abonoWrap.append(abonoLabel, abonoInput);
  // downPayment input (hidden unless checkbox checked)
  const downWrap = document.createElement('div');
  downWrap.className = 'field hidden';
  const downLabel = document.createElement('label');
  downLabel.textContent = 'Abono';
  const downInput = document.createElement('input');
  downInput.type = 'number';
  downInput.name = 'downPayment';
  downInput.id = `downPayment-${number}`;
  downInput.value = Math.max(0, Math.floor((Number(state.config.ticketPrice) || 0) / 2));
  downWrap.append(downLabel, downInput);
  form.insertBefore(abonoWrap, actions);
  form.insertBefore(downWrap, actions);

  abonoInput.addEventListener('change', () => {
    if (abonoInput.checked) downWrap.classList.remove('hidden');
    else downWrap.classList.add('hidden');
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const name = String(formData.get('name') || '').trim();
    const phone = String(formData.get('phone') || '').trim();
    const value = Number(formData.get('value')) || Number(state.config.ticketPrice) || 0;
    // Use raffle-level default playDate; do not ask at reservation time
    const playDate = state.config.playDate || '';
    const selectedStatus = state.selectedStatus || 'reserved';
    const abona = !!formData.get('abono');
    const downPaymentValue = Number(formData.get('downPayment')) || 0;

    if (!name) {
      alert('Debe ingresar el nombre del cliente.');
      return;
    }

    const current = getNumberById(number);
    current.name = name;
    current.phone = phone;
    current.value = value;
    if (selectedStatus === 'paid') {
      current.downPayment = value;
      current.status = 'paid';
    } else {
      // reserved
      if (abona) {
        // use provided down payment but do not exceed value
        current.downPayment = Math.min(downPaymentValue, value);
      } else {
        current.downPayment = 0;
      }
      current.status = 'reserved';
    }
    current.notes = current.notes || '';
    current.date = new Date().toISOString();
    current.playDate = playDate;

    saveState();
    renderEverything();
    closeModal();
  });

  return form;
}

function renderEditForm(number) {
  const item = getNumberById(number);
  const modalBody = $('#modalBody');
  modalBody.innerHTML = '';

  const form = document.createElement('form');
  form.className = 'form-grid';

  const fields = [
  { label: 'Nombre', name: 'name', type: 'text', value: item.name || '', required: true },
  { label: 'Teléfono', name: 'phone', type: 'tel', value: item.phone || '' },
  { label: 'Valor', name: 'value', type: 'number', value: item.value || Number(state.config.ticketPrice) || 0 },
  { label: 'Abono', name: 'downPayment', type: 'number', value: item.downPayment || 0 },
  { label: 'Notas', name: 'notes', type: 'text', value: item.notes || '' }
  ];

  fields.forEach((field) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'field';

    const label = document.createElement('label');
    label.textContent = field.label;
    if (field.required) label.setAttribute('for', `edit-${field.name}-${number}`);

    const input = document.createElement('input');
    input.type = field.type;
    input.name = field.name;
    input.id = `edit-${field.name}-${number}`;
    input.value = field.value;
    if (field.required) input.required = true;

    wrapper.append(label, input);
    form.appendChild(wrapper);
  });

  const actions = document.createElement('div');
  actions.className = 'field actions';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'primary-btn';
  saveBtn.type = 'submit';
  saveBtn.textContent = 'Guardar';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'secondary-btn';
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.addEventListener('click', () => openNumberModal(number));

  actions.append(saveBtn, cancelBtn);
  form.appendChild(actions);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const updated = getNumberById(number);
    const defaultPrice = Number((state.config && state.config.ticketPrice) || 0);
    updated.name = String(formData.get('name') || '').trim();
    updated.phone = String(formData.get('phone') || '').trim();
    const formVal = Number(formData.get('value'));
    updated.value = formVal > 0 ? formVal : defaultPrice;
    updated.downPayment = Number(formData.get('downPayment')) || 0;
    // Do not allow per-ticket playDate here; use raffle-level playDate by default
    updated.playDate = state.config.playDate || updated.playDate;
    updated.notes = String(formData.get('notes') || '').trim();
    updated.date = updated.date || new Date().toISOString();

    if (!updated.name) {
      alert('Debe ingresar el nombre del cliente.');
      return;
    }

    if (updated.status === 'paid') {
      updated.downPayment = updated.value;
    }

    if (updated.status === 'reserved' && updated.downPayment > updated.value) {
      updated.downPayment = updated.value;
    }

    saveState();
    renderEverything();
    closeModal();
  });

  modalBody.appendChild(form);
}

function renderTicketDetails(number) {
  const item = getNumberById(number);
  const modalBody = $('#modalBody');
  modalBody.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'detail-card';

  const header = document.createElement('div');
  header.className = 'detail-header';

  const tag = document.createElement('span');
  tag.className = item.status === 'reserved' ? 'status-tag status-reserved' : 'status-tag status-paid';
  tag.textContent = item.status === 'reserved' ? '🟡 Reservado' : '🔵 Pagado';
  header.appendChild(tag);
  card.appendChild(header);

  const detailGrid = document.createElement('div');
  detailGrid.className = 'detail-grid';

  const defaultPrice = Number((state.config && state.config.ticketPrice) || 0);
  const displayValue = Number(item.value > 0 ? item.value : defaultPrice);
  const displayDown = Number(item.status === 'paid' ? (item.downPayment > 0 ? item.downPayment : displayValue) : (item.downPayment || 0));
  const pendingValue = Math.max(0, displayValue - displayDown);

  const entries = [
    ['Cliente', item.name || '-'],
    ['Teléfono', item.phone || '-'],
    ['Valor', formatMoney(displayValue)],
    ['Abonado', formatMoney(displayDown)],
    ['Pendiente', formatMoney(pendingValue)],
    ['Cuándo juega', item.playDate ? formatDate(item.playDate) : '-'],
    ['Fecha', formatDate(item.date)]
  ];

  entries.forEach(([label, value]) => {
    const wrap = document.createElement('div');
    const span = document.createElement('span');
    span.textContent = label;
    const strong = document.createElement('strong');
    strong.textContent = value;
    wrap.append(span, strong);
    detailGrid.appendChild(wrap);
  });

  card.appendChild(detailGrid);

  const actions = document.createElement('div');
  actions.className = 'action-stack';

  const markPaid = document.createElement('button');
  markPaid.className = 'primary-btn';
  markPaid.textContent = 'Marcar como pagado';
  markPaid.addEventListener('click', () => {
    const current = getNumberById(number);
    const defaultPrice = Number((state.config && state.config.ticketPrice) || 0);
    current.status = 'paid';
    current.value = Number(current.value > 0 ? current.value : defaultPrice);
    current.downPayment = current.value;
    current.date = new Date().toISOString();
    if (!current.playDate) current.playDate = state.config.playDate || new Date().toISOString().slice(0, 10);
    saveState();
    renderEverything();
    closeModal();
  });

  const edit = document.createElement('button');
  edit.className = 'secondary-btn';
  edit.textContent = 'Editar';
  edit.addEventListener('click', () => renderEditForm(number));

  const share = document.createElement('button');
  share.className = 'tiny-btn';
  share.textContent = 'Generar boleta';
  share.addEventListener('click', () => generateBoletaPreview(number));

  const release = document.createElement('button');
  release.className = 'danger-btn';
  release.textContent = 'Liberar número';
  release.addEventListener('click', () => {
    const current = getNumberById(number);
    current.name = '';
    current.phone = '';
    current.value = 0;
    current.downPayment = 0;
    current.status = 'available';
    current.notes = '';
    current.date = '';
    current.playDate = '';
    saveState();
    renderEverything();
    closeModal();
  });

  actions.append(markPaid, edit, share, release);
  card.appendChild(actions);

  modalBody.appendChild(card);
}

function openNumberModal(number) {
  const item = getNumberById(number);
  state.selectedNumber = number;
  $('#numberModal').classList.remove('hidden');
  $('#numberModal').setAttribute('aria-hidden', 'false');
  $('#modalTitle').textContent = `NÚMERO ${String(number).padStart(2, '0')}`;

  const modalBody = $('#modalBody');
  modalBody.innerHTML = '';

  if (!item || item.status === 'available') {
    modalBody.appendChild(buildBasicForm(number));
    return;
  }

  renderTicketDetails(number);
}

function getProductImage() {
  return state.config.productImage || '';
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function generateBoletaPreview(number) {
  console.log('generateBoletaPreview called for', number);
  const item = getNumberById(number);
  const modalBody = $('#modalBody');
  const existingPreview = document.querySelector('.ticket-preview');
  if (existingPreview) existingPreview.remove();

  const wrapper = document.createElement('div');
  wrapper.className = 'ticket-preview';

  let canvas = document.createElement('canvas');

  // Square preview: display 360x360 CSS pixels, render at devicePixelRatio for HD
  const PREVIEW_SIZE = 360;
  const DPR = window.devicePixelRatio || 1;
  canvas.width = PREVIEW_SIZE * DPR;
  canvas.height = PREVIEW_SIZE * DPR;
  canvas.style.width = `${PREVIEW_SIZE}px`;
  canvas.style.height = `${PREVIEW_SIZE}px`;

  try {
    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);
    const W = PREVIEW_SIZE;
    const H = PREVIEW_SIZE;

    // helper to draw rounded rect
    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    // helper to draw wrapped text (center-aligned). limits lines to maxLines.
    function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
      if (!text) return 0;
      const words = String(text).split(' ');
      const lines = [];
      let current = '';
      for (let i = 0; i < words.length; i++) {
        const test = current ? current + ' ' + words[i] : words[i];
        const measured = ctx.measureText(test).width;
        if (measured > maxWidth && current) {
          lines.push(current);
          current = words[i];
          if (lines.length === maxLines) break;
        } else {
          current = test;
        }
      }
      if (lines.length < maxLines && current) lines.push(current);
      for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
        ctx.fillText(lines[i], x, y + i * lineHeight);
      }
      return lines.length;
    }

    // load product image if any
    let img = null;
    const assetUrl = getProductImage();
    if (assetUrl) {
      try { img = await loadImage(assetUrl); } catch (e) { console.warn('Imagen fondo no cargada', e); }
    }

    // Draw background (image or neutral)
    if (img) {
      const ratio = Math.max(W / img.width, H / img.height);
      const iw = img.width * ratio;
      const ih = img.height * ratio;
      const ix = (W - iw) / 2;
      const iy = (H - ih) / 2;
      ctx.drawImage(img, ix, iy, iw, ih);
    } else {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, W, H);
    }

    // subtle overlay for contrast
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, 0, W, H);

    // compact inner card — increase padding so content breathes
    const pad = Math.round(W * 0.12); // increased padding for less cramped layout
    const radius = Math.round(W * 0.04);
    const cardW = W - pad * 2;
    const cardH = H - pad * 2;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    roundRect(ctx, pad, pad, cardW, cardH, radius);
    ctx.fill();

    // Determine raffle name by searching raffles (safer than relying on state.currentRaffleId)
    let raffleName = '';
    try {
      const raffles = loadRaffles();
      const found = raffles.find(r => (r.numbers || []).some(n => Number(n.number) === Number(item.number)));
      if (found) raffleName = found.name || (found.config && found.config.playDate ? `Rifa ${formatDate(found.config.playDate)}` : '');
      else if (state.currentRaffleId) {
        const r = getRaffleById(state.currentRaffleId);
        if (r) raffleName = r.name || (r.config && r.config.playDate ? `Rifa ${formatDate(r.config.playDate)}` : '');
      }
    } catch (e) {
      raffleName = '';
    }

    // Status badge (top-right inside card) — make wider so labels fit and move slightly down
    const status = item.status || 'available';
    let statusColor = '#9ca3af'; // gray default
    if (status === 'paid') statusColor = '#16a34a'; // green
    if (status === 'reserved') statusColor = '#f59e0b'; // amber
    const badgeW = Math.round(cardW * 0.40); // increased width
    const badgeH = Math.round(cardH * 0.14); // increased height for readability
    const bx = pad + cardW - badgeW - Math.round(cardW * 0.02); // push slightly more to the right
    const by = Math.round(pad * 0.4); // place overlap near the top edge (less internal crowding)
    roundRect(ctx, bx, by, badgeW, badgeH, badgeH / 2);
    ctx.fillStyle = statusColor;
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.round(badgeH * 0.45)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const statusLabel = status === 'paid' ? 'PAGO' : status === 'reserved' ? 'RESERVADO' : 'DISPONIBLE';
    ctx.fillText(statusLabel, bx + badgeW / 2, by + badgeH / 2 + 1);

    // Top text: RIFA and raffleName (reduce font sizes slightly for balance)
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.font = `700 ${Math.round(cardH * 0.07)}px Arial`;
    ctx.fillText('RIFA', pad + cardW / 2, pad + Math.round(cardH * 0.12));
    if (raffleName) {
      ctx.font = `600 ${Math.round(cardH * 0.045)}px Arial`;
      // Use wrapText to allow up to 2 lines for long raffle names
      ctx.fillStyle = '#0f172a';
      const maxNameWidth = Math.round(cardW * 0.92);
      const lineH = Math.round(cardH * 0.055);
      wrapText(ctx, raffleName, pad + cardW / 2, pad + Math.round(cardH * 0.17), maxNameWidth, lineH, 2);
    }

    // Big number centered (slightly smaller to avoid crowding)
    ctx.fillStyle = '#0f172a';
    ctx.font = `800 ${Math.round(cardH * 0.22)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(String(item.number), pad + cardW / 2, pad + Math.round(cardH * 0.53));

    // Name and phone below number (reduced sizes for better spacing)
    ctx.fillStyle = '#0f172a';
    ctx.font = `600 ${Math.round(cardH * 0.07)}px Arial`;
    ctx.fillText(item.name || '-', pad + cardW / 2, pad + Math.round(cardH * 0.75));
    ctx.font = `500 ${Math.round(cardH * 0.055)}px Arial`;
    ctx.fillText(item.phone || '-', pad + cardW / 2, pad + Math.round(cardH * 0.82));

    // Dates: show only date (no time)
    ctx.fillStyle = '#374151';
    ctx.font = `500 ${Math.round(cardH * 0.035)}px Arial`;
    const playLabel = 'Fecha sorteo: ' + (item.playDate ? formatDate(item.playDate) : (state.config && state.config.playDate ? formatDate(state.config.playDate) : '-'));
    const buyLabel = 'Fecha compra: ' + (item.date ? formatDate(item.date) : formatDate(new Date().toISOString()));
    ctx.fillText(playLabel, pad + cardW / 2, pad + Math.round(cardH * 0.88));
    ctx.fillText(buyLabel, pad + cardW / 2, pad + Math.round(cardH * 0.915));

    // add close button
    const closePreview = document.createElement('button');
    closePreview.className = 'ticket-close';
    closePreview.textContent = '✕';
    closePreview.addEventListener('click', () => wrapper.remove());
    wrapper.appendChild(closePreview);

    wrapper.appendChild(canvas);
    modalBody.appendChild(wrapper);
  } catch (err) {
    console.error('Error drawing boleta preview', err);
    // fallback: simple placeholder canvas
    const fallback = document.createElement('canvas');
    const SIZE = 360;
    fallback.width = SIZE;
    fallback.height = SIZE;
    fallback.style.width = `${SIZE}px`;
    fallback.style.height = `${SIZE}px`;
    const fctx = fallback.getContext('2d');
    fctx.fillStyle = '#fff';
    fctx.fillRect(0,0,SIZE,SIZE);
    fctx.fillStyle = '#0f172a';
    fctx.font = '700 18px Arial';
    fctx.textAlign = 'center';
    fctx.fillText('Boleta no disponible', SIZE/2, SIZE/2);
    wrapper.appendChild(fallback);
    modalBody.appendChild(wrapper);
    canvas = fallback; // use fallback for download/share
  }

  // actions: download HD square and share
  const actions = document.createElement('div');
  actions.className = 'field actions';

  const downloadBtn = document.createElement('button');
  downloadBtn.className = 'primary-btn';
  downloadBtn.textContent = 'Descargar';
  downloadBtn.addEventListener('click', () => {
    // produce an HD image by scaling the preview canvas (more reliable than re-drawing)
    const SIZE = 1600;
    const tmp = document.createElement('canvas');
    tmp.width = SIZE;
    tmp.height = SIZE;
    tmp.style.width = `${SIZE}px`;
    tmp.style.height = `${SIZE}px`;
    const tctx = tmp.getContext('2d');

    try {
      // If preview canvas exists, draw it scaled into tmp
      if (canvas && canvas instanceof HTMLCanvasElement) {
        tctx.fillStyle = '#fff';
        tctx.fillRect(0,0,SIZE,SIZE);
        tctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, tmp.width, tmp.height);
      } else {
        // fallback: create a blank image
        tctx.fillStyle = '#f8fafc';
        tctx.fillRect(0, 0, SIZE, SIZE);
      }

      // Try synchronous dataURL download first
      try {
        const dataUrl = tmp.toDataURL('image/png');
        const linkSync = document.createElement('a');
        linkSync.href = dataUrl;
        linkSync.download = `boleta-${item.number}-hd.png`;
        linkSync.style.display = 'none';
        document.body.appendChild(linkSync);
        try {
          linkSync.click();
          setTimeout(() => { try { document.body.removeChild(linkSync); } catch (e) {} }, 1500);
          return;
        } catch (err) {
          try { document.body.removeChild(linkSync); } catch (e) {}
        }
      } catch (err) {
        // continue to blob method
      }

      // Blob fallback
      tmp.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `boleta-${item.number}-hd.png`;
        link.style.display = 'none';
        document.body.appendChild(link);
        try { link.click(); } catch (e) { window.open(url, '_blank'); }
        setTimeout(() => { try { URL.revokeObjectURL(url); document.body.removeChild(link); } catch (e) {} }, 2000);
      }, 'image/png');
    } catch (err) {
      console.error('HD download error', err);
      try {
        const dataUrl = tmp.toDataURL('image/png');
        window.open(dataUrl, '_blank');
      } catch (e) {
        console.error('Final fallback failed', e);
      }
    }
  });

  const shareBtn = document.createElement('button');
  shareBtn.className = 'secondary-btn';
  shareBtn.textContent = 'Compartir en WhatsApp';
  shareBtn.addEventListener('click', async () => {
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `boleta-${item.number}.png`, { type: 'image/png' });
      const shareText = `RIFA - ${raffleName}\nNúmero: ${item.number}\nCliente: ${item.name || 'Sin nombre'}\nTeléfono: ${item.phone || 'Sin teléfono'}\nValor: ${formatMoney(item.value || state.config.ticketPrice || 0)}`;

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `RIFA - Número ${item.number}`,
            text: shareText,
            files: [file]
          });
          return;
        } catch (error) {
          console.warn('No se pudo compartir con Web Share.', error);
        }
      }

      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
      window.open(whatsappUrl, '_blank');
    }, 'image/png');
  });

  // Fallback open-in-tab button (very reliable across browsers)
  const openBtn = document.createElement('button');
  openBtn.className = 'secondary-btn';
  openBtn.textContent = 'Abrir imagen';
  openBtn.addEventListener('click', () => {
    try {
      const SIZE = 800;
      const tmp = document.createElement('canvas');
      tmp.width = SIZE;
      tmp.height = SIZE;
      const tctx = tmp.getContext('2d');
      if (canvas && canvas instanceof HTMLCanvasElement) {
        tctx.fillStyle = '#fff';
        tctx.fillRect(0,0,SIZE,SIZE);
        tctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, tmp.width, tmp.height);
      }
      const data = tmp.toDataURL('image/png');
      window.open(data, '_blank');
    } catch (e) {
      console.error('Abrir imagen fallback failed', e);
      alert('No fue posible abrir la imagen. Revisa la consola para más detalles.');
    }
  });

  actions.append(downloadBtn, openBtn, shareBtn);
  modalBody.appendChild(actions);}
function renderEverything() {
  renderStats();
  renderGrid($('#searchInput')?.value || '');
  renderSearchResults($('#searchInput')?.value || '');
}

function initProductImagePreview() {
  const uploaded = $('#productImage');
  const preview = $('#productPreview');
  const wrap = $('#productPreviewWrap');

  uploaded.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      state.config.productImage = String(result || '');
      saveConfig();
      preview.src = state.config.productImage;
      wrap.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });
}

$('#searchInput').addEventListener('input', (event) => {
  const value = event.target.value;
  renderGrid(value);
  renderSearchResults(value);
});

$('#closeModalBtn').addEventListener('click', closeModal);
$('#numberModal').addEventListener('click', (event) => {
  if (event.target.dataset.close === 'true') {
    closeModal();
  }
});

// Close setup modal via its new close button
const closeSetupBtn = $('#closeSetupBtn');
if (closeSetupBtn) {
  closeSetupBtn.addEventListener('click', () => {
    const setup = $('#setupModal');
    if (setup) {
      setup.classList.add('hidden');
      setup.setAttribute('aria-hidden', 'true');
    }
  });
}

// Import moved: la importación de listas ahora se realiza desde el formulario de creación de rifa (setup).

// Parse a simple delimited text (CSV/TSV) into array of objects. Header row expected. Handles quoted values and detects common delimiters (comma, tab, semicolon).
function detectDelimiter(headerLine) {
  if (!headerLine) return ',';
  if (headerLine.indexOf('\t') >= 0) return '\t';
  // Count candidates
  const counts = { ',': (headerLine.match(/,/g) || []).length, ';': (headerLine.match(/;/g) || []).length };
  return counts[';'] > counts[','] ? ';' : ',';
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (!lines.length) return [];
  const delim = detectDelimiter(lines[0]);
  const headers = parseCSVLine(lines[0], delim);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], delim);
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      const key = typeof headers[j] === 'string' ? headers[j].trim() : headers[j];
      obj[key] = (cols[j] !== undefined) ? cols[j].trim() : '';
    }
    rows.push(obj);
  }
  return rows;
}

function parseCSVLine(line, delim = ',') {
  const OUT = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { cur += '"'; i++; } else { inQuotes = !inQuotes; }
    } else if (ch === delim && !inQuotes) {
      OUT.push(cur); cur = ''; }
    else { cur += ch; }
  }
  OUT.push(cur);
  return OUT;
}

// Map possible header names to canonical keys
const HEADER_ALIASES = {
  number: ['number','numero','número','num'],
  name: ['name','nombre'],
  phone: ['phone','telefono','tel','teléfono'],
  status: ['status','estado','estado_pago'],
  date: ['date','fecha','fecha_compra','fecha_reserva'],
  playDate: ['playDate','play_date','fecha_sorteo','fecha'],
  value: ['value','valor','precio'],
  downPayment: ['downPayment','abono']
};

// Normalize header text: remove BOM, diacritics, trim and lowercase for robust matching
function sanitizeHeader(h) {
  if (!h && h !== 0) return '';
  try {
    const s = String(h).replace(/^\uFEFF/, ''); // remove BOM
    // remove diacritics (accents)
    const noAccents = s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s;
    return noAccents.toLowerCase().trim();
  } catch (e) {
    return String(h).toLowerCase().trim();
  }
}

function normalizeRow(row) {
  const norm = {};
  const keys = Object.keys(row);
  for (const k of keys) {
    const low = sanitizeHeader(k);
    for (const canon of Object.keys(HEADER_ALIASES)) {
      if (HEADER_ALIASES[canon].includes(low)) { norm[canon] = row[k]; }
    }
  }
  // Also include raw columns if already canonical (after sanitization)
  for (const c of Object.keys(row)) {
    const lc = sanitizeHeader(c);
    if (['number','name','phone','status','date','playdate','value','downpayment'].includes(lc)) {
      const map = lc === 'playdate' ? 'playDate' : lc === 'downpayment' ? 'downPayment' : lc;
      norm[map] = row[c];
    }
  }
  return norm;
}

function mapStatus(s) {
  if (!s) return 'available';
  const t = String(s).toLowerCase();
  if (t.includes('pag') || t.includes('paid')) return 'paid';
  if (t.includes('reserv') || t.includes('res')) return 'reserved';
  return t === 'available' ? 'available' : s;
}

function applyImportRows(rows) {
  const raffles = loadRaffles();
  const activeId = state.currentRaffleId || (raffles[0] && raffles[0].id);
  if (!activeId) {
    // create default raffle if none
    migrateExistingRaffle();
  }
  const raffle = getRaffleById(state.currentRaffleId || (loadRaffles()[0] && loadRaffles()[0].id));
  if (!raffle) return { processed: 0, updated: 0, ignored: rows.length };

  let processed = 0, updated = 0, ignored = 0;
  // helper: robust index finder supporting padded numbers and '00' mapping
  function findIndexByRawNumberGlobal(rawStr) {
    if (!rawStr && rawStr !== 0) return -1;
    const s = String(rawStr).trim();
    const parsed = Number(s);
    const nums = raffle.numbers || [];
    if (!Number.isNaN(parsed)) {
      const idx = nums.findIndex(n => Number(n.number) === parsed);
      if (idx >= 0) return idx;
    }
    const padLen = s.length;
    if (padLen > 0) {
      for (let i = 0; i < nums.length; i++) {
        const candidate = String(nums[i].number).padStart(padLen, '0');
        if (candidate === s) return i;
      }
    }
    // Do not map '00' to last index automatically; if parsed === 0 but no explicit 0 exists, ignore
    return -1;
  }

  for (const raw of rows) {
    const r = normalizeRow(raw);
    const rawNumStr = (r.number || r.num || r.numero || '').toString();
    const numParsed = Number(rawNumStr);
    if (Number.isNaN(numParsed) && (!rawNumStr || rawNumStr.trim() === '')) { ignored++; continue; }
    const idx = findIndexByRawNumberGlobal(rawNumStr);
    if (idx < 0) { ignored++; continue; }
    processed++;
    const item = raffle.numbers[idx];
    const defaultTicketPrice = Number((raffle && raffle.config && Number(raffle.config.ticketPrice)) || Number(state.config.ticketPrice) || 0);
    if (r.name) item.name = String(r.name).trim();
    if (r.phone) item.phone = String(r.phone).trim();
    item.value = (r.value ? Number(String(r.value).replace(/[^0-9.-]+/g,'')) : 0) || defaultTicketPrice;
    item.downPayment = (r.downPayment ? Number(String(r.downPayment).replace(/[^0-9.-]+/g,'')) : 0);
    if (r.playDate) item.playDate = String(r.playDate).trim();
    if (r.date) item.date = String(r.date).trim();
    if (r.status) {
      const mapped = mapStatus(r.status);
      if (mapped === 'paid') {
        item.status = 'paid';
        item.downPayment = item.value;
      } else if (mapped === 'reserved') {
        item.status = 'reserved';
      }
    } else {
      if (item.name) item.status = 'reserved';
    }
    // ensure date set
    if (item.status && !item.date) item.date = new Date().toISOString();
    raffle.numbers[idx] = item;
    updated++;
  }

  // persist
  saveRaffles(loadRaffles().map(r => r.id === raffle.id ? raffle : r));
  // sync state if active
  if (state.currentRaffleId === raffle.id) state.numbers = raffle.numbers;
  return { processed, updated, ignored };
}

// Simple IndexedDB backup
function openIDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('rifa-db', 1);
    r.onupgradeneeded = (ev) => {
      try { ev.target.result.createObjectStore('backups', { keyPath: 'id' }); } catch (e) {}
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = (e) => reject(e.target.error || e);
  });
}

async function saveBackupToIDB(raffles) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('backups','readwrite');
    const store = tx.objectStore('backups');
    const rec = { id: Date.now(), created: new Date().toISOString(), raffles };
    const req = store.add(rec);
    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e.target.error || e);
  });
}

// Generic backdrop close handling for any modal that opts-in with data-close="true"
document.querySelectorAll('.modal .modal-backdrop').forEach((backdrop) => {
  if (backdrop.dataset.close === 'true') {
    backdrop.addEventListener('click', () => {
      const modal = backdrop.closest('.modal');
      if (!modal) return;
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
      // cleanup modal-specific content
      if (modal.id === 'numberModal') {
        $('#modalBody').innerHTML = '';
        state.selectedNumber = null;
      }
    });
  }
});

$('#setupForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const raffleMode = String(formData.get('raffleMode') || 'rifada');
  const ticketPrice = Number(formData.get('ticketPrice')) || 0;
  const numberCount = Number(formData.get('numberCount')) || DEFAULT_NUMBER_COUNT;

  const raffles = loadRaffles();
  const id = String(Date.now());
  const raffleNameField = String(formData.get('raffleName') || '').trim();

  // If a file was provided in the setup modal, parse it first to detect numbering style (0-based vs 1-based)
  let parsedRows = [];
  try {
    const setupImport = $('#setupImportFile');
    if (setupImport && setupImport.files && setupImport.files[0]) {
      const file = setupImport.files[0];
      const ext = (file.name || '').split('.').pop().toLowerCase();
      let rows = [];
      if (ext === 'csv') {
        const text = await file.text();
        rows = parseCSV(text);
        // fallbacks as before
        const firstRow = rows[0] || {};
        const lowerKeys = Object.keys(firstRow).map(k => sanitizeHeader(k));
        const hasNumber = lowerKeys.some(k => ['number','numero','num'].includes(k));
        const hasName = lowerKeys.some(k => ['name','nombre'].includes(k));
        if (!hasNumber || !hasName) {
          try {
            const ab = await file.arrayBuffer();
            try {
              const dec = new TextDecoder('windows-1252');
              const altText = dec.decode(ab);
              const altRows = parseCSV(altText);
              const altFirst = altRows[0] || {};
              const altKeys = Object.keys(altFirst).map(k => sanitizeHeader(k));
              const altHasNumber = altKeys.some(k => ['number','numero','num'].includes(k));
              const altHasName = altKeys.some(k => ['name','nombre'].includes(k));
              if (altHasNumber && altHasName) rows = altRows;
            } catch (e) {}
            if ((!rows || !rows.length || !Object.keys(rows[0] || {}).length) || !Object.keys(rows[0] || {}).length) {
              try {
                const dec2 = new TextDecoder('iso-8859-1');
                const altText2 = dec2.decode(ab);
                const altRows2 = parseCSV(altText2);
                const altFirst2 = altRows2[0] || {};
                const altKeys2 = Object.keys(altFirst2).map(k => sanitizeHeader(k));
                const altHasNumber2 = altKeys2.some(k => ['number','numero','num'].includes(k));
                const altHasName2 = altKeys2.some(k => ['name','nombre'].includes(k));
                if (altHasNumber2 && altHasName2) rows = altRows2;
              } catch (e) {}
            }
          } catch (err) { console.warn('Decoding fallback failed', err); }
        }
      } else if (ext === 'xlsx' || ext === 'xls') {
        if (window.XLSX) {
          const ab = await file.arrayBuffer();
          const wb = window.XLSX.read(new Uint8Array(ab), { type: 'array' });
          const first = wb.SheetNames[0];
          rows = window.XLSX.utils.sheet_to_json(wb.Sheets[first], { defval: '' });
        } else { alert('XLSX no soportado en este entorno. Por favor sube CSV o incluye la librería xlsx.'); return; }
      } else { alert('Formato no soportado. Use CSV o XLSX.'); return; }

      // minimal header validation
      const firstRow = rows[0] || {};
      const lowerKeys = Object.keys(firstRow).map(k => sanitizeHeader(k));
      const hasNumber = lowerKeys.some(k => ['number','numero','num'].includes(k));
      const hasName = lowerKeys.some(k => ['name','nombre'].includes(k));
      if (!hasNumber || !hasName) { alert('El archivo debe contener al menos las columnas: número y nombre. Teléfono es opcional. Asegúrate de que los encabezados no tengan caracteres invisibles (BOM) o espacios.'); return; }

      parsedRows = rows;
    }
  } catch (err) {
    console.error('Error al procesar archivo de import en setup:', err);
    alert('Ocurrió un error al procesar el archivo de importación. Revisa la consola.');
    return;
  }

  // Determine numbering start: user can force start=0 via checkbox in the form, otherwise auto-detect from parsedRows
  let startNumber = 1;
  try {
    const forceZero = !!formData.get('startAtZero');
    if (forceZero) {
      startNumber = 0;
    } else if (parsedRows && parsedRows.length) {
      for (const raw of parsedRows) {
        const r = normalizeRow(raw);
        const rawNum = (r.number || r.num || r.numero);
        if (rawNum !== undefined && rawNum !== null) {
          const s = String(rawNum).trim();
          if (s === '' ) continue;
          const parsed = Number(s);
          if (!Number.isNaN(parsed) && parsed === 0) { startNumber = 0; break; }
          if (/^0+/.test(s) && parsed === 0) { startNumber = 0; break; }
        }
      }
    }
  } catch (e) {
    // fallback: default to 1
    startNumber = 1;
  }

  // Build new raffle object (numbers initialized clean, start either 0 or 1)
  const raffle = {
    id,
    name: raffleNameField || `Rifa ${formatDate(new Date().toISOString())}`,
  migrated: true,
  config: {
    raffleMode,
    ticketPrice,
    numberCount,
    playDate: String(formData.get('raffleDate') || state.config.playDate || '').trim(),
    prize: String(formData.get('prize') || state.config.prize || '').trim(),
    productImage: state.config.productImage || ''
  },
  numbers: initializeNumbers(numberCount, startNumber).map(n => ({ ...n, playDate: String(formData.get('raffleDate') || state.config.playDate || '').trim() })),
  winner: null
  };

  // If parsedRows provided, apply into this raffle (respect status/value/downPayment)
  try {
    if (parsedRows && parsedRows.length) {
      // helper finder that respects padding and zero start
      function findIdx(rawStr) {
        if (!rawStr && rawStr !== 0) return -1;
        const s = String(rawStr).trim();
        const parsed = Number(s);
        const nums = raffle.numbers || [];
        if (!Number.isNaN(parsed)) {
          const idx = nums.findIndex(n => Number(n.number) === parsed);
          if (idx >= 0) return idx;
        }
        const padLen = s.length;
        if (padLen > 0) {
          for (let i = 0; i < nums.length; i++) {
            const candidate = String(nums[i].number).padStart(padLen, '0');
            if (candidate === s) return i;
          }
        }
        return -1;
      }

      for (const raw of parsedRows) {
        const r = normalizeRow(raw);
        const rawNumStr = (r.number || r.num || r.numero || '').toString();
        const idx = findIdx(rawNumStr);
        if (idx < 0) continue;
        const item = raffle.numbers[idx];
        const defaultTicketPrice = Number(raffle.config.ticketPrice || state.config.ticketPrice || 0);
        if (r.name) item.name = String(r.name).trim();
        if (r.phone) item.phone = String(r.phone).trim();
        item.value = (r.value ? Number(String(r.value).replace(/[^0-9.-]+/g,'')) : 0) || defaultTicketPrice;
        item.downPayment = (r.downPayment ? Number(String(r.downPayment).replace(/[^0-9.-]+/g,'')) : 0);
        if (r.playDate) item.playDate = String(r.playDate).trim();
        if (r.date) item.date = String(r.date).trim();
        if (r.status) {
          const mapped = mapStatus(r.status);
          if (mapped === 'paid') {
            item.status = 'paid';
            item.downPayment = item.value;
          } else if (mapped === 'reserved') {
            item.status = 'reserved';
          }
        } else {
          if (item.name) item.status = 'reserved';
        }
        if (item.status && !item.date) item.date = new Date().toISOString();
        raffle.numbers[idx] = item;
      }
    }
  } catch (err) { console.error('Error applying parsed rows to new raffle', err); alert('Ocurrió un error al aplicar las filas al crear la rifa. Revisa la consola.'); return; }

  // Persist the new raffle and activate it
  raffles.push(raffle);
  saveRaffles(raffles);
  try { await saveBackupToIDB(loadRaffles()); } catch (e) { console.warn('No se pudo guardar backup', e); }

  setActiveRaffle(id);
  // Persist legacy config for compatibility
  saveConfig();

  // Close setup modal
  const setupModal = $('#setupModal');
  setupModal.classList.add('hidden');
  setupModal.setAttribute('aria-hidden', 'true');

  renderEverything();
});

// New raffle button: open the setup modal and prefill current config
const newRaffleBtn = $('#newRaffleBtn');
if (newRaffleBtn) {
  newRaffleBtn.addEventListener('click', () => {
    const setupModal = $('#setupModal');
    setupModal.classList.remove('hidden');
    setupModal.setAttribute('aria-hidden', 'false');
    // Prefill form fields
    $('#ticketPrice').value = state.config.ticketPrice || 5000;
    $('#numberCount').value = state.config.numberCount || DEFAULT_NUMBER_COUNT;
    $('#raffleDate').value = state.config.playDate || new Date().toISOString().slice(0,10);
    $('#prize').value = state.config.prize || '';
    $('#raffleName').value = state.config.name || '';
    if (state.config.productImage) {
      $('#productPreview').src = state.config.productImage;
      $('#productPreviewWrap').classList.remove('hidden');
    } else {
      $('#productPreviewWrap').classList.add('hidden');
    }
  });
}

// Manage rifas button & modal
const manageRafflesBtn = $('#manageRafflesBtn');
const closeRafflesBtn = $('#closeRafflesBtn');

function openRafflesModal() {
  const modal = $('#rafflesModal');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  renderRafflesList();
}

function closeRafflesModal() {
  const modal = $('#rafflesModal');
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  $('#rafflesBody').innerHTML = '';
}

function renderRafflesList() {
  const raffles = loadRaffles();
  const body = $('#rafflesBody');
  body.innerHTML = '';

  if (!raffles.length) {
    body.innerHTML = '<p>No hay rifas creadas aún.</p>';
    return;
  }

  const list = document.createElement('div');
  list.className = 'raffle-list';

  raffles.forEach((r) => {
    const wrap = document.createElement('div');
    wrap.className = 'raffle-item';

    const title = document.createElement('div');
    title.className = 'raffle-title';
    title.textContent = r.name || `Rifa ${r.id}`;

    const info = document.createElement('div');
    info.className = 'raffle-info';
    const soldCount = (r.numbers || []).filter((n) => n.status === 'reserved' || n.status === 'paid').length;
    const percent = Math.round((soldCount / ((r.numbers || []).length || 1)) * 100);
    info.textContent = `${(r.numbers || []).length} números — ${percent}% vendidos`;

    const actions = document.createElement('div');
    actions.className = 'raffle-actions';

    const openBtn = document.createElement('button');
    openBtn.className = 'primary-btn';
    openBtn.textContent = 'Abrir';
    openBtn.addEventListener('click', () => {
      setActiveRaffle(r.id);
      closeRafflesModal();
    });

    const drawBtn = document.createElement('button');
    drawBtn.className = 'secondary-btn';
    drawBtn.textContent = 'Sortear';
    drawBtn.addEventListener('click', () => {
      drawWinner(r.id);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'danger-btn';
    delBtn.textContent = 'Eliminar';
    delBtn.addEventListener('click', () => {
      if (!confirm('¿Eliminar esta rifa? Esta acción no se puede deshacer.')) return;
      deleteRaffle(r.id);
      renderRafflesList();
    });

    actions.append(openBtn, drawBtn, delBtn);
    wrap.append(title, info, actions);
    list.appendChild(wrap);
  });

  body.appendChild(list);
}

function deleteRaffle(id) {
  const raffles = loadRaffles().filter((r) => r.id !== id);
  saveRaffles(raffles);
  if (state.currentRaffleId === id) {
    if (raffles.length) {
      setActiveRaffle(raffles[0].id);
    } else {
      // Reset to defaults — no active raffle, do not show default table
      state.config = { raffleMode: 'rifada', ticketPrice: 5000, numberCount: DEFAULT_NUMBER_COUNT, productImage: '' };
      state.numbers = [];
      state.currentRaffleId = null;
      // Persist config but do not save numbers to legacy storage
      saveConfig();
      renderEverything();
    }
  }
}

function drawWinner(raffleId) {
  const raffles = loadRaffles();
  const raffle = raffles.find((r) => r.id === raffleId);
  if (!raffle) return;
  const paid = (raffle.numbers || []).filter((n) => n.status === 'paid');
  if (!paid.length) {
    alert('No hay números pagados para sortear.');
    return;
  }
  const idx = Math.floor(Math.random() * paid.length);
  const winner = paid[idx];
  raffle.winner = { number: winner.number, name: winner.name || '', phone: winner.phone || '', date: new Date().toISOString() };
  saveRaffles(raffles);
  // If drawing the currently active raffle, update state and show modal
  if (state.currentRaffleId === raffleId) {
    alert(`Ganador: Número ${winner.number} — ${winner.name || 'Sin nombre'} (${winner.phone || '-'})`);
    renderTicketDetails(winner.number);
  } else {
    alert(`Ganador: Número ${winner.number} — ${winner.name || 'Sin nombre'} (${winner.phone || '-'})\n(La rifa no estaba abierta; ábrela para ver más detalles)`);
  }
}

if (manageRafflesBtn) manageRafflesBtn.addEventListener('click', openRafflesModal);
if (closeRafflesBtn) closeRafflesBtn.addEventListener('click', closeRafflesModal);

// Draw button handler (prefers server-side draw if API available)
const drawBtn = $('#drawBtn');
if (drawBtn) {
  drawBtn.addEventListener('click', async () => {
    if (!state.currentRaffleId) { alert('No hay rifa activa para sortear.'); return; }
    try {
      // try server-side draw
      const base = window.RIFA_SERVER_BASE || '';
      if (base) {
        const resp = await fetch(`${base}/api/raffles/${state.currentRaffleId}/draw`, { method: 'POST' });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || 'Server draw failed');
        }
        const data = await resp.json();
        alert(`Ganador: Número ${data.winner.number} — ${data.winner.name || 'Sin nombre'}`);
        // refresh raffle from server
        const rresp = await fetch(`${base}/api/raffles/${state.currentRaffleId}`);
        if (rresp.ok) {
          const rdata = await rresp.json();
          // update local collection
          const raffles = loadRaffles();
          const idx = raffles.findIndex(r => r.id === rdata.id);
          if (idx >= 0) { raffles[idx] = rdata; saveRaffles(raffles); }
          setActiveRaffle(rdata.id);
        }
        return;
      }

      // Fallback: local draw (only among paid numbers)
      const paid = (state.numbers || []).filter(n => n.status === 'paid');
      if (!paid.length) { alert('No hay números pagados para sortear.'); return; }
      const idx = Math.floor(Math.random() * paid.length);
      const winner = paid[idx];
      alert(`Ganador (local): Número ${winner.number} — ${winner.name || 'Sin nombre'}`);
    } catch (err) {
      console.error('Draw error', err);
      alert('Error al sortear: ' + (err.message || 'Revisa la consola'));
    }
  });
}

// Public view (pantalla) button — opens a full-screen simplified grid for sharing/screen-sharing
const publicViewBtn = $('#publicViewBtn');
if (publicViewBtn) {
  publicViewBtn.addEventListener('click', () => {
    openPublicView();
  });
}

function openPublicView() {
  // Create a public overlay that uses the same app styling (stats + board)
  const existing = document.querySelector('.public-screen-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'public-screen-overlay';
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.08)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
  });

  // central panel that mimics app layout
  const panel = document.createElement('div');
  panel.style.width = 'min(1200px, 96vw)';
  panel.style.maxHeight = '94vh';
  panel.style.overflow = 'auto';
  panel.className = 'board-wrap public-panel';

  // top controls (title + actions)
  const top = document.createElement('div');
  top.style.display = 'flex';
  top.style.justifyContent = 'space-between';
  top.style.alignItems = 'center';
  top.style.marginBottom = '12px';

  const title = document.createElement('h3');
  title.textContent = (getRaffleById(state.currentRaffleId) || {}).name || 'Rifa';
  title.style.margin = '0';
  top.appendChild(title);

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '8px';

  const fsBtn = document.createElement('button');
  fsBtn.className = 'secondary-btn';
  fsBtn.textContent = 'Pantalla completa';
  fsBtn.addEventListener('click', async () => {
    try { if (panel.requestFullscreen) await panel.requestFullscreen(); else if (panel.webkitRequestFullscreen) panel.webkitRequestFullscreen(); } catch (e) { console.warn(e); }
  });

  const downloadBtn = document.createElement('button');
  downloadBtn.className = 'primary-btn';
  downloadBtn.textContent = 'Descargar imagen';
  downloadBtn.addEventListener('click', () => {
    try { downloadPublicGridImage(); } catch (e) { console.error('Download failed', e); alert('No fue posible descargar la imagen. Revisa la consola.'); }
  });

  const closeBtn = document.createElement('button');
  closeBtn.className = 'secondary-btn';
  closeBtn.textContent = 'Cerrar';
  closeBtn.addEventListener('click', () => {
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
    overlay.remove();
  });

  actions.appendChild(fsBtn);
  actions.appendChild(downloadBtn);
  actions.appendChild(closeBtn);
  top.appendChild(actions);

  panel.appendChild(top);

  // render stats using same structure/classes so it looks like the app
  const statsBar = document.createElement('section');
  statsBar.className = 'stats-bar';
  const counts = getStatusCounts();
  const revenue = getTotalRevenue();

  const createStat = (cls, number, label) => {
    const s = document.createElement('div');
    s.className = `stat ${cls}`;
    const dot = document.createElement('span'); dot.className = 'dot';
    const strong = document.createElement('strong'); strong.textContent = number;
    const small = document.createElement('small'); small.textContent = label;
    s.appendChild(dot); s.appendChild(strong); s.appendChild(small);
    return s;
  };

  statsBar.appendChild(createStat('available', counts.available || 0, 'Disponibles'));
  statsBar.appendChild(createStat('reserved', counts.reserved || 0, 'Reservados'));
  statsBar.appendChild(createStat('paid', counts.paid || 0, 'Pagados'));
  const total = state.numbers.length || 1;
  const sold = (counts.reserved || 0) + (counts.paid || 0);
  const percent = Math.round((sold / total) * 100);
  statsBar.appendChild(createStat('percent', `${percent}%`, '% vendidos'));
  const totalStat = document.createElement('div'); totalStat.className = 'stat total';
  const small = document.createElement('small'); small.textContent = 'Total recaudado';
  const strong = document.createElement('strong'); strong.textContent = formatMoney(revenue);
  totalStat.appendChild(small); totalStat.appendChild(strong);
  statsBar.appendChild(totalStat);

  panel.appendChild(statsBar);

  // board: reuse existing classes so styling matches
  const board = document.createElement('div');
  board.className = 'number-grid public-number-grid';
  board.style.gridTemplateColumns = getComputedStyle(document.querySelector('.number-grid'))?.gridTemplateColumns || 'repeat(8, 1fr)';

  // populate numbers as buttons with same classes as main UI
  (state.numbers || []).forEach((n) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `number-btn ${n.status || 'available'}`;
    btn.textContent = String(n.number).padStart(2, '0');
    btn.disabled = true; // prevent clicks in public view
    board.appendChild(btn);
  });

  panel.appendChild(board);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  overlay.tabIndex = -1; overlay.focus();

  // make download recreate layout with same CSS variables
  function downloadPublicGridImage() {
    // Delegate to existing image generator which reads CSS variables; keep behavior simple by reusing previous function logic
    const cs = getComputedStyle(document.documentElement);
    const colors = {
      overlayBg: cs.getPropertyValue('--bg')?.trim() || '#ffffff',
      available: cs.getPropertyValue('--available')?.trim() || '#f1f5f9',
      paid: cs.getPropertyValue('--paid')?.trim() || '#d7f5df',
      reserved: cs.getPropertyValue('--reserved')?.trim() || '#fff4bf',
      cellText: cs.getPropertyValue('--cell-text-dark')?.trim() || '#10233c'
    };
    // reuse previous canvas drawing but with improved cols calculation to match grid columns
    const nums = state.numbers || [];
    if (!nums.length) { alert('No hay números para exportar.'); return; }
    const gridEl = document.querySelector('.number-grid');
    // determine columns from CSS grid-template-columns if available
    let cols = 8;
    try {
      const gt = getComputedStyle(gridEl).gridTemplateColumns;
      if (gt) cols = gt.split(' ').length || cols;
    } catch (e) {}
    const total = nums.length;
    const rows = Math.ceil(total / cols);
    const cell = 120;
    const gap = 8;
    const padding = 20;
    const DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const canvasW = cols * cell + padding * 2 + (cols - 1) * gap;
    const canvasH = rows * cell + padding * 2 + (rows - 1) * gap + 40; // extra for title
    const canvas = document.createElement('canvas');
    canvas.width = canvasW * DPR; canvas.height = canvasH * DPR; canvas.style.width = `${canvasW}px`; canvas.style.height = `${canvasH}px`;
    const ctx = canvas.getContext('2d'); ctx.scale(DPR, DPR);

    // background (use panel background)
    ctx.fillStyle = colors.overlayBg; ctx.fillRect(0, 0, canvasW, canvasH);
    // title
    ctx.fillStyle = colors.cellText; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'left'; ctx.fillText((getRaffleById(state.currentRaffleId) || {}).name || 'Rifa', padding, 18);

    // draw cells
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < total; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = padding + c * (cell + gap);
      const y = padding + 24 + r * (cell + gap);
      const n = nums[i];
      let bg = colors.available; if (n.status === 'paid') bg = colors.paid; else if (n.status === 'reserved') bg = colors.reserved;
      const fg = colors.cellText || '#10233c';
      // rounded rect
      roundRect(ctx, x, y, cell, cell, 10); ctx.fillStyle = bg; ctx.fill();
      // number
      ctx.fillStyle = fg; ctx.font = '700 20px Arial'; ctx.fillText(String(n.number).padStart(2, '0'), x + cell/2, y + cell/2 - 6);
    }

    canvas.toBlob((blob) => {
      if (!blob) { alert('No fue posible generar la imagen.'); return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `${(getRaffleById(state.currentRaffleId) || {}).name || 'rifa'}-pantalla.png`;
      document.body.appendChild(link); link.click(); setTimeout(() => { try { URL.revokeObjectURL(url); document.body.removeChild(link); } catch(e){} }, 1000);
    }, 'image/png');

    function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  }
}


if (state.config.productImage) {
  $('#productPreview').src = state.config.productImage;
  $('#productPreviewWrap').classList.remove('hidden');
}

initProductImagePreview();

// Sanitize stored raffles to remove old reserved/paid entries
function sanitizeRaffles() {
  const raffles = loadRaffles();
  let changed = false;
  const cleaned = raffles.map((r) => {
    const count = (r.config && Number(r.config.numberCount)) || DEFAULT_NUMBER_COUNT;
    // Only sanitize legacy raffles (not those created by the new UI)
    if (r.migrated) return r;
    // If any number is reserved/paid, replace with clean available set
    const hasSold = (r.numbers || []).some((n) => n.status === 'reserved' || n.status === 'paid');
    if (hasSold) {
      changed = true;
      return {
        ...r,
        numbers: initializeNumbers(count),
        winner: null
      };
    }
    return r;
  });

  if (changed) {
    saveRaffles(cleaned);
  }
}

sanitizeRaffles();

// Initialize raffles: if any exist, activate the first; otherwise show a blank board
const initialRaffles = loadRaffles();
if (initialRaffles && initialRaffles.length) {
  setActiveRaffle(initialRaffles[0].id);
} else {
  // No raffles — show empty board (white background). Keep config loaded but do not force setup modal.
  state.currentRaffleId = null;
  state.numbers = [];
}

renderEverything();

// Sincronización inteligente con la base de datos en la nube (Render)
let isSyncing = false;
async function initServerSync(isManualClick = false) {
  if (isSyncing) return;
  isSyncing = true;
  try {
    const local = loadRaffles();

    // Si es clic manual, primero asegurar que los cambios locales se suban a la nube
    if (isManualClick && local && local.length > 0) {
      await fetch('/api/raffles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raffles: local, full_sync: true })
      });
    }

    const res = await fetch('/api/raffles');
    if (res.ok) {
      const data = await res.json();
      const serverRaffles = data.raffles;

      if (!serverRaffles || serverRaffles.length === 0) {
        // El servidor está vacío: subir lo que tenemos localmente
        if (local && local.length > 0) {
          await fetch('/api/raffles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ raffles: local, full_sync: true })
          });
        }
      } else if (!local || local.length === 0) {
        // Local está vacío: descargar lo del servidor
        localStorage.setItem(RAFFLES_KEY, JSON.stringify(serverRaffles));
        if (serverRaffles.length > 0) {
          setActiveRaffle(serverRaffles[0].id);
        }
      } else {
        // Combinar inteligentemente por marca de tiempo (timestamp)
        let shouldUpload = false;
        const mergedMap = new Map();

        // 1. Cargar rifas del servidor
        for (const s of serverRaffles) {
          mergedMap.set(s.id, s);
        }

        // 2. Comparar con rifas locales: la versión más reciente gana
        for (const l of local) {
          const s = mergedMap.get(l.id);
          if (!s) {
            // Local tiene una rifa que el servidor no tiene
            mergedMap.set(l.id, l);
            shouldUpload = true;
          } else {
            const localTime = Number(l.updatedAt || 0);
            const serverTime = Number(s.updatedAt || 0);
            if (localTime >= serverTime) {
              // Local es más reciente o igual: mantener local
              mergedMap.set(l.id, l);
              if (localTime > serverTime) shouldUpload = true;
            }
          }
        }

        const merged = Array.from(mergedMap.values());

        if (shouldUpload) {
          await fetch('/api/raffles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ raffles: merged, full_sync: true })
          });
        }

        localStorage.setItem(RAFFLES_KEY, JSON.stringify(merged));

        // Actualizar datos en pantalla sin perder la selección
        if (state.currentRaffleId && merged.some(r => r.id === state.currentRaffleId)) {
          const active = merged.find(r => r.id === state.currentRaffleId);
          const defaultPrice = Number((active.config && active.config.ticketPrice) || 0);
          state.config = active.config;
          state.numbers = (active.numbers || []).map((item) => {
            const fixed = { ...item };
            if (!fixed.value || Number(fixed.value) <= 0) fixed.value = defaultPrice;
            if (fixed.status === 'paid' && (!fixed.downPayment || Number(fixed.downPayment) <= 0)) fixed.downPayment = fixed.value;
            return fixed;
          });
          renderEverything();
        } else if (merged.length > 0 && !state.currentRaffleId) {
          setActiveRaffle(merged[0].id);
        }
      }
    }
  } catch (err) {
    console.warn('Error al sincronizar con el servidor:', err);
  } finally {
    isSyncing = false;
  }
}

// Botón de sincronización manual en la barra superior
const syncBtn = $('#syncBtn');
if (syncBtn) {
  syncBtn.addEventListener('click', async () => {
    syncBtn.textContent = '⏳ Guardando...';
    await initServerSync(true);
    setTimeout(() => {
      syncBtn.textContent = '✅ Guardado';
      setTimeout(() => { syncBtn.textContent = '☁️ Sincronizar'; }, 2000);
    }, 300);
  });
}

// Sincronización inicial al cargar
initServerSync(false);

// Auto-sincronización periódica cada 15 segundos para ver cambios entre usuarios
setInterval(() => {
  initServerSync(false);
}, 15000);
