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
let dynambRate = document.querySelector('#dynambRate');
let dynambDisplay = document.querySelector('#dynambdisplay');

// Other variables
let selectedDeviceSignature;
let cormorantOptions;

// Initialise based on URL search parameters, if any
let searchParams = new URLSearchParams(location.search);
let isDemo = searchParams.has(DEMO_SEARCH_PARAMETER);
let baseUrl = window.location.protocol + '//' + window.location.hostname + ':' +
              window.location.port;

// Instantiate the devices table
let devicesTableOptions = {
  beaver: beaver,
  digitalTwins: cormorant.digitalTwins,
  isFilteredDevice: isFilteredDevice,
  isClockDisplayed: true
};
let devicesTable = new DevicesTable('#devicestable', devicesTableOptions);

// Handle beaver events
beaver.on('connect', handleConnect);
beaver.on('dynamb', handleDynamb);
beaver.on('stats', handleStats);
beaver.on('error', handleError);
beaver.on('disconnect', handleDisconnect);

// Handle devicesTable events
devicesTable.on('selection', handleSelection);

// Demo mode: connect to starling.js
if(isDemo) {
  let demoIcon = createElement('b', 'animate-breathing text-success', 'DEMO');
  connectIcon.replaceChildren(demoIcon);
  beaver.stream(null, { io: starling, ioUrl: "http://pareto.local" });
}

// Normal mode: connect to socket.io
else {
  beaver.stream(baseUrl, { io: io });
  cormorantOptions = { associationsServerUrl: baseUrl };
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
  dynambRate.textContent = stats.eventsPerSecond.dynamb.toFixed(1);
}

// Handle a dynamb event
function handleDynamb(dynamb) {
  let deviceSignature = dynamb.deviceId + '/' + dynamb.deviceIdType;
  let device = beaver.devices.get(deviceSignature);

  cormorant.retrieveDigitalTwin(deviceSignature, null, cormorantOptions,
                                (digitalTwin, isRetrievedFromMemory) => {
    if(digitalTwin && !isRetrievedFromMemory) {
      devicesTable.updateDigitalTwin(deviceSignature, digitalTwin);
    }
  });

  if(device) {
    devicesTable.insertDevice(deviceSignature, device);
  }
  if(!selectedDeviceSignature ||
     (deviceSignature === selectedDeviceSignature)) {
    cuttlefishDynamb.render(dynamb, dynambdisplay);
    message.hidden = true;
  }
}

// Handle a device selection event
function handleSelection(deviceSignature) {
  selectedDeviceSignature = deviceSignature;
  let dynamb;

  if(beaver.devices.has(selectedDeviceSignature)) {
    let selectedDevice = beaver.devices.get(selectedDeviceSignature);
    dynamb = selectedDevice.dynamb;
  }

  cuttlefishDynamb.render(dynamb || {}, dynambdisplay);
}

// Determine if the given device is passing the filter
function isFilteredDevice(device) {
  return device.hasOwnProperty('dynamb');
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
