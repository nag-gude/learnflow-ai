import { Message } from '@/lib/types'

type ChatMessageProps = {
  role: Message['role']
  content: string
  status?: Message['status']
}

export default function ChatMessage({ role, content, status }: ChatMessageProps) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-blue-500 text-white rounded-br-sm'
            : 'bg-gray-100 text-gray-800 rounded-bl-sm'
        }`}
      >
        {content}
        {status === 'streaming' && (
          <span className="inline-block ml-0.5 animate-pulse">|</span>
        )}
      </div>
    </div>
  )
}
