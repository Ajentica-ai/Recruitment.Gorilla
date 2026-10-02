<!-- phase: DONE | branch: fix/RG-102/Profile-links-relative-url | tasks: 4/4
     base: f59832e | updated: 2026-10-02
     next: PR open against develop, awaiting review -->
# Plan: Profile links open a broken in-app URL
## Tasks
- [x] Add `client/src/utils/externalUrl.ts` (bare -> https, http(s) kept, other schemes -> undefined)
- [x] Render all seven profile links and the `hasLinks` check through it in `ReadOnlyCandidateProfile.tsx`
- [x] Same for the submission link in `StatusTimeline.tsx` (sibling defect)
- [x] Document the rule in `ai-docs/frontend.md`
## Tests
- Standard tier: `externalUrl.test.ts` table (the reported URL, www, padded, `//`, host:port, http(s) kept, javascript:/data:/mailto: and empty rejected); full `npx tsc -b` + `npm test`.
## Files
- client/src/utils/externalUrl.ts, client/src/utils/externalUrl.test.ts
- client/src/components/ReadOnlyCandidateProfile.tsx, client/src/components/StatusTimeline.tsx
- ai-docs/frontend.md
