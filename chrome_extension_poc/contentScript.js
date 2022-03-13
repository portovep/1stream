console.log("Waiting for START command from extension");
trackEvent("contentscript.init");

var view;
var video;
var room;

try {
  var view = View.initializeUI(document, window);
} catch (error) {
  trackError(error);
}

if (isShareableURL()) {
  console.log("Shareable URL detected, trying to connect to remote");

  const roomName = extractRoomNameFromURL();
  console.log(`Room name: ${roomName}`);

  connect(roomName);
}

async function startup() {
  try {
    trackEvent("startup.click");

    if (room && !room.closed) {
      if (room.connectionOpen) {
        view.showNotification("You're watching together, video is linked 👍");
      } else {
        view.showShareModal();
        printURLToShare(room.roomId);
      }
      return;
    }

    view.showShareModal();

    if (!video) {
      video = await VideoPlayer.locateVideo(document, window.location.hostname);
      video.pause();
    }

    trackEvent("room.creating");
    room = await Room.create();
    bindVideoPlayerToRoom(video, room);

    printURLToShare(room.roomId);
    trackEvent("room.created");
  } catch (error) {
    trackError(error);
  }
}

async function connect(roomName) {
  try {
    trackEvent("connect");
    video = await VideoPlayer.locateVideo(document, window.location.hostname);
    video.pause();

    trackEvent("room.joining", { roomId: roomName });
    console.log("Joining room: " + roomName);

    room = await Room.join(roomName);

    bindVideoPlayerToRoom(video, room);
    trackEvent("room.joined");
  } catch (error) {
    trackError(error);
  }
}

window.onbeforeunload = () => {
  try {
    console.log("Page unloading - closing room if open");
    if (room) {
      trackEvent("room.closing", { reason: "page_unload" });
      room.close();
    }
  } catch (error) {
    trackError(error);
  }
};

function onUrlChanged(newUrl) {
  // TODO in the future handle transitions across videos
  // on the same site without closign the existing connection
  console.log("Page changed - closing room if open");
  video = null;
  if (room) {
    trackEvent("room.closing", { reason: "url_change" });
    room.close();
  }
}

function bindVideoPlayerToRoom(video, room) {
  // Video listeners
  video.onPlay(() => {
    room.sendPlayCommand(video.currentTime);
    trackEvent("play.sent", { currentTime: video.currentTime });
  });

  video.onPause(() => {
    room.sendPauseCommand(video.currentTime);
    trackEvent("pause.sent", { currentTime: video.currentTime });
  });

  video.onSeeked(() => {
    room.sendSeekedCommand(video.currentTime);
    trackEvent("seeked.sent", { currentTime: video.currentTime });
  });

  // Room listeners
  room.onPlay((currentTime) => {
    logCommandReceived("Play", currentTime);
    trackEvent("play.received", {
      oldTime: video.currentTime,
      newTime: currentTime,
    });

    video.currentTime = currentTime;
    video.play();
  });

  room.onPause((currentTime) => {
    logCommandReceived("Pause", currentTime);
    trackEvent("pause.received", {
      oldTime: video.currentTime,
      newTime: currentTime,
    });

    video.pause();
    video.currentTime = currentTime;
  });

  room.onSeeked((currentTime) => {
    logCommandReceived("Seeked", currentTime);
    trackEvent("seeked.received", {
      oldTime: video.currentTime,
      newTime: currentTime,
    });

    video.currentTime = currentTime;
  });

  room.onConnectionClosed(() => {
    video.pause();
    view.showNotification("Connection finished");
    trackEvent("connection.closed");
  });

  room.onConnectionOpened(() => {
    if (room.isCreator) {
      video.pause();
      room.sendPauseCommand(video.currentTime);
      view.hideShowShareModel();
      view.showNotification("Your friend has joined, ready to start 👍");
    } else {
      view.showNotification("You've joined, video is linked 👍");
    }
    trackEvent("connection.opened");
  });

  room.onPeerError((err) => {
    trackEvent("error.peer", { name: err.name, message: err.message });
    trackError({ stack: err.message });
    view.showNotification("We couldn't connect, something went wrong 🙄");
  });

  room.onPeerDisconnected(() => {
    trackEvent("peer.disconnected");
  });
}

function logCommandReceived(commandName, currentTime) {
  console.log(
    commandName +
      " received, local video time (seconds): " +
      video.currentTime +
      ", new time (seconds): " +
      currentTime
  );
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  try {
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
      onUrlChanged(request.newUrl);
    }
  } catch (error) {
    trackError(error);
  }
});

function trackEvent(event, eventParams) {
  const globalParams = {
    url: window.location.href,
    roomId: room && !room.closed ? room.roomId : null,
    roomConnected: room ? room.connectionOpen : null,
    hasVideo: video ? true : false,
    isCreator: room ? room.isCreator : null,
  };
  const params = eventParams
    ? Object.assign(eventParams, globalParams)
    : globalParams;
  chrome.runtime.sendMessage({ event, params });
}

function trackError(error) {
  chrome.runtime.sendMessage({
    error: error.stack,
  });
  throw error;
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
  view.showSharableURL(sharableURL);
}

function isShareableURL() {
  const urlParams = new URL(document.location).searchParams;
  return urlParams.has("roomName");
}
