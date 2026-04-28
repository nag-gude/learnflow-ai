import Anthropic from '@anthropic-ai/sdk'
import { PlanState, StatePatch, LessonStatus } from '@/lib/types'

export function buildStatePatch(
  toolBuffer: Anthropic.ToolUseBlock[],
  planState: PlanState
): StatePatch {
  const lessonUpdates: { lessonId: string; status: LessonStatus }[] = []
  let activeLessonId: string | null = null

  for (const toolCall of toolBuffer) {
    if (toolCall.name !== 'update_plan') continue

    const input = toolCall.input as {
      lessonUpdates: { lessonId: string; status: string }[]
      activeLessonId: string
    }

    for (const update of input.lessonUpdates) {
      if (!planState.lessonMap[update.lessonId]) {
        console.warn(`buildStatePatch: unknown lessonId ${update.lessonId} — skipping`)
        continue
      }
      lessonUpdates.push({
        lessonId: update.lessonId,
        status: update.status as LessonStatus
      })
    }

    if (input.activeLessonId && planState.lessonMap[input.activeLessonId]) {
      activeLessonId = input.activeLessonId
    }
  }

  return { lessonUpdates, activeLessonId }
}
