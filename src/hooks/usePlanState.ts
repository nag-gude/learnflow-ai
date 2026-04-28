'use client'
import { Phase, CoachState } from '@/lib/types'

export function usePlanState(state: CoachState) {
  const getLessonsForPhase = (phase: Phase) =>
    phase.lessonIds.map((id) => state.plan.lessonMap[id]).filter(Boolean)

  return {
    plan: state.plan,
    getLessonsForPhase,
  }
}
