@echo off
title SSHFM Production Server
echo =======================================
echo ⚡ Building SSHFM Frontend for Production
echo =======================================
call npm install --no-audit --no-fund
call npm run install:all
call npm run build --prefix frontend

echo.
echo =======================================
echo 🚀 Starting SSHFM Backend Server
echo =======================================
cd backend
set NODE_ENV=production
set SERVER_PORT=6969
npm start
