#!/usr/bin/env node
/* ============================================================
 *  生成「解锁码」的 SHA-256 哈希，用来替换 stamina.js 里的 UNLOCK_HASH。
 *
 *  用法：
 *    node tools/gen_unlock_hash.js "<你的解锁码>"
 *
 *  输出两行：
 *    1) 你这次设的明文码（仅供你自己记，别写进仓库/公开）
 *    2) 要把 stamina.js 里 UNLOCK_HASH 改成的值
 *
 *  注意：salt 必须与 stamina.js 里的 UNLOCK_SALT 保持一致。
 * ============================================================ */
'use strict';
const crypto = require('crypto');

const SALT = 'dnw_sponsor_salt_v1'; // 必须与 stamina.js 的 UNLOCK_SALT 相同

const code = process.argv[2];
if (!code) {
  console.error('用法: node tools/gen_unlock_hash.js "<你的解锁码>"');
  process.exit(1);
}

const hash = crypto.createHash('sha256').update(code + SALT).digest('hex');
console.log('明文解锁码 : ' + code + '   （只给你自己/付款人，别提交到仓库）');
console.log('UNLOCK_HASH : ' + hash);
console.log('\n把上面 UNLOCK_HASH 的值粘进 stamina.js 顶部的 UNLOCK_HASH 即可。');
