/* Business operations shared by the UI and assistant. No DOM or storage access. */
const requireText = (value, label, max) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} manquant`);
  return value.trim().slice(0, max);
};
const validDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};
function addTask(tasks, input, id, date) {
  const t = {
    id, title: requireText(input.title, "Tâche", 140), room: input.room || "",
    cat: input.cat || "Bricolage", due: input.due && validDate(input.due) ? input.due : null,
    effort: input.effort || 1, cost: input.cost ?? null, note: input.note || "",
    today: false, done: false, doneAt: null, created: date,
    steps: (input.steps || []).map(s => ({ t: s.t, d: !!s.d }))
  };
  tasks.push(t);
  return t;
}
function setTaskDone(tasks, id, done, date) {
  const t = tasks.find(x => x.id === id);
  if (!t) throw new Error("Tâche introuvable");
  t.done = !!done;
  t.doneAt = done ? date : null;
  if (done) t.today = false;
  return t;
}
function setTaskToday(tasks, id, value) {
  const t = tasks.find(x => x.id === id);
  if (!t) throw new Error("Tâche introuvable");
  if (value && !t.today && tasks.filter(x => !x.done && x.today).length >= 3) throw new Error("Trois tâches du jour maximum");
  t.today = !!value;
  return t;
}
function addCapture(items, text, id, date) {
  const item = { id, text: requireText(text, "Note", 500), date };
  items.push(item);
  return item;
}
function addBudgetEntry(entries, input, id, defaultDate) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Montant invalide");
  const date = input.date || defaultDate;
  if (!validDate(date)) throw new Error("Date invalide");
  const entry = {
    id, type: input.type === "revenu" ? "revenu" : "dépense",
    amount, cat: input.cat || "", note: input.note || "", date
  };
  entries.push(entry);
  return entry;
}
