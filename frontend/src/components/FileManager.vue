<template>
  <div class="fm-shell">
    <!-- ═══ TOP BAR ════════════════════════════════════════════════════════════ -->
    <header class="topbar">
      <div class="topbar-left">
        <button class="sidebar-toggle btn-icon" @click="sidebarOpen = !sidebarOpen">☰</button>
        <span class="logo-mini">⚡ SSHFM</span>
      </div>

      <!-- HUD: Sudo Badge · Connection · Folder Stats · Disk+Mounts · Scan Space · Activity Log · Clipboard -->
      <HudBar
        :session="session"
        :currentPath="currentPath"
        :fileCount="files.length"
        :folderBytes="folderBytes"
        :clipboard="clipboard"
        :operations="operations"
        :mode="sessionMode"
        @update:mode="sessionMode = $event"
        @open-analyzer="analyzerOpen = true"
        @navigate="navigateTo"
      />

      <div class="topbar-right">
        <button class="btn-secondary btn-sm" @click="$emit('disconnect')">Disconnect</button>
      </div>
    </header>

    <!-- ═══ BODY: Sidebar + Main ════════════════════════════════════════════════ -->
    <div class="fm-body">
      <!-- Left Sidebar: Quick Access · Bookmarks · Disk Meter · Recents · Themes -->
      <Sidebar
        :session="session"
        :currentPath="currentPath"
        :collapsed="!sidebarOpen"
        @navigate="navigateTo"
        @bookmark-click="navigateTo"
      />

      <!-- ─── Main Pane ──────────────────────────────────────────────────────── -->
      <div class="fm-main">

        <!-- Toolbar: Back/Fwd · Breadcrumb · Search · New · Upload · Refresh · Info -->
        <div class="toolbar">
          <button class="btn-icon" @click="goBack"    :disabled="historyIdx <= 0">←</button>
          <button class="btn-icon" @click="goForward" :disabled="historyIdx >= history.length - 1">→</button>

          <div class="breadcrumb">
            <button class="crumb" @click="navigateTo('/')">~</button>
            <template v-for="(part, i) in pathParts" :key="i">
              <span class="crumb-sep">/</span>
              <button class="crumb" @click="navigateTo(pathUpTo(i))">{{ part }}</button>
            </template>
          </div>

          <div style="flex:1;" />

          <div class="search-wrap" style="display:flex; align-items:center; gap:4px;">
            <input
              ref="searchRef"
              v-model="searchQuery"
              placeholder="Filter files…"
              style="margin-bottom:0; width:160px; padding:5px 10px; font-size:0.8rem;"
              @keyup.escape="searchQuery=''"
            />
            <button class="btn-icon" @click="doRemoteSearch" title="Remote search (find)">🔍</button>
          </div>

          <button class="fm-toolbar-btn" @click="showMkdirModal = true">
            <span class="fm-icon">📁</span> New Folder
          </button>
          <label class="fm-toolbar-btn fm-btn-accent" style="cursor:pointer;">
            <span class="fm-icon">⬆</span> Upload
            <input type="file" multiple hidden @change="handleUpload" ref="fileInput" />
          </label>
          <button class="fm-toolbar-btn" @click="loadFiles" title="Refresh">
            <span class="fm-icon" :class="loading && 'spin'">↻</span>
          </button>
          <button class="fm-toolbar-btn" :class="{ 'active': infoPanelOpen }" @click="infoPanelOpen = !infoPanelOpen" title="File Info Panel">
            <span class="fm-icon">ℹ</span>
          </button>
        </div>

        <!-- Multi-Select Action Bar (appears when files are selected) -->
        <SelectionBar
          :selectedFiles="selectedFiles"
          :clipboard="clipboard"
          :currentPath="currentPath"
          @copy="doCopy"
          @cut="doCut"
          @paste="doPaste"
          @delete="confirmDeleteSelected"
          @clear="selectedFiles = []"
        />

        <!-- ─── Content Area: File Browser or Space Analyzer ─────────────────── -->
        <div class="fm-content-container">
          <transition name="fade" mode="out-in">

            <!-- SPACE ANALYZER VIEW (takes over pane when analyzerOpen) -->
            <SpaceAnalyzer
              v-if="analyzerOpen"
              key="analyzer"
              :session="session"
              :currentPath="currentPath"
              @close="analyzerOpen = false"
              @deleteItem="confirmDelete"
            />

            <!-- NORMAL FILE BROWSER VIEW -->
            <div v-else key="browser" class="browser-view">

              <!-- Error Banner -->
              <div v-if="error" class="inline-error">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span>⚠️</span>
                  <span>{{ error }}</span>
                  <span v-if="isPermissionError && sessionMode !== 'sudo'" style="font-weight:600; color:var(--warning);">
                    Try switching to Sudo mode (🔒 in top bar).
                  </span>
                </div>
                <button @click="error=''; isPermissionError=false" class="btn-icon">✕</button>
              </div>

              <!-- Loading Spinner -->
              <div v-if="loading" class="loading-state">
                <span class="spin" style="font-size:2rem;">⟳</span>
                <span>Loading…</span>
              </div>

              <!-- Empty State -->
              <div v-else-if="!loading && filteredFiles.length === 0" class="empty-state">
                <span style="font-size:3rem;">📂</span>
                <p>This directory is empty or no files match your filter</p>
              </div>

              <!-- File Table -->
              <div
                v-else
                class="table-wrap"
                @dragover.prevent="isDragging = true"
                @dragleave="isDragging = false"
              >
                <table class="file-table fade-in">
                  <thead>
                    <tr>
                      <th style="width:34px;">
                        <input type="checkbox" @change="toggleAll" :checked="allSelected" />
                      </th>
                      <th @click="sortBy('name')" class="sortable">
                        Name <span class="sort-icon">{{ sortKey === 'name' ? (sortDir > 0 ? '↑' : '↓') : '⇅' }}</span>
                      </th>
                      <th @click="sortBy('size')" class="sortable">
                        Size <span class="sort-icon">{{ sortKey === 'size' ? (sortDir > 0 ? '↑' : '↓') : '⇅' }}</span>
                      </th>
                      <th @click="sortBy('modified')" class="sortable">
                        Modified <span class="sort-icon">{{ sortKey === 'modified' ? (sortDir > 0 ? '↑' : '↓') : '⇅' }}</span>
                      </th>
                      <th>Permissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="file in filteredFiles"
                      :key="file.name"
                      class="file-row"
                      :class="{
                        'dir-row':       file.isDirectory,
                        'row--cut':      isCut(file.name),
                        'row--selected': isSelected(file)
                      }"
                      @dblclick="file.isDirectory ? navigateTo(joinPath(currentPath, file.name)) : handleDownload(file)"
                      @contextmenu.prevent="openContextMenu($event, file)"
                      @click.exact="handleRowClick(file)"
                    >
                      <td><input type="checkbox" v-model="selectedFiles" :value="file" @click.stop /></td>
                      <td class="name-cell">
                        <span class="file-icon">{{ fileIcon(file) }}</span>
                        <span
                          class="file-name"
                          :class="{ clickable: file.isDirectory }"
                          @click.stop="file.isDirectory && navigateTo(joinPath(currentPath, file.name))"
                        >{{ file.name }}</span>
                      </td>
                      <td class="mono text-muted size-cell">{{ file.isDirectory ? '—' : formatBytes(file.size) }}</td>
                      <td class="text-muted mono date-cell">{{ formatDate(file.modified) }}</td>
                      <td class="mono perm-cell text-muted">{{ file.permissions }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Status Bar -->
              <footer class="statusbar">
                <span class="mono" style="opacity:0.7;">{{ currentPath }}</span>
                <span style="display:flex; gap:10px; align-items:center;">
                  <span>{{ files.length }} items</span>
                  <span v-if="selectedFiles.length" style="color:var(--accent);">· {{ selectedFiles.length }} selected</span>
                  <span v-if="folderBytes">· {{ formatBytes(folderBytes) }}</span>
                  <span v-if="clipboard.mode" style="color:var(--accent);">
                    · 📋 {{ clipboard.files.length }} {{ clipboard.mode === 'cut' ? 'cut' : 'copied' }}
                  </span>
                </span>
              </footer>

            </div><!-- end .browser-view -->
          </transition>
        </div><!-- end .fm-content-container -->

      </div><!-- end .fm-main -->

      <!-- Info Panel slides in from right when a file is selected -->
      <InfoPanel
        v-if="infoPanelOpen && infoPanelFile"
        :file="infoPanelFile"
        :currentPath="currentPath"
        :session="session"
        @close="infoPanelOpen=false; infoPanelFile=null"
        @delete="confirmDelete"
        @rename="startRename"
      />
    </div><!-- end .fm-body -->

    <!-- ═══ OVERLAYS & MODALS ════════════════════════════════════════════════ -->

    <!-- Context Menu -->
    <ContextMenu
      :visible="ctxMenu.show"
      :x="ctxMenu.x"
      :y="ctxMenu.y"
      :file="ctxMenu.file"
      :clipboard="clipboard"
      :canPaste="clipboard.mode !== null"
      @action="handleCtxAction"
      @close="ctxMenu.show = false"
    />

    <!-- Transfer Queue (fixed bottom-right) -->
    <TransferQueue :transfers="transfers" />

    <!-- Drag-to-Upload Overlay -->
    <div class="drop-overlay" v-show="isDragging" @dragover.prevent @dragleave="isDragging = false" @drop.prevent="handleDrop">
      <div class="drop-inner">
        <div class="drop-icon">☁️</div>
        <p>Drop files to upload to <span class="mono">{{ currentPath }}</span></p>
      </div>
    </div>

    <!-- Rename Modal -->
    <div v-if="renameModal.show" class="modal-backdrop" @click.self="renameModal.show = false">
      <div class="modal fade-in">
        <h3 class="modal__title">Rename</h3>
        <p class="modal__sub text-muted">Renaming: <span class="mono">{{ renameModal.file?.name }}</span></p>
        <input v-model="renameModal.newName" type="text" class="modal__input" @keyup.enter="doRename" ref="renameInput" />
        <div class="modal__actions">
          <button class="btn-secondary" @click="renameModal.show = false">Cancel</button>
          <button class="btn-primary"   @click="doRename" :disabled="!renameModal.newName.trim()">Rename</button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="deleteModal.show" class="modal-backdrop" @click.self="deleteModal.show = false">
      <div class="modal fade-in">
        <h3 class="modal__title">Confirm Delete</h3>
        <p class="modal__sub">
          Delete <strong class="mono">{{ deleteModal.file?.name }}</strong>?<br/>
          <span class="text-muted" style="font-size:0.82rem;">
            Path: <code class="mono">{{ deleteModal.file?.path || joinPath(currentPath, deleteModal.file?.name || '') }}</code><br/>
            This action cannot be undone.
          </span>
        </p>
        <div class="modal__actions">
          <button class="btn-secondary" @click="deleteModal.show = false">Cancel</button>
          <button class="btn-primary" style="background:var(--danger);" @click="doDelete">Delete</button>
        </div>
      </div>
    </div>

    <!-- New Folder Modal -->
    <div v-if="showMkdirModal" class="modal-backdrop" @click.self="showMkdirModal = false">
      <div class="modal fade-in">
        <h3 class="modal__title">New Folder</h3>
        <input v-model="mkdirName" type="text" placeholder="folder-name" class="modal__input" @keyup.enter="doMkdir" />
        <div class="modal__actions">
          <button class="btn-secondary" @click="showMkdirModal = false">Cancel</button>
          <button class="btn-primary"   @click="doMkdir" :disabled="!mkdirName.trim()">Create</button>
        </div>
      </div>
    </div>

    <!-- Toast Notification -->
    <transition name="fadeslide">
      <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">
        <span>{{ toast.type === 'success' ? '✓' : toast.type === 'error' ? '✗' : 'ℹ' }}</span>
        {{ toast.message }}
      </div>
    </transition>

  </div><!-- end .fm-shell -->
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import Sidebar       from './Sidebar.vue';
import HudBar        from './HudBar.vue';
import ContextMenu   from './ContextMenu.vue';
import SelectionBar  from './SelectionBar.vue';
import InfoPanel     from './InfoPanel.vue';
import TransferQueue from './TransferQueue.vue';
import SpaceAnalyzer from './SpaceAnalyzer.vue';
import { useClipboard } from '../composables/useClipboard.js';
import { useFileOps }   from '../composables/useFileOps.js';
import {
  listFiles, deleteFile, renameFile, uploadFile, createDirectory, getDownloadUrl,
  getFolderSize, searchFiles, copyFile, moveFile, getSessionInfo
} from '../api';

const props = defineProps({ session: { type: Object, required: true } });
const emit  = defineEmits(['disconnect']);

const { clipboard, copy, cut, clear: clearClipboard, isCut } = useClipboard();
const { operations, addOp, finishOp } = useFileOps();

// ── UI State ──────────────────────────────────────────────────────────────────
const sidebarOpen    = ref(true);
const selectedFiles  = ref([]);
const searchQuery    = ref('');
const searchRef      = ref(null);
const infoPanelOpen  = ref(false);
const infoPanelFile  = ref(null);
const folderBytes    = ref(null);
const transfers      = ref([]);
const analyzerOpen   = ref(false);

// ── File System State ─────────────────────────────────────────────────────────
const files           = ref([]);
const currentPath     = ref('/');
const loading         = ref(false);
const error           = ref('');
const isPermissionError = ref(false);
const sessionMode     = ref('normal');
const isDragging      = ref(false);
const sortKey         = ref('name');
const sortDir         = ref(1);

// ── Modal State ───────────────────────────────────────────────────────────────
const renameModal    = ref({ show: false, file: null, newName: '' });
const deleteModal    = ref({ show: false, file: null });
const showMkdirModal = ref(false);
const mkdirName      = ref('');
const renameInput    = ref(null);
const fileInput      = ref(null);

// ── Navigation History ────────────────────────────────────────────────────────
const history    = ref(['/']);
const historyIdx = ref(0);

// ── Context Menu State ────────────────────────────────────────────────────────
const ctxMenu = ref({ show: false, x: 0, y: 0, file: null });

// ── Toast ─────────────────────────────────────────────────────────────────────
const toast = ref({ show: false, type: 'success', message: '' });
let toastTimer = null;

// ── Computed ──────────────────────────────────────────────────────────────────
const pathParts = computed(() => currentPath.value.split('/').filter(Boolean));

const sortedFiles = computed(() => {
  return [...files.value].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    let va = a[sortKey.value], vb = b[sortKey.value];
    if (sortKey.value === 'size') { va = va || 0; vb = vb || 0; }
    if (typeof va === 'string') return va.localeCompare(vb) * sortDir.value;
    return (va - vb) * sortDir.value;
  });
});

const filteredFiles = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return sortedFiles.value;
  return sortedFiles.value.filter(f => f.name.toLowerCase().includes(q));
});

const allSelected = computed(() =>
  files.value.length > 0 && selectedFiles.value.length === files.value.length
);

// ── Helpers ───────────────────────────────────────────────────────────────────
function toggleAll(e)      { selectedFiles.value = e.target.checked ? [...files.value] : []; }
function isSelected(file)  { return selectedFiles.value.some(f => f.name === file.name); }

function showToast(message, type = 'success') {
  clearTimeout(toastTimer);
  toast.value = { show: true, type, message };
  toastTimer = setTimeout(() => { toast.value.show = false; }, 3500);
}

function sortBy(key) {
  if (sortKey.value === key) sortDir.value *= -1;
  else { sortKey.value = key; sortDir.value = 1; }
}

function joinPath(base, name) {
  return base.replace(/\/$/, '') + '/' + name;
}

function pathUpTo(index) {
  const parts = currentPath.value.split('/').filter(Boolean);
  return '/' + parts.slice(0, index + 1).join('/');
}

function fileIcon(file) {
  if (file.isDirectory) return '📁';
  if (file.isSymlink)   return '🔗';
  const ext = file.name.split('.').pop()?.toLowerCase();
  const map = {
    js: '📜', ts: '📘', vue: '💚', json: '📋',
    md: '📝', txt: '📄', sh: '⚙️',  py: '🐍',
    go: '🐹', rs: '🦀', java: '☕', rb: '💎',
    jpg: '🖼', jpeg: '🖼', png: '🖼', gif: '🖼', svg: '🎨',
    mp4: '🎬', mp3: '🎵', pdf: '📑',
    zip: '📦', gz: '📦', tar: '📦',
    html: '🌐', css: '🎨', sql: '🗄️',
    lock: '🔒', env: '🔐',
  };
  return map[ext] || '📄';
}

function formatBytes(b) {
  if (b == null || b === 0) return b === 0 ? '0 B' : '···';
  const k = 1024, s = ['B','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return (b / k**i).toFixed(1) + ' ' + s[i];
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// ── File Operations ───────────────────────────────────────────────────────────
async function loadFiles() {
  loading.value = true; error.value = ''; isPermissionError.value = false;
  try {
    const res = await listFiles(props.session.sessionId, currentPath.value);
    files.value = res.files;
    selectedFiles.value = [];
  } catch (err) {
    handleError(err, 'Failed to list files');
  } finally {
    loading.value = false;
  }
}

function handleError(err, defaultMsg) {
  error.value = err.response?.data?.error || err.message || defaultMsg;
  isPermissionError.value = error.value.toLowerCase().includes('permission') || err.response?.status === 403;
}

function saveRecent(path) {
  const key = `sshfm_recent_${props.session.host}:${props.session.port || 22}`;
  try {
    let recent = JSON.parse(localStorage.getItem(key) || '[]');
    recent = recent.filter(r => r !== path);
    recent.unshift(path);
    if (recent.length > 8) recent = recent.slice(0, 8);
    localStorage.setItem(key, JSON.stringify(recent));
  } catch(e) {}
}

function navigateTo(path) {
  analyzerOpen.value = false;
  history.value = history.value.slice(0, historyIdx.value + 1);
  history.value.push(path);
  historyIdx.value = history.value.length - 1;
  currentPath.value = path;
  loadFiles();
  fetchFolderSize();
  saveRecent(path);
}

function goBack() {
  if (historyIdx.value > 0) {
    historyIdx.value--;
    currentPath.value = history.value[historyIdx.value];
    loadFiles(); fetchFolderSize();
  }
}

function goForward() {
  if (historyIdx.value < history.value.length - 1) {
    historyIdx.value++;
    currentPath.value = history.value[historyIdx.value];
    loadFiles(); fetchFolderSize();
  }
}

async function fetchFolderSize() {
  folderBytes.value = null;
  try {
    const res = await getFolderSize(props.session.sessionId, currentPath.value);
    folderBytes.value = res.bytes;
  } catch { folderBytes.value = null; }
}

function goUp() {
  if (currentPath.value === '/') return;
  const parts = currentPath.value.split('/').filter(Boolean);
  parts.pop();
  navigateTo(parts.length === 0 ? '/' : '/' + parts.join('/'));
}

// ── Selection & Clipboard ─────────────────────────────────────────────────────
function handleRowClick(file) {
  if (!file.isDirectory) {
    infoPanelFile.value = file;
  }
}

function doCopy() {
  const targets = selectedFiles.value.length ? selectedFiles.value : [ctxMenu.value.file].filter(Boolean);
  copy(targets, currentPath.value);
  showToast(`${clipboard.files.length} file(s) copied`);
}

function doCut() {
  const targets = selectedFiles.value.length ? selectedFiles.value : [ctxMenu.value.file].filter(Boolean);
  cut(targets, currentPath.value);
  showToast(`${clipboard.files.length} file(s) cut`);
}

async function doPaste() {
  if (!clipboard.mode) return;
  const id = addOp(`Pasting ${clipboard.files.length} file(s)…`);
  for (const file of clipboard.files) {
    const src = clipboard.sourcePath.replace(/\/$/, '') + '/' + file.name;
    const dst = currentPath.value.replace(/\/$/, '') + '/' + file.name;
    const tr = { id: Date.now() + Math.random(), name: file.name, progress: 0, status: 'copying', type: clipboard.mode };
    transfers.value.push(tr);
    try {
      if (clipboard.mode === 'copy') await copyFile(props.session.sessionId, src, dst);
      else await moveFile(props.session.sessionId, src, dst);
      tr.status = 'done'; tr.progress = 100;
    } catch (err) {
      tr.status = 'error';
      showToast(`Failed to paste ${file.name}: ` + (err.response?.data?.error || err.message), 'error');
    }
    setTimeout(() => { transfers.value = transfers.value.filter(t => t.id !== tr.id); }, 3000);
  }
  clearClipboard();
  finishOp(id);
  loadFiles();
  showToast('Paste complete');
}

// ── Context Menu ──────────────────────────────────────────────────────────────
function openContextMenu(e, file) {
  ctxMenu.value = { show: true, x: e.clientX, y: e.clientY, file };
  infoPanelFile.value = file;
}

function handleCtxAction(type, file) {
  ctxMenu.value.show = false;
  if      (type === 'open'     && file.isDirectory) navigateTo(joinPath(currentPath.value, file.name));
  else if (type === 'download') handleDownload(file);
  else if (type === 'copy')    { selectedFiles.value = [file]; doCopy(); }
  else if (type === 'cut')     { selectedFiles.value = [file]; doCut(); }
  else if (type === 'paste')   doPaste();
  else if (type === 'rename')  startRename(file);
  else if (type === 'info')    { infoPanelFile.value = file; infoPanelOpen.value = true; }
  else if (type === 'delete')  confirmDelete(file);
}

// ── Modals ─────────────────────────────────────────────────────────────────────
function startRename(file) {
  renameModal.value = { show: true, file, newName: file.name };
  nextTick(() => renameInput.value?.focus());
}

async function doRename() {
  const file = renameModal.value.file;
  const newName = renameModal.value.newName.trim();
  if (!newName || newName === file.name) { renameModal.value.show = false; return; }
  const oldPath = joinPath(currentPath.value, file.name);
  const newPath = joinPath(currentPath.value, newName);
  try {
    await renameFile(props.session.sessionId, oldPath, newPath);
    renameModal.value.show = false;
    showToast(`Renamed to ${newName}`);
    loadFiles();
  } catch (err) {
    handleError(err, 'Rename failed');
    renameModal.value.show = false;
  }
}

function confirmDelete(file) {
  deleteModal.value = { show: true, file };
}

async function doDelete() {
  const file     = deleteModal.value.file;
  const filePath = file.path || joinPath(currentPath.value, file.name);
  try {
    await deleteFile(props.session.sessionId, filePath, file.isDirectory);
    deleteModal.value.show = false;
    showToast(`Deleted ${file.name}`);
    loadFiles();
  } catch (err) {
    handleError(err, 'Delete failed');
    deleteModal.value.show = false;
  }
}

async function doMkdir() {
  const name = mkdirName.value.trim();
  if (!name) return;
  const newDir = joinPath(currentPath.value, name);
  try {
    await createDirectory(props.session.sessionId, newDir);
    showMkdirModal.value = false;
    mkdirName.value = '';
    showToast(`Created folder ${name}`);
    loadFiles();
  } catch (err) {
    handleError(err, 'Failed to create folder');
    showMkdirModal.value = false;
  }
}

function confirmDeleteSelected() {
  if (selectedFiles.value.length === 1) {
    confirmDelete(selectedFiles.value[0]);
  } else {
    if (!window.confirm(`Delete ${selectedFiles.value.length} files? This cannot be undone.`)) return;
    doDeleteMultiple();
  }
}

async function doDeleteMultiple() {
  for (const file of selectedFiles.value) {
    try {
      await deleteFile(props.session.sessionId, joinPath(currentPath.value, file.name), file.isDirectory);
    } catch (err) {
      handleError(err, `Failed to delete ${file.name}`);
      return;
    }
  }
  selectedFiles.value = [];
  showToast('Deleted selected files');
  loadFiles();
}

// ── Upload / Download ──────────────────────────────────────────────────────────
async function handleUpload(event) {
  const fileList = Array.from(event.target.files || []);
  if (!fileList.length) return;
  await uploadFiles(fileList);
  if (fileInput.value) fileInput.value.value = '';
}

async function handleDrop(event) {
  isDragging.value = false;
  const fileList = Array.from(event.dataTransfer.files || []);
  if (!fileList.length) return;
  await uploadFiles(fileList);
}

async function uploadFiles(fileList) {
  const id = addOp(`Uploading ${fileList.length} files`);
  for (const file of fileList) {
    const tr = { id: Date.now() + Math.random(), name: file.name, progress: 0, status: 'uploading', type: 'uploading' };
    transfers.value.push(tr);
    try {
      await uploadFile(props.session.sessionId, currentPath.value, file, (pct) => { tr.progress = pct; });
      tr.status = 'done'; tr.progress = 100;
      showToast(`Uploaded ${file.name}`);
    } catch (err) {
      tr.status = 'error';
      handleError(err, `Failed to upload ${file.name}`);
    }
    setTimeout(() => { transfers.value = transfers.value.filter(t => t.id !== tr.id); }, 3000);
  }
  finishOp(id);
  loadFiles();
}

function handleDownload(file) {
  const url = getDownloadUrl(props.session.sessionId, joinPath(currentPath.value, file.name));
  const a = document.createElement('a');
  a.href = url; a.download = file.name; a.click();
}

// ── Remote Search ──────────────────────────────────────────────────────────────
async function doRemoteSearch() {
  const q = searchQuery.value.trim();
  if (!q) return;
  loading.value = true; error.value = '';
  try {
    const res = await searchFiles(props.session.sessionId, currentPath.value, q);
    showToast(`Found ${res.results.length} match(es)`);
  } catch (err) {
    showToast('Search failed: ' + (err.response?.data?.error || err.message), 'error');
  } finally {
    loading.value = false;
  }
}

// ── Keyboard Shortcuts ─────────────────────────────────────────────────────────
function handleKeydown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'Escape')    { selectedFiles.value = []; ctxMenu.value.show = false; analyzerOpen.value && (analyzerOpen.value = false); }
  if (e.key === 'Backspace') goUp();
  if (e.key === 'F2' && selectedFiles.value.length === 1) startRename(selectedFiles.value[0]);
  if (e.key === 'Delete' && selectedFiles.value.length)   confirmDeleteSelected();
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'a') { e.preventDefault(); selectedFiles.value = [...files.value]; }
    if (e.key === 'c') { e.preventDefault(); doCopy(); }
    if (e.key === 'x') { e.preventDefault(); doCut(); }
    if (e.key === 'v') { e.preventDefault(); doPaste(); }
    if (e.key === 'f') { e.preventDefault(); searchRef.value?.focus(); }
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────
onMounted(async () => {
  window.addEventListener('keydown', handleKeydown);
  try {
    const info = await getSessionInfo(props.session.sessionId);
    sessionMode.value = info.mode || 'normal';
  } catch(e) {}
  loadFiles();
  fetchFolderSize();
});

onUnmounted(() => window.removeEventListener('keydown', handleKeydown));
</script>

<style scoped>
/* ─── Content Container (fills remaining height) ──────────────────────────── */
.fm-content-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.browser-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

/* ─── File Table ───────────────────────────────────────────────────────────── */
.table-wrap {
  flex: 1;
  overflow: auto;
}

.file-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  text-align: left;
}
.file-table th {
  padding: 10px 14px;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  background: var(--bg-surface);
  z-index: 1;
}
.sortable { cursor: pointer; user-select: none; }
.sortable:hover { color: var(--accent); }
.sort-icon { opacity: 0.5; font-size: 0.65rem; margin-left: 4px; }

.file-row { border-bottom: 1px solid rgba(255,255,255,0.025); transition: background 0.12s; }
.file-row:hover { background: var(--bg-hover); }
.row--selected { background: var(--accent-glow) !important; }
.row--cut { opacity: 0.45; }
.dir-row .file-name { color: var(--accent); }

.file-table td { padding: 9px 14px; vertical-align: middle; }
.name-cell  { display: flex; align-items: center; gap: 10px; max-width: 360px; }
.file-icon  { font-size: 1.1rem; flex-shrink: 0; }
.file-name  { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary); }
.file-name.clickable { cursor: pointer; }
.file-name.clickable:hover { text-decoration: underline; }
.size-cell  { font-size: 0.8rem; white-space: nowrap; }
.date-cell  { font-size: 0.78rem; white-space: nowrap; }
.perm-cell  { font-size: 0.75rem; }

/* ─── States ───────────────────────────────────────────────────────────────── */
.inline-error {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; margin: 10px 14px;
  background: var(--danger-dim); border: 1px solid rgba(248,113,113,0.25);
  border-radius: var(--radius-md); color: var(--danger); font-size: 0.875rem;
}

.loading-state,
.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px; padding: 80px 20px; color: var(--text-muted); flex: 1;
}

/* ─── Drag Overlay ─────────────────────────────────────────────────────────── */
.drop-overlay {
  position: fixed; inset: 0;
  background: rgba(13, 15, 20, 0.88);
  z-index: 200;
  display: flex; align-items: center; justify-content: center;
  border: 3px dashed var(--accent);
}
.drop-inner { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.drop-icon  { font-size: 3.5rem; animation: pulse 1.2s infinite; }

/* ─── Modals ───────────────────────────────────────────────────────────────── */
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(5px);
  z-index: 300;
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.modal {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 28px;
  width: 100%; max-width: 420px;
  box-shadow: var(--shadow-lg);
}
.modal__title   { font-size: 1.15rem; font-weight: 700; margin-bottom: 10px; }
.modal__sub     { font-size: 0.875rem; margin-bottom: 16px; line-height: 1.6; color: var(--text-secondary); }
.modal__input   { margin-bottom: 16px; }
.modal__actions { display: flex; justify-content: flex-end; gap: 10px; }

/* ─── Transition ───────────────────────────────────────────────────────────── */
.fade-enter-active,
.fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from,
.fade-leave-to     { opacity: 0; }

.fadeslide-enter-active,
.fadeslide-leave-active { transition: all 0.3s ease; }
.fadeslide-enter-from,
.fadeslide-leave-to     { opacity: 0; transform: translateY(10px); }

/* ─── Checkboxes ───────────────────────────────────────────────────────────── */
input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--accent);
  border-radius: 4px;
}

/* ─── Toolbar Buttons ──────────────────────────────────────────────────────── */
.fm-toolbar-btn {
  background: var(--bg-elevated);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.fm-toolbar-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
  border-color: rgba(255, 255, 255, 0.15);
}
.fm-toolbar-btn:active {
  transform: translateY(0);
}
.fm-toolbar-btn.active {
  background: var(--accent-glow);
  color: var(--accent);
  border-color: var(--accent-dim);
}
.fm-btn-accent {
  background: var(--accent);
  color: white;
  border-color: transparent;
}
.fm-btn-accent:hover {
  background: var(--accent-hover);
  box-shadow: 0 4px 16px var(--accent-glow);
}
.fm-icon {
  font-size: 1rem;
}
</style>
