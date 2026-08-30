// 用纯 Node 生成 PWA 图标 PNG（无第三方依赖）
// 画一个液态玻璃风格的应用图标：紫色渐变底 + 中间玻璃聊天气泡
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

// ---- PNG 编码 ----
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- 绘制 ----
const lerp = (a, b, t) => a + (b - a) * t;
function mix(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]; }
// 圆角矩形 SDF（<0 在内部）
function sdRound(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r, qy = Math.abs(py - cy) - hh + r;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(ox, oy) - r;
}

function drawIcon(size) {
  const w = size, h = size;
  const rgba = Buffer.alloc(w * h * 4);
  const C1 = [124, 140, 224];  // #7c8ce0
  const C2 = [207, 107, 214];  // #cf6bd6
  const corner = size * 0.225;

  // 气泡参数
  const bx = size * 0.5, by = size * 0.47;
  const bhw = size * 0.26, bhh = size * 0.19, br = size * 0.15;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // 背景渐变
      let col = mix(C1, C2, (x / w * 0.6 + y / h * 0.4));
      let a = 255;

      // 外部圆角裁切（让系统外的区域透明，图标更精致）
      const outside = sdRound(x, y, size / 2, size / 2, size / 2, size / 2, corner);
      if (outside > 0) { rgba[i + 3] = 0; continue; }
      const edge = Math.min(1, Math.max(0, -outside)); // 抗锯齿
      a = Math.round(255 * edge);

      // 玻璃气泡
      const d = sdRound(x, y, bx, by, bhw, bhh, br);
      if (d < 0) {
        const inner = Math.min(1, -d / (size * 0.02));
        // 玻璃：偏白半透明 + 顶部高光渐变
        const topGlow = Math.max(0, 1 - (y - (by - bhh)) / (bhh * 1.6));
        const glass = [
          lerp(col[0], 255, 0.35 + topGlow * 0.4),
          lerp(col[1], 255, 0.35 + topGlow * 0.4),
          lerp(col[2], 255, 0.4 + topGlow * 0.4),
        ];
        col = mix(col, glass, inner);
      }
      // 气泡小尾巴（左下）
      const td = sdRound(x, y, bx - bhw * 0.55, by + bhh * 0.82, size * 0.05, size * 0.05, size * 0.02);
      if (td < 0) col = mix(col, [255, 255, 255], 0.5 * Math.min(1, -td / (size * 0.02)));

      rgba[i] = Math.round(col[0]);
      rgba[i + 1] = Math.round(col[1]);
      rgba[i + 2] = Math.round(col[2]);
      rgba[i + 3] = a;
    }
  }
  return encodePNG(w, h, rgba);
}

// 全出血版（maskable：无圆角透明，铺满，供系统裁切）
function drawMaskable(size) {
  const w = size, h = size, rgba = Buffer.alloc(w * h * 4);
  const C1 = [124, 140, 224], C2 = [207, 107, 214];
  const bx = size * 0.5, by = size * 0.47, bhw = size * 0.22, bhh = size * 0.16, br = size * 0.13;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    let col = mix(C1, C2, (x / w * 0.6 + y / h * 0.4));
    const d = sdRound(x, y, bx, by, bhw, bhh, br);
    if (d < 0) {
      const inner = Math.min(1, -d / (size * 0.02));
      const topGlow = Math.max(0, 1 - (y - (by - bhh)) / (bhh * 1.6));
      const glass = [lerp(col[0],255,0.35+topGlow*0.4), lerp(col[1],255,0.35+topGlow*0.4), lerp(col[2],255,0.4+topGlow*0.4)];
      col = mix(col, glass, inner);
    }
    rgba[i]=Math.round(col[0]); rgba[i+1]=Math.round(col[1]); rgba[i+2]=Math.round(col[2]); rgba[i+3]=255;
  }
  return encodePNG(w, h, rgba);
}

mkdirSync(new URL('../app/icons/', import.meta.url), { recursive: true });
const out = (name) => new URL('../app/icons/' + name, import.meta.url);
writeFileSync(out('icon-180.png'), drawIcon(180));
writeFileSync(out('icon-192.png'), drawIcon(192));
writeFileSync(out('icon-512.png'), drawIcon(512));
writeFileSync(out('maskable-512.png'), drawMaskable(512));
console.log('icons generated in app/icons/');
