# Issue #10: Phone and assistive-technology validation

**Status:** Browser and emulated-device checks pass. Physical iOS and Android checks are pending; VoiceOver, TalkBack, Switch Control, and Switch Access have not been exercised on real devices. Do not treat issue #10 as fully accepted until these runs are recorded.

## Automated and emulated evidence

Playwright covers desktop Chromium and WebKit plus Pixel 7 Chromium at 375×812 and iPhone SE WebKit at 320×568. The browser flows cover keyboard selection, swap and cancel; touch selection and swapping; target and playable boards; hints; win and failure states; reduced motion; focus; and phone-width layout. Existing layout checks require 44×44px playable cells and no horizontal overflow.

Final checks on 2026-09-30: lint, typecheck, production build, and all 86 unit tests passed. Playwright passed 120 tests; four offline-only WebKit cases were skipped by the existing suite.

Added contrast checks cover visible text, tile artwork, focus, selection, hint, and terminal markers. Text meets WCAG 2.2 AA thresholds of 4.5:1 for normal text and 3:1 for large text. Disabled-control text is excluded under the criterion's inactive-component exception. Meaningful tile art, state markers, and focus cues meet 3:1. These checks cover the game UI; they are not a claim of full-site WCAG conformance. See [WCAG 2.2 Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [Non-text Contrast](https://www.w3.org/WAI/WCAG22/understanding/non-text-contrast.html).

The contrast audit found the original dark dashed focus ring had only 1.80:1 contrast against inverted teal tiles. A cream halo was added around the ring. It now measures 7.63:1 against inverted teal, while the dark dashed line measures 13.69:1 against light tiles.

## Acceptance status

| Issue #10 criterion | Automated / emulated evidence | Physical evidence |
| --- | --- | --- |
| Keyboard and switch input | Keyboard selection, cancel, swap, and solve pass. | Switch Control and Switch Access pending. |
| Screen-reader position, selection, status, and results | Accessible names, pressed state, live status, and result symbols are asserted in browser tests. | VoiceOver and TalkBack announcements pending. |
| Phone touch and 6×6 readability | iPhone SE and Pixel 7 emulation passes 320px/375px layout and 44px cell checks. | Real-device touch and legibility pending. |
| Contrast and non-color cues | Text, motif, focus, selection, hint, and terminal marker checks pass. Outcomes include text and symbols. | Visual confirmation on both phones pending. |
| Reduced motion | Emulated reduced motion retains clear swap, hint, win, and failure feedback without transitions or animation. | Operating-system setting on each phone pending. |
| Findings recorded; no blocker remains | No blocking issue found by automated or emulated checks. | Manual findings and blocker status pending. |

## Physical device runs

Fill in device and software versions, outcome, and findings after each run.

| Platform | Device / OS / browser | Assistive technology and input | Result |
| --- | --- | --- | --- |
| iOS | Pending | Safari with VoiceOver; Switch Control pass | Pending |
| Android | Pending | Chrome with TalkBack; Switch Access pass | Pending |

## Manual scenarios

Run screen-reader and switch-input passes separately if enabling both at once interferes with either feature.

- Navigate the target and all 36 playable tiles. Confirm tile position and visible appearance are understandable.
- Start a round and select, reselect, cancel, and swap tiles without dragging. Confirm selection state and swap feedback are announced.
- Use the hint. Confirm the suggested positions, visible numbered markers, unchanged board, and available hint state are clear.
- Complete a round and exhaust the Hard move budget in another. Confirm win and failure announcements, visible text and symbols, inspectable boards, and terminal behavior.
- On each phone, check touch accuracy, tile legibility, target visibility while playing, and clipping at the smallest practical display size. Check portrait and landscape.
- Enable the operating system's reduced-motion setting. Confirm selection, swap, hint, win, and failure remain clear without animation.
- Record blockers and their reproduction steps. Recheck each fix on the affected device before marking it resolved.

## Findings

No blocking issue found in automated or emulated checks. Physical-device and assistive-technology findings remain unverified until the runs above are completed.
