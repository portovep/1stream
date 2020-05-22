console.log("Waiting for START command from extension");

var video;

async function startup() {
  var peer = new Peer();
  var peerId = await openPeer(peer)

  peer.on('connection', function(conn) { 
    console.log('Connection received in peer : ' + peerId);
    bindConnection(conn)
  });

  video = await getVideoElement();
  video.pause();

  console.log("configuring listeners");
  bindEventListeners(video);

  printURLToShare(peerId);

  reportStatusToContentScript("STARTED");
}

async function connect() {
  const roomName = extractRoomNameFromURL();
  console.log("Connecting to room name: " + roomName);

  var peer = new Peer();
  var peerId = await openPeer(peer)
  console.log("My peer id is " + peerId)

  bindConnection(peer.connect(roomName));

  video = await getVideoElement();
  video.pause();

  console.log("configuring listeners");
  bindEventListeners(video);
}

function openPeer(peer) {
  return new Promise(function(resolve, reject) {
    peer.on('open', resolve)
  });
}

function logPeerErrors(peer) {
  peer.on('error', function(err) {
    console.log("Fatal peer error " + err)
  });
}

var connection;
function bindConnection(conn) {
  connection = conn

  conn.on('open', function() {
    console.log('Connection is now opened');
  
  });

  conn.on('close', function() {
    console.log('Connection is now closed');
  
  });

  conn.on('error ', function(err) {
    console.log('Connection error ' + err);
  
  });

  // Receive messages
  conn.on('data', function(data) {
    handleReceiveMessage(data)
  });
}

//// BINDINGS AND VIDEO SYNC ////
var isRemotePlay = false;
var isRemotePause = false;

function bindEventListeners(video) {
  video.addEventListener("play", (event) => {
    if (isRemotePlay) {
      console.log("Video played from remote command");
      isRemotePlay = false;
      return;
    }

    if (connection) {
      sendPlayCommand(connection, video);
    } else {
      console.log("Cannot send play command, connection is not ready yet");
    }
  });

  video.addEventListener("pause", (event) => {
    if (isRemotePause) {
      console.log("Video pause from remote command");
      isRemotePause = false;
      return;
    }

    if (connection) {
      sendPauseCommand(connection, video);
    } else {
      console.log("Cannot send pause command, connection is not ready yet");
    }
  });
}

function sendPlayCommand(connection, video) {
  const currentTime = parseFloat(video.currentTime);
  console.log("Sending PLAY command, currentTime: " + currentTime);
  connection.send(
    JSON.stringify({
      type: "PLAY",
      currentTime: currentTime,
    })
  );
}

function sendPauseCommand(connection, video) {
  const currentTime = parseFloat(video.currentTime);
  console.log("Sending PAUSE command, currentTime: " + currentTime);
  connection.send(
    JSON.stringify({
      type: "PAUSE",
      currentTime: currentTime,
    })
  );
}

function syncPlay(video, currentTime) {
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

function syncPause(video, currentTime) {
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

// Handles msgs received via the RTCDataChannel
function handleReceiveMessage(data) {
  var command = JSON.parse(data);

  if (command.type === "PLAY") {
    syncPlay(video, command.currentTime);
  } else if (command.type == "PAUSE") {
    syncPause(video, command.currentTime);
  } else if (command.type == "TEXT") {
    console.log(command.message);
  }
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

function getVideoElement() {
  var url = window.location.href;

  if (url.includes("netflix") || url.includes("youtube")) {
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
