<!-- phase: DONE | branch: fix/RG-47/View-all-job-openings-link | tasks: 3/3
     base: b46d6da | updated: 2026-10-07
     next: commit on request -->
# Plan: View All links to Job Openings page
## Tasks
- [x] Failing component test: "View all" href is /jobs
- [x] Change Link in ActiveJobOpeningsTable.tsx to /jobs
- [x] Hide button when user lacks /jobs access (Interviewer), if canWriteCandidates matches the /jobs roles
## Tests
- Standard: Vitest component test for the link target; run full npm test + tsc
## Files
- client/src/components/dashboard/ActiveJobOpeningsTable.tsx (+ new .test.tsx)
