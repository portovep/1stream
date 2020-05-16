var video = null;
var self = this;

function setVideo(video) {
  self.video = video;
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

    if (isSendChannelReady()) {
      sendPlayCommand(video);
    } else {
      console.log("Cannot send play command, send channel is not ready yet");
    }
  });

  video.addEventListener("pause", (event) => {
    if (isRemotePause) {
      console.log("Video pause from remote command");
      isRemotePause = false;
      return;
    }

    if (isSendChannelReady()) {
      sendPauseCommand();
    } else {
      console.log("Cannot send pause command, send channel is not ready yet");
    }
  });
}

function sendPlayCommand(video) {
  const currentTime = parseFloat(self.video.currentTime);
  console.log("Sending PLAY command, currentTime: " + currentTime);
  sendChannel.send(
    JSON.stringify({
      type: "PLAY",
      currentTime: currentTime,
    })
  );
}

function sendPauseCommand() {
  const currentTime = parseFloat(self.video.currentTime);
  console.log("Sending PAUSE command, currentTime: " + currentTime);
  sendChannel.send(
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
function handleReceiveMessage(event) {
  var command = JSON.parse(event.data);

  if (command.type === "PLAY") {
    syncPlay(video, command.currentTime);
  } else if (command.type == "PAUSE") {
    syncPause(video, command.currentTime);
  } else if (command.type == "TEXT") {
    console.log(command.message);
  }
}

//// NETWORKING //
var socket = null;
var pc = null; // RTCPeerConnection for our "local" connection
var sendChannel = null; // RTCDataChannel for the local (sender)

var servers = {
  iceServers: [
    { urls: "stun:stun.services.mozilla.com" },
    { urls: "stun:stun.l.google.com:19302" },
  ],
};

var isInitiator = false;
var isChannelReady = false;
var isStarted = false;
var room = null;

function connectToSignalingServer(roomName) {
  room = roomName;
  // Signaling server interaction
  console.log("Initializing connection to signaling server");
  // var socket = io.connect("http://localhost:8085");
  socket = io.connect("https://bingeparty.pabloporto.me");

  socket.on("created", function(room) {
    console.log("Created room " + room);
    isInitiator = true;
  });

  socket.on("full", function(room) {
    console.log("Room " + room + " is full");
  });

  socket.on("join", function(room) {
    console.log("Another peer made a request to join room " + room);
    console.log("This peer is the initiator of room " + room + "!");
    isChannelReady = true;
    connectPeers();
  });

  socket.on("joined", function(room) {
    console.log("joined: " + room);
    isChannelReady = true;
  });

  socket.on("log", function(array) {
    console.log.apply(console, array);
  });

  // This client receives a message
  socket.on("message", function(message) {
    console.log("Client received message:", message);
    if (message === "got user media") {
      maybeStart();
    } else if (message.type === "offer") {
      if (!isInitiator && !isStarted) {
        maybeStart();
      }
      pc.setRemoteDescription(new RTCSessionDescription(message));
      doAnswer();
    } else if (message.type === "answer" && isStarted) {
      pc.setRemoteDescription(new RTCSessionDescription(message));
    } else if (message.type === "candidate" && isStarted) {
      var candidate = new RTCIceCandidate({
        sdpMLineIndex: message.label,
        candidate: message.candidate,
      });
      pc.addIceCandidate(candidate);
    } else if (message === "bye" && isStarted) {
      handleRemoteHangup();
    }
  });

  connectToRoom(room);
}

function sendMessageWebSockets(message) {
  console.log("Client sending message to WS: ", message);
  socket.emit("message", message);
}

// disconnect
window.onbeforeunload = function() {
  if (isStarted) {
    disconnectFromRoom();
  }
};

function maybeStart() {
  console.log(">>>>>>> maybeStart() ", isStarted, isChannelReady);
  if (!isStarted && isChannelReady) {
    console.log(">>>>>> creating peer connection");
    createPeerConnection();
    isStarted = true;
    console.log("isInitiator", isInitiator);
  }
}

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(servers);
    pc.onicecandidate = handleIceCandidate;

    if (isInitiator) {
      console.log("Creating Data Channel");
      sendChannel = pc.createDataChannel(room);
      onDataChannelCreated(sendChannel);

      console.log("Creating an offer");
      pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
    } else {
      pc.ondatachannel = function(event) {
        console.log("ondatachannel:", event.channel);
        sendChannel = event.channel;
        onDataChannelCreated(sendChannel);
      };
    }
    console.log("Created RTCPeerConnnection");
  } catch (e) {
    console.log("Failed to create PeerConnection, exception: " + e.message);
    alert("Cannot create RTCPeerConnection object.");
    return;
  }
}

function handleIceCandidate(event) {
  console.log("icecandidate event: ", event);
  if (event.candidate) {
    sendMessageWebSockets({
      type: "candidate",
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate,
    });
  } else {
    console.log("End of candidates.");
  }
}

function handleCreateOfferError(event) {
  console.log("createOffer() error: ", event);
}

function doAnswer() {
  console.log("Sending answer to peer.");
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription, function() {
    console.log("setLocalAndSendMessage sending message", sessionDescription);
    sendMessageWebSockets(sessionDescription);
  });
}

function onCreateSessionDescriptionError(error) {
  trace("Failed to create session description: " + error.toString());
}

function connectToRoom(roomName) {
  if (roomName && roomName !== "") {
    socket.emit("create or join", roomName);
    console.log("Attempted to create or join room", roomName);
  }
}
// Initialize signalling exchange using WS
function connectPeers() {
  sendMessageWebSockets("trying to connect");
  if (isInitiator) {
    maybeStart();
  }
}

function onCreateSessionDescriptionError(error) {
  trace("Failed to create session description: " + error.toString());
}

// Called when the connection opens and the data
// channel is ready to be connected to the remote.
function onDataChannelCreated(channel) {
  console.log("onDataChannelCreated:", channel);

  channel.onmessage = handleReceiveMessage;
  channel.onopen = handleReceiveChannelStatusChange;
  channel.onclose = handleReceiveChannelStatusChange;
}

// Handle status changes on the receiver's channel.
function handleReceiveChannelStatusChange(event) {
  console.log("received channel status change");
  console.log(event);

  // Here you would do stuff that needs to be done
  // when the channel's status changes.
  if (isSendChannelReady()) {
    console.log(
      "Receive channel's status has changed to " + sendChannel.readyState
    );
    if (isInitiator) {
      console.log("Performing initial video sync");
      sendPauseCommand();
    }
  }
}

function isSendChannelReady() {
  return sendChannel && sendChannel.readyState === "open";
}

function disconnectFromRoom() {
  console.log("disconnecting from room" + room);
  sendMessageWebSockets("disconnect");
}

function hangup() {
  console.log("Hanging up.");
  sendMessage("bye");
  stop();
}

function handleRemoteHangup() {
  console.log("Session terminated.");
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;

  sendChannel.close();
  sendChannel = null;
  pc.close();
  pc = null;
}

function trace(text) {
  if (text[text.length - 1] === "\n") {
    text = text.substring(0, text.length - 1);
  }
  if (window.performance) {
    var now = (window.performance.now() / 1000).toFixed(3);
    console.log(now + ": " + text);
  } else {
    console.log(text);
  }
}
