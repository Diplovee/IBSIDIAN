{
  description = "Ibsidian local development shell and launcher helpers for NixOS";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      lib = nixpkgs.lib;
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = lib.genAttrs systems;
      runtimePackagesFor = pkgs: with pkgs; [
        bash
        bun
        git
        nodejs
        python311
        python311Packages.setuptools
        gcc
        gnumake
        pkg-config
        libglvnd
        mesa
        gtk3
        nss
        nspr
        dbus
        alsa-lib
        cups
        atk
        at-spi2-atk
        pango
        cairo
        expat
        libdrm
        libx11
        libxcomposite
        libxdamage
        libxext
        libxfixes
        libxrandr
        libxcb
        libxkbfile
        libxscrnsaver
        libxtst
      ];
      mkRepoApp = pkgs: name: script: {
        type = "app";
        program = toString (pkgs.writeShellScript "${name}" ''
          set -euo pipefail
          repo="''${IBSIDIAN_REPO_ROOT:-$PWD}"
          if [ ! -f "$repo/package.json" ] || ! grep -q '"name": "ibsidian"' "$repo/package.json"; then
            echo "Run this from the IBSIDIAN repo root, or set IBSIDIAN_REPO_ROOT=/path/to/IBSIDIAN" >&2
            exit 1
          fi
          export PATH="${lib.makeBinPath (runtimePackagesFor pkgs)}:$PATH"
          cd "$repo"
          exec ${script}
        '');
      };
    in {
      devShells = forAllSystems (system:
        let pkgs = import nixpkgs { inherit system; };
        in {
          default = pkgs.mkShell {
            packages = runtimePackagesFor pkgs ++ [ pkgs.electron-rebuild ];
            shellHook = ''
              echo "Ibsidian Nix shell ready"
              echo "Use: bun install && bun run rebuild && bun run dev"
            '';
          };
        });

      apps = forAllSystems (system:
        let pkgs = import nixpkgs { inherit system; };
        in {
          default = mkRepoApp pkgs "ibsidian-local" "bash ./scripts/run-local-electron.sh";
          dev = mkRepoApp pkgs "ibsidian-dev" "bash ./scripts/dev-electron-nix.sh";
          rebuild = mkRepoApp pkgs "ibsidian-rebuild" "bash ./scripts/rebuild-node-pty-nix.sh";
          install-local = mkRepoApp pkgs "ibsidian-install-local" "bash ./scripts/install-linux-local.sh";
        });
    };
}
