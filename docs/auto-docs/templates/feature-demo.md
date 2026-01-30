# Feature Demo Template

<!--
This template specifies automated feature demos for CLI and UI.
Used by the demo generator to create motion videos and interactive demos.
-->

## Demo Metadata

- **Feature**: {{FEATURE_NAME}}
- **Version**: {{VERSION}}
- **Demo Type**: {{DEMO_TYPE}} (CLI / UI / Hybrid)
- **Duration**: {{DURATION}}
- **Generated**: {{GENERATED_DATE}}

---

## Demo Specification

### Overview

{{DEMO_OVERVIEW}}

### Prerequisites

```bash
# Environment setup
{{PREREQUISITE_COMMANDS}}
```

### Demo Environment

- **OS**: {{OS}}
- **Terminal**: {{TERMINAL}}
- **Theme**: {{THEME}}
- **Font**: {{FONT}} @ {{FONT_SIZE}}px
- **Window Size**: {{WINDOW_SIZE}}

---

## CLI Demo Sequence

### Scene 1: Setup

**Duration**: {{SCENE_1_DURATION}}

**Terminal State**: Clean terminal, working directory set

```bash
# Show current state
{{SCENE_1_SETUP}}
```

**Narration Cue**: "Let's start by..."

---

### Scene 2: {{SCENE_2_TITLE}}

**Duration**: {{SCENE_2_DURATION}}

**Commands** (with timing):

```
[0.0s] $ {{COMMAND_1}}
[0.5s] # Wait for output
[1.0s] {{OUTPUT_1}}
[1.5s] $ {{COMMAND_2}}
[2.0s] {{OUTPUT_2}}
```

**Expected Output**:
```json
{{EXPECTED_OUTPUT_2}}
```

**Highlight Points**:
{{#SCENE_2_HIGHLIGHTS}}
- Line {{LINE}}: {{DESCRIPTION}}
{{/SCENE_2_HIGHLIGHTS}}

**Narration Cue**: "{{SCENE_2_NARRATION}}"

---

### Scene 3: {{SCENE_3_TITLE}}

**Duration**: {{SCENE_3_DURATION}}

**Commands**:

```bash
{{SCENE_3_COMMANDS}}
```

**Expected Output**:
```
{{SCENE_3_OUTPUT}}
```

**Pause Points**:
{{#SCENE_3_PAUSES}}
- At {{TIMESTAMP}}: {{PAUSE_REASON}} ({{PAUSE_DURATION}})
{{/SCENE_3_PAUSES}}

**Narration Cue**: "{{SCENE_3_NARRATION}}"

---

### Scene 4: {{SCENE_4_TITLE}}

**Duration**: {{SCENE_4_DURATION}}

**Commands**:

```bash
{{SCENE_4_COMMANDS}}
```

**Animation**:
- Type speed: {{TYPE_SPEED}} chars/sec
- Pause after command: {{POST_COMMAND_PAUSE}}
- Highlight: {{SCENE_4_HIGHLIGHT}}

**Narration Cue**: "{{SCENE_4_NARRATION}}"

---

### Scene 5: Conclusion

**Duration**: {{SCENE_5_DURATION}}

**Final State**:
```bash
{{FINAL_COMMAND}}
```

**Summary Display**:
```
{{SUMMARY_OUTPUT}}
```

**Narration Cue**: "And that's how you {{FEATURE_ACTION}} with Open LOS!"

---

## UI Demo Sequence (if applicable)

### Browser Setup

- **URL**: {{DEMO_URL}}
- **Viewport**: {{VIEWPORT_SIZE}}
- **Browser**: {{BROWSER}}
- **DevTools**: {{DEVTOOLS_STATE}}

---

### UI Scene 1: {{UI_SCENE_1_TITLE}}

**Duration**: {{UI_SCENE_1_DURATION}}

**Actions**:
```
[0.0s] Navigate to {{START_URL}}
[0.5s] Wait for page load
[1.0s] Click {{ELEMENT_1}}
[1.5s] Wait for response
```

**Screenshot Markers**:
- Before: {{BEFORE_STATE}}
- After: {{AFTER_STATE}}

**Mouse Path**: {{MOUSE_PATH}}

**Narration Cue**: "{{UI_SCENE_1_NARRATION}}"

---

### UI Scene 2: {{UI_SCENE_2_TITLE}}

**Duration**: {{UI_SCENE_2_DURATION}}

**Actions**:
```
[0.0s] {{UI_ACTION_1}}
[1.0s] {{UI_ACTION_2}}
[2.0s] {{UI_ACTION_3}}
```

**Form Inputs** (if any):
| Field | Value | Typing Speed |
|-------|-------|--------------|
{{#FORM_INPUTS}}
| {{FIELD_NAME}} | {{FIELD_VALUE}} | {{TYPING_SPEED}} |
{{/FORM_INPUTS}}

**Narration Cue**: "{{UI_SCENE_2_NARRATION}}"

---

### UI Scene 3: {{UI_SCENE_3_TITLE}}

**Duration**: {{UI_SCENE_3_DURATION}}

**Actions**:
```
{{UI_SCENE_3_ACTIONS}}
```

**Highlight Regions**:
{{#HIGHLIGHT_REGIONS}}
- {{REGION_NAME}}: {{REGION_SELECTOR}} - {{HIGHLIGHT_STYLE}}
{{/HIGHLIGHT_REGIONS}}

**Narration Cue**: "{{UI_SCENE_3_NARRATION}}"

---

## Motion Video Keyframes

### Opening

```yaml
keyframe_0:
  time: 0.0
  elements:
    - type: background
      color: "{{BG_COLOR}}"
    - type: logo
      position: center
      opacity: 0

keyframe_1:
  time: 0.5
  elements:
    - type: logo
      position: center
      opacity: 1
      scale: 1.0

keyframe_2:
  time: 1.0
  elements:
    - type: logo
      position: top-left
      scale: 0.3
    - type: terminal
      position: center
      opacity: 0

keyframe_3:
  time: 1.5
  elements:
    - type: terminal
      position: center
      opacity: 1
```

### Demo Recording

```yaml
{{#DEMO_KEYFRAMES}}
keyframe_{{INDEX}}:
  time: {{TIME}}
  action: {{ACTION}}
  highlight: {{HIGHLIGHT}}
  annotation: "{{ANNOTATION}}"
{{/DEMO_KEYFRAMES}}
```

### Closing

```yaml
keyframe_final_1:
  time: {{FINAL_TIME_1}}
  elements:
    - type: terminal
      opacity: 0
    - type: end_card
      opacity: 1

keyframe_final_2:
  time: {{FINAL_TIME_2}}
  elements:
    - type: cta_button
      animation: pulse
    - type: github_link
      animation: fade_in
```

---

## Asciinema Recording Config (for CLI demos)

```json
{
  "command": "{{ASCIINEMA_COMMAND}}",
  "title": "{{DEMO_TITLE}}",
  "idle_time_limit": 2,
  "env": {
    "SHELL": "/bin/bash",
    "TERM": "xterm-256color"
  }
}
```

---

## Automated Demo Script

```bash
#!/bin/bash
# Auto-generated demo script for {{FEATURE_NAME}}
# Generated: {{GENERATED_DATE}}

set -e

# Setup
echo "Setting up demo environment..."
{{SETUP_SCRIPT}}

# Demo sequence
{{#DEMO_SCRIPT_STEPS}}
echo "Step {{INDEX}}: {{DESCRIPTION}}"
sleep {{PRE_DELAY}}
{{COMMAND}}
sleep {{POST_DELAY}}

{{/DEMO_SCRIPT_STEPS}}

# Cleanup
echo "Demo complete!"
{{CLEANUP_SCRIPT}}
```

---

## Playwright Script (for UI demos)

```typescript
import { test } from '@playwright/test';

test('{{FEATURE_NAME}} demo', async ({ page }) => {
  // Setup
  await page.goto('{{START_URL}}');
  await page.waitForLoadState('networkidle');

  {{#PLAYWRIGHT_STEPS}}
  // {{STEP_DESCRIPTION}}
  await page.{{ACTION}}('{{SELECTOR}}'{{#ARGS}}, {{ARG}}{{/ARGS}});
  await page.waitForTimeout({{WAIT_TIME}});

  {{/PLAYWRIGHT_STEPS}}
});
```

---

## Output Artifacts

After generation, the following files are created:

```
demos/{{FEATURE_SLUG}}/
├── cli-demo.sh           # Executable CLI demo
├── cli-demo.cast         # Asciinema recording
├── ui-demo.spec.ts       # Playwright UI test
├── keyframes.yaml        # Motion video keyframes
├── screenshots/          # Key screenshots
│   ├── before.png
│   ├── step-1.png
│   ├── step-2.png
│   └── after.png
└── README.md             # Demo documentation
```
