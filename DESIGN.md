---
name: Tile-Swap Puzzle — Aegean Fresco Restoration
description: A daily mosaic restoration game with a calm, blue-led Aegean interface.
colors:
  aegean-field: "#154a67"
  deep-sea: "#103a54"
  warm-ivory: "#f5f1e8"
  button-ivory: "#fff9f0"
  cyan-register: "#b6d6d5"
  cyan-soft: "#d8e7e4"
  coral-pigment: "#ad5142"
  gold-pigment: "#e4cc79"
  pale-mist: "#dde7e7"
  muted-ink: "#38586a"
  rule-blue: "#8faab2"
  disabled-edge: "#aabdc7"
  disabled-surface: "#cedce0"
  disabled-ink: "#3d5b68"
  dialog-scrim: "rgb(3 26 45 / 78%)"
typography:
  display:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "clamp(34px, 3.05vw, 44px)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  mobile-display:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "clamp(31px, 7vw, 38px)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  puzzle-display:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "clamp(29px, 7vw, 36px)"
    fontWeight: 700
    lineHeight: 1.08
  loading-display:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "clamp(34px, 4vw, 54px)"
    fontWeight: 700
    lineHeight: 1.08
  loading-status:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "clamp(25px, 3.3vw, 36px)"
    fontWeight: 700
    lineHeight: 1.2
  headline:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  action:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.2
  control:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 650
    lineHeight: 1.2
  label:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 650
    lineHeight: 1.15
  navigation:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 650
    lineHeight: 1.2
  stat:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 650
    lineHeight: 1.3
  wordmark:
    fontFamily: "Lalezar, Avenir Next Condensed, Avenir, sans-serif"
    fontSize: "23px"
    fontWeight: 400
    lineHeight: 1
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.55
  scale-09: {fontSize: "9px"}
  scale-10: {fontSize: "10px"}
  scale-11: {fontSize: "11px"}
  scale-12: {fontSize: "12px"}
  scale-13: {fontSize: "13px"}
  scale-14: {fontSize: "14px"}
  scale-15: {fontSize: "15px"}
  scale-16: {fontSize: "16px"}
  scale-17: {fontSize: "17px"}
  scale-18: {fontSize: "18px"}
  scale-19: {fontSize: "19px"}
  scale-20: {fontSize: "20px"}
  scale-21: {fontSize: "21px"}
  scale-22: {fontSize: "22px"}
  scale-23: {fontSize: "23px"}
  scale-24: {fontSize: "24px"}
  scale-25: {fontSize: "25px"}
  scale-26: {fontSize: "26px"}
  scale-27: {fontSize: "27px"}
  scale-28: {fontSize: "28px"}
  scale-29: {fontSize: "29px"}
  scale-31: {fontSize: "31px"}
  scale-34: {fontSize: "34px"}
rounded:
  tile: "1px"
  tiny: "2px"
  xs: "3px"
  sm: "4px"
  badge: "6px"
  control: "7px"
  panel: "8px"
  dialog: "10px"
  card: "12px"
  hero: "14px"
  pill: "999px"
  circle: "50%"
spacing:
  tile-gap: "3px"
  compact: "8px"
  control: "12px"
  component: "16px"
  section: "24px"
  board-column: "54px"
components:
  button-start:
    backgroundColor: "{colors.gold-pigment}"
    textColor: "{colors.aegean-field}"
    typography: "{typography.action}"
    rounded: "{rounded.panel}"
    padding: "11px 22px"
    height: "50px minimum"
  button-hint:
    backgroundColor: "{colors.gold-pigment}"
    textColor: "{colors.aegean-field}"
    typography: "{typography.control}"
    rounded: "{rounded.panel}"
    padding: "11px 12px"
    height: "76px desktop; 54px mobile"
  button-clear:
    backgroundColor: "{colors.coral-pigment}"
    textColor: "{colors.button-ivory}"
    typography: "{typography.control}"
    rounded: "{rounded.panel}"
    padding: "11px 12px"
    height: "76px desktop; 54px mobile"
  chip-mode:
    backgroundColor: "{colors.cyan-soft}"
    textColor: "{colors.aegean-field}"
    typography: "{typography.label}"
    rounded: "{rounded.badge}"
    padding: "5px 10px"
  card-mode:
    backgroundColor: "{colors.deep-sea}"
    textColor: "{colors.warm-ivory}"
    rounded: "{rounded.panel}"
    padding: "16px desktop; 14px mobile"
  navigation-masthead:
    backgroundColor: "{colors.warm-ivory}"
    textColor: "{colors.aegean-field}"
    typography: "{typography.navigation}"
    height: "68px desktop; 62px mobile"
  input-authoring:
    backgroundColor: "{colors.deep-sea}"
    textColor: "{colors.warm-ivory}"
    typography: "{typography.code}"
    rounded: "{rounded.panel}"
    padding: "14px"
  mosaic-frame:
    backgroundColor: "{colors.deep-sea}"
    rounded: "{rounded.panel}"
    padding: "8px"
    width: "min(100%, 530px)"
  tile-cell:
    backgroundColor: "{colors.warm-ivory}"
    rounded: "{rounded.tile}"
  stat-card:
    backgroundColor: "{colors.warm-ivory}"
    textColor: "{colors.aegean-field}"
    typography: "{typography.stat}"
    rounded: "{rounded.panel}"
    padding: "11px 13px"
---

# Design System: Tile-Swap Puzzle — Aegean Fresco Restoration

## Overview

**Creative North Star: "Aegean Fresco Restoration"**

The visual world treats the authored mosaic as the fresco being restored. Aegean blue gives the paired target and player boards room to read; warm plaster, muted cyan, coral, and gold carry the Mediterranean reference. The game can stay playful while the interface feels precise and composed.

The authored 6×6 tile motifs are the artwork. The daily game, mode comparison, and offline editor share an open blue field, compact ivory masthead, Avenir Next interface, and flat surfaces. The editor keeps its generation, validation, import, and export workflow, with monospaced JSON controls.

**Key Characteristics:**
- The paired playable mosaics supply the artwork; the blue field gives them room.
- Ivory frames and cyan registers organize boards and headings.
- Coral and gold identify functional actions and game states.
- Avenir Next carries headings and interface text; Lalezar remains in the wordmark.

**The Open-Field Rule.** Keep the margins around the boards uninterrupted. The masthead stays quiet; decorative side scenes and full-page textures do not belong there.

## Colors

The palette combines a deep blue field, a darker board well, warm plaster, and functional pigment. CSS support shades live in the sidecar's tonal ramps rather than becoming extra base colors.

### Primary
- **Aegean Blue** (`colors.aegean-field`): Page field, brand ink, and the main dark stroke for tile art.

### Secondary
- **Cyan Register** (`colors.cyan-register`): Board headings, focus and selection cues, and positive game-state accents.
- **Soft Cyan** (`colors.cyan-soft`): Quiet chip surfaces and low-emphasis cyan fills.
- **Coral Pigment** (`colors.coral-pigment`): The cancel-selection action and negative game-state accents.

### Tertiary
- **Gold Pigment** (`colors.gold-pigment`): Start and hint actions, remaining-attempt emphasis, focus, and numbered instructions.

### Neutral
- **Deep Sea Blue** (`colors.deep-sea`): Board wells, mode cards, and other dark content surfaces.
- **Warm Ivory** (`colors.warm-ivory`): Tile faces, masthead, status panels, and text panels.
- **Action Ivory** (`colors.button-ivory`): High-contrast text on the coral cancel action.
- **Pale Mist** (`colors.pale-mist`): Supporting text on the blue field.
- **Muted Ink** (`colors.muted-ink`): Supporting copy on light surfaces.
- **Rule Blue** (`colors.rule-blue`): Fine separators, board outlines, and focus boundaries.
- **Disabled Neutral / Ink** (`colors.disabled-surface`, `colors.disabled-ink`): Muted control states that remain readable.
- **Dialog Scrim** (`colors.dialog-scrim`): A translucent deep-blue layer behind the enlarged-target dialog.

**The Function-First Pigment Rule.** Cyan, coral, and gold identify a control, board state, focus cue, or boundary. Keep them out of ornamental side artwork.

## Typography

**Display Font:** Avenir Next, Avenir, Segoe UI, sans-serif.
**Body Font:** Avenir Next, Avenir, Segoe UI, sans-serif.
**Brand Font:** Lalezar, Avenir Next Condensed, Avenir, sans-serif, for the wordmark only.
**Label/Mono Font:** Avenir Next for controls; ui-monospace, SFMono-Regular, Consolas, monospace for editable puzzle JSON.

**Character:** The interface uses a restrained sans-serif hierarchy. The wordmark carries the painted voice; Avenir Next keeps titles, instructions, status, and longer descriptions direct.

### Hierarchy
- **Display:** Bold Avenir Next page titles use a 34–44px desktop clamp; mode and comparison titles use a 31–38px mobile clamp. The active puzzle title uses a 29–36px clamp and steps to 28px at 380px and below. Loading titles and statuses use their own fluid clamps.
- **Headline / title:** Avenir Next section headings use 22px and 20px steps; board and comparison headings share the headline role.
- **Body / action:** Avenir Next body copy is 16px/1.45. Primary start actions use 16px bold; hint and cancel controls use 14px on desktop and 13px on mobile.
- **Label / stat:** Compact labels use 13px; progress copy uses 15px/1.3. Uppercase is reserved for short game-state tags.
- **Navigation:** Header links use 15px on desktop and 12px on mobile; all links keep a 44px minimum tap target.
- **Wordmark / code:** Lalezar in the masthead scales down at narrow widths. Editable puzzle JSON uses 13px/1.55 ui-monospace.

**The Role-Split Rule.** Use Lalezar only for the wordmark. Keep headings, controls, instructions, explanations, and status messages in Avenir Next; reserve ui-monospace for editable JSON.

## Layout

The page shell tops out at 1536px. Player-facing content aligns to a centered 1187px grid. Desktop boards are capped at 530px and use a 54px column gap with a 12px row gap. The progress and action row, instructions, and footer align to the same grid.

At 1000px, progress and action groups move to a two-column row. At 760px, board sections stack, the target becomes a 124–152px sticky reference, and the outer round-tools row becomes a single column. The hint and cancel actions stay side by side until 380px, then stack. Preview and authoring boards stack on narrow screens; the layout remains usable at 320px.

Most mastheads are 68px high on desktop and 62px on mobile. The active-round masthead wraps naturally at 480px and below to preserve its links. Navigation and footer links retain 44px tap targets while the band stays compact. Keep more room above a page heading than below it, and align text, board edges, and controls to shared content boundaries.

## Elevation & Depth

The board and tile artwork stay flat: ivory cell faces, dark gutters, cyan headings, and the deep blue board well provide separation. Progress panels and actions have no resting shadow or hover lift. A soft shadow separates the sticky mobile target and enlarged-target dialog; a pale halo sits outside the gold outline on a focused tile. Reduced-motion preferences remove animation and transitions.

### Shadow Vocabulary
- **Pinned target** (`0 6px 16px rgb(2 27 46 / 18%)`): Separates the sticky target reference from the mobile play area.
- **Target dialog** (`0 18px 44px rgb(1 22 40 / 32%)`): Lifts the enlarged target above gameplay.
- **Tile focus halo** (`0 0 0 5px var(--ivory)`): Keeps the ivory tile edge visible outside the gold keyboard-focus outline; it marks focus rather than adding depth.

**The Flat-By-Default Rule.** Use tonal contrast and borders for everyday grouping. Reserve depth shadows for the sticky target and enlarged-target dialog; use a pale halo only to preserve tile keyboard focus.

## Shapes

The form language pairs square mosaic cells with gently rounded controls and panels. Use the shared radius steps in frontmatter: cells stay nearly square, small badges are quieter than panels, and controls avoid pill shapes except where the component already uses a capsule. Board-heading corners round only at the top; the grid well rounds only at the bottom.

The shared gold focus outline is 3px with a 3px offset. Tile focus keeps an ivory halo around its gold outline. Keep the board borders and cell gutters crisp so adjacent geometric marks remain distinct.

## Components

### Buttons

Start is a gold primary action with Aegean text. Hint uses the same gold; Cancel Selection uses coral with warm ivory text. The round actions are taller on wide screens and compact to 54px on mobile. Disabled actions use a cool, low-emphasis fill. Hover adds a small brightness change without lifting the control.

### Chips

Mode badges use a muted cyan fill, Aegean text, and a fine border. Completion and cached-copy labels remain text-led and distinct from the mode badge.

### Cards / Containers

Mode cards use Deep Sea Blue and a fine blue edge. The selected card uses a brighter blue fill and cyan outline without a shadow. Progress panels use Warm Ivory with Aegean text. Preview sections keep the same flat surface language.

### Inputs / Fields

The offline authoring editor uses a deep-sea field, a muted blue border, panel corners, and monospaced JSON text. Validation messages use ivory panels with clear cyan, gold, or coral borders; disabled export uses the shared muted control colors.

### Navigation

Every route uses the compact ivory masthead with a fine Aegean top rule. Lalezar anchors the left; an Avenir Next link sits at the right. Keep the band free of a large centered register. Links underline on hover and use the shared visible focus treatment.

### Board Frame and Grid

Each desktop board has a cyan title band above an ivory-framed deep-sea well. The title band, frame, and six-column grid share the same maximum width. Keep the cell art intact and preserve at least 44px for playable cells.

### Signature Mosaic Tile

The tile is the central visual object, not a background decoration. Each square ivory or colored field carries the actual authored geometric linework. Selected, hinted, focused, won, and lost states use distinct outlines or overlays without redrawing the motif.

## Do's and Don'ts

### Do:
- **Do** keep the authored 6×6 mosaics and their geometric linework intact; the target and player board are the main artwork.
- **Do** keep the margins around the boards as open blue field and the player masthead quiet.
- **Do** use warm ivory under tile marks and crisp dark gutters between adjacent cells.
- **Do** reserve cyan, coral, and gold for real headings, controls, focus, and game-state cues.
- **Do** carry the same palette, type roles, and panel shapes into mode selection, comparison, and offline authoring.
- **Do** preserve visible keyboard focus, distinct selection and hint marks, and reduced-motion behavior.

### Don't:
- **Don't** add architecture, plants, waves, florals, or side illustrations beside the boards.
- **Don't** replace authored motifs with stock iconography or decorative pattern filler.
- **Don't** soften tile boundaries with thick gaps, rounded cells, or heavy shadows.
- **Don't** use accent pigment as decoration when it does not identify a control, boundary, focus cue, or state.
- **Don't** hide keyboard focus or make selection, hint, win, and loss states depend on color alone.
