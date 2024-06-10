/**
 * Copyright reelyActive 2023-2024
 * We believe in an open Internet of Things
 */


// Constants
const DEMO_SEARCH_PARAMETER = 'demo';
const CONTINUOUS_PROPERTIES = [ 'temperature', 'relativeHumidity',
                                'illuminance', 'batteryPercentage' ];
const CONTINUOUS_HISTORY_MILLISECONDS = 60000;
const CONTINUOUS_UPDATE_MILLISECONDS = 5000;


// DOM elements
let connectIcon = document.querySelector('#connectIcon');
let demoalert = document.querySelector('#demoalert');
let message = document.querySelector('#message');
let time = document.querySelector('#time');
let deviceCount = document.querySelector('#deviceCount');
let raddecRate = document.querySelector('#raddecRate');
let dynambRate = document.querySelector('#dynambRate');


// Other variables
let baseUrl = window.location.protocol + '//' + window.location.hostname +
              ':' + window.location.port;
let cormorantOptions;
let devices = new Map();

// Initialise based on URL search parameters, if any
let searchParams = new URLSearchParams(location.search);
let isDemo = searchParams.has(DEMO_SEARCH_PARAMETER);


let continuousDataTableOptions = { propertiesToDisplay: CONTINUOUS_PROPERTIES };
let continuousDataTable = new ContinuousDataTable('#continuousData', devices,
                                                  continuousDataTableOptions);
let discreteDataTableOptions = { isClockDisplayed: true,
                                 digitalTwins: cormorant.digitalTwins,
                                 maxRows: 10 };
let discreteDataTable = new DiscreteDataTable('#discreteData',
                                              discreteDataTableOptions);

// Handle beaver events
beaver.on('dynamb', handleDynamb);
beaver.on('connect', () => {
  if(isDemo) { return; }
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-success'));
  demoalert.hidden = true;
});
beaver.on('stats', (stats) => {
  deviceCount.textContent = stats.numberOfDevices;
  raddecRate.textContent = stats.eventsPerSecond.raddec.toFixed(1);
  dynambRate.textContent = stats.eventsPerSecond.dynamb.toFixed(1);
});
beaver.on('error', (error) => {
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-danger'));
  demoalert.hidden = false;
});
beaver.on('disconnect', () => {
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-warning'));
});

// Demo mode: connect to starling.js
if(isDemo) {
  let demoIcon = createElement('b', 'animate-breathing text-success', 'DEMO');
  let context = starling.getContext();

  connectIcon.replaceChildren(demoIcon);
  beaver.stream(null, { io: starling, ioUrl: "http://pareto.local" });

  for(let deviceSignature in context.devices) {
    let device = context.devices[deviceSignature];
    beaver.devices.set(deviceSignature, device);
  }
}

// Normal mode: connect to socket.io
else {
  beaver.stream(baseUrl, { io: io });
  cormorantOptions = { associationsServerUrl: baseUrl };
}

setTimeout(removeStaleDevicesData, CONTINUOUS_UPDATE_MILLISECONDS);


// Handle a dynamb event
function handleDynamb(dynamb) {
  let deviceSignature = dynamb.deviceId + '/' + dynamb.deviceIdType;
  let hasContinuousDataProperty = false;

  cormorant.retrieveDigitalTwin(deviceSignature, null, cormorantOptions,
                                (digitalTwin, isRetrievedFromMemory) => {
    if(digitalTwin && !isRetrievedFromMemory) {
      discreteDataTable.updateDigitalTwin(deviceSignature, digitalTwin);
    }
  });
  discreteDataTable.handleDynamb(dynamb);
  updateDevices(deviceSignature, dynamb);
}


// Update the devices with the given dynamb, as required
function updateDevices(deviceSignature, dynamb) {
  let continuousDataProperties = [];

  CONTINUOUS_PROPERTIES.forEach((property) => {
    if(dynamb.hasOwnProperty(property)) {
      continuousDataProperties.push(property);
    };
  });

  if(continuousDataProperties.length === 0) return;

  if(!devices.has(deviceSignature)) {
    devices.set(deviceSignature, { dynamb: {}, properties: {} });
  }

  let device = devices.get(deviceSignature);
  continuousDataProperties.forEach((property) => {
    if(!device.properties.hasOwnProperty(property) ||
       (device.properties[property].timestamp < dynamb.timestamp)) {
      device.properties[property] = { value: dynamb[property],
                                      timestamp: dynamb.timestamp };
    }
  });

  for(const property in device.properties) {
    device.dynamb[property] = device.properties[property].value;
  }

  if(!device.dynamb.hasOwnProperty('timestamp') ||
     (device.dynamb.timestamp < dynamb.timestamp)) {
    device.dynamb.timestamp = dynamb.timestamp;
  }
}


// Remove stale data from the devices
function removeStaleDevicesData() {
  let staleTimestamp = Date.now() - CONTINUOUS_HISTORY_MILLISECONDS;

  devices.forEach((device, deviceSignature) => {
    let isStale = device.dynamb.timestamp < staleTimestamp;
    if(isStale) {
      devices.delete(deviceSignature);
    }
    else {
      for(const property in device.properties) {
        isStale = (device.properties[property].timestamp < staleTimestamp);
        if(isStale) {
          delete device.properties[property];
          delete device.dynamb[property];
        }
      }
    }
  });

  setTimeout(removeStaleDevicesData, CONTINUOUS_UPDATE_MILLISECONDS);
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
