import Anthropic from '@anthropic-ai/sdk'
import { buildSystemPrompt } from '@/lib/prompts'
import { updatePlanTool } from '@/lib/tools'
import { buildStatePatch } from '@/lib/toolHandlers'
import { Message, PlanState } from '@/lib/types'

export const maxDuration = 60

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
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
  const tools: Anthropic.Tool[] = subPhase === 'quiz' ? [updatePlanTool as Anthropic.Tool] : []

  // Convert messages to Anthropic format
  const anthropicMessages: Anthropic.MessageParam[] = messages.map(msg => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  }))

  const toolBuffer: Anthropic.ToolUseBlock[] = []

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      function writeSSE(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const anthropicStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          system: systemPrompt,
          messages: anthropicMessages,
          ...(tools.length > 0 ? { tools } : {}),
        })

        for await (const chunk of anthropicStream) {
          if (chunk.type === 'content_block_delta') {
            if (chunk.delta.type === 'text_delta') {
              writeSSE({ type: 'text_delta', delta: chunk.delta.text })
            }
          }
        }

        // Collect tool use blocks from final message
        const finalMessage = await anthropicStream.finalMessage()
        for (const block of finalMessage.content) {
          if (block.type === 'tool_use') {
            toolBuffer.push(block)
          }
        }

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
