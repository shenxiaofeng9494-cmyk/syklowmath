import OpenAI from 'openai'

// 向量维度
const EMBEDDING_DIMENSIONS = 1024

// 阿里云 DashScope 客户端
const dashscopeClient = process.env.DASHSCOPE_API_KEY
  ? new OpenAI({
      apiKey: process.env.DASHSCOPE_API_KEY,
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    })
  : null

// OpenAI 客户端 (作为备用)
const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null

/**
 * 使用 DashScope API 生成向量
 */
async function generateEmbeddingWithDashScope(text: string): Promise<number[]> {
  if (!dashscopeClient) {
    throw new Error('DashScope client not available')
  }

  const response = await dashscopeClient.embeddings.create({
    model: 'text-embedding-v4',
    input: text,
    dimensions: EMBEDDING_DIMENSIONS,
  })

  return response.data[0].embedding
}

/**
 * 使用 OpenAI API 生成向量 (备用方案)
 */
async function generateEmbeddingWithOpenAI(text: string): Promise<number[]> {
  if (!openaiClient) {
    throw new Error('OpenAI client not available')
  }

  const response = await openaiClient.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: EMBEDDING_DIMENSIONS,
  })

  return response.data[0].embedding
}

/**
 * 生成单个文本的向量表示
 * 优先使用 DashScope，失败时自动回退到 OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // 优先尝试 DashScope
  if (dashscopeClient) {
    try {
      return await generateEmbeddingWithDashScope(text)
    } catch (error) {
      console.warn('DashScope embedding failed, falling back to OpenAI:', error)
    }
  }

  // 回退到 OpenAI
  if (openaiClient) {
    return await generateEmbeddingWithOpenAI(text)
  }

  throw new Error('No embedding API available. Please set DASHSCOPE_API_KEY or OPENAI_API_KEY.')
}

/**
 * 批量生成文本向量
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const batchSize = 10
  const results: number[][] = []

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)

    // 逐个生成 (利用 generateEmbedding 的回退机制)
    for (const text of batch) {
      const embedding = await generateEmbedding(text)
      results.push(embedding)
    }
  }

  return results
}

/**
 * 生成用于检索的文本向量（适用于查询）
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const formattedQuery = `查询: ${query}`
  return generateEmbedding(formattedQuery)
}

/**
 * 生成用于存储的文本向量（适用于文档）
 */
export async function generateDocumentEmbedding(
  summary: string,
  keyConcepts: string[]
): Promise<number[]> {
  const text = `${summary} 关键词: ${keyConcepts.join(', ')}`
  return generateEmbedding(text)
}
