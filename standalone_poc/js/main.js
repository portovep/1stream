(function() {
  //// BINDINGS AND VIDEO SYNC ////

  var connectButton = null;
  var disconnectButton = null;
  var sendButton = null;
  var messageInputBox = null;
  var receiveBox = null;

  var video = null;

  function startup() {
    console.log("Page done loading, starting app");

    connectButton = document.getElementById("connectButton");
    video = document.getElementById("video");
    disconnectButton = document.getElementById("disconnectButton");
    sendButton = document.getElementById("sendButton");
    messageInputBox = document.getElementById("message");
    receiveBox = document.getElementById("receivebox");

    // Set event listeners for user interface widgets
    connectButton.addEventListener("click", connectPeers, false);
    disconnectButton.addEventListener("click", hangup, false);
    sendButton.addEventListener("click", sendMessage, false);

    video.addEventListener("play", (event) => {
      const currentTime = parseFloat(video.currentTime.toFixed(2));
      console.log("Video played" + currentTime);
      if (isInitiator) {
        sendChannel.send(
          JSON.stringify({
            type: "PLAY",
            currentTime: currentTime,
          })
        );
      }
    });

    video.addEventListener("pause", (event) => {
      const currentTime = video.currentTime
      console.log("Video paused" + currentTime);
      if (isInitiator) {
        sendChannel.send(
          JSON.stringify({
            type: "PAUSE",
            currentTime: currentTime,
          })
        );
      }
    });
  }

  // Handles msgs received via the RTCDataChannel
  function handleReceiveMessage(event) {
    var command = JSON.parse(event.data);

    if (command.type === "PLAY") {
      console.log("Play command received, local video time: " + video.currentTime + ", new time: " + command.currentTime);
      video.currentTime = command.currentTime;
      video.play();
      logMediaCommandInUI(command);
    } else if (command.type == "PAUSE") {
      console.log("Pause command received, local video time: " + video.currentTime + ", new time: " + command.currentTime);
      video.pause();
      video.currentTime = command.currentTime;
      logMediaCommandInUI(command);
    } else if (command.type == "TEXT") {
      logMessageInUI(command.message);
    }
  }

  function logMediaCommandInUI(command) {
    var text = command.type + " time: " + command.currentTime;
    logMessageInUI(text);
  }

  function logMessageInUI(text) {
    var el = document.createElement("p");
    var txtNode = document.createTextNode(text);
    el.appendChild(txtNode);
    receiveBox.appendChild(el);
  }

  // Handles clicks on the "Send" button by transmitting
  // a message to the remote peer.
  function sendMessage() {
    var message = messageInputBox.value;
    sendChannel.send(
      JSON.stringify({
        type: "TEXT",
        message: message,
      })
    );

    // Clear the input box and re-focus it, so that we're
    // ready for the next message.
    messageInputBox.value = "";
    messageInputBox.focus();
  }

  //// NETWORKING ////
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
  var room = "foo";

  // Signaling server interaction
  var socket = io.connect("http://localhost:8080");
  // var socket = io.connect("http://88.17.189.161:8080");

  if (room !== "") {
    socket.emit("create or join", room);
    console.log("Attempted to create or  join room", room);
  }

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
  });

  socket.on("joined", function(room) {
    console.log("joined: " + room);
    isChannelReady = true;
  });

  socket.on("log", function(array) {
    console.log.apply(console, array);
  });

  function sendMessageWebSockets(message) {
    console.log("Client sending message to WS: ", message);
    socket.emit("message", message);
  }

  // disconnect
  window.onbeforeunload = function() {
    sendMessageWebSockets("bye");
  };

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
      pc = new RTCPeerConnection();
      pc.onicecandidate = handleIceCandidate;

      if (isInitiator) {
        console.log("Creating Data Channel");
        sendChannel = pc.createDataChannel("data-channel-id");
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
    if (sendChannel && sendChannel.readyState === "open") {
      console.log(
        "Receive channel's status has changed to " + sendChannel.readyState
      );
      messageInputBox.disabled = false;
      messageInputBox.focus();
      sendButton.disabled = false;
      disconnectButton.disabled = false;
      connectButton.disabled = true;
    } else {
      messageInputBox.disabled = true;
      sendButton.disabled = true;
      connectButton.disabled = false;
      disconnectButton.disabled = true;
    }
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

    connectButton.disabled = false;
    disconnectButton.disabled = true;
    sendButton.disabled = true;

    messageInputBox.value = "";
    messageInputBox.disabled = true;
  }

  // Set up an event listener which will run the startup
  // function once the page is done loading.
  window.addEventListener("load", startup, false);
})();

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
