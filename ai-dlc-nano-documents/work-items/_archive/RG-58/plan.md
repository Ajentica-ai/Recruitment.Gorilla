<!-- phase: DONE | branch: fix/RG-58/Blank-draft-entry-defaults | tasks: 2/2
     base: b749e19 | updated: 2026-10-10
     next: none. PR #136 merged into develop @69bcf33. -->
# Plan: Blank defaults for new Education/Experience draft entries (RG-58)
## Tasks
- [x] 1. Replace the hardcoded Education preset (`{ degree: 'BSc in CSE', institution: 'University', graduationYear: '2024', cgpa: '' }`) with blank strings
- [x] 2. Replace the hardcoded Experience preset (`{ jobTitle: 'Software Engineer', company: 'Company Name', duration: '2022 - Present', description: '' }`) with blank strings
## Tests
- none new - no existing test harness for DraftReviewWorkspace (1500+ lines, needs draft-list/mutation mocking); verified by reproducing in the running app before and after.
## Files
- client/src/components/drafts/DraftReviewWorkspace.tsx
