/**
 * 短信验证码发送
 * - 生产模式：通过阿里云短信 API 发送
 * - 开发模式：OTP 打印到 server console
 */

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function sendSmsOtp(phone: string, code: string): Promise<boolean> {
  const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID
  const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET
  const signName = process.env.ALIYUN_SMS_SIGN_NAME
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE

  // 开发模式：未配置短信凭证时打印到控制台
  if (!accessKeyId || !accessKeySecret) {
    console.log(`\n========================================`)
    console.log(`[DEV SMS] OTP for ${phone}: ${code}`)
    console.log(`========================================\n`)
    return true
  }

  // 生产模式：阿里云短信 API
  try {
    const params: Record<string, string> = {
      AccessKeyId: accessKeyId,
      Action: 'SendSms',
      Format: 'JSON',
      PhoneNumbers: phone,
      SignName: signName || 'MathTalkTV',
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: Math.random().toString(36).slice(2),
      SignatureVersion: '1.0',
      TemplateCode: templateCode || '',
      TemplateParam: JSON.stringify({ code }),
      Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      Version: '2017-05-25',
    }

    // 构建签名字符串
    const sortedKeys = Object.keys(params).sort()
    const canonicalQuery = sortedKeys
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join('&')
    const stringToSign = `GET&${encodeURIComponent('/')}&${encodeURIComponent(canonicalQuery)}`

    // HMAC-SHA1 签名
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(accessKeySecret + '&'),
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    )
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign))
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))

    params.Signature = signatureBase64

    const queryString = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')

    const response = await fetch(`https://dysmsapi.aliyuncs.com/?${queryString}`)
    const result = await response.json()

    if (result.Code === 'OK') {
      console.log(`[SMS] OTP sent to ${phone}`)
      return true
    } else {
      console.error(`[SMS] Failed to send OTP:`, result)
      return false
    }
  } catch (error) {
    console.error(`[SMS] Error sending OTP:`, error)
    return false
  }
}
