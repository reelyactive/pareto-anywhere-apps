/**
 * Copyright reelyActive 2023
 * We believe in an open Internet of Things
 */


// Constant definitions
const DEMO_SEARCH_PARAMETER = 'demo';
const TIME_OPTIONS = { hour12: false };
const SIGNATURE_SEPARATOR = '/';
const TWIN_COLS = 'col-md-4 col-xl-3';
const RTLS_COLS = 'col-md-4 col-xl-5';
const DATA_COLS = 'col-md-4 col-xl-4';

// DOM elements
let connectIcon = document.querySelector('#connectIcon');
let demoalert = document.querySelector('#demoalert');
let time = document.querySelector('#time');
let devicesDisplay = document.querySelector('#devicesDisplay');

// Other variables
let baseUrl = window.location.protocol + '//' + window.location.hostname +
              ':' + window.location.port;
let displayedDevices = new Map();

// Handle beaver events
beaver.on('appearance', handleAppearance);
beaver.on('disappearance', handleDisappearance);
beaver.on('raddec', handleRaddec);
beaver.on('dynamb', handleDynamb);
beaver.on('connect', () => {
  if(isDemo) { return; }
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-success'));
  demoalert.hidden = true;
});
beaver.on('stats', (stats) => {});
beaver.on('error', (error) => {
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-danger'));
  demoalert.hidden = false;
});
beaver.on('disconnect', () => {
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-warning'));
});

// Initialise based on URL search parameters, if any
let searchParams = new URLSearchParams(location.search);
let isDemo = searchParams.has(DEMO_SEARCH_PARAMETER);

// Demo mode: connect to starling.js
if(isDemo) {
  let demoIcon = createElement('b', 'animate-breathing text-success', 'DEMO');
  let context = starling.getContext();

  connectIcon.replaceChildren(demoIcon);
  beaver.stream(null, { io: starling, ioUrl: "http://pareto.local" });

  for(let deviceSignature in context.devices) {
    let device = context.devices[deviceSignature];
    beaver.devices.set(deviceSignature, device);
    handleAppearance(deviceSignature, device);
  }
}

// Normal mode: connect to socket.io
else {
  beaver.stream(baseUrl, { io: io });
}

// Handle a device appearance
function handleAppearance(deviceSignature, device) {
  cormorant.retrieveDigitalTwin(deviceSignature, device, null,
                                (digitalTwin, isRetrievedFromMemory) => {
    if(isPassingFilters(deviceSignature, device, digitalTwin)) {
      let deviceDisplay = createDeviceDisplay(deviceSignature, device,
                                              digitalTwin);
      displayedDevices.set(deviceSignature, deviceDisplay);
      devicesDisplay.appendChild(deviceDisplay);
    }
  });
}

// Handle a device disappearance
function handleDisappearance(deviceSignature, device) {
  if(displayedDevices.has(deviceSignature)) {
    devicesDisplay.removeChild(displayedDevices.get(deviceSignature));
    displayedDevices.delete(deviceSignature);
  }
}

// Handle a raddec
function handleRaddec(raddec) {
  let deviceSignature = raddec.transmitterId + '/' + raddec.transmitterIdType;

  if(displayedDevices.has(deviceSignature)) {
    let rtlsContent = document.getElementById(deviceSignature + '-rtls');
    renderRssiSignature(raddec.rssiSignature, rtlsContent);
  }
}

// Handle a dynamb
function handleDynamb(dynamb) {
  let deviceSignature = dynamb.deviceId + '/' + dynamb.deviceIdType;

  if(displayedDevices.has(deviceSignature)) {
    let dataContent = document.getElementById(deviceSignature + '-data');
    cuttlefishDynamb.render(dynamb, dataContent);
  }
}

// Determine if the given device and digital twin passes the specified filters
function isPassingFilters(deviceSignature, device, digitalTwin) {
  return true; // TODO: actually check
}

// Create the device display
function createDeviceDisplay(deviceSignature, device, digitalTwin) {
  let twinContent = deviceSignature;
  if(digitalTwin) { twinContent = cuttlefishStory.render(digitalTwin.story); }
  let rtlsContent = '';
  if(device.raddec) { rtlsContent = device.raddec.rssiSignature[0]; }
  let dataContent = cuttlefishDynamb.render(device.dynamb || {});
  let twinCol = createElement('div', TWIN_COLS, twinContent);
  let rtlsCol = createElement('div', RTLS_COLS, rtlsContent);
  let dataCol = createElement('div', DATA_COLS, dataContent);
  let row = createElement('div', 'row my-4', [ twinCol, rtlsCol, dataCol ]);

  twinCol.setAttribute('id', deviceSignature + '-twin');
  rtlsCol.setAttribute('id', deviceSignature + '-rtls');
  dataCol.setAttribute('id', deviceSignature + '-data');

  return row;
}

// Render the rssiSignature
function renderRssiSignature(rssiSignature, target) {
  let table = createElement('table', 'table');

  rssiSignature.forEach((entry) => {
    let receiverSignature = entry.receiverId + '/' + entry.receiverIdType;
    let title = receiverSignature;
    let imgUrl = '';

    if(cormorant.digitalTwins.has(receiverSignature)) {
      let digitalTwin = cormorant.digitalTwins.get(receiverSignature);
      title = cuttlefishStory.determineTitle(digitalTwin.story);
      imgUrl = cuttlefishStory.determineImageUrl(digitalTwin.story);
    }

    let image = createElement('img', 'img-thumbnail');
    let tdImg = createElement('td', 'w-25', image);
    let tdTitle = createElement('td', 'lead', title);
    let tdRssi = createElement('td', 'font-monospace', [
      createElement('span', 'display-6', entry.rssi),
      createElement('span', 'text-muted', 'dBm')
    ]);
    let tr = createElement('tr', null, [ tdImg, tdTitle, tdRssi ]);

    image.setAttribute('src', imgUrl);
    table.appendChild(tr);
  });

  target.replaceChildren(table);
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
