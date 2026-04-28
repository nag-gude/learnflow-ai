import { PlanState, StatePatch, LessonStatus } from '@/lib/types'

export type AccumulatedToolCall = {
  id: string
  name: string
  arguments: string
}

export function buildStatePatch(
  toolBuffer: AccumulatedToolCall[],
  planState: PlanState
): StatePatch {
  const lessonUpdates: { lessonId: string; status: LessonStatus }[] = []
  let activeLessonId: string | null = null

  for (const toolCall of toolBuffer) {
    if (toolCall.name !== 'update_plan') continue

    let input: { lessonUpdates: { lessonId: string; status: string }[]; activeLessonId: string }
    try {
      input = JSON.parse(toolCall.arguments)
    } catch {
      console.warn(`buildStatePatch: failed to parse tool arguments — skipping`)
      continue
    }

    for (const update of input.lessonUpdates) {
      if (!planState.lessonMap[update.lessonId]) {
        console.warn(`buildStatePatch: unknown lessonId ${update.lessonId} — skipping`)
        continue
      }
      lessonUpdates.push({
        lessonId: update.lessonId,
        status: update.status as LessonStatus,
      })
    }

    if (input.activeLessonId && planState.lessonMap[input.activeLessonId]) {
      activeLessonId = input.activeLessonId
    }
  }

  return { lessonUpdates, activeLessonId }
}
