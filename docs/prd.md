# Learning Coach — Product Requirements

## Problem Statement

Working engineers learning something new on the side have partial knowledge that generic tutorials ignore — so they sit through content they already know and never get to the gaps that actually matter. This app interrogates what the learner already knows before teaching anything, generates a personalized plan from that assessment, and runs a Socratic quiz loop that adapts in real time. The payoff: 20 focused minutes that actually move the needle, not another tutorial the learner abandons halfway through.

---

## User Stories

### Epic: Topic Entry

- As a working engineer starting a new learning session, I want to tell the app what I want to learn so that I can begin immediately without setup or configuration.
  - [ ] On load, the left panel shows the message "What do you want to learn today?" with a text input below it
  - [ ] The right panel shows a placeholder: "Your learning plan will appear here"
  - [ ] The learner types a topic and presses Enter to begin — no buttons required, but Enter submits
  - [ ] The input is disabled after submission so the learner can't re-trigger mid-session

- As a learner who types something that isn't a real learning topic, I want the coach to redirect me rather than fail or try to teach nonsense so that I can get to something productive.
  - [ ] If the topic is not a recognizable learning subject (e.g., "pizza", random words), the coach responds in the chat with a warm redirect: "That doesn't look like a learning topic — what skill or subject are you trying to get better at?"
  - [ ] The coach does not reject the input with an error message
  - [ ] The right panel remains in placeholder state until a valid topic is confirmed
  - [ ] After the learner provides a valid topic, the diagnostic phase begins normally

---

### Epic: Diagnostic Assessment

- As a learner with partial knowledge, I want the coach to ask me targeted questions before building my plan so that the plan reflects what I actually know, not what a generic curriculum assumes.
  - [ ] The coach asks a minimum of 2 and maximum of 5 diagnostic questions before generating the plan
  - [ ] The number of questions is determined by the coach, not the learner — the coach stops when it has sufficient signal on: skill level, learning goal, and time/depth constraints
  - [ ] Questions appear one at a time in the left chat panel
  - [ ] The right panel shows a subtle "Analyzing your background..." indicator during this phase — no partial plan content is shown
  - [ ] After the final diagnostic answer, the indicator transitions to plan generation

- As a learner who isn't sure how to answer a diagnostic question, I want the coach to help me rather than get stuck so that the session doesn't stall on my uncertainty.
  - [ ] If the learner gives an evasive or minimal answer (e.g., "I don't know", "not sure") to one question, the coach acknowledges it and tries a different angle: "No worries — let me ask it a different way..."
  - [ ] If the learner gives minimal answers to two or more consecutive questions, the coach makes a reasonable assumption and states it: "I'll assume you're starting from the basics — we can adjust as we go"
  - [ ] The coach never expresses frustration or repeats the same question verbatim
  - [ ] The diagnostic phase completes and plan generation begins regardless — the coach never gets permanently stuck

---

### Epic: Learning Plan Generation

- As a learner who has answered the diagnostic questions, I want to see a structured, personalized learning plan so that I understand exactly what I'll be covering and how long it will take.
  - [ ] Once the coach has enough diagnostic signal, it generates and displays the plan in the right panel
  - [ ] The plan header shows: topic name, inferred learning goal, estimated time per session, estimated total duration, and overall progress (starting at 0%)
  - [ ] The plan body is organized into named phases (e.g., Phase 1: Foundations, Phase 2: Core Concepts)
  - [ ] Each phase shows a list of lessons with a status indicator: ⬜ Not started, 🟡 In progress, ✅ Completed
  - [ ] Each phase shows a lesson count (e.g., "0/3 lessons completed")
  - [ ] A top-level progress bar reflects overall completion across all phases
  - [ ] The plan is read-only — the learner cannot click, edit, or reorder it
  - [ ] Immediately after the plan renders, the coach starts the quiz loop in the left panel without waiting for learner input

---

### Epic: Socratic Quiz Loop

- As a learner working through my personalized plan, I want the coach to ask me questions and respond to my answers in a way that builds understanding, not just checks recall so that I actually learn rather than just pass a test.
  - [ ] The coach begins the quiz loop immediately after the learning plan renders — no trigger required from the learner
  - [ ] The coach asks questions one at a time in the left chat panel
  - [ ] The coach uses one of three response modes based on answer quality:
    - **Correct:** Coach affirms and deepens — asks a follow-up that extends the concept further
    - **Partially correct:** Coach acknowledges what's right, clarifies the gap, then asks a nudging follow-up
    - **Incorrect:** Coach gives a brief explanation of what's actually true, then retries the original question or a close variant
  - [ ] All quiz interaction — questions, answers, feedback — happens exclusively in the left panel
  - [ ] The right panel does not change during quiz interaction except to reflect progress updates (see Plan Progress Tracking)

- As a learner who is struggling with a concept, I want the coach to notice and say something in the moment so that I don't leave with unaddressed gaps.
  - [ ] If the learner gives incorrect or partially correct answers to the same concept two or more times, the coach surfaces a conversational weakness signal: e.g., "You've missed this one a couple times — let's slow down on [concept] before moving forward"
  - [ ] The weakness signal appears in the left chat panel only — not in the right panel
  - [ ] This is a single-session signal only — nothing is stored between sessions
  - [ ] After the weakness signal, the coach continues teaching rather than ending the session

- As a learner finishing the quiz loop, I want the coach to clearly signal that the session is complete so that I know I'm done and what I accomplished.
  - [ ] When the coach determines the learner has covered the core concepts, it sends a clear completion message: e.g., "You've worked through the core of Kubernetes — here's what you covered today: [summary]"
  - [ ] The learner does not trigger completion — the coach decides based on coverage and answer quality
  - [ ] The right panel reflects 100% (or the achieved %) completion at session end
  - [ ] No redirect, new session prompt, or next-steps CTA is required — the session simply ends cleanly

---

### Epic: Plan Progress Tracking

- As a learner going through the quiz loop, I want to see my learning plan update automatically as I progress so that I can track momentum without interrupting the session.
  - [ ] When the coach determines a lesson is covered (based on quiz interaction), it updates the lesson status in the right panel automatically
  - [ ] Status transitions: ⬜ → 🟡 (lesson started) → ✅ (lesson completed)
  - [ ] The overall progress bar and per-phase lesson counts update in real time as lessons complete
  - [ ] The learner does not manually mark lessons complete — the coach owns all status updates
  - [ ] The right panel updates are visible but non-intrusive — they do not interrupt or overlay the chat

---

## What We're Building

1. **Topic entry screen** — two-panel layout on load, "What do you want to learn?" prompt, Enter to submit, graceful redirect for invalid topics
2. **Diagnostic phase** — 2-5 AI-driven questions, right panel shows thinking indicator, evasive-answer escalation
3. **Learning plan** — phases, lessons, status icons, progress bar, header with goal/time/duration — renders in right panel, read-only
4. **Quiz loop** — three Socratic response modes (correct/partial/incorrect), in-the-moment weakness signal in chat, coach-driven completion signal
5. **Live plan updates** — coach automatically updates lesson status and progress bar as the quiz loop progresses

---

## What We'd Add With More Time

- **Cross-session persistence** — save progress so the learner can resume where they left off
- **Weakness detection dashboard** — a structured view of concepts the learner has consistently missed, built from session history
- **Daily guidance / streaks** — "Today's goal: 2 lessons" based on multi-session tracking
- **Lesson click-through** — clicking a lesson in the right panel shows a structured lesson brief (explanation + key takeaways) without leaving the session flow
- **GCP deployment** — production deployment beyond local dev

---

## Non-Goals

1. **Multi-session persistence** — no saving progress, history, or state between sessions. Single-session scope only.
2. **User accounts / authentication** — no login, no profiles, no multi-user support. Single anonymous user per session.
3. **Weakness detection dashboard** — no cross-session analysis of repeated gaps. In-session conversational signal only.
4. **Daily guidance** — no streak tracking, goals tied to a calendar, or session scheduling.
5. **Pre-built curriculum library** — learner types any topic; no curated topic catalog, no predefined lesson content.

---

## Open Questions

| Question | When to resolve |
|---|---|
| How does the coach signal which lesson is "in progress" vs "not started" — does it update to 🟡 the moment the first question for that lesson is asked? | Before /spec |
| Should the right panel show which lesson the coach is currently quizzing on (highlighted or bolded)? | Before /spec |
| What's the streaming behavior — does the coach's chat response stream in token by token, or appear all at once? | Before /spec — affects API integration approach |
| What happens if the learner closes the browser mid-session and comes back? Dead state or reset? | Can wait until build — answer is likely "reset" given no persistence |
