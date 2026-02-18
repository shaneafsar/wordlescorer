#!/bin/bash
# Commit all changes, push to origin, and update Replit via SSH.
# Usage: ./scripts/deploy.sh "commit message"

set -e

if [ -z "$REPLIT_SSH_HOST" ]; then
  echo "Error: REPLIT_SSH_HOST env var not set (e.g. user@host)"
  exit 1
fi

REPLIT_SSH="ssh -i ~/.ssh/replit -p 22 $REPLIT_SSH_HOST"
REPLIT_DIR="/home/runner/workspace"

MSG="$1"
if [ -z "$MSG" ]; then
  echo "Usage: ./scripts/deploy.sh \"commit message\""
  exit 1
fi

echo "==> Staging all changes..."
git add -A

echo "==> Committing..."
git commit -m "$MSG

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

echo "==> Pushing to origin..."
git push

echo "==> Updating Replit..."
$REPLIT_SSH "cd $REPLIT_DIR && git pull --ff-only"

echo "==> Done!"
