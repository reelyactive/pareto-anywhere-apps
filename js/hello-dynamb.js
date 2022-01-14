/**
 * Copyright reelyActive 2022
 * We believe in an open Internet of Things
 */


// Constants
const DYNAMB_ROUTE = '/devices/dynamb';
const SIGNATURE_SEPARATOR = '/';
const TIME_OPTIONS = { hour: "2-digit", minute: "2-digit", hour12: false };
const DYNAMB_TABLE_MAPPING = {
    acceleration: { row: "#accelerationrow", data: "#accelerationdata" },
    batteryPercentage: { row: "#batterypercentagerow",
                         data: "#batterypercentagedata" },
    batteryVoltage: { row: "#batteryvoltagerow", data: "#batteryvoltagedata" },
    elevation: { row: "#elevationrow", data: "#elevationdata" },
    heading: { row: "#headingrow", data: "#headingdata" },
    heartRate: { row: "#heartraterow", data: "#heartratedata" },
    illuminance: { row: "#illuminancerow", data: "#illuminancedata" },
    interactionDigest: { row: "#interactiondigestrow",
                         data: "#interactiondigestdata" },
    isButtonPressed: { row: "#isbuttonpressedrow",
                       data: "#isbuttonpresseddata" },
    magneticField: { row: "#magneticfieldrow", data: "#magneticfielddata" },
    nearest: { row: "#nearestrow", data: "#nearestdata" },
    position: { row: "#positionrow", data: "#positiondata" },
    pressure: { row: "#pressurerow", data: "#pressuredata" },
    relativeHumidity: { row: "#relativehumidityrow",
                        data: "#relativehumiditydata" },
    speed: { row: "#speedrow", data: "#speeddata" },
    temperature: { row: "#temperaturerow", data: "#temperaturedata" },
    txCount: { row: "#txcountrow", data: "#txcountdata" },
    unicodeCodePoints: { row: "#unicodecodepointsrow",
                         data: "#unicodecodepointsdata" },
    uptime: { row: "#uptimerow", data: "#uptimedata" }
};


// DOM elements
let connection = document.querySelector('#connection');
let firsthalf = document.querySelector('#firsthalf');
let secondhalf = document.querySelector('#secondhalf');
let time = document.querySelector('#time');


// Other variables
let updateMilliseconds = 5000;
let dynambCompilation = new Map();

// Connect to the socket.io stream and handle dynamb events
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
});
socket.on("disconnect", function(reason) {
  connection.replaceChildren(createElement('i', 'fas fa-cloud text-warning'));
});


// Begin periodic updates of stats display
update();
setInterval(update, updateMilliseconds);


// Handle a dynamb event
function handleDynamb(dynamb) {
  let deviceSignature = dynamb.deviceId + SIGNATURE_SEPARATOR +
                        dynamb.deviceIdType;

  cuttlefishDynamb.render(dynamb, secondhalf);

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
}


// Remove stale samples from the dynamb compilation
function updateCompilation() {
  let staleTimestampThreshold = Date.now() - 10000;
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
  dynambCompilation.forEach((samples, property) => {
    if(DYNAMB_TABLE_MAPPING.hasOwnProperty(property)) {
      let td = document.querySelector(DYNAMB_TABLE_MAPPING[property].data);
      td.textContent = samples[0].value; // TODO: use cuttlefish
    }
  });

  for(const property in DYNAMB_TABLE_MAPPING) {
    let tr = document.querySelector(DYNAMB_TABLE_MAPPING[property].row);

    if(dynambCompilation.has(property)) {
      tr.hidden = false;
    }
    else {
      tr.hidden = true;
    }
  }
}


// Create an element as specified
function createElement(elementName, classNames) {
  let element = document.createElement(elementName);

  if(classNames) {
    element.setAttribute('class', classNames);
  }

  return element;
}


// Create an element, as specified, and append it to the given child
function append(parent, elementName, content, classNames) {
  let element = document.createElement(elementName);

  if((content instanceof Element) || (content instanceof DocumentFragment)) {
    element.appendChild(content);
  }
  else {
    element.textContent = content;
  }

  if(classNames) {
    element.setAttribute('class', classNames);
  }

  parent.appendChild(element);
}