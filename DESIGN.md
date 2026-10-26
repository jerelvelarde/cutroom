# Cutroom interface

Mode: Operate. Preserve the familiar source-bin / canvas-and-timeline / inspector-and-copilot model. Photos and rendered video lead; interface chrome recedes. This refinement applies the Impeccable polish and Operate guidance to the existing Google Photos-inspired minimal interface.

- White main surface, cool neutral secondary surfaces, charcoal video canvas.
- Foreground #20242b; secondary #646d78; separators #e4e7eb; secondary surface #f5f6f8; primary action/selection #245fe8.
- System sans-serif for Mac-native readability. Body 14px, controls 12–13px, workspace title 22px, story title 26px. Compact asset metadata may be 11px. Visible keyboard focus uses a 3px #86aaff outline.
- 4/8/12/16/24px spacing rhythm; related controls grouped; sections separated by whitespace or one divider. No nested decorative cards.
- 7–9px control and panel radii. Buttons remain rectangular, with one primary action per local decision.
- Desktop: compact project toolbar; independently scrollable library, workspace, and chat. Tablet collapses library into a horizontal filmstrip. Mobile stacks work areas without horizontal overflow.
- Editing: actual rendered preview, ordered thumbnail timeline, saved-version selector, and one New video entry point. The agent is the primary editing surface. Manual shot adjustments stay inside a collapsed disclosure with an explicit draft/apply distinction. The optional library can be hidden without losing selected footage; its visibility persists.
- Planning: main story, photo sequence with per-shot explanation, optional generated visual canvas/code, expandable alternative angles and caption.
- Chat: real CopilotKit conversation for creating a first or fresh video, revisions, story planning, export, and workspace controls. A new-video workspace never falls back to an older reel. Actual tool receipts show live render/review state, actionable errors and MP4 downloads; no simulated work or hidden reasoning. Composer remains visible. New video starts a fresh conversation while archiving the prior messages locally.
- Motion supports state changes only, 150ms transitions, reduced-motion support.

Verification: render desktop and narrow layouts, exercise real controls, inspect accessibility names and browser errors. Mechanical detection complements visual review.
