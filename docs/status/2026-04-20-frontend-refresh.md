# Hot Pulse Frontend Refresh

Date: `2026-04-20`

## Goal
This pass focuses on the Web dashboard only. The backend pipeline, worker flow, scan APIs, and data contracts stay unchanged. The work is limited to:

- replacing the rigid admin-style layout with a faster-to-scan creator dashboard
- correcting broken radar visuals and removing the "traditional backend" feel
- keeping the page light enough for normal use while adding a stronger tech aesthetic

## MCP-Verified References
The implementation was aligned against the latest MCP / Context7 references before coding:

- Aceternity UI: `/websites/ui_aceternity`
- Verified setup direction:
  - install base utilities such as `motion`, `clsx`, and `tailwind-merge`
  - add components locally in the codebase instead of relying on a heavy runtime package
  - use lightweight components appropriate for dashboards, especially `Spotlight`, `Card Spotlight`, and `Background Beams`
- Next.js App Router and Tailwind v4 patterns remain unchanged from the existing project baseline

## Implemented Changes
### 1. New visual direction
- switched the page to a darker "creator command center" look
- added restrained beam, spotlight, and grid treatments instead of noisy decorative effects
- moved the most important action and decision points into the first screen

### 2. Aceternity-style component integration
- added local UI building blocks inspired by the current Aceternity setup model:
  - `src/components/ui/aceternity/spotlight.tsx`
  - `src/components/ui/aceternity/card-spotlight.tsx`
  - `src/components/ui/aceternity/background-beams.tsx`
- added supporting utilities:
  - `src/lib/utils.ts`
- added required lightweight dependencies:
  - `motion`
  - `tailwind-merge`

### 3. Dashboard structure refresh
- rebuilt the hero area into a high-signal radar console
- kept "scan now" and "test notification" as primary actions
- promoted live hotspot decisions above lower-value configuration surfaces
- moved source JSON editing behind collapsible advanced panels to reduce visual noise
- grouped notification history and run history into a clearer right-side operations rail

### 4. Copy and readability cleanup
- replaced the visible Chinese mojibake in the main dashboard UI with clean Chinese copy
- improved the information hierarchy so the user can quickly answer:
  - what is trending
  - how trustworthy it is
  - whether the system is ready
  - what to do next

### 5. Typography and theme tokens
- wired `Space Grotesk` for display moments and `IBM Plex Sans` for the main UI stack
- updated global tokens and background treatment in `src/app/globals.css`
- kept effects restrained so the page still loads and reads like a product, not a demo reel

## Files Changed
- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/components/dashboard-shell.tsx`
- `src/components/ui/aceternity/spotlight.tsx`
- `src/components/ui/aceternity/card-spotlight.tsx`
- `src/components/ui/aceternity/background-beams.tsx`
- `src/lib/utils.ts`
- `package.json`

## Validation
- `pnpm lint` passed
- `pnpm test` passed
- `pnpm build` passed

## Notes
- One existing `next build` warning remains around the project trace that touches `src/core/config.ts` through `next.config.ts`. This warning predates the UI refresh and does not block the dashboard build.
- Agent Skills are still intentionally not started yet. Web-first delivery remains the active milestone.
