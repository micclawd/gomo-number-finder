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

  function hasRepeatingDigits(num) {
    const clean = cleanNumber(num);
    for (let i = 0; i <= clean.length - 4; i++) {
      const digit = clean[i];
      let count = 1;
      for (let j = i + 1; j < clean.length && clean[j] === digit; j++) {
        count++;
      }
      if (count >= 4) return { type: 'repeating', value: digit.repeat(count) };
    }
    return null;
  }

  function hasTripleDigits(num) {
    const clean = cleanNumber(num);
    for (let i = 0; i <= clean.length - 3; i++) {
      const digit = clean[i];
      if (clean[i+1] === digit && clean[i+2] === digit) {
        return { type: 'triple', value: digit.repeat(3) };
      }
    }
    return null;
  }

  function hasDoublePairs(num) {
    const clean = cleanNumber(num);
    for (let i = 0; i <= clean.length - 3; i++) {
      if (clean[i] === clean[i+1] && clean[i+2] === clean[i+3] && clean[i] !== clean[i+2]) {
        return { type: 'doublePair', value: clean.substring(i, i+4) };
      }
    }
    return null;
  }

  function hasSequentialAscending(num) {
    const clean = cleanNumber(num);
    for (let i = 0; i <= clean.length - 4; i++) {
      let isSequential = true;
      for (let j = 0; j < 3; j++) {
        if (parseInt(clean[i+j+1]) !== parseInt(clean[i+j]) + 1) {
          isSequential = false;
          break;
        }
      }
      if (isSequential) return { type: 'sequential', value: clean.substring(i, i+4) };
    }
    return null;
  }

  function hasSequentialDescending(num) {
    const clean = cleanNumber(num);
    for (let i = 0; i <= clean.length - 4; i++) {
      let isSequential = true;
      for (let j = 0; j < 3; j++) {
        if (parseInt(clean[i+j+1]) !== parseInt(clean[i+j]) - 1) {
          isSequential = false;
          break;
        }
      }
      if (isSequential) return { type: 'descending', value: clean.substring(i, i+4) };
    }
    return null;
  }

  function hasPalindrome(num) {
    const clean = cleanNumber(num);
    for (let len = Math.min(clean.length, 8); len >= 6; len--) {
      for (let start = 0; start <= clean.length - len; start++) {
        const sub = clean.substring(start, start + len);
        if (sub === sub.split('').reverse().join('')) {
          return { type: 'palindrome', value: sub };
        }
      }
    }
    return null;
  }

  function hasLuckyEnding(num) {
    const clean = cleanNumber(num);
    const luckyPatterns = ['8888', '6666', '9999', '888', '666', '999', '168', '188', '886', '668', '866'];
    for (const pattern of luckyPatterns) {
      if (clean.endsWith(pattern)) {
        return { type: 'luckyEnding', value: pattern };
      }
    }
    return null;
  }

  function hasRepeatedPairs(num) {
    const clean = cleanNumber(num);
    for (let i = 0; i <= clean.length - 3; i++) {
      if (clean[i] === clean[i+2] && clean[i+1] === clean[i+3] && clean[i] !== clean[i+1]) {
        return { type: 'repeatedPair', value: clean.substring(i, i+4) };
      }
    }
    return null;
  }

  function hasMirror(num) {
    const clean = cleanNumber(num);
    if (clean.length === 8) {
      const first4 = clean.substring(0, 4);
      const last4 = clean.substring(4, 8);
      if (first4 === last4.split('').reverse().join('')) {
        return { type: 'mirror', value: clean };
      }
    }
    return null;
  }

  function checkAllPatterns(num) {
    const checks = [
      hasRepeatingDigits, hasTripleDigits, hasDoublePairs,
      hasSequentialAscending, hasSequentialDescending,
      hasPalindrome, hasLuckyEnding, hasRepeatedPairs, hasMirror
    ];
    for (const check of checks) {
      const result = check(num);
      if (result) return result;
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

    // Find the Standard button
    let standardBtn = null;
    let luckyBtn = null;
    for (const btn of typeButtons) {
      const text = btn.textContent.trim();
      if (text === 'Standard') standardBtn = btn;
      if (text.includes("lucky")) luckyBtn = btn;
    }

    if (!standardBtn) {
      console.log('[GOMO Finder] Standard button not found');
      return false;
    }

    // If Standard is already active, toggle to lucky then back to Standard to refresh
    if (standardBtn.classList.contains('active___1Ny46') || standardBtn.classList.toString().includes('active')) {
      console.log('[GOMO Finder] Standard already active, toggling to refresh');
      if (luckyBtn) {
        luckyBtn.click();
        setTimeout(() => standardBtn.click(), 300);
        return true;
      }
      // If no lucky button, just click standard anyway
      standardBtn.click();
      return true;
    }

    // Standard is not active, just click it
    standardBtn.click();
    return true;
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
        </p>
        <p style="color: #e0e0e0; margin: 10px 0; font-size: 14px;">
          Checked ${refreshCount} times | Found ${stats.foundNumbers.length} beautiful numbers
        </p>
        <button id="gomo-finder-close" style="
          background: #FFD700; color: #333; border: none; padding: 15px 40px;
          font-size: 18px; font-weight: bold; border-radius: 30px; cursor: pointer; margin-top: 20px;
        ">GOT IT!</button>
      </div>
    `;

    document.body.appendChild(overlay);

    // Play sound
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
        console.log(`[GOMO FOUND] ${num} - ${pattern.type}: ${pattern.value}`);
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
