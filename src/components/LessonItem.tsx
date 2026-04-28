import { Lesson } from '@/lib/types'

type LessonItemProps = {
  lesson: Lesson
  isActive: boolean
}

const statusIcon: Record<Lesson['status'], string> = {
  not_started: '⬜',
  in_progress: '🟡',
  completed: '✅',
}

export default function LessonItem({ lesson, isActive }: LessonItemProps) {
  return (
    <div
      className={`flex items-center gap-2 py-1 text-sm ${
        isActive
          ? 'border-l-2 border-blue-500 pl-2 font-bold'
          : 'pl-3'
      }`}
    >
      <span>{statusIcon[lesson.status]}</span>
      <span className={isActive ? 'text-blue-700' : 'text-gray-700'}>
        {lesson.title}
      </span>
    </div>
  )
}
