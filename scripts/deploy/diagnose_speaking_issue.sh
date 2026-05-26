#!/bin/bash

##############################################################################
# AI Speaking Session Creation - Automated Diagnostic Script
# Usage: ./diagnose_speaking_issue.sh <API_URL> <USER_TOKEN> [USER_ID]
# Example: ./diagnose_speaking_issue.sh http://localhost:8080 "eyJ..." 42
##############################################################################

set -e

API_URL="${1:-http://localhost:8080}"
TOKEN="${2}"
USER_ID="${3}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}AI Speaking Module - Production Diagnostic (2026-05-23)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Validation
if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ ERROR: Token not provided${NC}"
    echo "Usage: $0 <API_URL> <TOKEN> [USER_ID]"
    exit 1
fi

##############################################################################
# TEST 1: API Connectivity
##############################################################################
echo -e "${YELLOW}[Test 1] Checking API Connectivity...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/auth/me" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)

if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}✓ API is responding${NC}"

    # Extract user ID if not provided
    if [ -z "$USER_ID" ]; then
        USER_ID=$(curl -s "$API_URL/api/auth/me" \
            -H "Authorization: Bearer $TOKEN" 2>/dev/null | jq -r '.id' 2>/dev/null || echo "")
        if [ -z "$USER_ID" ] || [ "$USER_ID" == "null" ]; then
            echo -e "${RED}❌ Could not extract user ID from token${NC}"
            exit 1
        fi
    fi

    USER_EMAIL=$(curl -s "$API_URL/api/auth/me" \
        -H "Authorization: Bearer $TOKEN" 2>/dev/null | jq -r '.email' 2>/dev/null || echo "unknown")

    echo -e "${GREEN}✓ User ID: $USER_ID (Email: $USER_EMAIL)${NC}"
else
    echo -e "${RED}✗ API returned HTTP $HTTP_CODE${NC}"
    if [ "$HTTP_CODE" == "401" ]; then
        echo -e "${RED}  → Token is invalid or expired${NC}"
    elif [ "$HTTP_CODE" == "000" ]; then
        echo -e "${RED}  → Cannot connect to API (check URL: $API_URL)${NC}"
    fi
    exit 1
fi

echo ""

##############################################################################
# TEST 2: Database Check (requires psql access)
##############################################################################
echo -e "${YELLOW}[Test 2] Checking Database (requires psql access)...${NC}"

# Try to connect to database
PSQL_AVAILABLE=$(command -v psql >/dev/null 2>&1 && echo "yes" || echo "no")

if [ "$PSQL_AVAILABLE" == "yes" ]; then
    # Try to connect
    DB_CONNECT=$(psql -U postgres -d deutschflow -c "SELECT 1;" 2>&1 | grep -q "1" && echo "yes" || echo "no")

    if [ "$DB_CONNECT" == "yes" ]; then
        # Check user profile
        PROFILE_COUNT=$(psql -U postgres -d deutschflow -t -c \
            "SELECT COUNT(*) FROM user_learning_profiles WHERE user_id = $USER_ID;" 2>/dev/null || echo "0")

        if [ "$PROFILE_COUNT" -gt 0 ]; then
            echo -e "${GREEN}✓ User has learning profile${NC}"

            # Get profile details
            PROFILE_LEVEL=$(psql -U postgres -d deutschflow -t -c \
                "SELECT current_level FROM user_learning_profiles WHERE user_id = $USER_ID;" 2>/dev/null || echo "?")
            echo -e "${GREEN}  → Level: $PROFILE_LEVEL${NC}"
        else
            echo -e "${RED}✗ User has NO learning profile (ROOT CAUSE #1)${NC}"
            echo -e "${YELLOW}  → FIX: Create profile with:${NC}"
            echo -e "${YELLOW}  INSERT INTO user_learning_profiles (user_id, current_level, target_level, practice_band)${NC}"
            echo -e "${YELLOW}  VALUES ($USER_ID, 'A1', 'C1', 'A1');${NC}"
        fi

        # Check active sessions
        ACTIVE_COUNT=$(psql -U postgres -d deutschflow -t -c \
            "SELECT COUNT(*) FROM ai_speaking_sessions WHERE user_id = $USER_ID AND status = 'ACTIVE';" 2>/dev/null || echo "0")
        echo -e "${GREEN}✓ Active sessions: $ACTIVE_COUNT${NC}"

        # Check last session time
        LAST_SESSION=$(psql -U postgres -d deutschflow -t -c \
            "SELECT EXTRACT(EPOCH FROM (NOW() - started_at)) FROM ai_speaking_sessions WHERE user_id = $USER_ID ORDER BY started_at DESC LIMIT 1;" 2>/dev/null || echo "never")

        if [ "$LAST_SESSION" != "never" ]; then
            LAST_SESSION_INT=${LAST_SESSION%.*}
            if [ "$LAST_SESSION_INT" -lt 5 ]; then
                echo -e "${RED}✗ Cooldown active! Last session $LAST_SESSION_INT seconds ago (need to wait $((5 - LAST_SESSION_INT)) more sec)${NC}"
                echo -e "${YELLOW}  → ROOT CAUSE #2: Session creation cooldown${NC}"
            else
                echo -e "${GREEN}✓ Cooldown passed (last session ${LAST_SESSION_INT}s ago)${NC}"
            fi
        fi

        # Check migrations
        MIGRATION_V146=$(psql -U postgres -d deutschflow -t -c \
            "SELECT COUNT(*) FROM flyway_schema_history WHERE version = 'V146';" 2>/dev/null || echo "0")

        if [ "$MIGRATION_V146" -eq 0 ]; then
            echo -e "${RED}✗ Migration V146 not applied (ROOT CAUSE #4)${NC}"
        else
            echo -e "${GREEN}✓ Migrations applied${NC}"
        fi

    else
        echo -e "${YELLOW}⚠ Cannot connect to database (requires credentials)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ psql not available (skipping database checks)${NC}"
fi

echo ""

##############################################################################
# TEST 3: Quota Check
##############################################################################
echo -e "${YELLOW}[Test 3] Checking Token Quota...${NC}"

QUOTA_RESPONSE=$(curl -s "$API_URL/api/ai-speaking/quota" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)

if [ -z "$QUOTA_RESPONSE" ]; then
    echo -e "${RED}✗ Quota endpoint returned no response${NC}"
else
    CAN_SPEAK=$(echo "$QUOTA_RESPONSE" | jq -r '.canSpeak' 2>/dev/null || echo "unknown")
    REMAINING=$(echo "$QUOTA_RESPONSE" | jq -r '.remainingSpendable' 2>/dev/null || echo "unknown")

    if [ "$CAN_SPEAK" == "true" ]; then
        echo -e "${GREEN}✓ User has speaking quota available${NC}"
        echo -e "${GREEN}  → Remaining tokens: $REMAINING${NC}"
    else
        echo -e "${RED}✗ User has EXCEEDED daily quota (ROOT CAUSE #3)${NC}"
        echo -e "${YELLOW}  → Remaining tokens: $REMAINING${NC}"
        echo -e "${YELLOW}  → FIX: Check subscription and reset daily quota${NC}"
    fi
fi

echo ""

##############################################################################
# TEST 4: Attempt Session Creation
##############################################################################
echo -e "${YELLOW}[Test 4] Attempting to Create Session...${NC}"

SESSION_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/ai-speaking/sessions" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "topic": "Prüfung",
        "cefrLevel": "B1",
        "persona": "EMMA",
        "sessionMode": "COMMUNICATION",
        "responseSchema": "V1"
    }' 2>/dev/null)

HTTP_CODE=$(echo "$SESSION_RESPONSE" | tail -n 1)
BODY=$(echo "$SESSION_RESPONSE" | head -n -1)

echo -e "${BLUE}HTTP Status: $HTTP_CODE${NC}"
echo -e "${BLUE}Response: $(echo $BODY | jq -c . 2>/dev/null || echo "$BODY")${NC}"

if [ "$HTTP_CODE" == "200" ]; then
    SESSION_ID=$(echo "$BODY" | jq -r '.id' 2>/dev/null)
    echo -e "${GREEN}✅ Session created successfully! ID: $SESSION_ID${NC}"

    # Try to send a message
    echo ""
    echo -e "${YELLOW}[Test 4.1] Sending test message...${NC}"

    MSG_RESPONSE=$(curl -s -X POST "$API_URL/api/ai-speaking/sessions/$SESSION_ID/chat" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"userText":"Hallo!"}' 2>/dev/null)

    HAS_SPEECH=$(echo "$MSG_RESPONSE" | jq -r '.aiSpeechDe' 2>/dev/null)
    if [ -n "$HAS_SPEECH" ] && [ "$HAS_SPEECH" != "null" ]; then
        echo -e "${GREEN}✅ AI response received (length: ${#HAS_SPEECH})${NC}"
    else
        echo -e "${YELLOW}⚠ No AI speech generated (might be quota issue)${NC}"
    fi

elif [ "$HTTP_CODE" == "409" ]; then
    echo -e "${RED}❌ Session creation blocked (HTTP 409)${NC}"
    ERROR_MSG=$(echo "$BODY" | jq -r '.message' 2>/dev/null)
    if [[ "$ERROR_MSG" == *"chờ"* ]] || [[ "$ERROR_MSG" == *"wait"* ]]; then
        echo -e "${RED}  → ROOT CAUSE #2: Session cooldown active${NC}"
        echo -e "${YELLOW}  → FIX: Wait 5+ seconds before retrying${NC}"
    fi

elif [ "$HTTP_CODE" == "429" ]; then
    echo -e "${RED}❌ Request rate-limited (HTTP 429)${NC}"
    echo -e "${RED}  → ROOT CAUSE #3: Quota system blocking${NC}"
    echo -e "${YELLOW}  → FIX: Check quota with GET /api/ai-speaking/quota${NC}"

elif [ "$HTTP_CODE" == "400" ]; then
    echo -e "${RED}❌ Bad request (HTTP 400)${NC}"
    ERROR=$(echo "$BODY" | jq -r '.message // .error // .errors[0]' 2>/dev/null)
    echo -e "${RED}  → Error: $ERROR${NC}"

elif [ "$HTTP_CODE" == "500" ]; then
    echo -e "${RED}❌ Server error (HTTP 500)${NC}"
    ERROR=$(echo "$BODY" | jq -r '.message' 2>/dev/null)

    if [[ "$ERROR" == *"NullPointer"* ]]; then
        echo -e "${RED}  → ROOT CAUSE #1: Likely missing user profile${NC}"
    elif [[ "$ERROR" == *"interview_state_json"* ]]; then
        echo -e "${RED}  → ROOT CAUSE #4: Missing database migration${NC}"
    else
        echo -e "${RED}  → Error: $ERROR${NC}"
    fi

else
    echo -e "${RED}❌ Unexpected HTTP status: $HTTP_CODE${NC}"
fi

echo ""

##############################################################################
# SUMMARY
##############################################################################
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}DIAGNOSTIC SUMMARY${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}✅ All systems operational - session creation is working${NC}"
else
    echo -e "${RED}⚠ Issues detected - see above for root cause and fixes${NC}"
    echo ""
    echo "Root Cause Checklist:"
    echo "[ ] #1 - User Profile Missing (check Test 2 output)"
    echo "[ ] #2 - Cooldown Active (check Test 2 & 4 output)"
    echo "[ ] #3 - Quota Exceeded (check Test 3 output)"
    echo "[ ] #4 - Migration Missing (check Test 2 output)"
    echo "[ ] #5 - Enum Parsing Issue (check Test 4 output)"
fi

echo ""
echo -e "${BLUE}API Base URL: $API_URL${NC}"
echo -e "${BLUE}User ID: $USER_ID${NC}"
echo ""
