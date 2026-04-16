<template>
  <div id="app-root">
    <!-- Particle background -->
    <div class="bg-glow bg-glow--1"></div>
    <div class="bg-glow bg-glow--2"></div>

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
  overflow: visible;
}

/* Ambient glow backgrounds */
.bg-glow {
  position: fixed;
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.07;
  pointer-events: none;
  z-index: 0;
}

.bg-glow--1 {
  width: 600px;
  height: 600px;
  background: #6c8ef5;
  top: -200px;
  left: -200px;
}

.bg-glow--2 {
  width: 500px;
  height: 500px;
  background: #a78bfa;
  bottom: -150px;
  right: -150px;
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
