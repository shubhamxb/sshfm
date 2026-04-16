/**
 * SSHFM Backend Server
 * Lightweight SSH File Manager API — port 6969 because why not
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const config = require('./config');
const sshRoutes = require('./routes/sshRoutes');
const { SSHFMError } = require('./utils/errors');

const app = express();

// ─── Middleware ────────────────────────────────────────────────────────────

// CORS — allow the Vue frontend
app.use(cors({
  origin: [
    'http://localhost:5173',  // Vite dev server
    'http://localhost:6969',  // Prod same-origin
    'http://127.0.0.1:5173',
    'http://127.0.0.1:6969',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Request logging
app.use(morgan(config.server.env === 'development' ? 'dev' : 'combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Serve Frontend Static Files ───────────────────────────────────────────

const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));

// ─── API Routes ────────────────────────────────────────────────────────────

app.use('/api', sshRoutes);

// ─── Health Check ──────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'running',
    message: '🚀 SSHFM is alive and kicking on port 6969',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    env: config.server.env,
  });
});

// ─── SPA Fallback ──────────────────────────────────────────────────────────
// For any non-API route, serve the Vue app
app.get('/{*path}', (req, res) => {
  const indexPath = path.join(frontendDist, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      // Fallback if frontend not built yet (dev mode)
      res.json({ message: 'Frontend not built. Run npm run build in /frontend' });
    }
  });
});

// ─── Error Handling Middleware ─────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);

  if (err instanceof SSHFMError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: `File too large. Max size is ${config.upload.maxFileSizeMB}MB`,
    });
  }

  res.status(500).json({
    success: false,
    error: config.server.env === 'development' ? err.message : 'Internal server error',
  });
});

// ─── Start Server ──────────────────────────────────────────────────────────

app.listen(config.server.port, () => {
  console.log('');
  console.log('  ███████╗███████╗██╗  ██╗███████╗███╗   ███╗');
  console.log('  ██╔════╝██╔════╝██║  ██║██╔════╝████╗ ████║');
  console.log('  ███████╗███████╗███████║█████╗  ██╔████╔██║');
  console.log('  ╚════██║╚════██║██╔══██║██╔══╝  ██║╚██╔╝██║');
  console.log('  ███████║███████║██║  ██║██║     ██║ ╚═╝ ██║');
  console.log('  ╚══════╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝     ╚═╝');
  console.log('');
  console.log(`  SSH File Manager v1.0.0`);
  console.log(`  🚀 Running on http://localhost:${config.server.port}`);
  console.log(`  🌍 Environment: ${config.server.env}`);
  console.log('');
});

module.exports = app;
