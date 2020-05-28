class Room {
  constructor(roomId, peer, connection) {
    this.roomId = roomId;
    this.connection = connection;
    this.peer = peer;

    this.peer.on("error", (err) => {
      console.log("Fatal peer error " + err);
    });

    if (this.connection) {
      this._bindConnectionListeners();
    } else {
      peer.on("connection", (conn) => {
        console.log("Connection received");
        this.connection = conn;
        this._bindConnectionListeners();
      });
    }
  }

  /**
   * Instantiates a Room by creating a new one. Use room.roomId to access room Id
   */
  static create() {
    return new Promise(function (resolve, reject) {
      const peer = new Peer(Room.serverOptions);
      peer.on("open", (peerId) => {
        // New room so the new peer ID becomes the roomID
        resolve(new Room(peerId, peer));
      });
    });
  }

  /**
   * Instantiates a Room by joining one given an existing roomId
   */
  static join(roomId) {
    return new Promise(function (resolve, reject) {
      const peer = new Peer(Room.serverOptions);
      peer.on("open", (peerId) => {
        const conn = peer.connect(roomId);
        resolve(new Room(roomId, peer, conn));
      });
    });
  }

  sendPlayCommand(videoTime) {
    if (!this.connection) {
      console.log("Cannot send play command, there isn't a connection");
      return;
    }

    const currentTime = parseFloat(videoTime);
    console.log("Sending PLAY command, currentTime: " + currentTime);
    this.connection.send(
      JSON.stringify({
        type: "PLAY",
        currentTime: currentTime,
      })
    );
  }

  sendPauseCommand(videoTime) {
    if (!this.connection) {
      console.log("Cannot send pause command, there isn't a connection");
      return;
    }

    const currentTime = parseFloat(videoTime);
    console.log("Sending PAUSE command, currentTime: " + currentTime);
    this.connection.send(
      JSON.stringify({
        type: "PAUSE",
        currentTime: currentTime,
      })
    );
  }

  sendSeekedCommand(videoTime) {
    if (!this.connection) {
      console.log("Cannot send seeked command, there isn't a connection");
      return;
    }

    const currentTime = parseFloat(videoTime);
    console.log("Sending SEEKED command, currentTime: " + currentTime);
    this.connection.send(
      JSON.stringify({
        type: "SEEKED",
        currentTime: currentTime,
      })
    );
  }

  onPlay(callback) {
    this.onplay = callback;
  }

  onPause(callback) {
    this.onpause = callback;
  }

  onSeeked(callback) {
    this.onseeked = callback;
  }

  onConnectionOpened(callback) {
    this.onconnectionopened = callback;
  }

  close() {
    if (this.connection) {
      this.connection.close();
    }
    this.peer.destroy();
  }

  _bindConnectionListeners() {
    const conn = this.connection;
    conn.on("open", () => {
      console.log("Connection is now opened");
      if (this.onconnectionopened) {
        this.onconnectionopened();
      }
    });

    conn.on("close", () => {
      console.log("Connection is now closed");
    });

    conn.on("error ", (err) => {
      console.log("Connection error " + err);
    });

    // Receive messages
    conn.on("data", (data) => {
      var command = JSON.parse(data);
     // console.log("Command received " + data);

      switch (command.type) {
        case "PLAY":
          if (this.onplay) {
            this.onplay(command.currentTime);
          }
          break;
        case "PAUSE":
          if (this.onpause) {
            this.onpause(command.currentTime);
          }
          break;
        case "SEEKED":
          if (this.onseeked) {
            this.onseeked(command.currentTime);
          }
          break;
        default:
          throw "Unknow command type " + command.type;
      }
    });
  }
}

Room.serverOptions = {
  host: "bingeparty.pabloporto.me",
  port: 443,
  path: "/myapp",
};