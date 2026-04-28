'use client'
import { useRef, useEffect, useState } from 'react'
import { CoachState } from '@/lib/types'
import { CoachAction } from '@/state/coachReducer'
import { useChatStream } from '@/hooks/useChatStream'
import ChatMessage from './ChatMessage'

type ChatPanelProps = {
  state: CoachState
  dispatch: React.Dispatch<CoachAction>
}

export default function ChatPanel({ state, dispatch }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const { sendMessage } = useChatStream(state, dispatch)

  const isDisabled = state.session.isStreaming === true

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.chat.messages, state.chat.streamingText])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && inputValue.trim() && !isDisabled) {
      const trimmed = inputValue.trim()
      setInputValue('')
      if (state.session.flowPhase === 'topic_entry') {
        // First message: set the topic, then kick off the diagnostic stream
        dispatch({ type: 'SET_TOPIC', payload: { topic: trimmed } })
        sendMessage(trimmed)
      } else {
        // Subsequent messages (quiz phase, etc.)
        sendMessage(trimmed)
      }
    }
  }

  return (
    <div className="w-1/2 flex flex-col h-full border-r border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-semibold text-gray-800">LearnFlow AI</h1>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50">
        {state.chat.messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            role={msg.role}
            content={msg.content}
            status={msg.status}
          />
        ))}
        {state.session.isStreaming && (
          <ChatMessage
            role="assistant"
            content={state.chat.streamingText}
            status="streaming"
          />
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-gray-200 bg-white">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          placeholder={
            isDisabled
              ? ''
              : state.session.flowPhase === 'topic_entry'
                ? 'What do you want to learn today?'
                : 'Type your answer...'
          }
          className="w-full px-4 py-2 rounded-full border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  )
}
