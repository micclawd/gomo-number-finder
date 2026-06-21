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

  // Check for 4+ repeating consecutive digits
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

  // Check for triple digits (3 repeating)
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

  // Check for double-double pairs (e.g., 2244, 8866)
  function hasDoublePairs(num) {
    const clean = cleanNumber(num);
    for (let i = 0; i <= clean.length - 3; i++) {
      if (clean[i] === clean[i+1] && clean[i+2] === clean[i+3] && clean[i] !== clean[i+2]) {
        return { type: 'doublePair', value: clean.substring(i, i+4) };
      }
    }
    return null;
  }

  // Check for sequential ascending (e.g., 1234, 5678)
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
      if (isSequential) {
        return { type: 'sequential', value: clean.substring(i, i+4) };
      }
    }
    return null;
  }

  // Check for sequential descending (e.g., 4321, 8765)
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
      if (isSequential) {
        return { type: 'descending', value: clean.substring(i, i+4) };
      }
    }
    return null;
  }

  // Check for palindrome
  function hasPalindrome(num) {
    const clean = cleanNumber(num);
    if (clean.length >= 6) {
      for (let len = 6; len <= clean.length; len++) {
        for (let start = 0; start <= clean.length - len; start++) {
          const sub = clean.substring(start, start + len);
          if (sub === sub.split('').reverse().join('')) {
            return { type: 'palindrome', value: sub };
          }
        }
      }
    }
    return null;
  }

  // Check for lucky endings (8888, 6666, 9999, etc.)
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

  // Check for repeated pairs (e.g., 9696, 1212)
  function hasRepeatedPairs(num) {
    const clean = cleanNumber(num);
    for (let i = 0; i <= clean.length - 3; i++) {
      if (clean[i] === clean[i+2] && clean[i+1] === clean[i+3] && clean[i] !== clean[i+1]) {
        return { type: 'repeatedPair', value: clean.substring(i, i+4) };
      }
    }
    return null;
  }

  // Check for mirror (first 4 and last 4 reversed)
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

  // Main check function
  function checkAllPatterns(num) {
    const checks = [
      hasRepeatingDigits,
      hasTripleDigits,
      hasDoublePairs,
      hasSequentialAscending,
      hasSequentialDescending,
      hasPalindrome,
      hasLuckyEnding,
      hasRepeatedPairs,
      hasMirror
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
    const numberElements = document.querySelectorAll('.number___27qeS, .numberItemBox___24dDV .number___27qeS');
    numberElements.forEach(el => {
      if (el.textContent.trim()) {
        numbers.push(el.textContent.trim());
      }
    });
    return numbers;
  }

  function clickStandard() {
    // Click the "Standard" button to refresh numbers
    const typeButtons = document.querySelectorAll('.type___1f7zL');
    for (const btn of typeButtons) {
      if (btn.textContent.includes("Standard")) {
        btn.click();
        return true;
      }
    }

    // Fallback: look for any Standard-like button
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      if (el.textContent.trim() === 'Standard' && el.classList.toString().includes('type')) {
        el.click();
        return true;
      }
    }

    return false;
  }

  function clickStandardTab() {
    // Click on the "Standard" tab to refresh numbers
    const allTabs = document.querySelectorAll('.tabPaneBox___2NBAc');
    for (const tab of allTabs) {
      const nameEl = tab.querySelector('.name___oKAEz');
      if (nameEl && nameEl.textContent.includes("Standard")) {
        tab.click();
        return true;
      }
    }
    return false;
  }

  // ==================== NOTIFICATION ====================

  function showNotification(number, pattern) {
    // Create notification overlay
    const overlay = document.createElement('div');
    overlay.id = 'gomo-finder-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.85);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Arial, sans-serif;
    `;

    overlay.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 20px;
        padding: 40px;
        text-align: center;
        max-width: 500px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        animation: popIn 0.3s ease-out;
      ">
        <h1 style="color: #FFD700; font-size: 32px; margin: 0 0 10px 0;">
          <span style="font-size: 50px;">&#127881;</span> BEAUTIFUL NUMBER FOUND!
        </h1>
        <div style="
          background: white;
          border-radius: 10px;
          padding: 20px;
          margin: 20px 0;
          font-size: 36px;
          font-weight: bold;
          color: #333;
          letter-spacing: 2px;
        ">${number}</div>
        <p style="color: #e0e0e0; margin: 10px 0; font-size: 16px;">
          Pattern: <strong style="color: #FFD700;">${pattern.type}</strong> (${pattern.value})
        </p>
        <p style="color: #e0e0e0; margin: 10px 0; font-size: 14px;">
          Checked ${refreshCount} times | Found ${stats.foundNumbers.length} beautiful numbers
        </p>
        <button id="gomo-finder-close" style="
          background: #FFD700;
          color: #333;
          border: none;
          padding: 15px 40px;
          font-size: 18px;
          font-weight: bold;
          border-radius: 30px;
          cursor: pointer;
          margin-top: 20px;
          transition: transform 0.2s;
        ">GOT IT!</button>
      </div>
    `;

    document.body.appendChild(overlay);

    // Play sound
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      oscillator.start();
      setTimeout(() => {
        oscillator.frequency.value = 1000;
        setTimeout(() => {
          oscillator.frequency.value = 1200;
          setTimeout(() => {
            oscillator.stop();
            audioCtx.close();
          }, 200);
        }, 200);
      }, 200);
    } catch (e) {}

    // Close button
    document.getElementById('gomo-finder-close').addEventListener('click', () => {
      overlay.remove();
    });

    // Also use browser notification
    if (Notification.permission === 'granted') {
      new Notification('GOMO Beautiful Number Found!', {
        body: `${number} (${pattern.type}: ${pattern.value})`,
        icon: 'icon128.png'
      });
    }
  }

  // ==================== MAIN LOOP ====================

  async function runCheck() {
    if (!isRunning) return;

    const numbers = getNumbers();
    let foundBeautiful = false;

    for (const num of numbers) {
      stats.totalChecked++;
      const pattern = checkAllPatterns(num);

      if (pattern) {
        stats.foundNumbers.push({ number: num, pattern });
        showNotification(num, pattern);
        foundBeautiful = true;
        stop();
        return;
      }
    }

    refreshCount++;
    updateBadge();

    // Click to refresh
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

    // Request notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Run immediately then every 2 seconds
    runCheck();
    refreshInterval = setInterval(runCheck, 2000);

    updateBadge();
    console.log('[GOMO Finder] Started!');
  }

  function stop() {
    isRunning = false;
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    updateBadge();
    console.log('[GOMO Finder] Stopped!');
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
        isRunning,
        refreshCount,
        totalChecked: stats.totalChecked,
        foundNumbers: stats.foundNumbers
      });
    }
    return true;
  });

  // Auto-start if previously enabled
  chrome.storage.local.get(['autoStart'], (result) => {
    if (result.autoStart) {
      setTimeout(start, 1000);
    }
  });

  console.log('[GOMO Finder] Content script loaded!');
})();
