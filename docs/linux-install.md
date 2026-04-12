# Linux install (Arch/Omarchy) + app menu launcher

This project can be run locally from source and added to your Linux app menu.

## 1) Clone and build

```bash
mkdir -p ~/Apps
cd ~/Apps
git clone https://github.com/Diplovee/IBSIDIAN.git
cd IBSIDIAN

bun install
bun run rebuild
bun run build
```

## 2) Install launcher + desktop entry

From the repo root:

```bash
bun run install:linux-local
```

This creates:

- `~/.local/bin/ibsidian` (launcher command)
- `~/.local/share/applications/ibsidian.desktop` (app menu entry)

The desktop entry uses `public/favicon.svg` as the app icon.

## 3) Launch

- From app menu: search for **Ibsidian**
- Or terminal: `ibsidian`

---

## Updating safely (without affecting your notes)

Keep your vault in a separate folder (example: `~/Vaults/MyVault`) and **not** inside the app repo.

Update app code:

```bash
cd ~/Apps/IBSIDIAN
git pull
bun install
bun run build
```

Your vault files are separate and won’t be overwritten by app updates.
