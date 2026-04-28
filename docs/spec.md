# Learning Coach — Technical Spec

## Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16 (App Router) | One repo handles frontend + API routes. No separate backend. |
| Language | TypeScript (strict) | Typed state machine + tool schemas catch class of bugs before build. |
| Styling | Tailwind CSS | Utility-first, fast to iterate, no CSS files to manage. |
| AI | Anthropic SDK (`@anthropic-ai/sdk`) | Native streaming + tool use support. |
| Deployment | Vercel (Hobby tier) | Zero-config Next.js deploys, free, global CDN. |

**Documentation links:**
- Next.js 16 App Router: https://nextjs.org/docs/app
- Next.js 16 upgrade guide: https://nextjs.org/docs/app/guides/upgrading/version-16
- Anthropic TypeScript SDK: https://platform.claude.com/docs/en/api/sdks/typescript
- Anthropic streaming + tool use: https://github.com/anthropics/anthropic-sdk-typescript/blob/main/helpers.md
- Vercel deployment: https://vercel.com/docs
- Vercel Hobby plan limits: https://vercel.com/pricing (100GB bandwidth, 1M edge requests/month)

---

## Runtime & Deployment

- **Runtime:** Node.js (via Vercel serverless functions)
- **Deployment target:** Vercel — live deployed URL for hackathon submission
- **Local dev:** `npm run dev` on `localhost:3000`
- **Environment variables required:**
  - `ANTHROPIC_API_KEY` — set in Vercel project settings + local `.env.local`
- **Model:** `claude-sonnet-4-6` (balance of quality and speed for real-time streaming)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                    │
│                                                             │
│  ┌──────────────────┐    ┌──────────────────────────────┐  │
│  │   ChatPanel      │    │        PlanPanel             │  │
│  │  (left panel)    │    │       (right panel)          │  │
│  │                  │    │                              │  │
│  │  topic input     │    │  placeholder →               │  │
│  │  chat messages   │    │  "Analyzing..." →            │  │
│  │  streaming text  │    │  live learning plan          │  │
│  └────────┬─────────┘    └──────────────────────────────┘  │
│           │                          ▲                      │
│           │         coachReducer     │                      │
│           │    (single source of     │                      │
│           │     truth for all state) │                      │
│           │         ┌────────────────┘                      │
│           │         │                                       │
│      useCoach.ts (thin orchestrator)                        │
│      useChatStream.ts | usePlanState.ts                     │
└───────────┼─────────────────────────────────────────────────┘
            │
            │  POST /api/chat
            │  { flowPhase, subPhase, messages, planState }
            ▼
┌─────────────────────────────────────────────────────────────┐
│  Next.js Route Handler — /api/chat/route.ts                 │
│                                                             │
│  1. Build system prompt (prompts.ts, keyed by subPhase)    │
│  2. Attach tools[] only when subPhase === 'quiz'           │
│  3. Call anthropic.messages.stream()                        │
│  4. Stream text_delta events → client as SSE               │
│  5. Buffer tool_use events → toolBuffer[]                  │
│  6. On stream end: validate + apply toolBuffer             │
│  7. Generate STATE_PATCH                                    │
│  8. Send final SSE event: { type: 'done', statePatch }     │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│  Anthropic API (claude-sonnet-4-6)                          │
│  Streaming response with optional tool_use events           │
└─────────────────────────────────────────────────────────────┘
```

---

## Frontend

### Page Shell

**File:** `src/app/page.tsx`

Implements `prd.md > Topic Entry` (initial layout).

Renders the two-panel layout side by side. Hosts the `useCoach` hook and passes state + dispatch down to `ChatPanel` and `PlanPanel`. No logic of its own — pure composition.

```tsx
// Layout: full-height, two equal columns
<main className="flex h-screen">
  <ChatPanel ... />   {/* left, 50% */}
  <PlanPanel ... />   {/* right, 50% */}
</main>
```

---

### ChatPanel

**File:** `src/components/ChatPanel.tsx`

Implements `prd.md > Topic Entry`, `prd.md > Diagnostic Assessment`, `prd.md > Socratic Quiz Loop`.

Responsibilities:
- On initial load (`flowPhase === 'topic_entry'`): renders the topic input with placeholder "What do you want to learn today?" and an Enter-to-submit handler.
- After topic submitted: input is disabled (no re-trigger mid-session).
- Renders `ChatMessage` for each message in `state.chat.messages`.
- Renders the in-progress streaming bubble using `state.chat.streamingText` while `isStreaming === true`.
- Auto-scrolls to bottom on new messages.

```tsx
// Streaming bubble — shown only during isStreaming
{state.session.isStreaming && (
  <ChatMessage role="assistant" content={state.chat.streamingText} status="streaming" />
)}
```

---

### ChatMessage

**File:** `src/components/ChatMessage.tsx`

Renders a single message bubble. Props: `role`, `content`, `status?`.

- User messages: right-aligned, distinct background.
- Assistant messages: left-aligned.
- `status === 'streaming'`: shows blinking cursor after content.
- `status === 'final'`: static render.

---

### PlanPanel

**File:** `src/components/PlanPanel.tsx`

Implements `prd.md > Learning Plan Generation`, `prd.md > Plan Progress Tracking`.

Three display states driven by `flowPhase` / `subPhase`:

| State | Condition | Content |
|---|---|---|
| Placeholder | `flowPhase === 'topic_entry'` | "Your learning plan will appear here" |
| Analyzing | `subPhase === 'diagnostic'` | Subtle "Analyzing your background..." indicator |
| Live plan | `subPhase === 'quiz'` or plan initialized | Renders `<LearningPlan />` |

Right panel is **read-only** — no click handlers on lessons.

---

### LearningPlan

**File:** `src/components/LearningPlan.tsx`

Implements `prd.md > Learning Plan Generation`.

Renders the plan header and phase/lesson structure:

```
[Topic Name]
Goal: [inferred learning goal]
Estimated time: [X min/session · Y sessions total]
Overall progress: [████░░░░] 34%

Phase 1: Foundations          0/3 lessons
  ⬜ What is Kubernetes?
  ⬜ Pods and Nodes
  ⬜ The Control Plane

Phase 2: Core Concepts        0/4 lessons
  ...
```

Receives `plan` from `usePlanState`. Iterates `plan.phases` for display order; lookups go through `plan.lessonMap` for O(1) status reads.

---

### LessonItem

**File:** `src/components/LessonItem.tsx`

Implements `prd.md > Plan Progress Tracking` (status icons + active highlight).

Props: `lesson: Lesson`, `isActive: boolean`.

- Status icons: ⬜ `not_started` · 🟡 `in_progress` · ✅ `completed`
- `isActive === true`: visually highlighted (e.g., bold text + left border accent)
- No click handler — display only.

---

## State Management

### coachReducer

**File:** `src/state/coachReducer.ts`

The single source of truth for all app state. Pure function: `applyAction(state, action) → newState`. Three state domains:

```typescript
type CoachState = {
  session: SessionState
  chat: ChatState
  plan: PlanState
}

// Session — phase routing + loading flags
type SessionState = {
  flowPhase: 'topic_entry' | 'active_learning' | 'complete'
  subPhase: 'diagnostic' | 'planning' | 'quiz' | null
  topic: string
  isStreaming: boolean
  isGeneratingPlan: boolean
}

// Chat — conversation history sent to Claude on every turn
type ChatState = {
  messages: Message[]
  streamingText: string    // accumulates during SSE, cleared on COMMIT_STREAM
}

// Plan — source of truth for right panel
type PlanState = {
  phases: Phase[]                      // ordered array for display
  lessonMap: Record<string, Lesson>    // O(1) lookup by lessonId
  activeLessonId: string | null
  overallProgress: number              // 0–100, recomputed on RECALCULATE_PROGRESS
}
```

**Actions:**

| Action | Domain | Effect |
|---|---|---|
| `SET_TOPIC` | session | Store topic, transition flowPhase → `active_learning`, subPhase → `diagnostic` |
| `SET_PHASE` | session | Update flowPhase + subPhase |
| `ADD_MESSAGE` | chat | Append Message to messages[], set isStreaming: true |
| `APPEND_STREAM` | chat | Concatenate delta to streamingText |
| `COMMIT_STREAM` | chat | Move streamingText → final Message (status: 'final'), clear streamingText, isStreaming: false |
| `INIT_PLAN` | plan | Initialize phases + lessonMap from parsed JSON, set subPhase → 'quiz' |
| `SET_LESSON_STATUS` | plan | Update lessonMap[id].status |
| `SET_ACTIVE_LESSON` | plan | Update activeLessonId |
| `APPLY_STATE_PATCH` | plan | Apply batch of SET_LESSON_STATUS + SET_ACTIVE_LESSON updates from STATE_PATCH |
| `RECALCULATE_PROGRESS` | plan | Count completed lessons / total lessons → overallProgress |

---

### useCoach (thin orchestrator)

**File:** `src/hooks/useCoach.ts`

Holds the reducer via `useReducer(applyAction, initialState)`. Wires `useChatStream` and `usePlanState` together. Exposes `state` and `dispatch` to the page.

```typescript
const [state, dispatch] = useReducer(applyAction, initialState)
```

No business logic here — delegates to the specialized hooks.

---

### useChatStream

**File:** `src/hooks/useChatStream.ts`

Handles the streaming fetch lifecycle:

1. POST to `/api/chat` with current state
2. Read `ReadableStream` from response body
3. Parse SSE events line by line:
   - `{ type: 'text_delta', delta }` → `dispatch(APPEND_STREAM)`
   - `{ type: 'done', statePatch }` → `dispatch(COMMIT_STREAM)`, then `dispatch(APPLY_STATE_PATCH)`
4. On error: dispatch error message into chat

---

### usePlanState

**File:** `src/hooks/usePlanState.ts`

Thin selector hook. Derives display-ready plan data from `state.plan` for `PlanPanel` and `LearningPlan`. Handles the `phases` + `lessonMap` join for rendering:

```typescript
// Returns lessons for a given phase in display order
const getLessonsForPhase = (phase: Phase) =>
  phase.lessonIds.map(id => state.plan.lessonMap[id])
```

---

## API Route

### /api/chat

**File:** `src/app/api/chat/route.ts`

**Method:** POST  
**Content-Type:** `application/json`

**Request body:**
```typescript
{
  flowPhase: string
  subPhase: string
  messages: Message[]
  planState: PlanState    // server validates tool calls against this
}
```

**Response:** `ReadableStream` (SSE)

**SSE event format:**
```
data: {"type":"text_delta","delta":"...text chunk..."}\n\n
data: {"type":"done","statePatch":{...}}\n\n
```

**Route logic:**

```
1. Parse request body
2. Build system prompt → prompts.ts(subPhase, topic, planState)
3. Build tools array → subPhase === 'quiz' ? [updatePlanTool] : []
4. Call anthropic.messages.stream({ model, system, messages, tools, max_tokens })
5. For each chunk:
   - text_delta → write SSE text_delta event to stream
   - tool_use → push to toolBuffer[]
6. On stream end:
   - Validate toolBuffer against planState (lessonIds must exist)
   - Convert valid tool calls → STATE_PATCH
   - Write SSE done event with statePatch
   - Close stream
```

**STATE_PATCH shape:**
```typescript
type StatePatch = {
  lessonUpdates: { lessonId: string; status: LessonStatus }[]
  activeLessonId: string | null
}
```

**Error handling:**
- If `ANTHROPIC_API_KEY` missing: return 500 before stream opens
- If Anthropic API error mid-stream: write `{ type: 'error', message }` SSE event, close stream
- If tool call references unknown lessonId: skip that update (log warning), continue

---

## AI / Prompt Layer

### prompts.ts

**File:** `src/lib/prompts.ts`

Exports one function: `buildSystemPrompt(subPhase, topic, planState)`. Returns a string.

**Per-phase prompts:**

**`diagnostic` subPhase:**
```
You are a Socratic learning coach. The learner wants to learn: {topic}.

Your job is to assess their prior knowledge before teaching anything.
Ask targeted diagnostic questions — minimum 2, maximum 5.
Stop when you have enough signal on: skill level, learning goal, and depth they want.
Ask one question at a time. Do not generate a learning plan yet.

If the learner gives an evasive answer, try a different angle once.
If evasive twice in a row, state a reasonable assumption and move on.

When you have enough signal, output EXACTLY this JSON on a new line and nothing else after it:
{"action":"generate_plan","ready":true}
```

**`planning` subPhase:**
```
You are a Socratic learning coach. The learner wants to learn: {topic}.
Based on the diagnostic conversation, generate a personalized learning plan.

Output ONLY valid JSON in this exact shape — no prose before or after:
{
  "phases": [
    {
      "id": "phase-1",
      "name": "Phase 1: Foundations",
      "lessonIds": ["lesson-1", "lesson-2", "lesson-3"]
    }
  ],
  "lessons": [
    { "id": "lesson-1", "title": "What is Kubernetes?", "status": "not_started" },
    ...
  ],
  "meta": {
    "goal": "...",
    "estimatedMinutesPerSession": 20,
    "estimatedTotalSessions": 4
  }
}
```

**`quiz` subPhase:**
```
You are a Socratic learning coach. The learner is working through their learning plan for: {topic}.

Current plan state:
{JSON.stringify(planState, null, 2)}

Active lesson: {activeLessonId}

Quiz rules:
- Ask questions one at a time.
- For correct answers: affirm and ask a follow-up that extends the concept.
- For partially correct answers: acknowledge what's right, clarify the gap, ask a nudging follow-up.
- For incorrect answers: briefly explain what's true, retry the same question or a close variant.
- If the learner gets the same concept wrong twice, surface a weakness signal in chat.
- When a lesson is covered, call the update_plan tool to update lesson status and active lesson.
- When all lessons are covered, send a clear completion summary message.
```

---

### tools.ts

**File:** `src/lib/tools.ts`

Exports the Anthropic tool definition for `update_plan`. Only passed to the API during `quiz` subPhase.

```typescript
export const updatePlanTool = {
  name: "update_plan",
  description: "Update the status of a lesson and set the active lesson being quizzed. Call this when a lesson is started or completed.",
  input_schema: {
    type: "object",
    properties: {
      lessonUpdates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            lessonId: { type: "string" },
            status: {
              type: "string",
              enum: ["not_started", "in_progress", "completed"]
            }
          },
          required: ["lessonId", "status"]
        }
      },
      activeLessonId: {
        type: "string",
        description: "The lesson currently being quizzed. Use the lesson's id string."
      }
    },
    required: ["lessonUpdates", "activeLessonId"]
  }
}
```

---

### toolHandlers.ts

**File:** `src/lib/toolHandlers.ts`

Runs server-side at stream end. Validates buffered tool calls against the planState sent in the request, then produces a `StatePatch`.

```typescript
export function buildStatePatch(
  toolBuffer: ToolUseBlock[],
  planState: PlanState
): StatePatch {
  // Filter tool calls to update_plan only
  // Validate each lessonId exists in planState.lessonMap
  // Return { lessonUpdates, activeLessonId }
}
```

---

## Data Model

### TypeScript Types

**File:** `src/lib/types.ts`

```typescript
// Session
export type FlowPhase = 'topic_entry' | 'active_learning' | 'complete'
export type SubPhase = 'diagnostic' | 'planning' | 'quiz' | null

// Chat
export type Message = {
  id: string                           // uuid or timestamp-based
  role: 'user' | 'assistant'
  content: string
  status?: 'streaming' | 'final'
}

// Plan
export type LessonStatus = 'not_started' | 'in_progress' | 'completed'

export type Lesson = {
  id: string
  title: string
  status: LessonStatus
}

export type Phase = {
  id: string
  name: string
  lessonIds: string[]                  // ordered; join with lessonMap for display
}

export type PlanMeta = {
  goal: string
  estimatedMinutesPerSession: number
  estimatedTotalSessions: number
}

export type PlanState = {
  phases: Phase[]
  lessonMap: Record<string, Lesson>
  activeLessonId: string | null
  overallProgress: number              // 0–100
  meta: PlanMeta | null
}

// API wire types
export type StatePatch = {
  lessonUpdates: { lessonId: string; status: LessonStatus }[]
  activeLessonId: string | null
}

export type SSEEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'done'; statePatch: StatePatch }
  | { type: 'error'; message: string }
```

---

## Full Data Flow — Streaming Quiz Response with Tool Call

```
1. USER SUBMITS ANSWER
   └── useCoach → dispatch ADD_MESSAGE(user) → coachReducer → ChatState updated

2. REQUEST TO SERVER
   └── useChatStream → POST /api/chat
         { flowPhase, subPhase: 'quiz', messages, planState }

3. ROUTE BUILDS AI CONTEXT
   └── route.ts
         ├── prompts.ts('quiz', topic, planState) → system prompt
         ├── tools.ts → [updatePlanTool]
         └── anthropic.messages.stream(...)

4. SSE STREAM FROM CLAUDE
   ├── text_delta events → dispatch APPEND_STREAM (streamingText accumulates, UI updates live)
   └── tool_use events  → toolBuffer[] on server (NOT sent to client yet)

5. STREAM END — server finalizes
   └── route.ts
         ├── toolHandlers.buildStatePatch(toolBuffer, planState)
         └── sends: data: {"type":"done","statePatch":{...}}

6. FRONTEND COMMIT
   └── useChatStream receives 'done' event
         ├── dispatch COMMIT_STREAM → streamingText → messages[], isStreaming: false
         └── dispatch APPLY_STATE_PATCH → coachReducer updates:
               • lessonMap entries (status changes)
               • activeLessonId
               • RECALCULATE_PROGRESS → overallProgress

7. UI RE-RENDER
   ├── ChatPanel: final assistant message shown
   └── PlanPanel: lesson highlight + status icon + progress bar updated
```

---

## Phase Transition Logic

```
topic_entry
    │ SET_TOPIC dispatched (topic validated as learning subject)
    ▼
active_learning / diagnostic
    │ Claude signals {"action":"generate_plan","ready":true} in response text
    │ useChatStream detects signal → dispatch SET_PHASE(planning)
    ▼
active_learning / planning
    │ Claude returns plan JSON (no tool use, no streaming text — just JSON)
    │ Client parses JSON → dispatch INIT_PLAN
    ▼
active_learning / quiz
    │ Claude sends completion summary message
    │ useChatStream detects completion signal (heuristic or explicit marker)
    ▼
complete
```

**Topic validation:** The `diagnostic` prompt instructs Claude to redirect non-learning topics. No client-side validation needed — Claude handles it in the chat response. Right panel stays in placeholder until `INIT_PLAN` fires.

---

## File Structure

```
learning-coach/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── chat/
│   │   │       └── route.ts          # Streaming POST handler — Claude calls
│   │   ├── page.tsx                  # Two-panel shell — hosts useCoach
│   │   ├── layout.tsx                # Root layout, metadata, font
│   │   └── globals.css              # Tailwind base styles
│   │
│   ├── components/
│   │   ├── ChatPanel.tsx             # Left panel — topic input + chat messages
│   │   ├── ChatMessage.tsx           # Single message bubble (user or coach)
│   │   ├── PlanPanel.tsx             # Right panel — 3 display states
│   │   ├── LearningPlan.tsx          # Plan header + phases + progress bar
│   │   └── LessonItem.tsx            # Single lesson row — status icon + highlight
│   │
│   ├── hooks/
│   │   ├── useCoach.ts               # Thin orchestrator — holds reducer, wires hooks
│   │   ├── useChatStream.ts          # Streaming fetch — SSE parsing, dispatch
│   │   └── usePlanState.ts           # Selector hook — derives display data from plan
│   │
│   ├── state/
│   │   └── coachReducer.ts           # applyAction(state, action) → newState
│   │
│   └── lib/
│       ├── types.ts                  # All shared TypeScript types
│       ├── prompts.ts                # System prompt builders keyed by subPhase
│       ├── tools.ts                  # Anthropic tool schema for update_plan
│       └── toolHandlers.ts           # Server-side tool buffer → StatePatch
│
├── docs/
│   ├── learner-profile.md
│   ├── scope.md
│   ├── prd.md
│   └── spec.md
│
├── process-notes.md
├── .env.local                        # ANTHROPIC_API_KEY (not committed)
├── .env.example                      # Template for env vars
├── .gitignore
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

---

## Key Technical Decisions

### 1. Tool calls buffer server-side — plan updates are atomic

**Decision:** Claude's `tool_use` events are accumulated in a `toolBuffer[]` during the stream. The server validates and converts them to a `STATE_PATCH` at stream end. The client applies the patch atomically via `APPLY_STATE_PATCH` after `COMMIT_STREAM`.

**Tradeoff accepted:** Plan updates appear at the end of each coach response, not mid-stream. This is acceptable — the visual update cadence matches how a human reader would perceive it anyway (plan updates after reading the coach's message).

**Why not mid-stream client updates:** Applying tool call events mid-stream while text is still accumulating creates race conditions between streaming state and plan state. The atomic patch approach keeps the reducer consistent.

---

### 2. flowPhase + subPhase split (not a flat enum)

**Decision:** Session state uses `flowPhase: 'topic_entry' | 'active_learning' | 'complete'` + `subPhase: 'diagnostic' | 'planning' | 'quiz' | null` rather than a flat 5-value enum.

**Tradeoff accepted:** Two fields instead of one. But the split is semantically correct: `active_learning` covers all AI-interaction states, and `subPhase` routes the prompt logic within it. Avoids impossible states like `complete/diagnostic`.

---

### 3. Plan JSON returned as text, not tool call

**Decision:** During `planning` subPhase, Claude returns the learning plan as a JSON string in its text response. The client parses it to initialize plan state. Tool use is NOT involved in plan generation — only in incremental updates during quiz.

**Tradeoff accepted:** Requires robust JSON parsing on the client and a clear prompt constraint. The benefit: plan generation doesn't stream (it's a single structured response), and it keeps `update_plan` tool semantics clean — it only signals changes to an existing plan.

---

## Dependencies & External Services

| Service | Purpose | Pricing / Limits | Docs |
|---|---|---|---|
| Anthropic API | Claude claude-sonnet-4-6 — all AI calls | Pay-per-token. claude-sonnet-4-6 is ~$3/MTok input, $15/MTok output. Hackathon usage is negligible. | https://platform.claude.com/docs |
| Vercel | Hosting + serverless functions | Free Hobby tier: 100GB bandwidth, 1M edge requests/month | https://vercel.com/pricing |
| `@anthropic-ai/sdk` | TypeScript client for Anthropic API | npm package, actively maintained | https://github.com/anthropics/anthropic-sdk-typescript |
| `next` | Framework | v16.x, actively maintained | https://nextjs.org/docs |
| `tailwindcss` | Styling | v3.x or v4.x | https://tailwindcss.com/docs |

**API key setup:**
```bash
# .env.local (never commit)
ANTHROPIC_API_KEY=sk-ant-...

# .env.example (commit this)
ANTHROPIC_API_KEY=your_key_here
```

---

## Open Issues

### From PRD open questions (resolved here)

| Question | Resolution |
|---|---|
| When does 🟡 trigger? | When the coach asks the first question for that lesson — `SET_LESSON_STATUS(in_progress)` fires in the same `APPLY_STATE_PATCH` as `SET_ACTIVE_LESSON`. |
| Should active lesson be highlighted? | Yes — `LessonItem` receives `isActive` prop, renders bold text + left border accent when true. |
| Streaming behavior? | Token-by-token SSE streaming. `useChatStream` reads `ReadableStream`, dispatches `APPEND_STREAM` per text delta. |

### Remaining risks

1. **Plan JSON parsing reliability.** Claude's `planning` response must be valid JSON. The prompt constrains this tightly, but JSON parse failures need a fallback (retry prompt or graceful error in chat). Resolve during build — a simple try/catch with a user-facing "Couldn't generate plan — let's try again" message is sufficient.

2. **`generate_plan` signal detection.** The `diagnostic` phase ends when Claude emits `{"action":"generate_plan","ready":true}` in its text response. `useChatStream` needs to scan for this marker without displaying it to the user. Implementation: strip the marker from `streamingText` before dispatch. Risk: Claude may vary the format. Mitigation: use a very explicit prompt constraint and test with a few topics.

3. **Session completion signal.** The spec relies on a heuristic to detect when the quiz is complete (coach sends a completion summary). Consider having the prompt emit an explicit marker (e.g., `{"action":"session_complete"}`) similar to the plan generation signal, so `useChatStream` can reliably transition `flowPhase → 'complete'`.

4. **Vercel function timeout.** Vercel Hobby serverless functions have a 10-second execution limit by default. Long streaming responses may hit this. Mitigation: set `export const maxDuration = 60` in `route.ts` (available on Hobby for streaming responses up to 5 minutes).
