#!/bin/bash

# AI Endpoints Test Script
# Tests all 8 AI/ML endpoints for student module

API_URL="http://localhost:4000/api"

echo "=== AI Endpoints Test ==="
echo ""

# Login
echo "1. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@trilink.edu","password":"Admin@123","role":"admin"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')
USER_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.user.id')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  echo "$LOGIN_RESPONSE" | jq '.'
  exit 1
fi

echo "✅ Logged in as $USER_ID"
echo ""

# Test 1: Health Check
echo "2. Testing AI Health..."
HEALTH=$(curl -s "$API_URL/ai/health" -H "Authorization: Bearer $TOKEN")
echo "$HEALTH" | jq '.'
echo ""

# Test 2: AI Chat
echo "3. Testing AI Chat..."
CHAT_RESPONSE=$(curl -s -X POST "$API_URL/ai/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"student_id\":\"$USER_ID\",\"message\":\"What is algebra?\",\"grade_level\":9}")

if echo "$CHAT_RESPONSE" | jq -e '.answer' > /dev/null 2>&1; then
  echo "✅ Chat works"
  echo "$CHAT_RESPONSE" | jq '.answer'
else
  echo "❌ Chat failed"
  echo "$CHAT_RESPONSE" | jq '.'
fi
echo ""

# Test 3: Chat History
echo "4. Testing Chat History..."
HISTORY=$(curl -s "$API_URL/ai/chat/history/$USER_ID?limit=5" \
  -H "Authorization: Bearer $TOKEN")

if echo "$HISTORY" | jq -e '.messages' > /dev/null 2>&1; then
  echo "✅ Chat history works"
  echo "$HISTORY" | jq '.messages | length'
else
  echo "❌ Chat history failed"
  echo "$HISTORY" | jq '.'
fi
echo ""

# Test 4: Recommendations
echo "5. Testing Recommendations..."
RECOMMENDATIONS=$(curl -s "$API_URL/ai/students/$USER_ID/recommendations?limit=3" \
  -H "Authorization: Bearer $TOKEN")

if echo "$RECOMMENDATIONS" | jq -e '.resources' > /dev/null 2>&1; then
  echo "✅ Recommendations work"
  echo "$RECOMMENDATIONS" | jq '.resources | length'
else
  echo "❌ Recommendations failed"
  echo "$RECOMMENDATIONS" | jq '.'
fi
echo ""

# Test 5: Learning Path
echo "6. Testing Learning Path..."
LEARNING_PATH=$(curl -s "$API_URL/ai/students/$USER_ID/learning-path" \
  -H "Authorization: Bearer $TOKEN")

if echo "$LEARNING_PATH" | jq -e '.topics' > /dev/null 2>&1; then
  echo "✅ Learning path works"
  echo "$LEARNING_PATH" | jq '.topics | length'
else
  echo "❌ Learning path failed"
  echo "$LEARNING_PATH" | jq '.'
fi
echo ""

# Test 6: Self Evaluation
echo "7. Testing Self Evaluation..."
EVALUATE=$(curl -s "$API_URL/ai/students/$USER_ID/evaluate" \
  -H "Authorization: Bearer $TOKEN")

if echo "$EVALUATE" | jq -e '.attendance' > /dev/null 2>&1; then
  echo "✅ Evaluation works"
  echo "$EVALUATE" | jq 'keys'
else
  echo "❌ Evaluation failed"
  echo "$EVALUATE" | jq '.'
fi
echo ""

# Test 7: Weekly Summary
echo "8. Testing Weekly Summary..."
SUMMARY=$(curl -s "$API_URL/ai/analytics/student/$USER_ID/weekly-summary" \
  -H "Authorization: Bearer $TOKEN")

if echo "$SUMMARY" | jq -e '.summary' > /dev/null 2>&1; then
  echo "✅ Weekly summary works"
  echo "$SUMMARY" | jq '.summary'
else
  echo "❌ Weekly summary failed"
  echo "$SUMMARY" | jq '.'
fi
echo ""

echo "=== Test Complete ==="
