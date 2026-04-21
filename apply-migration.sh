#!/bin/bash

# Apply migration 025 via psql connection string
# Get the connection string from Supabase dashboard: Settings > Database > Connection String

echo "📦 Applying migration 025_fix_matchmaking_phases.sql"
echo ""
echo "Go to: https://supabase.com/dashboard/project/abzurjxkxxtahdjrpvxk/settings/database"
echo "Copy the Connection String (URI format, with password filled in)"
echo ""
read -p "Paste connection string here: " CONN_STRING

if [ -z "$CONN_STRING" ]; then
  echo "❌ No connection string provided"
  exit 1
fi

echo ""
echo "⏳ Running migration..."

psql "$CONN_STRING" -f supabase/migrations/025_fix_matchmaking_phases.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migration applied successfully!"
else
  echo ""
  echo "❌ Migration failed"
  exit 1
fi
