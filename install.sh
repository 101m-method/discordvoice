#!/data/data/com.termux/files/usr/bin/bash
# vc-joiner — By & Flamezz
set -e

echo "==========================================="
echo "  vc-joiner — By & Flamezz"
echo "==========================================="

if ! command -v pkg &>/dev/null; then
    echo "[!] Termux değil. Elle kur."
    exit 1
fi

echo "[*] Paketler güncelleniyor..."
pkg update -y && pkg upgrade -y

echo "[*] Node.js ve git kuruluyor..."
pkg install -y nodejs-lts git python build-essential

echo "[*] npm güncelleniyor..."
npm install -g npm

echo "[*] Bağımlılıklar kuruluyor..."
npm install

echo ""
echo "==========================================="
echo "  Kurulum tamam — By & Flamezz"
echo "==========================================="
echo "Çalıştır: node joiner.js"
