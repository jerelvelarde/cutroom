# Cutroom acceptance stories

Status: test plan; unchecked items are not verified.

## Story A — Today (primary demo)

**Given** a local gallery with up to 50 personal photos/videos from multiple days, with a meaningful batch from the selected day, **when** Jerel chooses Today, **then** the editor makes a coherent vertical reel without requiring individual picks or a written creative brief.

- [ ] Filters by the selected local date using capture metadata or explicitly corrected dates.
- [ ] Assets with unknown dates are called out and excluded from automatic date filtering until resolved.
- [ ] Watches eligible visual material through Gemini 4 Argon and selects a compact set with visible reasons.
- [ ] Produces a specific story supported by the assets; does not fabricate what happened today.
- [ ] Google Managed Agents invokes actual editing and review tools.
- [ ] Produces a 30-second 9:16 reel (shorter selectable target for the live demo).
- [ ] Remotion polish includes readable titles and restrained motion within reel-safe margins.
- [ ] Reviews the final rendered output; repairs major defects or flags unresolved ones.
- [ ] Displays the source-to-output trail and lets Jerel download the MP4.

## Story B — My SF tech week (stretch within the same product)

**Given** up to 100 local photos/videos across an explicitly selected date range, **when** Jerel chooses My SF tech week, **then** the editor discovers recurring themes and creates a grounded retrospective.

- [ ] Accepts 100 assets without requiring 100 individual annotations.
- [ ] Groups related moments into a narrative rather than making a chronological dump.
- [ ] Reduces duplicate/near-duplicate selections using visual evidence and selection reasons.
- [ ] Distinguishes date-supported chronology from thematic ordering.
- [ ] Produces a 45-second polished reel with a clear opening, progression, and ending.
- [ ] Uses the same managed execution and final-review loop as Story A.
- [ ] Reuses cached analysis and labels reuse in the process trace.

## Cross-cutting acceptance

- [ ] Missing API access produces a clear connection state, not simulated success.
- [ ] A user can cancel a run; completed artifacts remain available and no new local render is started afterward.
- [ ] Import errors preserve successfully imported assets and explain failures.
- [ ] Restarting the server preserves the gallery and completed runs; interrupted runs are marked honestly.
- [ ] Objective validation catches out-of-range cuts, invalid dimensions, duration mismatch, and black gaps.
- [ ] A known crop-error fixture fails review before repair and passes afterward; this is labeled as a deterministic test, not an AI demonstration.
- [ ] No source files, previews, indexes, analysis, or exports are tracked in Git.
- [ ] Key stays server-side; it is never written into the repo or browser storage.
- [ ] Personal footage appears in any published demo or screenshot only after Jerel approves that specific artifact.

## Three-minute judging demonstration

1. **0:00–0:20:** state the user/problem and show the local gallery and selected intent.
2. **0:20–0:50:** show what Argon selected and why; disclose cached analysis if used.
3. **0:50–1:40:** execute a bounded edit/revision live and show real tool events.
4. **1:40–2:20:** play the polished reel and inspect actual verification results.
5. **2:20–3:00:** show source traceability, before/after if a repair occurred, and explain the managed-agent architecture.

Do not guarantee a 100-asset cold run finishes during judging. Measure cold analysis and warm revision times separately. The live demo must execute real work; any pre-rendered material must be identified.
