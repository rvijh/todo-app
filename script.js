/**
 * script.js — Tasks App
 * Backend: Render (FastAPI) → Supabase
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabase = createClient(
  'https://dmxsltqbhlqwyjuqcsbl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRteHNsdHFiaGxxd3lqdXFjc2JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MzQzMzAsImV4cCI6MjA5NjUxMDMzMH0.3_7YS0WlwpXHNFmtDym7urO_Edins_SvzfpuT9-6b_E'
)
const API_BASE = "https://todo-app-x12i.onrender.com";

// ── State ────────────────────────────────────────────────────────────────────
let todos     = [];
let editingId = null;

// ── DOM refs ─────────────────────────────────────────────────────────────────
const taskInput      = document.getElementById("taskInput");
const addBtn         = document.getElementById("addBtn");
const formMsg        = document.getElementById("formMsg");
const sidebarCount   = document.getElementById("sidebarCount");
const loadingState   = document.getElementById("loadingState");
const emptyState     = document.getElementById("emptyState");
const todoList       = document.getElementById("todoList");
const editModal      = document.getElementById("editModal");
const editInput      = document.getElementById("editInput");
const editMsg        = document.getElementById("editMsg");
const saveEditBtn    = document.getElementById("saveEditBtn");
const cancelEditBtn  = document.getElementById("cancelEditBtn");
const closeModalBtn  = document.getElementById("closeModalBtn");
const toast          = document.getElementById("toast");
const progressCircle = document.getElementById("progressCircle");
const progressPct    = document.getElementById("progressPct");
const currentDate    = document.getElementById("currentDate");

// ── Init date ────────────────────────────────────────────────────────────────
(function setDate() {
  const now = new Date();
  currentDate.textContent = now.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric"
  });
})();

// ── Helpers ───────────────────────────────────────────────────────────────────
function showToast(msg, duration = 2200) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), duration);
}

function setMsg(el, msg) { el.textContent = msg; }

function setAddLoading(on) {
  addBtn.disabled = on;
  addBtn.querySelector(".btn-label").textContent = on ? "Adding…" : "Add";
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── Progress ring ─────────────────────────────────────────────────────────────
function updateProgress() {
  // For now, just show total count (no completed state yet)
  const total = todos.length;
  const pct   = 0; // Will be meaningful once completion is added
  const circumference = 2 * Math.PI * 20; // r=20
  const offset = circumference - (pct / 100) * circumference;
  progressCircle.style.strokeDashoffset = offset;
  progressPct.textContent = total > 0 ? `${total}` : "0";
  sidebarCount.textContent = total;
}

// ── Render ───────────────────────────────────────────────────────────────────
function render() {
  loadingState.hidden = true;
  updateProgress();

  if (todos.length === 0) {
    emptyState.hidden = false;
    todoList.hidden   = true;
    return;
  }

  emptyState.hidden = true;
  todoList.hidden   = false;

  todoList.innerHTML = todos.map((todo, idx) => `
    <li class="todo-item" data-id="${todo.id}">
      <span class="todo-item__num">${String(idx + 1).padStart(2, "0")}</span>
      <span class="todo-item__dot"></span>
      <span class="todo-item__text">${escapeHtml(todo.task)}</span>
      <div class="todo-item__actions">
        <button class="btn btn--edit" data-action="edit" data-id="${todo.id}" aria-label="Edit">Edit</button>
        <button class="btn btn--delete" data-action="delete" data-id="${todo.id}" aria-label="Delete">Delete</button>
      </div>
    </li>
  `).join("");
}

// ── API ───────────────────────────────────────────────────────────────────────
async function fetchTodos() {
  try {
    const res  = await fetch(`${API_BASE}/todos`);
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();
    todos = data.todos || [];
    render();
  } catch (err) {
    loadingState.hidden = true;
    emptyState.hidden   = false;
    emptyState.querySelector(".empty-text").textContent =
      "Could not connect to server.\nIs the backend running?";
    console.error("fetchTodos:", err);
  }
}

async function addTodo(task) {
  const res = await fetch(`${API_BASE}/todos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return (await res.json()).todo;
}

async function updateTodo(id, task) {
  const res = await fetch(`${API_BASE}/todos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return (await res.json()).todo;
}

async function deleteTodo(id) {
  const res = await fetch(`${API_BASE}/todos/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error ${res.status}`);
  }
}

// ── Handlers ─────────────────────────────────────────────────────────────────
async function handleAdd() {
  const task = taskInput.value.trim();
  setMsg(formMsg, "");
  if (!task) { setMsg(formMsg, "Please enter a task."); taskInput.focus(); return; }

  setAddLoading(true);
  try {
    const newTodo = await addTodo(task);
    todos.unshift(newTodo);
    render();
    taskInput.value = "";
    taskInput.focus();
    showToast("Task added ✓");
  } catch (err) {
    setMsg(formMsg, err.message || "Failed to add task.");
  } finally {
    setAddLoading(false);
  }
}

async function handleListClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = parseInt(btn.dataset.id, 10);
  if (btn.dataset.action === "edit") openEditModal(id);
  else if (btn.dataset.action === "delete") handleDelete(btn, id);
}

async function handleDelete(btn, id) {
  btn.disabled = true;
  const li = todoList.querySelector(`[data-id="${id}"]`);
  if (li) li.classList.add("removing");
  try {
    await deleteTodo(id);
    todos = todos.filter(t => t.id !== id);
    setTimeout(render, 210);
    showToast("Task deleted");
  } catch (err) {
    showToast(`Error: ${err.message}`);
    if (li) li.classList.remove("removing");
    btn.disabled = false;
  }
}

function openEditModal(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  editingId       = id;
  editInput.value = todo.task;
  setMsg(editMsg, "");
  editModal.hidden = false;
  editInput.focus();
  editInput.select();
}

function closeEditModal() {
  editModal.hidden = true;
  editingId = null;
  setMsg(editMsg, "");
}

async function handleSaveEdit() {
  const task = editInput.value.trim();
  setMsg(editMsg, "");
  if (!task) { setMsg(editMsg, "Task cannot be empty."); return; }

  saveEditBtn.disabled    = true;
  saveEditBtn.textContent = "Saving…";
  try {
    const updated = await updateTodo(editingId, task);
    todos = todos.map(t => (t.id === editingId ? updated : t));
    render();
    closeEditModal();
    showToast("Task updated ✓");
  } catch (err) {
    setMsg(editMsg, err.message || "Failed to update.");
  } finally {
    saveEditBtn.disabled    = false;
    saveEditBtn.textContent = "Save Changes";
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────
addBtn.addEventListener("click", handleAdd);
taskInput.addEventListener("keydown", e => { if (e.key === "Enter") handleAdd(); });
todoList.addEventListener("click", handleListClick);
saveEditBtn.addEventListener("click", handleSaveEdit);
cancelEditBtn.addEventListener("click", closeEditModal);
closeModalBtn.addEventListener("click", closeEditModal);
editModal.querySelector(".modal__overlay").addEventListener("click", closeEditModal);
editInput.addEventListener("keydown", e => {
  if (e.key === "Enter")  handleSaveEdit();
  if (e.key === "Escape") closeEditModal();
});

// ── Boot ─────────────────────────────────────────────────────────────────────
fetchTodos();
