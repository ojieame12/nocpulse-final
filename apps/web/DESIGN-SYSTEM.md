# NocPulse Design System

Source of truth: `nocpulse-final.pen` design file. This document codifies the exact values for any agent building UI.

## Aesthetic Direction

**Editorial agricultural journal** — not a dashboard, not a SaaS app. Think Kinfolk magazine meets a precision farming report. The feel test: *"Would a farmer find this approachable? Does it feel premium without being pretentious?"*

- **Grounded, not flashy** — clean whites, soft greens, muted grays. No gradients on buttons, no neon, no dark mode.
- **Data-dense but readable** — clear section labels, generous line-height, numbers that breathe.
- **Calm hierarchy** — one focal point per section. If everything is bold, nothing is.
- **Soft elevation** — paper cards on a light surface. Dual shadow with very low opacity.
- **Never compress to fit** — spacing is non-negotiable. Content adapts to spacing, never reverse.

## Typography

| Role | Font | Usage |
|------|------|-------|
| **Headings/Display** | `P22 Mackinac` (serif) | Field names, hero values (donut centers, price displays), section titles. Use sparingly for impact. |
| **Body/UI** | `Sintony` (sans-serif) | Everything else — labels, buttons, descriptions, metadata. The workhorse. |
| **Data/Code** | `IBM Plex Mono` (monospace) | Numeric values, coordinates, timestamps. Adds precision. |

### Type Scale (from `--text-*` tokens)

| Token | Size | Usage |
|-------|------|-------|
| `--text-xs` | 11px | Section labels, timestamps, small metadata |
| `--text-sm` | 13px | Body text, descriptions |
| `--text-base` | 14px | Default body, button text, data cell values |
| `--text-md` | 16px | Metric values in data cells |
| `--text-lg` | 18px | Card titles, sub-headings |
| `--text-xl` | 22px | Panel field name (P22 Mackinac) |
| `--text-2xl` | 28px | Donut center values, hero prices (P22 Mackinac) |

### Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `--leading-tight` | 1.2 | Headings (P22 Mackinac) |
| `--leading-snug` | 1.3 | Compact labels |
| `--leading-normal` | 1.5 | Body text, labels |
| `--leading-relaxed` | 1.7 | Data-heavy specs (mono), long descriptions |

## Color System

### Palettes
- **Forest green** (`--color-forest-50` to `--color-forest-950`) — brand identity
- **Slate** (`--color-slate-50` to `--color-slate-900`) — neutrals, the workhorses

### Status Colors (semantic — never use for generic UI)
| Status | Color | Meaning |
|--------|-------|---------|
| `--status-positive` | `#16a34a` | Healthy, growing, good |
| `--status-warning` | `#f59e0b` | Watch, caution, moderate |
| `--status-danger` | `#ef4444` | Stress, critical, urgent |
| `--status-info` | `#3b82f6` | Informational, moisture-related |

### Status Badge Pairs (background + foreground)
| Variant | Background | Text |
|---------|-----------|------|
| Positive | `#dcfce7` | `#004726` |
| Warning | `#fef3c7` | `#92400e` |
| Danger | `#fee2e2` | `#991b1b` |
| Info | `#dbeafe` | `#1e40af` |
| Neutral | `#f4f4f5` | `#374151` |

### Text Colors
| Token | Color | Usage |
|-------|-------|-------|
| `--text-primary` | `#111111` | Main headings, primary content |
| `--text-secondary` | `#6b7280` | Subtitles, descriptions |
| `--text-body` | `#474c54` | Body paragraphs |
| `--text-muted` | `#8a8f98` | Labels, metadata, timestamps |
| `--color-slate-800` | `#2d2d2d` | Data values (mono), field names in sidebar |

## Spacing

### Scale (from `--space-*` tokens)
| Token | Value |
|-------|-------|
| `--space-2xs` | 2px |
| `--space-xs` | 4px |
| `--space-sm` | 8px |
| `--space-md` | 12px |
| `--space-lg` | 16px |
| `--space-xl` | 24px |
| `--space-2xl` | 32px |
| `--space-3xl` | 48px |

### Common Patterns
| Context | Value |
|---------|-------|
| Panel body padding | `48px 32px 24px 32px` (top right bottom left) |
| Panel body gap (between sections) | `24px` |
| Section internal padding | `16px` |
| Section internal gap | `8px` |
| Card internal padding | `16-24px` |
| Button padding | `12px 28px` (primary), `16px 28px` (secondary) |
| Tab pill padding | `8px 12px` |
| Data cell padding | `10px 12px` |
| Panel width | `420px` |
| Sidebar width | `280px` |
| Topbar height | `44px` |
| Panel header height | `36px` |

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | Status badges (NOT pills) |
| `--radius-md` | 10px | Buttons, inputs, section wrappers |
| `--radius-lg` | 16px | Empty state containers |
| `--radius-xl` | 20px | Panels |
| `--radius-full` | 999px | Pills, toggles, alert severity badges |

## Shadows

| Context | Shadow |
|---------|--------|
| Panel | `0 2px 7px -2px rgba(0,0,0,0.04), 0 8px 28px -8px rgba(0,0,0,0.1)` |
| Button (primary) | `0 4px 0 #002a15` |
| Button (secondary) | `0 4px 0 #004726` |
| Card/pill active | `0 1px 3px rgba(0,0,0,0.07)` |
| Alert card | `0 4px 0 0 rgba(237,236,236,0.95)` |

## Component Anatomy

### Panel Shell
```
.panel — 420px, radius 20, white, dual shadow, overflow hidden, absolute positioned
  .panel__header — 36px, bg #f7f6f6, padding 0 32px, border-bottom
  .panel__pill-tabs — padding 12px 32px, slate-100 bg, full width
  .panel__body — padding 48 32 24 32, gap 24px, overflow-y auto
    sections...
```

### Section Wrapper
```
.panel__section / .styled-section — radius 10, bg slate-50, border 1px border-light, padding 16, gap 8
  section-label — Sintony 9px bold, letterSpacing 1px, text-muted, uppercase
  content...
```

### Section Label Pattern
```css
font-family: Sintony;
font-size: 9px;
font-weight: 700;
letter-spacing: 1px;
color: #8a8f98;
text-transform: uppercase;
```

### Data Cell
```css
padding: 10px 12px;
gap: 2px;
border-radius: 8px;
background: white;
/* NO border in data cells */
label: Sintony 9px 700 text-muted, letterSpacing 0.5px
value: IBM Plex Mono 16px 600 text-primary
sub: Sintony 10px 400 text-secondary
```

### Empty State
```css
icon: lucide, 40px, color #d4d4d4
title: Sintony 16px bold, text-primary
description: Sintony 13px, text-secondary, center, max-width 220px
container: center both axes, gap 16px, padding 32px
CTA: primary button with padding 10px 20px
```

### Status Badges
```css
border-radius: 6px (NOT pills);
padding: 6px 12px;
font-size: 12px;
font-weight: 600;
```

### Alert Card (inside section)
```css
padding: 10px 12px;
border-radius: 8px;
background: white;
gap: 8px;
icon: 16px, status-colored
title: Sintony 11px bold, slate-800
subtitle: Sintony 10px, text-muted
severity badge: radius-full, padding 3px 8px, 9px bold
```

## Layout Rules

1. **Flexbox always** — never absolute positioning for layout
2. **Vertical stacking** for panels, forms, lists, section content
3. **Horizontal** for stat cards, button rows, tab bars, data pairs
4. **fill_container** for children that should stretch
5. **fit_content** for containers sized by children
6. **Never hardcode heights on content** — let content determine height
7. **Panel body scrolls** — `overflow-y: auto` on `.panel__body`
8. **48px top padding** on panel body creates breathing room from tabs

## Whitespace Rules

1. **Minimum 16px** padding on any container
2. **24px gap** between content sections
3. **16px gap** only for sub-items within a section
4. **32-48px gap** for major section breaks
5. **Body text** needs lineHeight 1.5 minimum
6. **Data mono** needs lineHeight 1.7
7. **Headings** can use 1.2-1.3
8. **Never let text run edge-to-edge** — min 16px from container edge

## Animation

| Event | Animation |
|-------|-----------|
| Panel switch | Crossfade 150ms out / 200ms in |
| Tab switch | Directional slide 250ms (left/right based on tab index) |
| Data sections | Cascade in with translateY(8px) + scale(0.97), 40ms stagger |
| Empty state | Fade up 400ms, 100ms delay |
| Hover lift (cards) | translateY(-2px) + shadow 0 4px 12px |
| Button press | translateY(2px) + shadow collapse |
| Badge appear | scale(0.8 to 1) spring |
| Progress bar | scaleX(0 to 1), 600ms |
| Donut chart | stroke-dashoffset draw-on, 800ms |

## File Structure

```
src/styles/
  tokens.css          — All CSS custom properties
  components.css      — Core component classes
  tabs/
    summary-tab.css   — Summary tab (st__* classes)
    report-tab.css    — Report tab (rt__* classes)
```

## Rules for Agents

1. **Always use tokens** — never hardcode hex values, pixel sizes, or font names
2. **Read the .pen file** via `batch_get` with `resolveVariables: true` for exact values — never guess from screenshots
3. **Section pattern** — every section starts with uppercase label, then content, 24px gap to next
4. **One serif per section** — P22 Mackinac only for the hero value. Everything else Sintony.
5. **Color means health** — green = healthy, red = stress, amber = watch. Never decorative.
6. **Test with the squint test** — squint at the design. See clear blocks separated by whitespace rivers.
