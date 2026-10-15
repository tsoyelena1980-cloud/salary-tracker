const STORAGE_KEY = "salary-tracker-transactions";
const THEME_KEY = "salary-tracker-theme";

const CATEGORIES = {
  income: ["Зарплата", "Подработка", "Подарки", "Инвестиции", "Другое"],
  expense: ["Еда", "Транспорт", "Жильё", "Здоровье", "Развлечения", "Покупки", "Связь", "Другое"],
};

const DONUT_COLORS = ["#c4475d", "#e08a3c", "#d4a017", "#2f6f8f", "#6b5b95", "#3d8b74", "#b85c38", "#7a8b99"];

const themeToggle = document.querySelector("#theme-toggle");
const monthInput = document.querySelector("#month");
const incomeTotal = document.querySelector("#income-total");
const expenseTotal = document.querySelector("#expense-total");
const balanceTotal = document.querySelector("#balance-total");
const barCanvas = document.querySelector("#bar-chart");
const pieCanvas = document.querySelector("#pie-chart");
const donutCanvas = document.querySelector("#donut-chart");
const form = document.querySelector("#tx-form");
const formTitle = document.querySelector("#form-title");
const formError = document.querySelector("#form-error");
const typeInput = document.querySelector("#type");
const amountInput = document.querySelector("#amount");
const categoryInput = document.querySelector("#category");
const dateInput = document.querySelector("#date");
const noteInput = document.querySelector("#note");
const saveBtn = document.querySelector("#save-btn");
const cancelBtn = document.querySelector("#cancel-btn");
const deleteBtn = document.querySelector("#delete-btn");
const typeFilter = document.querySelector("#type-filter");
const searchInput = document.querySelector("#search");
const txBody = document.querySelector("#tx-body");
const emptyList = document.querySelector("#empty-list");
const tabButtons = [...document.querySelectorAll("[data-tab]")];
const tabStage = document.querySelector(".tab-stage");

let transactions = loadTransactions();
let editingId = null;

init();

function init() {
  const today = new Date();
  applyTheme(savedTheme());
  monthInput.value = toMonthValue(today);
  dateInput.value = toDateValue(today);
  fillCategories("income");
  render();

  themeToggle.addEventListener("click", () => {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    drawCharts();
  });
  monthInput.addEventListener("change", render);
  typeFilter.addEventListener("change", renderList);
  searchInput.addEventListener("input", renderList);
  typeInput.addEventListener("change", () => fillCategories(typeInput.value));
  form.addEventListener("submit", onSubmit);
form.addEventListener("input", hideError);
  cancelBtn.addEventListener("click", resetForm);
  deleteBtn.addEventListener("click", () => removeTransaction(editingId));
  txBody.addEventListener("click", onTableClick);
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => showTab(button.dataset.tab));
  });
  document.querySelector(".tabs").addEventListener("keydown", onTabKey);
  window.addEventListener("resize", drawCharts);
}

function showTab(name) {
  const next = document.querySelector(`#panel-${name}`);
  const current = document.querySelector(".tab-panel.is-active");
  tabButtons.forEach((button) => {
    const selected = button.dataset.tab === name;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  if (!next || next === current) return;
  const fromHeight = current ? current.offsetHeight : 0;
  tabStage.style.height = `${fromHeight}px`;
  current?.classList.remove("is-active");
  if (current) current.setAttribute("aria-hidden", "true");
  next.classList.add("is-active");
  next.setAttribute("aria-hidden", "false");
  const toHeight = next.offsetHeight;
  requestAnimationFrame(() => {
    tabStage.style.height = `${toHeight}px`;
    drawCharts();
  });
  window.setTimeout(() => {
    if (next.classList.contains("is-active")) tabStage.style.height = "";
    drawCharts();
  }, 420);
}

function onTabKey(event) {
  const order = ["ArrowRight", "ArrowLeft", "Home", "End"];
  if (!order.includes(event.key)) return;
  const index = tabButtons.findIndex((button) => button.getAttribute("aria-selected") === "true");
  let next = index;
  if (event.key === "ArrowRight") next = (index + 1) % tabButtons.length;
  if (event.key === "ArrowLeft") next = (index - 1 + tabButtons.length) % tabButtons.length;
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = tabButtons.length - 1;
  event.preventDefault();
  showTab(tabButtons[next].dataset.tab);
  tabButtons[next].focus();
}

function savedTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === "dark";
  themeToggle.textContent = dark ? "Светлая тема" : "Тёмная тема";
  themeToggle.setAttribute("aria-pressed", String(dark));
  localStorage.setItem(THEME_KEY, theme);
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function loadTransactions() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    const seed = createSeed();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function createSeed() {
  const now = new Date();
  const day = (offset) => {
    const date = new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() - offset));
    return toDateValue(date);
  };
  const rows = [
    ["income", 85000, "Зарплата", day(10), "Основная выплата"],
    ["income", 12000, "Подработка", day(4), "Проект на выходных"],
    ["expense", 28000, "Жильё", day(9), "Аренда"],
    ["expense", 14600, "Еда", day(6), "Продукты"],
    ["expense", 3200, "Транспорт", day(3), "Проезд"],
    ["expense", 2100, "Здоровье", day(2), "Аптека"],
    ["expense", 4500, "Развлечения", day(1), "Кино и кафе"],
  ];
  return rows.map(([type, amount, category, date, note], index) => ({
    id: `seed-${index + 1}`,
    type,
    amount,
    category,
    date,
    note,
  }));
}

function monthTransactions() {
  const month = monthInput.value;
  return transactions.filter((item) => item.date.slice(0, 7) === month);
}

function visibleTransactions() {
  const query = searchInput.value.trim().toLowerCase();
  return monthTransactions().filter((item) => {
    if (typeFilter.value !== "all" && item.type !== typeFilter.value) return false;
    if (!query) return true;
    return item.category.toLowerCase().includes(query) || item.note.toLowerCase().includes(query);
  });
}

function render() {
  renderSummary();
  drawCharts();
  renderList();
}

function renderSummary() {
  const rows = monthTransactions();
  const income = sumByType(rows, "income");
  const expense = sumByType(rows, "expense");
  const balance = income - expense;
  incomeTotal.textContent = formatMoney(income);
  expenseTotal.textContent = formatMoney(expense);
  balanceTotal.textContent = formatMoney(balance);
  balanceTotal.classList.toggle("positive", balance > 0);
  balanceTotal.classList.toggle("negative", balance < 0);
}

function renderList() {
  const rows = visibleTransactions().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  emptyList.hidden = rows.length > 0;
emptyList.textContent = monthTransactions().length === 0
  ? "За этот месяц операций нет"
  : "Ничего не найдено";
  txBody.innerHTML = rows.map((item) => `
    <tr data-id="${escapeHtml(item.id)}" class="${item.id === editingId ? "active" : ""}">
      <td>${formatDate(item.date)}</td>
      <td><span class="badge ${item.type}">${item.type === "income" ? "Доход" : "Расход"}</span></td>
      <td>${escapeHtml(item.category)}</td>
      <td>${escapeHtml(item.note || "—")}</td>
      <td class="amount ${item.type}">${item.type === "expense" ? "−" : "+"}${formatMoney(item.amount)}</td>
      <td><button type="button" class="row-delete" data-delete="${escapeHtml(item.id)}">Удалить</button></td>
    </tr>
  `).join("");
}

function onTableClick(event) {
  const deleteId = event.target.closest("[data-delete]")?.dataset.delete;
  if (deleteId) {
    event.stopPropagation();
    removeTransaction(deleteId);
    return;
  }
  const row = event.target.closest("tr[data-id]");
  if (row) startEdit(row.dataset.id);
}

function onSubmit(event) {
  event.preventDefault();
  const amount = Number(amountInput.value);
  const date = dateInput.value;
  if (!Number.isFinite(amount) || amount <= 0) {
    showError("Укажите сумму больше нуля.");
    return;
  }
  if (!date) {
    showError("Укажите дату.");
    return;
  }
  const payload = {
    type: typeInput.value,
    amount: Math.round(amount * 100) / 100,
    category: categoryInput.value,
    date,
    note: noteInput.value.trim(),
  };
  if (editingId) {
    transactions = transactions.map((item) => (item.id === editingId ? { ...item, ...payload } : item));
  } else {
    transactions.push({ id: createId(), ...payload });
  }
  saveTransactions();
  if (payload.date.slice(0, 7) !== monthInput.value) {
    monthInput.value = payload.date.slice(0, 7);
  }
  resetForm();
  render();
  showTab("list");
}

function startEdit(id) {
  const item = transactions.find((row) => row.id === id);
  if (!item) return;
  editingId = id;
  formTitle.textContent = "Редактирование";
  saveBtn.textContent = "Сохранить";
  cancelBtn.hidden = false;
  deleteBtn.hidden = false;
  typeInput.value = item.type;
  fillCategories(item.type, item.category);
  amountInput.value = String(item.amount);
  dateInput.value = item.date;
  noteInput.value = item.note;
  hideError();
  renderList();
  showTab("form");
}

function removeTransaction(id) {
  if (!id) return;
  const item = transactions.find((row) => row.id === id);
  if (!item) return;
  const label = `${item.category}, ${formatMoney(item.amount)}`;
  if (!window.confirm(`Удалить операцию «${label}»?`)) return;
  transactions = transactions.filter((row) => row.id !== id);
  saveTransactions();
  if (editingId === id) resetForm();
  render();
}

function resetForm() {
  editingId = null;
  form.reset();
  formTitle.textContent = "Новая операция";
  saveBtn.textContent = "Добавить";
  cancelBtn.hidden = true;
  deleteBtn.hidden = true;
  dateInput.value = toDateValue(new Date());
  typeInput.value = "income";
  fillCategories("income");
  hideError();
  renderList();
}

function fillCategories(type, selected) {
  const list = CATEGORIES[type] || CATEGORIES.expense;
  categoryInput.innerHTML = list.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  if (selected && list.includes(selected)) categoryInput.value = selected;
}

function showError(message) {
  formError.hidden = false;
  formError.textContent = message;
}

function hideError() {
  formError.hidden = true;
  formError.textContent = "";
}

function drawCharts() {
  const rows = monthTransactions();
  drawBarChart(barCanvas, rows);
  drawPieChart(pieCanvas, rows);
  drawDonutChart(donutCanvas, rows.filter((item) => item.type === "expense"));
}

function drawBarChart(canvas, rows) {
  const { ctx, width, height } = fitCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  const map = new Map();
  rows.forEach((item) => {
    const entry = map.get(item.category) || { category: item.category, income: 0, expense: 0 };
    entry[item.type] += item.amount;
    map.set(item.category, entry);
  });
  const items = [...map.values()];
  if (!items.length) {
    drawEmpty(ctx, width, height);
    return;
  }

  const pad = { top: 48, right: 22, bottom: 78, left: 56 };
  const max = Math.max(...items.flatMap((item) => [item.income, item.expense]), 1);
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const groupW = innerW / items.length;
  const barW = Math.min(16, groupW * 0.28);

  drawLegend(ctx, pad.left, 8, [
    [cssVar("--income"), "Доходы"],
    [cssVar("--expense"), "Расходы"],
  ]);

  ctx.font = "11px Segoe UI, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = cssVar("--grid");
  ctx.lineWidth = 1;
  for (let tick = 0; tick <= 4; tick += 1) {
    const value = (max / 4) * tick;
    const y = pad.top + innerH - (value / max) * innerH;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    ctx.fillStyle = cssVar("--muted");
    ctx.fillText(compactNumber(value), pad.left - 8, y);
  }

  items.forEach((item, index) => {
    const center = pad.left + groupW * index + groupW / 2;
    const base = pad.top + innerH;
    drawVBar(ctx, center - barW - 2, base - (item.income / max) * innerH, barW, (item.income / max) * innerH, cssVar("--income"));
    drawVBar(ctx, center + 2, base - (item.expense / max) * innerH, barW, (item.expense / max) * innerH, cssVar("--expense"));
    ctx.save();
    ctx.translate(center, base + 8);
    ctx.rotate(-Math.PI / 5);
    ctx.fillStyle = cssVar("--ink");
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(item.category, 0, 0);
    ctx.restore();
  });
}

function drawPieChart(canvas, rows) {
  const { ctx, width, height } = fitCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  const items = categorySlices(rows);
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  if (!total) {
    drawEmpty(ctx, width, height);
    return;
  }

  const names = items.map((item) => item.category);
  const legendW = Math.min(210, width * 0.42);
  const depth = 18;
  const cx = Math.max(78, (width - legendW) / 2);
  const rx = Math.max(52, Math.min(cx - 16, (height - depth - 28) / 1.35));
  const ry = rx * 0.58;
  const cy = (height - depth) / 2 + 4;
  let angle = -Math.PI / 2;
  let incomeIndex = 0;
  let expenseIndex = 0;
  const slices = [];

  items.forEach((item) => {
    const sweep = (item.amount / total) * Math.PI * 2;
    const color = item.type === "income"
      ? ["#1f8a5b", "#3aa36e", "#67b48a", "#147a62", "#8fcaa6"][incomeIndex++ % 5]
      : DONUT_COLORS[expenseIndex++ % DONUT_COLORS.length];
    item.color = color;
    slices.push({ start: angle, end: angle + sweep, color });
    angle += sweep;
  });

  ctx.fillStyle = "rgba(40, 32, 20, 0.08)";
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy + depth + 6, rx * 0.9, ry * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  [...slices].sort((a, b) => frontness(a) - frontness(b)).forEach((slice) => {
    drawPieSide(ctx, cx, cy, rx, ry, depth, slice.start, slice.end, shade(slice.color, 0.68));
  });

  slices.forEach((slice) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.ellipse(cx, cy, rx, ry, 0, slice.start, slice.end);
    ctx.closePath();
    ctx.fillStyle = slice.color;
    ctx.fill();
  });

  const legendX = width - legendW;
  ctx.font = "13px Segoe UI, sans-serif";
  items.forEach((item, index) => {
    const y = 16 + index * 24;
    const repeated = names.indexOf(item.category) !== names.lastIndexOf(item.category);
    const name = repeated
      ? `${item.category} · ${item.type === "income" ? "доход" : "расход"}`
      : item.category;
    const share = Math.round((item.amount / total) * 100);
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(legendX + 6, y + 6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cssVar("--ink");
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(trimText(ctx, `${name} ${share}%`, legendW - 24), legendX + 18, y - 1);
  });
}

function categorySlices(rows) {
  const map = new Map();
  rows.forEach((item) => {
    const key = `${item.type}:${item.category}`;
    const entry = map.get(key) || { category: item.category, type: item.type, amount: 0 };
    entry.amount += item.amount;
    map.set(key, entry);
  });
  return [...map.values()].filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount);
}

function drawDonutChart(canvas, rows) {
  const { ctx, width, height } = fitCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  const map = new Map();
  rows.forEach((item) => map.set(item.category, (map.get(item.category) || 0) + item.amount));
  const items = [...map.entries()].map(([category, amount]) => ({ category, amount }));
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  if (!total) {
    drawEmpty(ctx, width, height);
    return;
  }

  const legendW = Math.min(180, width * 0.38);
  const cx = (width - legendW) / 2;
  const cy = height / 2 + 6;
  const radius = Math.max(48, Math.min(cx - 16, cy - 20, height - cy - 12));
  const inner = radius * 0.62;
  let angle = -Math.PI / 2;

  items.forEach((item, index) => {
    const slice = (item.amount / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = DONUT_COLORS[index % DONUT_COLORS.length];
    ctx.fill();
    angle += slice;
  });

  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.fillStyle = cssVar("--card");
  ctx.fill();
  ctx.fillStyle = cssVar("--ink");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 14px Segoe UI, sans-serif";
  ctx.fillText(formatMoney(total), cx, cy - 8);
  ctx.fillStyle = cssVar("--muted");
  ctx.font = "12px Segoe UI, sans-serif";
  ctx.fillText("расходы", cx, cy + 12);

  const legendX = width - legendW;
  items.forEach((item, index) => {
    const y = 28 + index * 28;
    ctx.fillStyle = DONUT_COLORS[index % DONUT_COLORS.length];
    ctx.fillRect(legendX, y, 12, 12);
    ctx.fillStyle = cssVar("--ink");
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = "13px Segoe UI, sans-serif";
    const share = Math.round((item.amount / total) * 100);
    ctx.fillText(trimText(ctx, `${item.category} ${share}%`, legendW - 22), legendX + 18, y - 1);
  });
}

function drawVBar(ctx, x, y, width, height, color) {
  if (height <= 0) return;
  const dx = 6;
  const dy = -5;
  ctx.fillStyle = shade(color, 0.68);
  ctx.beginPath();
  ctx.moveTo(x + width, y + 2);
  ctx.lineTo(x + width + dx, y + dy);
  ctx.lineTo(x + width + dx, y + height + dy);
  ctx.lineTo(x + width, y + height);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(color, 1.16);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx, y + dy);
  ctx.lineTo(x + width + dx, y + dy);
  ctx.lineTo(x + width, y + 2);
  ctx.closePath();
  ctx.fill();
  const face = ctx.createLinearGradient(x, y, x + width, y);
  face.addColorStop(0, shade(color, 1.08));
  face.addColorStop(1, shade(color, 0.9));
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, [3, 0, 0, 0]);
  ctx.fill();
}

function drawPieSide(ctx, cx, cy, rx, ry, depth, start, end, color) {
  const steps = Math.max(10, Math.ceil((end - start) / 0.06));
  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const a = start + ((end - start) * i) / steps;
    const px = cx + Math.cos(a) * rx;
    const py = cy + Math.sin(a) * ry;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  for (let i = steps; i >= 0; i -= 1) {
    const a = start + ((end - start) * i) / steps;
    ctx.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry + depth);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function frontness(slice) {
  let peak = -1;
  const steps = 8;
  for (let i = 0; i <= steps; i += 1) {
    const a = slice.start + ((slice.end - slice.start) * i) / steps;
    peak = Math.max(peak, Math.sin(a));
  }
  return peak;
}

function shade(hex, factor) {
  const value = parseInt(hex.slice(1), 16);
  const channel = (shift) => Math.min(255, Math.max(0, Math.round(((value >> shift) & 255) * factor)));
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

function compactNumber(value) {
  if (value >= 1000) {
    const thousands = value / 1000;
    const text = Number.isInteger(thousands) ? String(thousands) : thousands.toFixed(1).replace(".", ",");
    return `${text} тыс.`;
  }
  return String(Math.round(value));
}

function drawLegend(ctx, x, y, items) {
  let cursor = x;
  ctx.font = "13px Segoe UI, sans-serif";
  ctx.textBaseline = "top";
  items.forEach(([color, label]) => {
    ctx.fillStyle = color;
    ctx.fillRect(cursor, y + 2, 12, 12);
    ctx.fillStyle = cssVar("--ink");
    ctx.textAlign = "left";
    ctx.fillText(label, cursor + 18, y);
    cursor += ctx.measureText(label).width + 40;
  });
}

function drawEmpty(ctx, width, height) {
  ctx.fillStyle = cssVar("--muted");
  ctx.font = "15px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Нет данных", width / 2, height / 2);
}

function fitCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 320;
  const height = canvas.clientHeight || 320;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width, height };
}

function sumByType(rows, type) {
  return rows.filter((item) => item.type === type).reduce((sum, item) => sum + item.amount, 0);
}

function formatMoney(value) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

function toDateValue(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function toMonthValue(date) {
  return toDateValue(date).slice(0, 7);
}

function createId() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function trimText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
