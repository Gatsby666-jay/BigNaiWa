# 解锁后端（Cloudflare Workers）

游戏站是纯静态的，没法自己证明「玩家真的打赏过」。这个 Worker 负责：
**接收爱发电支付回调（带签名）→ 记录「匿名设备ID 今天已付」→ 前端开局前问它。**

## 1. 准备 Cloudflare
- 注册 https://workers.cloudflare.com （免费额度够用）
- 装 wrangler：`npm i -g wrangler` 然后 `wrangler login`

## 2. 建 KV 命名空间
```bash
wrangler kv namespace create DNW
```
把返回的 **id** 填进 `wrangler.toml` 的 `id = "..."`。

## 3. 设置爱发电凭证（secret，不要写进仓库）
```bash
wrangler secret put AFDIAN_TOKEN      # 爱发电后台「开放平台 → Webhook Token」
wrangler secret put AFDIAN_USER_ID    # 爱发电「开放平台 → 用户ID」（user_ 开头那串）
# 可选：本地测试用，部署到生产前可去掉
wrangler secret put MOCK_SECRET       # 随便设个字符串，例如 test123
```

## 3.1 配置爱发电「方案/档位」ID（必需）

⚠️ **爱发电开放平台没有「创建订单」API**（只有 ping / query-order / query-sponsor），
后端无法代你下单，只能拼它的**下单页**链接。做法：

1. 去爱发电后台建一个档位（例如「6.6 元 · 解锁今日畅玩」）
2. 打开该档位的下单页，从网址里复制 `plan_id=xxxx` 那一串
3. 填进 `wrangler.toml` 的 `[vars]`：
   ```toml
   SPONSOR_PLAN_ID = "你的plan_id"
   SPONSOR_PLAN_URL = "https://ifdian.net/order/create"   # 默认，通常不用改
   ```
4. 重新 `wrangler deploy`

下单时会带上 `custom_order_id=dnw_<玩家uid>`，爱发电回调时该字段**原样返回**，
Worker 据此知道是谁付的款并解锁。

## 4. 部署（含自定义域名）
`wrangler.toml` 里已配好自定义域名：
```toml
[[routes]]
pattern = "unlock.gatsbyw.cc.cd"
custom_domain = true
```
> 为什么必须用自定义域名：`*.workers.dev` 在国内网络常被 DNS 污染（解析到不可达 IP），
> 玩家调不通、爱发电的回调也打不进来。绑自有域名后国内可直连。

```bash
wrangler deploy
```
当前线上地址：`https://unlock.gatsbyw.cc.cd`（已填进前端 `config.js` 的 `API_BASE`）。

## 5. 爱发电后台填回调地址
爱发电「开放平台 → 支付回调」填：
```
https://unlock.gatsbyw.cc.cd/api/afdian/webhook
```
（签名算法本 Worker 已按爱发电文档实现；若哪天对不上，改 `worker/index.js` 里
`md5Sign` / `md5Webhook` / `handleWebhook` 三处即可。）

## 6. 本地联调（无需真实支付）
部署时设了 `MOCK_SECRET` 的话：
```bash
# 浏览器里把游戏 uid（localStorage 的 dnw_uid）记下来，比如 abc123
curl "https://<你的worker地址>/api/mock-paid?uid=abc123&secret=test123"
# 再查状态
curl "https://<你的worker地址>/api/status?uid=abc123"
# -> {"paidToday":true}
```

## 端点
| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/status?uid=`     | 返回 `{paidToday:bool}` |
| GET  | `/api/pay-url?uid=`    | 返回爱发电下单页 `{url}`（uid 编进 `custom_order_id`） |
| POST | `/api/afdian/webhook`  | 爱发电支付回调（校验签名 + 写 KV） |
| GET  | `/api/mock-paid`       | 仅 MOCK_SECRET 存在时可用，本地测试 |
