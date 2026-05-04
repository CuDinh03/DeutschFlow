#!/bin/bash

# Script to test all AI endpoints

BASE_URL="http://localhost:8080"
AI_SERVER_URL="http://localhost:8000"

echo "🧪 Testing DeutschFlow AI Integration"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local url=$3
    local data=$4
    
    echo -e "${YELLOW}Testing: $name${NC}"
    echo "URL: $method $url"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$url")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓ Success (HTTP $http_code)${NC}"
        echo "Response: ${body:0:200}..."
    else
        echo -e "${RED}✗ Failed (HTTP $http_code)${NC}"
        echo "Response: $body"
    fi
    echo ""
}

# Check if AI server is running
echo "Checking AI Server..."
if curl -s "$AI_SERVER_URL/health" > /dev/null; then
    echo -e "${GREEN}✓ AI Server is running${NC}"
else
    echo -e "${RED}✗ AI Server is not running${NC}"
    echo "Please start AI server first: ./scripts/start-ai-server.sh"
    exit 1
fi
echo ""

# Check if Backend is running
echo "Checking Backend..."
if curl -s "$BASE_URL/actuator/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${RED}✗ Backend is not running${NC}"
    echo "Please start backend first: cd backend && ./mvnw spring-boot:run"
    exit 1
fi
echo ""

echo "======================================"
echo "Testing AI Endpoints"
echo "======================================"
echo ""

# Test AI Health
test_endpoint "AI Health Check" "GET" "$BASE_URL/api/ai/health"

# Test Translation
test_endpoint "Translate to English" "POST" "$BASE_URL/api/ai/translate/to-english" \
    '{"text": "Guten Morgen! Wie geht es dir?"}'

test_endpoint "Translate to German" "POST" "$BASE_URL/api/ai/translate/to-german" \
    '{"text": "Good morning! How are you?"}'

# Test Grammar
test_endpoint "Correct Grammar" "POST" "$BASE_URL/api/grammar/ai/correct" \
    '{"text": "Ich bin gehen zur Schule"}'

test_endpoint "Explain Grammar" "POST" "$BASE_URL/api/grammar/ai/explain" \
    '{"text": "Ich gehe zur Schule"}'

test_endpoint "Analyze Grammar" "POST" "$BASE_URL/api/grammar/ai/analyze" \
    '{"text": "Der Mann gibt dem Kind ein Buch"}'

# Test Vocabulary
test_endpoint "Generate Examples" "POST" "$BASE_URL/api/vocabulary/ai/examples" \
    '{"word": "Schadenfreude", "count": 3}'

test_endpoint "Explain Usage" "POST" "$BASE_URL/api/vocabulary/ai/usage" \
    '{"word": "doch"}'

test_endpoint "Generate Mnemonic" "POST" "$BASE_URL/api/vocabulary/ai/mnemonic" \
    '{"word": "Eichhörnchen", "meaning": "squirrel"}'

test_endpoint "Find Similar Words" "POST" "$BASE_URL/api/vocabulary/ai/similar" \
    '{"word": "schnell"}'

test_endpoint "Generate Story" "POST" "$BASE_URL/api/vocabulary/ai/story" \
    '{"words": ["Hund", "Park", "spielen"]}'

# Test Speaking
test_endpoint "Conversation Response" "POST" "$BASE_URL/api/speaking/ai/conversation" \
    '{"message": "Hallo! Wie geht es dir?", "level": "A2", "context": "greeting"}'

test_endpoint "Speaking Feedback" "POST" "$BASE_URL/api/speaking/ai/feedback" \
    '{"text": "Ich bin gestern zum Kino gegangen", "topic": "past activities"}'

test_endpoint "Generate Scenario" "POST" "$BASE_URL/api/speaking/ai/scenario" \
    '{"topic": "Im Restaurant", "level": "A2"}'

test_endpoint "Error Practice" "POST" "$BASE_URL/api/speaking/ai/error-practice" \
    '{"errorType": "verb conjugation", "exerciseCount": 3}'

test_endpoint "Cultural Context" "POST" "$BASE_URL/api/speaking/ai/cultural-context" \
    '{"topic": "greetings"}'

echo "======================================"
echo "Test Summary"
echo "======================================"
echo ""
echo "All tests completed!"
echo "Check the output above for any failures."
echo ""
echo "To run individual tests, use curl commands like:"
echo "curl -X POST $BASE_URL/api/ai/translate/to-english \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"text\": \"Guten Morgen\"}'"
