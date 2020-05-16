chrome.runtime.onInstalled.addListener(function() {
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
    chrome.declarativeContent.onPageChanged.addRules([
      {
        conditions: [
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostEquals: "www.netflix.com" },
          }),
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostEquals: "www.youtube.com" },
          }),
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostEquals: "www.primevideo.com" },
          }),
        ],
        actions: [new chrome.declarativeContent.ShowPageAction()],
      },
    ]);
  });
});

chrome.webNavigation.onCompleted.addListener(
  function(event) {
    chrome.tabs.sendMessage(event.tabId, { command: "CONNECT" }, function(response) {
      console.log(
        "Tab with ID " + event + " responded with status: " + response.status
      );
    });
  },
  {
    url: [
      {
        urlMatches: "https://www.netflix.com/watch/*",
        queryContains: "roomName",
      },
      {
        urlMatches: "https://www.primevideo.com/detail/*",
        queryContains: "roomName",
      },
      {
        urlMatches: "https://www.youtube.com/watch*",
        queryContains: "roomName",
      },
    ],
  }
);

chrome.pageAction.onClicked.addListener(function(tab) {
  console.log("Page Action on click fired for tab ID: " + tab.id);
  console.log("and URL: " + tab.url);

  console.log("Sending start command to tab ID: " + tab.id);

  chrome.tabs.sendMessage(tab.id, { command: "START" }, function(response) {
    console.log(
      "Tab with ID " + tab.id + " responded with status: " + response.status
    );
  });
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.status) {
    console.log(
      "Tab with ID " +
        sender.tab.id +
        " responded with status: " +
        request.status
    );
  }
});
