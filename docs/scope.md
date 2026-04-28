# Learning Coach

## Idea
An AI tutor that interrogates the learner's prior knowledge first, then builds a personalized learning plan and runs a Socratic quiz loop — flipping the traditional "here's a syllabus" model on its head.

## Who It's For
Working engineers learning something new on the side — someone who has 20 minutes, not 3 hours, and wants to actually retain what they learn. They're not starting from zero; they have partial knowledge the system needs to discover before it can teach them anything useful.

## Inspiration & References
- [Khanmigo](https://www.khanmigo.ai/) — AI tutor that asks guiding questions instead of giving answers. Differentiated from this project: doesn't assess prior knowledge before building a plan.
- [DeepTutor](https://github.com/HKUDS/DeepTutor) — Agent-native learning assistant with quiz generation. Differentiated: document-focused, no interrogation-first flow.
- [Dartmouth knowledge mapping research](https://home.dartmouth.edu/news/2026/03/new-technique-maps-what-students-know-using-short-quizzes) — scientific validation that short quizzes can map conceptual knowledge topology. Underpins the quiz + feedback loop approach.

Design energy: clean and functional. No visual flourishes — the intelligence IS the UI.

## Goals
- Demonstrate spec-driven development as a repeatable workflow for building Claude agents.
- Build something judges can experience the full arc of in under 2 minutes: enter a topic → get assessed → see a plan → get quizzed.
- Show that structured prompting (state-machine style) produces a qualitatively different agent than free-chat LLM calls.

## What "Done" Looks Like
A working web app with two panels:
- **Left:** Chat interface where the coach interrogates the learner, runs the quiz, and gives Socratic feedback.
- **Right:** A living learning plan that updates in real time — showing what's covered, what's next, what needs more work.

Demo flow using "Teach me Kubernetes":
1. Learner types their topic.
2. Coach asks diagnostic questions ("Have you worked with Docker before?").
3. Coach generates a personalized learning plan (visible in right panel).
4. Quiz loop begins — coach asks questions, learner answers, coach responds Socratically ("Interesting — what made you think that? Here's what's actually happening...").
5. Plan updates as learner progresses.

## What's Explicitly Cut
- **Weakness detection dashboard** — requires session history to feel smart; would feel gimmicky in a 3-4 hour build. Cut entirely.
- **Multi-session persistence** — no saving progress across sessions. Single-session scope only.
- **Multiple users / auth** — no login, no accounts. Single-user demo.
- **Curriculum library** — learner types any topic; no pre-built content or topic catalog.

## Loose Implementation Notes
**Frontend:** Next.js / React. Split-panel layout — left chat, right plan. ChatGPT-style chat UI.

**Backend:** API route (Node or Python) that calls Claude.

**AI Logic — the core differentiator:** Structured prompting with an explicit state machine, not free chat. System prompt defines discrete steps:
```
You are an AI tutor.
Step 1: Ask a diagnostic question about prior knowledge.
Step 2: Wait for user answer.
Step 3: Evaluate the answer and update the learning plan.
Step 4: Adapt next question or move to quiz based on assessment.
```

The agent knows what phase it's in (diagnostic → plan generation → quiz loop) and routes accordingly. This structured approach is what makes the coach feel pedagogically deliberate, not just "Claude with a system prompt."

**Deployment:** GCP available if time permits.
