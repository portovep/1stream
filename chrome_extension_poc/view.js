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

    this._spinnerContent = `
      <div class="center-align  spinner-container">
        <div class="preloader-wrapper big active">
        <div class="spinner-layer spinner-blue-only">
          <div class="circle-clipper left">
            <div class="circle"></div>
          </div><div class="gap-patch">
            <div class="circle"></div>
          </div><div class="circle-clipper right">
            <div class="circle"></div>
          </div>
        </div>
      </div>
    `;
  }

  static initializeUI(document, window) {
    var shadowHost = document.createElement("div");
    shadowHost.setAttribute("id", "extension-container");
    document.body.appendChild(shadowHost);

    const shadowRoot = shadowHost.attachShadow({ mode: "open" });
    return new View(document, window, shadowRoot);
  }

  showNotification(message) {
    const logoURL = chrome.runtime.getURL("images/logo_square.png");
    const toastContent = `
        <img class="notification-img" src="${logoURL}"/>
        <span class="notification-msg">${message}<span>`;

    M.toast({
      html: toastContent,
    });
  }

  showShareModal() {
    const backgroundURL = chrome.runtime.getURL("images/modal_background.jpg");
    this.container.innerHTML = `
      <!-- Modal Structure -->
      <div id="modal-share" class="modal">
        <div class="row modal-row">
          <div class="col s5 modal-image-col">
            <img src="${backgroundURL}"/>
          </div>
          <div class="col s7 modal-instructions-col">
              <div class="right-align">
                <a id="modal-close" class="btn-flat btn-large">
                  <i class=" material-icons right">close</i>
                </a>
              </div>
              <div class="modal-title">
                <h2>1Stream</h2>
              </div>
              <div class="modal-contents">
                ${this._spinnerContent}
              </div>
            </div> 
          </div>
        </div>
      </div>  
    `;

    this.shadowContainer
      .getElementById("modal-close")
      .addEventListener("click", this.hideShowShareModel.bind(this));

    var elems = this.shadowContainer.querySelectorAll(".modal");
    var instances = M.Modal.init(elems);
    instances[0].open();
  }

  hideShowShareModel() {
    var elems = this.shadowContainer.querySelectorAll(".modal");
    var instances = M.Modal.init(elems);
    instances[0].close();
  }

  showSharableURL(sharableURL) {
    const modalContent = this.shadowContainer.querySelectorAll(
      ".modal-contents"
    )[0];

    modalContent.innerHTML = `
      <div class="share-message-container">
        <div class="share-text">
          <p class="share-text--main">Your room is ready!</p>
          <p>1. Copy and share the link with a friend</p>
          <p>2. Your friend should open the link in Chrome</p>
          <p>3. You both are ready to watch in sync</p>
        </div>
      </div>
      <div class="share-button">
      <div class="row">
        <div class="input-field col s6 share-url-input-field">
          <input value="${sharableURL}" id="share-url" type="text" class="validate">
        </div>
        <a id="share-button" class="waves-effect waves-teal btn btn-large"><i class="material-icons">content_copy</i>
          Copy
        </a>
      </div>     
      </div>
    `;

    this.shadowContainer
      .getElementById("share-button")
      .addEventListener("click", this._copyShareableURL.bind(this));
  }

  _onURLCopied() {
    this.showNotification("URL copied to the clipboard 👍");
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
    var shareUrlElement = this.container.querySelector("#share-url");
    var range = this.document.createRange();
    range.selectNode(shareUrlElement);
    window.getSelection().addRange(range);

    try {
      var successful = this.document.execCommand("copy");
      var msg = successful ? "successful" : "unsuccessful";
      console.log("Copy shareable URL command was " + msg);

      this._onURLCopied();
    } catch (err) {
      console.error("Oops, unable to copy");
      throw err;
    }
    this.window.getSelection().removeAllRanges();
  }
}
