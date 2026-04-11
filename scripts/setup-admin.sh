#!/bin/bash

# Arena 151 Admin Setup Script
# Creates admin user via Supabase REST API

SUPABASE_URL="https://abzurjxkxxtahdjrpvxk.supabase.co"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFienVyanhreHh0YWhkanJwdnhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE3MTM2MSwiZXhwIjoyMDkwNzQ3MzYxfQ.6X0Qfvu2J58Fs0Md7Hc4v7EW6md96LujQxCuw_qM6ig"
ADMIN_EMAIL="blacklivesmatteretsy@gmail.com"
ADMIN_PASSWORD="0439Fole1!"

echo "🚀 Creating admin account for Arena 151..."
echo ""

# Step 1: Create user via Supabase Admin API
echo "Step 1: Creating user account..."

CREATE_RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${ADMIN_EMAIL}\",
    \"password\": \"${ADMIN_PASSWORD}\",
    \"email_confirm\": true
  }")

echo "Response: $CREATE_RESPONSE"

# Extract user ID from response
USER_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
  echo "⚠️  User might already exist, fetching existing users..."
  
  # Try to get existing user
  USERS_RESPONSE=$(curl -s -X GET \
    "${SUPABASE_URL}/auth/v1/admin/users" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_KEY}")
  
  # This is simplified - you might need to parse JSON properly
  echo "Users response: $USERS_RESPONSE"
  echo ""
  echo "⚠️  Please manually check Supabase dashboard and run this SQL:"
  echo ""
  echo "UPDATE profiles SET is_admin = true WHERE email = '${ADMIN_EMAIL}';"
  echo ""
  exit 1
else
  echo "✅ User created: $USER_ID"
fi

# Step 2: Grant admin privileges
echo ""
echo "Step 2: Granting admin privileges..."

UPDATE_RESPONSE=$(curl -s -X PATCH \
  "${SUPABASE_URL}/rest/v1/profiles?id=eq.${USER_ID}" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"is_admin\": true}")

echo "✅ Admin privileges granted"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Admin Account Details:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Email:    ${ADMIN_EMAIL}"
echo "Password: ${ADMIN_PASSWORD}"
echo "User ID:  ${USER_ID}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎉 SUCCESS! You can now login at:"
echo "   http://localhost:3002/login"
echo ""
