/**
 * Copyright reelyActive 2022
 * We believe in an open Internet of Things
 */


// Constants
const STATUS_OK = 200;
const DYNAMB_ROUTE = '/devices/dynamb';
const DEVICE_CONTEXT_ROUTE = '/context/device';
const SIGNATURE_SEPARATOR = '/';
const TIME_OPTIONS = { hour: "2-digit", minute: "2-digit", hour12: false };
const DEMO_SEARCH_PARAMETER = 'demo';
const MAX_STALE_MILLISECONDS = 60000;
const ID_TITLE_SUFFIX = '-title';
const ID_NEAREST_SUFFIX = '-nearest';
const ID_TIME_SUFFIX = '-time';
const ID_IMG_DEVICE_SUFFIX = '-img-device';
const ID_IMG_NEAREST_SUFFIX = '-img-nearest';
const STORY_PLACEHOLDER_IMAGE_PATH = '../images/story-placeholder.png';

// DOM elements
let connection = document.querySelector('#connection');
let demoalert = document.querySelector('#demoalert');
let eventslist = document.querySelector('#eventslist');
let time = document.querySelector('#time');

// Other variables
let eventsCompilation = new Map();
let eventsStats = {
    isButtonPressed: { tr: document.querySelector('#isButtonPressed'),
                       current: '', previous: [ '', '', '' ] }
};
let baseUrl = window.location.protocol + '//' + window.location.hostname +
              ':' + window.location.port;

// Initialise based on URL search parameters, if any
let searchParams = new URLSearchParams(location.search);
let isDemo = searchParams.has(DEMO_SEARCH_PARAMETER);

// Demo mode: connect to starling.js
if(isDemo) {
  starling.on("dynamb", handleDynamb);
  connection.replaceChildren(createElement('b',
                                           'animate-breathing text-success',
                                           'DEMO'));
}

// Normal mode: connect to socket.io
else {
  let socket = io(baseUrl + DYNAMB_ROUTE);
  socket.on("dynamb", handleDynamb);

  // Display changes to the socket.io connection status
  socket.on("connect", function() {
    connection.replaceChildren(createElement('i', 'fas fa-cloud text-success'));
  });
  socket.on("connect_error", function() {
    connection.replaceChildren(createElement('i', 'fas fa-cloud text-danger'));
    demoalert.hidden = false;
  });
  socket.on("disconnect", function(reason) {
    connection.replaceChildren(createElement('i', 'fas fa-cloud text-warning'));
  });
}


// Begin periodic updates of stats display
update();


// GET the context for the given device
function getDeviceContext(signature, callback) {
  let url = baseUrl + DEVICE_CONTEXT_ROUTE + '/' + signature;
  let httpRequest = new XMLHttpRequest();

  httpRequest.onreadystatechange = function() {
    if(httpRequest.readyState === XMLHttpRequest.DONE) {
      return callback(signature, httpRequest.status, httpRequest.responseText);
    }
  };
  httpRequest.open('GET', url);
  httpRequest.setRequestHeader('Accept', 'application/json');
  httpRequest.send();
}


// Handle a dynamb event
function handleDynamb(dynamb) {
  let deviceSignature = dynamb.deviceId + SIGNATURE_SEPARATOR +
                        dynamb.deviceIdType;
  let isNewDevice = !eventsCompilation.has(deviceSignature);

  if(dynamb.hasOwnProperty('isButtonPressed')) {
    getDeviceContext(deviceSignature, handleDeviceContext);
    eventsStats['isButtonPressed'].current++;
    updateEventsRow(eventsStats['isButtonPressed']);

    if(isNewDevice) {
      handleNewDeviceEvent(deviceSignature, dynamb.timestamp);
    }
    else {
      handleEventUpdate(deviceSignature, dynamb.timestamp);
    }
  }
}


// Handle device context response
function handleDeviceContext(signature, status, response) {
  if(status === STATUS_OK) {
    let devices = JSON.parse(response).devices || {};
    let device = devices[signature];

    if(device && eventsCompilation.has(signature)) {
      let event = eventsCompilation.get(signature);
      let nearestDevice = device.nearest[0].device;

      event.nearestDevice = nearestDevice;

      if(device.hasOwnProperty('url')) {
        event.deviceUri = device.url;
      }
      else if(device.hasOwnProperty('statid') &&
              device.statid.hasOwnProperty('uri')) {
        event.deviceUri = device.statid.uri;
      }

      if(devices[nearestDevice]) {
        if(devices[nearestDevice].hasOwnProperty('url')) {
          event.nearestUri = devices[nearestDevice].url;
        }
        else if(devices[nearestDevice].hasOwnProperty('statid') &&
                devices[nearestDevice].statid.hasOwnProperty('uri')) {
          event.nearestUri = devices[nearestDevice].statid.uri;
        }
      }

      if(event.deviceUri) {
        cormorant.retrieveStory(event.deviceUri, (story) => {
          updateDisplay();
        });
      }
      if(event.nearestUri) {
        cormorant.retrieveStory(event.nearestUri, (story) => {
          updateDisplay();
        });
      }

      eventsCompilation.set(signature, event);
      updateCard(signature, event, false);
    }
  }
}


// Handle a new device with an event
function handleNewDeviceEvent(deviceSignature, timestamp) {
  let event = { timestamp: timestamp };

  insertCard(eventslist, deviceSignature, event);
  eventsCompilation.set(deviceSignature, event);
}


// Handle an event update
function handleEventUpdate(deviceSignature, timestamp) {
  let event = eventsCompilation.get(deviceSignature);
  event.timestamp = timestamp;

  updateCard(deviceSignature, event, true);
  eventsCompilation.set(deviceSignature, event);
}


// Create and insert an event card
function insertCard(parent, signature, event) {
  let time = new Date(event.timestamp).toLocaleTimeString([], TIME_OPTIONS);

  let iconButton = createElement('i', 'fas fa-hand-pointer');
  let iconNearest = createElement('i', 'fas fa-map-pin');
  let spanTitle = createElement('span', null, signature);
  let cardTitle = createElement('h5', 'card-title',
                                [ iconButton, ' \u00a0', spanTitle ]);
  let spanNearest = createElement('span', null, '');
  let cardText = createElement('p', 'card-text text-muted',
                               [ iconNearest, ' \u00a0', spanNearest ]);
  let cardBody = createElement('div', 'card-body', [ cardTitle, cardText ]);
  let cardFooter = createElement('div', 'card-footer bg-dark text-white animate-breathing text-center mt-auto', time);
  let imgDevice = createElement('img', 'img-fluid');
  let imgNearest = createElement('img', 'img-fluid');
  let leftCol = createElement('div', 'col-3 align-self-center', imgDevice);
  let centreCol = createElement('div',
                                'col-6 d-flex align-items-stretch flex-column',
                                [ cardBody, cardFooter ]);
  let rightCol = createElement('div', 'col-3 align-self-center', imgNearest);
  let row = createElement('div', 'row g-0', [ leftCol, centreCol, rightCol ]);
  let card = createElement('div', 'card rounded hover-shadow mb-3', row);

  card.setAttribute('id', signature);
  spanTitle.setAttribute('id', signature + ID_TITLE_SUFFIX);
  spanNearest.setAttribute('id', signature + ID_NEAREST_SUFFIX);
  cardFooter.setAttribute('id', signature + ID_TIME_SUFFIX);
  imgDevice.setAttribute('id', signature + ID_IMG_DEVICE_SUFFIX);
  imgNearest.setAttribute('id', signature + ID_IMG_NEAREST_SUFFIX);
  imgDevice.setAttribute('src', STORY_PLACEHOLDER_IMAGE_PATH);
  imgNearest.setAttribute('src', STORY_PLACEHOLDER_IMAGE_PATH);

  parent.insertBefore(card, parent.firstChild);
}


// Update an existing event card
function updateCard(signature, event, isNewEvent) {
  let isStaleEvent = (Date.now() - event.timestamp) > MAX_STALE_MILLISECONDS;
  let spanTitle = document.getElementById(signature + ID_TITLE_SUFFIX);
  let spanNearest = document.getElementById(signature + ID_NEAREST_SUFFIX);
  let imgDevice = document.getElementById(signature + ID_IMG_DEVICE_SUFFIX);
  let imgNearest = document.getElementById(signature + ID_IMG_NEAREST_SUFFIX);
  let cardFooter = document.getElementById(signature + ID_TIME_SUFFIX);
  let time = new Date(event.timestamp).toLocaleTimeString([], TIME_OPTIONS);

  if(isStaleEvent) {
    cardFooter.setAttribute('class',
                            'card-footer bg-white text-center mt-auto');
  }
  else {
    cardFooter.setAttribute('class', 'card-footer bg-dark text-white animate-breathing text-center mt-auto');
  }

  if(event.deviceUri && cormorant.stories[event.deviceUri]) {
    let story = cormorant.stories[event.deviceUri];
    spanTitle.textContent = cuttlefishStory.determineTitle(story);
    imgDevice.setAttribute('src', cuttlefishStory.determineImageUrl(story));
  }
  if(event.nearestUri && cormorant.stories[event.nearestUri]) {
    let story = cormorant.stories[event.nearestUri];
    spanNearest.textContent = cuttlefishStory.determineTitle(story);
    imgNearest.setAttribute('src', cuttlefishStory.determineImageUrl(story));
  }

  cardFooter.textContent = time;

  if(isNewEvent) {
    let card = document.getElementById(signature);
    eventslist.insertBefore(card, eventslist.firstChild);
  }
}


// Update a single events row
function updateEventsRow(eventStats) {
  let tds = eventStats.tr.getElementsByTagName('td');

  tds[0].textContent = eventStats.current;
  tds[1].textContent = eventStats.previous[0];
  tds[2].textContent = eventStats.previous[1];
  tds[3].textContent = eventStats.previous[2];
}


// Compile statistics, update time and display
function update() {
  time.textContent = new Date().toLocaleTimeString([], TIME_OPTIONS);

  updateDisplay();
  updateStats();

  let millisecondsToNextMinute = 60000 - (Date.now() % 60000);
  setTimeout(update, millisecondsToNextMinute);
}


// Update the compilation display
function updateDisplay() {
  eventsCompilation.forEach((event, signature) => {
    updateCard(signature, event, false);
  });
}


// Update the stats and the table
function updateStats() {
  for(const property in eventsStats) {
    let eventStats = eventsStats[property];

    eventStats.previous.pop();
    eventStats.previous.unshift(eventStats.current);
    eventStats.current = 0;


    updateEventsRow(eventStats);
  }
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
