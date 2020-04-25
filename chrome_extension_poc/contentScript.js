var pauseButton = document.getElementsByClassName("button-nfplayerPause")[0]

var port = chrome.runtime.connect({name: "knockknock"});
port.postMessage({joke: "Knock knock"});
port.onMessage.addListener(function(msg) {
  if (msg.question == "Who's there?")
    port.postMessage({answer: "Madame"});
  else if (msg.question == "Madame who?")
    port.postMessage({answer: "Madame... Bovary"});
});

pauseButton.removeEventListener("click", function() {
    console.log("Pause button click listener removed")
});

pauseButton.addEventListener("click", function() {
    chrome.runtime.sendMessage({greeting: "hello"}, function(response) {
        console.log(response.farewell);
      });
    console.log('blah');
}, false);
