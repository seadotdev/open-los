# Open LOS Frontend Prototypes

This directory contains two frontend design prototypes for Open LOS, demonstrating different UI paradigms for loan origination systems.

## Quick Start

Both frontends are static HTML/CSS/JS - no build step required. Simply open the `index.html` file in a browser:

```bash
# Experimental Activity Feed
open experimental/index.html

# Traditional LOS
open traditional/index.html
```

Or serve with any static file server:

```bash
# Using Python
python -m http.server 8080

# Using Node
npx serve .
```

---

## 1. Experimental: Activity Feed UI

**Location:** `frontend/experimental/`

### Design Philosophy

Based on the "Web as Activity Hub" pattern from IDEAS.md:

> "Web UI serves as an activity feed - algorithmically surfaced interesting items"

This design treats the UI as a **secondary interface** where:
- The CLI and AI agents are the primary way to interact with the system
- The web UI surfaces what's important, rather than expecting users to navigate to find information
- AI insights are embedded directly into the activity stream
- Actions are contextual and immediate

### Key Characteristics

- **Single-column activity feed** - Everything important flows chronologically
- **Smart prioritization** - Critical items (covenant breaches, approvals) surface first
- **Minimal navigation** - Just filters, no complex menu hierarchies
- **AI-embedded** - AI assistant available via Cmd/Ctrl+K
- **Action-oriented** - Each item has contextual actions
- **Dark theme** - Reduces eye strain for monitoring workflows

### UI Components

| Component | Purpose |
|-----------|---------|
| Focus Summary | Today's critical numbers at a glance |
| Activity Feed | Chronological stream of all system events |
| Filter Tabs | Quick filtering by event type |
| AI Panel | Conversational interface (Cmd/Ctrl+K) |
| Action Buttons | Contextual actions on each item |

### When to Use This Pattern

- Organizations with strong AI/CLI adoption
- Teams that prefer reactive over proactive workflows
- Monitoring-heavy use cases (portfolio oversight)
- Users comfortable with algorithmic curation

---

## 2. Traditional: Standard LOS UI

**Location:** `frontend/traditional/`

### Design Philosophy

A familiar, professional interface that lending professionals expect:

> "Users should feel immediately comfortable - this looks like software they've used before"

This design follows conventional enterprise software patterns:
- Sidebar navigation with clear sections
- Data tables with sorting and filtering
- Dashboard with KPIs and charts
- Kanban board for pipeline visualization

### Key Characteristics

- **Sidebar navigation** - Clear hierarchy of system sections
- **Dashboard overview** - KPIs, pipeline chart, activity, alerts
- **Data tables** - Familiar grid-based data presentation
- **Kanban pipeline** - Visual deal progression
- **Light theme** - Professional, clean aesthetic

### UI Sections

| Section | Purpose |
|---------|---------|
| Dashboard | Overview with stats, pipeline chart, activity, alerts |
| Pipeline | Kanban board view of deals by stage |
| Deals | Searchable, filterable deal table |
| Borrowers | Entity management and exposure tracking |
| Documents | Document library with filtering |
| Covenants | Covenant monitoring and compliance tracking |
| Reports | Report generation interface |

### When to Use This Pattern

- Traditional lending organizations
- Teams transitioning from legacy LOS software
- Users who prefer explicit navigation
- Compliance-focused workflows requiring audit trails

---

## Comparison

| Aspect | Experimental (Activity Feed) | Traditional (LOS) |
|--------|------------------------------|-------------------|
| **Primary Paradigm** | Feed-based, reactive | Navigation-based, exploratory |
| **Information Architecture** | Flat, algorithmic | Hierarchical, user-driven |
| **AI Integration** | Embedded, conversational | Optional, supplementary |
| **Navigation** | Minimal filters | Full sidebar menu |
| **Data Presentation** | Cards, inline context | Tables, detail views |
| **Theme** | Dark | Light |
| **Target Users** | Power users, AI-native orgs | Traditional lenders |

---

## Technical Notes

### Stack
- **HTML5** - Semantic markup
- **CSS3** - Custom properties, Grid, Flexbox
- **Vanilla JS** - No framework dependencies

### Browser Support
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

### File Structure
```
frontend/
├── README.md
├── experimental/
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── traditional/
    ├── index.html
    ├── styles.css
    └── app.js
```

### Future Integration

These prototypes are designed to integrate with the Open LOS API:

```javascript
// Example: Fetching activity feed
const response = await fetch('/v1/audit-events?limit=50');
const events = await response.json();

// Example: Getting pipeline data
const pipeline = await fetch('/v1/analytics/pipeline');
```

See `/docs/AI_NATIVE_ARCHITECTURE.md` for detailed API integration patterns.

---

## Design Tokens

Both designs use consistent design tokens that can be extracted for a design system:

```css
/* Shared spacing scale */
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 32px;

/* Status colors */
--status-success: #10b981;
--status-warning: #f59e0b;
--status-error: #ef4444;
--status-info: #3b82f6;
```

---

## Contributing

When extending these prototypes:

1. Keep dependencies minimal (prefer vanilla JS)
2. Maintain accessibility (ARIA labels, keyboard navigation)
3. Test on mobile viewports
4. Document new components in this README
