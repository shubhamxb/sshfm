<template>
  <div class="space-analyzer fade-in">

    <!-- Header -->
    <header class="sa-header">
      <div>
        <h2 class="sa-title">📊 Space Sweeper</h2>
        <p class="text-muted" style="margin-top: 4px; font-size: 0.85rem;">
          Analyzing
          <code class="mono" style="background:rgba(255,255,255,0.07); padding:2px 8px; border-radius:4px;">{{ currentPath }}</code>
        </p>
      </div>
      <button class="btn-icon" @click="$emit('close')" title="Close Analyzer" style="font-size:1.3rem; padding:6px 10px;">✕</button>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="sa-loading">
      <span class="spin" style="font-size: 2.5rem; color: var(--accent);">⟳</span>
      <p style="margin-top: 20px; font-weight: 600; font-size: 1.1rem;">Scanning Filesystem…</p>
      <p class="text-muted" style="font-size: 0.85rem; margin-top: 8px; max-width: 480px; text-align: center; line-height: 1.6;">
        Running recursive sizing pipeline on the server. Large partitions may take a few seconds.
      </p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="sa-loading">
      <div style="background:var(--danger-dim); padding:20px 28px; border-radius:12px; border:1px solid rgba(248,113,113,0.3); color:var(--danger); text-align:center;">
        <div style="font-size:2rem; margin-bottom:8px;">⚠️</div>
        <strong>Scan failed</strong><br/>
        <span style="font-size:0.85rem; opacity:0.85;">{{ error }}</span>
      </div>
    </div>

    <!-- Results -->
    <div v-else class="sa-body">

      <!-- Left: Squarified Treemap -->
      <div class="sa-section">
        <h3>Directory Map</h3>
        <p class="text-muted" style="font-size:0.75rem; margin-bottom:14px;">Size-proportional view of direct children</p>
        <div class="treemap-container" ref="treemapRef">
          <div v-if="!children.length" class="text-muted" style="padding:20px; font-size:0.85rem;">No items found in this directory.</div>
          <div
            v-for="(box, idx) in treemapBoxes"
            :key="'tb'+idx"
            class="tm-box"
            :style="{
              left:            box.x + 'px',
              top:             box.y + 'px',
              width:           box.w + 'px',
              height:          box.h + 'px',
              backgroundColor: getHue(box.ratio)
            }"
            :title="box.name + '  —  ' + formatSize(box.sizeKb)"
          >
            <div class="tm-content" v-if="box.w > 40 && box.h > 28">
              <span class="tm-name mono">{{ box.name }}</span>
              <span class="tm-size">{{ formatSize(box.sizeKb) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Largest Files List -->
      <div class="sa-section" style="background:rgba(0,0,0,0.08);">
        <h3>Largest Files</h3>
        <p class="text-muted" style="font-size:0.75rem; margin-bottom:14px;">
          ⚠️ Deleting removes them completely — no recovery.
        </p>
        <div class="hog-list">
          <div v-if="!files.length" class="text-muted" style="padding:20px; font-size:0.85rem;">No large files found recursively.</div>
          <div
            v-for="(item, idx) in files"
            :key="'f'+idx"
            class="hog-item sa-file-item"
          >
            <div class="hog-info">
              <span class="hog-name mono" :title="item.path">{{ item.name }}</span>
              <span class="hog-size">{{ formatSize(item.sizeKb) }}</span>
            </div>
            <div class="hog-bar-wrap">
              <div class="hog-bar file-bar" :style="{ width: getPercentage(item.sizeKb, maxFileSize) + '%' }"></div>
            </div>
            <div class="hog-path text-muted mono" style="font-size:0.7rem; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" :title="item.path">
              {{ item.path }}
            </div>
            <div class="hog-actions">
              <button class="btn-icon" title="Delete this file" @click="confirmDelete(item)" style="color:var(--danger);">🗑️</button>
            </div>
          </div>
        </div>
      </div>

    </div><!-- end sa-body -->
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { analyzeDisk } from '../api';

const props = defineProps({
  session:     { type: Object, required: true },
  currentPath: { type: String, required: true }
});

const emit = defineEmits(['close', 'deleteItem']);

// ── State ──────────────────────────────────────────────────────────────────────
const loading  = ref(true);
const error    = ref('');
const children = ref([]);
const files    = ref([]);

const treemapRef  = ref(null);
const treemapBoxes = ref([]);
let   resizeObs   = null;

// ── Computed ───────────────────────────────────────────────────────────────────
const maxFileSize = computed(() => {
  if (!files.value.length) return 1;
  return Math.max(...files.value.map(i => i.sizeKb));
});

// ── Formatters ─────────────────────────────────────────────────────────────────
function formatSize(kb) {
  if (!kb || kb === 0) return '0 B';
  if (kb < 1024)       return kb + ' KB';
  if (kb < 1024 * 1024) return (kb / 1024).toFixed(1) + ' MB';
  return (kb / (1024 * 1024)).toFixed(2) + ' GB';
}

function getPercentage(val, max) {
  if (!max || max === 0) return 0;
  return Math.min(100, (val / max) * 100);
}

function getHue(ratio) {
  // Large things = warm (red/orange), small = cool (blue/teal)
  const hue = Math.round(220 - ratio * 210);
  return `hsla(${hue}, 68%, 44%, 0.92)`;
}

// ── Treemap ────────────────────────────────────────────────────────────────────
function recalculateTreemap() {
  if (!treemapRef.value || !children.value.length) {
    treemapBoxes.value = [];
    return;
  }

  const containerW = treemapRef.value.clientWidth;
  const containerH = treemapRef.value.clientHeight;
  if (containerW < 10 || containerH < 10) return;

  const items = [...children.value]
    .filter(i => i.sizeKb > 0)
    .sort((a, b) => b.sizeKb - a.sizeKb);

  const total = items.reduce((sum, i) => sum + i.sizeKb, 0);
  if (total === 0) { treemapBoxes.value = []; return; }

  const rects = [];

  function binaryTreemap(arr, x, y, w, h, currentTotal) {
    if (!arr.length) return;
    if (arr.length === 1) {
      rects.push({ ...arr[0], x, y, w, h, ratio: arr[0].sizeKb / total });
      return;
    }

    let leftSum  = 0;
    let splitIdx = 0;
    const half   = currentTotal / 2;

    for (let i = 0; i < arr.length - 1; i++) {
      leftSum += arr[i].sizeKb;
      splitIdx = i;
      if (leftSum >= half) break;
    }

    const leftArr  = arr.slice(0, splitIdx + 1);
    const rightArr = arr.slice(splitIdx + 1);
    const leftRatio = leftSum / currentTotal;

    if (w >= h) {
      const leftW = w * leftRatio;
      binaryTreemap(leftArr,  x,         y, leftW,     h, leftSum);
      binaryTreemap(rightArr, x + leftW, y, w - leftW, h, currentTotal - leftSum);
    } else {
      const topH = h * leftRatio;
      binaryTreemap(leftArr,  x, y,        w, topH,     leftSum);
      binaryTreemap(rightArr, x, y + topH, w, h - topH, currentTotal - leftSum);
    }
  }

  binaryTreemap(items, 0, 0, containerW, containerH, total);

  treemapBoxes.value = rects.map(r => ({
    ...r,
    x: r.x + 2,
    y: r.y + 2,
    w: Math.max(0, r.w - 4),
    h: Math.max(0, r.h - 4),
  }));
}

// ── Analysis ───────────────────────────────────────────────────────────────────
async function runAnalysis() {
  loading.value = true;
  error.value   = '';
  try {
    const res    = await analyzeDisk(props.session.sessionId, props.currentPath);
    children.value = res.children    || [];
    files.value    = res.largestFiles || [];
    await nextTick();
    recalculateTreemap();
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Failed to analyze storage';
  } finally {
    loading.value = false;
  }
}

function confirmDelete(item) {
  emit('deleteItem', {
    name:        item.name,
    path:        item.path,
    isDirectory: false
  });
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────
onMounted(async () => {
  await runAnalysis();
  await nextTick();
  if (treemapRef.value) {
    resizeObs = new ResizeObserver(() => recalculateTreemap());
    resizeObs.observe(treemapRef.value);
  }
});

onUnmounted(() => {
  if (resizeObs) resizeObs.disconnect();
});
</script>

<style scoped>
.space-analyzer {
  background: var(--bg-surface);
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sa-header {
  padding: 20px 28px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-shrink: 0;
  background: rgba(255,255,255,0.01);
}

.sa-title {
  font-size: 1.3rem;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.02em;
}

.sa-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 0;
  padding: 40px;
}

.sa-body {
  display: flex;
  flex-direction: row;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

@media (max-width: 768px) {
  .sa-body { flex-direction: column; overflow-y: auto; }
}

.sa-section {
  flex: 1;
  padding: 22px 26px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--border);
  min-width: 0;
}
.sa-section:last-child { border-right: none; }

.sa-section h3 {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 2px;
}

/* ── Treemap ──────────────────────────────────────────────────────────────── */
.treemap-container {
  flex: 1;
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 320px;
  background: rgba(0,0,0,0.18);
  border-radius: 10px;
  overflow: hidden;
}

.tm-box {
  position: absolute;
  overflow: hidden;
  border-radius: 5px;
  border: 1px solid rgba(255,255,255,0.08);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: white;
  cursor: crosshair;
}
.tm-box:hover {
  transform: scale(0.97);
  z-index: 10;
  border-color: rgba(255,255,255,0.35);
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}

.tm-content {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 4px;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.tm-name {
  font-size: 0.78rem;
  font-weight: 600;
  text-shadow: 0 1px 4px rgba(0,0,0,0.9);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 92%;
}

.tm-size {
  font-size: 0.7rem;
  text-shadow: 0 1px 3px rgba(0,0,0,0.9);
  opacity: 0.88;
}

/* ── Hog List ──────────────────────────────────────────────────────────────── */
.hog-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 4px;
}

.hog-list::-webkit-scrollbar { width: 5px; }
.hog-list::-webkit-scrollbar-track { background: transparent; }
.hog-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

.hog-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: rgba(255,255,255,0.025);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  transition: all 0.15s;
  position: relative;
}
.hog-item:hover {
  background: rgba(255,255,255,0.05);
  border-color: rgba(255,255,255,0.08);
}

.hog-info {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  font-size: 0.85rem;
}
.hog-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 10px;
  font-size: 0.82rem;
  color: var(--text-primary);
}
.hog-size {
  font-weight: 700;
  color: var(--warning);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.hog-bar-wrap {
  width: 100%;
  height: 3px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px;
  overflow: hidden;
}
.hog-bar {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.file-bar { background: var(--warning); }

.hog-actions {
  position: absolute;
  right: 8px;
  top: 8px;
  opacity: 0;
  transition: opacity 0.15s;
}
.sa-file-item:hover .hog-actions { opacity: 1; }
.hog-actions .btn-icon {
  cursor: pointer;
  transition: all 0.15s;
  padding: 3px 5px;
  border-radius: 5px;
}
.hog-actions .btn-icon:hover { background: var(--danger-dim); }
</style>
