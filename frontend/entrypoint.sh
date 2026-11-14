#!/bin/sh
set -e

# Start Next.js standalone server in background on port 3000
cd /app && node server.js &

# Wait for Next.js to be ready
sleep 2

# Start nginx in foreground
exec nginx -g 'daemon off;'
