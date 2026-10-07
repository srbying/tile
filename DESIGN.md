---
name: Tile-Swap Puzzle — Aegean Fresco Restoration
description: A playful mosaic restoration game set against a clear Aegean blue field.
colors:
  aegean-field: "#084888"
  deep-sea: "#08486f"
  warm-ivory: "#f7eee6"
  cyan-register: "#97eaf7"
  coral-pigment: "#dc4e36"
  gold-pigment: "#f8c954"
  pale-mist: "#d4edf1"
  muted-ink: "#40657b"
  rule-blue: "#76a9c2"
typography:
  display:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "clamp(40px, 3.91vw, 60px)"
    fontWeight: 800
    lineHeight: 0.93
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Lalezar, Avenir Next Condensed, Avenir, sans-serif"
    fontSize: "clamp(40px, 4.03vw, 62px)"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "0.005em"
  title:
    fontFamily: "Lalezar, Avenir Next Condensed, Avenir, sans-serif"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "0.02em"
  body:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "0.045em"
rounded:
  tile: "2px"
  field: "10px"
  panel: "12px"
  dialog: "14px"
  pill: "999px"
  circle: "50%"
spacing:
  tile-gap: "4px"
  compact: "8px"
  control: "12px"
  component: "16px"
  section: "24px"
  board-gap: "80px"
  game-row-gap: "10px"
  toolbar-offset: "0px"
  instruction-band-top: "18px"
components:
  button-start:
    backgroundColor: "{colors.gold-pigment}"
    textColor: "{colors.aegean-field}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    padding: "12px 26px"
    height: "54px minimum"
  button-hint:
    backgroundColor: "{colors.gold-pigment}"
    textColor: "{colors.aegean-field}"
    typography: "{typography.label}"
    rounded: "{rounded.panel}"
    padding: "12px 8px"
  button-clear:
    backgroundColor: "{colors.coral-pigment}"
    textColor: "{colors.warm-ivory}"
    typography: "{typography.label}"
    rounded: "{rounded.panel}"
    padding: "12px 8px"
  chip-daily:
    backgroundColor: "{colors.cyan-register}"
    textColor: "{colors.aegean-field}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "7px 15px"
  card-difficulty:
    backgroundColor: "{colors.deep-sea}"
    textColor: "{colors.warm-ivory}"
    typography: "{typography.body}"
    rounded: "{rounded.panel}"
    padding: "18px"
  navigation-masthead:
    backgroundColor: "{colors.warm-ivory}"
    textColor: "{colors.aegean-field}"
    typography: "{typography.label}"
    height: "6.5vh, bounded 62px–78px"
  input-authoring:
    backgroundColor: "#063961"
    textColor: "{colors.warm-ivory}"
    typography: "13px/1.55 ui-monospace"
    rounded: "{rounded.field}"
    padding: "14px"
  mosaic-frame:
    backgroundColor: "{colors.deep-sea}"
    textColor: "{colors.aegean-field}"
    rounded: "{rounded.panel}"
    padding: "8px"
    width: "min(100%, 530px)"
  tile-cell:
    backgroundColor: "{colors.warm-ivory}"
    textColor: "{colors.aegean-field}"
    rounded: "{rounded.tile}"
  stat-card:
    backgroundColor: "{colors.warm-ivory}"
    textColor: "{colors.aegean-field}"
    typography: "{typography.title}"
    rounded: "{rounded.panel}"
    padding: "12px 16px"
---

# Design System: Tile-Swap Puzzle — Aegean Fresco Restoration

## Overview

**Creative North Star: "Aegean Fresco Restoration"**

The visual world treats the authored mosaic as the fresco being restored. A clear Aegean blue field gives the paired target and player boards room to read; warm plaster, cyan registers, coral and gold pigment, crisp dark gutters, and bold geometric linework carry the ancient Mediterranean reference.

The artwork lives in the real 6×6 tile motifs and one shallow masthead register. Keep the surrounding field open and quiet. Mode selection, difficulty preview, and offline authoring use the same painted bands, plaster panels, and geometric ink so the whole product feels related without turning every page into a scene.

**Key Characteristics:**
- The paired playable mosaics supply the artwork; the blue field gives them room.
- Ivory frames and cyan registers organize the boards and headings.
- Coral and gold identify functional actions and selected states.
- Lalezar gives headings a hand-painted voice; Avenir Next keeps instructions direct.

**The Open-Field Rule.** Keep the margins outside the playable boards as uninterrupted blue. The masthead may carry one small register; decorative side scenes do not belong there.

## Colors

The palette pairs a saturated sea-blue field with warm plaster and uses bright painted pigments where structure or action needs attention.

### Primary
- **Aegean Blue** (`aegean-field`): The full page field, dark wordmark ink, and the primary dark stroke color in tile artwork.
- **Deep Sea Blue** (`deep-sea`): The darker board well and selected content grounds that need to sit behind ivory tile faces.

### Secondary
- **Cyan Register** (`cyan-register`): Board-title bands, daily badges, links, and visible hover or selection cues.
- **Coral Pigment** (`coral-pigment`): The clear-selection action and hint marks; it signals a deliberate, secondary interaction.

### Tertiary
- **Gold Pigment** (`gold-pigment`): The hint and start actions, remaining-attempt emphasis, focus ring, and numbered step markers.

### Neutral
- **Warm Ivory** (`warm-ivory`): Tile faces, masthead, progress cards, and text panels; it is the plaster ground that keeps line art legible.
- **Pale Mist** (`pale-mist`): Supporting text and instructions over the blue field.
- **Muted Ink** (`muted-ink`): Supporting copy on ivory dialogs and surfaces.
- **Rule Blue** (`rule-blue`): Fine separators between sections and instruction groups.

**The Function-First Pigment Rule.** Cyan, coral, and gold mark a real control, board state, or boundary. Keep them out of ornamental side artwork.

## Typography

**Display Font:** Avenir Next, Avenir, Segoe UI, sans-serif for the active puzzle title; Lalezar with Avenir Next Condensed and Avenir fallbacks for branded page and board headings.
**Body Font:** Avenir Next, Avenir, Segoe UI, sans-serif.
**Label/Mono Font:** Avenir Next for interface labels; ui-monospace, SFMono-Regular, Consolas, monospace for editable puzzle JSON.

**Character:** Lalezar supplies a compact, playful painted sign voice. Avenir Next carries the puzzle title, instructions, status, and longer descriptions with a clean, direct read.

### Hierarchy
- **Puzzle display** (800, `clamp(40px, 3.91vw, 60px)`, 0.93 line-height): The active daily-puzzle title; it tightens on small screens.
- **Branded headline** (400, `clamp(40px, 4.03vw, 62px)`, 1.08 line-height): Page headings in mode selection, preview, and authoring.
- **Section title** (400, 28px, 1.15 line-height): Mode, board, authoring, and preview section headings.
- **Body** (400, 16px, 1.45 line-height): Instructions and explanatory copy; the active puzzle subtitle scales with the viewport.
- **Label** (800, 13px, 1.15 line-height, 0.045em tracking): Compact badges, budgets, and action labels; uppercase is used where the label behaves as a tag.

**The Role-Split Rule.** Use Lalezar for short headings and compact action names. Keep instructions, explanations, and status messages in Avenir Next.

## Layout

The centered page shell tops out at 1536px. On the active puzzle surface, the two equal boards sit in a centered layout container no wider than 1187px. Each desktop board frame and its 6×6 grid align at a maximum width of 530px, with an 80px horizontal gap and a 10px row gap. The toolbar begins directly below the boards with no added top margin. The three-step instruction band also has no top margin and starts with 18px of top padding. Keep the title and one-line instruction above the boards, then place progress and actions below them.

At 1000px, progress and action groups can share a two-column row. At 760px, board sections stack with a 14px game-grid gap; the target becomes a compact 124–152px sticky reference above the playable mosaic, and progress and actions use a single-column control stack. The how-to band returns to a 17px top margin and 15px top padding on mobile. At 380px, the two gameplay actions stack as well. Mode choices and paired preview boards move from three or two columns to one. The layout supports widths down to 320px.

## Elevation & Depth

The board and tile artwork stay flat: ivory cell faces, dark gutters, cyan headings, and the deep blue board well provide the separation. Soft shadows appear under the progress cards and large controls; a stronger shadow belongs to the enlarged-target dialog. Interactive cards and controls rise by 2px on hover over 160ms ease-out. Reduced-motion preferences remove transitions and animation.

### Shadow Vocabulary
- **Raised control** (`0 8px 22px rgb(3 36 62 / 18%)`): Resting shadow on progress cards, swap count, and gameplay actions.
- **Hover control** (`0 11px 26px rgb(3 36 62 / 22%)`): The stronger hover treatment on hint and clear-selection actions.
- **Pinned target** (`0 8px 18px rgb(2 27 46 / 25%)`): Separates the sticky target reference from the mobile play area.
- **Target dialog** (`0 18px 54px rgb(1 22 40 / 42%)`): The modal enlargement sits above the game surface.

## Shapes

The form language is built from square mosaic cells inside gently rounded plaster frames. Cells use a 2px radius and a crisp 1px dark stroke; the artwork itself has a nearly square 1px clip. Board headings round only their top corners, while the grid well rounds only its bottom corners. Cards and game actions use 12px corners, authoring fields 10px, the enlarged-target dialog 14px, and badges and primary controls use pill ends. The gold keyboard-focus outline is 3px with a 3px offset; tile focus keeps an ivory halo around the gold outline.

## Components

### Buttons

Buttons are large painted controls with clear color roles and visible interaction states.
- **Shape:** Start and secondary return/share actions are capsule-shaped; the two main round actions use 12px corners.
- **Primary:** Start Puzzle is gold with Aegean-blue text, at least 54px tall with 12px by 26px padding. It lifts 2px and brightens on hover, then returns to rest when pressed.
- **Gameplay actions:** Use Hint is gold; Clear Selection is coral with ivory text. Both are 88px tall on wide screens and 58px on mobile. Disabled actions switch to a cool muted fill and lose their shadow.
- **Hover / Focus:** Actions lift 2px on hover. Keyboard focus uses the shared 3px gold outline with offset; reduced-motion removes the transition.

### Chips

Badges read as painted capsules rather than outlined tags.
- **Style:** Daily release is cyan with Aegean text; difficulty is gold with Aegean text. Both use 999px corners and bold tracking.
- **Size:** At desktop size, badges are at least 41px high. At 760px and below, they compact to 32px high with tighter padding.
- **State:** Completion and cached-copy labels remain text-led and keep their status distinct from the daily and mode badges.

### Cards / Containers

Mode cards and progress cards are calm plaster panels floating on the blue field.
- **Corner Style:** 12px for mode options and progress/stat cards.
- **Background:** Mode options use Deep Sea Blue; progress and swap counts use Warm Ivory.
- **Border:** Mode cards begin with a 1px blue stroke. The selected card uses a 2px cyan stroke, brighter blue fill, and a subtle raised shadow; finished mode receives gold border emphasis.
- **Internal Padding:** Mode cards use 18px; progress cards use 12px by 16px.

### Inputs / Fields

The offline authoring editor uses a dark, ink-like field that keeps the JSON readable and distinct from the surrounding plaster.
- **Style:** Deep blue field, muted blue 1px border, 10px corners, 14px padding, and 13px monospace text at 1.55 line-height.
- **Focus:** 3px gold outline with a 3px offset.
- **Error / Disabled:** Validation messages use ivory panels with clear cyan, gold, or coral borders; disabled export uses a subdued blue-gray treatment.

### Navigation

The masthead is a shallow ivory band with a 6px Aegean top rule and a 6px coral lower rule. The Lalezar wordmark anchors the left; a clear Avenir Next link sits at the right. One centered painted register may decorate the masthead on wider screens and is hidden on mobile. Links gain an underline on hover; keyboard focus remains visibly gold.

### Board Frame and Grid

Each desktop board has a cyan title band above an ivory-framed deep-sea well. Keep the title band, frame, and six-column tile grid aligned to the same 530px maximum width. The grid is square, has six rows and six columns, uses a 4px gutter and 8px inner padding, and keeps the border and tile art crisp. On mobile, the target frame condenses to a 124–152px sticky reference while the player board expands to the available width.

### Signature Mosaic Tile

The tile is the central visual object, not a background decoration. Every tile is a square ivory or colored field carrying the actual authored geometric linework. A dark 1px border and a narrow board gutter keep neighboring strokes distinct. A playable cell remains at least 44px for touch and pointer use. Selected, hinted, focused, won, and lost states use distinct outlines or overlays without redrawing the motif.

## Do's and Don'ts

### Do:
- **Do** keep the authored 6×6 mosaics and their geometric linework intact; the target and player board are the main artwork.
- **Do** keep the margins around the boards as open blue field, with only the small masthead register as environmental ornament.
- **Do** use warm ivory under tile marks and crisp dark gutters between adjacent cells.
- **Do** reserve cyan, coral, and gold for real headings, controls, focus, and game-state cues.
- **Do** carry the same palette, type roles, and panel shapes into mode selection, difficulty preview, and offline authoring.
- **Do** preserve the visible gold focus treatment, distinct selection and hint marks, and reduced-motion behavior.

### Don't:
- **Don't** add architecture, plants, waves, florals, or other side illustrations beside the boards.
- **Don't** replace or restyle the authored 6×6 motifs as stock iconography or decorative pattern filler.
- **Don't** soften the crisp tile boundaries with thick gaps, rounded cells, or heavy shadows.
- **Don't** use accent pigment as free decoration when it does not identify a control, boundary, or state.
- **Don't** hide keyboard focus or make selection, hint, win, and loss states depend on color alone.
