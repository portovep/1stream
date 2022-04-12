chrome.runtime.onInstalled.addListener(function () {
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function () {
    chrome.declarativeContent.onPageChanged.addRules([
      {
        conditions: [
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostEquals: "www.netflix.com", pathContains: "watch" },
          }),
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostEquals: "www.youtube.com", pathContains: "watch" },
          }),
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostEquals: "play.hbomax.com", pathContains: "feature" },
          }),
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostEquals: "play.hbomax.com", pathContains: "episode" },
          }),
        ],
        actions: [new chrome.declarativeContent.ShowPageAction()],
      },
    ]);
  });
});

chrome.pageAction.onClicked.addListener(function (tab) {
  console.log("Page Action on click fired for tab ID: " + tab.id);
  console.log("and URL: " + tab.url);

  console.log("Sending start command to tab ID: " + tab.id);

  chrome.tabs.sendMessage(tab.id, { command: "START" }, function (response) {
    console.log(
      "Tab with ID " + tab.id + " responded with status: " + response.status
    );
  });
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.event) {
    mixpanel.track(request.event, request.params);
  } else if (request.error) {
    console.error(request.error);
    Rollbar.error(request.error);
  }
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.title) {
    chrome.tabs.sendMessage(tabId, {
      command: "URL_CHANGED",
      newUrl: changeInfo.url,
    });
  }
});
