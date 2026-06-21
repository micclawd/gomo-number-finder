// GOMO Beautiful Number Finder - Content Script

(function() {
  'use strict';

  let isRunning = false;
  let refreshInterval = null;
  let refreshCount = 0;
  let stats = {
    totalChecked: 0,
    foundNumbers: []
  };

  // ==================== NUMBER PATTERN CHECKERS ====================

  function cleanNumber(num) {
    return num.replace(/\s+/g, '');
  }

  // Check a 4-digit block for patterns
  function checkBlock(block) {
    // Repeating: 8888, 6666
    for (let i = 0; i <= block.length - 4; i++) {
      const d = block[i];
      if (block[i+1] === d && block[i+2] === d && block[i+3] === d) {
        return { type: 'quadruple', value: d.repeat(4) };
      }
    }

    // Triple: 888x, x888
    for (let i = 0; i <= block.length - 3; i++) {
      const d = block[i];
      if (block[i+1] === d && block[i+2] === d) {
        return { type: 'triple', value: d.repeat(3) };
      }
    }

    // Double pairs: 8866, 6688
    if (block.length >= 4) {
      if (block[0] === block[1] && block[2] === block[3] && block[0] !== block[2]) {
        return { type: 'doublePair', value: block.substring(0, 4) };
      }
    }

    // Sequential ascending: 1234, 5678
    if (block.length >= 4) {
      let seq = true;
      for (let i = 0; i < 3; i++) {
        if (parseInt(block[i+1]) !== parseInt(block[i]) + 1) { seq = false; break; }
      }
      if (seq) return { type: 'sequential', value: block.substring(0, 4) };
    }

    // Sequential descending: 4321, 8765
    if (block.length >= 4) {
      let seq = true;
      for (let i = 0; i < 3; i++) {
        if (parseInt(block[i+1]) !== parseInt(block[i]) - 1) { seq = false; break; }
      }
      if (seq) return { type: 'descending', value: block.substring(0, 4) };
    }

    // Palindrome in block: 1221, 3443
    if (block.length >= 4) {
      if (block[0] === block[3] && block[1] === block[2]) {
        return { type: 'palindrome', value: block.substring(0, 4) };
      }
    }

    // Lucky ending in block: 1688, 8866
    const lucky = ['8888','6666','9999','888','666','999','168','188','886','668','866','88','66','99'];
    for (const p of lucky) {
      if (block.endsWith(p) && block.length >= 4) {
        return { type: 'luckyEnding', value: p };
      }
    }

    // Repeated pairs: 8686, 1212
    if (block.length >= 4) {
      if (block[0] === block[2] && block[1] === block[3] && block[0] !== block[1]) {
        return { type: 'repeatedPair', value: block.substring(0, 4) };
      }
    }

    return null;
  }

  // Main: check first 4 and last 4 separately
  function checkAllPatterns(num) {
    const clean = cleanNumber(num);
    if (clean.length < 8) return null;

    const first4 = clean.substring(0, 4);
    const last4 = clean.substring(4, 8);

    // Check first 4
    let result = checkBlock(first4);
    if (result) return { ...result, block: 'first4' };

    // Check last 4
    result = checkBlock(last4);
    if (result) return { ...result, block: 'last4' };

    // Full number mirror: 12344321
    if (clean.length === 8) {
      const firstHalf = clean.substring(0, 4);
      const secondHalf = clean.substring(4, 8);
      if (firstHalf === secondHalf.split('').reverse().join('')) {
        return { type: 'mirror', value: clean, block: 'full' };
      }
    }

    return null;
  }

  // ==================== DOM INTERACTION ====================

  function getNumbers() {
    const numbers = [];
    const numberElements = document.querySelectorAll('.number___27qeS');
    numberElements.forEach(el => {
      const text = el.textContent.trim();
      if (text) numbers.push(text);
    });
    return numbers;
  }

  function clickStandard() {
    const typeButtons = document.querySelectorAll('.type___1f7zL');
    for (const btn of typeButtons) {
      if (btn.textContent.trim() === 'Standard') {
        btn.click();
        return true;
      }
    }
    console.log('[GOMO Finder] Standard button not found');
    return false;
  }

  // ==================== NOTIFICATION ====================

  function showNotification(number, pattern) {
    const overlay = document.createElement('div');
    overlay.id = 'gomo-finder-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.85); z-index: 999999;
      display: flex; align-items: center; justify-content: center;
      font-family: Arial, sans-serif;
    `;

    overlay.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 20px; padding: 40px; text-align: center; max-width: 500px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      ">
        <h1 style="color: #FFD700; font-size: 32px; margin: 0 0 10px 0;">
          BEAUTIFUL NUMBER FOUND!
        </h1>
        <div style="
          background: white; border-radius: 10px; padding: 20px; margin: 20px 0;
          font-size: 36px; font-weight: bold; color: #333; letter-spacing: 2px;
        ">${number}</div>
        <p style="color: #e0e0e0; margin: 10px 0; font-size: 16px;">
          Pattern: <strong style="color: #FFD700;">${pattern.type}</strong> (${pattern.value})
          <br>Location: <strong>${pattern.block === 'first4' ? 'First 4 digits' : pattern.block === 'last4' ? 'Last 4 digits' : 'Full number'}</strong>
        </p>
        <p style="color: #e0e0e0; margin: 10px 0; font-size: 14px;">
          Checked ${refreshCount} times
        </p>
        <button id="gomo-finder-close" style="
          background: #FFD700; color: #333; border: none; padding: 15px 40px;
          font-size: 18px; font-weight: bold; border-radius: 30px; cursor: pointer; margin-top: 20px;
        ">GOT IT!</button>
      </div>
    `;

    document.body.appendChild(overlay);

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 800;
      osc.type = 'sine';
      gain.gain.value = 0.3;
      osc.start();
      setTimeout(() => { osc.frequency.value = 1000; }, 200);
      setTimeout(() => { osc.frequency.value = 1200; }, 400);
      setTimeout(() => { osc.stop(); audioCtx.close(); }, 600);
    } catch (e) {}

    document.getElementById('gomo-finder-close').addEventListener('click', () => overlay.remove());

    if (Notification.permission === 'granted') {
      new Notification('GOMO Beautiful Number Found!', {
        body: `${number} (${pattern.type}: ${pattern.value})`
      });
    }
  }

  // ==================== MAIN LOOP ====================

  function runCheck() {
    if (!isRunning) return;

    const numbers = getNumbers();
    console.log(`[GOMO Finder] Checking ${numbers.length} numbers...`);

    for (const num of numbers) {
      stats.totalChecked++;
      const pattern = checkAllPatterns(num);
      if (pattern) {
        console.log(`[GOMO FOUND] ${num} - ${pattern.type}: ${pattern.value} (${pattern.block})`);
        stats.foundNumbers.push({ number: num, pattern });
        showNotification(num, pattern);
        stop();
        return;
      }
    }

    refreshCount++;
    updateBadge();
    clickStandard();
  }

  function updateBadge() {
    chrome.runtime?.sendMessage({
      type: 'updateBadge',
      count: refreshCount,
      running: isRunning
    }).catch(() => {});
  }

  function start() {
    if (isRunning) return;
    isRunning = true;
    refreshCount = 0;
    stats = { totalChecked: 0, foundNumbers: [] };

    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    console.log('[GOMO Finder] Starting...');
    runCheck();
    refreshInterval = setInterval(runCheck, 2000);
    updateBadge();
  }

  function stop() {
    isRunning = false;
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    updateBadge();
    console.log('[GOMO Finder] Stopped');
  }

  // ==================== MESSAGE HANDLER ====================

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'start') {
      start();
      sendResponse({ status: 'started', refreshCount, totalChecked: stats.totalChecked });
    } else if (request.type === 'stop') {
      stop();
      sendResponse({ status: 'stopped', refreshCount, totalChecked: stats.totalChecked });
    } else if (request.type === 'getStatus') {
      sendResponse({
        isRunning, refreshCount,
        totalChecked: stats.totalChecked,
        foundNumbers: stats.foundNumbers
      });
    }
    return true;
  });

  console.log('[GOMO Finder] Content script loaded on', window.location.href);
})();
