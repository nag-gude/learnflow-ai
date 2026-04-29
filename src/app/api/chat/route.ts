import OpenAI from 'openai'
import { buildSystemPrompt } from '@/lib/prompts'
import { updatePlanTool } from '@/lib/tools'
import { buildStatePatch, AccumulatedToolCall } from '@/lib/toolHandlers'
import { Message, PlanState } from '@/lib/types'

export const maxDuration = 60

type Provider = 'openai' | 'groq'

const PROVIDER_CONFIGS: Record<Provider, { baseURL: string; envKey: string; defaultModel: string }> = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    envKey: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o',
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    envKey: 'GROQ_API_KEY',
    defaultModel: 'llama-3.3-70b-versatile',
  },
}

function getProviderClient(): { client: OpenAI; model: string } {
  const provider = (process.env.AI_PROVIDER ?? 'groq') as Provider
  const config = PROVIDER_CONFIGS[provider] ?? PROVIDER_CONFIGS.groq
  const apiKey = process.env[config.envKey]

  if (!apiKey) {
    throw new Error(`${config.envKey} not configured for provider "${provider}"`)
  }

  return {
    client: new OpenAI({ apiKey, baseURL: config.baseURL }),
    model: process.env.AI_MODEL ?? config.defaultModel,
  }
}

export async function POST(request: Request) {
  let providerSetup: ReturnType<typeof getProviderClient>
  try {
    providerSetup = getProviderClient()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Provider not configured'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { client, model } = providerSetup

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
        const completion = await client.chat.completions.create({
          model,
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
