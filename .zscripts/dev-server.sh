#!/bin/bash
# Detached Next.js dev server launcher — run via start-stop-daemon so it
# survives tool-call session cleanup in this sandbox.
cd /home/z/my-project
export DATABASE_URL="file:/home/z/my-project/db/custom.db"
export PATH="/home/z/.bun/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
export NODE_ENV=development
exec /home/z/my-project/node_modules/.bin/next dev -p 3000
