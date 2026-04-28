'use client'
import { CoachState } from '@/lib/types'
import LearningPlan from './LearningPlan'

type PlanPanelProps = {
  state: CoachState
}

export default function PlanPanel({ state }: PlanPanelProps) {
  const { flowPhase, subPhase } = state.session
  const hasPlan = state.plan.phases.length > 0

  return (
    <div className="w-1/2 flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <h2 className="text-lg font-semibold text-gray-800">Learning Plan</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {flowPhase === 'topic_entry' ? (
          <p className="text-sm text-gray-400 italic">
            Your learning plan will appear here
          </p>
        ) : subPhase === 'diagnostic' ? (
          <p className="text-sm text-gray-400 italic">
            Analyzing your background...
          </p>
        ) : subPhase === 'planning' ? (
          <p className="text-sm text-gray-400 italic">
            Generating your personalized plan...
          </p>
        ) : (subPhase === 'quiz' || hasPlan) ? (
          <LearningPlan plan={state.plan} />
        ) : null}
      </div>
    </div>
  )
}
