import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * 初始化老师介入会话
 * POST /api/voice/intervention
 *
 * 当视频播放到必停点且学生沉默时，系统调用此API初始化一个特殊的语音会话
 * AI会以"老师点名"的方式主动提问
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      videoId,
      nodeId,
      checkpointType,
      question,
      expectedAnswer,
      followup
    } = body

    // 验证必填字段
    if (!videoId || !nodeId || !question) {
      return NextResponse.json(
        { error: '缺少必填字段：videoId, nodeId, question' },
        { status: 400 }
      )
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase未配置' },
        { status: 500 }
      )
    }

    // 获取视频节点信息
    const { data: node, error: nodeError } = await supabase
      .from('video_nodes')
      .select('*')
      .eq('id', nodeId)
      .single()

    if (nodeError || !node) {
      return NextResponse.json(
        { error: '节点不存在', details: nodeError?.message },
        { status: 404 }
      )
    }

    // 获取视频上下文（用于RAG）
    const { data: contextData, error: contextError } = await fetch(
      `${request.nextUrl.origin}/api/video/${videoId}/context?nodeId=${nodeId}`
    ).then(res => res.json())

    if (contextError) {
      console.warn('获取视频上下文失败:', contextError)
    }

    // 构建介入模式的系统提示词
    const interventionPrompt = buildInterventionPrompt({
      checkpointType,
      question,
      expectedAnswer,
      followup,
      node,
      context: contextData
    })

    // 生成会话ID
    const sessionId = `intervention-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // 返回会话配置
    return NextResponse.json({
      success: true,
      sessionId,
      interventionMode: true,
      checkpoint: {
        type: checkpointType,
        question,
        expectedAnswer,
        followup,
        node: {
          id: node.id,
          title: node.title,
          summary: node.summary
        }
      },
      systemPrompt: interventionPrompt,
      message: '介入会话已初始化'
    })
  } catch (error) {
    console.error('初始化介入会话异常:', error)
    return NextResponse.json(
      { error: '服务器错误', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * 构建介入模式的系统提示词
 */
function buildInterventionPrompt({
  checkpointType,
  question,
  expectedAnswer,
  followup,
  node,
  context
}: {
  checkpointType: string
  question: string
  expectedAnswer: string
  followup?: string | null
  node: any
  context?: any
}): string {
  const basePrompt = `# 角色定位
你是一位经验丰富的数学老师，正在进行"Voice-First主动介入"教学。

# 当前情境
学生正在观看视频《${node.title}》，视频播放到了一个**关键知识点**（${getCheckpointTypeName(checkpointType)}）。
学生在这个节点结束后保持沉默，没有主动提问。

作为老师，你判断：**这个知识点如果不确认，学生后面一定会断层**。
所以你主动暂停视频，"点名"学生回答问题。

# 介入类型
${getCheckpointTypeDescription(checkpointType)}

# 你的任务
1. **直接提问**（不要寒暄，不要解释为什么问）
   - 用语音说出这个问题：
   "${question}"

2. **等待学生回答**
   - 期望答案类型：${getExpectedAnswerDescription(expectedAnswer)}
   - 学生必须开口说话，不允许沉默跳过

3. **判断式收束**（不展开讲解）
   - 如果学生答对：简短确认，如"对，继续。"
   - 如果学生答错：简短纠正，如"不对，因为[一句话原因]。继续。"
   - 不要展开讲解，只做判断

${followup ? `4. **追问验证**（防止蒙对）
   - 学生回答后，立即追问：
   "${followup}"
   - 这是验证学生是否真懂，不是蒙对的` : ''}

# 语音风格
- **简短**：每句话不超过30秒
- **判断式**：像老师点名一样直接
- **不展开**：只确认理解，不讲解知识
- **强制性**：学生必须回答才能继续

# 视频上下文
${context ? `
节点标题：${node.title}
节点摘要：${node.summary}
关键概念：${node.key_concepts?.join('、') || '无'}
` : ''}

# 重要提醒
- 这不是"你要不要想一想"，而是"你必须回答"
- 这不是"有问题吗"，而是"我问你一个问题"
- 这不是教学，而是验证理解

现在，直接开始提问。`

  return basePrompt
}

/**
 * 获取检查点类型名称
 */
function getCheckpointTypeName(type: string): string {
  const names: Record<string, string> = {
    motivation: '动机确认',
    definition: '定义验证',
    pitfall: '易错点检查',
    summary: '总结确认',
    verification: '理解验证'
  }
  return names[type] || '知识点检查'
}

/**
 * 获取检查点类型描述
 */
function getCheckpointTypeDescription(type: string): string {
  const descriptions: Record<string, string> = {
    motivation: '这是动机段，学生容易"听完觉得有道理"，但没意识到核心问题。',
    definition: '这是定义讲解，学生容易误解关键概念，导致后续全错。',
    pitfall: '这是易错点，学生几乎不会主动问，但考试必炸。',
    summary: '这是总结段，需要验证学生是否真正掌握。',
    verification: '这是验证点，需要确认学生理解程度。'
  }
  return descriptions[type] || '这是关键知识点，需要确认学生理解。'
}

/**
 * 获取期望答案类型描述
 */
function getExpectedAnswerDescription(type: string): string {
  const descriptions: Record<string, string> = {
    yes_no: '是/否 或 对/不对',
    short_answer: '简短回答（1-2句话）',
    multiple_choice: '选择题（A/B/C/D）'
  }
  return descriptions[type] || '简短回答'
}
