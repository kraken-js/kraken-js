#!/usr/bin/env bash
set -eu

# --patch
# --minor
# --major
# --new-version 0.0.x
declare version=${1:-"--patch"}
[[ "$version" == "--new-version" ]] && version="$1 $2"

echo "Setting new version to '$version'"
yarn version $version --no-git-tag-version
node scripts/update-version.js
