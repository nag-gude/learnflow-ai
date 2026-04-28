'use client'
import { useCoach } from '@/hooks/useCoach'
import ChatPanel from '@/components/ChatPanel'
import PlanPanel from '@/components/PlanPanel'

export default function Home() {
  const { state, dispatch } = useCoach()
  return (
    <main className="flex h-full w-full">
      <ChatPanel state={state} dispatch={dispatch} />
      <PlanPanel state={state} />
    </main>
  )
}
