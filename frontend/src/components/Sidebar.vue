<template>
  <div :class="['sidebar', { 'collapsed': collapsed }]">
    <!-- Quick Access -->
    <div class="sidebar-section">
      <div class="sidebar-section-title" v-if="!collapsed">Quick Access</div>
      <div class="sidebar-item" @click="$emit('navigate', '~')" title="Home (~)"><span class="icon">🏠</span><span v-if="!collapsed">Home</span></div>
      <div class="sidebar-item" @click="$emit('navigate', '/')" title="Root (/)"><span class="icon">🖥️</span><span v-if="!collapsed">Root</span></div>
      <div class="sidebar-item" @click="$emit('navigate', '/etc')" title="/etc"><span class="icon">⚙️</span><span v-if="!collapsed">/etc</span></div>
      <div class="sidebar-item" @click="$emit('navigate', '/var/log')" title="/var/log"><span class="icon">📋</span><span v-if="!collapsed">/var/log</span></div>
      <div class="sidebar-item" @click="$emit('navigate', '/tmp')" title="/tmp"><span class="icon">🗑️</span><span v-if="!collapsed">/tmp</span></div>
    </div>
    
    <div class="sidebar-divider"></div>

    <!-- Bookmarks -->
    <div class="sidebar-section">
      <div class="sidebar-section-title" v-if="!collapsed">Bookmarks</div>
      <div v-for="bm in bookmarks" :key="bm" class="sidebar-item bookmark-item" @click="$emit('bookmark-click', bm)" :title="bm">
        <span class="icon">⭐</span>
        <span v-if="!collapsed" class="name">{{ bm }}</span>
        <span v-if="!collapsed" class="remove-btn" @click.stop="removeBookmark(bm)">×</span>
      </div>
      <div class="sidebar-item" v-if="!collapsed" @click="addBookmark" title="Add Current Path">
        <span class="icon">+</span><span>Add current</span>
      </div>
    </div>

    <div class="sidebar-divider"></div>

    <!-- Disk Meter -->
    <div class="sidebar-section" v-if="!collapsed && diskInfo">
      <div class="sidebar-section-title" title="Disk Usage">Disk  {{ diskInfo.pct }}% used</div>
      <div class="disk-bar">
        <div class="disk-fill" :style="{ width: diskInfo.pct + '%', background: diskInfo.pct > 90 ? 'var(--danger)' : diskInfo.pct > 75 ? 'var(--warning)' : 'var(--accent)' }"></div>
      </div>
      <div class="sidebar-section-title" style="text-transform: none; font-size: 0.65rem;">
        Used: {{ formatBytes(diskInfo.used) }} / Free: {{ formatBytes(diskInfo.free) }}
      </div>
    </div>

    <div class="sidebar-divider" v-if="!collapsed && diskInfo"></div>

    <!-- Recent Paths -->
    <div class="sidebar-section" v-if="recentPaths.length > 0">
      <div class="sidebar-section-title" v-if="!collapsed">Recent Paths</div>
      <div class="sidebar-item" v-for="rp in recentPaths" :key="rp" @click="$emit('navigate', rp)" :title="rp">
        <span class="icon">🕐</span><span v-if="!collapsed">{{ rp }}</span>
      </div>
    </div>

    <!-- Spacer to push theme down if needed, or just append -->
    <div style="flex:1"></div>
    <div class="sidebar-divider"></div>

    <!-- Theme Switcher -->
    <div class="sidebar-section" style="padding-bottom: 24px">
      <div class="sidebar-section-title" v-if="!collapsed">Aesthetic</div>
      <div v-if="!collapsed" class="themes-grid">
         <button class="theme-btn tb-default" @click="setTheme('')" title="Midnight (Default)"></button>
         <button class="theme-btn tb-tokyo" @click="setTheme('tokyo-night')" title="Tokyo Night"></button>
         <button class="theme-btn tb-lofi" @click="setTheme('lofi')" title="Lofi Haven"></button>
         <button class="theme-btn tb-crayon" @click="setTheme('crayon')" title="Crayon Cartel"></button>
      </div>
      <div v-else class="sidebar-item" title="Themes"><span class="icon">🎨</span></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { getDiskUsage } from '../api';

const props = defineProps({
  session: { type: Object, required: true },
  currentPath: { type: String, required: true },
  collapsed: { type: Boolean, default: false }
});

const emit = defineEmits(['navigate', 'bookmark-click']);

const bookmarks = ref([]);
const recentPaths = ref([]);
const diskInfo = ref(null);

const storageKeyBkmk = computed(() => `sshfm_bookmarks_${props.session.host}:${props.session.port || 22}`);
const storageKeyRec = computed(() => `sshfm_recent_${props.session.host}:${props.session.port || 22}`);

function loadBookmarks() {
  try {
    const data = localStorage.getItem(storageKeyBkmk.value);
    if (data) bookmarks.value = JSON.parse(data);
  } catch(e) {}
}

function loadRecent() {
  try {
    const data = localStorage.getItem(storageKeyRec.value);
    if (data) recentPaths.value = JSON.parse(data);
  } catch(e) {}
}

function addBookmark() {
  if (!bookmarks.value.includes(props.currentPath)) {
    bookmarks.value.push(props.currentPath);
    saveBookmarks();
  }
}

function removeBookmark(path) {
  bookmarks.value = bookmarks.value.filter(b => b !== path);
  saveBookmarks();
}

function saveBookmarks() {
  localStorage.setItem(storageKeyBkmk.value, JSON.stringify(bookmarks.value));
}

async function fetchDiskUsage() {
  try {
    const res = await getDiskUsage(props.session.sessionId, '/');
    diskInfo.value = res;
  } catch (err) {
    console.error('Failed to get disk info', err);
  }
}

function formatBytes(b) {
  if (b == null) return '···'; 
  const k = 1024, s = ['B','KB','MB','GB','TB'], i = Math.floor(Math.log(b) / Math.log(k)); 
  return (b / Math.pow(k, i)).toFixed(1) + ' ' + s[i];
}

function setTheme(themeName) {
  if (themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem('sshfm_theme', themeName);
}

onMounted(() => {
  loadBookmarks();
  loadRecent();
  fetchDiskUsage();
  
  const savedTheme = localStorage.getItem('sshfm_theme');
  if (savedTheme !== null) setTheme(savedTheme);
});

// Assuming FileManager updates localStorage on navigation, 
// we could watch for localstorage changes or re-load when currentPath changes.
watch(() => props.currentPath, () => {
    loadRecent(); // simplistic reload for recent paths
});
</script>

<style scoped>
.icon {
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}
.bookmark-item {
  position: relative;
}
.name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}
.remove-btn {
  opacity: 0;
  cursor: pointer;
  padding: 0 4px;
}
.bookmark-item:hover .remove-btn {
  opacity: 1;
}
.remove-btn:hover {
  color: var(--danger);
}

.themes-grid {
  display: flex; gap: 8px; margin-top: 4px; padding: 0 4px;
}
.theme-btn {
  width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--border); padding: 0; transition: transform 0.2s;
}
.theme-btn:hover { transform: scale(1.2); border-color: var(--text-primary); }
.tb-default { background: linear-gradient(135deg, #0d0f14, #1a1e28); }
.tb-tokyo { background: linear-gradient(135deg, #1a1b26, #bb9af7); }
.tb-lofi { background: linear-gradient(135deg, #fdfbf7, #d4a373); }
.tb-crayon { background: linear-gradient(135deg, #ffb3ba, #ffdfba); }
</style>
