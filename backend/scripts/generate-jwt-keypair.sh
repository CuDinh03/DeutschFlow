#!/usr/bin/env bash
# Generate an RSA-2048 keypair for JWT RS256 signing (S18) and print the env values as single-line,
# \n-escaped PEM — the exact format JwtService (backend) and middleware.ts (web) expect.
#
# Run this on YOUR secure machine. It touches NO server and writes NO file (keys live only in a temp
# dir that is wiped on exit). Copy the printed lines into the env locations listed at the end.
# Keep the PRIVATE value secret — it is the token-signing key.
#
# Usage:  ./backend/scripts/generate-jwt-keypair.sh
set -euo pipefail

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

openssl genpkey -algorithm RSA -out "$tmp/private.pem" -pkeyopt rsa_keygen_bits:2048 2>/dev/null
openssl rsa -pubout -in "$tmp/private.pem" -out "$tmp/public.pem" 2>/dev/null

# Collapse a PEM file to ONE line, replacing real newlines with the two-char sequence \n.
# awk (not GNU-only sed) so it works the same on macOS/BSD and Linux.
escape() { awk 'NR>1{printf "%s","\\n"} {printf "%s",$0} END{print ""}' "$1"; }

echo
echo "════════ JWT_RSA_PRIVATE_KEY  (BACKEND ONLY — keep secret) ════════"
echo "JWT_RSA_PRIVATE_KEY=$(escape "$tmp/private.pem")"
echo
echo "════════ JWT_RSA_PUBLIC_KEY   (backend + Amplify — safe to share) ════════"
echo "JWT_RSA_PUBLIC_KEY=$(escape "$tmp/public.pem")"
echo
echo "──────────────────────────────────────────────────────────────────────────"
echo "WHERE TO PUT THEM:"
echo "  • Backend prod (EC2):  /home/ubuntu/DeutschFlow/.env.production"
echo "        JWT_RSA_PRIVATE_KEY=...   JWT_RSA_PUBLIC_KEY=...   (leave JWT_SECRET as-is)"
echo "  • Amplify Console → App settings → Environment variables:"
echo "        JWT_RSA_PUBLIC_KEY=...    (NEVER put the private key here)"
echo "  • Local dev (optional):  backend/.env  and  frontend/.env.local"
echo
echo "DO NOT set JWT_ALGORITHM=RS256 yet. Deploy with the keys first (verify-both phase), confirm"
echo "logins work, THEN flip JWT_ALGORITHM=RS256 in a low-traffic window."
echo "Full sequence: docs/security/RS256_MIGRATION_PLAN.md §6."
echo "──────────────────────────────────────────────────────────────────────────"
