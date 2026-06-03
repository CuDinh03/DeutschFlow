#!/usr/bin/env bash
# Compute SPKI SHA-256 (base64) pins for TLS certificate pinning (S12).
#
# Usage:  ./mobile/scripts/compute-spki-pins.sh [host] [port]
# Default host: api.mydeutschflow.com  port: 443
#
# Prints the pin for every cert in the served chain (leaf → intermediate(s)).
# ⚠️ The host uses Let's Encrypt, which rotates the LEAF every ~60-90 days. Pin a STABLE key
# (ISRG Root X1) plus a backup, and re-run this BEFORE each rotation. Put ≥2 pins into
# mobile/lib/certPinning.ts and verify on a physical device before enabling.
set -euo pipefail

HOST="${1:-api.mydeutschflow.com}"
PORT="${2:-443}"

d="$(mktemp -d)"
trap 'rm -rf "$d"' EXIT

echo | openssl s_client -servername "$HOST" -connect "${HOST}:${PORT}" -showcerts 2>/dev/null > "$d/raw"
awk -v dir="$d" 'BEGIN{n=0} /-----BEGIN CERTIFICATE-----/{n++} {print > (dir "/c" n ".pem")}' "$d/raw"

echo "SPKI SHA-256 pins for ${HOST}:${PORT}"
echo "----------------------------------------------------------------"
for c in "$d"/c*.pem; do
  [ -s "$c" ] || continue
  subj="$(openssl x509 -in "$c" -noout -subject 2>/dev/null | sed 's/subject=//')"
  pin="$(openssl x509 -in "$c" -pubkey -noout 2>/dev/null \
        | openssl pkey -pubin -outform der 2>/dev/null \
        | openssl dgst -sha256 -binary 2>/dev/null \
        | openssl enc -base64)"
  [ -n "$pin" ] && printf '%s  <=  %s\n' "$pin" "${subj:-<no subject>}"
done
