<template>
  <div id="app-root">

    <transition name="page" mode="out-in">
      <!-- Connected: show file manager -->
      <FileManager
        v-if="session"
        :key="session.sessionId"
        :session="session"
        @disconnect="handleDisconnect"
      />
      <!-- Not connected: show login -->
      <SSHConnector
        v-else
        @connected="handleConnected"
      />
    </transition>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import SSHConnector from './components/SSHConnector.vue';
import FileManager from './components/FileManager.vue';
import { disconnectSSH } from './api';

const session = ref(null);

function handleConnected(sessionInfo) {
  session.value = sessionInfo;
}

async function handleDisconnect() {
  if (session.value) {
    try {
      await disconnectSSH(session.value.sessionId);
    } catch (e) {
      // silent fail — we're logging out anyway
    }
  }
  session.value = null;
}
</script>

<style>
#app-root {
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
}

/* Page transitions */
.page-enter-active,
.page-leave-active {
  transition: all 0.3s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(16px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-16px);
}
</style>
