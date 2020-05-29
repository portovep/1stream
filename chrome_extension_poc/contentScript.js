console.log("Waiting for START command from extension");
var view = View.initializeUI(document, window);

var video;
var room;

async function startup() {
  view.showNotification("Extension initialized");
  
  if (!video) {
    video = await VideoPlayer.locateVideo(document, window.location.hostname);
    video.pause();
  }

  if (room && !room.closed) {
    if (room.isCreator) {
      console.log("Trying to startup but there is already a valid created room")
      printURLToShare(room.roomId);
    } else {
      console.log("Trying to startup but you are already connected to room: " + room.roomId)
    }
    return;
  }

  room = await Room.create();
  bindVideoPlayerToRoom(video, room);

  reportStatusToContentScript("STARTED");
  printURLToShare(room.roomId);
}

async function connect() {
  video = await VideoPlayer.locateVideo(document, window.location.hostname);
  video.pause();

  const roomName = extractRoomNameFromURL();
  room = await Room.join(roomName);
  
  view.showNotification("You joined your friend");

  bindVideoPlayerToRoom(video, room)
}

function onUrlChanged(newUrl) {
  // TODO in the future handle transitions across videos
  // on the same site without closign the existing connection
  console.log("Page changed - closing room if open")
  video = null;
  if (room) {
    room.close();
  }
}

window.onbeforeunload = function () {
  console.log("Page unloading - closing room if open")
  if (room) {
    room.close();
  }
};


function bindVideoPlayerToRoom(video, room) {
  // Video listeners
  video.onPlay(() => {
    room.sendPlayCommand(video.currentTime);
  });

  video.onPause(() => {
    room.sendPauseCommand(video.currentTime);
  });

  video.onSeeked(() => {
    room.sendSeekedCommand(video.currentTime);
  });

  // Room listeners
  room.onPlay((currentTime) => {
    logCommandReceived("Play", currentTime)
    video.currentTime = currentTime
    video.play();
  });

  room.onPause((currentTime) => {
    logCommandReceived("Pause", currentTime)
    video.pause();
    video.currentTime = currentTime
  });

  room.onSeeked((currentTime) => {
    logCommandReceived("Seeked", currentTime)
    video.currentTime = currentTime
  });

  room.onConnectionClosed(() => {
    video.pause();
  });

  if (room.isCreator) {
    room.onConnectionOpened(() => {
      video.pause();
      room.sendPauseCommand(video.currentTime);
    });
  }
}

function logCommandReceived(commandName, currentTime) {
  console.log(commandName +
    " received, local video time (seconds): " +
    video.currentTime +
    ", new time (seconds): " +
    currentTime
  );
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log("Received command " + request.command + " from extension");
  if (request.command == "START") {
    console.log("Reporting status STARTING to extension");
    sendResponse({ status: "STARTING" });
    startup();
  } else if (request.command == "CONNECT") {
    console.log("Reporting status CONNECTING to extension");
    sendResponse({ status: "CONNECTING" });
    connect();
  } else if (request.command == "URL_CHANGED") {
    onUrlChanged(request.newUrl)
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
  urlParams.set("roomName", roomName);

  const sharableURL =
    document.location.origin +
    document.location.pathname +
    "?" +
    urlParams.toString();

  console.log(sharableURL);
  view.showShareModal(sharableURL);
}
