#!/bin/bash
# Make a self-signed TLS cert for serving Perdisco over HTTPS.
# Usage: tools/make_tls_cert.sh [out_dir] [extra SAN entries, e.g. IP:10.13.37.9 DNS:myhost]
# Always covers localhost, 127.0.0.1 and this host's name; prints the local.env lines to add.
set -euo pipefail
out="${1:-$HOME/.config/perdisco/tls}"; shift || true
san="DNS:localhost,IP:127.0.0.1,DNS:$(hostname)"
for e in "$@"; do san="$san,$e"; done
mkdir -p "$out"; chmod 700 "$out"
openssl req -x509 -newkey rsa:2048 -nodes -days 825 -subj "/CN=perdisco $(hostname)" \
  -addext "subjectAltName=$san" -keyout "$out/key.pem" -out "$out/cert.pem" 2>/dev/null
chmod 600 "$out/key.pem"
echo "SAN: $san"
echo "Add to local.env:"
echo "PERDISCO_TLS_CERT=$out/cert.pem"
echo "PERDISCO_TLS_KEY=$out/key.pem"
