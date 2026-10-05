/* ============================================================
 *  前端全局配置
 *  - API_BASE：解锁后端(Cloudflare Worker)地址，部署后填进来（去掉末尾斜杠）
 *    例：window.DNW_CONFIG = { API_BASE: 'https://bignaiwa-unlock.xxx.workers.dev' };
 *  - 留空 '' 时：体力系统照常（每天 1 点），但不会校验真实打赏、也无法解锁无限畅玩。
 *    详见 worker/README.md 的部署步骤。
 * ============================================================ */
window.DNW_CONFIG = { API_BASE: 'https://bignaiwa-unlock.gatsby666-jay.workers.dev' };
