/**
 * Copyright reelyActive 2022
 * We believe in an open Internet of Things
 */


// Constants
const DYNAMB_ROUTE = '/devices/dynamb';
const SIGNATURE_SEPARATOR = '/';
const TIME_OPTIONS = { hour: "2-digit", minute: "2-digit", hour12: false };
const DEFAULT_UPDATE_MILLISECONDS = 5000;
const DEFAULT_COMPILATION_MILLISECONDS = 10000;
const DYNAMB_DISPLAY_HOLDOFF_MILLISECONDS = 1000;
const DEMO_SEARCH_PARAMETER = 'demo';

// DOM elements
let connection = document.querySelector('#connection');
let demoalert = document.querySelector('#demoalert');
let message = document.querySelector('#message');
let latestdynamb = document.querySelector('#latestdynamb');
let propertytable = document.querySelector('#propertytable');
let time = document.querySelector('#time');

// Other variables
let updateMilliseconds = DEFAULT_UPDATE_MILLISECONDS;
let dynambCompilation = new Map();
let latestDisplayedDynambTimestamp = 0;

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
  let baseUrl = window.location.protocol + '//' + window.location.hostname +
                ':' + window.location.port;
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
setInterval(update, updateMilliseconds);


// Handle a dynamb event
function handleDynamb(dynamb) {
  let deviceSignature = dynamb.deviceId + SIGNATURE_SEPARATOR +
                        dynamb.deviceIdType;

  if(dynamb.timestamp > (latestDisplayedDynambTimestamp +
                         DYNAMB_DISPLAY_HOLDOFF_MILLISECONDS)) {
    message.hidden = true;
    cuttlefishDynamb.render(dynamb, latestdynamb);
    latestDisplayedDynambTimestamp = dynamb.timestamp;
  }

  for(const property in dynamb) {
    if((property !== 'timestamp') && (property !== 'deviceId') &&
       (property !== 'deviceIdType')) {
      let propertySample = { value: dynamb[property],
                             timestamp: dynamb.timestamp,
                             deviceSignature: deviceSignature };

      if(!dynambCompilation.has(property)) {
        dynambCompilation.set(property, []);
      }

      let propertySamples = dynambCompilation.get(property);

      propertySamples.unshift(propertySample);
    }
  }
}


// Compile statistics, update time and display
function update() {
  time.textContent = new Date().toLocaleTimeString([], TIME_OPTIONS);

  updateCompilation();
  updateDisplay();

  if(latestDisplayedDynambTimestamp < (Date.now() - updateMilliseconds)) {
    latestdynamb.replaceChildren();
    message.hidden = false;
  }
}


// Remove stale samples from the dynamb compilation
function updateCompilation() {
  let staleTimestampThreshold = Date.now() - DEFAULT_COMPILATION_MILLISECONDS;

  dynambCompilation.forEach((samples, property) => {
    for(let index = samples.length - 1; index >= 0; index--) {
      let sample = samples[index];

      if(sample.timestamp < staleTimestampThreshold) {
        samples.splice(index, 1);
      }
    }

    if(samples.length === 0) {
      dynambCompilation.delete(property);
    }
  });
}


// Update the compilation display
function updateDisplay() {
  let rows = new DocumentFragment();

  if(dynambCompilation.size > 0) {
    let sortedDynambCompilation = new Map([...dynambCompilation.entries()]
                                    .sort((a, b) => b[1].length - a[1].length));
    let maxCount = [...sortedDynambCompilation][0][1].length;
  
    sortedDynambCompilation.forEach((samples, property) => {
      let i = cuttlefishDynamb.renderIcon(property);
      let progressBar = createElement('div', 'progress-bar bg-ambient',
                                      samples.length);
      let progress = createElement('div', 'progress mb-2', progressBar);
      let widthPercentage = Math.floor(100 * samples.length / maxCount);
      let value = cuttlefishDynamb.renderValue(property, samples[0].value);
      let th = createElement('th',
                             'w-25 table-light display-6 align-middle mb-1', i);
      let td = createElement('td', 'w-75 align-middle', [ progress, value ]);
      let tr = createElement('tr', null, [ th, td ]);

      progressBar.setAttribute('style', 'width: ' + widthPercentage + '%');
      rows.appendChild(tr);
    });

  }

  propertytable.replaceChildren(rows);
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
