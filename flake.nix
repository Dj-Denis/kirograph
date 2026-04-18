{
  inputs.flakelight.url = "github:nix-community/flakelight";
  outputs = {flakelight, ...}:
    flakelight ./. {
      package = {
        buildNpmPackage,
        importNpmLock,
        fetchgit,
        pkg-config,
        vips,
        qdrant,
      }: let
        pkg = builtins.fromJSON (builtins.readFile ./package.json);
        qdrant-local = buildNpmPackage {
          pname = "qdrant-local";
          version = "0.0.0-alpha.10";

          src = fetchgit {
            url = "https://github.com/Anush008/qdrant-local.git";
            rev = "e5ef6088a6051535dba607b657af2e9adf49c8d0";
            hash = "sha256-fgY0JOgGUEpdMP50Hk685OM7wwvKUtBCNB1G+kCYciU=";
          };
          npmDepsHash = "sha256-+s8T8ID1AZ50o34R+TfgVkZOArxG71CvyoP2GZf8eUg=";

          dontNpmBuild = true;

          nativeBuildInputs = [qdrant];

          patches = [
            # We install the qdrant our-selfs
            ./patches/qdrant-local.patch
          ];
        };
      in
        buildNpmPackage {
          pname = "kirograph";
          version = pkg.version;
          src = ./.;
          npmDeps = importNpmLock {
            npmRoot = ./.;
            packageSourceOverrides = {
              "node_modules/qdrant-local" = qdrant-local;
            };
          };
          npmConfigHook = importNpmLock.npmConfigHook;
          buildInputs = [vips];
          nativeBuildInputs = [pkg-config];
        };

      devShell = {
        inputsFrom = pkgs: [pkgs.kirograph];
        packages = pkgs: [
          pkgs.nodejs_20
        ];
      };
      apps = {
        update-lockfile = {pkgs, ...}: {
          type = "app";
          program = toString (pkgs.writeShellScript "update-lockfile" ''
            set -euo pipefail

            export PATH=${pkgs.nodejs_20}/bin:$PATH

            echo "Node: $(node -v)"
            echo "NPM: $(npm -v)"

            # Clean environment for deterministic output
            rm -rf node_modules

            # Recompute lockfile only
            npm install --package-lock-only --ignore-scripts

            echo "✅ package-lock.json updated"
          '');
        };
      };
    };
}
