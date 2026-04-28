'use client'
import { useReducer } from 'react'
import { applyAction, initialState, CoachAction } from '@/state/coachReducer'
import { CoachState } from '@/lib/types'

export function useCoach(): { state: CoachState; dispatch: React.Dispatch<CoachAction> } {
  const [state, dispatch] = useReducer(applyAction, initialState)
  return { state, dispatch }
}
