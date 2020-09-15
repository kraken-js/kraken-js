#!/usr/bin/env bash
set -eu

# --patch
# --minor
# --major
# --new-version 0.0.x
declare version="$@"
[[ ! -z "$version" ]] && version="--patch"

echo "Setting new version to '$version'"

# update root version
yarn version $version --no-git-tag-version
# propagate changes to monorepo packages
node scripts/update-version.js
# install new version
yarn install --frozen-lockfile
# package all
yarn package
