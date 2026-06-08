/**
 * script.js — Taskboard frontend logic
 *
 * Architecture:
 *  - All state lives in the `todos` array.
 *  - Every mutation (add / update / delete) calls the FastAPI backend first,
 *    then updates the local state + re-renders on success.
 *  - No page reloads; the DOM is manipulated surgically for animations.
 */

// ── Configuration ────────────────────────────────────────────────────────────
// Change this if your backend runs on a different host or port.
const API_BASE = "https://todo-app-production-554b.up.railway.app";
// ── State ────────────────────────────────────────────────────────────────────
let todos = [];           // Local mirror of the database rows
let editingId = null;     // ID of the todo currently being edited

// ── DOM refs ─────────────────────────────────────────────────────────────────
const taskInput     = document.getElementById("taskInput");
const addBtn        = document.getElementById("addBtn");
const formMsg       = document.getElementById("formMsg");
const taskCount     = document.getElementById("taskCount");
const loadingState  = document.getElementById("loadingState");
const emptyState    = document.getElementById("emptyState");
const todoList      = document.getElementById("todoList");
const editModal     = document.getElementById("editModal");
const editInput     = document.getElementById("editInput");
const editMsg       = document.getElementById("editMsg");
const saveEditBtn   = document.getElementById("saveEditBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const toast         = document.getElementById("toast");

// ── Utility helpers ───────────────────────────────────────────────────────────

/** Display a short toast notification at the bottom of the screen. */
function showToast(message, duration = 2400) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), duration);
}

/** Show/hide an inline error message; passing '' hides it. */
function setMsg(el, message) {
  el.textContent = message;
}

/** Disable / enable the Add button while a request is in-flight. */
function setAddLoading(loading) {
  addBtn.disabled = loading;
  addBtn.querySelector(".btn__label").textContent = loading ? "Adding…" : "Add";
}

/** Update the "N tasks" counter in the stats bar. */
function updateCount() {
  const n = todos.length;
  taskCount.textContent = n === 1 ? "1 task" : `${n} tasks`;
}

// ── Rendering ─────────────────────────────────────────────────────────────────

/**
 * Render the current `todos` array into the DOM.
 * Called after every state change.
 */
function render() {
  updateCount();

  // Switch visibility of loading / empty / list states
  loadingState.hidden = true;

  if (todos.length === 0) {
    emptyState.hidden = false;
    todoList.hidden   = true;
    return;
  }

  emptyState.hidden = false;
  emptyState.hidden = true;
  todoList.hidden   = false;

  // Build the full list HTML in one pass (avoids per-item DOM queries)
  todoList.innerHTML = todos
    .map(
      (todo, idx) => `
      <li class="todo-item" data-id="${todo.id}">
        <span class="todo-item__index" aria-hidden="true">${String(idx + 1).padStart(2, "0")}</span>
        <span class="todo-item__text">${escapeHtml(todo.task)}</span>
        <div class="todo-item__actions">
          <button
            class="btn btn--edit"
            data-action="edit"
            data-id="${todo.id}"
            aria-label="Edit task: ${escapeHtml(todo.task)}"
          >Edit</button>
          <button
            class="btn btn--delete"
            data-action="delete"
            data-id="${todo.id}"
            aria-label="Delete task: ${escapeHtml(todo.task)}"
          >Delete</button>
        </div>
      </li>`
    )
    .join("");
}

/** Escape user-supplied text for safe insertion into innerHTML. */
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── API calls ─────────────────────────────────────────────────────────────────

/** GET /todos — Fetch all tasks from the backend. */
async function fetchTodos() {
  try {
    const res = await fetch(`${API_BASE}/todos`);
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();
    todos = data.todos || [];
    render();
  } catch (err) {
    loadingState.hidden = true;
    emptyState.hidden   = false;
    emptyState.querySelector(".empty__text").textContent =
      "Could not load tasks. Is the backend running?";
    console.error("fetchTodos:", err);
  }
}

/** POST /todos — Create a new task. */
async function addTodo(task) {
  const res = await fetch(`${API_BASE}/todos`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ task }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error: ${res.status}`);
  }
  return (await res.json()).todo;
}

/** PUT /todos/:id — Update an existing task. */
async function updateTodo(id, task) {
  const res = await fetch(`${API_BASE}/todos/${id}`, {
    method:  "PUT",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ task }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error: ${res.status}`);
  }
  return (await res.json()).todo;
}

/** DELETE /todos/:id — Remove a task. */
async function deleteTodo(id) {
  const res = await fetch(`${API_BASE}/todos/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error: ${res.status}`);
  }
}

// ── Event handlers ────────────────────────────────────────────────────────────

/** Handle the "Add Task" button click. */
async function handleAdd() {
  const task = taskInput.value.trim();
  setMsg(formMsg, "");

  if (!task) {
    setMsg(formMsg, "Please enter a task first.");
    taskInput.focus();
    return;
  }

  setAddLoading(true);
  try {
    const newTodo = await addTodo(task);
    todos.unshift(newTodo);   // Prepend so it appears at the top
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

/** Handle clicks inside the todo list (edit / delete) via event delegation. */
async function handleListClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const id     = parseInt(btn.dataset.id, 10);

  if (action === "edit") {
    openEditModal(id);
  } else if (action === "delete") {
    await handleDelete(btn, id);
  }
}

/** Animate out and delete a task. */
async function handleDelete(btn, id) {
  btn.disabled = true;

  // Find the list item and play the remove animation
  const li = todoList.querySelector(`[data-id="${id}"]`);
  if (li) li.classList.add("removing");

  try {
    await deleteTodo(id);
    todos = todos.filter(t => t.id !== id);
    // Small delay lets the CSS animation finish before re-rendering
    setTimeout(render, 200);
    showToast("Task deleted");
  } catch (err) {
    showToast(`Error: ${err.message}`);
    if (li) li.classList.remove("removing");
    btn.disabled = false;
  }
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function openEditModal(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;

  editingId        = id;
  editInput.value  = todo.task;
  setMsg(editMsg, "");

  editModal.hidden = false;
  editInput.focus();
  editInput.select();
}

function closeEditModal() {
  editModal.hidden = true;
  editingId        = null;
  setMsg(editMsg, "");
}

async function handleSaveEdit() {
  const task = editInput.value.trim();
  setMsg(editMsg, "");

  if (!task) {
    setMsg(editMsg, "Task cannot be empty.");
    return;
  }

  saveEditBtn.disabled      = true;
  saveEditBtn.textContent   = "Saving…";

  try {
    const updated = await updateTodo(editingId, task);
    // Replace the old item in local state
    todos = todos.map(t => (t.id === editingId ? updated : t));
    render();
    closeEditModal();
    showToast("Task updated ✓");
  } catch (err) {
    setMsg(editMsg, err.message || "Failed to update task.");
  } finally {
    saveEditBtn.disabled    = false;
    saveEditBtn.textContent = "Save changes";
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────

// Add task on button click
addBtn.addEventListener("click", handleAdd);

// Add task on Enter key
taskInput.addEventListener("keydown", e => {
  if (e.key === "Enter") handleAdd();
});

// List actions (edit / delete) — delegated to the parent <ul>
todoList.addEventListener("click", handleListClick);

// Edit modal controls
saveEditBtn.addEventListener  ("click",   handleSaveEdit);
cancelEditBtn.addEventListener("click",   closeEditModal);
editModal.querySelector(".modal__backdrop").addEventListener("click", closeEditModal);

// Save on Enter inside the edit input
editInput.addEventListener("keydown", e => {
  if (e.key === "Enter") handleSaveEdit();
  if (e.key === "Escape") closeEditModal();
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
fetchTodos();
