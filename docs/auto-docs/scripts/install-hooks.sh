#!/bin/bash

# Install Git Hooks for Open LOS Auto-Documentation
#
# Usage:
#   ./docs/auto-docs/scripts/install-hooks.sh
#
# This script installs the following hooks:
#   - post-commit: Generates release logs after commits
#   - pre-push: Validates documentation requirements
#   - prepare-commit-msg: Adds documentation reminders

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Open LOS Auto-Documentation Hook Installer${NC}"
echo "============================================"
echo ""

# Get directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
HOOKS_SOURCE="$SCRIPT_DIR/hooks"
HOOKS_TARGET="$REPO_ROOT/.git/hooks"

# Check if we're in a git repo
if [ ! -d "$REPO_ROOT/.git" ]; then
    echo -e "${RED}Error: Not in a git repository${NC}"
    exit 1
fi

# Check if source hooks exist
if [ ! -d "$HOOKS_SOURCE" ]; then
    echo -e "${RED}Error: Hooks source directory not found: $HOOKS_SOURCE${NC}"
    exit 1
fi

echo -e "${BLUE}Installing hooks from:${NC} $HOOKS_SOURCE"
echo -e "${BLUE}Installing hooks to:${NC} $HOOKS_TARGET"
echo ""

# Install each hook
HOOKS=("post-commit" "pre-push" "prepare-commit-msg")

for hook in "${HOOKS[@]}"; do
    SOURCE="$HOOKS_SOURCE/$hook"
    TARGET="$HOOKS_TARGET/$hook"

    if [ ! -f "$SOURCE" ]; then
        echo -e "${YELLOW}Warning: Hook not found: $hook${NC}"
        continue
    fi

    # Check if hook already exists
    if [ -f "$TARGET" ]; then
        echo -e "${YELLOW}Hook exists: $hook${NC}"

        # Check if it's our hook
        if grep -q "Open LOS Auto-Documentation" "$TARGET" 2>/dev/null; then
            echo -e "  ${GREEN}Already installed (updating)${NC}"
        else
            echo -e "  ${YELLOW}Custom hook exists, backing up to ${hook}.backup${NC}"
            cp "$TARGET" "${TARGET}.backup"
        fi
    fi

    # Copy hook
    cp "$SOURCE" "$TARGET"
    chmod +x "$TARGET"
    echo -e "${GREEN}Installed: $hook${NC}"
done

echo ""
echo -e "${GREEN}Hook installation complete!${NC}"
echo ""
echo "Installed hooks:"
echo "  - post-commit:       Generates release logs after commits"
echo "  - pre-push:          Validates documentation requirements"
echo "  - prepare-commit-msg: Adds documentation reminders"
echo ""
echo "To uninstall hooks, run:"
echo "  rm .git/hooks/{post-commit,pre-push,prepare-commit-msg}"
echo ""
echo "To skip hooks temporarily:"
echo "  git commit --no-verify"
echo "  git push --no-verify"
