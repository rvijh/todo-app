import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabase = createClient(
  'https://dmxsltqbhlqwyjuqcsbl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRteHNsdHFiaGxxd3lqdXFjc2JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MzQzMzAsImV4cCI6MjA5NjUxMDMzMH0.3_7YS0WlwpXHNFmtDym7urO_Edins_SvzfpuT9-6b_E'
)

// ── State ─────────────────────────────────────────────────────────────────────
let todos     = [];
let editingId = null;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const taskInput     = document.getElementById("taskInput");
const addBtn        = document.getElementById("addBtn");
const formMsg       = document.getElementById("formMsg");
const sidebarCount  = document.getElementById("sidebarCount");
const loadingState  = document.getElementById("loadingState");
const emptyState    = document.getElementById("emptyState");
const todoList      = document.getElementById("todoList");
const editModal     = document.getElementById("editModal");
const editInput     = document.getElementById("editInput");
const editMsg       = document.getElementById("editMsg");
const saveEditBtn   = document.getElementById("saveEditBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const toast         = document.getElementById("toast");
const progressCircle = document.getElementById("progressCircle");
const progressPct   = document.getElementById("progressPct");
const currentDate   = document.getElementById("currentDate");
const authScreen    = document.getElementById("authScreen");
const authEmail     = document.getElementById("authEmail");
const authBtn       = document.getElementById("authBtn");
const authMsg       = document.getElementById("authMsg");
const logoutBtn     = document.getElementById("logoutBtn");

// ── Date ──────────────────────────────────────────────────────────────────────
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
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── Progress ──────────────────────────────────────────────────────────────────
function updateProgress() {
  const n = todos.length;
  sidebarCount.textContent  = n;
  progressPct.textContent   = n;
}

// ── Render ────────────────────────────────────────────────────────────────────
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
        <button class="btn btn--edit" data-action="edit" data-id="${todo.id}">Edit</button>
        <button class="btn btn--delete" data-action="delete" data-id="${todo.id}">Delete</button>
      </div>
    </li>
  `).join("");
}

// ── Supabase CRUD ─────────────────────────────────────────────────────────────
async function fetchTodos() {
  const { data, error } = await supabase
    .from("todos")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { console.error(error); return; }
  todos = data;
  render();
}

async function addTodoDb(task) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("todos")
    .insert({ task, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateTodoDb(id, task) {
  const { data, error } = await supabase
    .from("todos")
    .update({ task })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteTodoDb(id) {
  const { error } = await supabase
    .from("todos")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ── Handlers ──────────────────────────────────────────────────────────────────
async function handleAdd() {
  const task = taskInput.value.trim();
  setMsg(formMsg, "");
  if (!task) { setMsg(formMsg, "Please enter a task."); return; }
  addBtn.disabled = true;
  addBtn.querySelector(".btn-label").textContent = "Adding…";
  try {
    const newTodo = await addTodoDb(task);
    todos.unshift(newTodo);
    render();
    taskInput.value = "";
    taskInput.focus();
    showToast("Task added ✓");
  } catch (err) {
    setMsg(formMsg, err.message || "Failed to add task.");
  } finally {
    addBtn.disabled = false;
    addBtn.querySelector(".btn-label").textContent = "Add";
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
    await deleteTodoDb(id);
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
  editingId = id;
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
    const updated = await updateTodoDb(editingId, task);
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

// ── Auth ──────────────────────────────────────────────────────────────────────
supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    authScreen.classList.add("hidden");
    fetchTodos();
  } else {
    authScreen.classList.remove("hidden");
    todos = [];
    render();
  }
});

authBtn.addEventListener("click", async () => {
  const email = authEmail.value.trim();
  if (!email) { setMsg(authMsg, "Please enter your email."); return; }
  authBtn.disabled    = true;
  authBtn.textContent = "Sending...";
  setMsg(authMsg, "");
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) {
    authMsg.style.color = "var(--danger)";
    setMsg(authMsg, error.message);
  } else {
    authMsg.style.color = "var(--accent)";
    setMsg(authMsg, "✓ Magic link sent! Check your email.");
  }
  authBtn.disabled    = false;
  authBtn.textContent = "Send Magic Link →";
});

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  showToast("Logged out!");
});

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
