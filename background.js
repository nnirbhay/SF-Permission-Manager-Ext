chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "get_sid") {
        chrome.cookies.get({ url: request.sfHost, name: "sid", storeId: sender.tab.cookieStoreId }, sessionCookie => {
            if (!sessionCookie) {
                sendResponse(null);
                return;
            }
            sendResponse(sessionCookie.value);
        });
        return true;
    }

    if (request.action === "OPEN_RECORD_ACCESS_ANALYZER") {
        // Forward message to the content script in the specific tab
        chrome.tabs.sendMessage(request.tabId, { action: "OPEN_RECORD_ACCESS_ANALYZER" });
        return true;
    }
});


