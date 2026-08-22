# Responsive Width Fix - 2026-08-23

## Overflow Sources

- `.screen` used `width: min(1120px, 100%)`, which constrained desktop content and interacted poorly with fixed-width tables.
- Pipeline table used `min-width: 980px`.
- JD table used `min-width: 1120px`.
- Table wrapper relied on horizontal scrolling.
- Sticky company column, nowrap status pills, long JD text, long URLs, and long tags could widen their columns.

## Layout Changes

- Global page containers now use full available width with `min-width: 0`.
- Main content adapts to `viewport - sidebar` instead of assuming a fixed desktop canvas.
- Long content uses wrapping rules across tags, links, cards, drawer content, copy blocks, JD excerpts, and full JD text.
- Pipeline and JD lists use responsive CSS grid rather than fixed-width HTML tables.

## Responsive Strategy

- Desktop: grid rows preserve table-like scanning without horizontal overflow.
- 1024-1199px: tighter column ratios, padding, and font sizing.
- 768-1023px: rows become compact two-column stacked records.
- <=767px: each record becomes a single-column stacked card with labels.
- Filter tabs wrap naturally across lines on small screens.

## Verification

Added `tests/responsive_overflow_check.mjs`, which opens the PWA in headless Chrome and verifies no document or major element horizontal overflow at:

- 1440x900
- 1280x800
- 1024x768
- 768x1024
- 430x932
- 390x844
- 375x812

States checked:

- 首页
- 机会
- 流程: all filters
- JD
- 面试
- 我的
