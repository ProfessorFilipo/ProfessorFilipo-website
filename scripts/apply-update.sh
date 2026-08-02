#!/bin/bash
# Mac/Linux equivalent of scripts/apply-update.ps1
# Usage: ./scripts/apply-update.sh ~/Downloads/some-update.zip

set -e

ZIP_PATH="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -z "$ZIP_PATH" ]; then
  echo "Uso: ./scripts/apply-update.sh caminho/para/arquivo.zip"
  exit 1
fi

if [ ! -f "$ZIP_PATH" ]; then
  echo "Arquivo não encontrado: $ZIP_PATH"
  exit 1
fi

echo "Extraindo '$ZIP_PATH' para '$REPO_ROOT'..."
unzip -o "$ZIP_PATH" -d "$REPO_ROOT"

echo ""
echo "Feito. Estado atual do repositório:"
cd "$REPO_ROOT"
git status

echo ""
echo "Revise as mudanças acima. Se estiver tudo certo, rode:"
echo "  git add -A"
echo "  git commit -m \"sua mensagem aqui\""
echo "  git push"
