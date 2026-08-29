// dsh-pocket 设置持久化（$DSH_HOME/dsh-pocket/settings.json）
//
// 当前项：
//   - lanEnabled        局域网访问总开关（默认开启）：关闭后局域网扫码/链接直接失效（代理拒绝局域网 Host）
//   - lanAuthEnabled    局域网访问密码开关（issue #24），默认开启
//   - publicPinCustom   公网密码是否用户自定义（issue #33），自定义后不自动轮换
//   - lanPinCustom      局域网密码是否用户自定义（issue #33）
//   - tunnelMode        公网隧道模式（issue #66）：'quick'（默认，随机 trycloudflare.com）| 'named'（固定域名）
//   - tunnelToken       Cloudflare 命名隧道 Token（issue #66，秘密；文件 0o600，RPC 不回显）
//   - tunnelHostname    命名隧道绑定的固定域名（issue #66，如 pocket.example.com）
// 默认**开启**（安全优先）：局域网扫码也要输 8 位密码；
// 用户可关闭——关闭后局域网扫码直连（仅同一网络内的设备能访问），公网不受影响（永远要密码）。

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { isValidIpv4 } from './ip.mjs';

const settingsRel = join('dsh-pocket', 'settings.json');
export function settingsPath() {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), settingsRel);
}

function readSettings() {
  try {
    const raw = JSON.parse(readFileSync(settingsPath(), 'utf8'));
    return raw && typeof raw === 'object' ? raw : {};
  } catch { /* 无文件/损坏 → 默认 */ }
  return {};
}

function writeSettings(s) {
  try {
    mkdirSync(dirname(settingsPath()), { recursive: true });
    writeFileSync(settingsPath(), JSON.stringify(s, null, 2), { mode: 0o600 });
  } catch { /* 忽略 */ }
  return s;
}

/** 局域网访问总开关：默认开启（文件缺失/损坏都视为开启）。 */
export function lanEnabled() {
  return readSettings().lanEnabled !== false;
}

/** 设置局域网访问总开关，返回新状态（持久化）。 */
export function setLanEnabled(on) {
  const s = readSettings();
  s.lanEnabled = !!on;
  writeSettings(s);
  return s.lanEnabled;
}

/** 局域网访问密码开关：默认开启（文件缺失/损坏都视为开启）。 */
export function lanAuthEnabled() {
  return readSettings().lanAuthEnabled !== false;
}

/** 设置局域网访问密码开关，返回新状态（持久化）。 */
export function setLanAuthEnabled(on) {
  const s = readSettings();
  s.lanAuthEnabled = !!on;
  writeSettings(s);
  return s.lanAuthEnabled;
}

/** 局域网地址手动覆盖：默认空字符串 = 自动选择。 */
export function lanIpOverride() {
  return readSettings().lanIpOverride ?? '';
}

/** 设置局域网地址覆盖；空字符串清除覆盖，恢复自动选择。非法 IPv4 抛错。 */
export function setLanIpOverride(value) {
  const ip = String(value ?? '').trim();
  if (ip && !isValidIpv4(ip)) {
    throw new Error('局域网地址必须是 IPv4 地址 | LAN address must be an IPv4 address');
  }
  const s = readSettings();
  if (ip) s.lanIpOverride = ip;
  else delete s.lanIpOverride;
  writeSettings(s);
  return ip;
}

// ---------- 访问密码「自定义」标记（issue #33） ----------
// 用户可把公网/局域网密码设成自己固定的 8 位密码（英文字母大小写或数字；自定义后不再自动轮换）。
// 标记存 settings.json：publicPinCustom / lanPinCustom。
const PIN_CUSTOM_KEYS = { public: 'publicPinCustom', lan: 'lanPinCustom' };

/** 该 PIN（public | lan）是否用户自定义过（自定义后不自动轮换）。 */
export function pinCustom(which) {
  const key = PIN_CUSTOM_KEYS[which];
  if (!key) return false;
  return readSettings()[key] === true;
}

/** 设置自定义标记，返回新状态。 */
export function setPinCustom(which, on) {
  const key = PIN_CUSTOM_KEYS[which];
  if (!key) return false;
  const s = readSettings();
  s[key] = !!on;
  writeSettings(s);
  return !!on;
}

// ---------- 恢复出厂设置 ----------
// 设置出问题时的临时兜底：删掉 settings.json 即回到出厂默认（文件缺失 = 默认开启，
// 于是局域网访问开、访问密码开、局域网地址自动、公网模式随机）。DSH 自身的会话、
// 模型、插件配置都在 $DSH_HOME 的其他目录，不受影响。

/** 删除本机设置文件（不存在也算成功）；返回 true 表示已清空。 */
export function resetSettings() {
  try {
    rmSync(settingsPath(), { force: true });
    return true;
  } catch {
    return false;
  }
}

// ---------- 命名隧道配置（issue #66：固定公网域名） ----------
// 用户在 Cloudflare Zero Trust（Networks → Tunnels）创建命名隧道并复制 Tunnel Token，
// 把自己域名的 ingress Service 指向 http://127.0.0.1:<代理端口>；填到这里后，
// 开启公网改用 `cloudflared tunnel run`，公网地址固定为该域名（重启不再变化）。
// token 是长期凭据：只存本机 0o600 文件，RPC 只写不读（回显仅 tokenSet 布尔值）。

/** 隧道模式：'quick'（默认，随机地址）| 'named'（固定域名）。 */
export function tunnelMode() {
  return readSettings().tunnelMode === 'named' ? 'named' : 'quick';
}

/** 设置隧道模式（持久化）；非法值抛错。 */
export function setTunnelMode(mode) {
  if (mode !== 'quick' && mode !== 'named') {
    throw new Error('隧道模式必须是 quick 或 named | tunnel mode must be quick or named');
  }
  const s = readSettings();
  if (mode === 'quick') delete s.tunnelMode;
  else s.tunnelMode = mode;
  writeSettings(s);
  return mode;
}

/** 命名隧道 Token（未配置返回空字符串）。 */
export function tunnelToken() {
  const v = readSettings().tunnelToken;
  return typeof v === 'string' ? v : '';
}

/**
 * 设置命名隧道 Token（持久化）。空字符串清除；非空要求至少 20 个
 * base64url 字符（Cloudflare Token 是长 base64 串，过短/含空白视为无效）。
 */
export function setTunnelToken(value) {
  const v = String(value ?? '').trim();
  if (v) {
    if (v.length < 20 || !/^[A-Za-z0-9+/_=-]+$/.test(v)) {
      throw new Error('Tunnel Token 格式不对（应为 Cloudflare 后台复制的完整 Token） | invalid tunnel token');
    }
  }
  const s = readSettings();
  if (v) s.tunnelToken = v;
  else delete s.tunnelToken;
  writeSettings(s);
  return v;
}

/** 命名隧道绑定的固定域名（未配置返回空字符串）。 */
export function tunnelHostname() {
  const v = readSettings().tunnelHostname;
  return typeof v === 'string' ? v : '';
}

/**
 * 设置固定域名（持久化）。接受 `https://host/path` 粘贴并归一化为裸域名；
 * 空字符串清除。要求是带点的合法公网域名（局域网主机名/裸 IP 不允许——
 * 那不该走公网密码边界之外的东西）。
 */
export function setTunnelHostname(value) {
  let v = String(value ?? '').trim().toLowerCase();
  v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split(/[/?#\s]/)[0].replace(/:\d+$/, '').replace(/\.$/, '');
  if (v) {
    const HOSTNAME_RE = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
    const IS_IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
    if (IS_IPV4.test(v) || !v.includes('.') || !HOSTNAME_RE.test(v)) {
      throw new Error('固定域名格式不对（如 pocket.example.com） | invalid tunnel hostname');
    }
  }
  const s = readSettings();
  if (v) s.tunnelHostname = v;
  else delete s.tunnelHostname;
  writeSettings(s);
  return v;
}

// ---------- 代理端口（issue #70） ----------
// 局域网代理的监听端口（默认 3081）。插件模式下唯一改法就是写 settings.json 的
// proxyPort 字段（CLI 模式可用 dsh-pocket --port）。允许范围 1-65535；
// 端口已被占用时 dsh web 启动会直接抛 EADDRINUSE（保持原行为），不必在 setter 校验。
/** 当前代理端口（0 = 用默认 3081）。 */
export function proxyPort() {
  const v = Number(readSettings().proxyPort);
  return Number.isInteger(v) && v >= 1 && v <= 65535 ? v : 0;
}

/** 设置代理端口（持久化）。空/0/非法值清除，回退默认 3081。 */
export function setProxyPort(value) {
  const n = Number(value);
  const s = readSettings();
  if (Number.isInteger(n) && n >= 1 && n <= 65535) s.proxyPort = n;
  else delete s.proxyPort;
  writeSettings(s);
  return proxyPort();
}

// ---------- 临时 PIN（issue #69：带超时的临时访问） ----------
// 让用户能给访客（朋友/同事/临时设备）开一个**有寿命**的 PIN，过期自动作废——
//
// 设计要点：
//   - 临时 PIN 与主 PIN **共用速率限制**（按 IP）：攻击者拿到临时 PIN 也不能暴力破解别的；
//   - 临时 PIN **绑 host 分类**：公网临时 PIN 只在公网入口校验，局域网临时 PIN 只在局域网入口校验
//     （与主 PIN 的 host 分发一致；防止公网临时 PIN 被局域网内的人滥用，反之亦然）；
//   - 过期**懒清理**：访问时过滤掉过期的，避免每次都写磁盘（频繁写影响响应时间）；
//     设置页列表操作或重启 dsh web 之后才落盘（writeSettings 在 setTempPin / revokeTempPin 时调用）；
//   - 不复用主 PIN 的「自定义标记」：临时 PIN 是一次性生成，标记无意义；
//   - 存本机 0o600 settings.json（与 Token 一致）。
//
// 临时 PIN 默认长度同主 PIN（8 位字母数字），但由系统生成，用户不设置。
// 一次性签名不重要：临时 PIN 本身足够长（8 位）且绑超时，被截获也只活到过期。
//
// 数据结构：settings.tempPins = [{ value, kind: 'public'|'lan', expiresAt: <epoch_ms>, label: <string> }]
const TEMP_PIN_KINDS = new Set(['public', 'lan']);
const TEMP_PIN_RE = /^[a-zA-Z0-9]{8}$/;
/** 最小允许有效期 5 分钟（防误点立即过期让用户迷惑），最大 30 天。 */
const TEMP_PIN_MIN_SEC = 5 * 60;
const TEMP_PIN_MAX_SEC = 30 * 24 * 60 * 60;
/** 临时 PIN 生成（issue #69）：与主 PIN 同长度（8 位字母数字），用密码学随机。 */
function newTempPin() {
  const bytes = randomBytes(8);
  // 把 8 字节转 base32-ish 字母数字串，再截 8 位；碰撞概率忽略（8 字节熵 ≈ 2^64）
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** 读临时 PIN 列表（自动过滤过期项；不写磁盘）。 */
export function tempPins() {
  const arr = readSettings().tempPins;
  if (!Array.isArray(arr)) return [];
  const now = Date.now();
  return arr
    .filter((p) => p && typeof p === 'object' && typeof p.value === 'string' && typeof p.expiresAt === 'number' && p.expiresAt > now)
    .map((p) => ({ value: p.value, kind: p.kind, expiresAt: p.expiresAt, label: typeof p.label === 'string' ? p.label : '' }));
}

/** 创建一个临时 PIN（issue #69）。返回 { value, expiresAt, kind, label }。 */
export function createTempPin({ kind, expiresInSec, label = '' } = {}) {
  if (!TEMP_PIN_KINDS.has(kind)) throw new Error('临时 PIN 类型必须是 public 或 lan | temp pin kind must be public or lan');
  const sec = Number(expiresInSec);
  if (!Number.isInteger(sec) || sec < TEMP_PIN_MIN_SEC || sec > TEMP_PIN_MAX_SEC) {
    throw new Error(`临时 PIN 有效期需在 ${TEMP_PIN_MIN_SEC}-${TEMP_PIN_MAX_SEC} 秒之间 | expiresInSec out of range`);
  }
  const value = newTempPin();
  const expiresAt = Date.now() + sec * 1000;
  const s = readSettings();
  s.tempPins = Array.isArray(s.tempPins) ? s.tempPins.filter((p) => p && p.expiresAt > Date.now()) : [];
  s.tempPins.push({ value, kind, expiresAt, label: String(label).slice(0, 32) });
  writeSettings(s);
  return { value, kind, expiresAt, label: String(label).slice(0, 32) };
}

/** 撤销一个临时 PIN（按 value 匹配，kind 校验防止误删）。不存在也返回 false。 */
export function revokeTempPin(value, kind) {
  const v = String(value ?? '');
  if (!TEMP_PIN_RE.test(v)) return false;
  const s = readSettings();
  if (!Array.isArray(s.tempPins)) return false;
  const before = s.tempPins.length;
  s.tempPins = s.tempPins.filter((p) => !(p?.value === v && (kind === undefined || p.kind === kind)));
  if (s.tempPins.length === before) return false;
  writeSettings(s);
  return true;
}

/** 给定 kind 返回所有未过期的临时 PIN 集合（value 数组），用于 proxy 校验。 */
export function tempPinValuesFor(kind) {
  return tempPins().filter((p) => p.kind === kind).map((p) => p.value);
}
