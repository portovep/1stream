console.log("Waiting for START command from extension");

async function startup() {
  var roomName = generateRoomName();
  connectToSignalingServer(roomName);

  var video = await getVideoElement();
  setVideo(video);
  video.pause();

  console.log("configuring listeners");
  bindEventListeners(video);

  printURLToShare(roomName);

  reportStatusToContentScript("STARTED");
}

async function connect() {
  const roomName = extractRoomNameFromURL();
  console.log("Connecting to room name: " + roomName);

  var video = await getVideoElement();
  setVideo(video);
  video.pause();

  console.log("configuring listeners");
  bindEventListeners(video);

  connectToSignalingServer(roomName);
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("Received command " + request.command + " from extension");
  if (request.command == "START") {
    console.log("Reporting status STARTING to extension");
    sendResponse({ status: "STARTING" });
    startup();
  } else if (request.command == "CONNECT") {
    console.log("Reporting status CONNECTING to extension");
    sendResponse({ status: "CONNECTING" });
    connect();
  }
});

function reportStatusToContentScript(status) {
  console.log("Reporting status " + status + " to extension");
  chrome.runtime.sendMessage({ status });
}

function extractRoomNameFromURL() {
  const urlParams = new URLSearchParams(document.location.search);
  const roomName = urlParams.get("roomName");
  if (!roomName) {
    throw "No roomName was found in the URL";
  }
  return roomName;
}

function generateRoomName() {
  return uuidv4();
}

function printURLToShare(roomName) {
  const urlParams = new URL(document.location).searchParams;
  urlParams.append("roomName", roomName);

  const sharableURL =
    document.location.origin +
    document.location.pathname +
    "?" +
    urlParams.toString();

  console.log(sharableURL);
  alert(sharableURL);
}

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function setCurrentTime(newCurrentTimeInSeconds) {
  var url = window.location.href;
  if (url.includes("netflix")) {
    console.log("Setting Netflix Current Time");
    const newCurrentTimeInMs = Math.floor(newCurrentTimeInSeconds * 1000);
    window.postMessage(
      { type: "SET_CURRENT_TIME", currentTime: newCurrentTimeInMs },
      "*"
    );
  } else {
    video.currentTime = newCurrentTimeInSeconds;
  }
}

function getVideoElement() {
  var url = window.location.href;

  if (url.includes("netflix")) {
    injectNetflixHandler();
    return retryUntilFound(() => document.getElementsByTagName("video")[0]);
  } else if (url.includes("youtube")) {
    return retryUntilFound(() => document.getElementsByTagName("video")[0]);
  } else if (url.includes("prime")) {
    var resumeButton = [...document.querySelectorAll("a[href]")].find((e) =>
      e.href.includes("/detail")
    );

    if (resumeButton) {
      resumeButton.click();
    }
    return retryUntilFound(() => document.getElementsByTagName("video")[0]);
  } else {
    throw "Cannot find a video element for this page";
  }
}

function retryUntilFound(query) {
  return new Promise((resolve, reject) => {
    var checkExist = setInterval(function() {
      var video = query();
      console.log("Looking for video");
      if (video.currentTime) {
        console.log("Got video: ", video);
        clearInterval(checkExist);
        resolve(video);
      }
    }, 1000);
  });
}

function injectNetflixHandler() {
  const netflixHandlerScriptContent = `setTimeout(function() {
    window.addEventListener('message', function(event) {
      console.log('page javascript got message:', event);
  
      const videoPlayer = window.netflix.appContext.state.playerApp.getAPI()
      .videoPlayer;
      const playerSessionId = videoPlayer.getAllPlayerSessionIds()[0];
      const player = videoPlayer.getVideoPlayerBySessionId(playerSessionId);
  
      if (event.data.type === "SET_CURRENT_TIME") {
        console.log("Trying to set new current time (ms): " + event.data.currentTime);
        player.seek(event.data.currentTime);
        player.pause();
        console.log("New current time is (ms): " + player.getCurrentTime());
      }
  
    });
  }, 0);`.trim();

  var s = document.createElement("script");
  s.textContent = netflixHandlerScriptContent;
  (document.head || document.documentElement).appendChild(s);
  s.onload = function() {
    s.remove();
  };
}
