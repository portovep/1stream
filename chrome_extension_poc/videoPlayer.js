/**
 * Wrapper of HTML5 video element that makes it easier to handle the video element and controll its listeners
 */
class VideoPlayer {
  /**
   * @param {*} video The HTML5 video element
   * @param {*} hostname e.g. netflix.com
   */
  constructor(video, hostname) {
    this.video = video;
    this.hostname = hostname;

    this.video.addEventListener("play", (event) => {
      if (this.isAutoPlay) {
        console.log("VideoPlayer - played programmatically");
        this.isAutoPlay = false;
        return;
      }
      if (this.onplay) this.onplay();
    });

    this.video.addEventListener("pause", (event) => {
      if (this.isAutoPause) {
        console.log("VideoPlayer - paused programmatically");
        this.isAutoPause = false;
        return;
      }

      if (this.onpause) this.onpause();
    });

    this.video.addEventListener("seeked", (event) => {
      if (this.isAutoSeeked) {
        console.log("VideoPlayer - seeked programmatically");
        this.isAutoSeeked = false;
        return;
      }

      if (this.onseeked) this.onseeked();
    });
  }

  get currentTime() {
    return this.video.currentTime;
  }

  set currentTime(newCurrentTime) {
    const timeDiff = Math.abs(this.video.currentTime - newCurrentTime);
    if (timeDiff < 0.5) {
      console.log("VideoPlayer - skipping setCurrentTime, diff: " + timeDiff);
      return;
    }

    this.isAutoSeeked = true;
    if (this.hostname.includes("netflix")) {
      const newCurrentTimeInMs = Math.floor(newCurrentTime * 1000);
      window.postMessage(
        { type: "SET_CURRENT_TIME", currentTime: newCurrentTimeInMs },
        "*"
      );
    } else {
      this.video.currentTime = newCurrentTime;
    }
  }

  play() {
    this.isAutoPlay = true;
    this.video.play();
  }

  pause() {
    if (this.video.paused) return;

    this.isAutoPause = true;
    this.video.pause();
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

  /**
   * Promise that trieds to locate a video element in the current document and returns a VideoPlayer when one is found.
   * Additionally it injects a netflix video handler in the current document if the hostname is Netflix.
   */
  static locateVideo(document, hostname) {
    const isNetflix = hostname.includes("netflix");
    const isHBOMax = hostname.includes("hbomax");
    const isYoutube = hostname.includes("youtube");

    const findVideoElement = () => {
      if (isNetflix || isHBOMax) {
        return document.getElementsByTagName("video")[0];
      } else if (isYoutube) {
        for (let video of document.getElementsByTagName("video")) {
          if (video.duration > 0) {
            return video;
          }
        }
      } else {
        throw "Cannot find a video element for this page";
      }
    };

    const injectNetflixHandler = () => {
      console.log("Injecting Netflix video handler");
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
      s.onload = function () {
        s.remove();
      };
    };

    return new Promise((resolve, reject) => {
      var checkExist = setInterval(function () {
        console.log("Looking for video");
        var video = findVideoElement();
        if (video && video.currentTime) {
          console.log("Got video: ", video);
          clearInterval(checkExist);
          if (isNetflix) {
            injectNetflixHandler();
          }
          resolve(new VideoPlayer(video, hostname));
        }
      }, 1000);
    });
  }
}
