const STORAGE_KEY = "reservas-colegio-v1";
const OPEN_TIME = "07:20";
const CLOSE_TIME = "18:15";
const $ = id => document.getElementById(id);
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const minutes = time => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
const prettyDate = iso => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
const defaultSpaces = [
  ["Laboratório de Ciências", "Laboratório", 30, "Bancadas, microscópios e materiais de ciências"],
  ["Biblioteca", "Biblioteca", 40, "Acervo, mesas de estudo e computadores"],
  ["Laboratório de Informática 1", "Laboratório", 30, "Computadores e acesso à internet"],
  ["Laboratório de Informática 2", "Laboratório", 30, "Computadores e acesso à internet"],
  ["Laboratório de Informática 3", "Laboratório", 30, "Computadores e acesso à internet"],
  ["Auditório", "Auditório", 120, "Projetor, sistema de som e microfone"]
];
const sampleDate = todayISO();
const initialData = () => ({
  spaces: defaultSpaces.map(([name, type, capacity, resources]) => ({ id: uid(), name, type, capacity, resources })),
  bookings: [
    { id: uid(), spaceName: "Biblioteca", date: sampleDate, start: "08:00", end: "09:00", teacher: "Carolina", className: "1º DS", purpose: "Leitura orientada" },
    { id: uid(), spaceName: "Laboratório de Informática 1", date: sampleDate, start: "09:00", end: "10:30", teacher: "Patrick", className: "2º DS", purpose: "Atividade de programação" }
  ]
});
let state = loadData();

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { const fresh = initialData(); localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)); return fresh; }
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.spaces) || !Array.isArray(parsed.bookings)) throw new Error("Formato de dados inválido.");
    return parsed;
  } catch (error) {
    console.error("Falha ao carregar dados:", error);
    $("storage-note").textContent = "Não foi possível ler os dados locais; iniciando com exemplos.";
    const fresh = initialData();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)); } catch (saveError) { console.error(saveError); }
    return fresh;
  }
}
function saveData() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); $("storage-note").textContent = "Dados salvos neste dispositivo."; return true; }
  catch (error) { console.error("Falha ao salvar:", error); alert("Não foi possível salvar. Verifique o espaço disponível e as permissões do navegador."); return false; }
}
function showView(name) {
  document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== `view-${name}`);
  document.querySelectorAll(".tab").forEach(b => { const active = b.dataset.view === name; b.classList.toggle("active", active); if (active) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  if (name === "agenda") renderAgenda(); if (name === "reservas") renderBookings(); if (name === "espacos") renderSpaces();
}
document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => showView(b.dataset.view)));
function populateSpaceSelects() {
  const opts = state.spaces.map(s => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)}</option>`).join("");
  $("booking-space").innerHTML = opts || '<option value="">Cadastre um espaço primeiro</option>';
  $("agenda-space").innerHTML = '<option value="">Todos os espaços</option>' + state.spaces.map(s => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)}</option>`).join("");
  const selected = $("agenda-space").value;
  const teachers = [...new Set(state.bookings.map(b => b.teacher).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  $("agenda-teacher").innerHTML = '<option value="">Todos</option>' + teachers.map(t => `<option>${escapeHTML(t)}</option>`).join("");
  if (selected && state.spaces.some(s => s.id === selected)) $("agenda-space").value = selected;
}
function renderAgenda() {
  populateSpaceSelects();
  const reference = $("agenda-date").value || todayISO(), mode = $("agenda-mode").value;
  const filterSpace = $("agenda-space").value, filterTeacher = $("agenda-teacher").value;
  const startDate = new Date(`${reference}T12:00:00`);
  const monday = new Date(startDate); const day = (monday.getDay() + 6) % 7; monday.setDate(monday.getDate() - day);
  const dates = mode === "day" ? [reference] : Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  const matching = state.bookings.filter(b => (!filterSpace || state.spaces.find(s => s.id === filterSpace)?.name === b.spaceName) && (!filterTeacher || b.teacher === filterTeacher) && dates.includes(b.date));
  $("agenda-summary").textContent = `${matching.length} reserva(s) ${mode === "day" ? "neste dia" : "nesta semana"}.`;
  $("agenda-content").innerHTML = dates.map(date => {
    const rows = matching.filter(b => b.date === date).sort((a, b) => a.start.localeCompare(b.start));
    return `<article class="day-card"><div class="day-title"><h3>${escapeHTML(prettyDate(date))}</h3><span>${rows.length} reserva(s)</span></div>${rows.length ? rows.map(b => `<div class="event"><div><strong>${escapeHTML(b.start)}–${escapeHTML(b.end)} · ${escapeHTML(b.spaceName)}</strong><small>${escapeHTML(b.teacher)} · ${escapeHTML(b.className)} · ${escapeHTML(b.purpose)}</small></div></div>`).join("") : '<div class="muted">Nenhuma reserva neste dia.</div>'}</article>`;
  }).join("");
}
function renderBookings() {
  populateSpaceSelects();
  const from = $("booking-filter-date").value, query = $("booking-search").value.trim().toLocaleLowerCase("pt-BR");
  const rows = state.bookings.filter(b => (!from || b.date >= from) && [b.teacher, b.className, b.purpose, b.spaceName].join(" ").toLocaleLowerCase("pt-BR").includes(query)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  $("booking-list").innerHTML = rows.length ? rows.map(b => `<article class="booking-card"><div class="booking-main"><strong>${escapeHTML(b.spaceName)} · ${escapeHTML(b.date)} · ${escapeHTML(b.start)}–${escapeHTML(b.end)}</strong><p>${escapeHTML(b.teacher)} · ${escapeHTML(b.className)} · ${escapeHTML(b.purpose)}</p></div><div class="actions"><button class="secondary" data-edit-booking="${escapeHTML(b.id)}">Editar</button><button class="danger" data-cancel-booking="${escapeHTML(b.id)}">Cancelar</button></div></article>`).join("") : '<div class="empty">Nenhuma reserva encontrada.</div>';
}
function renderSpaces() {
  $("space-list").innerHTML = state.spaces.length ? state.spaces.map(s => `<article class="card space-card"><h3>${escapeHTML(s.name)}</h3><p>${escapeHTML(s.type)} · Capacidade: ${s.capacity}</p><p>Recursos: ${escapeHTML(s.resources || "Não informados")}</p><div class="actions"><button class="secondary" data-edit-space="${escapeHTML(s.id)}">Editar</button><button class="danger" data-delete-space="${escapeHTML(s.id)}">Excluir</button></div></article>`).join("") : '<div class="empty">Nenhum espaço cadastrado.</div>';
}
function openBooking(id = "") {
  if (!state.spaces.length) { alert("Cadastre um espaço antes de criar uma reserva."); showView("espacos"); return; }
  $("booking-form").reset(); $("booking-error").textContent = ""; $("booking-id").value = id;
  $("booking-date").min = todayISO(); $("booking-start").min = OPEN_TIME; $("booking-start").max = CLOSE_TIME; $("booking-end").min = OPEN_TIME; $("booking-end").max = CLOSE_TIME;
  populateSpaceSelects();
  const b = state.bookings.find(x => x.id === id);
  $("booking-dialog-title").textContent = b ? "Editar reserva" : "Nova reserva";
  if (b) { $("booking-space").value = state.spaces.find(s => s.name === b.spaceName)?.id || ""; $("booking-date").value = b.date; $("booking-start").value = b.start; $("booking-end").value = b.end; $("booking-teacher").value = b.teacher; $("booking-class").value = b.className; $("booking-purpose").value = b.purpose; }
  else { $("booking-date").value = todayISO(); }
  $("booking-dialog").showModal();
}
$("booking-form").addEventListener("submit", e => {
  e.preventDefault();
  const id = $("booking-id").value, space = state.spaces.find(s => s.id === $("booking-space").value);
  const booking = { id: id || uid(), spaceName: space?.name || "", date: $("booking-date").value, start: $("booking-start").value, end: $("booking-end").value, teacher: $("booking-teacher").value.trim(), className: $("booking-class").value.trim(), purpose: $("booking-purpose").value.trim() };
  const error = validateBooking(booking, id);
  if (error) { $("booking-error").textContent = error; return; }
  if (id) { state.bookings = state.bookings.map(b => b.id === id ? booking : b); } else state.bookings.push(booking);
  if (saveData()) { $("booking-dialog").close(); renderAll(); }
});
function validateBooking(b, editingId) {
  if (!b.spaceName || !b.date || !b.start || !b.end || !b.teacher || !b.className || !b.purpose) return "Preencha todos os campos obrigatórios.";
  if (b.date < todayISO()) return "Não é permitido reservar em uma data passada.";
  if (b.start < OPEN_TIME || b.end > CLOSE_TIME) return `O horário deve ficar entre ${OPEN_TIME} e ${CLOSE_TIME}.`;
  if (minutes(b.end) <= minutes(b.start)) return "O horário de fim deve ser maior que o horário de início.";
  const conflict = state.bookings.some(other => other.id !== editingId && other.spaceName === b.spaceName && other.date === b.date && minutes(b.start) < minutes(other.end) && minutes(b.end) > minutes(other.start));
  if (conflict) return "Já existe uma reserva neste espaço em um horário que se sobrepõe.";
  return "";
}
function openSpace(id = "") {
  $("space-form").reset(); $("space-error").textContent = ""; $("space-id").value = id;
  const s = state.spaces.find(x => x.id === id); $("space-dialog-title").textContent = s ? "Editar espaço" : "Novo espaço";
  if (s) { $("space-name").value = s.name; $("space-type").value = s.type; $("space-capacity").value = s.capacity; $("space-resources").value = s.resources; }
  $("space-dialog").showModal();
}
$("space-form").addEventListener("submit", e => {
  e.preventDefault(); const id = $("space-id").value, name = $("space-name").value.trim(), type = $("space-type").value, capacity = Number($("space-capacity").value), resources = $("space-resources").value.trim();
  if (!name || !Number.isInteger(capacity) || capacity < 1) { $("space-error").textContent = "Informe nome e capacidade válida."; return; }
  if (state.spaces.some(s => s.id !== id && s.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) { $("space-error").textContent = "Já existe um espaço com esse nome."; return; }
  if (id) { const old = state.spaces.find(s => s.id === id); const previous = old.name; old.name = name; old.type = type; old.capacity = capacity; old.resources = resources; if (previous !== name) state.bookings.forEach(b => { if (b.spaceName === previous) b.spaceName = name; }); }
  else state.spaces.push({ id: uid(), name, type, capacity, resources });
  if (saveData()) { $("space-dialog").close(); renderAll(); }
});
document.addEventListener("click", e => {
  const editBooking = e.target.closest("[data-edit-booking]"); if (editBooking) openBooking(editBooking.dataset.editBooking);
  const cancel = e.target.closest("[data-cancel-booking]"); if (cancel && confirm("Cancelar esta reserva?")) { state.bookings = state.bookings.filter(b => b.id !== cancel.dataset.cancelBooking); if (saveData()) renderAll(); }
  const editSpace = e.target.closest("[data-edit-space]"); if (editSpace) openSpace(editSpace.dataset.editSpace);
  const del = e.target.closest("[data-delete-space]"); if (del) { const s = state.spaces.find(x => x.id === del.dataset.deleteSpace); const used = state.bookings.some(b => b.spaceName === s.name); if (used) { alert("Este espaço possui reservas. Cancele ou remova as reservas relacionadas antes de excluí-lo."); return; } if (confirm(`Excluir "${s.name}"?`)) { state.spaces = state.spaces.filter(x => x.id !== s.id); if (saveData()) renderAll(); } }
  const close = e.target.closest("[data-close]"); if (close) $(close.dataset.close).close();
});
$("new-booking").addEventListener("click", () => openBooking());
$("new-booking-from-agenda").addEventListener("click", () => openBooking());
$("new-space").addEventListener("click", () => openSpace());
["agenda-date", "agenda-mode", "agenda-space", "agenda-teacher"].forEach(id => $(id).addEventListener("change", renderAgenda));
["booking-filter-date", "booking-search"].forEach(id => $(id).addEventListener(id === "booking-search" ? "input" : "change", renderBookings));
function renderAll() { populateSpaceSelects(); renderAgenda(); renderBookings(); renderSpaces(); }
$("agenda-date").value = todayISO(); $("booking-filter-date").value = todayISO();
renderAll();
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("./service-worker.js").then(() => console.info("Service worker registrado.")).catch(err => console.warn("Falha ao registrar service worker:", err));
}
function updateConnection() { const online = navigator.onLine; $("connection-status").textContent = online ? "● Online" : "● Offline"; $("connection-status").style.color = online ? "#c8f2d4" : "#ffd2a8"; }
window.addEventListener("online", updateConnection); window.addEventListener("offline", updateConnection); updateConnection();
