<template>
  <div v-if="visible" class="context-menu" :style="{ left: posX + 'px', top: posY + 'px' }" @click.stop>
    <template v-if="file">
      <div class="ctx-item" v-if="file.isDirectory" @click="emitAction('open')">
        <span><Icon name="folder-open" /></span> Open
      </div>
      <div class="ctx-item" v-else @click="emitAction('download')">
        <span><Icon name="download" /></span> Download
      </div>
      
      <div class="ctx-divider"></div>
      
      <div class="ctx-item" @click="emitAction('copy')">
        <span><Icon name="file" /></span> Copy
      </div>
      <div class="ctx-item" @click="emitAction('cut')">
        <span><Icon name="cut" /></span> Cut
      </div>
    </template>
    
    <div class="ctx-item" v-if="canPaste" @click="emitAction('paste')">
      <span><Icon name="list" /></span> Paste
    </div>
    
    <template v-if="file">
      <div class="ctx-divider"></div>
      
      <div class="ctx-item" @click="emitAction('rename')">
        <span><Icon name="edit" /></span> Rename
      </div>
      <div class="ctx-item" @click="emitAction('info')">
        <span>ℹ️</span> Get Info
      </div>
      
      <div class="ctx-divider"></div>
      
      <div class="ctx-item ctx-item--danger" @click="emitAction('delete')">
        <span><Icon name="trash" /></span> Delete
      </div>
    </template>
  </div>
</template>

<script setup>
import Icon from './Icon.vue';
import { computed, watch, ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  visible: Boolean,
  x: Number,
  y: Number,
  file: Object,
  clipboard: Object,
  canPaste: Boolean
});

const emit = defineEmits(['action', 'close']);

const posX = ref(props.x);
const posY = ref(props.y);

// Simple auto-adjust to prevent menu going off-screen
watch(() => [props.x, props.y, props.visible], () => {
  if (props.visible) {
    let x = props.x;
    let y = props.y;
    // rough approximation since we don't know the exact dom dimensions before render
    if (x + 180 > window.innerWidth) x = window.innerWidth - 180;
    if (y + 300 > window.innerHeight) y = window.innerHeight - 300;
    posX.value = x;
    posY.value = y;
  }
});

function emitAction(type) {
  emit('action', type, props.file);
}

function handleGlobalClick() {
  if (props.visible) emit('close');
}

function handleScroll() {
  if (props.visible) emit('close');
}

onMounted(() => {
  document.addEventListener('click', handleGlobalClick);
  window.addEventListener('scroll', handleScroll, true);
});

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick);
  window.removeEventListener('scroll', handleScroll, true);
});
</script>

<style scoped>
/* Scoped styles are kept minimal here since context menu classes are global in main.css per spec */
</style>
