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
const ENVIRONMENTAL_HISTORY_MILLISECONDS = 60000;
const ID_TITLE_SUFFIX = '-title';
const ID_NEAREST_SUFFIX = '-nearest';
const ID_TIME_SUFFIX = '-time';
const ID_IMG_DEVICE_SUFFIX = '-img-device';
const ID_IMG_NEAREST_SUFFIX = '-img-nearest';
const STORY_PLACEHOLDER_IMAGE_PATH = '../images/story-placeholder.png';
const CLASS_ICON_NORMAL = 'bg-dark align-middle';
const CLASS_ICON_ABNORMAL = 'bg-secondary align-middle';
const CLASS_DISPLAY_NORMAL = 'text-dark';
const CLASS_DISPLAY_ABNORMAL = 'text-secondary';
const CLASS_PROGRESS_TARGET_NORMAL = 'progress-bar progress-bar-striped progress-bar-animated bg-success';
const CLASS_PROGRESS_TARGET_ABNORMAL = 'progress-bar progress-bar-striped progress-bar-animated bg-dark';
const CLASS_PROGRESS_EDGE_NORMAL = 'progress-bar bg-info bg-gradient';
const CLASS_PROGRESS_EDGE_ACTIVE = 'progress-bar bg-secondary bg-gradient animate-breathing';


// DOM elements
let connection = document.querySelector('#connection');
let demoalert = document.querySelector('#demoalert');
let message = document.querySelector('#message');
let eventslist = document.querySelector('#eventslist');
let time = document.querySelector('#time');

// Other variables
let deviceEvents = new Map();
let baseUrl = window.location.protocol + '//' + window.location.hostname +
              ':' + window.location.port;
let environmentalIndicators = {
    temperature: {
        icon: document.querySelector('#temperatureIcon'),
        display: document.querySelector('#temperatureDisplay'),
        progress: document.querySelector('#temperatureProgress'),
        readings: [],
        minThreshold: 19,
        maxThreshold: 23,
        precisionDigits: 1,
        suffix: '\u2103'
    },
    relativeHumidity: {
        icon: document.querySelector('#humidityIcon'),
        display: document.querySelector('#humidityDisplay'),
        progress: document.querySelector('#humidityProgress'),
        readings: [],
        minThreshold: 20,
        maxThreshold: 80,
        precisionDigits: 0,
        suffix: '%'
    },
    illuminance: {
        icon: document.querySelector('#illuminanceIcon'),
        display: document.querySelector('#illuminanceDisplay'),
        progress: document.querySelector('#illuminanceProgress'),
        readings: [],
        minThreshold: 300,
        maxThreshold: 500,
        precisionDigits: 0,
        suffix: ' lux'
    }
}

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


// Handle a dynamb event
function handleDynamb(dynamb) {
  if(dynamb.hasOwnProperty('temperature') ||
     dynamb.hasOwnProperty('relativeHumidity') ||
     dynamb.hasOwnProperty('illuminance')) {
    handleEnvironmentalData(dynamb);
  }

  if(dynamb.hasOwnProperty('isButtonPressed') ||
     dynamb.hasOwnProperty('isContactDetected') ||
     dynamb.hasOwnProperty('isMotionDetected') ||
     dynamb.hasOwnProperty('unicodeCodePoints')) {
    handleEvent(dynamb);
  }
}


// Handle environmental data
function handleEnvironmentalData(dynamb) {
  if(dynamb.hasOwnProperty('temperature')) {
    updateEnvironmentalIndicator('temperature', dynamb.temperature,
                                 dynamb.timestamp);
  }
  if(dynamb.hasOwnProperty('relativeHumidity')) {
    updateEnvironmentalIndicator('relativeHumidity', dynamb.relativeHumidity,
                                 dynamb.timestamp);
  }
  if(dynamb.hasOwnProperty('illuminance')) {
    updateEnvironmentalIndicator('illuminance', dynamb.illuminance,
                                 dynamb.timestamp);
  }
}


// Handle an event
function handleEvent(dynamb) {
  let deviceSignature = dynamb.deviceId + SIGNATURE_SEPARATOR +
                        dynamb.deviceIdType;

  cormorant.retrieveAssociations(baseUrl, deviceSignature, true,
                                 (associations, story) => {
    // TODO: display event
  });
}


// Update environmental indicator
function updateEnvironmentalIndicator(name, value, timestamp) {
  if(environmentalIndicators.hasOwnProperty(name)) {
    let indicator = environmentalIndicators[name];
    let isBelowThreshold = false;
    let isAboveThreshold = false;
    let isNormal = false;
    let displayValue = '\u2014';
    let valueSum = 0;
    let valueCount = 0;
    let staleTimestampThreshold = Date.now() -
                                  ENVIRONMENTAL_HISTORY_MILLISECONDS;

    // TODO: move readings management to separate function
    if(value && timestamp) {
      indicator.readings.push({ value: value, timestamp: timestamp });
    }

    for(let index = 0; index < indicator.readings.length; index++) {
      let reading = indicator.readings[index];
      if(reading.timestamp < staleTimestampThreshold) {
        indicator.readings.splice(index, 1);
      }
      else {
        valueSum += reading.value;
        valueCount++;
      }
    }

    if(valueCount > 0) {
      let averageValue = valueSum / valueCount;
      displayValue = averageValue.toFixed(indicator.precisionDigits);
      isBelowThreshold = (averageValue < indicator.minThreshold);
      isAboveThreshold = (averageValue > indicator.maxThreshold);
      isNormal = !(isBelowThreshold || isAboveThreshold);
    }

    let progressElements = indicator.progress.children;

    indicator.display.textContent = displayValue + indicator.suffix;
    indicator.icon.setAttribute('class', isNormal ? CLASS_ICON_NORMAL :
                                                    CLASS_ICON_ABNORMAL);
    indicator.display.setAttribute('class', isNormal ? CLASS_DISPLAY_NORMAL :
                                                       CLASS_DISPLAY_ABNORMAL);
    progressElements[0].setAttribute('class', isBelowThreshold ?
                                              CLASS_PROGRESS_EDGE_ACTIVE :
                                              CLASS_PROGRESS_EDGE_NORMAL);
    progressElements[1].setAttribute('class', isNormal ?
                                              CLASS_PROGRESS_TARGET_NORMAL :
                                              CLASS_PROGRESS_TARGET_ABNORMAL);
    progressElements[2].setAttribute('class', isAboveThreshold ?
                                              CLASS_PROGRESS_EDGE_ACTIVE :
                                              CLASS_PROGRESS_EDGE_NORMAL);
  }
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

  message.hidden = true;
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


// Compile statistics, update time and display
function update() {
  time.textContent = new Date().toLocaleTimeString([], TIME_OPTIONS);

  updateEventsDisplay();

  let millisecondsToNextMinute = 60000 - (Date.now() % 60000);
  setTimeout(update, millisecondsToNextMinute);
}


// Update the events display
function updateEventsDisplay() {
  deviceEvents.forEach((event, signature) => {
    // TODO
  });
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
