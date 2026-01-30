# Feature Demo: Merge pull request #4 from seadotdev/matt-arderne/codex-review

## Metadata
- **Feature**: Merge pull request #4 from seadotdev/matt-arderne/codex-review
- **Version**: 0.1.0
- **Demo Type**: CLI
- **Generated**: 2026-01-30T08:07:07.596Z

---

## Automated Demo Script

```bash
#!/bin/bash
# Auto-generated demo for: Merge pull request #4 from seadotdev/matt-arderne/codex-review

set -e

echo "=== Open LOS Demo: Merge pull request #4 from seadotdev/matt-arderne/codex-review ==="
echo ""

# Setup
echo "Starting the server..."
npm run start --workspace=packages/api &
SERVER_PID=$!
sleep 3

# Demo sequence
echo ""
echo "=== Demonstrating the feature ==="
echo ""

# Health check
echo "1. Checking server health..."
curl -s http://localhost:3000/health | jq .
echo ""

# Main demo
echo "2. Main feature demonstration..."
curl -s http://localhost:3000/v1/deals | jq .
echo ""

# Cleanup
echo "=== Demo Complete ==="
kill $SERVER_PID 2>/dev/null || true
```

---

## Asciinema Config

```json
{
  "command": "bash docs/auto-docs/generated/demos/merge-pull-request-4-from-seadotdev-matt-arderne-c/demo.sh",
  "title": "Merge pull request #4 from seadotdev/matt-arderne/codex-review",
  "idle_time_limit": 2
}
```

---

## Motion Video Keyframes

```yaml
keyframes:
  - time: 0.0
    action: show_logo
    duration: 1.0

  - time: 1.0
    action: transition_to_terminal
    duration: 0.5

  - time: 1.5
    action: run_demo
    duration: 30.0

  - time: 31.5
    action: show_results
    duration: 3.0

  - time: 34.5
    action: show_cta
    duration: 2.0
```

---

## Output Artifacts

After running this demo, the following files should be generated:

```
demos/merge-pull-request-4-from-seadotdev-matt-arderne-c/
├── demo.sh           # Executable script
├── demo.cast         # Asciinema recording
├── keyframes.yaml    # Motion video keyframes
└── README.md         # Demo documentation
```
