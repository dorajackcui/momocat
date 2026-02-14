#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/worktree-link-deps.sh [--source <path>] [--force]

Options:
  --source <path>  Explicitly set the source repo root that already has node_modules.
  --force          Replace an existing non-symlink node_modules in current worktree.
  -h, --help       Show this help.
EOF
}

SOURCE_ROOT=""
FORCE="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --source" >&2
        exit 1
      fi
      SOURCE_ROOT="$2"
      shift 2
      ;;
    --force)
      FORCE="1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

CURRENT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$CURRENT_ROOT" ]]; then
  echo "Not inside a git repository." >&2
  exit 1
fi

if [[ -z "$SOURCE_ROOT" ]]; then
  WORKTREE_PATH=""
  MAIN_WORKTREE=""
  while IFS= read -r line; do
    if [[ "$line" == "worktree "* ]]; then
      WORKTREE_PATH="${line#worktree }"
    elif [[ "$line" == "branch refs/heads/main" ]]; then
      MAIN_WORKTREE="$WORKTREE_PATH"
    fi
  done < <(git worktree list --porcelain)

  if [[ -n "$MAIN_WORKTREE" ]]; then
    SOURCE_ROOT="$MAIN_WORKTREE"
  else
    SOURCE_ROOT="$CURRENT_ROOT"
  fi
fi

SOURCE_ROOT="$(cd "$SOURCE_ROOT" && pwd)"
SOURCE_NODE_MODULES="$SOURCE_ROOT/node_modules"
TARGET_NODE_MODULES="$CURRENT_ROOT/node_modules"

if [[ "$CURRENT_ROOT" == "$SOURCE_ROOT" ]]; then
  echo "Current worktree is the source worktree ($SOURCE_ROOT). Nothing to link."
  exit 0
fi

if [[ ! -d "$SOURCE_NODE_MODULES" ]]; then
  echo "Source node_modules not found at: $SOURCE_NODE_MODULES" >&2
  echo "Install dependencies in source first (e.g. npm ci)." >&2
  exit 1
fi

if [[ -L "$TARGET_NODE_MODULES" ]]; then
  LINK_TARGET="$(readlink "$TARGET_NODE_MODULES")"
  if [[ "$LINK_TARGET" == "$SOURCE_NODE_MODULES" ]]; then
    echo "node_modules already linked to source: $SOURCE_NODE_MODULES"
    exit 0
  fi
  rm "$TARGET_NODE_MODULES"
elif [[ -e "$TARGET_NODE_MODULES" ]]; then
  if [[ "$FORCE" != "1" ]]; then
    echo "Current worktree already has a physical node_modules directory." >&2
    echo "Use --force to replace it with a symlink." >&2
    exit 1
  fi
  rm -rf "$TARGET_NODE_MODULES"
fi

ln -s "$SOURCE_NODE_MODULES" "$TARGET_NODE_MODULES"
echo "Linked:"
echo "  $TARGET_NODE_MODULES -> $SOURCE_NODE_MODULES"
