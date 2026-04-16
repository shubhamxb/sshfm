import { ref } from 'vue';

const globalUnlockedVault = ref(false);
const globalSavedProfiles = ref([]);

export function useVault() {
  
  // Hash a password into an AES-GCM cipher key
  async function deriveKey(password, saltUint8) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]
    );
    return window.crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: saltUint8, iterations: 100000, hash: "SHA-256" },
      keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
    );
  }

  // Encrypt an object
  async function encryptData(dataObj, password) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    
    const enc = new TextEncoder();
    const encoded = enc.encode(JSON.stringify(dataObj));
    
    const ciphertext = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
    
    // Package into base64 for easy localstorage
    const cipherArray = Array.from(new Uint8Array(ciphertext));
    const payload = {
      s: Array.from(salt),
      i: Array.from(iv),
      c: cipherArray
    };
    return btoa(JSON.stringify(payload));
  }

  // Decrypt a packaged base64 string back into object
  async function decryptData(base64Payload, password) {
    try {
      const payload = JSON.parse(atob(base64Payload));
      const salt = new Uint8Array(payload.s);
      const iv = new Uint8Array(payload.i);
      const ciphertext = new Uint8Array(payload.c);
      
      const key = await deriveKey(password, salt);
      const decryptedBuffer = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
      
      const dec = new TextDecoder();
      return JSON.parse(dec.decode(decryptedBuffer));
    } catch (e) {
      throw new Error('Invalid vault password or corrupted data');
    }
  }

  return { encryptData, decryptData, globalUnlockedVault, globalSavedProfiles };
}
