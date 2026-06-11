#!/bin/bash
while true; do
  cd /home/z/my-project
  node .next/standalone/server.js 2>&1
  echo "[daemon] Server exited, restarting in 1s..."
  sleep 1
done
