class Room {
  constructor(roomId, peer, connection) {
    this.roomId = roomId;
    this.connection = connection;
    this.peer = peer;
    // Whether the room has been initiated by calling Room.create() or by joining an existing roomId
    this.isCreator = connection == null;

    this.peer.on("error", (err) => {
      if (this.onpeererror) this.onpeererror(err)
      console.log("Fatal peer error " + err + "\nPeer will be destroyed.");
      // This error is usually fatal so ensure we destroy the peer to mark the room as closed. 
      this.peer.destroy();
    });

    this.peer.on('disconnected', () => {
      if (this.onpeerdisconnected) this.onpeerdisconnected()
      console.log("Peer disconnected");
    });

    if (this.connection) {
      this._bindConnectionListeners();
      return;
    }

    peer.on("connection", (conn) => {
      if (this.connection && this.connection.open) {
        // So far we only support 1 to 1 connections, if a second peer tries to connect we reject it for now to avoid issues. 
        console.log("New connection received but there's already one opened. Rejecting new one.");
        conn.close();
      } else {
        console.log("New connection received");
        this.connection = conn;
        this._bindConnectionListeners();
      }
    });
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

  /**
   * If the room is closed, it cannot be used again and a new room needs to be created. 
   * This can happen after calling room.close() or because there was a fatal issue in the underlying peer.  
   */
  get closed() {
    return this.peer.destroyed;
  }

  get connectionOpen() {
    return this.connection != null && this.connection.open
  }

  sendPlayCommand(videoTime) {
    if (!this.connectionOpen) {
      console.log("Cannot send play command, there isn't an open connection");
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
    if (!this.connectionOpen) {
      console.log("Cannot send pause command, there isn't an open connection");
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
    if (!this.connectionOpen) {
      console.log("Cannot send seeked command, there isn't an open connection");
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

  onConnectionClosed(callback) {
    this.onconnectionclosed = callback;
  }

  onPeerError(callback) {
    this.onpeererror = callback;
  }

  onPeerDisconnected(callback) {
    this.onpeerdisconnected = callback;
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
      this.connection = null;
      // If the connection is closed and we're not the creator, cleanup the current room.
      if (!this.isCreator) {
        console.log("Closing room - it's no longer useful after disconnecting from the creator that sent us the link");
        this.close();
      }
      if (this.onconnectionclosed) {
        this.onconnectionclosed();
      }
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