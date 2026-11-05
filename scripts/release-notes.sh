#!/usr/bin/env bash
# Print the CHANGELOG.md section for a version, e.g. `scripts/release-notes.sh 0.2.0`.
set -euo pipefail
version="${1#v}"
notes=$(awk -v v="$version" '
  /^## \[/ { if (found) exit; if (index($0, "## [" v "]") == 1) { found = 1; next } }
  found { print }
' CHANGELOG.md | sed -e '/./,$!d' -e ':a' -e '/^\n*$/{$d;N;ba' -e '}')
if [[ -z "$notes" ]]; then
  echo "No section for version $version in CHANGELOG.md" >&2
  exit 1
fi
printf '%s\n' "$notes"
