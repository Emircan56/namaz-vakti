#!/bin/bash
while true; do
  cd /home/z/my-project
  node .next/standalone/server.js 2>&1
  echo "Server crashed, restarting in 3 seconds..."
  sleep 3
done
