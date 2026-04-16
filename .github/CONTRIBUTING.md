# Contributing to SSHFM

Thanks for considering contributing! This is an open source project and PRs are very welcome.

## Getting Started

1. Fork the repo
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/sshfm.git`
3. Read [DEVELOPMENT.md](./DEVELOPMENT.md) to get the local setup running
4. Create a branch: `git checkout -b feature/my-cool-feature`
5. Make your changes
6. Commit with a clear message: `git commit -m "feat: add bulk delete support"`
7. Push and open a PR

## Ideas for Contributions

**Already shipped in v1.0:**
- [x] Multi-file selection & bulk operations
- [x] Bookmarks / favorites for directories
- [x] File search / filtering
- [x] Dark/light theme toggle (4 themes)
- [x] Audit / activity log

**Good first issues:**
- [ ] File preview (text, images, markdown)
- [ ] SSH key file picker (upload instead of paste)
- [ ] File permissions editor (`chmod`)
- [ ] Terminal emulator tab (SSH shell in browser)
- [ ] Session expiry / timeout
- [ ] Session persistence (Redis backend)
- [ ] Rate limiting on `/api/connect`
- [ ] Mobile responsive improvements

## Code Style

- **Backend**: Node.js CommonJS, no linter — keep it clean and readable
- **Frontend**: Vue 3 `<script setup>` composition API, no class-based components
- **CSS**: scoped styles in Vue components + global design tokens in `src/styles/main.css`
- **Commits**: follow [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `chore:`, etc.

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License.
