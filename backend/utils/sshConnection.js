/**
 * SSH Connection utilities
 * The beating heart of SSHFM — connects, lists, reads, and closes SSH sessions
 */

const { Client } = require('ssh2');
const {
  ConnectionError,
  AuthenticationError,
  FileNotFoundError,
  PermissionError,
  TimeoutError,
} = require('./errors');
const config = require('../config');

/**
 * Creates a new SSH connection
 * @param {string} host
 * @param {number} port
 * @param {string} username
 * @param {string} password
 * @returns {Promise<Client>} connected SSH client
 */
function createConnection({ host, port = 22, username, password, privateKey }) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const timeout = setTimeout(() => {
      conn.end();
      reject(new TimeoutError());
    }, config.ssh.connectionTimeout);

    conn.on('ready', () => {
      clearTimeout(timeout);
      console.log(`[SSH] ✓ Connected to ${host}:${port} as ${username}`);
      resolve(conn);
    });

    conn.on('error', (err) => {
      clearTimeout(timeout);
      console.error(`[SSH] ✗ Connection error: ${err.message}`);
      if (
        err.message.includes('Authentication') ||
        err.message.includes('authentication') ||
        err.level === 'client-authentication'
      ) {
        reject(new AuthenticationError());
      } else {
        reject(new ConnectionError(`${err.message}`));
      }
    });

    const connectConfig = {
      host,
      port: parseInt(port, 10),
      username,
      readyTimeout: config.ssh.connectionTimeout,
    };

    if (privateKey) {
      connectConfig.privateKey = privateKey;
    } else if (password) {
      connectConfig.password = password;
    }

    conn.connect(connectConfig);
  });
}

/**
 * Lists files in a remote directory via SFTP
 * @param {Client} conn - active SSH connection
 * @param {string} dirPath - remote directory path
 * @returns {Promise<Array>} array of file objects
 */
function listFiles(conn, dirPath = '/') {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) {
        console.error(`[SFTP] ✗ Failed to open SFTP session: ${err.message}`);
        return reject(new ConnectionError('Failed to open SFTP session'));
      }

      sftp.readdir(dirPath, (err, list) => {
        if (err) {
          console.error(`[SFTP] ✗ readdir failed on '${dirPath}': ${err.message}`);
          if (err.code === 2) return reject(new FileNotFoundError(dirPath));
          if (err.code === 3) return reject(new PermissionError(dirPath));
          return reject(new ConnectionError(err.message));
        }

        const files = list.map((item) => {
          const isDirectory = (item.attrs.mode & 0o170000) === 0o040000;
          const isSymlink = (item.attrs.mode & 0o170000) === 0o120000;
          return {
            name: item.filename,
            size: item.attrs.size,
            isDirectory,
            isSymlink,
            permissions: item.longname ? item.longname.substring(0, 10) : '----------',
            modified: item.attrs.mtime ? new Date(item.attrs.mtime * 1000).toISOString() : null,
            owner: item.attrs.uid || 0,
            group: item.attrs.gid || 0,
          };
        });

        // Sort: directories first, then files, both alphabetically
        files.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

        console.log(`[SFTP] ✓ Listed ${files.length} items in '${dirPath}'`);
        resolve(files);
      });
    });
  });
}

/**
 * Gets metadata for a single remote file
 * @param {Client} conn
 * @param {string} filePath
 * @returns {Promise<Object>} file stat object
 */
function getFileInfo(conn, filePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(new ConnectionError('Failed to open SFTP session'));

      sftp.stat(filePath, (err, stats) => {
        if (err) {
          if (err.code === 2) return reject(new FileNotFoundError(filePath));
          if (err.code === 3) return reject(new PermissionError(filePath));
          return reject(new ConnectionError(err.message));
        }
        const isDirectory = (stats.mode & 0o170000) === 0o040000;
        resolve({
          path: filePath,
          size: stats.size,
          isDirectory,
          permissions: stats.mode,
          modified: new Date(stats.mtime * 1000).toISOString(),
          accessed: new Date(stats.atime * 1000).toISOString(),
          owner: stats.uid,
          group: stats.gid,
        });
      });
    });
  });
}

/**
 * Deletes a remote file or directory
 * @param {Client} conn
 * @param {string} filePath
 * @param {boolean} isDirectory
 */
function deleteFile(conn, filePath, isDirectory = false) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(new ConnectionError('Failed to open SFTP session'));

      const op = isDirectory
        ? (p, cb) => sftp.rmdir(p, cb)
        : (p, cb) => sftp.unlink(p, cb);

      op(filePath, (err) => {
        if (err) {
          if (err.code === 2) return reject(new FileNotFoundError(filePath));
          if (err.code === 3) return reject(new PermissionError(filePath));
          return reject(new ConnectionError(err.message));
        }
        console.log(`[SFTP] ✓ Deleted '${filePath}'`);
        resolve();
      });
    });
  });
}

/**
 * Renames/moves a remote file
 * @param {Client} conn
 * @param {string} oldPath
 * @param {string} newPath
 */
function renameFile(conn, oldPath, newPath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(new ConnectionError('Failed to open SFTP session'));

      sftp.rename(oldPath, newPath, (err) => {
        if (err) {
          if (err.code === 2) return reject(new FileNotFoundError(oldPath));
          if (err.code === 3) return reject(new PermissionError(oldPath));
          return reject(new ConnectionError(err.message));
        }
        console.log(`[SFTP] ✓ Renamed '${oldPath}' → '${newPath}'`);
        resolve();
      });
    });
  });
}

/**
 * Downloads a remote file as a stream
 * @param {Client} conn
 * @param {string} filePath
 * @returns {Promise<ReadableStream>}
 */
function downloadFile(conn, filePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(new ConnectionError('Failed to open SFTP session'));

      const stream = sftp.createReadStream(filePath);
      stream.on('error', (err) => {
        if (err.code === 2) return reject(new FileNotFoundError(filePath));
        if (err.code === 3) return reject(new PermissionError(filePath));
        reject(new ConnectionError(err.message));
      });
      resolve(stream);
    });
  });
}

/**
 * Uploads a file buffer to a remote path
 * @param {Client} conn
 * @param {Buffer} fileBuffer
 * @param {string} remotePath
 */
function uploadFile(conn, fileBuffer, remotePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(new ConnectionError('Failed to open SFTP session'));

      const writeStream = sftp.createWriteStream(remotePath);
      writeStream.on('error', (err) => {
        if (err.code === 3) return reject(new PermissionError(remotePath));
        reject(new ConnectionError(err.message));
      });
      writeStream.on('close', () => {
        console.log(`[SFTP] ✓ Uploaded to '${remotePath}'`);
        resolve();
      });
      writeStream.end(fileBuffer);
    });
  });
}

/**
 * Creates a new remote directory
 * @param {Client} conn
 * @param {string} dirPath
 */
function createDirectory(conn, dirPath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(new ConnectionError('Failed to open SFTP session'));

      sftp.mkdir(dirPath, (err) => {
        if (err) {
          if (err.code === 3) return reject(new PermissionError(dirPath));
          return reject(new ConnectionError(err.message));
        }
        console.log(`[SFTP] ✓ Created directory '${dirPath}'`);
        resolve();
      });
    });
  });
}

/**
 * Gracefully closes an SSH connection
 * @param {Client} conn
 */
function closeConnection(conn) {
  if (conn) {
    try {
      conn.end();
      console.log('[SSH] Connection closed gracefully');
    } catch (e) {
      console.warn('[SSH] Error while closing connection:', e.message);
    }
  }
}

/**
 * Executes a shell command over SSH and returns stdout as a string.
 * @param {Client} conn
 * @param {string} cmd
 * @returns {Promise<string>}
 */
function execCommand(conn, cmd, stdinStr = null) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(new ConnectionError(`exec failed: ${err.message}`));
      let stdout = '';
      let stderr = '';
      stream.on('data', (d) => { stdout += d.toString(); });
      stream.stderr.on('data', (d) => { stderr += d.toString(); });
      stream.on('close', (code) => {
        if (code !== 0 && !stdout) return reject(new ConnectionError(`Command failed (${code}): ${stderr.trim()}`));
        resolve(stdout.trim());
      });
      if (stdinStr !== null) {
        stream.write(stdinStr + '\n');
        stream.end();
      }
    });
  });
}

module.exports = {
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
};
