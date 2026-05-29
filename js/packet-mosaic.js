/**
 * Copyright reelyActive 2026
 * We believe in an open Internet of Things
 */


// Constants
const DEMO_SEARCH_PARAMETER = 'demo';

// DOM elements
let connectIcon = document.querySelector('#connectIcon');
let demoalert = document.querySelector('#demoalert');
let fadeRange = document.querySelector('#fadeRange');
let mosaic = document.querySelector('#mosaic');

// Initialise based on URL search parameters, if any
let searchParams = new URLSearchParams(location.search);
let isDemo = searchParams.has(DEMO_SEARCH_PARAMETER);
let baseUrl = window.location.protocol + '//' + window.location.hostname + ':' +
              window.location.port;
let fade = 10;

// Handle beaver events
beaver.on('connect', handleConnect);
beaver.on('raddec', handleRaddec);
beaver.on('error', handleError);
beaver.on('disconnect', handleDisconnect);

// Update settings
fadeRange.onchange = updateSettings;
updateSettings();

// Demo mode: connect to starling.js
if(isDemo) {
  let demoIcon = createElement('b', 'animate-breathing text-success', 'DEMO');
  connectIcon.replaceChildren(demoIcon);
  beaver.stream(null, { io: starling, ioUrl: "http://pareto.local" });
}

// Normal mode: connect to socket.io
else {
  beaver.stream(baseUrl, { io: io });
}

// Handle stream connection
function handleConnect() {
  demoalert.hidden = true;
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-success'));
}

// Handle a radio decoding
function handleRaddec(raddec) {
  if(Array.isArray(raddec.packets)) {
    raddec.packets.forEach((packet) => {
      displayPacket(packet);
      handleVerticalOverflow();
    });
  }
}

// Handle stream disconnection
function handleDisconnect() {
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-warning'));
}

// Handle error
function handleError(error) {
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-danger'));
  demoalert.hidden = false;
}

// Remove a mosaic row if there's vertical scrolling
function handleVerticalOverflow() {
  if(document.documentElement.scrollHeight >
     document.documentElement.clientHeight) {
    mosaic.removeChild(mosaic.lastElementChild);
  }
}

// Display a packet as a row in the mosaic
function displayPacket(packet) {
  let tds = [];
  for(let charIndex = 0; (charIndex < packet.length); charIndex++) {
    let char = packet.charAt(charIndex);
    let nibble = parseInt(char, 16);
    let opacity = (nibble <= 7) ? ((8 - nibble) / fade) : ((nibble - 7) / fade);
    let bg = (nibble <= 7) ? 'bg-primary' : 'bg-secondary';
    let td = createElement('td', bg, char);
    td.setAttribute('style', 'opacity:' + opacity);
    tds.push(td);
  }

  let tr = createElement('tr', null, tds);
  mosaic.prepend(tr);
}

// Update settings
function updateSettings() {
  fade = fadeRange.value;
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
    content.forEach((item) => {
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
