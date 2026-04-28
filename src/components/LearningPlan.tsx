'use client'
import { PlanState, Phase } from '@/lib/types'
import LessonItem from './LessonItem'

type LearningPlanProps = {
  plan: PlanState
}

function getLessonsForPhase(plan: PlanState, phase: Phase) {
  return phase.lessonIds.map((id) => plan.lessonMap[id]).filter(Boolean)
}

export default function LearningPlan({ plan }: LearningPlanProps) {
  const { meta, phases, overallProgress, activeLessonId } = plan
  const allLessons = Object.values(plan.lessonMap)
  const totalCount = allLessons.length
  const completedCount = allLessons.filter((l) => l.status === 'completed').length

  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">
          {meta ? meta.goal : 'Learning Plan'}
        </h2>
        {meta && (
          <p className="text-xs text-gray-400 mt-1">
            {meta.estimatedMinutesPerSession} min/session · {meta.estimatedTotalSessions} sessions total
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progress</span>
          <span>{completedCount} of {totalCount} lessons</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">{overallProgress}% complete</p>
      </div>

      {/* Phases */}
      <div className="space-y-4">
        {phases.map((phase) => {
          const lessons = getLessonsForPhase(plan, phase)
          return (
            <div key={phase.id}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                {phase.name} — {phase.lessonIds.length} lessons
              </h3>
              <div className="space-y-1">
                {lessons.map((lesson) => (
                  <LessonItem
                    key={lesson.id}
                    lesson={lesson}
                    isActive={lesson.id === activeLessonId}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
