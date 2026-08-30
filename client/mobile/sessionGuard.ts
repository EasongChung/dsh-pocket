// 公网会话指纹校验（issue #82，防密码被钓）。
//
// 本代理会给每个经它伺服的 HTML（应用页 + 登录页）注入
// <meta name="dsh-pocket-session" content="<本次进程随机指纹>">。该指纹只在本机
// 代理内生成、只出现在我们伺服的页面，陌生人复用被回收的快速隧道子域时（其站点
// 不经我们的代理）拿不到它、也猜不出。
//
// 校验逻辑（纯前端、不依赖任何外部请求，避免被钓鱼站点误导）：
//   - 页面带指纹 meta → 这是我们的页面，显示一个小徽标供用户与电脑设置页交叉核对
//     （不一致即说明链接被复用）；
//   - 页面不带指纹 meta → 很可能不是我们的页面（链接已被他人复用，或克隆登录页钓鱼），
//     弹红色全屏警告并拦截交互，防止用户在被钓鱼页输入 8 位密码。

const SESSION_META = 'dsh-pocket-session'
const ACCESS_META = 'dsh-pocket-access'

function readFingerprint(): string | null {
  const meta = document.querySelector<HTMLMetaElement>(`meta[name="${SESSION_META}"]`)
  const fp = meta?.content?.trim()
  return fp && fp.length > 0 ? fp : null
}

/** 读取代理注入的访问类型标记（public | lan）。 */
function readAccess(): string | null {
  const meta = document.querySelector<HTMLMetaElement>(`meta[name="${ACCESS_META}"]`)
  return meta?.content?.trim() ?? null
}

function mountBadge(fp: string): () => void {
  const badge = document.createElement('div')
  badge.setAttribute('data-mobile-nav', 'session-fp')
  badge.textContent = `🔒 会话指纹 ${fp}`
  // 固定在底部居中、低存在感、仅供交叉核对
  badge.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:8px', 'transform:translateX(-50%)',
    'z-index:2147483646', 'padding:4px 10px', 'border-radius:999px',
    'background:rgba(17,24,39,.82)', 'color:#fff',
    'font:12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'letter-spacing:.5px', 'pointer-events:none', 'user-select:none', 'white-space:nowrap',
  ].join(';')
  badge.title = '本页会话指纹，应与电脑「手机访问」设置页显示的一致；不一致说明链接已被他人复用'
  document.body.appendChild(badge)
  return () => badge.remove()
}

function mountWarning(): () => void {
  const overlay = document.createElement('div')
  overlay.setAttribute('data-mobile-nav', 'session-warn')
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483647',
    'display:flex', 'align-items:center', 'justify-content:center', 'padding:24px',
    'background:rgba(0,0,0,.72)', 'color:#fff',
    'font:15px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', 'text-align:center',
  ].join(';')
  overlay.style.whiteSpace = 'pre-line'
  overlay.textContent = '⚠️ 此页面不是你的 DSH：链接可能已被他人复用。\n请勿在此输入任何密码。\n请重新在电脑「手机访问」设置页扫当前二维码。'
  document.documentElement.appendChild(overlay)
  return () => overlay.remove()
}

export function startSessionGuard(): () => void {
  // 局域网访问不存在「快速隧道子域被 Cloudflare 回收复用」的风险（issue #83），
  // 防钓鱼校验只在公网启用；局域网直接不挂，避免误报阻断用户使用。
  if (readAccess() !== 'public') return () => {}

  let cleanupBadge: (() => void) | null = null
  let cleanupWarn: (() => void) | null = null
  const evaluate = (): void => {
    const fp = readFingerprint()
    if (fp) {
      cleanupWarn?.()
      cleanupWarn = null
      if (!cleanupBadge) cleanupBadge = mountBadge(fp)
    } else {
      cleanupBadge?.()
      cleanupBadge = null
      if (!cleanupWarn) cleanupWarn = mountWarning()
    }
  }
  evaluate()
  // 容错：极少数情况下 meta 在 effect 运行时尚未解析，稍后复查一次
  const timer = window.setTimeout(evaluate, 300)
  const observer = new MutationObserver(evaluate)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  return () => {
    window.clearTimeout(timer)
    observer.disconnect()
    cleanupBadge?.()
    cleanupWarn?.()
  }
}
