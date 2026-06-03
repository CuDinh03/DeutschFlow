#!/usr/bin/env bash
#
# Dev helper — simulate a remote push to the booted iOS Simulator.
# Exercises notification DISPLAY + tap handling WITHOUT a real device or Expo Push.
#
# Prereqs:
#   1) App installed on a booted simulator:   npx expo run:ios
#   2) Notification permission granted in-app (the app asks on first launch).
#
# Usage:
#   ./scripts/push-sim.sh                 # default reminder text
#   ./scripts/push-sim.sh "Custom body"   # custom body text
#
set -euo pipefail

BUNDLE_ID="com.deutschflow.app"
BODY_TEXT="${1:-Bạn có 5 từ cần ôn hôm nay 📚}"

if ! xcrun simctl list devices booted | grep -q "Booted"; then
  echo "✗ No booted simulator. Start one (e.g. 'npx expo run:ios') and retry." >&2
  exit 1
fi

PAYLOAD="$(mktemp -t dfpush)"
cat > "$PAYLOAD" <<JSON
{
  "Simulator Target Bundle": "$BUNDLE_ID",
  "aps": {
    "alert": { "title": "DeutschFlow", "body": "$BODY_TEXT" },
    "sound": "default",
    "badge": 1
  }
}
JSON

echo "→ Pushing to $BUNDLE_ID on the booted simulator…"
xcrun simctl push booted "$BUNDLE_ID" "$PAYLOAD"
rm -f "$PAYLOAD"
echo "✓ Sent. Background the app (Cmd+Shift+H / Device ▸ Home) to see the banner,"
echo "  then tap it → the app should open the notifications inbox."
