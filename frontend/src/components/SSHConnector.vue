<template>
  <div class="connector">
    <!-- Header -->
    <div class="connector__header">
      <div class="logo">
        <img src="/logo.png" alt="SSHFM Logo" width="60" height="60" style="border-radius: 12px; box-shadow: 0 4px 16px rgba(187, 154, 247, 0.4);" />
        <span class="logo__text" style="font-size: 2.4rem; margin-left: 8px;">SSHFM</span>
      </div>
      <p class="connector__subtitle">SSH File Manager — sleek, fast, open source</p>
    </div>

    <!-- Form Card (Add New) -->
    <div class="card fade-in" v-if="!hasSavedVault || (hasSavedVault && unlockedVault && addingNew)">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px">
        <h2 class="card__title" style="margin:0">Connect to Server</h2>
        <button v-if="unlockedVault" @click="addingNew = false" class="btn-secondary btn-sm">Cancel</button>
      </div>

      <form @submit.prevent="handleConnect" class="form">
        <div class="form-group">
          <label class="form-label">Profile Alias (Optional)</label>
          <input
            v-model="form.alias"
            type="text"
            placeholder="e.g. Production Web Server"
            autocomplete="off"
          />
        </div>

        <!-- Host + Port -->
        <div class="form-row">
          <div class="form-group" style="flex: 3">
            <label class="form-label">Host</label>
            <input
              id="ssh-host"
              v-model="form.host"
              type="text"
              placeholder="192.168.1.1 or example.com"
              required
              autocomplete="off"
              spellcheck="false"
            />
          </div>
          <div class="form-group" style="flex: 1">
            <label class="form-label">Port</label>
            <input
              id="ssh-port"
              v-model.number="form.port"
              type="number"
              placeholder="22"
              min="1"
              max="65535"
            />
          </div>
        </div>

        <!-- Username -->
        <div class="form-group">
          <label class="form-label">Username</label>
          <input
            id="ssh-username"
            v-model="form.username"
            type="text"
            placeholder="root"
            required
            autocomplete="username"
            spellcheck="false"
          />
        </div>

        <!-- Auth mode toggle -->
        <div class="auth-toggle">
          <button
            type="button"
            :class="['toggle-btn', authMode === 'password' && 'active']"
            @click="authMode = 'password'"
          >🔑 Password</button>
          <button
            type="button"
            :class="['toggle-btn', authMode === 'key' && 'active']"
            @click="authMode = 'key'"
          >🗝️ Private Key</button>
        </div>

        <!-- Password -->
        <div v-if="authMode === 'password'" class="form-group">
          <label class="form-label">Password</label>
          <div class="input-wrap">
            <input
              id="ssh-password"
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="••••••••"
              autocomplete="current-password"
            />
            <button
              type="button"
              class="btn-icon show-pass"
              @click="showPassword = !showPassword"
            >{{ showPassword ? '🙈' : '👁️' }}</button>
          </div>
        </div>

        <!-- Private Key -->
        <div v-if="authMode === 'key'" class="form-group">
          <label class="form-label">Private Key (PEM)</label>
          <textarea
            id="ssh-key"
            v-model="form.privateKey"
            placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;..."
            rows="5"
            class="mono"
            spellcheck="false"
          />
        </div>

        <!-- Error -->
        <transition name="slide-fade">
          <div v-if="error" class="alert alert--error" style="margin-bottom: 8px">
            <span>⚠️</span>
            <span>{{ error }}</span>
          </div>
        </transition>

        <!-- Vault Saving -->
        <div class="form-group vault-wrap" style="background: rgba(16,185,129,0.05); padding: 12px; border: 1px solid rgba(16,185,129,0.2); border-radius: 8px; margin-bottom: 8px;">
          <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; cursor:pointer;" class="text-primary">
            <input type="checkbox" v-model="saveToVault" />
            <span style="display:flex; align-items:center; gap:4px">
              <span style="font-size: 1.1rem; color: var(--accent);">🔐</span> 
              <strong>Securely encrypt locally</strong>
            </span>
          </label>
          <transition name="slide-fade">
            <div v-if="saveToVault" style="margin-top: 10px;">
              <input
                v-if="!unlockedVault"
                id="vault-pass"
                v-model="vaultMasterPassword"
                type="password"
                placeholder="Create Vault Master Password"
                required
              />
              <p class="text-muted" style="font-size: 0.7rem; margin-top: 6px;">
                <span v-if="unlockedVault">Your connection will be added to your active encrypted vault natively.</span>
                <span v-else>AES-GCM 256-bit encryption. Do not forget your master password!</span>
              </p>
            </div>
          </transition>
        </div>

        <!-- Submit -->
        <button
          id="connect-btn"
          type="submit"
          class="btn-primary submit-btn"
          :disabled="loading"
        >
          <span v-if="loading" class="spinner spin">⟳</span>
          <span>{{ loading ? 'Connecting…' : 'Connect' }}</span>
        </button>
      </form>
    </div>

    <!-- Vault Unlock Card -->
    <div class="card fade-in" v-else-if="hasSavedVault && !unlockedVault">
      <div style="text-align:center; margin-bottom: 24px;">
        <div style="font-size: 3rem; margin-bottom: 8px;">🔐</div>
        <h2 class="card__title" style="margin-bottom:4px">Unlock Connection Vault</h2>
        <p class="text-muted" style="font-size: 0.85rem">Enter your master password to decrypt</p>
      </div>

      <form @submit.prevent="unlockVault" class="form">
        <div class="form-group">
          <input
            v-model="vaultMasterPassword"
            type="password"
            placeholder="Master Password"
            required
            autocomplete="current-password"
            style="text-align:center"
          />
        </div>

        <transition name="slide-fade">
          <div v-if="error" class="alert alert--error" style="justify-content:center">
            <span>⚠️</span>
            <span>{{ error }}</span>
          </div>
        </transition>

        <button type="submit" class="btn-primary submit-btn" :disabled="loading" style="background:var(--accent)">
          <span v-if="loading" class="spinner spin">⟳</span>
          <span>{{ loading ? 'Decrypting…' : 'Unlock Vault' }}</span>
        </button>

        <button type="button" @click="clearVault" class="btn-secondary submit-btn" style="margin-top:8px">
          Destroy Vault & Setup New
        </button>
      </form>
    </div>

    <!-- Saved Profiles List -->
    <div class="card fade-in" v-else-if="hasSavedVault && unlockedVault && !addingNew">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px">
        <h2 class="card__title" style="margin:0">Saved Servers</h2>
        <div style="font-size: 1.5rem;">🔐</div>
      </div>

      <div class="profiles-list">
        <div v-for="(profile, idx) in savedProfiles" :key="idx" class="profile-card clickable" @click="connectToProfile(profile)">
          <div class="profile-icon">🖥️</div>
          <div class="profile-info">
            <div class="profile-alias">{{ profile.alias || profile.host }}</div>
            <div class="profile-sub mono">{{ profile.username }}@{{ profile.host }}:{{ profile.port || 22 }}</div>
          </div>
          <div class="profile-connect">Connect <span>→</span></div>
        </div>
        
        <button class="btn-secondary submit-btn" style="margin-top:16px; border-style:dashed" @click="addingNew = true">
          + Add New Server
        </button>
      </div>
      
      <transition name="slide-fade">
        <div v-if="error" class="alert alert--error" style="margin-top: 16px">
          <span>⚠️</span><span>{{ error }}</span>
        </div>
      </transition>
    </div>

    <!-- Footer -->
    <p class="footer">
      Open source ·
      <a href="https://github.com/YOUR_USERNAME/sshfm" target="_blank" rel="noopener">GitHub</a>
      · Port 6969 and proud
    </p>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { connectSSH } from '../api';
import { useVault } from '../composables/useVault';

const emit = defineEmits(['connected']);
const { encryptData, decryptData, globalUnlockedVault, globalSavedProfiles } = useVault();

const authMode    = ref('password');
const showPassword = ref(false);
const loading     = ref(false);
const error       = ref('');

// Vault state
const hasSavedVault = ref(false);
const unlockedVault = globalUnlockedVault;
const saveToVault = ref(false);
const vaultMasterPassword = ref('');
const savedProfiles = globalSavedProfiles;
const addingNew = ref(false);

const form = reactive({
  alias: '',
  host: '',
  port: 22,
  username: '',
  password: '',
  privateKey: '',
});

async function handleConnect() {
  error.value = '';
  loading.value = true;

  try {
    const payload = {
      alias: form.alias.trim(),
      host: form.host.trim(),
      port: form.port || 22,
      username: form.username.trim(),
    };

    if (authMode.value === 'password') {
      payload.password = form.password;
    } else {
      payload.privateKey = form.privateKey.trim();
    }

    if (saveToVault.value) {
      if (!vaultMasterPassword.value) throw new Error("Vault password required to save securely.");
      const profilesToSave = unlockedVault.value ? [...savedProfiles.value] : [];
      profilesToSave.push(payload);
      
      const encrypted = await encryptData(profilesToSave, vaultMasterPassword.value);
      localStorage.setItem('sshfm_vault', encrypted);
      savedProfiles.value = profilesToSave;
      unlockedVault.value = true;
      hasSavedVault.value = true;
    }

    const res = await connectSSH(payload);
    emit('connected', {
      sessionId: res.sessionId,
      host: form.host,
      username: form.username,
    });
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Connection failed';
  } finally {
    loading.value = false;
  }
}

async function connectToProfile(profile) {
  error.value = '';
  loading.value = true;
  try {
    const res = await connectSSH(profile);
    emit('connected', {
      sessionId: res.sessionId,
      host: profile.host,
      username: profile.username,
    });
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Saved connection failed';
  } finally {
    loading.value = false;
  }
}

async function unlockVault() {
  error.value = '';
  loading.value = true;
  try {
    const vaultData = localStorage.getItem('sshfm_vault');
    if (!vaultData) throw new Error("Vault empty");
    
    // Decrypt credentials natively
    const payload = await decryptData(vaultData, vaultMasterPassword.value);
    
    if (Array.isArray(payload)) {
      savedProfiles.value = payload;
    } else {
      savedProfiles.value = [payload]; // upgrade legacy single-saves
    }
    unlockedVault.value = true;
    saveToVault.value = true; // keep subsequent saves checked
    
  } catch (err) {
    error.value = err.message || 'Decryption failed: Incorrect master password?';
  } finally {
    loading.value = false;
  }
}

function clearVault() {
  localStorage.removeItem('sshfm_vault');
  hasSavedVault.value = false;
  unlockedVault.value = false;
  addingNew.value = false;
  savedProfiles.value = [];
  error.value = '';
  vaultMasterPassword.value = '';
}

onMounted(() => {
  if (localStorage.getItem('sshfm_vault')) {
    hasSavedVault.value = true;
  }
});
</script>

<style scoped>
.connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
  gap: 20px;
}

.connector__header {
  text-align: center;
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 8px;
}

.logo__icon {
  font-size: 2rem;
  filter: drop-shadow(0 0 10px rgba(108, 142, 245, 0.6));
}

.logo__text {
  font-size: 2.2rem;
  font-weight: 700;
  letter-spacing: -0.5px;
  background: linear-gradient(135deg, #6c8ef5, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.connector__subtitle {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 32px;
  width: 100%;
  max-width: 460px;
  box-shadow: var(--shadow-lg);
}

.card__title {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 24px;
  color: var(--text-primary);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

textarea {
  font-size: 0.8rem;
  resize: vertical;
  min-height: 100px;
}

.input-wrap {
  position: relative;
}

.input-wrap input {
  padding-right: 42px;
}

.show-pass {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 1rem;
}

.auth-toggle {
  display: flex;
  gap: 8px;
  padding: 4px;
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
}

.toggle-btn {
  flex: 1;
  padding: 7px 14px;
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.82rem;
  border: none;
  transition: all 0.2s;
}

.toggle-btn.active {
  background: var(--bg-highlight);
  color: var(--text-primary);
}

.alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
}

.alert--error {
  background: var(--danger-dim);
  border: 1px solid rgba(248, 113, 113, 0.25);
  color: var(--danger);
}

.submit-btn {
  width: 100%;
  justify-content: center;
  padding: 12px;
  font-size: 0.95rem;
  margin-top: 4px;
}

.spinner {
  display: inline-block;
  font-size: 1rem;
}

.footer {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.footer a {
  color: var(--accent-dim);
  text-decoration: none;
}

.footer a:hover { color: var(--accent); }

.profiles-list {
  display: flex; flex-direction: column; gap: 12px;
}
.profile-card {
  display: flex; align-items: center; gap: 16px; padding: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: var(--radius-md); transition: all 0.2s;
}
.profile-card:hover {
  background: var(--bg-hover); border-color: var(--accent); transform: translateY(-2px);
}
.profile-icon { font-size: 1.8rem; }
.profile-info { flex: 1; overflow: hidden; }
.profile-alias { font-weight: 600; font-size: 1rem; color: var(--text-primary); margin-bottom: 2px; }
.profile-sub { font-size: 0.8rem; color: var(--text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
.profile-connect { font-size: 0.85rem; font-weight: 500; color: var(--accent); opacity: 0; transition: opacity 0.2s; }
.profile-card:hover .profile-connect { opacity: 1; }

/* Transition */
.slide-fade-enter-active,
.slide-fade-leave-active { transition: all 0.25s ease; }
.slide-fade-enter-from,
.slide-fade-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
