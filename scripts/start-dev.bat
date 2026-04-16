@echo off
title SSHFM Development Servers
echo =======================================
echo ⚡ Starting SSHFM Development Environment
echo =======================================
call npm install --no-audit --no-fund
call npm run install:all
call npm run dev
