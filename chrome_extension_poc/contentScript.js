console.log("Waiting for START command from extension");

var video;
var room;

async function startup() {
  video = await getVideoElement();
  video.pause();

  room = await Room.create()
  room.onPlay(syncPlay)
  room.onPause(syncPause)
  room.onConnectionOpened(() => {
    room.sendPauseCommand(video.currentTime)
  })

  bindVideoListeners(video);

  printURLToShare(room.roomId);
  reportStatusToContentScript("STARTED");
}

async function connect() {
  video = await getVideoElement();
  video.pause();

  const roomName = extractRoomNameFromURL();
  room = await Room.join(roomName)
  room.onPlay(syncPlay)
  room.onPause(syncPause)

  bindVideoListeners(video);
}

window.onbeforeunload = function() {
  if (room) {
    room.close()
  }
};

//// BINDINGS AND VIDEO SYNC ////
var isRemotePlay = false;
var isRemotePause = false;

function bindVideoListeners(video) {
  video.addEventListener("play", (event) => {
    if (isRemotePlay) {
      console.log("Video played from remote command");
      isRemotePlay = false;
      return;
    }

    room.sendPlayCommand(video.currentTime)
  });

  video.addEventListener("pause", (event) => {
    if (isRemotePause) {
      console.log("Video pause from remote command");
      isRemotePause = false;
      return;
    }

    room.sendPauseCommand(video.currentTime)
  });
}

function syncPlay(currentTime) {
  console.log(
    "Play command received, local video time: " +
      video.currentTime +
      ", new time: " +
      currentTime
  );

  isRemotePlay = true;
  video.currentTime = currentTime;
  video.play();
}

function syncPause(currentTime) {
  console.log(
    "Pause command received, local video time: " +
      video.currentTime +
      ", new time: " +
      currentTime
  );

  isRemotePause = true;
  video.currentTime = currentTime;
  video.pause();
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

function setCurrentTime(newCurrentTime) {
  var url = window.location.href;
  if (url.includes("netflix")) {
    console.log("Setting Netflix Current Time");
    window.postMessage(
      { type: "SET_CURRENT_TIME", currentTime: newCurrentTime },
      "*"
    );
  } else {
    video.currentTime = newCurrentTime;
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
  var s = document.createElement("script");
  s.textContent = netflixHandlerScriptContent;
  (document.head || document.documentElement).appendChild(s);
  s.onload = function() {
    s.remove();
  };
}

const netflixHandlerScriptContent = `setTimeout(function() {
  window.addEventListener('message', function(event) {
    console.log('page javascript got message:', event);

    const videoPlayer = window.netflix.appContext.state.playerApp.getAPI()
    .videoPlayer;
    const playerSessionId = videoPlayer.getAllPlayerSessionIds()[0];
    const player = videoPlayer.getVideoPlayerBySessionId(playerSessionId);

    if (event.data.type === "SET_CURRENT_TIME") {
      console.log("Trying to set new current time from:" + event.data.currentTime);
      player.seek(event.data.currentTime);
      player.pause();
      console.log("New current time is:" + player.getCurrentTime());
    }

  });
}, 0);`.trim();
