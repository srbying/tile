# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Casual players looking for a playful daily puzzle. Confirmed by the user.

## Product Purpose

The game gives players one daily 6×6 mosaic to restore by swapping complete tiles. Success is restoring the pattern within the selected attempt budget; players can review or share finished results.

## Positioning

Players restore authored motifs by swapping whole tiles. One daily mosaic is shared across Easy, Medium, and Hard. The modes change which visual attributes distinguish tiles and set different swap budgets, so the puzzle stays the same while the amount of visual information changes.

## Operating Context

The release changes at New York midnight. Players can start, pause by leaving the page, and resume an unfinished round from local progress. The app also includes a separate offline authoring tool for generating, validating, previewing, importing, and exporting puzzle candidates.

## Capabilities and Constraints

- The board is 6×6; a committed swap exchanges two whole tiles and spends one attempt. The validated shortest solution is 10 swaps; budgets are 15, 13, and 10 for Easy, Medium, and Hard.
- Players can use one non-penalty hint, inspect an enlarged target, and share completed results.
- The latest validated daily release and app shell are cached for offline play. No account or external assets are required.
- Preserve existing touch and keyboard play, screen-reader announcements, focus behavior, reduced-motion support, 44px minimum playable cells, and all win, loss, loading, and offline states during visual work.
- The scope of this redesign is visual. Changes to game rules or puzzle content have not been requested.

## Brand Commitments

The original visual idea was reminiscent of ancient Greece. The user is open to other ancient eras as inspiration; no era is fixed.

## Evidence on Hand

The repository contains 30 authored SVG-path motifs and validated daily puzzle content. No testimonials, customer claims, or external brand assets were found. Physical iOS and Android assistive-technology checks are still pending, as noted in `docs/accessibility-validation.md`.

## Product Principles

- Make the daily puzzle playful and easy to enter for casual players.
- Keep the shared daily puzzle recognizable across difficulty modes.
- Make visual comparison and tile swapping the center of play.
- Keep hints optional and free of attempt penalties.
- Preserve local, resumable play without requiring an account.
- Keep the interface usable with touch, keyboard, and assistive technology.
