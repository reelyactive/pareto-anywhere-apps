/**
 * Copyright reelyActive 2022-2023
 * We believe in an open Internet of Things
 */


// Constants
const TIME_OPTIONS = { hour: "2-digit", minute: "2-digit", hour12: false };
const DEMO_SEARCH_PARAMETER = 'demo';

// DOM elements
let connectIcon = document.querySelector('#connectIcon');
let demoalert = document.querySelector('#demoalert');
let message = document.querySelector('#message');
let deviceCount =  document.querySelector('#deviceCount');
let spatemRate = document.querySelector('#spatemRate');
let spatemDisplay = document.querySelector('#spatemdisplay');
let time = document.querySelector('#time');

// Other variables
let selectedDeviceId;

// Initialise based on URL search parameters, if any
let searchParams = new URLSearchParams(location.search);
let isDemo = searchParams.has(DEMO_SEARCH_PARAMETER);
let baseUrl = window.location.protocol + '//' + window.location.hostname + ':' +
              window.location.port;

// Start the clock
updateClock();

// Handle beaver events
beaver.on('connect', handleConnect);
beaver.on('spatem', handleSpatem);
beaver.on('stats', handleStats);
beaver.on('error', handleError);
beaver.on('disconnect', handleDisconnect);

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

// Handle stream disconnection
function handleDisconnect() {
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-warning'));
}

// Handle error
function handleError(error) {
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-danger'));
  demoalert.hidden = false;
}

// Handle stats
function handleStats(stats) {
  deviceCount.textContent = stats.numberOfDevices;
  spatemRate.textContent = stats.eventsPerSecond.spatem.toFixed(1);
}

// Handle a spatem event
function handleSpatem(spatem) {
  message.hidden = true;
  cuttlefishSpatem.render(spatem, spatemdisplay);
}

// Update clock, repeat at the top of the minute
function updateClock() {
  let millisecondsToNextMinute = 60000 - (Date.now() % 60000);
  time.textContent = new Date().toLocaleTimeString([], TIME_OPTIONS);
  setTimeout(updateClock, millisecondsToNextMinute);
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
