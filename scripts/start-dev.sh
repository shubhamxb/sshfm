#!/usr/bin/env bash
# SSHFM Development Environment

echo "======================================="
echo "🚀 Starting SSHFM Development Environment"
echo "======================================="

# Ensure npm is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed. Please install Node.js and npm first."
    exit 1
fi

npm install --no-audit --no-fund
npm run install:all
npm run dev
