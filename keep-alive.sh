#!/bin/bash
while true; do
  cd /home/z/my-project/.next/standalone
  node server.js
  echo "[Watchdog] Server died, restarting in 3s..."
  sleep 3
done
