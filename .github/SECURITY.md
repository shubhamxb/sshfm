# Security Policy

## Responsible Disclosure

If you find a vulnerability, please email the maintainers privately rather than opening a public issue.
We'll respond within 72 hours.

## Security Best Practices

### Never commit credentials

`backend/.env` is in `.gitignore`. Keep it that way. Use `.env.example` as a template.
**Never hardcode passwords or private keys in source code.**

### Prefer SSH Key Authentication

Instead of passwords, use private key authentication:
1. Generate a key pair: `ssh-keygen -t ed25519 -C "sshfm"`
2. Add the public key to your server's `~/.ssh/authorized_keys`
3. Paste the private key into the SSHFM login form

### Network Security

- Run SSHFM behind a reverse proxy (nginx, Caddy) with HTTPS in production
- **Do not expose port 6969 directly to the internet** — use a VPN or SSH tunnel
- Consider IP allowlisting at the firewall level

### Input Validation

All shell commands use single-quote escaping (`escapePath`) before being passed to the remote shell.
File paths from SFTP use the `ssh2` library directly, which handles path safety internally.

### Session Management

- Sessions are stored in-memory on the backend (Map)
- Restarting the server clears all sessions
- Sessions are automatically cleaned up when the SSH connection drops
- There is no automatic session expiry — implement one before exposing publicly

### Audit Logging

SSHFM maintains an in-memory audit log per session (last 20 actions) viewable in the Activity Tracker HUD.
Logged actions include: file uploads, deletes, renames, moves, copies, and sudo mode switches.

### Docker Hardening

```bash
# Run as non-root (already in Dockerfile)
docker run --user node -p 6969:6969 sshfm

# Additional hardening options
docker run --read-only --tmpfs /tmp -p 6969:6969 sshfm
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SERVER_PORT` | `6969` | Port the server binds to |
| `NODE_ENV` | `development` | `production` disables verbose error messages |

> SSH connection fields (`SSH_HOST`, `SSH_USER`, etc.) are **not** used for auto-connect — they're just potential form pre-fill hints and should never contain real passwords.

## Known Limitations

- No CSRF protection (acceptable for single-user local deployments)
- No rate limiting on `/api/connect` — add this before exposing publicly
- Sessions stored in-memory only — cleared on server restart
- No TLS between browser and SSHFM server (use a reverse proxy for HTTPS)
