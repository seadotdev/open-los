# Video Script Template

<!--
This template generates video scripts for feature demos and announcements.
Designed for short-form (60-90s) and long-form (3-5min) content.
-->

## Video Metadata

- **Title**: {{VIDEO_TITLE}}
- **Feature**: {{FEATURE_NAME}}
- **Version**: {{VERSION}}
- **Duration**: {{DURATION}}
- **Format**: {{FORMAT}} (Short-form / Long-form / Tutorial)
- **Platform**: {{PLATFORM}} (YouTube / TikTok / LinkedIn / Demo)

---

## Short-Form Script (60-90 seconds)

### HOOK (0:00 - 0:05)

**Visual**: {{HOOK_VISUAL}}

**Audio/Voiceover**:
> {{HOOK_TEXT}}

**On-Screen Text**: {{HOOK_TEXT_OVERLAY}}

---

### PROBLEM (0:05 - 0:15)

**Visual**: {{PROBLEM_VISUAL}}

**Audio/Voiceover**:
> {{PROBLEM_STATEMENT}}

**On-Screen Text**: {{PROBLEM_TEXT_OVERLAY}}

---

### SOLUTION INTRO (0:15 - 0:25)

**Visual**: {{SOLUTION_VISUAL}}

**Audio/Voiceover**:
> {{SOLUTION_INTRO}}

**On-Screen Text**: {{SOLUTION_TEXT_OVERLAY}}

---

### DEMO (0:25 - 0:50)

{{#DEMO_STEPS}}
**Step {{INDEX}} ({{TIMESTAMP}})**:

- **Visual**: {{STEP_VISUAL}}
- **Action**: {{STEP_ACTION}}
- **Voiceover**: > {{STEP_NARRATION}}
- **On-Screen**: {{STEP_TEXT}}

{{/DEMO_STEPS}}

---

### RESULT (0:50 - 0:55)

**Visual**: {{RESULT_VISUAL}}

**Audio/Voiceover**:
> {{RESULT_STATEMENT}}

**On-Screen Text**: {{RESULT_TEXT_OVERLAY}}

---

### CTA (0:55 - 1:00)

**Visual**: {{CTA_VISUAL}}

**Audio/Voiceover**:
> {{CTA_TEXT}}

**On-Screen Text**:
- {{CTA_TEXT_OVERLAY}}
- {{LINK_DISPLAY}}

---

## Long-Form Script (3-5 minutes)

### INTRO (0:00 - 0:30)

**Scene**: {{INTRO_SCENE}}

**Voiceover**:
> {{INTRO_NARRATION}}

**B-Roll Suggestions**:
{{#INTRO_BROLL}}
- {{BROLL_ITEM}}
{{/INTRO_BROLL}}

---

### CONTEXT (0:30 - 1:00)

**Scene**: {{CONTEXT_SCENE}}

**Voiceover**:
> {{CONTEXT_NARRATION}}

**Graphics/Animations**:
{{#CONTEXT_GRAPHICS}}
- {{GRAPHIC_DESCRIPTION}}
{{/CONTEXT_GRAPHICS}}

---

### FEATURE OVERVIEW (1:00 - 1:30)

**Scene**: {{OVERVIEW_SCENE}}

**Voiceover**:
> {{OVERVIEW_NARRATION}}

**Key Points to Highlight**:
{{#KEY_POINTS}}
- {{POINT}}
{{/KEY_POINTS}}

---

### LIVE DEMO (1:30 - 3:30)

#### Setup (1:30 - 1:45)

**Screen Recording**: Terminal/IDE

**Commands**:
```bash
{{SETUP_COMMANDS}}
```

**Voiceover**:
> {{SETUP_NARRATION}}

---

#### Demo Part 1: {{DEMO_PART_1_TITLE}} (1:45 - 2:15)

**Screen Recording**: {{DEMO_1_SCREEN}}

**Actions**:
{{#DEMO_1_ACTIONS}}
1. {{ACTION}}
{{/DEMO_1_ACTIONS}}

**Commands/Code**:
```bash
{{DEMO_1_CODE}}
```

**Voiceover**:
> {{DEMO_1_NARRATION}}

**Callouts**:
{{#DEMO_1_CALLOUTS}}
- Highlight: {{CALLOUT}}
{{/DEMO_1_CALLOUTS}}

---

#### Demo Part 2: {{DEMO_PART_2_TITLE}} (2:15 - 2:45)

**Screen Recording**: {{DEMO_2_SCREEN}}

**Actions**:
{{#DEMO_2_ACTIONS}}
1. {{ACTION}}
{{/DEMO_2_ACTIONS}}

**Commands/Code**:
```bash
{{DEMO_2_CODE}}
```

**Voiceover**:
> {{DEMO_2_NARRATION}}

---

#### Demo Part 3: {{DEMO_PART_3_TITLE}} (2:45 - 3:15)

**Screen Recording**: {{DEMO_3_SCREEN}}

**Actions**:
{{#DEMO_3_ACTIONS}}
1. {{ACTION}}
{{/DEMO_3_ACTIONS}}

**Voiceover**:
> {{DEMO_3_NARRATION}}

---

### RESULTS & BENEFITS (3:15 - 3:45)

**Scene**: {{RESULTS_SCENE}}

**Voiceover**:
> {{RESULTS_NARRATION}}

**Graphics**:
{{#RESULTS_GRAPHICS}}
- {{GRAPHIC}}: {{VALUE}}
{{/RESULTS_GRAPHICS}}

---

### WRAP-UP & CTA (3:45 - 4:00)

**Scene**: {{WRAPUP_SCENE}}

**Voiceover**:
> {{WRAPUP_NARRATION}}

**End Screen**:
- GitHub link: {{GITHUB_URL}}
- Documentation: {{DOCS_URL}}
- Subscribe CTA

---

## Production Notes

### Music
- **Style**: {{MUSIC_STYLE}}
- **Mood**: {{MUSIC_MOOD}}
- **Suggestions**: {{MUSIC_SUGGESTIONS}}

### Graphics Needed
{{#GRAPHICS_LIST}}
- [ ] {{GRAPHIC_NAME}}: {{GRAPHIC_DESCRIPTION}}
{{/GRAPHICS_LIST}}

### Screen Recording Requirements
- Resolution: 1920x1080 or 4K
- Terminal: Clean theme, large font (18pt+)
- Browser: Hide bookmarks, clean URL bar

### Thumbnail
- **Text**: {{THUMBNAIL_TEXT}}
- **Visual**: {{THUMBNAIL_VISUAL}}
- **Colors**: {{THUMBNAIL_COLORS}}

---

## Motion Graphics Keyframes

### Intro Animation
```
[0.0s] Logo fade in
[0.5s] Logo settle + tagline
[1.0s] Transition to content
```

### Feature Callout
```
[0.0s] Box appears around feature
[0.3s] Label slides in
[0.5s] Highlight pulse
[1.0s] Fade out
```

### Code Highlight
```
[0.0s] Code block appears
[0.2s] Syntax highlighting animates
[0.5s] Relevant line highlights
[1.0s] Output appears below
```

### End Card
```
[0.0s] Content fades
[0.3s] End card slides in
[0.5s] CTA buttons appear
[1.0s] Subscribe animation
```
