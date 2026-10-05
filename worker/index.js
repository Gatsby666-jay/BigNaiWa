/* ============================================================
 *  合成大奶娃 · 解锁后端（Cloudflare Workers + KV）
 *  ------------------------------------------------------------
 *  解决的问题：纯静态页面无法验证「玩家是否真的打赏过」。
 *  本后端接收爱发电(Afdian)的支付回调（带签名），把
 *  「匿名设备ID → 今日已付」写进 KV；前端开局前只问后端
 *  「我这设备今天付了没」，从而杜绝白嫖。
 *
 *  依赖（在 wrangler.toml 里绑定 / 用 wrangler secret 设置）：
 *    - KV 命名空间绑定名：DNW
 *    - 环境变量 / Secret：
 *        AFDIAN_TOKEN     爱发电「开放平台 → Webhook Token」（校验 + 调 API 都用它）
 *        AFDIAN_USER_ID   爱发电「开放平台 → 用户ID」(以 user_ 开头那串)
 *        SPONSOR_AMOUNT   打赏金额(元)，默认 6.60
 *        MOCK_SECRET      【可选】本地测试用：设置后开放 /api/mock-paid 伪造支付
 *
 *  端点：
 *    GET  /api/status?uid=xxx        -> { paidToday: bool }
 *    GET  /api/pay-url?uid=xxx       -> { url: "https://afdian.com/order/..." }
 *    POST /api/afdian/webhook        -> 爱发电回调（校验签名 + 写 KV）
 *    GET  /api/mock-paid?uid=xxx&secret=...  -> 仅 MOCK_SECRET 存在时可用
 *
 *  ⚠️ 爱发电的字段名/签名算法按其开放平台最新文档为准；本文件里的 sign 计算
 *     已按文档实现，若哪天对不上，改 md5Sign / md5Webhook / handleWebhook 三处即可。
 * ============================================================ */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS：游戏站(github.io)跨域调用本 Worker
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (url.pathname === '/api/status' && request.method === 'GET') {
        return await handleStatus(url, env, cors);
      }
      if (url.pathname === '/api/pay-url' && request.method === 'GET') {
        return await handlePayUrl(url, env, cors);
      }
      if (url.pathname === '/api/afdian/webhook' && request.method === 'POST') {
        return await handleWebhook(request, env, cors);
      }
      if (url.pathname === '/api/mock-paid' && request.method === 'GET') {
        return await handleMock(url, env, cors);
      }
      return json({ error: 'not found' }, 404, cors);
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 500, cors);
    }
  },
};

function json(data, status = 200, cors = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
  });
}

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/* ---------- 纯 JS MD5（Cloudflare Web Crypto 不含 md5，故自带） ---------- */
function md5hex(str) {
  function rotateLeft(n, s) { return (n << s) | (n >>> (32 - s)); }
  function add(x, y) {
    const l = (x & 0xffff) + (y & 0xffff);
    const h = (x >> 16) + (y >> 16) + (l >> 16);
    return (h << 16) | (l & 0xffff);
  }
  function cmn(q, a, b, x, s, t) { return add(rotateLeft(add(add(a, q), add(x, t)), s), b); }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }

  const utf8 = unescape(encodeURIComponent(str));
  const n = utf8.length;
  const words = new Array(((n + 8) >> 6) + 2);
  for (let i = 0; i < n; i++) words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << ((i % 4) * 8);
  words[n >> 2] |= 0x80 << ((n % 4) * 8);
  words[((n + 8) >> 6) * 2] = n * 8;

  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
  const k = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
  ];
  const s = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  for (let i = 0; i < words.length; i += 16) {
    const oa = a, ob = b, oc = c, od = d;
    a = ff(a, b, c, d, words[i + 0], s[0], k[0]); d = ff(d, a, b, c, words[i + 1], s[1], k[1]); c = ff(c, d, a, b, words[i + 2], s[2], k[2]); b = ff(b, c, d, a, words[i + 3], s[3], k[3]);
    a = ff(a, b, c, d, words[i + 4], s[4], k[4]); d = ff(d, a, b, c, words[i + 5], s[5], k[5]); c = ff(c, d, a, b, words[i + 6], s[6], k[6]); b = ff(b, c, d, a, words[i + 7], s[7], k[7]);
    a = ff(a, b, c, d, words[i + 8], s[8], k[8]); d = ff(d, a, b, c, words[i + 9], s[9], k[9]); c = ff(c, d, a, b, words[i + 10], s[10], k[10]); b = ff(b, c, d, a, words[i + 11], s[11], k[11]);
    a = ff(a, b, c, d, words[i + 12], s[12], k[12]); d = ff(d, a, b, c, words[i + 13], s[13], k[13]); c = ff(c, d, a, b, words[i + 14], s[14], k[14]); b = ff(b, c, d, a, words[i + 15], s[15], k[15]);
    a = gg(a, b, c, d, words[i + 1], s[16], k[16]); d = gg(d, a, b, c, words[i + 6], s[17], k[17]); c = gg(c, d, a, b, words[i + 11], s[18], k[18]); b = gg(b, c, d, a, words[i + 0], s[19], k[19]);
    a = gg(a, b, c, d, words[i + 5], s[20], k[20]); d = gg(d, a, b, c, words[i + 10], s[21], k[21]); c = gg(c, d, a, b, words[i + 15], s[22], k[22]); b = gg(b, c, d, a, words[i + 4], s[23], k[23]);
    a = gg(a, b, c, d, words[i + 9], s[24], k[24]); d = gg(d, a, b, c, words[i + 14], s[25], k[25]); c = gg(c, d, a, b, words[i + 3], s[26], k[26]); b = gg(b, c, d, a, words[i + 8], s[27], k[27]);
    a = gg(a, b, c, d, words[i + 13], s[28], k[28]); d = gg(d, a, b, c, words[i + 2], s[29], k[29]); c = gg(c, d, a, b, words[i + 7], s[30], k[30]); b = gg(b, c, d, a, words[i + 12], s[31], k[31]);
    a = hh(a, b, c, d, words[i + 5], s[32], k[32]); d = hh(d, a, b, c, words[i + 8], s[33], k[33]); c = hh(c, d, a, b, words[i + 11], s[34], k[34]); b = hh(b, c, d, a, words[i + 14], s[35], k[35]);
    a = hh(a, b, c, d, words[i + 1], s[36], k[36]); d = hh(d, a, b, c, words[i + 4], s[37], k[37]); c = hh(c, d, a, b, words[i + 7], s[38], k[38]); b = hh(b, c, d, a, words[i + 10], s[39], k[39]);
    a = hh(a, b, c, d, words[i + 13], s[40], k[40]); d = hh(d, a, b, c, words[i + 0], s[41], k[41]); c = hh(c, d, a, b, words[i + 3], s[42], k[42]); b = hh(b, c, d, a, words[i + 6], s[43], k[43]);
    a = hh(a, b, c, d, words[i + 9], s[44], k[44]); d = hh(d, a, b, c, words[i + 12], s[45], k[45]); c = hh(c, d, a, b, words[i + 15], s[46], k[46]); b = hh(b, c, d, a, words[i + 2], s[47], k[47]);
    a = ii(a, b, c, d, words[i + 0], s[48], k[48]); d = ii(d, a, b, c, words[i + 7], s[49], k[49]); c = ii(c, d, a, b, words[i + 14], s[50], k[50]); b = ii(b, c, d, a, words[i + 5], s[51], k[51]);
    a = ii(a, b, c, d, words[i + 12], s[52], k[52]); d = ii(d, a, b, c, words[i + 3], s[53], k[53]); c = ii(c, d, a, b, words[i + 10], s[54], k[54]); b = ii(b, c, d, a, words[i + 1], s[55], k[55]);
    a = ii(a, b, c, d, words[i + 8], s[56], k[56]); d = ii(d, a, b, c, words[i + 15], s[57], k[57]); c = ii(c, d, a, b, words[i + 6], s[58], k[58]); b = ii(b, c, d, a, words[i + 13], s[59], k[59]);
    a = ii(a, b, c, d, words[i + 4], s[60], k[60]); d = ii(d, a, b, c, words[i + 11], s[61], k[61]); c = ii(c, d, a, b, words[i + 2], s[62], k[62]); b = ii(b, c, d, a, words[i + 9], s[63], k[63]);
    a = add(a, oa); b = add(b, ob); c = add(c, oc); d = add(d, od);
  }
  function hex(n) {
    let s = '';
    for (let i = 0; i < 4; i++) s += ((n >> (i * 8)) & 0xff).toString(16).padStart(2, '0');
    return s;
  }
  return hex(a) + hex(b) + hex(c) + hex(d);
}

/* ---------- 爱发电签名 ---------- */
// 开放平台「下单」类接口：sign = md5( params_json_string + token )
function md5Sign(paramsObj, token) {
  return md5hex(JSON.stringify(paramsObj) + token);
}
// Webhook 回调：sign = md5( 排序后的 k=v 拼接 + token )
function md5Webhook(params, token) {
  const keys = Object.keys(params).filter((k) => k !== 'sign').sort();
  const raw = keys.map((k) => k + '=' + params[k]).join('&') + token;
  return md5hex(raw);
}

/* ---------- 端点实现 ---------- */
async function handleStatus(url, env, cors) {
  const uid = (url.searchParams.get('uid') || '').trim();
  if (!uid) return json({ error: 'missing uid' }, 400, cors);
  const v = await env.DNW.get('paid:' + uid);
  return json({ paidToday: v === todayStr() }, 200, cors);
}

async function handlePayUrl(url, env, cors) {
  const uid = (url.searchParams.get('uid') || '').trim();
  if (!uid) return json({ error: 'missing uid' }, 400, cors);
  if (!env.AFDIAN_TOKEN || !env.AFDIAN_USER_ID) {
    return json({ error: '后端未配置 AFDIAN_TOKEN / AFDIAN_USER_ID' }, 500, cors);
  }
  const amount = (env.SPONSOR_AMOUNT || '6.60');
  const outTradeNo = 'dnw_' + uid;             // 用来在回调里找回 uid
  const params = {
    user_id: env.AFDIAN_USER_ID,
    out_trade_no: outTradeNo,
    total_amount: String(amount),
    remark: '合成大奶娃-解锁今日畅玩',
  };
  const paramsStr = JSON.stringify(params);
  const sign = md5Sign(params, env.AFDIAN_TOKEN);
  const resp = await fetch('https://afdian.com/api/open/order/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'user_id=' + encodeURIComponent(env.AFDIAN_USER_ID) +
          '&params=' + encodeURIComponent(paramsStr) +
          '&sign=' + sign,
  });
  const data = await resp.json().catch(() => ({}));
  const urlOut = (data && data.data && data.data.pay_url) ||
                 (data && data.data && data.data.order && data.data.order.pay_url);
  if (urlOut) return json({ url: urlOut }, 200, cors);
  return json({ error: '爱发电下单失败', detail: data }, 502, cors);
}

async function handleWebhook(request, env, cors) {
  const ct = request.headers.get('content-type') || '';
  let params = {};
  if (ct.includes('application/json')) {
    params = await request.json().catch(() => ({}));
  } else {
    const form = await request.formData().catch(() => new Map());
    for (const [k, v] of form.entries()) params[k] = v;
  }
  if (!env.AFDIAN_TOKEN) return json({ error: '未配置 token' }, 500, cors);
  if (md5Webhook(params, env.AFDIAN_TOKEN) !== params.sign) {
    return json({ error: 'sign mismatch' }, 403, cors);
  }

  // 解析订单，找回 uid
  let order = {};
  try { order = typeof params.order === 'string' ? JSON.parse(params.order) : (params.order || {}); } catch (e) { order = {}; }
  const outTradeNo = order.out_trade_no || '';
  const uid = outTradeNo.startsWith('dnw_') ? outTradeNo.slice(4) : String(order.remark || '');

  // 已支付判定：爱发电 order.status === 3 表示已支付/已结算（按文档；如不同改这里）
  const paid = order.status === 3 || order.status === '3' || order.pay_status === 'paid';
  if (!uid) return json({ ok: true, skipped: 'no uid' }, 200, cors); // 签名对但没 uid，免得爱发电重试
  if (paid) {
    await env.DNW.put('paid:' + uid, todayStr(), { expirationTtl: 172800 }); // 两天后过期
  }
  return json({ ok: true, uid, paid }, 200, cors);
}

async function handleMock(url, env, cors) {
  if (!env.MOCK_SECRET) return json({ error: 'mock disabled' }, 404, cors);
  const secret = url.searchParams.get('secret') || '';
  const uid = (url.searchParams.get('uid') || '').trim();
  if (secret !== env.MOCK_SECRET || !uid) return json({ error: 'bad' }, 403, cors);
  await env.DNW.put('paid:' + uid, todayStr(), { expirationTtl: 172800 });
  return json({ ok: true, uid, paidToday: true }, 200, cors);
}
