// 验证码服务：生成SVG图形验证码（无需canvas原生模块，纯JS）
// 使用简单的SVG生成方式，避免canvas依赖编译问题
import crypto from 'crypto';

const codeStore = new Map(); // token -> { code, expireAt }

export function generateCaptcha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  const token = crypto.randomBytes(16).toString('hex');
  codeStore.set(token, { code, expireAt: Date.now() + 5 * 60 * 1000 });
  // 5分钟过期清理
  setTimeout(() => codeStore.delete(token), 5 * 60 * 1000);

  // 生成SVG图片（带干扰线）
  const svg = buildSvg(code);
  return { token, svg, code }; // 开发期返回code便于调试，生产环境删除
}

export function verifyCaptcha(token, input) {
  const rec = codeStore.get(token);
  if (!rec) return false;
  if (Date.now() > rec.expireAt) { codeStore.delete(token); return false; }
  const ok = rec.code.toUpperCase() === (input || '').toUpperCase();
  if (ok) codeStore.delete(token); // 一次性
  return ok;
}

function buildSvg(code) {
  const W = 120, H = 40;
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
  let chars = '';
  for (let i = 0; i < code.length; i++) {
    const x = 18 + i * 26;
    const y = 28 + (Math.random() * 6 - 3);
    const rot = Math.random() * 30 - 15;
    const color = colors[Math.floor(Math.random() * colors.length)];
    chars += `<text x="${x}" y="${y}" font-size="28" font-family="Arial" font-weight="bold" fill="${color}" transform="rotate(${rot} ${x} ${y})">${code[i]}</text>`;
  }
  // 干扰线
  let lines = '';
  for (let i = 0; i < 4; i++) {
    const x1 = Math.random() * W, y1 = Math.random() * H;
    const x2 = Math.random() * W, y2 = Math.random() * H;
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors[i % colors.length]}" stroke-width="1" opacity="0.5"/>`;
  }
  // 干扰点
  let dots = '';
  for (let i = 0; i < 30; i++) {
    dots += `<circle cx="${Math.random() * W}" cy="${Math.random() * H}" r="1" fill="#aaa" opacity="0.4"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#f0f2f5;border-radius:4px">${dots}${lines}${chars}</svg>`;
}
