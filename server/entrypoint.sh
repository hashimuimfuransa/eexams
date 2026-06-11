#!/bin/sh

# Run database migrations if they exist
if [ -f "/app/server/migrations/fix-email-sparse-index.js" ]; then
  echo "Running database migration: fix-email-sparse-index.js"
  node /app/server/migrations/fix-email-sparse-index.js
  if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully"
  else
    echo "⚠️ Migration failed, but continuing with server start..."
  fi
fi

# Start the server
echo "Starting server..."
exec node server.js
