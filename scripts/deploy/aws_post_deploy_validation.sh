#!/bin/bash

##############################################################################
# AWS Post-Deployment Validation Script
# Purpose: Comprehensive testing after deploying to AWS
# Usage: ./aws_post_deploy_validation.sh <LOAD_BALANCER_DNS> <TEST_TOKEN> [OUTPUT_FILE]
# Example: ./aws_post_deploy_validation.sh api.deutschflow.com "eyJ..." results.json
##############################################################################

set -e

LB_DNS="${1:-api.deutschflow.com}"
TOKEN="${2}"
OUTPUT_FILE="${3:-/tmp/aws_validation_results.json}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Results tracking
declare -A RESULTS
RESULTS[total]=0
RESULTS[passed]=0
RESULTS[failed]=0

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}AWS Post-Deployment Validation Suite${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ ERROR: Token not provided${NC}"
    echo "Usage: $0 <LOAD_BALANCER_DNS> <TOKEN> [OUTPUT_FILE]"
    exit 1
fi

# Helper function to log results
log_result() {
    local test_name="$1"
    local passed="$2"
    local details="$3"

    RESULTS[total]=$((${RESULTS[total]} + 1))

    if [ "$passed" == "true" ]; then
        RESULTS[passed]=$((${RESULTS[passed]} + 1))
        echo -e "${GREEN}✓ $test_name${NC}"
    else
        RESULTS[failed]=$((${RESULTS[failed]} + 1))
        echo -e "${RED}✗ $test_name${NC}"
        if [ -n "$details" ]; then
            echo -e "${RED}  → $details${NC}"
        fi
    fi
}

##############################################################################
# Test 1: API Connectivity
##############################################################################
echo -e "${YELLOW}[Test 1] API Connectivity${NC}"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://$LB_DNS/actuator/health" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" == "200" ]; then
    log_result "Health endpoint responds" "true"
else
    log_result "Health endpoint responds" "false" "HTTP $HTTP_CODE"
    exit 1
fi

##############################################################################
# Test 2: Database Connectivity
##############################################################################
echo ""
echo -e "${YELLOW}[Test 2] Database Connectivity${NC}"

DB_RESPONSE=$(curl -s "http://$LB_DNS/actuator/health/db" 2>/dev/null)
DB_STATUS=$(echo "$DB_RESPONSE" | jq -r '.status' 2>/dev/null || echo "UNKNOWN")

if [ "$DB_STATUS" == "UP" ]; then
    log_result "Database connection UP" "true"
else
    log_result "Database connection UP" "false" "Status: $DB_STATUS"
fi

##############################################################################
# Test 3: COMMUNICATION Session Creation
##############################################################################
echo ""
echo -e "${YELLOW}[Test 3] COMMUNICATION Session Creation${NC}"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "http://$LB_DNS/api/ai-speaking/sessions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Prüfung",
    "cefrLevel": "B1",
    "persona": "EMMA",
    "sessionMode": "COMMUNICATION",
    "responseSchema": "V1"
  }' 2>/dev/null)

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" == "200" ]; then
    SESSION_ID=$(echo "$BODY" | jq -r '.id' 2>/dev/null)
    STATUS=$(echo "$BODY" | jq -r '.status' 2>/dev/null)
    HAS_GREETING=$(echo "$BODY" | jq -r '.greeting // empty' 2>/dev/null)

    if [ "$STATUS" == "ACTIVE" ] && [ -n "$SESSION_ID" ]; then
        log_result "COMMUNICATION session created" "true"
        COMM_SESSION_ID=$SESSION_ID
    else
        log_result "COMMUNICATION session created" "false" "Status: $STATUS"
    fi
else
    log_result "COMMUNICATION session created" "false" "HTTP $HTTP_CODE"
fi

##############################################################################
# Test 4: Send Message in Session
##############################################################################
echo ""
echo -e "${YELLOW}[Test 4] Send Message in Session${NC}"

if [ -n "$COMM_SESSION_ID" ]; then
    MSG_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "http://$LB_DNS/api/ai-speaking/sessions/$COMM_SESSION_ID/chat" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"userText":"Hallo, wie geht es dir?"}' 2>/dev/null)

    MSG_HTTP=$(echo "$MSG_RESPONSE" | tail -n 1)
    MSG_BODY=$(echo "$MSG_RESPONSE" | head -n -1)

    if [ "$MSG_HTTP" == "200" ]; then
        AI_RESPONSE=$(echo "$MSG_BODY" | jq -r '.aiSpeechDe // empty' 2>/dev/null)
        if [ -n "$AI_RESPONSE" ]; then
            log_result "Send message and receive response" "true"
        else
            log_result "Send message and receive response" "false" "No AI response"
        fi
    else
        log_result "Send message and receive response" "false" "HTTP $MSG_HTTP"
    fi
else
    log_result "Send message and receive response" "false" "No active session"
fi

##############################################################################
# Test 5: INTERVIEW Session Creation
##############################################################################
echo ""
echo -e "${YELLOW}[Test 5] INTERVIEW Session Creation${NC}"

INT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "http://$LB_DNS/api/ai-speaking/sessions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionMode": "INTERVIEW",
    "interviewPosition": "Backend Developer",
    "experienceLevel": "1-2Y",
    "cefrLevel": "B1"
  }' 2>/dev/null)

INT_HTTP=$(echo "$INT_RESPONSE" | tail -n 1)
INT_BODY=$(echo "$INT_RESPONSE" | head -n -1)

if [ "$INT_HTTP" == "200" ]; then
    INT_SESSION_ID=$(echo "$INT_BODY" | jq -r '.id' 2>/dev/null)
    HAS_STATE=$(echo "$INT_BODY" | jq -r '.interviewStateJson // empty' 2>/dev/null)

    if [ -n "$INT_SESSION_ID" ] && [ -n "$HAS_STATE" ]; then
        log_result "INTERVIEW session created with state" "true"
    else
        log_result "INTERVIEW session created with state" "false" "Missing state or ID"
    fi
else
    log_result "INTERVIEW session created with state" "false" "HTTP $INT_HTTP"
fi

##############################################################################
# Test 6: Interview Session Message
##############################################################################
echo ""
echo -e "${YELLOW}[Test 6] Interview Session Message${NC}"

if [ -n "$INT_SESSION_ID" ]; then
    INT_MSG=$(curl -s -w "\n%{http_code}" -X POST "http://$LB_DNS/api/ai-speaking/sessions/$INT_SESSION_ID/chat" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{"userText":"Ich habe 2 Jahre Erfahrung mit Java und Spring Boot..."}' 2>/dev/null)

    INT_MSG_HTTP=$(echo "$INT_MSG" | tail -n 1)
    INT_MSG_BODY=$(echo "$INT_MSG" | head -n -1)

    if [ "$INT_MSG_HTTP" == "200" ]; then
        INT_STATE=$(echo "$INT_MSG_BODY" | jq -r '.interviewStateJson // empty' 2>/dev/null)
        if [ -n "$INT_STATE" ]; then
            log_result "Interview response and state update" "true"
        else
            log_result "Interview response and state update" "false" "No state returned"
        fi
    else
        log_result "Interview response and state update" "false" "HTTP $INT_MSG_HTTP"
    fi
else
    log_result "Interview response and state update" "false" "No interview session"
fi

##############################################################################
# Test 7: Quota System
##############################################################################
echo ""
echo -e "${YELLOW}[Test 7] Quota System${NC}"

QUOTA_RESPONSE=$(curl -s "http://$LB_DNS/api/ai-speaking/quota" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null)

CAN_SPEAK=$(echo "$QUOTA_RESPONSE" | jq -r '.canSpeak' 2>/dev/null)
REMAINING=$(echo "$QUOTA_RESPONSE" | jq -r '.remainingSpendable' 2>/dev/null)

if [ "$CAN_SPEAK" == "true" ] && [ -n "$REMAINING" ]; then
    log_result "Quota system operational" "true"
else
    log_result "Quota system operational" "false" "canSpeak: $CAN_SPEAK"
fi

##############################################################################
# Test 8: Session Listing
##############################################################################
echo ""
echo -e "${YELLOW}[Test 8] Session Listing${NC}"

LIST_RESPONSE=$(curl -s "http://$LB_DNS/api/ai-speaking/sessions?page=0&size=10" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null)

SESSION_COUNT=$(echo "$LIST_RESPONSE" | jq '.content | length' 2>/dev/null || echo "0")

if [ "$SESSION_COUNT" -gt 0 ]; then
    log_result "Session listing works" "true"
else
    log_result "Session listing works" "false" "No sessions returned"
fi

##############################################################################
# Test 9: Error Handling - 401 Unauthorized
##############################################################################
echo ""
echo -e "${YELLOW}[Test 9] Error Handling - Invalid Token${NC}"

BAD_TOKEN_RESPONSE=$(curl -s -w "\n%{http_code}" "http://$LB_DNS/api/ai-speaking/sessions" \
  -H "Authorization: Bearer INVALID_TOKEN_12345" 2>/dev/null)

BAD_HTTP=$(echo "$BAD_TOKEN_RESPONSE" | tail -n 1)

if [ "$BAD_HTTP" == "401" ]; then
    log_result "Invalid token returns 401" "true"
else
    log_result "Invalid token returns 401" "false" "HTTP $BAD_HTTP"
fi

##############################################################################
# Test 10: Performance - Response Time
##############################################################################
echo ""
echo -e "${YELLOW}[Test 10] Performance - Response Time${NC}"

START_TIME=$(date +%s%N)
curl -s "http://$LB_DNS/api/ai-speaking/quota" \
  -H "Authorization: Bearer $TOKEN" > /dev/null 2>&1
END_TIME=$(date +%s%N)

RESPONSE_TIME=$(( ($END_TIME - $START_TIME) / 1000000 ))  # Convert to ms

if [ $RESPONSE_TIME -lt 1000 ]; then
    log_result "Response time < 1 second ($RESPONSE_TIME ms)" "true"
else
    log_result "Response time < 1 second ($RESPONSE_TIME ms)" "false" "Slow response"
fi

##############################################################################
# Summary
##############################################################################
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}VALIDATION SUMMARY${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

PASS_RATE=$((${RESULTS[passed]} * 100 / ${RESULTS[total]}))

echo -e "Total Tests: ${RESULTS[total]}"
echo -e "${GREEN}Passed: ${RESULTS[passed]}${NC}"
echo -e "${RED}Failed: ${RESULTS[failed]}${NC}"
echo -e "Pass Rate: $PASS_RATE%"

if [ ${RESULTS[failed]} -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed! Ready for production.${NC}"
    EXIT_CODE=0
else
    echo -e "${RED}⚠️  Some tests failed. Review issues before going live.${NC}"
    EXIT_CODE=1
fi

echo ""
echo -e "${BLUE}Environment: $LB_DNS${NC}"
echo -e "${BLUE}Timestamp: $(date)${NC}"

# Save results to file if specified
if [ -n "$OUTPUT_FILE" ]; then
    cat > "$OUTPUT_FILE" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "$LB_DNS",
  "total_tests": ${RESULTS[total]},
  "passed": ${RESULTS[passed]},
  "failed": ${RESULTS[failed]},
  "pass_rate": "$PASS_RATE%",
  "status": "$([ $EXIT_CODE -eq 0 ] && echo 'PASS' || echo 'FAIL')"
}
EOF
    echo -e "${BLUE}Results saved to: $OUTPUT_FILE${NC}"
fi

exit $EXIT_CODE
