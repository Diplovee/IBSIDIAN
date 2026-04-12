#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="${HOME}/.local/bin"
APP_DIR="${HOME}/.local/share/applications"
WRAPPER_PATH="${BIN_DIR}/ibsidian"
DESKTOP_PATH="${APP_DIR}/ibsidian.desktop"
ICON_PATH="${REPO_ROOT}/public/favicon.svg"

mkdir -p "${BIN_DIR}" "${APP_DIR}"

cat > "${WRAPPER_PATH}" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "${REPO_ROOT}"
if [ ! -f "out/main/index.js" ]; then
  bun run build
fi
exec bunx electron .
EOF

chmod +x "${WRAPPER_PATH}"

cat > "${DESKTOP_PATH}" <<EOF
[Desktop Entry]
Type=Application
Name=Ibsidian
Comment=Local-first knowledge vault
Exec=${WRAPPER_PATH}
Icon=${ICON_PATH}
Terminal=false
Categories=Office;Utility;TextEditor;
StartupNotify=true
EOF

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "${APP_DIR}" >/dev/null 2>&1 || true
fi

echo "Installed Ibsidian launcher: ${WRAPPER_PATH}"
echo "Installed desktop entry: ${DESKTOP_PATH}"
echo "You can now launch Ibsidian from your app menu."
