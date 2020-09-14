#!/usr/bin/env bash
set -eu

declare input_version=${1:-}
declare version="patch"

if [[ "$input_version" == "minor" ]]; then
  version="minor"
elif [[ "$input_version" == "major" ]]; then
  version="major"
elif [[ ! -z "$input_version" ]]; then
  version="--new-version $input_version"
fi

echo "Setting new version to '$version'"
yarn version $version --no-git-tag-version
node scripts/update-version.js
