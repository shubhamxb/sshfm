/**
 * Custom error classes for SSHFM
 * Because "Error: something went wrong" is for cowards
 */

class SSHFMError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ConnectionError extends SSHFMError {
  constructor(message = 'Failed to establish SSH connection') {
    super(message, 503);
  }
}

class AuthenticationError extends SSHFMError {
  constructor(message = 'SSH authentication failed — check your credentials') {
    super(message, 401);
  }
}

class FileNotFoundError extends SSHFMError {
  constructor(path = '') {
    super(`File not found: ${path}`, 404);
  }
}

class PermissionError extends SSHFMError {
  constructor(path = '') {
    super(`Permission denied: ${path}`, 403);
  }
}

class TimeoutError extends SSHFMError {
  constructor(message = 'SSH connection timed out') {
    super(message, 408);
  }
}

module.exports = {
  SSHFMError,
  ConnectionError,
  AuthenticationError,
  FileNotFoundError,
  PermissionError,
  TimeoutError,
};
