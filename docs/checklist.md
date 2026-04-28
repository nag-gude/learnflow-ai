# Build Checklist

## Build Preferences

- **Build mode:** Autonomous
- **Comprehension checks:** N/A (autonomous mode)
- **Git:** Commit after each verification checkpoint (every 3-4 items), not per item
- **Verification:** Yes — checkpoints every 3-4 items; agent pauses for learner review before continuing
- **Check-in cadence:** N/A (autonomous mode)

---

## Ordering Principle

> Deterministic system → UI validation → interaction layer → intelligence → streaming → integration

Build structure first, interaction second, intelligence third, streaming last.

---

## Checklist

- [x] **1. Project scaffold + core types**
  Spec ref: `spec.md > Stack` + `spec.md > Data Model > TypeScript Types` + `spec.md > File Structure`
  What to build: Run `create-next-app` with App Router + TypeScript. Install dependencies: `@anthropic-ai/sdk`, `tailwindcss`. Create `src/lib/types.ts` with all shared types: `FlowPhase`, `SubPhase`, `Message`, `LessonStatus`, `Lesson`, `Phase`, `PlanMeta`, `PlanState`, `CoachState`, `SessionState`, `ChatState`, `StatePatch`, `SSEEvent`. Create `.env.example` with `ANTHROPIC_API_KEY=your_key_here` and `.env.local` placeholder. Create `.gitignore` that excludes `.env.local`.
  Acceptance: Project runs with `npm run dev`. TypeScript compiles with no errors. All types in `types.ts` match the spec exactly. `.env.local` is gitignored.
  Verify: Run `npm run dev` — confirm localhost:3000 loads Next.js default page. Run `npx tsc --noEmit` — confirm zero type errors.

- [x] **2. State machine (core reducer)**
  Spec ref: `spec.md > State Management > coachReducer`
  What to build: Create `src/state/coachReducer.ts` with `CoachState` initial state and `applyAction(state, action) → newState`. Implement all 10 actions: `SET_TOPIC`, `SET_PHASE`, `ADD_MESSAGE`, `APPEND_STREAM`, `COMMIT_STREAM`, `INIT_PLAN`, `SET_LESSON_STATUS`, `SET_ACTIVE_LESSON`, `APPLY_STATE_PATCH`, `RECALCULATE_PROGRESS`. Each action must be a pure function — no side effects. `RECALCULATE_PROGRESS` counts completed lessons / total lessons and sets `overallProgress` (0–100).
  Acceptance: Reducer is a pure function. All 10 actions defined. Initial state has `flowPhase: 'topic_entry'`, `subPhase: null`, empty messages, empty plan. `RECALCULATE_PROGRESS` correctly computes percentage from lessonMap. TypeScript compiles with no errors.
  Verify: Run `npx tsc --noEmit` — zero errors. Manually trace through 2-3 action sequences in your head (or add a quick `console.log` test in a scratch file) to confirm state transitions are correct before moving on.

- [x] **3. UI shell (mock data only)**
  Spec ref: `spec.md > Frontend > Page Shell` + `spec.md > Frontend > ChatPanel` + `spec.md > Frontend > PlanPanel` + `spec.md > Frontend > LearningPlan` + `spec.md > Frontend > LessonItem` + `spec.md > Frontend > ChatMessage`
  What to build: Create all 6 UI components using hardcoded mock data — no hooks, no reducer, no AI. `page.tsx`: full-height two-panel layout (`flex h-screen`), `ChatPanel` left 50%, `PlanPanel` right 50%. `ChatPanel.tsx`: render topic input with placeholder "What do you want to learn today?", two hardcoded chat messages (one user, one assistant). `ChatMessage.tsx`: user messages right-aligned, assistant left-aligned, blinking cursor if `status === 'streaming'`. `PlanPanel.tsx`: hardcoded "analyzing" state. `LearningPlan.tsx`: hardcoded plan with topic header, goal, estimated time, progress bar at 34%, two phases with 3 lessons each. `LessonItem.tsx`: render all three status states — ⬜ `not_started`, 🟡 `in_progress`, ✅ `completed` — one active lesson (bold + left border accent).
  Acceptance: Both panels render side by side. Chat shows user + assistant bubbles. Right panel shows a learning plan with phases, lessons, and status icons. Progress bar visible. Active lesson is visually distinct. Layout works at full browser height. No TypeScript errors.
  Verify: Run `npm run dev`, open localhost:3000. Confirm two-panel layout. Confirm all three lesson status icons render. Confirm progress bar. Confirm active lesson highlight. Resize browser — confirm layout holds.

---

> ### Checkpoint 1
> **Before continuing, verify:**
> - [ ] `npx tsc --noEmit` — zero errors
> - [ ] UI renders correctly with mock data (both panels, all lesson states, progress bar)
> - [ ] Reducer state transitions are logically correct
> - [ ] No hooks, no AI yet
>
> **Commit:** `feat: scaffold, types, reducer, UI shell (checkpoint 1)`

---

- [x] **4. Hooks layer (state glue)**
  Spec ref: `spec.md > State Management > useCoach` + `spec.md > State Management > useChatStream` + `spec.md > State Management > usePlanState`
  What to build: Create `src/hooks/useCoach.ts`: holds reducer via `useReducer(applyAction, initialState)`, wires `useChatStream` and `usePlanState` together, exposes `state` and `dispatch`. Create `src/hooks/usePlanState.ts`: thin selector — derives display-ready plan data from `state.plan`, implements `getLessonsForPhase(phase)` by mapping `phase.lessonIds` through `state.plan.lessonMap`. Create `src/hooks/useChatStream.ts`: for now, implement as a mock that dispatches `ADD_MESSAGE` and `APPEND_STREAM` on a timer to simulate streaming — real fetch comes in step 7. No AI calls yet.
  Acceptance: `useCoach` initializes with correct initial state. `usePlanState` returns lessons for a phase in correct order. `useChatStream` mock dispatches simulated stream events. All hooks typed correctly. No TypeScript errors.
  Verify: Run `npx tsc --noEmit` — zero errors. Manually confirm in browser that hooks are importable without runtime errors (even if UI not wired yet).

- [x] **5. Page wiring (real state flow)**
  Spec ref: `spec.md > Frontend > Page Shell` + `spec.md > Frontend > ChatPanel` + `spec.md > Frontend > PlanPanel`
  What to build: Replace all mock/hardcoded data in components with live reducer-driven state from `useCoach`. `page.tsx`: call `useCoach()`, pass `state` and `dispatch` as props to both panels. `ChatPanel.tsx`: render `state.chat.messages`, show streaming bubble when `state.session.isStreaming`, handle topic input submit → `dispatch(SET_TOPIC)`, disable input after submission. `PlanPanel.tsx`: switch display state based on `flowPhase`/`subPhase` — placeholder, analyzing indicator, or `<LearningPlan />`. `LearningPlan.tsx`: render `state.plan` — phases, lessons from `lessonMap`, `overallProgress`. `LessonItem.tsx`: receive `isActive` from `state.plan.activeLessonId` comparison. Wire mock `useChatStream` so submitting a topic triggers simulated streaming response visible in chat.
  Acceptance: Typing a topic and pressing Enter disables the input, triggers simulated streaming in chat, and state transitions are visible. Right panel responds to `flowPhase` changes. Plan renders from state (not hardcoded). Progress bar reflects `overallProgress`. No TypeScript errors.
  Verify: Run `npm run dev`. Type a topic → Enter. Confirm: input disables, simulated assistant message streams in left panel, right panel transitions from placeholder to analyzing to plan. Confirm lesson status icons and progress bar update when mock state changes.

---

> ### Checkpoint 2
> **Before continuing, verify:**
> - [ ] Full UI interaction works end-to-end with simulated data
> - [ ] State transitions are correct across all flow phases
> - [ ] Chat loop simulated (mock streaming visible in UI)
> - [ ] No TypeScript errors
>
> **Commit:** `feat: hooks, page wiring, full UI interaction (checkpoint 2)`

---

- [x] **6. AI layer (logic only)**
  Spec ref: `spec.md > AI / Prompt Layer > prompts.ts` + `spec.md > AI / Prompt Layer > tools.ts` + `spec.md > AI / Prompt Layer > toolHandlers.ts`
  What to build: Create `src/lib/prompts.ts`: export `buildSystemPrompt(subPhase, topic, planState)` returning a string. Implement all three phase prompts exactly as specified — `diagnostic` (2-5 questions, emit `{"action":"generate_plan","ready":true}` when done), `planning` (return JSON plan only, no prose), `quiz` (inject current planState as JSON, use update_plan tool). Create `src/lib/tools.ts`: export `updatePlanTool` Anthropic tool definition with `lessonUpdates` array and `activeLessonId` properties. Create `src/lib/toolHandlers.ts`: export `buildStatePatch(toolBuffer, planState)` — filter to `update_plan` calls, validate each `lessonId` against `planState.lessonMap`, return `StatePatch`. Skip invalid lessonIds with a console warning.
  Acceptance: `buildSystemPrompt` returns correct prompt string for each subPhase. `updatePlanTool` matches Anthropic tool schema format. `buildStatePatch` filters invalid lessonIds and returns correct `StatePatch` shape. No TypeScript errors.
  Verify: Run `npx tsc --noEmit` — zero errors. Spot-check: call `buildSystemPrompt('diagnostic', 'Kubernetes', null)` in a scratch test and confirm the diagnostic prompt appears correctly.

- [x] **7. Streaming API route**
  Spec ref: `spec.md > API Route > /api/chat`
  What to build: Create `src/app/api/chat/route.ts`. Export `maxDuration = 60` (Vercel Hobby streaming timeout). Implement POST handler: parse request body (`flowPhase`, `subPhase`, `messages`, `planState`). Return 500 if `ANTHROPIC_API_KEY` missing. Build system prompt via `prompts.ts`. Build tools array — `[updatePlanTool]` only when `subPhase === 'quiz'`, else `[]`. Call `anthropic.messages.stream()`. Create `ReadableStream` response: for each chunk, pipe `text_delta` events as SSE `data: {"type":"text_delta","delta":"..."}`. Buffer `tool_use` events in `toolBuffer[]`. On stream end: call `buildStatePatch(toolBuffer, planState)`, write `data: {"type":"done","statePatch":{...}}`. On Anthropic API error mid-stream: write `data: {"type":"error","message":"..."}`. Set `Content-Type: text/event-stream` header.
  Acceptance: POST to `/api/chat` with valid body returns a streaming SSE response. `text_delta` events appear during streaming. `done` event appears at stream end with a valid `statePatch`. Missing API key returns 500 before stream opens. No TypeScript errors.
  Verify: Run `npm run dev`. Use curl or a simple fetch in browser console to POST to `localhost:3000/api/chat` with a test body — confirm SSE events stream back. Confirm `done` event contains `statePatch` with correct shape.

---

> ### Checkpoint 3
> **Before continuing, verify:**
> - [ ] Real AI streaming works — text appears token by token
> - [ ] Tool calls are captured and `statePatch` is emitted at stream end
> - [ ] `statePatch` pipeline produces valid lesson updates
> - [ ] No TypeScript errors
>
> **Commit:** `feat: AI prompt layer, streaming API route (checkpoint 3)`

---

- [x] **8. Final UI integration + polish**
  Spec ref: `spec.md > Full Data Flow — Streaming Quiz Response with Tool Call` + `spec.md > Phase Transition Logic`
  What to build: Replace mock `useChatStream` with real fetch implementation. `useChatStream.ts`: POST to `/api/chat` with current state, read `ReadableStream` from response body, parse SSE events line-by-line — `text_delta` → `dispatch(APPEND_STREAM)`, `done` → `dispatch(COMMIT_STREAM)` then `dispatch(APPLY_STATE_PATCH)`, `error` → dispatch error message into chat. Implement signal detection in `useChatStream`: scan response text for `{"action":"generate_plan","ready":true}` → strip from `streamingText`, dispatch `SET_PHASE('planning')`. For `planning` subPhase: parse Claude's JSON response → `dispatch(INIT_PLAN)`. Auto-scroll `ChatPanel` to bottom on new messages. Confirm `PlanPanel` updates are non-intrusive (don't interrupt chat).
  Acceptance: Full end-to-end flow works with real Claude. Topic entry triggers diagnostic questions. Coach emits plan signal → right panel transitions to plan. Quiz loop begins automatically after plan renders. Lesson status icons update as quiz progresses. Progress bar increments. Coach weakness signal appears in chat after 2+ wrong answers on same concept. Completion message ends the session cleanly.
  Verify: Run `npm run dev`. Enter "Teach me Kubernetes". Walk through the full session arc: diagnostic → plan → quiz. Confirm: plan appears in right panel, lessons update automatically, progress bar moves, session ends with a completion message.

- [x] **9. Vercel deployment**
  Spec ref: `spec.md > Runtime & Deployment`
  What to build: Push code to `https://github.com/nag-gude/learnflow-ai`. Go to vercel.com, import the GitHub repo, deploy with default Next.js settings. In Vercel project settings → Environment Variables, add `ANTHROPIC_API_KEY` with the real key. Trigger a redeploy. Confirm the live URL works end-to-end. Confirm `maxDuration = 60` is set in `route.ts` (prevents Hobby tier timeout on long streams).
  Acceptance: Live Vercel URL loads the app. Full session arc (topic → diagnostic → plan → quiz) completes on production without timeout or errors. ANTHROPIC_API_KEY is not visible in the repo or build output.
  Verify: Open the live Vercel URL in an incognito window. Run the full Kubernetes demo flow end-to-end. Confirm it works identically to local dev. Check Vercel function logs for any errors.

---

> ### Checkpoint 4
> **Before continuing, verify:**
> - [ ] Live working system on Vercel
> - [ ] Full session arc works end-to-end on production
> - [ ] No API key exposed in repo
>
> **Commit:** `feat: real streaming integration, Vercel deployment (checkpoint 4)`

---

- [ ] **10. Devpost submission**
  Spec ref: `prd.md > What We're Building`
  What to build: Go to the hackathon Devpost page and create your submission. Project name: LearnFlow AI (or your preferred name). Tagline: "We turned an LLM into a deterministic learning system using a state machine + tool-based curriculum control." Project description: use `docs/scope.md` and `docs/prd.md` as source material — explain what you built, why the interrogation-first flow matters, and what the state machine approach produces that free-chat LLMs don't. Built-with tags: Next.js, TypeScript, Tailwind CSS, Anthropic Claude, Vercel. Screenshots: (1) topic entry screen, (2) diagnostic phase in progress, (3) learning plan rendered in right panel, (4) quiz loop with lesson status updates. Upload `docs/` folder artifacts (scope, PRD, spec, checklist) as supplementary materials. Link GitHub repo: `https://github.com/nag-gude/learnflow-ai`. Link live Vercel URL. Review all fields and submit.
  Acceptance: Submission is live on Devpost with project name, tagline, description, built-with tags, screenshots (minimum 3), docs artifacts, repo link, and live URL. All required fields complete.
  Verify: Open your Devpost submission page — confirm the green "Submitted" badge appears. Read the project description aloud — would a judge who knows nothing about your project understand what it does and why the state machine approach is the differentiator?
