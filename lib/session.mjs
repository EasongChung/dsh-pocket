// 公网会话指纹（防密码被钓，issue #82）。
//
// 每次 dsh web 进程启动生成一次，随机、不可预测。只经本代理注入到我们伺服的
// HTML（应用页 + 登录页），并显示在电脑「手机访问」设置页——永不落盘、不进日志、
// 不出现在任何静态产物里。
//
// 快速隧道子域被 Cloudflare 回收、分给陌生人后，陌生人的站点不经我们的代理，
// 拿不到这个指纹、也猜不出。于是其克隆的登录页要么没有指纹、要么指纹对不上：
// 用户在手机登录页看到的指纹若与电脑设置页不一致，即说明链接已被他人复用，
// 不应输入密码。这是"密码不防回收"之外，真正能拦住密码钓鱼的一层。

import { randomBytes } from 'node:crypto'

let fingerprint = null

/**
 * 惰性生成并返回本次进程的会话指纹（多次调用返回同一值）。
 * @returns {string} 6 位大写字母/数字指纹
 */
export function ensureSessionFingerprint() {
  if (!fingerprint) {
    let s = ''
    while (s.length < 6) {
      // base64 含 + / 等非字母数字字符，只保留 A-Z0-9 并转大写
      s += randomBytes(6).toString('base64').replace(/[^A-Z0-9]/gi, '').toUpperCase()
    }
    fingerprint = s.slice(0, 6)
  }
  return fingerprint
}

/** 读取已生成的指纹（代理尚未启动时返回 null）。 */
export function getSessionFingerprint() {
  return fingerprint
}
