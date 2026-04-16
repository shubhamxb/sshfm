<template>
  <div class="hud-pills">
    <PermissionBadge 
      :session="session" 
      :mode="mode" 
      @update:mode="$emit('update:mode', $event)" 
    />
    
    <div class="hud-pill" title="Connection">
      <span class="pill-icon">🟢</span>
      <span class="pill-label">{{ session.username }}@{{ session.host }}</span>
    </div>

    <div class="hud-pill" title="Folder Stats">
      <span class="pill-icon">📁</span>
      <span class="pill-label">{{ fileCount }} items · {{ formatBytes(folderBytes) }}</span>
    </div>

    <!-- Appends clickable if interactive -->
    <div class="hud-pill dropdown-wrap clickable" title="Disk Mounts" @mouseenter="showMounts = true" @mouseleave="showMounts = false">
      <span class="pill-icon">💾</span>
      <span v-if="diskInfo" class="pill-label">Disk: <strong>{{ diskInfo.pct }}%</strong> ({{ formatBytes(diskInfo.free) }} free)</span>
      <span v-else class="pill-label">Disk: ···</span>

      <div class="dropdown-menu fade-in" v-if="showMounts && mounts.length > 0">
        <div class="dropdown-header">Mounted Drives</div>
        <div 
          v-for="mount in mounts" 
          :key="mount.fs" 
          class="dropdown-item clickable"
          @click="$emit('navigate', mount.mountedOn); showMounts = false;"
          :title="'Go to ' + mount.mountedOn"
        >
          <div class="dropdown-row">
            <strong class="mono">{{ mount.mountedOn }}</strong>
            <span :class="{'text-danger': mount.pct > 85, 'text-warning': mount.pct > 70 && mount.pct <= 85}">{{ mount.pct }}%</span>
          </div>
          <div class="dropdown-sub text-muted">
            {{ formatBytes(mount.used) }} used of {{ formatBytes(mount.total) }} <span class="mono" style="font-size:0.7rem">({{ mount.fs }})</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Space Sweeper Button -->
    <div class="hud-pill clickable" title="Storage Analyzer" @click="$emit('open-analyzer')" style="border-color: rgba(16, 185, 129, 0.4); color: #10b981;">
      <span class="pill-icon" style="text-shadow: 0 0 10px rgba(16, 185, 129, 0.5);">📊</span>
      <span class="pill-label">Scan Space</span>
    </div>

    <div :class="['hud-pill', 'dropdown-wrap', 'clickable', operations.length > 0 ? 'hud-pill--busy' : '']" title="Activity Tracker" @mouseenter="handleAuditEnter" @mouseleave="showAudit = false">
      <span class="pill-icon" v-if="operations.length > 0"><span class="pulse-dot"></span></span>
      <span class="pill-icon" v-else>⚡</span>
      <span class="pill-label">{{ operations.length > 0 ? `${operations.length} running` : 'Activity Tracker' }}</span>
      
      <div class="dropdown-menu fade-in" v-if="showAudit" style="right:0; left:auto; min-width:350px; max-height:400px; overflow-y:auto">
        <div class="dropdown-header">System Audit Log (Last 20)</div>
        <div v-if="loadingAudit" class="dropdown-item text-muted" style="text-align:center">Loading...</div>
        <div v-else-if="!auditLogs.length" class="dropdown-item text-muted" style="text-align:center; padding: 20px">No recent changes</div>
        <div v-for="log in auditLogs" :key="log.id" class="dropdown-item" style="cursor:default">
          <div class="dropdown-row">
            <strong :style="{ color: log.action==='Deleted'?'var(--danger)':(log.action==='Security'?'var(--warning)':'var(--accent)') }">{{ log.action }}</strong>
            <span class="text-muted" style="font-size:0.7rem">{{ new Date(log.timestamp).toLocaleTimeString() }}</span>
          </div>
          <div class="mono" style="font-size:0.75rem; opacity:0.8; margin-top:2px; word-break:break-all">{{ log.target }}</div>
        </div>
      </div>
    </div>

    <div v-if="clipboard.mode !== null" class="hud-pill hud-pill--clipboard" title="Clipboard">
      <span class="pill-icon">📋</span>
      <span class="pill-label">{{ clipboard.files.length }} file(s) {{ clipboard.mode === 'cut' ? 'cut' : 'copied' }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getDiskMounts, getSessionLogs } from '../api';
import PermissionBadge from './PermissionBadge.vue';

const props = defineProps({
  session: { type: Object, required: true },
  mode: { type: String, default: 'normal' },
  currentPath: { type: String, required: true },
  fileCount: { type: Number, default: 0 },
  folderBytes: { type: Number, default: null },
  clipboard: { type: Object, required: true },
  operations: { type: Array, required: true }
});

const emit = defineEmits(['update:mode', 'open-analyzer', 'navigate']);

const diskInfo = ref(null);
const mounts = ref([]);
const showMounts = ref(false);

const auditLogs = ref([]);
const showAudit = ref(false);
const loadingAudit = ref(false);

let lastAuditFetch = 0;

async function handleAuditEnter() {
  showAudit.value = true;
  // debounce fetch
  if (Date.now() - lastAuditFetch < 2000) return;
  loadingAudit.value = true;
  try {
    const res = await getSessionLogs(props.session.sessionId);
    auditLogs.value = res.logs || [];
    lastAuditFetch = Date.now();
  } catch(e) {
    console.error('Audit load failed', e);
  } finally {
    loadingAudit.value = false;
  }
}

function formatBytes(b) {
  if (b == null) return '···';
  const k = 1024, s = ['B','KB','MB','GB','TB'], i = Math.floor(Math.log(b)/Math.log(k));
  if (b === 0) return '0 B';
  return (b / Math.pow(k, i)).toFixed(1) + ' ' + s[i];
}

onMounted(async () => {
  try {
    const res = await getDiskMounts(props.session.sessionId);
    mounts.value = res.mounts || [];
    // Show root '/' as default, or whatever the first drive is
    diskInfo.value = mounts.value.find(m => m.mountedOn === '/') || mounts.value[0];
  } catch (e) {
    console.error('HudBar failed to load mounts', e);
  }
});
</script>

<style scoped>
.dropdown-wrap { position: relative; }
.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 8px 0;
  min-width: 260px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  z-index: 100;
  cursor: default;
}
.dropdown-header {
  padding: 4px 16px 8px;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-muted);
  font-weight: 600;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--border);
  margin-bottom: 4px;
}
.dropdown-item {
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-bottom: 1px solid rgba(255,255,255,0.02);
}
.dropdown-item:last-child { border-bottom: none; }
.dropdown-item:hover { background: var(--bg-hover); cursor: pointer; }
.dropdown-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; }
.dropdown-sub { font-size: 0.75rem; }
.text-danger { color: var(--danger); font-weight: bold; }
.text-warning { color: var(--warning); font-weight: bold; }
</style>
