/**
 * Copyright reelyActive 2022-2023
 * We believe in an open Internet of Things
 */


// Constants
const STATUS_OK = 200;
const DYNAMB_ROUTE = '/devices/dynamb';
const DEVICE_CONTEXT_ROUTE = '/context/device';
const SIGNATURE_SEPARATOR = '/';
const TIME_OPTIONS = { hour: "2-digit", minute: "2-digit", hour12: false };
const TIMESTAMP_OPTIONS = { hour: "2-digit", minute: "2-digit",
                            second: "2-digit", hour12: false };
const DEMO_SEARCH_PARAMETER = 'demo';
const STALE_MILLISECONDS = 60000;
const MIN_ANIMATE_MILLISECONDS = 15000;
const ENVIRONMENTAL_HISTORY_MILLISECONDS = 60000;
const MAX_LISTED_EVENTS = 8;
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
let knob = document.querySelector('#knob');
let eventslist = document.querySelector('#eventslist');
let time = document.querySelector('#time');

// Other variables
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
  if(dynamb.hasOwnProperty('angleOfRotation')) {
    updateKnobSelector(dynamb);
  }
  if(dynamb.hasOwnProperty('temperature') ||
     dynamb.hasOwnProperty('relativeHumidity') ||
     dynamb.hasOwnProperty('illuminance')) {
    handleEnvironmentalData(dynamb);
  }

  if(dynamb.hasOwnProperty('isButtonPressed') ||
     dynamb.hasOwnProperty('isContactDetected') ||
     dynamb.hasOwnProperty('isMotionDetected') ||
     dynamb.hasOwnProperty('unicodeCodePoints')) {
    let deviceSignature = dynamb.deviceId + SIGNATURE_SEPARATOR +
                          dynamb.deviceIdType;
    cormorant.retrieveAssociations(baseUrl, deviceSignature, 
                                   { isStoryToBeRetrieved: true },
                                   (associations, story, status) => {
      handleEvent(dynamb, associations, story);
    });
  }
}


// Update the knob selector
function updateKnobSelector(dynamb) {
  let angle = dynamb.angleOfRotation || 0;
  knob.setAttribute('style', 'transform: rotate(' + angle.toFixed(0) + 'deg)');

  // TODO: update demo
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
function handleEvent(dynamb, associations, story) {
  let idPrefix = dynamb.deviceId + '-' + dynamb.deviceIdType;
  let name = dynamb.deviceId + SIGNATURE_SEPARATOR + dynamb.deviceIdType;
  let description;
  let deviceEventRows = [];

  if(story) {
    name = cuttlefishStory.determineTitle(story) || name;
  }

  if(Array.isArray(dynamb.isButtonPressed) &&
     dynamb.isButtonPressed.includes(true)) {
    description = 'Button pressed';
    deviceEventRows.push(createEventRow(idPrefix + '-isButtonPressed',
                                        'fas fa-hand-pointer', description,
                                        name, dynamb.timestamp));
  }

  if(Array.isArray(dynamb.isContactDetected)) {
    if(associations && Array.isArray(associations.tags) &&
       associations.tags.includes('tamper')) {
      if(!dynamb.isContactDetected.includes(true)) {
        description = 'Tamper detected';
        deviceEventRows.push(createEventRow(idPrefix + '-isContactDetected',
                                            'fas fa-exclamation-triangle',
                                            description, name,
                                            dynamb.timestamp));
      }
    }
    else {
      description = 'Contact';
      if(associations && Array.isArray(associations.tags)) {
        if(associations.tags.includes('door')) { description = 'Door'; }
      }
      description += dynamb.isContactDetected.includes(true) ? ' closed' :
                                                               ' opened';
      deviceEventRows.push(createEventRow(idPrefix + '-isContactDetected',
                                          'fas fa-compress-alt', description,
                                          name, dynamb.timestamp));
    }
  }

  if(Array.isArray(dynamb.isMotionDetected) &&
     dynamb.isMotionDetected.includes(true)) {
    description = 'Motion detected';
    if(associations && Array.isArray(associations.tags)) {
      if(associations.tags.includes('room')) { description = 'Room occupied'; }
      if(associations.tags.includes('desk')) { description = 'Desk occupied'; }
      if(associations.tags.includes('chair')) { description = 'Chair occupied'; }
      if(associations.tags.includes('door')) { description = 'Door activity'; }
    }
    deviceEventRows.push(createEventRow(idPrefix + '-isMotionDetected',
                                        'fas fa-walking', description,
                                        name, dynamb.timestamp));
  }

  if(Array.isArray(dynamb.unicodeCodePoints)) {
    description = '';
    for(const codePoint of dynamb.unicodeCodePoints) {
      description += String.fromCodePoint(codePoint);
    }
    let characters = createElement('span', 'display-6', description);
    deviceEventRows.push(createEventRow(idPrefix + '-unicodeCodePoints',
                                        'fas fa-language', characters,
                                        name, dynamb.timestamp));
  }

  if(deviceEventRows.length > 0) {
    updateEventsTable(deviceEventRows);
  }
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


// Create an event row
function createEventRow(id, iconClass, description, device, timestamp) {
  let icon = createElement('i', iconClass + ' display-6');
  let iconCol = createElement('th', 'table-primary animate-breathing', icon);
  let deviceCol = createElement('td', null, device);
  let descriptionCol = createElement('td', 'fw-bold', description);
  let time = new Date(timestamp).toLocaleTimeString([], TIMESTAMP_OPTIONS);
  let timestampCol = createElement('td', null, time);
  let tr = createElement('tr', 'align-middle',
                         [ iconCol, descriptionCol, deviceCol, timestampCol ]);
  tr.id = id;
  tr.timestamp = timestamp;

  return tr;
}


// Compile statistics, update time and display
function update() {
  time.textContent = new Date().toLocaleTimeString([], TIME_OPTIONS);

  updateEventsTable();

  let millisecondsToNextMinute = 60000 - (Date.now() % 60000);
  setTimeout(update, millisecondsToNextMinute);
}


// Update the events table
function updateEventsTable(eventRows) {
  let isNewEvents = Array.isArray(eventRows) && (eventRows.length > 0);

  // Insert/update latest events
  if(isNewEvents) {
    eventRows.forEach(row => {
      let existingRow = document.querySelector('#' + row.id);

      if(existingRow) {
        existingRow.replaceWith(row);
      }
      eventslist.insertBefore(row, eventslist.firstChild);
    });
  }

  // Remove/modify events based on time and quantiy
  if(eventslist.hasChildNodes()) {
    let staleTimestampThreshold = Date.now() - STALE_MILLISECONDS;
    let animateTimestampThreshold = Date.now() - MIN_ANIMATE_MILLISECONDS;

    eventslist.childNodes.forEach((row, index) => {
      if(index >= MAX_LISTED_EVENTS) {
        eventslist.removeChild(row);
      }
      else if(row.timestamp < staleTimestampThreshold) {
        row.setAttribute('class', 'align-middle text-muted');
      }
      else if(row.timestamp < animateTimestampThreshold) {
        row.firstChild.setAttribute('class', '');
      }
    });
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
