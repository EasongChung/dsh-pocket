// 手机端「⛶ 放大输入」开关（issue #23）
//
// 行为：
//  - 点击切换 body 属性 `data-dsh-pocket-composer-fullscreen`；
//  - mobile.css.ts 监听这个属性，把 composer 卡片固定到全屏（textarea 拉高、工具行
//    全部展开），插件 UI 注册到 conversation.input.* slot 的按钮全部恢复显示；
//  - 默认（无 fullscreen 属性）下，CSS 把这些 slot 全部隐藏，只保留官方 resident
//    chrome（权限/plan/模型/发送）。新插件只要注册到 input slot 就自动遵守此规则，
//    无需逐个适配。
//
// 实现细节：
//  - 不依赖 dsh web 把 data-slot 包装暴露给选择器（0.1.1 没，0.1.2+ 才有）。我们用
//    `:scope > :not([data-mobile-nav-keep])` 这样的「保留」标记：所有插件如果
//    想在手机未放大时也露出，加 data-mobile-nav-keep="1" 即可。默认隐藏的是
//    slot 容器下的所有直接子元素，**包含 dsh web 官方自己注入的**（这些是
//    我们想隐藏的"插件 UI"——只要不冲突）。所以需要 dsh web 在官方自己的 UI 上
//    加 `data-mobile-nav-keep` 标记——等 dsh 0.1.2+ data-slot 上线后改用那个
//    更优雅（CSS 选择器变成 `[data-slot=...] > :not([data-mobile-nav-keep])`）。
import { createElement as h, useEffect, useState } from 'react';

const FULLSCREEN_ATTR = 'data-dsh-pocket-composer-fullscreen';

function isFullscreen() {
  return typeof document !== 'undefined' && document.body?.getAttribute(FULLSCREEN_ATTR) === '1';
}

function setFullscreen(on) {
  if (typeof document === 'undefined') return;
  if (on) document.body.setAttribute(FULLSCREEN_ATTR, '1');
  else document.body.removeAttribute(FULLSCREEN_ATTR);
}

/**
 * 放大输入按钮：注册到 `conversation.input.right`，id `mobile-composer-fullscreen`。
 * 仅在窄屏（max-width:1023px）显示，桌面端由 CSS 隐藏。
 */
export function MobileComposerFullscreen() {
  const [on, setOn] = useState(isFullscreen);
  useEffect(() => {
    const update = () => setOn(isFullscreen());
    // 与其它 effect 协调：监听任何对 body 属性的修改即可（设置项自己改也算）
    const observer = new MutationObserver(update);
    observer.observe(document.body, { attributes: true, attributeFilter: [FULLSCREEN_ATTR] });
    return () => observer.disconnect();
  }, []);
  return h('button', {
    type: 'button',
    'aria-label': on ? '收起输入' : '放大输入',
    'aria-pressed': on,
    title: on ? '收起输入' : '放大输入',
    'data-mobile-nav': 'composer-fullscreen',
    'data-mobile-nav-keep': '1', // 自己的按钮不该被 #23 的 slot 通用隐藏规则误伤
    onClick: () => {
      const next = !isFullscreen();
      setFullscreen(next);
      setOn(next);
    },
    style: {
      appearance: 'none',
      WebkitAppearance: 'none',
      border: 'none',
      background: 'transparent',
      color: 'inherit',
      cursor: 'pointer',
      padding: '0 8px',
      height: 32,
      minWidth: 32,
      borderRadius: 6,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: 'inherit',
      fontSize: 16,
      lineHeight: 1,
    },
  }, on ? '⤡' : '⤢');
}
