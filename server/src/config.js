// 投票系统后端配置
export const config = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'vote-system-secret-2026-change-in-prod',
  jwtExpire: '7d',
  dbPath: './data/vote.db',
  // 防作弊规则
  antiCheat: {
    ipMinIntervalSec: 8,
    ipMaxPerHour: 40,
    deviceMaxPerVote: 1,
    triggerCaptchaAfter: 5
  },
  captcha: { width: 120, height: 40, fontSize: 40, charCount: 4 },
  // ============ 短信网关（生产环境配置后自动启用真实发送）============
  sms: {
    apiKey: process.env.SMS_API_KEY || '',     // 空=开发模式（验证码打印到控制台）
    apiUrl: process.env.SMS_API_URL || '',
    sign: process.env.SMS_SIGN || '投票系统'
  },
  // ============ 邮件 SMTP（生产环境配置后自动启用真实发送）============
  mail: {
    smtp: process.env.MAIL_SMTP || '',          // 例: smtp.qq.com
    port: +process.env.MAIL_PORT || 465,
    user: process.env.MAIL_USER || '',
    pass: process.env.MAIL_PASS || '',
    from: process.env.MAIL_FROM || ''
  },
  // ============ 微信开放平台扫码登录 ============
  wechat: {
    appId: process.env.WECHAT_APP_ID || '',     // 空=开发模式（模拟扫码）
    appSecret: process.env.WECHAT_APP_SECRET || '',
    redirectUri: process.env.WECHAT_REDIRECT || 'http://localhost:5173/login?from=wechat',
    // 开发模式：模拟扫码后会用此 openid 创建/登录用户
    devMockOpenid: 'wx_dev_openid_demo'
  },
  // ============ QQ 互联 ============
  qq: {
    appId: process.env.QQ_APP_ID || '',
    appKey: process.env.QQ_APP_KEY || '',
    redirectUri: process.env.QQ_REDIRECT || 'http://localhost:5173/login?from=qq',
    devMockOpenid: 'qq_dev_openid_demo'
  }
};
