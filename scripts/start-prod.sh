#!/usr/bin/env bash
# SSHFM Production Server

echo "======================================="
echo "📦 Building SSHFM Frontend for Production"
echo "======================================="

# Ensure npm is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed. Please install Node.js and npm first."
    exit 1
fi

npm install --no-audit --no-fund
npm run install:all
npm run build --prefix frontend

echo ""
echo "======================================="
echo "🚀 Starting SSHFM Backend Server"
echo "======================================="

cd backend || exit
export NODE_ENV=production
export SERVER_PORT=6969
npm start
