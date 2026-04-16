<template>
  <div v-if="selectedFiles.length > 0" class="selection-bar">
    <div class="selection-count">✓ {{ selectedFiles.length }} file(s) selected</div>
    <button class="btn-secondary btn-sm" @click="$emit('copy')">Copy</button>
    <button class="btn-secondary btn-sm" @click="$emit('cut')">Cut</button>
    <button class="btn-secondary btn-sm" :disabled="clipboard.mode === null" @click="$emit('paste')">Paste</button>
    <button class="btn-danger btn-sm" @click="$emit('delete')">Delete</button>
    <button class="btn-icon" @click="$emit('clear')" style="margin-left: auto;">× Clear</button>
  </div>
</template>

<script setup>
const props = defineProps({
  selectedFiles: { type: Array, required: true },
  clipboard: { type: Object, required: true },
  currentPath: { type: String, required: true }
});

const emit = defineEmits(['copy', 'cut', 'paste', 'delete', 'clear']);
</script>

<style scoped>
/* Specific CSS variables used globally via main.css */
</style>
