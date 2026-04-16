<template>
  <div v-if="transfers.length > 0" class="transfer-queue">
    <div v-for="t in transfers" :key="t.id" class="transfer-item">
      <div class="transfer-name">
        <span>
          <span v-if="t.type === 'uploading'">⬆ </span>
          <span v-else-if="t.type === 'copy'">📄 </span>
          <span v-else-if="t.type === 'cut'">✂️ </span>
          {{ t.name }}
        </span>
        <span>{{ t.progress }}%</span>
      </div>
      <div class="disk-bar">
        <div class="disk-fill" :style="{ width: t.progress + '%', background: t.status === 'error' ? 'var(--danger)' : t.status === 'done' ? 'var(--success)' : 'var(--accent)' }"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  transfers: { type: Array, required: true }
});
</script>

<style scoped>
/* Specific CSS variables used globally via main.css */
</style>
