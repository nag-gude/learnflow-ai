import OpenAI from 'openai'
import { buildSystemPrompt } from '@/lib/prompts'
import { updatePlanTool } from '@/lib/tools'
import { buildStatePatch, AccumulatedToolCall } from '@/lib/toolHandlers'
import { Message, PlanState } from '@/lib/types'

export const maxDuration = 60

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = await request.json()
  const { subPhase, topic, messages, planState }: {
    subPhase: string
    topic: string
    messages: Message[]
    planState: PlanState
  } = body

  const systemPrompt = buildSystemPrompt(subPhase, topic, planState)
  const tools = subPhase === 'quiz' ? [updatePlanTool] : []

  const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
  ]

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      function writeSSE(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: openaiMessages,
          ...(tools.length > 0 ? { tools } : {}),
          stream: true,
        })

        const toolCallAccumulator: Record<number, AccumulatedToolCall> = {}

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta

          if (delta?.content) {
            writeSSE({ type: 'text_delta', delta: delta.content })
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index
              if (!toolCallAccumulator[idx]) {
                toolCallAccumulator[idx] = { id: tc.id ?? '', name: tc.function?.name ?? '', arguments: '' }
              }
              toolCallAccumulator[idx].arguments += tc.function?.arguments ?? ''
            }
          }
        }

        const toolBuffer = Object.values(toolCallAccumulator)
        const statePatch = buildStatePatch(toolBuffer, planState)
        writeSSE({ type: 'done', statePatch })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        writeSSE({ type: 'error', message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
