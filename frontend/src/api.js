/**
 * SSHFM API client
 * All HTTP calls go through here — no axios scattered across components.
 */
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// ─── Connection ────────────────────────────────────────────────────────────

export async function connectSSH({ host, port, username, password, privateKey }) {
  const { data } = await api.post('/connect', { host, port, username, password, privateKey });
  return data;
}

export async function disconnectSSH(sessionId) {
  const { data } = await api.post('/disconnect', { sessionId });
  return data;
}

export async function setSessionMode(sessionId, mode) {
  const { data } = await api.post('/session/mode', { sessionId, mode });
  return data;
}

export async function getSessionInfo(sessionId) {
  const { data } = await api.get('/session/info', { params: { sessionId } });
  return data;
}

export async function getSessionLogs(sessionId) {
  const { data } = await api.get('/session/logs', { params: { sessionId } });
  return data;
}

// ─── File Operations ───────────────────────────────────────────────────────

export async function listFiles(sessionId, path = '/') {
  const { data } = await api.get('/files', { params: { sessionId, path } });
  return data;
}

export async function getFileInfo(sessionId, path) {
  const { data } = await api.get('/files/info', { params: { sessionId, path } });
  return data;
}

export async function deleteFile(sessionId, path, isDirectory = false) {
  const { data } = await api.delete('/files', { data: { sessionId, path, isDirectory } });
  return data;
}

export async function renameFile(sessionId, oldPath, newPath) {
  const { data } = await api.post('/files/rename', { sessionId, oldPath, newPath });
  return data;
}

export async function createDirectory(sessionId, path) {
  const { data } = await api.post('/files/mkdir', { sessionId, path });
  return data;
}

export async function uploadFile(sessionId, path, file, onProgress) {
  const formData = new FormData();
  formData.append('sessionId', sessionId);
  formData.append('path', path);
  formData.append('file', file);

  const { data } = await api.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    },
  });
  return data;
}

export function getDownloadUrl(sessionId, path) {
  return `/api/files/download?sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(path)}`;
}

export async function healthCheck() {
  const { data } = await api.get('/health');
  return data;
}

// ─── Disk & Stats ──────────────────────────────────────────────────────────

export async function getDiskUsage(sessionId, path = '/') {
  const { data } = await api.get('/disk', { params: { sessionId, path } });
  return data;
}

export async function analyzeDisk(sessionId, path) {
  const { data } = await api.get('/disk/analyze', { params: { sessionId, path } });
  return data;
}

export async function getDiskMounts(sessionId) {
  const { data } = await api.get('/disk/mounts', { params: { sessionId } });
  return data;
}

export async function getFolderSize(sessionId, path) {
  const { data } = await api.get('/files/du', { params: { sessionId, path } });
  return data;
}

export async function searchFiles(sessionId, dir, q) {
  const { data } = await api.get('/files/search', { params: { sessionId, dir, q } });
  return data;
}

// ─── Copy / Move ───────────────────────────────────────────────────────────

export async function copyFile(sessionId, srcPath, dstPath) {
  const { data } = await api.post('/files/copy', { sessionId, srcPath, dstPath });
  return data;
}

export async function moveFile(sessionId, srcPath, dstPath) {
  const { data } = await api.post('/files/move', { sessionId, srcPath, dstPath });
  return data;
}

export default api;
