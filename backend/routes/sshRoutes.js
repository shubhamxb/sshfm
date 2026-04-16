/**
 * SSH Routes — the API endpoints that make the magic happen
 * All session-based: each connection is stored server-side by session ID
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();

const {
  createConnection,
  listFiles,
  getFileInfo,
  deleteFile,
  renameFile,
  downloadFile,
  uploadFile,
  createDirectory,
  closeConnection,
  execCommand,
} = require('../utils/sshConnection');
const {
  ConnectionError,
  AuthenticationError,
  FileNotFoundError,
  PermissionError,
  SSHFMError,
} = require('../utils/errors');
const config = require('../config');

// In-memory session store: sessionId -> ssh Client
// In production, consider redis or a proper session store
const sessions = new Map();

// Multer for file uploads — store in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxFileSizeBytes },
});

// Helper to escape path arguments for shell commands
function escapePath(p) {
  // Wrap in single quotes and safely escape existing single quotes for bash
  return `'${String(p).replace(/'/g, "'\"'\"'")}'`;
}

// ─── Helper ────────────────────────────────────────────────────────────────

function getSession(sessionId) {
  const sessionObj = sessions.get(sessionId);
  if (!sessionObj) {
    throw new ConnectionError('No active SSH session — please connect first');
  }
  return sessionObj;
}

function sendError(res, err) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'An unexpected error occurred';
  console.error(`[API] ✗ ${err.name || 'Error'}: ${message}`);
  res.status(statusCode).json({ success: false, error: message });
}

function execSudo(sessionObj, cmdTail) {
  if (sessionObj.sudoMethod === 'sudo -S -p ""') {
    return execCommand(sessionObj.conn, `sudo -S -p "" ${cmdTail}`, sessionObj.password);
  }
  return execCommand(sessionObj.conn, `sudo -n ${cmdTail}`);
}

function logAudit(sessionObj, action, target) {
  if (!sessionObj.auditLog) sessionObj.auditLog = [];
  sessionObj.auditLog.unshift({
    id: Date.now() + Math.random(),
    action,
    target,
    timestamp: new Date().toISOString()
  });
  if (sessionObj.auditLog.length > 20) sessionObj.auditLog = sessionObj.auditLog.slice(0, 20);
}

// ─── POST /api/connect ──────────────────────────────────────────────────────

router.post('/connect', async (req, res) => {
  const { host, port, username, password, privateKey } = req.body;

  if (!host || !username) {
    return res.status(400).json({ success: false, error: 'host and username are required' });
  }

  console.log(`[API] Connection attempt → ${username}@${host}:${port || 22}`);

  try {
    const conn = await createConnection({ host, port, username, password, privateKey });

    // Generate a simple session ID
    const sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessions.set(sessionId, { conn, mode: 'normal', username, host, password, sudoMethod: 'sudo -n', auditLog: [] });

    // Auto-cleanup on connection close
    conn.on('close', () => {
      sessions.delete(sessionId);
      console.log(`[SSH] Session ${sessionId} cleaned up`);
    });
    conn.on('error', () => {
      sessions.delete(sessionId);
    });

    res.json({
      success: true,
      sessionId,
      message: `Connected to ${host} as ${username}`,
    });
  } catch (err) {
    sendError(res, err);
  }
});

// ─── POST /api/disconnect ───────────────────────────────────────────────────

router.post('/disconnect', (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'sessionId is required' });
  }

  const sessionObj = sessions.get(sessionId);
  if (sessionObj && sessionObj.conn) {
    closeConnection(sessionObj.conn);
    sessions.delete(sessionId);
  }

  res.json({ success: true, message: 'Disconnected' });
});

// ─── GET /api/session/info ──────────────────────────────────────────────────

router.get('/session/info', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'sessionId is required' });
  }

  try {
    const sessionObj = getSession(sessionId);
    res.json({
      success: true,
      mode: sessionObj.mode,
      username: sessionObj.username,
      host: sessionObj.host
    });
  } catch (err) {
    sendError(res, err);
  }
});

// ─── POST /api/session/mode ─────────────────────────────────────────────────

router.post('/session/mode', async (req, res) => {
  const { sessionId, mode } = req.body;
  
  if (!sessionId || !mode) {
    return res.status(400).json({ success: false, error: 'sessionId and mode are required' });
  }

  if (mode !== 'normal' && mode !== 'sudo') {
    return res.status(400).json({ success: false, error: 'Mode must be "normal" or "sudo"' });
  }

  try {
    const sessionObj = getSession(sessionId);
    
    // If switching to sudo, let's verify if sudo is reachable
    if (mode === 'sudo') {
      try {
        await execCommand(sessionObj.conn, 'sudo -n true');
        sessionObj.sudoMethod = 'sudo -n';
      } catch (e) {
        if (sessionObj.password) {
          try {
            await execCommand(sessionObj.conn, 'sudo -S -p "" true', sessionObj.password);
            sessionObj.sudoMethod = 'sudo -S -p ""';
          } catch (e2) {
            return res.status(403).json({ 
              success: false, 
              error: 'Sudo failed: Invalid password or not allowed on this server.' 
            });
          }
        } else {
          return res.status(403).json({ 
            success: false, 
            error: 'Sudo requires a password, but you connected using a private key.' 
          });
        }
      }
    }

    sessionObj.mode = mode;
    console.log(`[API] Session ${sessionId} mode switched to: ${mode}`);
    logAudit(sessionObj, 'Security', `Switched access to ${mode === 'sudo' ? 'Sudo (Privileged)' : 'Normal'}`);
    
    res.json({ success: true, mode: sessionObj.mode });
  } catch (err) {
    sendError(res, err);
  }
});

// ─── GET /api/files ─────────────────────────────────────────────────────────

router.get('/files', async (req, res) => {
  const { sessionId, path: dirPath = '/' } = req.query;

  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'sessionId is required' });
  }

  console.log(`[API] List files → sessionId=${sessionId} path=${dirPath}`);

  try {
    const sessionObj = getSession(sessionId);
    const { conn, mode, username } = sessionObj;
    
    let actualPath = dirPath;
    if (actualPath === '~' || actualPath === '~/') {
      actualPath = username === 'root' ? '/root' : `/home/${username}`;
    }
    
    const files = await listFiles(conn, actualPath);
    res.json({ success: true, path: actualPath, files });
  } catch (err) {
    sendError(res, err);
  }
});

// ─── GET /api/files/info ────────────────────────────────────────────────────

router.get('/files/info', async (req, res) => {
  const { sessionId, path: filePath } = req.query;

  if (!sessionId || !filePath) {
    return res.status(400).json({ success: false, error: 'sessionId and path are required' });
  }

  try {
    const { conn } = getSession(sessionId);
    const info = await getFileInfo(conn, filePath);
    res.json({ success: true, info });
  } catch (err) {
    sendError(res, err);
  }
});

// ─── GET /api/files/download ────────────────────────────────────────────────

router.get('/files/download', async (req, res) => {
  const { sessionId, path: filePath } = req.query;

  if (!sessionId || !filePath) {
    return res.status(400).json({ success: false, error: 'sessionId and path are required' });
  }

  console.log(`[API] Download → ${filePath}`);

  try {
    const { conn } = getSession(sessionId);
    const stream = await downloadFile(conn, filePath);
    const filename = path.basename(filePath);

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    stream.pipe(res);
  } catch (err) {
    sendError(res, err);
  }
});

// ─── POST /api/files/upload ─────────────────────────────────────────────────

router.post('/files/upload', upload.single('file'), async (req, res) => {
  const { sessionId, path: remotePath } = req.body;

  if (!sessionId || !remotePath || !req.file) {
    return res.status(400).json({ success: false, error: 'sessionId, path, and file are required' });
  }

  console.log(`[API] Upload → ${remotePath}/${req.file.originalname} (${req.file.size} bytes)`);

  try {
    const sessionObj = getSession(sessionId);
    const { conn, mode } = sessionObj;
    const targetPath = `${remotePath.replace(/\/$/, '')}/${req.file.originalname}`;
    
    if (mode === 'sudo') {
      // Create a temporary file, upload there, then sudo mv it
      const tmpPath = `/tmp/sshfm_upload_${Date.now()}_${req.file.originalname}`;
      await uploadFile(conn, req.file.buffer, tmpPath);
      await execSudo(sessionObj, `mv ${escapePath(tmpPath)} ${escapePath(targetPath)}`);
    } else {
      await uploadFile(conn, req.file.buffer, targetPath);
    }
    
    logAudit(sessionObj, 'Uploaded', targetPath);
    res.json({ success: true, message: `Uploaded ${req.file.originalname}`, path: targetPath });
  } catch (err) {
    sendError(res, err);
  }
});

// ─── DELETE /api/files ──────────────────────────────────────────────────────

router.delete('/files', async (req, res) => {
  const { sessionId, path: filePath, isDirectory } = req.body;

  if (!sessionId || !filePath) {
    return res.status(400).json({ success: false, error: 'sessionId and path are required' });
  }

  console.log(`[API] Delete → ${filePath} (isDirectory=${isDirectory})`);

  try {
    const sessionObj = getSession(sessionId);
    const { conn, mode } = sessionObj;
    
    if (mode === 'sudo') {
      const rmCmd = (isDirectory === true || isDirectory === 'true') ? 'rm -rf' : 'rm -f';
      await execSudo(sessionObj, `${rmCmd} ${escapePath(filePath)}`);
    } else {
      await deleteFile(conn, filePath, isDirectory === true || isDirectory === 'true');
    }
    
    logAudit(sessionObj, 'Deleted', filePath);
    res.json({ success: true, message: `Deleted ${path.basename(filePath)}` });
  } catch (err) {
    sendError(res, err);
  }
});

// ─── POST /api/files/rename ─────────────────────────────────────────────────

router.post('/files/rename', async (req, res) => {
  const { sessionId, oldPath, newPath } = req.body;

  if (!sessionId || !oldPath || !newPath) {
    return res.status(400).json({ success: false, error: 'sessionId, oldPath, and newPath are required' });
  }

  console.log(`[API] Rename → '${oldPath}' to '${newPath}'`);

  try {
    const sessionObj = getSession(sessionId);
    const { conn, mode } = sessionObj;
    
    if (mode === 'sudo') {
      await execSudo(sessionObj, `mv ${escapePath(oldPath)} ${escapePath(newPath)}`);
    } else {
      await renameFile(conn, oldPath, newPath);
    }
    
    logAudit(sessionObj, 'Renamed', `${path.basename(oldPath)} → ${path.basename(newPath)}`);
    res.json({ success: true, message: `Renamed to ${path.basename(newPath)}` });
  } catch (err) {
    sendError(res, err);
  }
});

// ─── POST /api/files/mkdir ──────────────────────────────────────────────────

router.post('/files/mkdir', async (req, res) => {
  const { sessionId, path: dirPath } = req.body;

  if (!sessionId || !dirPath) {
    return res.status(400).json({ success: false, error: 'sessionId and path are required' });
  }

  console.log(`[API] mkdir → '${dirPath}'`);

  try {
    const sessionObj = getSession(sessionId);
    const { conn, mode } = sessionObj;
    
    if (mode === 'sudo') {
      await execSudo(sessionObj, `mkdir -p ${escapePath(dirPath)}`);
    } else {
      await createDirectory(conn, dirPath);
    }
    
    logAudit(sessionObj, 'Created', dirPath);
    res.json({ success: true, message: `Created directory ${path.basename(dirPath)}` });
  } catch (err) {
    sendError(res, err);
  }
});

// ─── GET /api/disk ──────────────────────────────────────────────────────────

router.get('/disk', async (req, res) => {
  const { sessionId, path: p = '/' } = req.query;
  if (!sessionId) return res.status(400).json({ success: false, error: 'sessionId required' });
  try {
    const sessionObj = getSession(sessionId);
    const { conn, mode } = sessionObj;
    // df -Pk is POSIX, works on Linux/macOS/BSD
    let out;
    if (mode === 'sudo') {
      out = await execSudo(sessionObj, `df -Pk ${escapePath(p)} 2>/dev/null | tail -1`);
    } else {
      out = await execCommand(conn, `df -Pk ${escapePath(p)} 2>/dev/null | tail -1`);
    }
    const parts = out.trim().split(/\s+/);
    // parts: filesystem, 1K-blocks, used, available, use%, mounted
    const total = parseInt(parts[1], 10) * 1024;
    const used  = parseInt(parts[2], 10) * 1024;
    const free  = parseInt(parts[3], 10) * 1024;
    const pct   = Math.round((used / total) * 100);
    res.json({ success: true, total, used, free, pct });
  } catch (err) { sendError(res, err); }
});

// ─── GET /api/files/du ──────────────────────────────────────────────────────

router.get('/files/du', async (req, res) => {
  const { sessionId, path: p } = req.query;
  if (!sessionId || !p) return res.status(400).json({ success: false, error: 'sessionId and path required' });
  try {
    const sessionObj = getSession(sessionId);
    const { conn, mode } = sessionObj;
    // du -sk: kilobytes, summarize
    let out;
    if (mode === 'sudo') {
      out = await execSudo(sessionObj, `du -sk ${escapePath(p)} 2>/dev/null | cut -f1`);
    } else {
      out = await execCommand(conn, `du -sk ${escapePath(p)} 2>/dev/null | cut -f1`);
    }
    const bytes = parseInt(out.trim(), 10) * 1024;
    res.json({ success: true, bytes, path: p });
  } catch (err) { sendError(res, err); }
});

// ─── GET /api/files/search ──────────────────────────────────────────────────

router.get('/files/search', async (req, res) => {
  const { sessionId, dir = '/', q = '' } = req.query;
  if (!sessionId || !q) return res.status(400).json({ success: false, error: 'sessionId and q required' });
  try {
    const sessionObj = getSession(sessionId);
    const { conn, mode } = sessionObj;
    const safe = q.replace(/['"\\]/g, '');
    let out;
    if (mode === 'sudo') {
      out = await execSudo(sessionObj, `find ${escapePath(dir)} -maxdepth 3 -name "*${safe}*" 2>/dev/null | head -100`);
    } else {
      out = await execCommand(conn, `find ${escapePath(dir)} -maxdepth 3 -name "*${safe}*" 2>/dev/null | head -100`);
    }
    const results = out ? out.split('\n').filter(Boolean) : [];
    res.json({ success: true, results });
  } catch (err) { sendError(res, err); }
});

// ─── POST /api/files/copy ───────────────────────────────────────────────────

router.post('/files/copy', async (req, res) => {
  const { sessionId, srcPath, dstPath } = req.body;
  if (!sessionId || !srcPath || !dstPath) return res.status(400).json({ success: false, error: 'sessionId, srcPath, dstPath required' });
  try {
    const sessionObj = getSession(sessionId);
    const { conn, mode } = sessionObj;
    if (mode === 'sudo') {
      await execSudo(sessionObj, `cp -r ${escapePath(srcPath)} ${escapePath(dstPath)}`);
    } else {
      await execCommand(conn, `cp -r ${escapePath(srcPath)} ${escapePath(dstPath)}`);
    }
    logAudit(sessionObj, 'Copied', `${path.basename(srcPath)} → ${path.basename(dstPath)}`);
    res.json({ success: true, message: `Copied to ${dstPath}` });
  } catch (err) { sendError(res, err); }
});

// ─── POST /api/files/move ───────────────────────────────────────────────────

router.post('/files/move', async (req, res) => {
  const { sessionId, srcPath, dstPath } = req.body;
  if (!sessionId || !srcPath || !dstPath) return res.status(400).json({ success: false, error: 'sessionId, srcPath, dstPath required' });
  try {
    const sessionObj = getSession(sessionId);
    const { conn, mode } = sessionObj;
    
    if (mode === 'sudo') {
      await execSudo(sessionObj, `mv ${escapePath(srcPath)} ${escapePath(dstPath)}`);
    } else {
      await renameFile(conn, srcPath, dstPath);
    }
    logAudit(sessionObj, 'Moved', `${path.basename(srcPath)} → ${path.basename(dstPath)}`);
    res.json({ success: true, message: `Moved to ${dstPath}` });
  } catch (err) { sendError(res, err); }
});

// ─── GET /api/disk/analyze ──────────────────────────────────────────────────

router.get('/disk/analyze', async (req, res) => {
  const { sessionId, path: dirPath = '/' } = req.query;
  if (!sessionId) return res.status(400).json({ success: false, error: 'sessionId required' });

  try {
    const sessionObj = getSession(sessionId);
    const { mode } = sessionObj;
    
    console.log(`[API] Analyze disk at ${dirPath}...`);

    const findChildrenCmd = `find ${escapePath(dirPath)} -maxdepth 1 -mindepth 1 -exec du -sk {} + 2>/dev/null | sort -nr | head -n 50`;
    const findFilesCmd = `find ${escapePath(dirPath)} -type f -exec du -sk {} + 2>/dev/null | sort -nr | head -n 50`;

    const childrenOut = mode === 'sudo' 
      ? await execSudo(sessionObj, findChildrenCmd)
      : await execCommand(sessionObj.conn, findChildrenCmd);
      
    const filesOut = mode === 'sudo'
      ? await execSudo(sessionObj, findFilesCmd)
      : await execCommand(sessionObj.conn, findFilesCmd);

    const parseDu = (out) => {
      if (!out || typeof out !== 'string') return [];
      return out.split('\n').filter(Boolean).map(line => {
        // Use regex match to prevent aggressive spacing-collapse caused by split('/\s+/')
        const match = line.trim().match(/^(\d+)\s+(.+)$/);
        if (!match) return null;
        const sizeKb = parseInt(match[1], 10);
        const p = match[2];
        const name = p.split('/').pop() || p;
        return { sizeKb, path: p, name };
      }).filter(Boolean);
    };

    res.json({
      success: true,
      children: parseDu(childrenOut),
      largestFiles: parseDu(filesOut)
    });
  } catch (err) { sendError(res, err); }
});

// ─── GET /api/disk/mounts ───────────────────────────────────────────────────

router.get('/disk/mounts', async (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ success: false, error: 'sessionId required' });

  try {
    const sessionObj = getSession(sessionId);
    const { conn, mode } = sessionObj;
    
    let out;
    if (mode === 'sudo') {
      out = await execSudo(sessionObj, `df -Pk 2>/dev/null`);
    } else {
      out = await execCommand(conn, `df -Pk 2>/dev/null`);
    }
    
    const lines = out.split('\n').filter(Boolean).slice(1);
    const mounts = lines.map(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 6) return null;
      const fs = parts[0];
      const total = parseInt(parts[1], 10) * 1024;
      const used = parseInt(parts[2], 10) * 1024;
      const free = parseInt(parts[3], 10) * 1024;
      const pct = parseInt(parts[4].replace('%', ''), 10);
      const mountedOn = parts.slice(5).join(' ');
      
      // Keep only physical/relevant drives
      if (fs.startsWith('tmpfs') || fs.startsWith('udev') || fs.startsWith('devtmpfs') || fs === 'shm' || fs.startsWith('cgroup')) {
        return null;
      }
      
      return { fs, mountedOn, total, used, free, pct };
    }).filter(Boolean);

    res.json({ success: true, mounts });
  } catch (err) {
    sendError(res, err);
  }
});

// ─── GET /api/session/logs ──────────────────────────────────────────────────

router.get('/session/logs', async (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ success: false, error: 'sessionId required' });
  try {
    const sessionObj = getSession(sessionId);
    res.json({ success: true, logs: sessionObj.auditLog || [] });
  } catch (err) {
    sendError(res, err);
  }
});

// ─── GET /api/sessions ──────────────────────────────────────────────────────

router.get('/sessions', (req, res) => {
  res.json({
    success: true,
    activeSessions: sessions.size,
  });
});

module.exports = router;
