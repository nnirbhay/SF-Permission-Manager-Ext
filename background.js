
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "get_sid") {
        chrome.cookies.get({ url: request.sfHost, name: "sid", storeId: sender.tab.cookieStoreId }, sessionCookie => {
            if (!sessionCookie) {
                sendResponse(null);
                return;
            }
            sendResponse(sessionCookie.value);
        });
        return true; // Tell Chrome that we want to call sendResponse asynchronously.
    }
});


