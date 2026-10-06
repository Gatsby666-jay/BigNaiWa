/* ============================================================
 *  合成大奶long · 解锁后端（Cloudflare Workers + KV）
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
 *  ⚠️ 爱发电 Webhook 签名（2025-07 起）：
 *     - sign_str = order.out_trade_no + order.user_id + order.plan_id + order.total_amount
 *     - sign     = 爱发电用「官方私钥」做的 RSA-SHA256 签名（base64）
 *     - 我们用爱发电公开的公钥做 verify（见 AFDIAN_PUBLIC_KEY）。
 *     官方要求开发者响应必须含 {"ec":200,"em":"ok"}，否则平台认为回调失败。
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
      // 爱发电保存回调/验证时可能发 POST（也可能 GET 探活），统一交给 handleWebhook
      if (url.pathname === '/api/afdian/webhook') {
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
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // 关键：不加这个，Cloudflare 会缓存 GET 响应，导致改了配置仍返回旧结果
      'Cache-Control': 'no-store, max-age=0',
      ...cors,
    },
  });
}

// 爱发电要求的成功响应结构：只要返回 ec:200，平台即认为回调成功
function webhookOk(cors = {}) {
  return new Response(JSON.stringify({ ec: 200, em: 'ok' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      ...cors,
    },
  });
}

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/* ---------- 爱发电 Webhook 公钥（RSA-SHA256 验签用，官方公开） ---------- */
const AFDIAN_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwwdaCg1Bt+UKZKs0R54y
lYnuANma49IpgoOwNmk3a0rhg/PQuhUJ0EOZSowIC44l0K3+fqGns3Ygi4AfmEfS
4EKbdk1ahSxu7Zkp2rHMt+R9GarQFQkwSS/5x1dYiHNVMiR8oIXDgjmvxuNes2Cr
8fw9dEF0xNBKdkKgG2qAawcN1nZrdyaKWtPVT9m2Hl0ddOO9thZmVLFOb9NVzgYf
jEgI+KWX6aY19Ka/ghv/L4t1IXmz9pctablN5S0CRWpJW3Cn0k6zSXgjVdKm4uN7
jRlgSRaf/Ind46vMCm3N2sgwxu/g3bnooW+db0iLo13zzuvyn727Q3UDQ0MmZcEW
MQIDAQAB
-----END PUBLIC KEY-----`;

function pemToBytes(pem) {
  const b64 = pem.replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}
function b64ToBytes(b64) {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

/**
 * 校验爱发电 Webhook 签名。
 * sign_str = out_trade_no + user_id + plan_id + total_amount（按文档顺序直接拼接）
 * sign     = 爱发电私钥 RSA-SHA256 签名（base64），用官方公钥验证。
 * 返回 true 才代表这确实是爱发电发来的真实订单。
 */
async function verifyAfdianSign(order, signB64) {
  if (!signB64 || typeof signB64 !== 'string') return false;
  try {
    const signStr =
      String(order.out_trade_no || '') +
      String(order.user_id || '') +
      String(order.plan_id || '') +
      String(order.total_amount || '');
    const key = await crypto.subtle.importKey(
      'spki',
      pemToBytes(AFDIAN_PUBLIC_KEY),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sig = b64ToBytes(signB64);
    const data = new TextEncoder().encode(signStr);
    return await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, key, sig, data);
  } catch (e) {
    return false;
  }
}

/* ---------- 端点实现 ---------- */
async function handleStatus(url, env, cors) {
  const uid = (url.searchParams.get('uid') || '').trim();
  if (!uid) return json({ error: 'missing uid' }, 400, cors);
  const v = await env.DNW.get('paid:' + uid);
  return json({ paidToday: v === todayStr() }, 200, cors);
}

/**
 * 生成爱发电「下单页」链接。
 *
 * 爱发电开放平台**没有**「创建订单」的 API（只有 ping / query-order / query-sponsor），
 * 所以不能由后端下单。但爱发电的下单页支持 URL 参数，其中 custom_order_id 会原样带回
 * webhook，我们借它把玩家 uid 编码进订单（dnw_<uid>），回调时再取回来完成解锁。
 */
async function handlePayUrl(url, env, cors) {
  const uid = (url.searchParams.get('uid') || '').trim();
  if (!uid) return json({ error: 'missing uid' }, 400, cors);

  const planId = env.SPONSOR_PLAN_ID;
  if (!planId || String(planId).indexOf('REPLACE') === 0) {
    return json({ error: '后端未配置 SPONSOR_PLAN_ID（爱发电方案/档位 ID）' }, 500, cors);
  }

  const base = env.SPONSOR_PLAN_URL || 'https://afdian.com/order/create';
  const amount = env.SPONSOR_AMOUNT || '6.60';

  const orderUrl = base +
    '?plan_id=' + encodeURIComponent(planId) +
    '&custom_order_id=' + encodeURIComponent('dnw_' + uid) +
    '&custom_price=' + encodeURIComponent(amount);
  return json({ url: orderUrl }, 200, cors);
}

async function handleWebhook(request, env, cors) {
  // 兼容爱发电保存/验证时的 GET 探活：直接回 ec:200 即可
  if (request.method === 'GET') return webhookOk(cors);

  let body = {};
  const ct = request.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) {
      body = await request.json().catch(() => ({}));
    } else {
      const form = await request.formData().catch(() => new Map());
      for (const [k, v] of form.entries()) body[k] = v;
    }
  } catch (e) {
    body = {};
  }

  // 解析订单：官方结构为 { ec, em, data:{ type, order }, sign }；也兼容 order 在顶层
  const data = (body.data && typeof body.data === 'object') ? body.data : {};
  let order = data.order || body.order;
  if (typeof order === 'string') {
    try { order = JSON.parse(order); } catch (e) { order = {}; }
  }
  order = order || {};
  const sign = body.sign || data.sign || '';

  // 找回玩家 uid（下单页带过去的 dnw_<uid>），回退 out_trade_no / remark
  const customId = String(order.custom_order_id || '');
  const outTradeNo = String(order.out_trade_no || '');
  const remark = String(order.remark || '');
  let uid = '';
  if (customId.startsWith('dnw_')) uid = customId.slice(4);
  else if (outTradeNo.startsWith('dnw_')) uid = outTradeNo.slice(4);
  else if (remark.startsWith('dnw_')) uid = remark.slice(4);

  // 已支付判定：爱发电文档「status 2 为交易成功，目前仅会推送此类型」
  const paid = Number(order.status) === 2 || Number(order.status) === 3;

  // 校验爱发电签名（伪造请求过不了这关，因此不会写 KV）
  const sigOk = await verifyAfdianSign(order, sign);

  if (sigOk && paid && uid) {
    await env.DNW.put('paid:' + uid, todayStr(), { expirationTtl: 172800 }); // 两天后过期
  }

  // 无论校验结果都返回 ec:200（平台要求）；非法/未付请求不写 KV，故安全无白嫖风险
  return webhookOk(cors);
}

async function handleMock(url, env, cors) {
  if (!env.MOCK_SECRET) return json({ error: 'mock disabled' }, 404, cors);
  const secret = url.searchParams.get('secret') || '';
  const uid = (url.searchParams.get('uid') || '').trim();
  if (secret !== env.MOCK_SECRET || !uid) return json({ error: 'bad' }, 403, cors);
  await env.DNW.put('paid:' + uid, todayStr(), { expirationTtl: 172800 });
  return json({ ok: true, uid, paidToday: true }, 200, cors);
}
