'use client'
import { useCallback, useRef } from 'react'
import { CoachState, StatePatch } from '@/lib/types'
import { CoachAction } from '@/state/coachReducer'

export function useChatStream(state: CoachState, dispatch: React.Dispatch<CoachAction>) {
  const stateRef = useRef(state)
  stateRef.current = state

  const fetchStream = useCallback(
    async (
      subPhase: string,
      messages: CoachState['chat']['messages'],
      planState: CoachState['plan'],
    ): Promise<string> => {
      const currentState = stateRef.current
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subPhase,
          topic: currentState.session.topic,
          messages,
          planState,
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''
      let signalDetected = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue

          let event: { type: string; delta?: string; statePatch?: unknown; message?: string }
          try {
            event = JSON.parse(raw)
          } catch {
            continue
          }

          if (event.type === 'text_delta' && event.delta) {
            fullText += event.delta

            // Check for plan generation signal
            if (!signalDetected && fullText.includes('{"action":"generate_plan","ready":true}')) {
              signalDetected = true
              const cleanText = fullText
                .replace('{"action":"generate_plan","ready":true}', '')
                .trim()
              // Dispatch what we have so far as final text (without the signal)
              if (cleanText) {
                dispatch({ type: 'APPEND_STREAM', payload: { delta: cleanText } })
              }
              dispatch({ type: 'COMMIT_STREAM' })
              dispatch({
                type: 'SET_PHASE',
                payload: { flowPhase: 'active_learning', subPhase: 'planning' },
              })
              return 'PLAN_SIGNAL'
            }

            if (!signalDetected) {
              dispatch({ type: 'APPEND_STREAM', payload: { delta: event.delta } })
            }
          } else if (event.type === 'done') {
            // payload: StatePatch (lessonUpdates + activeLessonId) directly
            const statePatch = event.statePatch as StatePatch
            dispatch({ type: 'COMMIT_STREAM' })
            dispatch({ type: 'APPLY_STATE_PATCH', payload: statePatch })
          } else if (event.type === 'error') {
            dispatch({
              type: 'ADD_MESSAGE',
              payload: {
                message: {
                  id: Date.now().toString(),
                  role: 'assistant',
                  content: `Error: ${event.message}`,
                  status: 'final',
                },
              },
            })
          }
        }
      }

      return fullText
    },
    [dispatch],
  )

  const fetchPlan = useCallback(
    async (messages: CoachState['chat']['messages']): Promise<void> => {
      const currentState = stateRef.current
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subPhase: 'planning',
          topic: currentState.session.topic,
          messages,
          planState: currentState.plan,
        }),
      })

      if (!response.ok) throw new Error(`Plan fetch error: ${response.status}`)

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let planText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue
          try {
            const event = JSON.parse(raw)
            if (event.type === 'text_delta' && event.delta) {
              planText += event.delta
            }
          } catch {
            continue
          }
        }
      }

      // Parse the plan JSON
      try {
        // Extract JSON from response (may have extra whitespace or prose around it)
        const jsonMatch = planText.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('No JSON found in plan response')
        const planData = JSON.parse(jsonMatch[0])
        dispatch({
          type: 'INIT_PLAN',
          payload: {
            phases: planData.phases,
            lessons: planData.lessons,
            meta: planData.meta,
          },
        })
      } catch {
        dispatch({
          type: 'ADD_MESSAGE',
          payload: {
            message: {
              id: Date.now().toString(),
              role: 'assistant',
              content:
                "I had trouble generating your learning plan. Let's try again — could you tell me a bit more about what you want to learn?",
              status: 'final',
            },
          },
        })
      }
    },
    [dispatch],
  )

  const startQuiz = useCallback(
    async (
      planState: CoachState['plan'],
      allMessages: CoachState['chat']['messages'],
    ): Promise<void> => {
      // Add a system trigger message to start the quiz
      const triggerMessage = {
        id: Date.now().toString(),
        role: 'user' as const,
        content: "I'm ready to start the quiz.",
        status: 'final' as const,
      }
      dispatch({ type: 'ADD_MESSAGE', payload: { message: triggerMessage } })
      const messagesWithTrigger = [...allMessages, triggerMessage]
      await fetchStream('quiz', messagesWithTrigger, planState)
    },
    [dispatch, fetchStream],
  )

  const sendMessage = useCallback(
    async (content: string) => {
      const currentState = stateRef.current
      const userMessage = {
        id: Date.now().toString(),
        role: 'user' as const,
        content,
        status: 'final' as const,
      }

      // Don't add user message again when we're in planning phase (no user input during planning)
      if (currentState.session.subPhase !== 'planning') {
        dispatch({ type: 'ADD_MESSAGE', payload: { message: userMessage } })
      }

      const messages =
        currentState.session.subPhase === 'planning'
          ? currentState.chat.messages
          : [...currentState.chat.messages, userMessage]

      const result = await fetchStream(
        currentState.session.subPhase ?? 'diagnostic',
        messages,
        currentState.plan,
      )

      if (result === 'PLAN_SIGNAL') {
        const updatedMessages = [...messages]
        await fetchPlan(updatedMessages)
        // Wait a tick for INIT_PLAN to process, then auto-start quiz
        setTimeout(async () => {
          const latestState = stateRef.current
          await startQuiz(latestState.plan, latestState.chat.messages)
        }, 100)
      }
    },
    [dispatch, fetchStream, fetchPlan, startQuiz],
  )

  return { sendMessage }
}
