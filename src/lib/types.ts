// Session
export type FlowPhase = 'topic_entry' | 'active_learning' | 'complete'
export type SubPhase = 'diagnostic' | 'planning' | 'quiz' | null

// Chat
export type Message = {
  id: string
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
  lessonIds: string[]
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
  overallProgress: number
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

// State domains
export type SessionState = {
  flowPhase: FlowPhase
  subPhase: SubPhase
  topic: string
  isStreaming: boolean
  isGeneratingPlan: boolean
}

export type ChatState = {
  messages: Message[]
  streamingText: string
}

export type CoachState = {
  session: SessionState
  chat: ChatState
  plan: PlanState
}
