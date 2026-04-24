#!/bin/bash

API_URL="http://localhost:4000/api"

# Login as admin (adjust credentials as needed)
echo "=== Logging in ==="
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@trilink.edu.et","password":"Admin@123"}')

echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken' 2>/dev/null)

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "Failed to get token. Try different credentials."
  exit 1
fi

echo -e "\n=== Fetching textbooks ==="
curl -s -w "\nHTTP_CODE: %{http_code}\n" "$API_URL/textbooks" \
  -H "Authorization: Bearer $TOKEN" | tee /tmp/textbooks-response.txt

echo -e "\n\n=== Fetching single textbook (if any exist) ==="
TEXTBOOK_ID=$(cat /tmp/textbooks-response.txt | jq -r '.[0].id' 2>/dev/null)
if [ "$TEXTBOOK_ID" != "null" ] && [ -n "$TEXTBOOK_ID" ]; then
  curl -s -w "\nHTTP_CODE: %{http_code}\n" "$API_URL/textbooks/$TEXTBOOK_ID" \
    -H "Authorization: Bearer $TOKEN"
else
  echo "No textbooks found to test single fetch"
fi
