const STORAGE_KEY = 'multiTodo_v1';
let draggedTaskId = null;
let eventsAttached = false;
let lastDeleted = null;
const UNDO_TIMEOUT = 6000;

function uid() { return Math.random().toString(36).slice(2,9); }

function loadData(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { lists: [], activeListId: null };
  }catch(e){ return { lists: [], activeListId: null }; }
}
function saveData(state){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

let state = loadData();

const listsContainer = document.getElementById('listsContainer');
const tasksContainer = document.getElementById('tasksContainer');
const newListName = document.getElementById('newListName');
const addListBtn = document.getElementById('addListBtn');
const addTaskBtn = document.getElementById('addTaskBtn');
const newTaskText = document.getElementById('newTaskText');
const activeListName = document.getElementById('activeListName');
const activeMeta = document.getElementById('activeMeta');
const deleteListBtn = document.getElementById('deleteListBtn');
const renameListBtn = document.getElementById('renameListBtn');
const countLists = document.getElementById('countLists');
const emptyState = document.getElementById('emptyState') || null;
const clearAllBtn = document.getElementById('clearAllBtn');

function init(){
  if(!state || !Array.isArray(state.lists)) state = { lists: [], activeListId: null };

  if((state.activeListId == null || !findList(state.activeListId)) && state.lists.length){
    state.activeListId = state.lists[0].id;
    saveData(state);
  }

  render();
  attachEvents();
}

function findList(id){ return state.lists.find(l=>l.id===id); }
function setActive(id){
  state.activeListId = id;
  saveData(state);
  render();
}

function render(){
  renderLists();
  renderTasks();
  if(countLists) countLists.textContent = `${state.lists.length} lists`;
}

function renderLists(){
  if(!listsContainer) return;
  listsContainer.innerHTML = '';
  state.lists.forEach(list=>{
    const el = document.createElement('div');
    el.className = 'list-item' + (state.activeListId===list.id ? ' active' : '');
    el.setAttribute('role','listitem');
    el.tabIndex = 0;
    el.dataset.id = list.id;
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;width:100%">
        <div style="width:12px;height:12px;border-radius:4px;background:${getListColor(list.id)}"></div>
        <div style="min-width:0">
          <div style="font-weight:700; font-size:13px">${escapeHtml(list.name)}</div>
          <div class="muted" style="font-size:12px">${list.tasks.length} task${list.tasks.length===1? '':'s'}</div>
        </div>
        <div class="meta">${list.tasks.filter(t=>t.done).length} done</div>
      </div>
      <div class="list-controls">
        <button class="small-btn" data-action="delete" data-id="${list.id}" title="Delete list">🗑️</button>
      </div>
    `;
    listsContainer.appendChild(el);
  });
}

function renderTasks(){
  if (!tasksContainer) return;

  const list = findList(state.activeListId);
  if (!list) {
    if (activeListName) activeListName.textContent = 'No list selected';
    if (activeMeta) activeMeta.textContent = '—';
    tasksContainer.innerHTML = '';
    if (emptyState) emptyState.hidden = false;
    return;
  }

  if (activeListName) activeListName.textContent = list.name;
  if (activeMeta) activeMeta.textContent = `${list.tasks.filter(t=>t.done).length}/${list.tasks.length} done`;
  tasksContainer.innerHTML = '';
  if (emptyState) emptyState.hidden = list.tasks.length > 0;

  list.tasks.forEach(task => {
    const t = document.createElement('div');
    t.className = 'task';
    t.setAttribute('role','listitem');
    t.dataset.id = task.id;
    t.draggable = false;

    t.innerHTML = `
      <div class="drag-handle" title="Drag to reorder" aria-label="Drag handle" role="button" tabindex="0">☰</div>
      <button class="check" data-id="${task.id}" title="Toggle done">${task.done ? '✅' : ''}</button>
      <div class="content">
        <div class="text ${task.done? 'completed':''}">${escapeHtml(task.text)}</div>
      </div>
      <div class="icons">
        <button class="small-btn" data-action="edit" data-id="${task.id}" title="Edit">✏️</button>
        <button class="small-btn" data-action="delete" data-id="${task.id}" title="Delete">🗑️</button>
      </div>
    `;

    const handle = t.querySelector('.drag-handle');
    if (handle) {
      handle.addEventListener('mousedown', e => { e.stopPropagation(); t.draggable = true; });
      handle.addEventListener('keydown', e => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); t.draggable = true; draggedTaskId = t.dataset.id; }
      });
    }

    t.addEventListener('dragstart', e => {
      draggedTaskId = t.dataset.id;
      e.dataTransfer && e.dataTransfer.setData && (() => { try { e.dataTransfer.setData('text/plain', t.dataset.id); } catch(_){} })();
      t.classList.add('dragging');
    });
    t.addEventListener('dragover', e => { e.preventDefault(); t.classList.add('drag-over'); });
    t.addEventListener('dragleave', () => t.classList.remove('drag-over'));
    t.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation();
      t.classList.remove('drag-over');
      const targetId = t.dataset.id;
      if (draggedTaskId && targetId) reorderTasks(draggedTaskId, targetId);
    });
    t.addEventListener('dragend', () => { t.draggable = false; draggedTaskId = null; t.classList.remove('dragging'); });

    tasksContainer.appendChild(t);
  });
}

function escapeHtml(str){ return String(str || '').replace(/[&<>"']/g, s=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[s]); }
function getListColor(id){
  const colors = ['#7c5cff','#ff8a65','#4dd0e1','#ffee58','#a5d6a7','#f06292','#9fa8da','#8ed0b3'];
  let n=0; for(let i=0;i<id.length;i++) n=(n*31 + id.charCodeAt(i))%colors.length; return colors[n];
}

function attachEvents(){
  if(eventsAttached) return;
  eventsAttached = true;

  if (tasksContainer) {
    tasksContainer.addEventListener('click', onTasksClick);

    tasksContainer.addEventListener('dragover', (e) => { e.preventDefault(); });
    tasksContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.target !== tasksContainer) return;
      if (!draggedTaskId) return;
      const listRef = findList(state.activeListId);
      if (!listRef) return;
      const fromIndex = listRef.tasks.findIndex(x => x.id === draggedTaskId);
      if (fromIndex < 0) return;
      const [moved] = listRef.tasks.splice(fromIndex, 1);
      listRef.tasks.push(moved);
      saveData(state);
      draggedTaskId = null;
      render();
    });

    document.addEventListener('mouseup', () => {
      document.querySelectorAll('.task[draggable="true"]').forEach(el => el.draggable = false);
    });
  }

  if(addListBtn) addListBtn.addEventListener('click', onAddList);
  if(newListName) newListName.addEventListener('keydown', e => { if(e.key === 'Enter') onAddList(); });

  if(listsContainer){
    listsContainer.addEventListener('click', (e) => {
      const delBtn = e.target.closest('button[data-action="delete"]');
      if (delBtn) { onListsClick(e); return; }
      const li = e.target.closest('.list-item');
      if (li && li.dataset && li.dataset.id) setActive(li.dataset.id);
    });
    listsContainer.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const li = e.target.closest('.list-item');
        if (li && li.dataset && li.dataset.id) setActive(li.dataset.id);
      }
    });
  }

  if(addTaskBtn) addTaskBtn.addEventListener('click', onAddTask);
  if(newTaskText) newTaskText.addEventListener('keydown', e=>{ if(e.key==='Enter') onAddTask(); });

  if(deleteListBtn) deleteListBtn.addEventListener('click', ()=>{
    if(!state.activeListId) return;
    if(!confirm('Delete current list and its tasks?')) return;
    state.lists = state.lists.filter(l=>l.id!==state.activeListId);
    state.activeListId = state.lists.length ? state.lists[0].id : null;
    saveData(state);
    render();
  });

  if(renameListBtn) renameListBtn.addEventListener('click', ()=>{
    const list = findList(state.activeListId);
    if(!list) return alert('Choose a list to rename.');
    const newName = prompt('Rename list', list.name);
    if(newName==null) return;
    list.name = newName.trim() || list.name;
    saveData(state);
    render();
  });

  if(clearAllBtn) clearAllBtn.addEventListener('click', ()=>{
    if(!confirm('Clear all lists and tasks? 🤔 This cannot be undone.')) return;
    localStorage.removeItem(STORAGE_KEY);
    state = { lists: [], activeListId: null };
    init();
  });
}

function onAddList(){
  if(!newListName) return;
  const name = newListName.value.trim();
  if(!name){ newListName.focus(); return; }
  const id = uid();
  state.lists.push({ id, name, tasks: [] });
  state.activeListId = id;
  newListName.value = '';
  saveData(state);
  render();
}

function onListsClick(e){
  const btn = e.target.closest('button[data-action], button[title="Delete list"]');
  if(!btn) return;
  const action = btn.getAttribute('data-action') || btn.title.toLowerCase();
  const id = btn.dataset.id;
  if(action==='delete' || action==='del'){
    if(!confirm('Delete this list?')) return;
    state.lists = state.lists.filter(l=>l.id!==id);
    if(state.activeListId===id) state.activeListId = state.lists.length ? state.lists[0].id : null;
    saveData(state);
    render();
  }
}

function onAddTask(){
  const list = findList(state.activeListId);
  if(!list){ alert('Select or create a list first.'); return; }
  if(!newTaskText) return;
  const text = newTaskText.value.trim();
  if(!text){ newTaskText.focus(); return; }
  list.tasks.push({ id: uid(), text, done: false });
  newTaskText.value = '';
  saveData(state);
  render();
}

function toggleTaskDone(taskId){
  const list = findList(state.activeListId);
  if(!list) return;
  const t = list.tasks.find(x=>x.id===taskId);
  if(!t) return;
  t.done = !t.done;
  saveData(state);
  render();
  const el = document.querySelector(`#tasksContainer .check[data-id="${taskId}"]`);
  if(el) el.focus();
}

function deleteTask(taskId){
  const list = findList(state.activeListId);
  if(!list) return;

  const idx = list.tasks.findIndex(t => t.id === taskId);
  if (idx < 0) return;

  const [removed] = list.tasks.splice(idx, 1);
  saveData(state);
  render();

  if (lastDeleted && lastDeleted.timeoutId) clearTimeout(lastDeleted.timeoutId);

  const timeoutId = setTimeout(() => {
    lastDeleted = null;
    hideUndoToast();
  }, UNDO_TIMEOUT);

  lastDeleted = {
    listId: list.id,
    task: removed,
    index: idx,
    timeoutId
  };

  showUndoToast('Task deleted - undo?');
}

function editTask(taskId){
  const list = findList(state.activeListId);
  if(!list) return;
  const t = list.tasks.find(x=>x.id===taskId);
  if(!t) return;
  const newText = prompt('Edit task', t.text);
  if(newText==null) return;
  t.text = newText.trim() || t.text;
  saveData(state);
  render();
}

function reorderTasks(fromId, toId){
  const list = findList(state.activeListId);
  if(!list) return;
  const fromIndex = list.tasks.findIndex(t => t.id === fromId);
  const toIndex = list.tasks.findIndex(t => t.id === toId);
  if(fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
  const [moved] = list.tasks.splice(fromIndex, 1);
  list.tasks.splice(toIndex, 0, moved);
  saveData(state);
  render();
}

function ensureUndoToast() {
  let toast = document.getElementById('undoToast');
  if (toast) return toast;
  toast = document.createElement('div');
  toast.id = 'undoToast';
  toast.className = 'undo-toast';
  toast.innerHTML = `
    <div class="msg">Task deleted</div>
    <button class="undo-btn" type="button">↺</button>
    <button class="dismiss" type="button" aria-label="Dismiss">✕</button>
  `;
  document.body.appendChild(toast);

  toast.querySelector('.undo-btn').addEventListener('click', () => {
    if (!lastDeleted) return;
    const { listId, task, index, timeoutId } = lastDeleted;
    clearTimeout(timeoutId);
    const list = findList(listId);
    if (list) {
      const insertIndex = Math.min(Math.max(0, index), list.tasks.length);
      list.tasks.splice(insertIndex, 0, task);
      saveData(state);
    }
    lastDeleted = null;
    hideUndoToast();
    render();
  });

  toast.querySelector('.dismiss').addEventListener('click', () => {
    hideUndoToast();
  });

  return toast;
}

function showUndoToast(text = 'Task deleted') {
  const toast = ensureUndoToast();
  toast.querySelector('.msg').textContent = text;
  requestAnimationFrame(()=> toast.classList.add('show'));
}

function hideUndoToast() {
  const toast = document.getElementById('undoToast');
  if (!toast) return;
  toast.classList.remove('show');
}

function onTasksClick(e){
  const check = e.target.closest('.check');
  if (check) {
    const tid = check.dataset.id;
    toggleTaskDone(tid);
    return;
  }
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const tid = btn.dataset.id;

  if (action === 'delete') {
    deleteTask(tid);
    return;
  }

  if (action === 'edit') {
    editTask(tid);
    return;
  }
}

init();