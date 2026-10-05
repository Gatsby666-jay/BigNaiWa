/* ============================================================
 *  合成大奶娃 · 体力值系统（后端校验版）
 *  - 每人每天 1 点体力，每开一局消耗 1 点
 *  - 体力用完当天，必须真实打赏（爱发电）才能解锁「今日无限畅玩」
 *  - 「是否打赏过」由后端确认（/api/status），无法在前端点按钮伪造
 *  依赖：
 *    - game.js 的 reset() 调 canStart() / consume() / blocked()
 *    - sponsor.js 打开/关闭弹窗（window.DanaiwaSponsor）
 *    - config.js 提供 window.DNW_CONFIG.API_BASE（后端地址）
 * ============================================================ */
(function () {
  'use strict';

  const KEY = 'dnw_stamina_v1';
  const UID_KEY = 'dnw_uid';
  const DAILY = 1;                 // 每人每天体力点数
  const API_BASE = (window.DNW_CONFIG && window.DNW_CONFIG.API_BASE) || '';

  function todayStr() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function fresh() {
    return { date: todayStr(), stamina: DAILY, unlimited: false };
  }

  let state = fresh();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 隐私模式等：忽略 */ }
  }

  function ensureToday() {
    if (state.date !== todayStr()) { state = fresh(); save(); }
  }

  /* 匿名设备ID：仅用于把「这台设备今天付过款」记到后端，不关联任何账号 */
  function getUid() {
    let uid = '';
    try { uid = localStorage.getItem(UID_KEY) || ''; } catch (e) { /* ignore */ }
    if (!uid) {
      uid = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      try { localStorage.setItem(UID_KEY, uid); } catch (e) { /* ignore */ }
    }
    return uid;
  }

  let labelEl = null;

  function render() {
    if (!labelEl) return;
    if (state.unlimited) {
      labelEl.textContent = '♾️ 今日无限畅玩';
    } else {
      labelEl.textContent = '🔋 体力 ' + state.stamina + ' / ' + DAILY;
    }
  }

  /* 是否还能开一局（本地判定：已解锁 或 还有体力） */
  function canStart() {
    ensureToday();
    return state.unlimited || state.stamina > 0;
  }

  /* 开局时扣 1 点（已解锁则不扣） */
  function consume() {
    ensureToday();
    if (!state.unlimited && state.stamina > 0) {
      state.stamina--;
      save();
    }
    render();
  }

  /* 向后端确认「这台设备今天是否已打赏」；成功则本地标记为无限畅玩 */
  async function refreshPaid() {
    if (!API_BASE) return false;
    try {
      const r = await fetch(API_BASE.replace(/\/$/, '') + '/api/status?uid=' + encodeURIComponent(getUid()), { cache: 'no-store' });
      if (!r.ok) return false;
      const data = await r.json();
      if (data && data.paidToday) {
        ensureToday();
        state.unlimited = true;
        save();
        render();
        return true;
      }
    } catch (e) { /* 网络异常：保持原状态 */ }
    return false;
  }

  function isUnlimited() { return state.unlimited; }

  /* 体力不够时：打开赞助弹窗，引导玩家真实打赏解锁 */
  function blocked() {
    render();
    if (window.DanaiwaSponsor) window.DanaiwaSponsor.open();
  }

  function mount() {
    /* 1) 侧边面板里插入体力条 */
    const stats = document.querySelector('.stats');
    if (stats && stats.parentNode && !document.getElementById('staminaChip')) {
      const chip = document.createElement('div');
      chip.className = 'stamina-chip';
      chip.id = 'staminaChip';
      labelEl = document.createElement('span');
      labelEl.className = 'stamina-label';
      chip.appendChild(labelEl);
      stats.parentNode.insertBefore(chip, stats.nextSibling);
    } else {
      labelEl = document.querySelector('#staminaChip .stamina-label');
    }

    /* 2) 赞助弹窗里的「去打赏」+「我已完成支付」 */
    const payBtn = document.getElementById('sponsorPayBtn');
    const refreshBtn = document.getElementById('sponsorRefreshBtn');
    const msgEl = document.getElementById('sponsorPayMsg');
    const payUrlHolder = document.getElementById('sponsorPayLink');

    if (payBtn && !payBtn.dataset.bound) {
      payBtn.dataset.bound = '1';
      payBtn.addEventListener('click', async function () {
        if (!API_BASE) {
          msgEl.textContent = '⚠️ 后端还没部署/配置（见 README 的 API_BASE），先用完每天 1 点体力。';
          msgEl.className = 'unlock-msg err';
          return;
        }
        msgEl.textContent = '正在生成支付链接…';
        msgEl.className = 'unlock-msg';
        try {
          const r = await fetch(API_BASE.replace(/\/$/, '') + '/api/pay-url?uid=' + encodeURIComponent(getUid()));
          const data = await r.json();
          if (data && data.url) {
            window.open(data.url, '_blank', 'noopener');
            msgEl.textContent = '👉 已在新标签页打开爱发电，支付完成后点「我已完成支付」。';
            msgEl.className = 'unlock-msg ok';
          } else {
            msgEl.textContent = '生成支付链接失败：' + ((data && data.error) || '未知错误');
            msgEl.className = 'unlock-msg err';
          }
        } catch (e) {
          msgEl.textContent = '连接后端失败，稍后再试。';
          msgEl.className = 'unlock-msg err';
        }
      });
    }

    if (refreshBtn && !refreshBtn.dataset.bound) {
      refreshBtn.dataset.bound = '1';
      refreshBtn.addEventListener('click', async function () {
        if (!API_BASE) {
          msgEl.textContent = '⚠️ 后端还没部署/配置，无法校验支付。';
          msgEl.className = 'unlock-msg err';
          return;
        }
        msgEl.textContent = '正在向服务器确认…';
        msgEl.className = 'unlock-msg';
        const ok = await refreshPaid();
        if (ok) {
          msgEl.textContent = '🎉 今日已解锁无限畅玩！';
          msgEl.className = 'unlock-msg ok';
          if (window.DanaiwaSponsor) window.DanaiwaSponsor.close();
          const dnw = window.__DNW__;
          if (dnw && dnw.reset &&
              (!dnw.state || dnw.state.over || (dnw.state.balls && dnw.state.balls.length === 0))) {
            dnw.reset();
          }
        } else {
          msgEl.textContent = '还没查到支付记录，确认已支付后稍等几秒再点（爱发电回调可能有延迟）。';
          msgEl.className = 'unlock-msg err';
        }
      });
    }

    render();
  }

  window.DanaiwaStamina = {
    canStart: canStart,
    consume: consume,
    refreshPaid: refreshPaid,
    blocked: blocked,
    render: render,
    isUnlimited: isUnlimited,
    getUid: getUid
  };

  load();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  /* load() 需在函数声明后调用；这里补一个本地读取 */
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.date === todayStr()) { state = s; return; }
    } catch (e) { /* ignore */ }
    state = fresh();
    save();
  }
})();
