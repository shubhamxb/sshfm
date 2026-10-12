/**
 * SSHFM demo API: the same exports as ../api.js, answered by a pretend server that lives in this tab.
 * Built in with `vite build --mode demo` (see vite.config.js). Nothing here opens a socket: no SSH, no HTTP.
 * Every change (upload, rename, delete…) is real for the session and gone on reload.
 */

const HOME = '/home/deploy';
const KB = 1024, MB = KB * 1024, GB = MB * 1024;
const DISK_TOTAL = 80 * GB;
const now = Date.now();
const ago = (days) => new Date(now - days * 86400e3 - Math.random() * 36e5).toISOString();

// ─── the pretend server ────────────────────────────────────────────────────
// a node: { dir, size, modified, permissions, owner, children?, body? }  body: string | Blob

const TEXT = {
  'README.md': '# shop\n\nThe storefront. `docker compose up -d` from this folder.\n',
  'docker-compose.yml': 'services:\n  web:\n    image: shop/web:2.4.1\n    ports: ["8080:8080"]\n  db:\n    image: postgres:16\n    volumes: [pgdata:/var/lib/postgresql/data]\nvolumes:\n  pgdata: {}\n',
  'nginx.conf': 'server {\n  listen 80;\n  server_name shop.example.com;\n  location / { proxy_pass http://127.0.0.1:8080; }\n}\n',
  '.bashrc': '# ~/.bashrc\nexport EDITOR=vim\nalias ll="ls -lah"\n',
  'notes.txt': 'this is the sshfm demo. nothing here is real, and nothing you do leaves your browser.\n',
};

function f(size, days, extra = {}) {
  return { dir: false, size, modified: ago(days), permissions: '-rw-r--r--', owner: 1000, ...extra };
}
function d(children, days = 3, extra = {}) {
  return { dir: true, size: 4096, modified: ago(days), permissions: 'drwxr-xr-x', owner: 1000, children, ...extra };
}
const t = (name, days) => f(TEXT[name].length, days, { body: TEXT[name] });

function seed() {
  const logs = {};
  for (let i = 1; i <= 7; i++) logs[`access.log.${i}.gz`] = f((38 + i * 11) * MB, i, { owner: 0 });
  return d({
    home: d({
      deploy: d({
        '.bashrc': t('.bashrc', 120),
        '.ssh': d({ authorized_keys: f(742, 200, { permissions: '-rw-------' }) }, 200, { permissions: 'drwx------' }),
        'notes.txt': t('notes.txt', 0),
        apps: d({
          shop: d({
            'README.md': t('README.md', 14),
            'docker-compose.yml': t('docker-compose.yml', 6),
            src: d({ 'server.js': f(18 * KB, 2), 'routes.js': f(9 * KB, 2), 'db.js': f(4 * KB, 9) }, 2),
            public: d({ 'logo.svg': f(3 * KB, 40), 'hero.webp': f(412 * KB, 40), 'app.css': f(21 * KB, 5) }, 5),
            node_modules: d({ '.package-lock.json': f(240 * KB, 6) }, 6, { size: 4096, _bulk: 412 * MB }),
          }, 2),
          blog: d({ 'index.html': f(12 * KB, 30), 'feed.xml': f(48 * KB, 30), posts: d({}, 30) }, 30),
        }, 2),
        backups: d({
          'db-2026-10-01.sql.gz': f(1.8 * GB, 11),
          'db-2026-10-08.sql.gz': f(1.9 * GB, 4),
          'uploads-2026-09.tar.zst': f(2.6 * GB, 22),
        }, 4),
        media: d({ 'launch-teaser.mp4': f(684 * MB, 18), 'podcast-ep12.mp3': f(88 * MB, 25), 'cover.png': f(2.1 * MB, 25) }, 18),
      }, 0, { permissions: 'drwxr-x---' }),
    }, 200, { owner: 0 }),
    etc: d({ nginx: d({ 'nginx.conf': t('nginx.conf', 60) }, 60, { owner: 0 }), hostname: f(9, 400, { owner: 0, body: 'demo-box\n' }) }, 60, { owner: 0 }),
    var: d({
      log: d({ nginx: d(logs, 1, { owner: 0 }), 'syslog': f(212 * MB, 0, { owner: 0, permissions: '-rw-r-----' }) }, 0, { owner: 0 }),
      lib: d({
        docker: d({ overlay2: d({}, 1, { owner: 0, _bulk: 11.4 * GB, permissions: 'drwx--x---' }) }, 1, { owner: 0, permissions: 'drwx--x---' }),
        postgresql: d({ '16': d({}, 0, { owner: 113, _bulk: 3.7 * GB, permissions: 'drwx------' }) }, 0, { owner: 113, permissions: 'drwx------' }),
      }, 1, { owner: 0 }),
    }, 1, { owner: 0 }),
    root: d({ '.bash_history': f(14 * KB, 1, { owner: 0, permissions: '-rw-------' }) }, 1, { owner: 0, permissions: 'drwx------' }),
    tmp: d({}, 0, { owner: 0, permissions: 'drwxrwxrwt' }),
  }, 400, { owner: 0 });
}

let root = seed();
let mode = 'normal';
let audit = [];

// ─── helpers ───────────────────────────────────────────────────────────────

const wait = (ms = 90 + Math.random() * 160) => new Promise((r) => setTimeout(r, ms));
function fail(error, status = 400) {
  const e = new Error(error);
  e.response = { status, data: { success: false, error } };
  throw e;
}
function norm(p) {
  if (!p || p === '~') p = HOME;
  else if (p.startsWith('~/')) p = HOME + p.slice(1);
  const out = [];
  for (const part of p.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop(); else out.push(part);
  }
  return '/' + out.join('/');
}
const parts = (p) => norm(p).split('/').filter(Boolean);
const base = (p) => parts(p).pop() || '/';
const parentOf = (p) => '/' + parts(p).slice(0, -1).join('/');
const join = (a, b) => (a === '/' ? '' : a) + '/' + b;

// the demo user is uid 1000; normal mode can't read 0700 dirs owned by someone else. sudo mode can.
const readable = (n) => mode === 'sudo' || n.owner === 1000 || n.permissions[7] === 'r';
const writable = (n) => mode === 'sudo' || n.owner === 1000 || n.permissions[8] === 'w';

function walk(p, { need } = {}) {
  let n = root;
  for (const name of parts(p)) {
    if (!n.dir) fail(`Not a directory: ${p}`, 404);
    if (!readable(n)) fail(`Permission denied: ${p}`, 403);
    n = n.children[name];
    if (!n) fail(`No such file or directory: ${p}`, 404);
  }
  if (need === 'dir' && !n.dir) fail(`Not a directory: ${p}`, 404);
  return n;
}
function parentFor(p) {
  const dir = walk(parentOf(p), { need: 'dir' });
  if (!writable(dir)) fail(`Permission denied: ${parentOf(p)}`, 403);
  return dir;
}
function sizeOf(n) {
  if (!n.dir) return n.size;
  return 4096 + (n._bulk || 0) + Object.values(n.children).reduce((s, c) => s + sizeOf(c), 0);
}
function clone(n) {
  return n.dir ? { ...n, children: Object.fromEntries(Object.entries(n.children).map(([k, v]) => [k, clone(v)])) } : { ...n };
}
function log(action, target) {
  audit.unshift({ id: Date.now() + Math.random(), action, target, timestamp: new Date().toISOString() });
  audit = audit.slice(0, 20);
}
function used() { return sizeOf(root) + 2.3 * GB; } // + the os itself

// ─── Connection ────────────────────────────────────────────────────────────

export async function connectSSH({ host, username }) {
  await wait(650);
  if (!host || !username) fail('host and username are required');
  root = seed(); mode = 'normal'; audit = [];
  log('Connected', `${username}@${host} (demo)`);
  return { success: true, sessionId: `demo-${Date.now()}`, message: `Connected to ${host} as ${username}` };
}
export async function disconnectSSH() { await wait(); return { success: true, message: 'Disconnected' }; }
export async function setSessionMode(_s, m) {
  await wait(300);
  if (!['normal', 'sudo'].includes(m)) fail('Mode must be "normal" or "sudo"');
  mode = m; log('Mode', m);
  return { success: true, mode };
}
export async function getSessionInfo() { await wait(); return { success: true, mode, username: 'deploy', host: 'demo-box' }; }
export async function getSessionLogs() { await wait(); return { success: true, logs: audit }; }

// ─── File Operations ───────────────────────────────────────────────────────

export async function listFiles(_s, path = '/') {
  await wait();
  const p = norm(path);
  const n = walk(p, { need: 'dir' });
  if (!readable(n)) fail(`Permission denied: ${p}`, 403);
  const files = Object.entries(n.children).map(([name, c]) => ({
    name, size: c.dir ? 4096 : c.size, isDirectory: c.dir, isSymlink: false,
    permissions: c.permissions, modified: c.modified, owner: c.owner, group: c.owner,
  }));
  return { success: true, path: p, files };
}
export async function getFileInfo(_s, path) {
  await wait();
  const n = walk(path);
  return { success: true, info: { path: norm(path), size: n.dir ? 4096 : n.size, isDirectory: n.dir, permissions: n.permissions, modified: n.modified, accessed: n.modified, owner: n.owner, group: n.owner } };
}
export async function deleteFile(_s, path) {
  await wait();
  const p = norm(path); walk(p);
  delete parentFor(p).children[base(p)];
  log('Deleted', base(p));
  return { success: true, message: `Deleted ${base(p)}` };
}
export async function renameFile(_s, oldPath, newPath) {
  await wait();
  const from = norm(oldPath), to = norm(newPath);
  const n = walk(from), src = parentFor(from), dst = parentFor(to);
  if (dst.children[base(to)]) fail(`Already exists: ${to}`, 409);
  delete src.children[base(from)];
  dst.children[base(to)] = { ...n, modified: new Date().toISOString() };
  log('Renamed', `${base(from)} → ${base(to)}`);
  return { success: true, message: `Renamed to ${base(to)}` };
}
export async function createDirectory(_s, path) {
  await wait();
  const p = norm(path), dir = parentFor(p);
  if (dir.children[base(p)]) fail(`Already exists: ${p}`, 409);
  dir.children[base(p)] = d({}, 0, { modified: new Date().toISOString(), owner: mode === 'sudo' ? 0 : 1000 });
  log('Created', base(p));
  return { success: true, message: `Created directory ${base(p)}` };
}
export async function uploadFile(_s, path, file, onProgress) {
  const dir = walk(path, { need: 'dir' });
  if (!writable(dir)) fail(`Permission denied: ${norm(path)}`, 403);
  if (used() + file.size > DISK_TOTAL) fail('No space left on device', 507);
  // a believable transfer: ~25 MB/s, at least half a second
  const steps = 10, ms = Math.max(500, (file.size / (25 * MB)) * 1000);
  for (let i = 1; i <= steps; i++) { await wait(ms / steps); onProgress?.(Math.round((i / steps) * 100)); }
  dir.children[file.name] = f(file.size, 0, { modified: new Date().toISOString(), body: file, owner: mode === 'sudo' ? 0 : 1000 });
  log('Uploaded', file.name);
  return { success: true, message: `Uploaded ${file.name}`, path: join(norm(path), file.name) };
}
export function getDownloadUrl(_s, path) {
  const n = walk(path);
  // seeded files without a body download as a short note rather than pretending to be the real thing
  const body = n.body ?? `sshfm demo: ${norm(path)} is a stand-in (${Math.round(n.size / KB)} KB on the pretend server).\n`;
  log('Downloaded', base(path));
  return URL.createObjectURL(body instanceof Blob ? body : new Blob([body], { type: 'text/plain' }));
}
export async function healthCheck() { return { status: 'ok', demo: true }; }

// ─── Disk & Stats ──────────────────────────────────────────────────────────

export async function getDiskUsage() {
  await wait();
  const u = used(), free = DISK_TOTAL - u;
  return { success: true, total: DISK_TOTAL, used: u, free, pct: Math.round((u / DISK_TOTAL) * 100) };
}
export async function analyzeDisk(_s, path) {
  await wait(700); // du takes a moment on a real box too
  const p = norm(path), n = walk(p, { need: 'dir' });
  const kb = (x) => Math.round(x / KB);
  const children = Object.entries(n.children)
    .map(([name, c]) => ({ sizeKb: kb(sizeOf(c)), path: join(p, name), name }))
    .sort((a, b) => b.sizeKb - a.sizeKb).slice(0, 50);
  const files = [];
  (function each(node, at) {
    if (!readable(node)) return;
    for (const [name, c] of Object.entries(node.children)) {
      if (c.dir) each(c, join(at, name)); else files.push({ sizeKb: kb(c.size), path: join(at, name), name });
    }
  })(n, p);
  files.sort((a, b) => b.sizeKb - a.sizeKb);
  return { success: true, children, largestFiles: files.slice(0, 50) };
}
export async function getDiskMounts() {
  await wait();
  const u = used();
  return { success: true, mounts: [
    { fs: '/dev/sda1', mountedOn: '/', total: DISK_TOTAL, used: u, free: DISK_TOTAL - u, pct: Math.round((u / DISK_TOTAL) * 100) },
    { fs: '/dev/sda15', mountedOn: '/boot/efi', total: 105 * MB, used: 6 * MB, free: 99 * MB, pct: 6 },
    { fs: '/dev/sdb1', mountedOn: '/mnt/backups', total: 500 * GB, used: 318 * GB, free: 182 * GB, pct: 64 },
  ] };
}
export async function getFolderSize(_s, path) {
  await wait(400);
  return { success: true, bytes: sizeOf(walk(path)), path };
}
export async function searchFiles(_s, dir, q) {
  await wait(300);
  const start = norm(dir), needle = String(q).toLowerCase(), results = [];
  (function each(node, at, depth) {
    if (depth > 3 || !node.dir || !readable(node)) return;
    for (const [name, c] of Object.entries(node.children)) {
      if (name.toLowerCase().includes(needle)) results.push(join(at, name));
      each(c, join(at, name), depth + 1);
    }
  })(walk(start), start, 1);
  return { success: true, results: results.slice(0, 100) };
}

// ─── Copy / Move ───────────────────────────────────────────────────────────

export async function copyFile(_s, srcPath, dstPath) {
  await wait();
  const n = walk(srcPath), dst = parentFor(dstPath);
  if (used() + sizeOf(n) > DISK_TOTAL) fail('No space left on device', 507);
  dst.children[base(dstPath)] = clone(n);
  log('Copied', `${base(srcPath)} → ${base(dstPath)}`);
  return { success: true, message: `Copied to ${dstPath}` };
}
export async function moveFile(_s, srcPath, dstPath) {
  await renameFile(_s, srcPath, dstPath);
  audit[0].action = 'Moved';
  return { success: true, message: `Moved to ${dstPath}` };
}

export default {};
