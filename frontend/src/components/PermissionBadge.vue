<template>
  <div class="permission-badge">
    <button 
      class="hud-pill hud-pill--mode clickable" 
      :class="[mode === 'sudo' ? 'hud-pill--sudo' : '']"
      @click="showModal = true"
      title="Access Mode"
    >
      <span class="pill-icon">{{ mode === 'sudo' ? '⚡' : '🔒' }}</span>
      <span class="pill-label">{{ mode === 'sudo' ? 'Sudo' : 'Normal' }}</span>
    </button>

    <!-- Modal -->
    <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
      <div class="modal fade-in">
        <h3 class="modal__title">Access Mode</h3>
        <p class="modal__sub text-muted" style="margin-bottom: 20px;">
          Elevate your privileges to move or delete protected files. 
          Requires passwordless <code>sudo</code> access on the remote server.
        </p>

        <div class="mode-options">
          <label 
            class="mode-option" 
            :class="{ active: mode === 'normal' }"
          >
            <div class="mode-option__radio">
              <input type="radio" :checked="mode === 'normal'" @change="switchMode('normal')" name="mode">
            </div>
            <div class="mode-option__info">
              <div class="mode-option__title">🔒 Normal Mode</div>
              <div class="mode-option__desc text-muted">Standard SFTP access. Use this for your own files.</div>
            </div>
          </label>

          <label 
            class="mode-option" 
            :class="{ active: mode === 'sudo' }"
          >
            <div class="mode-option__radio">
              <input type="radio" :checked="mode === 'sudo'" @change="switchMode('sudo')" name="mode">
            </div>
            <div class="mode-option__info">
              <div class="mode-option__title">⚡ Sudo Mode</div>
              <div class="mode-option__desc text-muted">Executes commands as root. Modifying protected files won't be blocked.</div>
            </div>
          </label>
        </div>

        <div v-if="error" class="alert alert--error" style="margin-top: 16px;">
          <span>⚠️</span>
          <span>{{ error }}</span>
        </div>

        <div class="modal__actions" style="margin-top: 24px;">
          <button class="btn-secondary" @click="closeModal">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { setSessionMode } from '../api';

const props = defineProps({
  session: { type: Object, required: true },
  mode: { type: String, default: 'normal' }
});

const emit = defineEmits(['update:mode']);

const showModal = ref(false);
const error = ref('');
const loading = ref(false);

function closeModal() {
  showModal.value = false;
  error.value = '';
}

async function switchMode(newMode) {
  if (newMode === props.mode) return;
  
  error.value = '';
  loading.value = true;
  
  try {
    const res = await setSessionMode(props.session.sessionId, newMode);
    emit('update:mode', res.mode);
    if(res.mode === 'normal') {
      setTimeout(() => closeModal(), 300);
    }
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Failed to switch mode';
    // Revert visually if failed
    emit('update:mode', props.mode);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.permission-badge {
  display: inline-flex;
}

.clickable {
  cursor: pointer;
  transition: all 0.2s;
}
.clickable:hover {
  background: var(--bg-hover) !important;
  transform: translateY(-1px);
}

.hud-pill--sudo {
  border-color: rgba(250, 204, 21, 0.4);
  color: #facc15;
}
.hud-pill--sudo .pill-icon {
  text-shadow: 0 0 10px rgba(250, 204, 21, 0.5);
}

.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px); z-index: 300; display: flex; align-items: center; justify-content: center; padding: 24px;
}
.modal {
  background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: 28px; width: 100%; max-width: 480px; box-shadow: var(--shadow-lg);
}
.modal__title { font-size: 1.1rem; font-weight: 600; margin-bottom: 2px; }
.modal__actions { display: flex; justify-content: flex-end; gap: 10px; }

.mode-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mode-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(255,255,255,0.02);
}

.mode-option:hover {
  background: var(--bg-hover);
}

.mode-option.active {
  border-color: var(--accent);
  background: var(--accent-glow);
}

.mode-option__radio {
  padding-top: 2px;
}

.mode-option__title {
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 4px;
}

.mode-option__desc {
  font-size: 0.82rem;
  line-height: 1.4;
}

.alert { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: var(--radius-md); font-size: 0.875rem; }
.alert--error { background: var(--danger-dim); border: 1px solid rgba(248, 113, 113, 0.25); color: var(--danger); }
</style>
