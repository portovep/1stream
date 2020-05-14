console.log("Waiting for START command from extension");

function startup() {
  var roomName = generateRoomName();
  connectToSignalingServer(roomName);

  var video = document.getElementsByTagName("video")[0];
  console.log("got video element", video);

  video.pause();

  console.log("configuring listeners");
  bindEventListeners(video);

  printURLToShare(roomName);

  reportStatusToContentScript("STARTED");
}

function connect() {
  const roomName = extractRoomNameFromURL();
  console.log("Connecting to room name: " + roomName);

  var video = document.getElementsByTagName("video")[0];
  setVideo(video);

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
  console.log(window.location + "&roomName=" + roomName);
}

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
