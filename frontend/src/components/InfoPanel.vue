<template>
  <div class="info-panel" v-if="file">
    <button class="btn-icon" @click="$emit('close')" style="align-self: flex-end; margin-bottom: 20px;">×</button>
    <div class="info-panel__icon">{{ fileIcon(file) }}</div>
    <div class="info-panel__name" :title="file.name">{{ file.name }}</div>

    <table class="info-table">
      <tbody>
        <tr><td>Type</td><td>{{ file.isDirectory ? 'Directory' : file.isSymlink ? 'Symlink' : 'File' }}</td></tr>
        <tr><td>Size</td><td>{{ formatBytes(file.size) }}</td></tr>
        <tr><td>Path</td><td :title="fullPath">{{ fullPath }}</td></tr>
        <tr><td>Perms</td><td>{{ file.permissions }}</td></tr>
        <tr><td>Owner</td><td>{{ file.owner }}</td></tr>
        <tr><td>Modified</td><td>{{ formatDate(file.modified) }}</td></tr>
      </tbody>
    </table>

    <div style="margin-top: 24px; display: flex; flex-direction: column; gap: 8px;">
      <button class="btn-secondary" v-if="!file.isDirectory" @click="handleDownload">⬇ Download</button>
      <button class="btn-secondary" @click="$emit('rename', file)">✏️ Rename</button>
      <button class="btn-secondary btn-danger" @click="$emit('delete', file)">🗑️ Delete</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { getDownloadUrl } from '../api';

const props = defineProps({
  file: { type: Object, required: true },
  currentPath: { type: String, required: true },
  session: { type: Object, required: true }
});

const emit = defineEmits(['close', 'delete', 'rename']);

const fullPath = computed(() => props.currentPath.replace(/\/$/, '') + '/' + props.file.name);

function formatBytes(b) {
  if (b == null) return '—';
  const k = 1024, s = ['B','KB','MB','GB','TB'], i = Math.floor(Math.log(b)/Math.log(k));
  if (b === 0) return '0 B';
  return (b / Math.pow(k, i)).toFixed(1) + ' ' + s[i];
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function fileIcon(f) {
  if (f.isDirectory) return '📁';
  if (f.isSymlink) return '🔗';
  return '📄';
}

function handleDownload() {
  const url = getDownloadUrl(props.session.sessionId, fullPath.value);
  const a = document.createElement('a');
  a.href = url;
  a.download = props.file.name;
  a.click();
}
</script>

<style scoped>
/* Specific CSS variables used globally via main.css */
</style>
