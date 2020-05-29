class View {
  constructor(document, window, shadowContainer) {
    this.document = document;
    this.window = window;
    this.shadowContainer = shadowContainer;

    const extensionContainer = this.document.createElement("div");
    extensionContainer.setAttribute("id", "shadow-extension-container");
    extensionContainer.innerHTML = "some content or html to render";
    shadowContainer.appendChild(extensionContainer);

    this.container = extensionContainer;

    this._applyStyles();
  }

  static initializeUI(document, window) {
    var shadowHost = document.createElement("div");
    shadowHost.setAttribute("id", "extension-container");
    document.body.appendChild(shadowHost);

    const shadowRoot = shadowHost.attachShadow({ mode: "open" });
    return new View(document, window, shadowRoot);
  }

  hideShowShareModel() {
    var elems = this.shadowContainer.querySelectorAll(".modal");
    var instances = M.Modal.init(elems);
    instances[0].close();
  }

  showShareModal(sharableURL) {
    this.container.innerHTML = `
      <!-- Modal Structure -->
      <div id="modal-share" class="modal">
        <div class="modal-content">
          <div class="share-title">
            <h3>Add others</h3>
          </div>
          <div class="divider"></div>
          <div class="share-text">Share this info with people you want to watch remotely</div>
          <div class="share-url">${sharableURL}</div>
          <div class="share-button">
            <a id="share-button" class="waves-effect waves-teal btn-flat btn-large"><i class="material-icons">content_copy</i>
              Copy joining info
            </a>
          </div>
        </div>
      </div>  
    `;

    this.shadowContainer
      .getElementById("share-button")
      .addEventListener("click", this._copyShareableURL.bind(this));

    var elems = this.shadowContainer.querySelectorAll(".modal");
    var instances = M.Modal.init(elems);
    instances[0].open();
  }

  showNotification(message) {
    const toastContent = `
        <i class="medium material-icons">face</i>
        <span class="notification-msg">${message}<span>`;

    M.toast({
      html: toastContent,
      classes: "rounded",
    });
  }

  _applyStyles() {
    // Apply external styles to the shadow dom
    const materializeStyleURL = chrome.runtime.getURL(
      "lib/css/materialize.min.css"
    );
    const mainStyleURL = chrome.runtime.getURL("lib/css/main-shadow.css");

    [materializeStyleURL, mainStyleURL].forEach((styleURL) => {
      const linkElem = this.document.createElement("link");
      linkElem.setAttribute("rel", "stylesheet");
      linkElem.setAttribute("href", styleURL);
      this.shadowContainer.appendChild(linkElem);
    });
  }

  _copyShareableURL() {
    console.log("Copying share URL to clipboard");
    var shareUrlElement = this.container.querySelector(".share-url");
    var range = this.document.createRange();
    range.selectNode(shareUrlElement);
    window.getSelection().addRange(range);

    try {
      var successful = this.document.execCommand("copy");
      var msg = successful ? "successful" : "unsuccessful";
      console.log("Copy shareable URL command was " + msg);
    } catch (err) {
      console.log("Oops, unable to copy");
    }
    this.window.getSelection().removeAllRanges();
  }
}
