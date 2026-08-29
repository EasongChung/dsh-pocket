// dsh-web-mobile 移植（MIT，见 LICENSE.dsh-web-mobile）：移动端「复制文件内容」按钮。
//
// issue #17：用户希望手机上能拿到 DSH 在会话窗口里生成的文件。但当前 dsh-web
// 的 web UI 没有任何下载能力（全部插件 bundle 里搜不到 download / blob: /
// saveAs / createObjectURL），桌面端的下载按钮在手机经隧道/局域网访问时也拿
// 不到文件内容。退而求其次——在「文件内容块」（对话里渲染为 <pre> 代码块）的
// 右上角注入一个复制按钮，把块内文本（即文件内容）写入剪贴板。
//
// 关键：只依赖稳定结构 `<pre>`（fenced code 渲染为 `<pre><code>`），不依赖任何
// hash 类名。dsh-web 每次构建都会换类名，按类名挂会随版本失效。

/** 我们注入的按钮标记（复用 mobile-nav 的 data 属性命名空间，避免与插件自身控件冲突）。 */
const BUTTON_ATTR = 'data-mobile-nav';
const BUTTON_VALUE = 'copy-file';
/** 打在代码块容器上：已注入过按钮就不再重复注入（React 重渲染时自愈）。 */
const MARKER = 'data-mobile-nav-copy';

/**
 * 把文本写入剪贴板。优先用 async Clipboard API（隧道/https 下可用）；非安全
 * 上下文（局域网 http）下 Clipboard API 会被浏览器拒绝，回退到隐藏 textarea +
 * execCommand('copy')。两者都失败返回 false。
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 落到下面的回退路径 */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** 造一个复制按钮。点击时复制其所在代码卡里的 <pre> 文本。 */
function createCopyButton(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute(BUTTON_ATTR, BUTTON_VALUE);
  btn.textContent = '复制';
  btn.setAttribute('aria-label', '复制文件内容');
  btn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const card = btn.parentElement;
    const block = card?.querySelector('pre') ?? null;
    const text = block?.textContent ?? '';
    const ok = await copyText(text);
    const prev = btn.textContent;
    btn.textContent = ok ? '已复制' : '复制失败';
    btn.setAttribute('data-copied', ok ? '1' : '0');
    window.setTimeout(() => {
      btn.textContent = prev;
      btn.removeAttribute('data-copied');
    }, 1500);
  });
  return btn;
}

/** 给一个代码块容器注入复制按钮（幂等）。 */
function injectInto(card: HTMLElement): void {
  if (card.hasAttribute(MARKER)) return;
  card.setAttribute(MARKER, '1');
  if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
  card.appendChild(createCopyButton());
}

/**
 * 收集对话里需要挂复制按钮的代码块容器。候选 = 任何 `<pre>`（fenced code 与
 * 工具结果/错误块都渲染为 <pre>），跳过已标记 / 空块。返回的是其「容器」
 * （pre 的父元素），按钮挂在容器上、定位在块右上角。
 */
export function collectCodeBlocks(root: ParentNode): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const pre of Array.from(root.querySelectorAll('pre'))) {
    const card = pre.parentElement;
    if (card === null) continue;
    if (card.hasAttribute(MARKER)) continue;
    if ((pre.textContent ?? '').trim().length < 1) continue;
    out.push(card);
  }
  return out;
}

/**
 * 启动注入：MutationObserver 监听全文 DOM，新出现的代码块立即挂按钮；React
 * 重渲染替换了容器时旧按钮随容器消失、新容器会在下次回调里补上（自愈）。
 * @returns 清理函数（断开 observer）。
 */
export function startFileCopyInjection(): () => void {
  const scan = (): void => {
    for (const card of collectCodeBlocks(document)) injectInto(card);
  };
  const observer = new MutationObserver(scan);
  observer.observe(document.body, { childList: true, subtree: true });
  scan();
  return () => {
    observer.disconnect();
  };
}
