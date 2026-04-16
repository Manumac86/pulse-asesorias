#!/bin/sh
set -e

echo "Running Prisma migrations..."
pnpm exec prisma migrate deploy

echo "Running seed..."
pnpm exec tsx prisma/seed.ts || echo "Seed skipped or already applied"

echo "Starting backend server..."
node dist/index.js
