// 复制文件内容按钮（issue #17）：手机上下载入口不可用，改为在代码/文件块右上角
// 注入复制按钮。测试只验证「接线 + 健壮性（不依赖 hash 类名）+ 打包产物含逻辑」，
// 与 mobile-nav.test.js 同风格（不引 jsdom，直接读源码/产物做断言）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../client/mobile/fileCopy.ts', import.meta.url), 'utf8');
const apply = readFileSync(new URL('../client/mobile/mobile-apply.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../client/mobile/mobile.css.ts', import.meta.url), 'utf8');
const bundle = readFileSync(new URL('../client/client.js', import.meta.url), 'utf8');

test('检测只依赖稳定结构 <pre>，不依赖任何 hash 类名', () => {
  assert.ok(src.includes("querySelectorAll('pre')"), '必须用 querySelectorAll("pre") 找代码块');
  // hash 类名形如 _AbC12_ 或 [class$="_xxx"]；检测逻辑里绝不能出现按类名的属性选择器
  assert.ok(
    !/\[class[*^$]?=/.test(src),
    'MobileFileCopy.ts 的检测逻辑不能出现 class 属性选择器（hash 类名每次构建都变，会失效）',
  );
});

test('mobile-apply 已接线 startFileCopyInjection（窄屏生效）', () => {
  assert.ok(apply.includes("import { startFileCopyInjection } from './fileCopy.ts'"), '必须 import 模块');
  assert.ok(apply.includes('startFileCopyInjection()'), '必须调用 startFileCopyInjection');
  assert.ok(
    apply.includes("'dsh-mobile-nav: file copy button (issue #17)'"),
    'effect 标签应标注 issue #17，便于溯源',
  );
  // 窄屏门控：桌面端 DSH 自带复制，不该重复挂。effect 体在标签之前，故分别确认
  // 三者同处一个 effect（narrow 门控 + 调用 + issue 标签）。
  assert.ok(apply.includes('if (!narrow.matches) return'), '复制按钮 effect 必须受 narrow 门控');
});

test('打包产物含复制按钮标记与复制逻辑', () => {
  assert.ok(bundle.includes('data-mobile-nav="copy-file"'), '产物缺少 copy-file 按钮标记——先跑 npm run build:client');
  assert.ok(/querySelectorAll\(\s*["']pre["']\s*\)/.test(bundle), '产物里必须保留 querySelectorAll("pre") 检测');
  // 复制逻辑：优先 Clipboard API，回退 execCommand（非安全上下文，如局域网 http）
  assert.ok(bundle.includes('clipboard') || bundle.includes('execCommand'), '产物必须含复制实现（clipboard 或 execCommand）');
});

test('CSS 含 copy-file 按钮样式（窄屏）', () => {
  assert.ok(css.includes('[data-mobile-nav="copy-file"]'), 'mobile.css.ts 必须有 copy-file 按钮规则');
  assert.ok(css.includes('data-copied="1"'), '复制成功态样式缺失');
});
