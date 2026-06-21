// Popup script for GOMO Number Finder

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const ultimateBtn = document.getElementById('ultimateBtn');
  const statusEl = document.getElementById('status');
  const refreshCountEl = document.getElementById('refreshCount');
  const totalCheckedEl = document.getElementById('totalChecked');
  const foundSection = document.getElementById('foundSection');
  const foundCountEl = document.getElementById('foundCount');
  const foundListEl = document.getElementById('foundList');

  let updateInterval = null;
  let isUltimate = false;

  function updateUI(data) {
    if (data.isRunning) {
      statusEl.textContent = 'Running';
      statusEl.className = 'status-value running';
      startBtn.disabled = true;
      stopBtn.disabled = false;
    } else {
      statusEl.textContent = 'Stopped';
      statusEl.className = 'status-value';
      startBtn.disabled = false;
      stopBtn.disabled = true;
    }

    refreshCountEl.textContent = data.refreshCount || 0;
    totalCheckedEl.textContent = data.totalChecked || 0;

    if (data.isUltimate !== undefined) {
      isUltimate = data.isUltimate;
      if (isUltimate) {
        ultimateBtn.classList.add('active');
        ultimateBtn.textContent = 'ULTIMATE: ON';
      } else {
        ultimateBtn.classList.remove('active');
        ultimateBtn.textContent = 'ULTIMATE MODE';
      }
    }

    if (data.foundNumbers && data.foundNumbers.length > 0) {
      foundSection.style.display = 'block';
      foundCountEl.textContent = data.foundNumbers.length;
      foundListEl.innerHTML = data.foundNumbers.map(item => `
        <div class="found-item">
          <span class="found-number">${item.number}</span>
          <span class="found-pattern">(${item.pattern.type})</span>
        </div>
      `).join('');
    }
  }

  async function sendMessage(type, extra = {}) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { type, ...extra });
      return response;
    } catch (error) {
      console.error('Error:', error);
      return null;
    }
  }

  async function pollStatus() {
    const response = await sendMessage('getStatus');
    if (response) {
      updateUI(response);
    }
  }

  startBtn.addEventListener('click', async () => {
    const response = await sendMessage('start');
    if (response) {
      updateUI(response);
      if (updateInterval) clearInterval(updateInterval);
      updateInterval = setInterval(pollStatus, 1000);
    }
  });

  stopBtn.addEventListener('click', async () => {
    const response = await sendMessage('stop');
    if (response) {
      updateUI(response);
      if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
      }
    }
  });

  ultimateBtn.addEventListener('click', async () => {
    isUltimate = !isUltimate;
    const response = await sendMessage('setUltimate', { value: isUltimate });
    if (response) {
      updateUI({ isUltimate });
    }
  });

  pollStatus();
});
