document.addEventListener('DOMContentLoaded', () => {
  const siteInput = document.getElementById('site-input');
  const addBtn = document.getElementById('add-btn');
  const siteList = document.getElementById('site-list');
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  const timerSection = document.getElementById('timer-section');
  const setupSection = document.getElementById('setup-section');
  const timeRemainingDisplay = document.getElementById('time-remaining');
  const durationBtns = document.querySelectorAll('.duration-btn');
  const statusIndicator = document.getElementById('status-indicator');
  const strictModeToggle = document.getElementById('strict-mode-toggle');
  const strictModeMsg = document.getElementById('strict-mode-msg');

  let selectedDuration = 60; // Default 1 hour

  // Load state
  updateUI();
  loadSites();

  // Event Listeners
  addBtn.addEventListener('click', addSite);
  siteInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addSite();
  });

  durationBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      durationBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedDuration = parseInt(btn.dataset.time);
    });
  });

  startBtn.addEventListener('click', () => {
    const strictMode = strictModeToggle.checked;
    chrome.runtime.sendMessage({
      action: 'startTimer',
      duration: selectedDuration,
      strictMode: strictMode
    }, () => {
      updateUI();
    });
  });

  stopBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'stopTimer' }, () => {
      updateUI();
    });
  });

  // Update UI every second if timer is running
  setInterval(updateTimerDisplay, 1000);

  function addSite() {
    const site = siteInput.value.trim();
    if (!site) return;

    chrome.storage.local.get(['sites'], (result) => {
      const sites = result.sites || [];
      if (!sites.includes(site)) {
        sites.push(site);
        chrome.storage.local.set({ sites }, () => {
          siteInput.value = '';
          renderSites(sites);
        });
      }
    });
  }

  function loadSites() {
    chrome.storage.local.get(['sites'], (result) => {
      renderSites(result.sites || []);
    });
  }

  function renderSites(sites) {
    siteList.innerHTML = '';
    // Check if strict mode is active to potentially hide delete buttons
    chrome.storage.local.get(['isRunning', 'strictMode'], (result) => {
      const isStrict = result.isRunning && result.strictMode;

      sites.forEach(site => {
        const li = document.createElement('li');
        li.className = 'site-item';

        let deleteBtnHtml = `
          <button class="delete-btn" aria-label="Remove">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        `;

        if (isStrict) {
          deleteBtnHtml = ''; // No delete button in strict mode
        }

        li.innerHTML = `<span>${site}</span>${deleteBtnHtml}`;

        if (!isStrict) {
          li.querySelector('.delete-btn').addEventListener('click', () => removeSite(site));
        }

        siteList.appendChild(li);
      });
    });
  }

  function removeSite(site) {
    chrome.storage.local.get(['sites'], (result) => {
      const sites = result.sites || [];
      const newSites = sites.filter(s => s !== site);
      chrome.storage.local.set({ sites: newSites }, () => {
        renderSites(newSites);
      });
    });
  }

  function updateUI() {
    chrome.storage.local.get(['isRunning', 'endTime', 'strictMode'], (result) => {
      if (result.isRunning && result.endTime > Date.now()) {
        setupSection.classList.add('hidden');
        timerSection.classList.remove('hidden');
        statusIndicator.className = 'status-active';

        // Strict Mode Logic
        if (result.strictMode) {
          stopBtn.classList.add('hidden');
          strictModeMsg.classList.remove('hidden');
        } else {
          stopBtn.classList.remove('hidden');
          strictModeMsg.classList.add('hidden');
        }

        // Re-render sites to update delete buttons based on strict mode
        loadSites();

        updateTimerDisplay();
      } else {
        setupSection.classList.remove('hidden');
        timerSection.classList.add('hidden');
        statusIndicator.className = 'status-idle';

        // Re-render sites to show delete buttons
        loadSites();
      }
    });
  }

  function updateTimerDisplay() {
    chrome.storage.local.get(['isRunning', 'endTime'], (result) => {
      if (result.isRunning && result.endTime) {
        const now = Date.now();
        const diff = result.endTime - now;

        if (diff <= 0) {
          setupSection.classList.remove('hidden');
          timerSection.classList.add('hidden');
          statusIndicator.className = 'status-idle';
          return;
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        timeRemainingDisplay.textContent =
          `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
    });
  }
});
