/**
 * 火山引擎 API 签名认证模块
 *
 * 火山引擎使用 AWS Signature V4 风格的签名认证
 * 参考文档: https://www.volcengine.com/docs/6469/97440
 */

import crypto from 'crypto'

interface SignatureParams {
  method: string
  host: string
  path: string
  query: Record<string, string>
  headers: Record<string, string>
  body: string
  accessKeyId: string
  accessKeySecret: string
  region?: string
  service?: string
}

/**
 * 计算 HMAC-SHA256
 */
function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest()
}

/**
 * 计算 SHA256 哈希
 */
function sha256(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex')
}

/**
 * URI 编码（符合 AWS 签名规范）
 */
function uriEncode(str: string, encodeSlash = true): string {
  const encoded = encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')

  if (!encodeSlash) {
    return encoded.replace(/%2F/g, '/')
  }
  return encoded
}

/**
 * 格式化日期为 ISO 8601 基本格式
 */
function formatDate(date: Date): { dateStamp: string; amzDate: string } {
  const isoString = date.toISOString().replace(/[:-]|\.\d{3}/g, '')
  return {
    dateStamp: isoString.slice(0, 8),
    amzDate: isoString.slice(0, 15) + 'Z',
  }
}

/**
 * 构建规范请求字符串
 */
function buildCanonicalRequest(
  method: string,
  path: string,
  query: Record<string, string>,
  headers: Record<string, string>,
  signedHeaders: string[],
  payloadHash: string
): string {
  // 规范化 URI
  const canonicalUri = uriEncode(path, false)

  // 规范化查询字符串
  const sortedQuery = Object.keys(query)
    .sort()
    .map((key) => `${uriEncode(key)}=${uriEncode(query[key])}`)
    .join('&')

  // 规范化请求头
  const canonicalHeaders = signedHeaders
    .map((key) => `${key.toLowerCase()}:${headers[key].trim()}\n`)
    .join('')

  // 签名头列表
  const signedHeadersStr = signedHeaders.map((h) => h.toLowerCase()).join(';')

  return [
    method,
    canonicalUri,
    sortedQuery,
    canonicalHeaders,
    signedHeadersStr,
    payloadHash,
  ].join('\n')
}

/**
 * 构建待签名字符串
 */
function buildStringToSign(
  amzDate: string,
  dateStamp: string,
  region: string,
  service: string,
  canonicalRequestHash: string
): string {
  const credentialScope = `${dateStamp}/${region}/${service}/request`
  return ['HMAC-SHA256', amzDate, credentialScope, canonicalRequestHash].join('\n')
}

/**
 * 计算签名密钥
 */
function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string
): Buffer {
  const kDate = hmacSha256(secretKey, dateStamp)
  const kRegion = hmacSha256(kDate, region)
  const kService = hmacSha256(kRegion, service)
  const kSigning = hmacSha256(kService, 'request')
  return kSigning
}

/**
 * 为火山引擎 API 请求生成签名头
 */
export function signVolcengineRequest(params: SignatureParams): Record<string, string> {
  const {
    method,
    host,
    path,
    query,
    headers: inputHeaders,
    body,
    accessKeyId,
    accessKeySecret,
    region = 'cn-north-1',
    service = 'vod',
  } = params

  const now = new Date()
  const { dateStamp, amzDate } = formatDate(now)

  // 计算请求体哈希
  const payloadHash = sha256(body)

  // 构建请求头
  const headers: Record<string, string> = {
    ...inputHeaders,
    host,
    'x-date': amzDate,
    'x-content-sha256': payloadHash,
  }

  // 确定要签名的头
  const signedHeaders = ['host', 'x-content-sha256', 'x-date']
  if (headers['content-type']) {
    signedHeaders.push('content-type')
  }
  signedHeaders.sort()

  // 构建规范请求
  const canonicalRequest = buildCanonicalRequest(
    method,
    path,
    query,
    headers,
    signedHeaders,
    payloadHash
  )

  // 构建待签名字符串
  const canonicalRequestHash = sha256(canonicalRequest)
  const stringToSign = buildStringToSign(
    amzDate,
    dateStamp,
    region,
    service,
    canonicalRequestHash
  )

  // 计算签名
  const signingKey = getSignatureKey(accessKeySecret, dateStamp, region, service)
  const signature = hmacSha256(signingKey, stringToSign).toString('hex')

  // 构建 Authorization 头
  const credentialScope = `${dateStamp}/${region}/${service}/request`
  const signedHeadersStr = signedHeaders.join(';')
  const authorization = `HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`

  return {
    ...headers,
    Authorization: authorization,
  }
}

/**
 * 构建火山引擎 API 请求 URL
 */
export function buildVolcengineUrl(
  host: string,
  path: string,
  query: Record<string, string>
): string {
  const queryString = Object.keys(query)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
    .join('&')
  return `https://${host}${path}?${queryString}`
}
