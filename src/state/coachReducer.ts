import {
  CoachState,
  FlowPhase,
  SubPhase,
  Message,
  Phase,
  Lesson,
  PlanMeta,
  LessonStatus,
  StatePatch,
} from '@/lib/types'

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export const initialState: CoachState = {
  session: {
    flowPhase: 'topic_entry',
    subPhase: null,
    topic: '',
    isStreaming: false,
    isGeneratingPlan: false,
  },
  chat: {
    messages: [],
    streamingText: '',
  },
  plan: {
    phases: [],
    lessonMap: {},
    activeLessonId: null,
    overallProgress: 0,
    meta: null,
  },
}

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------

export type CoachAction =
  | { type: 'SET_TOPIC'; payload: { topic: string } }
  | { type: 'SET_PHASE'; payload: { flowPhase: FlowPhase; subPhase: SubPhase } }
  | { type: 'ADD_MESSAGE'; payload: { message: Message } }
  | { type: 'APPEND_STREAM'; payload: { delta: string } }
  | { type: 'COMMIT_STREAM' }
  | {
      type: 'INIT_PLAN'
      payload: { phases: Phase[]; lessons: Lesson[]; meta: PlanMeta }
    }
  | { type: 'SET_LESSON_STATUS'; payload: { id: string; status: LessonStatus } }
  | { type: 'SET_ACTIVE_LESSON'; payload: { id: string | null } }
  | { type: 'APPLY_STATE_PATCH'; payload: StatePatch }
  | { type: 'RECALCULATE_PROGRESS' }

// ---------------------------------------------------------------------------
// Pure helper: recalculate progress
// ---------------------------------------------------------------------------

function recalculateProgress(state: CoachState): CoachState {
  const lessons = Object.values(state.plan.lessonMap)
  const total = lessons.length
  if (total === 0) {
    return {
      ...state,
      plan: { ...state.plan, overallProgress: 0 },
    }
  }
  const completed = lessons.filter((l) => l.status === 'completed').length
  const overallProgress = Math.round((completed / total) * 100)
  return {
    ...state,
    plan: { ...state.plan, overallProgress },
  }
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function applyAction(state: CoachState, action: CoachAction): CoachState {
  switch (action.type) {
    case 'SET_TOPIC': {
      return {
        ...state,
        session: {
          ...state.session,
          topic: action.payload.topic,
          flowPhase: 'active_learning',
          subPhase: 'diagnostic',
        },
      }
    }

    case 'SET_PHASE': {
      return {
        ...state,
        session: {
          ...state.session,
          flowPhase: action.payload.flowPhase,
          subPhase: action.payload.subPhase,
        },
      }
    }

    case 'ADD_MESSAGE': {
      return {
        ...state,
        chat: {
          ...state.chat,
          messages: [...state.chat.messages, action.payload.message],
          streamingText: state.chat.streamingText,
        },
        session: {
          ...state.session,
          isStreaming: true,
        },
      }
    }

    case 'APPEND_STREAM': {
      return {
        ...state,
        chat: {
          ...state.chat,
          streamingText: state.chat.streamingText + action.payload.delta,
        },
      }
    }

    case 'COMMIT_STREAM': {
      const streamingText = state.chat.streamingText
      const finalMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: streamingText,
        status: 'final',
      }
      return {
        ...state,
        chat: {
          messages: [...state.chat.messages, finalMessage],
          streamingText: '',
        },
        session: {
          ...state.session,
          isStreaming: false,
        },
      }
    }

    case 'INIT_PLAN': {
      const { phases, lessons, meta } = action.payload
      const lessonMap: Record<string, Lesson> = {}
      for (const lesson of lessons) {
        lessonMap[lesson.id] = lesson
      }
      return {
        ...state,
        session: {
          ...state.session,
          subPhase: 'quiz',
        },
        plan: {
          ...state.plan,
          phases,
          lessonMap,
          meta,
        },
      }
    }

    case 'SET_LESSON_STATUS': {
      const { id, status } = action.payload
      const existing = state.plan.lessonMap[id]
      if (!existing) return state
      return {
        ...state,
        plan: {
          ...state.plan,
          lessonMap: {
            ...state.plan.lessonMap,
            [id]: { ...existing, status },
          },
        },
      }
    }

    case 'SET_ACTIVE_LESSON': {
      return {
        ...state,
        plan: {
          ...state.plan,
          activeLessonId: action.payload.id,
        },
      }
    }

    case 'APPLY_STATE_PATCH': {
      const { lessonUpdates, activeLessonId } = action.payload

      // Apply all lesson status updates
      let updatedLessonMap = { ...state.plan.lessonMap }
      for (const update of lessonUpdates) {
        const existing = updatedLessonMap[update.lessonId]
        if (existing) {
          updatedLessonMap = {
            ...updatedLessonMap,
            [update.lessonId]: { ...existing, status: update.status },
          }
        }
      }

      const patchedState: CoachState = {
        ...state,
        plan: {
          ...state.plan,
          lessonMap: updatedLessonMap,
          activeLessonId,
        },
      }

      // Recalculate progress after applying patch
      return recalculateProgress(patchedState)
    }

    case 'RECALCULATE_PROGRESS': {
      return recalculateProgress(state)
    }

    default: {
      // Exhaustiveness check
      const _exhaustive: never = action
      return _exhaustive
    }
  }
}
