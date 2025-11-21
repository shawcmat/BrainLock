chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ isRunning: false, sites: [] });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'focusTimer') {
        resetState();
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startTimer') {
        startTimer(request.duration, request.strictMode);
        sendResponse({ status: 'started' });
    } else if (request.action === 'stopTimer') {
        handleStopRequest(sendResponse);
        return true; // Keep channel open for async response
    }
    return true;
});

async function startTimer(durationMinutes, strictMode) {
    const endTime = Date.now() + durationMinutes * 60 * 1000;

    await chrome.storage.local.set({
        isRunning: true,
        endTime: endTime,
        strictMode: strictMode || false
    });

    chrome.alarms.create('focusTimer', { delayInMinutes: durationMinutes });

    updateBlockingRules(true);
}

async function handleStopRequest(sendResponse) {
    const result = await chrome.storage.local.get(['strictMode']);
    if (result.strictMode) {
        sendResponse({ status: 'error', message: 'Strict Mode is active. Cannot stop.' });
        return;
    }

    await resetState();
    sendResponse({ status: 'stopped' });
}

async function resetState() {
    await chrome.storage.local.set({ isRunning: false, strictMode: false });
    chrome.alarms.clear('focusTimer');
    updateBlockingRules(false);
}

async function updateBlockingRules(enable) {
    const result = await chrome.storage.local.get(['sites']);
    const sites = result.sites || [];

    // First, remove all existing dynamic rules to start fresh
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingRuleIds = existingRules.map(rule => rule.id);

    if (existingRuleIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existingRuleIds
        });
    }

    if (enable && sites.length > 0) {
        const newRules = sites.map((site, index) => {
            return {
                id: index + 1,
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: `||${site}`,
                    resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'script', 'image', 'stylesheet', 'media', 'websocket']
                }
            };
        });

        await chrome.declarativeNetRequest.updateDynamicRules({
            addRules: newRules
        });
    }
}
