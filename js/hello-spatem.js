/**
 * Copyright reelyActive 2022-2023
 * We believe in an open Internet of Things
 */


// Constants
const SIGNATURE_SEPARATOR = '/';
const TIME_OPTIONS = { hour: "2-digit", minute: "2-digit", hour12: false };
const DEFAULT_UPDATE_MILLISECONDS = 5000;
const DEMO_SEARCH_PARAMETER = 'demo';

// DOM elements
let connectIcon = document.querySelector('#connectIcon');
let demoalert = document.querySelector('#demoalert');
let message = document.querySelector('#message');
let latestspatem = document.querySelector('#latestspatem');
let time = document.querySelector('#time');

// Other variables
let updateMilliseconds = DEFAULT_UPDATE_MILLISECONDS;

// Initialise based on URL search parameters, if any
let searchParams = new URLSearchParams(location.search);
let isDemo = searchParams.has(DEMO_SEARCH_PARAMETER);

// Demo mode: connect to starling.js
if(isDemo) {
  let demoIcon = createElement('b', 'animate-breathing text-success', 'DEMO');
  connectIcon.replaceChildren(demoIcon);
  starling.on("spatem", handleSpatem);
}

// Normal mode: connect to socket.io
else {
  let baseUrl = window.location.protocol + '//' + window.location.hostname +
                ':' + window.location.port;
  let socket = io(baseUrl);
  socket.on("spatem", handleSpatem);

  // Display changes to the socket.io connection status
  socket.on("connect", function() {
    connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-success'));
  });
  socket.on("connect_error", function() {
    connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-danger'));
    demoalert.hidden = false;
  });
  socket.on("disconnect", function(reason) {
    connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-warning'));
  });
}


// Begin periodic updates of display
update();
setInterval(update, updateMilliseconds);


// Handle a spatem event
function handleSpatem(spatem) {
  let deviceSignature = spatem.deviceId + SIGNATURE_SEPARATOR +
                        spatem.deviceIdType;

  let pre = createElement('pre', null, JSON.stringify(spatem, null, 2));
  latestspatem.replaceChildren(pre);

  message.hidden = true;
}


// Compile statistics, update time and display
function update() {
  time.textContent = new Date().toLocaleTimeString([], TIME_OPTIONS);
}


// Create an element as specified
function createElement(elementName, classNames, content) {
  let element = document.createElement(elementName);

  if(classNames) {
    element.setAttribute('class', classNames);
  }

  if((content instanceof Element) || (content instanceof DocumentFragment)) {
    element.appendChild(content);
  }
  else if(Array.isArray(content)) {
    content.forEach(function(item) {
      if((item instanceof Element) || (item instanceof DocumentFragment)) {
        element.appendChild(item);
      }
      else {
        element.appendChild(document.createTextNode(item));
      }
    });
  }
  else if(content) {
    element.appendChild(document.createTextNode(content));
  }

  return element;
}
