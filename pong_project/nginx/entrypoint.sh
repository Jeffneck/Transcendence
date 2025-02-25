#!/bin/bash
set -e

CERT_DIR="/etc/ssl/certs"
KEY_DIR="/etc/ssl/private"

CERT_FILE="$CERT_DIR/my-selfsigned.crt"
KEY_FILE="$KEY_DIR/my-selfsigned.key"

if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
  echo "Génération d'un nouveau certificat auto-signé..."
  openssl req -x509 -nodes -days 365 \
    -newkey rsa:2048 \
    -keyout "$KEY_FILE" \
    -out "$CERT_FILE" \
    -subj "/CN=192.168.1.138"
fi

echo "Démarrage de Nginx..."
exec nginx -g "daemon off;"
