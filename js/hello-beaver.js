/**
 * Copyright reelyActive 2021-2023
 * We believe in an open Internet of Things
 */


// Constants
const DEMO_SEARCH_PARAMETER = 'demo';

// DOM elements
let connectIcon = document.querySelector('#connectIcon');
let demoalert = document.querySelector('#demoalert');
let statsDisplay = document.querySelector('#statsDisplay');
let deviceCount =  document.querySelector('#deviceCount');
let raddecRate = document.querySelector('#raddecRate');
let dynambRate = document.querySelector('#dynambRate');
let spatemRate = document.querySelector('#spatemRate');

// Initialise based on URL search parameters, if any
let searchParams = new URLSearchParams(location.search);
let isDemo = searchParams.has(DEMO_SEARCH_PARAMETER);
let baseUrl = window.location.protocol + '//' + window.location.hostname + ':' +
              window.location.port;

// Handle beaver events
beaver.on('connect', handleConnect);
beaver.on('stats', handleStats);
beaver.on('error', handleError);
beaver.on('disconnect', handleDisconnect);

// Demo mode: connect to starling.js
if(isDemo) {
  let demoIcon = createElement('b', 'animate-breathing text-success', 'DEMO');
  connectIcon.replaceChildren(demoIcon);
  beaver.stream(baseUrl, { io: starling });
}

// Normal mode: connect to socket.io
else {
  beaver.stream(baseUrl, { io: io });
}

// Handle stream connection
function handleConnect() {
  statsDisplay.hidden = false;
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-success'));
}

// Handle stream disconnection
function handleDisconnect() {
  statsDisplay.hidden = true;
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-warning'));
}

// Handle error
function handleError(error) {
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-danger'));
}

// Handle stats
function handleStats(stats) {
  deviceCount.textContent = stats.numberOfDevices;
  raddecRate.textContent = stats.eventsPerSecond.raddec.toFixed(1);
  dynambRate.textContent = stats.eventsPerSecond.dynamb.toFixed(1);
  spatemRate.textContent = stats.eventsPerSecond.spatem.toFixed(1);
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
