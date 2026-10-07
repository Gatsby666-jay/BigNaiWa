/* ============================================================
 *  合成大奶long · 国际化（中 / 英）
 *  - window.I18N.t(key, params)：取词，支持 {n} 之类的插值
 *  - window.I18N.set('zh' | 'en')：切换语言并即时刷新整页
 *  - 静态文案：在 HTML 上标 data-i18n / data-i18n-html / data-i18n-attr
 *  - 动态文案：各模块用 I18N.t(...) 取值，并可在 I18N.onChange(fn) 里注册刷新
 *  必须在其它脚本之前加载（game/stamina/leaderboard 运行时会用到 I18N）。
 * ============================================================ */
(function () {
  'use strict';

  var KEY = 'dnw_lang';

  var DICT = {
    zh: {
      'doc.title': '合成大奶long',
      'common.close': '关闭',

      'app.h1': '合成大奶long',
      'app.subtitle': '相同的撞在一起，越合越大',
      'stat.score': '分数',
      'stat.best': '最高分',
      'label.next': '下一个',
      'label.chain': '合成表',
      'chain.note': '✨ 两个神奶蛙撞在一起会一起炸掉，换 <strong>500 分</strong> + <strong>一枚复活币</strong>',

      'btn.board.label': '排行榜',
      'btn.sound.on': '音效开',
      'btn.sound.off': '音效关',
      'btn.reset': '重开',
      'btn.reset.title': '重新开始',
      'btn.reset.hint': '达到 4000 分才能重开',
      'btn.sponsor.label': '赞助作者',
      'btn.ach.label': '成就',
      'btn.challenge.label': '挑战',

      'tips': '鼠标：移动瞄准、点击投放；触屏：拖动瞄准、松手投放。<br>← → 微调位置，空格投放，R 重开。<br>每 <strong>2000 分</strong>攒一枚<strong>复活币</strong>，只在本局有效。<br>每天 <strong>1 点体力</strong>，开一局扣 1 点；体力用完可<strong>打赏作者</strong>解锁今日无限畅玩。<br>⏱ 限时挑战：<strong>每天 5 次</strong>，60 秒内尽情冲分。',

      'revive.title': '还能再救一下',
      'revive.score': '本局得分',
      'revive.hint': '清掉警戒线以上的水果，接着玩',
      'revive.giveup': '不了，结束吧',
      'revive.use': '🪙 用一枚复活币',
      'revive.left': '还剩 {n} 枚',

      'over.title': '游戏结束',
      'over.title.challenge': '挑战结束',
      'over.score': '本局得分',
      'over.best': '最高分',
      'over.again': '再来一局',
      'over.sponsor': '可以赏作者一杯奶茶嘛',
      'over.hint': '按 R 键也可重新开始',
      'over.nick': '昵称：',
      'over.editname': '改昵称',
      'over.challenge.line': '今日剩余挑战次数 {n} / 5',
      'over.challenge.lineUnlimited': '今日挑战次数：无限（已解锁畅玩）',

      'submit.init': '正在结算…',

      'combo.word': '连击',

      'rating.s': '奶龙本龙！',
      'rating.a': '合成大师',
      'rating.b': '有点东西',
      'rating.c': '继续加油',

      'fx.twin': '两个神奶蛙 💥',
      'fx.revive': '+1 复活币',

      'challenge.title': '⏱ 限时挑战',
      'challenge.rules': '60 秒内尽可能拿高分！时间一到立刻结算；<strong>水果越线也不会判负</strong>，放心猛投。每天 5 次机会，独立于体力；<strong>打赏解锁今日畅玩后次数不限</strong>。',
      'challenge.remain': '今日剩余挑战次数：<strong>{n} / 5</strong>',
      'challenge.remainUnlimited': '今日挑战次数：<strong>无限</strong>（已解锁今日畅玩）',
      'challenge.footNote': '每次挑战 60 秒，消耗当天 1 次机会',
      'challenge.start': '开始挑战',
      'challenge.close': '关闭',
      'challenge.exhausted': '今日挑战次数已用完，明天再来～',
      'challenge.btn.again': '⏱ 再挑战（剩 {n}）',
      'challenge.btn.againUnlimited': '⏱ 再挑战（无限）',
      'challenge.btn.none': '今日挑战次数已用完',
      'challenge.hudLabel': '剩余时间',

      'ach.title': '🏆 我的成就',
      'ach.note': '达成成就，记录你的奶龙之路',
      'ach.close': '关闭',
      'ach.got': '已达成',
      'ach.not': '未达成',
      'ach.toastPrefix': '解锁成就：',

      'ach.first_game.name': '初出茅庐',
      'ach.first_game.desc': '完成第一局游戏',
      'ach.make_god.name': '神奶蛙',
      'ach.make_god.desc': '合成出神奶蛙（最大的那只）',
      'ach.twin_god.name': '双蛙齐炸',
      'ach.twin_god.desc': '让两只神奶蛙撞在一起',
      'ach.score1k.name': '千分快乐',
      'ach.score1k.desc': '单局得分达到 1000',
      'ach.score5k.name': '五千克星',
      'ach.score5k.desc': '单局得分达到 5000',
      'ach.combo10.name': '连击大师',
      'ach.combo10.desc': '单局达成 10 连击',
      'ach.revive1.name': '起死回生',
      'ach.revive1.desc': '使用一次复活币',
      'ach.record.name': '破纪录',
      'ach.record.desc': '刷新你的最高分',

      'board.title': '🏆 最近高手榜',
      'board.nick': '我的昵称',
      'board.nickPh': '默认用户',
      'board.note': '只取最近 20 次提交，成绩会被后来的人挤下去',
      'board.refresh': '刷新',

      'sponsor.title': '🧋 请作者喝杯奶茶',
      'sponsor.note': '这游戏完全免费，也没有任何广告。<br>要是它逗你笑了一下，赏作者一杯奶茶呗 🧋',
      'sponsor.qrAlipay': '支付宝扫码打赏',
      'sponsor.qrWechat': '微信扫码打赏',
      'sponsor.hint': '🟢 支付宝 / 微信扫码也能打赏（随心意，不解锁）；想<strong>解锁今日无限畅玩</strong>、杜绝白嫖，请走下方爱发电 ↓',
      'sponsor.unlockTip': '体力用完想继续玩？<strong>真实打赏后</strong>今日即可无限畅玩（由后端校验，无法白嫖）：',
      'sponsor.pay': '去打赏（爱发电）',
      'sponsor.refresh': '我已完成支付',
      'sponsor.foot': '谢谢每一位投喂的玩家 ❤️',
      'sponsor.close': '关闭',

      'stamina.unlimited': '♾️ 今日无限畅玩',
      'stamina.label': '🔋 体力 {n} / {total}',
      'stamina.pay.noBackend': '⚠️ 后端还没部署/配置（见 README 的 API_BASE），先用完每天 1 点体力。',
      'stamina.pay.gen': '正在生成支付链接…',
      'stamina.pay.opened': '👉 已在新标签页打开爱发电，支付完成后点「我已完成支付」。',
      'stamina.pay.genFail': '生成支付链接失败：',
      'stamina.pay.unknownError': '未知错误',
      'stamina.pay.connFail': '连接后端失败，稍后再试。',
      'stamina.refresh.noBackend': '⚠️ 后端还没部署/配置，无法校验支付。',
      'stamina.refresh.checking': '正在向服务器确认…',
      'stamina.refresh.ok': '🎉 今日已解锁无限畅玩！',
      'stamina.refresh.notFound': '还没查到支付记录，确认已支付后稍等几秒再点（爱发电回调可能有延迟）。',

      'lb.defaultUser': '默认用户',
      'lb.anon': '匿名玩家',
      'lb.empty': '最近还没有人提交，快去玩一局！',
      'lb.loading': '正在读取排行榜…',
      'lb.loadFail': '读取失败：',
      'lb.loadFailSuffix': '（检查一下网络？）',
      'lb.recent': '刚提交过啦，稍等一下',
      'lb.submitting': '正在提交…',
      'lb.submitted': '已上榜 ✓　{name} · {score} 分',
      'lb.submitFail': '提交失败：',
      'lb.settling': '正在结算…',
      'lb.retry': '重试提交',
      'lb.badResponse': '服务器返回看不懂：'
    },

    en: {
      'doc.title': 'Merge Milk Dragon',
      'common.close': 'Close',

      'app.h1': 'Merge Milk Dragon',
      'app.subtitle': 'Drop & merge identical fruits — grow bigger and bigger',
      'stat.score': 'Score',
      'stat.best': 'Best',
      'label.next': 'Next',
      'label.chain': 'Chain',
      'chain.note': '✨ Two God Frogs colliding explode together for <strong>500 pts</strong> + <strong>1 revive coin</strong>',

      'btn.board.label': 'Ranking',
      'btn.sound.on': 'Sound on',
      'btn.sound.off': 'Sound off',
      'btn.reset': 'Restart',
      'btn.reset.title': 'Restart',
      'btn.reset.hint': 'Reach 4000 to restart',
      'btn.sponsor.label': 'Support',
      'btn.ach.label': 'Achievements',
      'btn.challenge.label': 'Challenge',

      'tips': 'Mouse: move to aim, click to drop; Touch: drag to aim, release to drop.<br>← → fine-tune, Space to drop, R to restart.<br>Every <strong>2000 pts</strong> earns a <strong>revive coin</strong> (this round only).<br>Daily <strong>1 stamina</strong> per game; when it runs out, <strong>support the author</strong> to unlock unlimited play today.<br>⏱ Timed challenge: <strong>5 tries a day</strong>, score as much as you can in 60s.',

      'revive.title': 'One more chance!',
      'revive.score': 'Score',
      'revive.hint': 'Clear the fruits above the line and keep playing',
      'revive.giveup': 'No, end it',
      'revive.use': '🪙 Use a revive coin',
      'revive.left': '{n} left',

      'over.title': 'Game over',
      'over.title.challenge': 'Challenge over',
      'over.score': 'Score',
      'over.best': 'Best',
      'over.again': 'Play again',
      'over.sponsor': 'Buy the author a milk tea?',
      'over.hint': 'Press R to restart',
      'over.nick': 'Nickname:',
      'over.editname': 'Edit',
      'over.challenge.line': 'Challenges left today: {n} / 5',
      'over.challenge.lineUnlimited': 'Challenges today: unlimited (unlocked)',

      'submit.init': 'Submitting…',

      'combo.word': 'Combo',

      'rating.s': 'Milk Dragon Legend!',
      'rating.a': 'Merge Master',
      'rating.b': 'Not bad!',
      'rating.c': 'Keep going',

      'fx.twin': 'Two God Frogs 💥',
      'fx.revive': '+1 revive coin',

      'challenge.title': '⏱ Timed Challenge',
      'challenge.rules': 'Score as much as you can in 60 seconds! The round ends when time is up; <strong>crossing the line won\'t end it</strong>, so keep dropping. 5 tries a day, separate from stamina; <strong>unlimited after you support the author (today)</strong>.',
      'challenge.remain': 'Tries left today: <strong>{n} / 5</strong>',
      'challenge.remainUnlimited': 'Tries today: <strong>Unlimited</strong> (today unlocked)',
      'challenge.footNote': 'Each run lasts 60s and uses one of today\'s tries',
      'challenge.start': 'Start',
      'challenge.close': 'Close',
      'challenge.exhausted': 'No tries left today. Come back tomorrow!',
      'challenge.btn.again': '⏱ Retry ({n} left)',
      'challenge.btn.againUnlimited': '⏱ Retry (unlimited)',
      'challenge.btn.none': 'No tries left today',
      'challenge.hudLabel': 'Time left',

      'ach.title': '🏆 Achievements',
      'ach.note': 'Unlock achievements to record your journey',
      'ach.close': 'Close',
      'ach.got': 'Unlocked',
      'ach.not': 'Locked',
      'ach.toastPrefix': 'Achievement unlocked: ',

      'ach.first_game.name': 'Rookie',
      'ach.first_game.desc': 'Finish your first game',
      'ach.make_god.name': 'God Frog',
      'ach.make_god.desc': 'Merge the biggest one (God Frog)',
      'ach.twin_god.name': 'Double Blast',
      'ach.twin_god.desc': 'Slam two God Frogs together',
      'ach.score1k.name': '1K Club',
      'ach.score1k.desc': 'Score 1000 in one game',
      'ach.score5k.name': '5K Star',
      'ach.score5k.desc': 'Score 5000 in one game',
      'ach.combo10.name': 'Combo Master',
      'ach.combo10.desc': 'Reach a 10 combo in one game',
      'ach.revive1.name': 'Back from the Dead',
      'ach.revive1.desc': 'Use a revive coin',
      'ach.record.name': 'Record Breaker',
      'ach.record.desc': 'Beat your best score',

      'board.title': '🏆 Recent Top Scores',
      'board.nick': 'My nickname',
      'board.nickPh': 'Player',
      'board.note': 'Only the latest 20 entries; new scores push old ones out',
      'board.refresh': 'Refresh',

      'sponsor.title': '🧋 Buy the author a milk tea',
      'sponsor.note': 'This game is completely free, with no ads.<br>If it made you smile, treat the author to a milk tea 🧋',
      'sponsor.qrAlipay': 'Alipay QR',
      'sponsor.qrWechat': 'WeChat QR',
      'sponsor.hint': '🟢 You can also tip via Alipay / WeChat QR (optional, no unlock). To <strong>unlock unlimited play today</strong>, use Afdian below ↓',
      'sponsor.unlockTip': 'Out of stamina? <strong>After a real tip</strong> you unlock unlimited play for today (verified on the server, no cheating):',
      'sponsor.pay': 'Tip via Afdian',
      'sponsor.refresh': "I've paid",
      'sponsor.foot': 'Thanks to every supporter ❤️',
      'sponsor.close': 'Close',

      'stamina.unlimited': '♾️ Unlimited today',
      'stamina.label': '🔋 Stamina {n} / {total}',
      'stamina.pay.noBackend': '⚠️ Backend not deployed/configured (see API_BASE in README). Please use your 1 daily stamina point.',
      'stamina.pay.gen': 'Generating payment link…',
      'stamina.pay.opened': '👉 Opened Afdian in a new tab. After paying, tap "I\'ve paid".',
      'stamina.pay.genFail': 'Failed to create payment link: ',
      'stamina.pay.unknownError': 'unknown error',
      'stamina.pay.connFail': "Couldn't reach the backend. Try again later.",
      'stamina.refresh.noBackend': "⚠️ Backend not deployed/configured. Can't verify payment.",
      'stamina.refresh.checking': 'Checking with the server…',
      'stamina.refresh.ok': '🎉 Unlimited play unlocked for today!',
      'stamina.refresh.notFound': "No payment found yet. Make sure you've paid, then wait a few seconds and try again (Afdian callbacks can lag).",

      'lb.defaultUser': 'Player',
      'lb.anon': 'Anonymous',
      'lb.empty': 'No submissions yet — go play a round!',
      'lb.loading': 'Loading leaderboard…',
      'lb.loadFail': 'Load failed: ',
      'lb.loadFailSuffix': ' (check your network?)',
      'lb.recent': 'Just submitted, please wait',
      'lb.submitting': 'Submitting…',
      'lb.submitted': 'Ranked ✓　{name} · {score} pts',
      'lb.submitFail': 'Submit failed: ',
      'lb.settling': 'Settling…',
      'lb.retry': 'Retry submit',
      'lb.badResponse': 'Unreadable server response: '
    }
  };

  var lang = 'zh';
  try {
    var saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'zh') lang = saved;
  } catch (e) { /* 隐私模式：忽略 */ }

  function current() { return DICT[lang] || DICT.zh; }

  function interpolate(s, params) {
    if (!params) return s;
    for (var k in params) {
      if (!Object.prototype.hasOwnProperty.call(params, k)) continue;
      s = s.split('{' + k + '}').join(String(params[k]));
    }
    return s;
  }

  /* 取词：当前语言 → 中文兜底 → 传入的 fallback → key 本身 */
  function t(key, params, fallback) {
    var d = current();
    var s = d[key];
    if (s == null) s = DICT.zh[key];
    if (s == null) s = (fallback != null ? fallback : key);
    return interpolate(s, params);
  }

  function apply() {
    if (typeof document === 'undefined') return;

    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var v = t(el.getAttribute('data-i18n'));
      if (v != null) el.textContent = v;
    }

    var htmls = document.querySelectorAll('[data-i18n-html]');
    for (var j = 0; j < htmls.length; j++) {
      var eh = htmls[j];
      var vh = t(eh.getAttribute('data-i18n-html'));
      if (vh != null) eh.innerHTML = vh;
    }

    var attrs = document.querySelectorAll('[data-i18n-attr]');
    for (var m = 0; m < attrs.length; m++) {
      var ea = attrs[m];
      var spec = ea.getAttribute('data-i18n-attr') || '';
      var pairs = spec.split(';');
      for (var p = 0; p < pairs.length; p++) {
        var kv = pairs[p].split(':');
        if (kv.length < 2) continue;
        var attr = kv[0].trim();
        var key = kv.slice(1).join(':').trim();
        var va = t(key);
        if (attr && va != null) ea.setAttribute(attr, va);
      }
    }

    /* 语言按钮：显示「要切换到的目标语言」——中文界面显示 EN，英文界面显示 中 */
    var langBtn = document.getElementById('langBtn');
    if (langBtn) {
      var lbl = langBtn.querySelector('.lbl');
      if (lbl) lbl.textContent = (lang === 'zh') ? 'EN' : '中';
      langBtn.setAttribute('aria-label', (lang === 'zh') ? 'Switch to English' : '切换到中文');
    }

    if (document.title !== undefined) document.title = t('doc.title');
  }

  var listeners = [];
  function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }
  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](lang); } catch (e) { /* 单个刷新失败不影响其它 */ }
    }
  }

  function set(l) {
    if (l !== 'zh' && l !== 'en') return;
    if (l === lang) { apply(); notify(); return; }
    lang = l;
    try { localStorage.setItem(KEY, l); } catch (e) { /* ignore */ }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', l === 'zh' ? 'zh-CN' : 'en');
      document.documentElement.setAttribute('data-lang', l);
    }
    apply();
    notify();
  }

  function init() {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en');
      document.documentElement.setAttribute('data-lang', lang);
    }
    apply();
  }

  window.I18N = {
    t: t,
    set: set,
    apply: apply,
    onChange: onChange,
    get: function () { return lang; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
