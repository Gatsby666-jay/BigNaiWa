/* ============================================================
 *  合成大奶娃 · 体力值系统
 *  - 每人每天 1 点体力，每开一局消耗 1 点
 *  - 体力用完当天，打赏作者即可解锁「今日无限畅玩」
 *  - 纯本地存储（localStorage），无后端、无账号
 *  依赖：game.js 的 reset() 会调用本模块做校验与扣减；
 *        sponsor.js 负责打开/关闭赞助弹窗（window.DanaiwaSponsor）。
 * ============================================================ */
(function () {
  'use strict';

  const KEY = 'dnw_stamina_v1';
  const DAILY = 1;                 // 每人每天体力点数

  /* 解锁码：纯前端无法验证真实付款，改用「作者私下发的码」做门槛。
   * 码本身绝不写进页面，只存它的 SHA-256 哈希（加盐），白嫖党看源码也拿不到明文。
   * 想换码：用 tools/gen_unlock_hash.js 重新生成哈希，替换下面 UNLOCK_HASH 即可。 */
  const UNLOCK_SALT = 'dnw_sponsor_salt_v1';
  const UNLOCK_HASH = '03099fe011b60fa215ba5683130b90aca590a861797cfb7abab5e58c5b5361a1';

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

  /* 读取并顺手处理「跨天」：日期变了就重置成新的一天 */
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.date === todayStr()) { state = s; return; }
    } catch (e) { /* ignore */ }
    state = fresh();
    save();
  }

  function ensureToday() {
    if (state.date !== todayStr()) { state = fresh(); save(); }
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

  /* 是否还能开一局 */
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

  /* 打赏作者后调用：今日剩余时间无限畅玩 */
  function unlockToday() {
    ensureToday();
    state.unlimited = true;
    save();
    render();
  }

  function isUnlimited() { return state.unlimited; }

  /* 解锁码校验：把输入加盐后 SHA-256，与页内哈希比对。非安全上下文（如 file://）无 crypto.subtle。 */
  async function sha256Hex(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.prototype.map.call(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  function verifyCode(input) {
    return sha256Hex(((input || '').trim()) + UNLOCK_SALT).then((h) => h === UNLOCK_HASH);
  }

  /* 体力不够时：打开赞助弹窗，引导玩家扫码打赏解锁 */
  function blocked() {
    render();
    if (window.DanaiwaSponsor) window.DanaiwaSponsor.open();
  }

  function mount() {
    /* 1) 侧边面板里插入体力条（放在「分数/最高分」下方） */
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

    /* 2) 赞助弹窗里的「解锁码」输入 + 校验 */
    const verifyBtn = document.getElementById('sponsorVerifyBtn');
    const inputEl = document.getElementById('sponsorCodeInput');
    const msgEl = document.getElementById('sponsorCodeMsg');
    if (verifyBtn && inputEl && !verifyBtn.dataset.bound) {
      verifyBtn.dataset.bound = '1';
      const tryVerify = async function () {
        const val = inputEl.value;
        if (!val) { msgEl.textContent = '请先输入解锁码'; msgEl.className = 'unlock-msg err'; return; }
        if (!crypto || !crypto.subtle) {
          msgEl.textContent = '请在 https 线上版本里解锁（本地直接打开不支持）';
          msgEl.className = 'unlock-msg err';
          return;
        }
        const ok = await verifyCode(val);
        if (ok) {
          unlockToday();
          msgEl.textContent = '🎉 今日已解锁无限畅玩！';
          msgEl.className = 'unlock-msg ok';
          if (window.DanaiwaSponsor) window.DanaiwaSponsor.close();
          /* 体力耗尽时（游戏已结束 / 还没开局）解锁后直接开一局 */
          const dnw = window.__DNW__;
          if (dnw && dnw.reset &&
              (!dnw.state || dnw.state.over || (dnw.state.balls && dnw.state.balls.length === 0))) {
            dnw.reset();
          }
        } else {
          msgEl.textContent = '❌ 解锁码不对，确认下作者给的码～';
          msgEl.className = 'unlock-msg err';
        }
      };
      verifyBtn.addEventListener('click', tryVerify);
      inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryVerify(); });
    }

    render();
  }

  window.DanaiwaStamina = {
    canStart: canStart,
    consume: consume,
    unlockToday: unlockToday,
    blocked: blocked,
    render: render,
    isUnlimited: isUnlimited
  };

  /* 同步初始化一次（脚本执行时即可拿到当天状态），DOM 就绪后挂载 UI */
  load();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
