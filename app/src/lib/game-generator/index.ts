/**
 * 游戏生成 Agent
 *
 * 使用 Claude Agent SDK 生成互动数学游戏
 * 支持通过环境变量配置 Anthropic 兼容的 API 提供商
 */

import { query } from '@anthropic-ai/claude-agent-sdk'
import { buildSystemPrompt, buildGenerationPrompt } from './prompts'
import type {
  GameGeneratorInput,
  GameGeneratorConfig,
  GeneratedGame,
  GameGenerationProgress,
  GameType,
  GameDifficulty,
} from './types'

// 从环境变量获取模型配置
const GAME_AGENT_MODEL = process.env.GAME_AGENT_MODEL || 'claude-sonnet-4-20250514'

// 自定义 API 配置 - 通过环境变量传递给 SDK
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// 设置环境变量（如果配置了自定义 API）
if (ANTHROPIC_BASE_URL && ANTHROPIC_API_KEY) {
  process.env.ANTHROPIC_API_KEY = ANTHROPIC_API_KEY
  console.log('[GameGenerator] 自定义 API 配置已加载:', {
    baseUrl: ANTHROPIC_BASE_URL,
    model: GAME_AGENT_MODEL,
    apiKeyPrefix: ANTHROPIC_API_KEY.substring(0, 10) + '...'
  })
}

/**
 * 解析 Agent 输出，提取游戏数据
 */
function parseGameOutput(output: string): Partial<GeneratedGame> | null {
  try {
    console.log('[GameGenerator] 原始输出长度:', output.length)
    console.log('[GameGenerator] 输出前200字符:', output.slice(0, 200))

    // 方法1：尝试从输出中提取 JSON 代码块
    const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      console.log('[GameGenerator] 找到 JSON 代码块')
      return JSON.parse(jsonMatch[1])
    }

    // 方法2：尝试提取 JSON 对象
    const startIndex = output.indexOf('{')
    const endIndex = output.lastIndexOf('}')
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      const jsonStr = output.slice(startIndex, endIndex + 1)
      console.log('[GameGenerator] 提取的JSON字符串:', jsonStr.slice(0, 100))
      return JSON.parse(jsonStr)
    }

    // 方法3：尝试查找 title 和 componentCode 字段
    const titleMatch = output.match(/"title":\s*"([^"]+)"/)
    const codeMatch = output.match(/"componentCode":\s*"([^"]*(?:\\.[^"]*)*)"/s)

    if (titleMatch && codeMatch) {
      console.log('[GameGenerator] 使用正则表达式提取字段')
      return {
        title: titleMatch[1],
        componentCode: codeMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
        description: 'AI生成的游戏',
        gameType: 'custom',
        difficulty: 'medium',
        estimatedPlayTime: 120,
        mathConcepts: [],
        learningObjectives: [],
        instructions: '',
        hints: [],
      }
    }

    console.log('[GameGenerator] 未找到有效的JSON格式')
    return null
  } catch (error) {
    console.error('[GameGenerator] JSON 解析失败:', error)
    console.error('[GameGenerator] 失败输出片段:', output.slice(0, 500))
    return null
  }
}

/**
 * 提取 Agent 思考过程和生成进度
 */
function extractAgentProgress(output: string): { thinking: string[]; steps: string[] } {
  const thinking: string[] = []
  const steps: string[] = []

  // 提取思考过程
  const thinkingMatches = output.match(/<thinking>(.*?)<\/thinking>/gs)
  if (thinkingMatches) {
    thinkingMatches.forEach(match => {
      const content = match.replace(/<\/?thinking>/g, '').trim()
      if (content) thinking.push(content)
    })
  }

  // 提取步骤信息
  const stepMatches = output.match(/STEP \d+: (.*?)(?=STEP \d+:|$)/gs)
  if (stepMatches) {
    stepMatches.forEach(match => {
      const content = match.replace(/STEP \d+: /, '').trim()
      if (content) steps.push(content)
    })
  }

  return { thinking, steps }
}

/**
 * 验证生成的游戏代码
 */
function validateGameCode(code: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // 检查是否包含必要的组件结构
  if (!code.includes('export default function')) {
    errors.push('缺少默认导出的函数组件')
  }

  // 检查是否使用了禁止的外部依赖
  const forbiddenImports = [
    /import.*from\s+['"](?!framer-motion|react)/,
  ]
  for (const pattern of forbiddenImports) {
    if (pattern.test(code)) {
      errors.push('使用了不允许的外部依赖')
      break
    }
  }

  // 检查是否有基本的 JSX 结构
  if (!code.includes('return') || !code.includes('<')) {
    errors.push('缺少有效的 JSX 返回值')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * 生成游戏
 */
export async function generateGame(
  input: GameGeneratorInput,
  config: GameGeneratorConfig = {}
): Promise<GeneratedGame> {
  const startTime = Date.now()
  const { onProgress } = config

  // 更新进度
  const updateProgress = (progress: GameGenerationProgress) => {
    onProgress?.(progress)
    console.log(`[GameGenerator] ${progress.stage}: ${progress.progress}% - ${progress.message}`)
  }

  updateProgress({
    stage: 'analyzing',
    progress: 0,
    message: '正在分析教学内容...',
  })

  // 构建 prompts
  const systemPrompt = buildSystemPrompt(input)
  const userPrompt = buildGenerationPrompt(input)

  updateProgress({
    stage: 'designing',
    progress: 20,
    message: '正在设计游戏...',
  })

  // 收集 Agent 输出
  let fullOutput = ''
  let lastAssistantText = ''
  let turnCount = 0
  const agentThinking: string[] = []
  const generationSteps: string[] = []

  try {
    // 调用 Claude Agent SDK，增加 maxTurns，使用自定义 API 配置
    const queryOptions = {
      prompt: userPrompt,
      options: {
        systemPrompt,
        allowedTools: [], // 禁用 WebSearch，简化任务
        permissionMode: 'bypassPermissions',
        maxTurns: config.maxTurns || 15, // 增加轮次限制
      },
    }

    // 如果配置了自定义 API，添加自定义端点
    if (ANTHROPIC_BASE_URL) {
      ;(queryOptions as any).baseUrl = ANTHROPIC_BASE_URL
      console.log('[GameGenerator] 使用自定义 API 配置:', {
        baseUrl: ANTHROPIC_BASE_URL,
        model: GAME_AGENT_MODEL,
        hasApiKey: !!ANTHROPIC_API_KEY
      })
    }

    for await (const message of query(queryOptions)) {
      turnCount++
      // 处理不同类型的消息
      if (message.type === 'assistant' && message.message?.content) {
        for (const block of message.message.content) {
          if ('text' in block) {
            const text = block.text
            lastAssistantText = text
            fullOutput += text

            // 提取思考过程和步骤
            const { thinking, steps } = extractAgentProgress(text)
            agentThinking.push(...thinking)
            generationSteps.push(...steps)
          }
        }

        // 计算详细进度
        const progressPercent = Math.min(50 + (turnCount / 15) * 30, 80)
        let stageMessage = `正在生成游戏代码...`

        if (turnCount <= 3) {
          stageMessage = '正在分析教学内容和设计游戏概念...'
        } else if (turnCount <= 6) {
          stageMessage = '正在设计游戏规则和交互逻辑...'
        } else if (turnCount <= 10) {
          stageMessage = '正在编写 React 组件代码...'
        } else if (turnCount <= 13) {
          stageMessage = '正在优化代码和添加动画效果...'
        } else {
          stageMessage = '正在完成游戏并验证代码...'
        }

        updateProgress({
          stage: 'coding',
          progress: Math.round(progressPercent),
          message: `${stageMessage} (${turnCount}/15)`,
          details: `步骤 ${generationSteps.length} | 思考 ${agentThinking.length} | ${lastAssistantText.slice(0, 80)}...`,
          thinking: agentThinking.slice(-3), // 只保留最新的3个思考
          steps: generationSteps.slice(-5), // 只保留最新的5个步骤
          currentTurn: turnCount,
          maxTurns: 15,
        })
      } else if (message.type === 'result') {
        if (message.subtype === 'success' && message.result) {
          fullOutput = message.result
        }
      }

      // 超时保护：超过15轮还未完成，强制结束
      if (turnCount >= 15 && !fullOutput.trim()) {
        throw new Error(`Agent 运行超时，已进行 ${turnCount} 轮仍未产出结果`)
      }
    }

    updateProgress({
      stage: 'validating',
      progress: 80,
      message: '正在验证游戏代码...',
    })

    // 解析输出
    const parsedGame = parseGameOutput(fullOutput)

    if (!parsedGame) {
      console.error('[GameGenerator] 无法解析游戏输出')
      console.error('[GameGenerator] 原始输出:', fullOutput.slice(0, 1000))
      throw new Error('无法解析游戏输出，输出格式不正确')
    }

    if (!parsedGame.componentCode) {
      console.error('[GameGenerator] 缺少 componentCode 字段')
      console.error('[GameGenerator] 解析结果:', parsedGame)
      throw new Error('游戏输出缺少 componentCode 字段')
    }

    // 验证代码
    const validation = validateGameCode(parsedGame.componentCode)
    if (!validation.valid) {
      console.warn('[GameGenerator] 代码验证警告:', validation.errors)
    }

    const generationTime = Date.now() - startTime

    updateProgress({
      stage: 'complete',
      progress: 100,
      message: '游戏生成完成！',
    })

    // 构建最终游戏对象
    const game: GeneratedGame = {
      id: `game-${input.nodeId}-${Date.now()}`,
      videoId: input.videoId,
      nodeId: input.nodeId,
      title: parsedGame.title || `${input.nodeTitle} 互动游戏`,
      description: parsedGame.description || '',
      gameType: (parsedGame.gameType as GameType) || 'custom',
      difficulty: (parsedGame.difficulty as GameDifficulty) || 'medium',
      estimatedPlayTime: parsedGame.estimatedPlayTime || 120,
      mathConcepts: parsedGame.mathConcepts || input.keyConcepts,
      learningObjectives: parsedGame.learningObjectives || [],
      componentCode: parsedGame.componentCode,
      instructions: parsedGame.instructions || '',
      hints: parsedGame.hints || [],
      generatedAt: new Date().toISOString(),
      agentModel: GAME_AGENT_MODEL,
      generationTimeMs: generationTime,
    }

    return game
  } catch (error) {
    updateProgress({
      stage: 'error',
      progress: 0,
      message: `游戏生成失败: ${error instanceof Error ? error.message : '未知错误'}`,
    })

    throw error
  }
}

/**
 * 批量为视频节点生成游戏
 */
export async function generateGamesForVideo(
  videoId: string,
  videoTitle: string,
  nodes: Array<{
    id: string
    title: string
    summary: string
    transcript: string
    keyConcepts: string[]
    nodeType: string
  }>,
  config: GameGeneratorConfig = {}
): Promise<GeneratedGame[]> {
  const games: GeneratedGame[] = []

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    console.log(`[GameGenerator] 生成游戏 ${i + 1}/${nodes.length}: ${node.title}`)

    try {
      const game = await generateGame(
        {
          videoId,
          videoTitle,
          nodeId: node.id,
          nodeTitle: node.title,
          nodeSummary: node.summary,
          nodeTranscript: node.transcript,
          keyConcepts: node.keyConcepts,
          nodeType: node.nodeType,
          targetAgeGroup: '12-15岁',
          subjectArea: '数学',
        },
        config
      )

      games.push(game)
    } catch (error) {
      console.error(`[GameGenerator] 节点 ${node.title} 游戏生成失败:`, error)
      // 继续处理下一个节点
    }
  }

  return games
}
