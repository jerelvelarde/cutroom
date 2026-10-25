# Gemini 4 Argon SF Hackathon

Research and preparation for the **Cerebral Valley × Google DeepMind** hackathon on **October 25, 2026**, in San Francisco. This document records event research. The repository now also contains the Cutroom prototype; see the root README for setup and current verification status.

**Submission deadline: October 25 at 5:00 PM PDT.** Build a working product in at least one of the two official tracks, make the repository public, and submit an accessible **one-minute demo video**. The live judging demo is approximately **three minutes, without slides**, followed by **one to two minutes of Q&A**. [Participant guide][guide]

Verified October 25, 2026 against the event listing, participant guide, and linked Google builder guide. Event-day announcements may supersede this snapshot. Technical details below are documented guidance, not claims of tested API access in this repository.

## Event at a glance

| Item | Details |
| --- | --- |
| Hosts | Cerebral Valley and Google DeepMind |
| Date | Sunday, October 25, 2026 |
| Hours | 9:00 AM–10:00 PM PDT; submissions close at 5:00 PM |
| Venue | SHACK15, 1 Ferry Building, Suite 201, San Francisco, CA 94111 |
| Attendance | In person; every attendee must apply and be approved |
| Team size | 1–4 people |
| Check-in | Second-floor front desk; bring government-issued photo ID |
| Community | [Hackathon Discord][discord] |
| Submission | [Cerebral Valley project submission][submit] |

The event lists Ivan Leo as a speaker and Joana Carrasqueira, Shudhatma Jain, Subhasmita Sahoo, and Oskar Yao from Google as final-round judges. Attendance approval is separate from creating this repository. [Event listing][event] · [Participant guide][guide]

## The two official tracks

### 1. Million Token Engineering

Tackle software work that is difficult because of its scale: legacy migrations, language translations, framework upgrades, or coordinated changes across many files. Keep interfaces consistent and **measure improvement against a baseline**. The intended demonstration is sustained engineering work with evidence that the result is correct. [Participant guide][guide]

**Suggested project direction:** a migration agent that takes a bounded legacy repository, records failing or baseline checks, updates multiple modules, runs the application and tests, and presents the verified diff. This is an interpretation of the track, not an organizer-provided project assignment.

### 2. More Dimensions

Build with video understanding, 3D generation, procedural worlds, or games. The essential loop is **generate → render → observe → critique → fix**. A visually impressive first draft alone misses the track's emphasis on iterative verification. [Participant guide][guide]

**Suggested project direction:** a scene repair agent that generates a small Three.js world from a reference, renders it, checks geometry or behavior against explicit constraints, and visibly repairs a defect. This is a proposed approach, not an official requirement to use Three.js.

## Judging criteria

| Criterion | First round | Final round | Evidence to show |
| --- | ---: | ---: | --- |
| Working live demo | 50% | 25% | Runs with real inputs; effective Argon, Managed Agents, or companion-model use; a real verification loop |
| Problem and usefulness | 25% | 25% | A concrete problem for a specific user in an official track; usefulness after the event |
| Originality | 15% | 25% | A capability enabled by long context, long decode, advanced reasoning, or multimodal orchestration |
| Clarity of pitch | 10% | 25% | A clear user and working product demonstrated within three minutes without slides |

The **top six teams** advance to the on-stage final. Both rounds use approximately three minutes of live demo and one to two minutes of Q&A. The final uses equal category weights. [Participant guide][guide]

**Practical implication:** finish a reliable end-to-end loop before expanding features. Show the initial state, the agent's work, the check it runs, and the improved result. Keep the core demonstration short enough to run live; do not make judges wait for a long generation job.

## Rules and submission requirements

- Repositories must be **public**.
- Teams must have **one to four members**, with every attendee approved.
- Demonstrate only the features, code, and functionality built during the hackathon. Clearly distinguish new contributions from any prior code, dependencies, or assets; obscuring this can cause immediate disqualification.
- Do not present an existing project as new event work.
- Use only code, data, and assets you have rights to use; comply with legal, ethical, and platform requirements.
- Submit an accessible **one-minute demo video**, verify repository/demo access, and add all team members to the submission page. [Participant guide][guide]

The guide's **Projects to Avoid** list includes mental-health advisors, basic RAG apps, Streamlit apps, image analyzers, generic education chatbots, job-application screeners, nutrition coaches, personality analyzers, medical-advice generators, dashboard-centered projects, and sports analyzers/coaches. Treat this as a strong project-selection constraint. [Participant guide][guide]

## Technology: what matters for this hackathon

The organizer-linked [Google builder guide][builder] identifies **`gemini-4-argon`** as the lead model for extended software engineering, reasoning, multimodal creation, and orchestration.

### Context, output, and API behavior

| Topic | Builder-guide guidance | Why it matters |
| --- | --- | --- |
| Context window | Input, thinking, and output share **1M tokens** | Do not budget 1M input plus a separate 1M output |
| Endpoint | **Interactions API** recommended for new projects | One interface for models and managed agents |
| SDKs | Python `google-genai` or JavaScript/TypeScript `@google/genai`, **2.3.0+** | Older examples may use obsolete parameters |
| Reasoning | `thinking_level`: `low`, `medium` (default), or `high` | Use medium for interactive work; high for difficult design/debugging |
| Default output limit | **65,536 tokens** on Interactions API | Long output requires explicit configuration |
| Long decode | `background=True` and `max_output_tokens > 65536` | Poll the interaction; leave room for input and thinking within the shared budget |
| Conversation state | `previous_interaction_id` | Continue using server-side interaction state |
| Legacy settings | Replace `thinking_budget`; remove custom `temperature`, `top_p`, and `top_k` | The guide says these settings are deprecated or ignored for Argon |
| Caching | Automatic implicit context caching | The guide says explicit `cached_content` calls should be removed |
| Long tasks | Background execution or longer client timeouts | Complex high-reasoning calls can outlast ordinary request timeouts |

The participant guide describes output extending toward one million tokens. The builder guide provides the important qualification: this is a **shared** input/thinking/output budget, not an independent output allowance. [Participant guide][guide] · [Google builder guide][builder]

### Managed Agents

The guide names **`antigravity-preview-09-2026`**, configured with **`gemini-4-argon`**, as the Antigravity managed agent. It provisions a Google-hosted Linux sandbox where the agent can write code, execute tests, manage files, search the web, and call MCP tools.

This is relevant to both the engineering track and the **$5,000 Best Use of Managed Agents** prize. Demonstrate execution and verification, not just a generated plan. For integrations that require secrets, the guide recommends the Credentials API and a restricted sandbox network allowlist. Keep people in control of consequential external actions. [Google builder guide][builder] · [Participant guide][guide]

### Companion models

Use companions only when they serve the product. These identifiers come from the event's builder guide; confirm availability in the provisioned account before depending on them.

| Job | Model / agent ID |
| --- | --- |
| Fast parallel tasks and tool calls | `gemini-3.8-flash` |
| Lightweight routing and checks | `gemini-3.5-flash-lite` |
| Background research with citations | `deep-research-preview-04-2026` |
| Real-time voice and camera | `gemini-3.8-live` |
| Speech generation | `gemini-3.8-flash-tts` |
| Images, textures, sprites | `gemini-nano-banana-2.1` |
| Video with synchronized audio | `gemini-omni-1.1-flash` |
| Music | `lyria-3.5` |
| Open-weight model option | `gemma-4-31b-it` |

Source: [Google builder guide][builder]. The guide also lists specialized transcription, translation, and lower-latency variants.

### Getting started

1. Claim the **pre-provisioned account** from the Google team and confirm credit allocation and model access.
2. Use [AI Studio Build](https://aistudio.google.com/build), [Google Antigravity](https://antigravity.google), or the official Gemini SDK.
3. Consult the [Gemini API skills](https://github.com/google-gemini/gemini-skills), especially `gemini-api-dev` and, if needed, `gemini-live-api-dev`.
4. Make a small Argon request, then verify the exact managed-agent or companion-model path needed by the demo.
5. Define a baseline and pass/fail checks before launching a large build. Ask the onsite Google mentors for help when blocked. [Google builder guide][builder]

## Benefits you can get

### Published event benefits

| Benefit | Value / availability | How to pursue it |
| --- | --- | --- |
| First-place prize | **$7,500 cash** for the winning team | Compete in the judged event |
| Second-place prize | **$5,000 cash** for the team | Compete in the judged event |
| Third-place prize | **$2,500 cash** for the team | Compete in the judged event |
| Best Use of Managed Agents | **$5,000 cash** | Build a meaningful managed-agent workflow |
| Development credits | Provided on the day; **amount and expiration not specified** in the participant guide | Ask the Google team for allocation and redemption details |
| Provisioned account | Builder guide instructs participants to claim one at kickoff | Collect it from the Google team and verify access |
| Technical support | Google team onsite; mentors available for blockers | Bring a reproducible issue or specific architecture question |
| Meals | Breakfast, lunch, and dinner on the schedule | Attend the in-person event |
| Community and feedback | Team matching, Discord, and judging; stage exposure for six finalists | Meet builders, show working results, collect feedback |

Sources: [Event listing][event], [participant guide][guide], and [Google builder guide][builder]. The **$20,000** is the total prize pool, not an individual participation payment. Prize stacking, payout timing, credit amounts, and credit expiration are not established by the reviewed materials.

### Practical upside beyond winning

These are potential outcomes, not organizer guarantees:

- **A stronger technical portfolio:** a public repo, short demo, and measurable before/after result can demonstrate agent engineering and product judgment.
- **Reusable implementation knowledge:** learn long-running Interactions API jobs, verification loops, model orchestration, and managed execution through a working build.
- **Product validation:** test whether a specific user actually values the completed task; capture feedback and a concrete next experiment.
- **Relationships:** meet Google engineers and other builders through technical questions, collaboration, and demos.
- **A useful follow-up artifact:** turn the submission into a concise case study covering the problem, architecture, evidence, limitations, and new work completed during the event.

### Costs and limits to confirm

Google's October 13 announcement lists introductory Argon pricing of **$2 per million input tokens** and **$10 per million output tokens**, with a **95% discount on cached input**, through November 30, 2026. It lists subsequent rates of **$4 input / $20 output per million tokens**. These are public model prices, not a promise that hackathon credits cover all usage or companion/sandbox costs. [Google launch announcement][launch]

Before running long jobs, confirm the provisioned account's budget, quotas, supported models, and any separate managed-agent charges. A large context window is a capacity limit, not a target to spend on every call.

## Schedule — all times PDT, October 25, 2026

| Time | Activity |
| --- | --- |
| 9:00 AM | Doors open; breakfast |
| 10:00 AM | Welcome and kickoff |
| 10:30 AM | Hacking begins |
| 1:00 PM | Lunch |
| **5:00 PM** | **Project submissions due** |
| 5:00–7:00 PM | First-round judging |
| 6:00 PM | Dinner |
| 7:00–8:00 PM | Final-round judging |
| 8:15 PM | Winners announced |
| 10:00 PM | Doors close |

Source: [Participant guide][guide]. The event-page announcement also reiterates the 5:00 PM submission deadline.

## Build and submission checklist

- [ ] Confirm attendance approval and team roster (maximum four).
- [ ] Claim the provisioned account; verify credits, quotas, and API access.
- [ ] Select at least one track and name the exact user/problem.
- [ ] Record the starting baseline and distinguish any prior work.
- [ ] Build one complete workflow with a real verification loop.
- [ ] Record measurable results: for example tests passing, migration coverage, or scene constraints satisfied.
- [ ] Keep credentials, private data, and venue access credentials out of commits.
- [ ] Add project setup instructions, architecture, limitations, and event-built contributions to this README.
- [ ] Verify the repository is public and demo links work without your login.
- [ ] Record the one-minute submission video.
- [ ] Add all team members and submit by **5:00 PM PDT** through the [submission page][submit].
- [ ] Rehearse a three-minute live demo with real input and prepare for Q&A.

Suggested demo sequence: **user/problem → real input → agent execution → verification → measured result → why Argon enabled it**. This is preparation advice, not an additional official rule.

## Sources and resources

1. [Official event listing][event] — hosts, prizes, speakers/judges, admission, announcements.
2. [Participant guide][guide] — tracks, rules, schedule, rubric, submission, credits.
3. [Google DeepMind hackathon builder guide][builder] — model IDs, SDK/API guidance, provisioned account, mentors.
4. [Gemini 4 Argon launch announcement][launch] — public availability, capabilities, and pricing.
5. [Argon developer guide](https://aistudio.google.com/learn/gemini-4-argon-developer-guide) — linked by the builder guide.
6. [3D games and worlds guide](https://aistudio.google.com/learn/building-3d-games-and-worlds-with-gemini-4-argon) — linked by the participant guide.
7. [Gemini API documentation](https://ai.google.dev/gemini-api/docs), [cookbook](https://github.com/google-gemini/cookbook), and [Live API examples](https://github.com/google-gemini/gemini-live-api-examples).
8. [Hackathon Discord][discord] — announcements, team search, questions, Google DeepMind channel.

This is an independently prepared reference, not an official organizer publication. Refer to the linked guides and event-day announcements for changes.

[event]: https://cerebralvalley.ai/e/gemini-4-argon-sf
[guide]: https://cerebralvalley.ai/e/gemini-4-argon-sf/details
[builder]: https://docs.google.com/document/d/1kN0n6hPNNTIHMVqf5-hDACrZuIg4KFrWiYpla4WQW8w/edit
[submit]: https://cerebralvalley.ai/e/gemini-4-argon-sf/hackathon/submit
[discord]: https://discord.gg/Qr5KBzGm
[launch]: https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-argon/
