/**
 * Copyright reelyActive 2026
 * We believe in an open Internet of Things
 */


// Constants
const DEMO_SEARCH_PARAMETER = 'demo';
const DEFAULT_BLE_URI = 'https://sniffypedia.org/Product/Any_BLE-Device/';

// DOM elements
let connectIcon = document.querySelector('#connectIcon');
let demoalert = document.querySelector('#demoalert');
let novelCount = document.querySelector('#novelCount');
let deviceCount = document.querySelector('#deviceCount');
let bletbody = document.querySelector('#bletbody');
let offcanvas = document.querySelector('#offcanvas');
let offcanvasTitle = document.querySelector('#offcanvasTitle');
let offcanvasBody = document.querySelector('#offcanvasBody');
let packetsDisplay = document.querySelector('#packetsDisplay');

// Other variables
let novelDevices = new Map();
let displayedDevices = new Map();
let bsOffcanvas = new bootstrap.Offcanvas(offcanvas);
let selectedDeviceSignature;

// Initialise based on URL search parameters, if any
let searchParams = new URLSearchParams(location.search);
let isDemo = searchParams.has(DEMO_SEARCH_PARAMETER);
let baseUrl = window.location.protocol + '//' + window.location.hostname + ':' +
              window.location.port;

// Handle beaver events
beaver.on('connect', handleConnect);
beaver.on('appearance', handleAppearance);
beaver.on('raddec', handleRaddec);
beaver.on('stats', (stats) => { deviceCount.textContent = beaver.devices.size });
beaver.on('disappearance', handleDisappearance);
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

// Handle an appearance
function handleAppearance(deviceSignature, device) {
  let isNovelDevice = (device.statid?.uri === DEFAULT_BLE_URI);

  if(isNovelDevice) {
    updateNovelDevice(deviceSignature, device.raddec);
  }

  deviceCount.textContent = beaver.devices.size;
}

// Handle a radio decoding
function handleRaddec(raddec) {
  let deviceSignature = raddec.transmitterId + '/' + raddec.transmitterIdType;
  let device = beaver.devices.get(deviceSignature);
  let isNovelDevice = (device.statid?.uri === DEFAULT_BLE_URI);

  if(isNovelDevice) {
    updateNovelDevice(deviceSignature, raddec);
  }
  else if(novelDevices.has(deviceSignature)) {
    removeNovelDevice(deviceSignature);
  }
}

// Handle a disappearance
function handleDisappearance(deviceSignature) {
  if(novelDevices.has(deviceSignature)) {
    removeNovelDevice(deviceSignature);
  }

  deviceCount.textContent = beaver.devices.size;
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

// Handle device click
function handleDeviceClick(deviceSignature) {
  selectedDeviceSignature = deviceSignature;
  offcanvasTitle.textContent = selectedDeviceSignature;
  updateOffcanvasBody(selectedDeviceSignature);
  bsOffcanvas.show();
}

// Update a novel device
function updateNovelDevice(deviceSignature, raddec) {
  let identifiers = novelDevices.get(deviceSignature) || {};
  updateIdentifiers(raddec, identifiers);

  novelDevices.set(deviceSignature, identifiers);

  let tr = displayedDevices.get(deviceSignature);
  if(tr) {
    updateRow(tr, identifiers);
  }
  else {
    tr = createRow(deviceSignature, identifiers);
    displayedDevices.set(deviceSignature, tr);
    bletbody.appendChild(tr);
  }

  novelCount.textContent = displayedDevices.size;
}

// Remove a novel device
function removeNovelDevice(deviceSignature) {
  let tr = displayedDevices.get(deviceSignature);
  bletbody.removeChild(tr);
  displayedDevices.delete(deviceSignature);
  novelDevices.delete(deviceSignature);
  novelCount.textContent = displayedDevices.size;
}

// Update identifiers
function updateIdentifiers(raddec, identifiers) {
  if(Array.isArray(raddec?.packets)) {
    raddec.packets.forEach((packet) => {
      mergeIdentifiers(identifiers, determineIdentifiers(packet));
    });
  }
}

// Merge identifiers
function mergeIdentifiers(targetIdentifiers, sourceIdentifiers) {
  for(identifierType in sourceIdentifiers) {
    let sourceIdentifier = sourceIdentifiers[identifierType];

    if(targetIdentifiers.hasOwnProperty(identifierType)) {
      let targetIdentifier = targetIdentifiers[identifierType];
      sourceIdentifier.forEach((identifier) => {
        if(!targetIdentifier.includes(identifier)) {
          targetIdentifier.push(identifier);
        }
      });
    }
    else {
      targetIdentifiers[identifierType] = sourceIdentifier;
    }
  }
}

// Determine identifiers
function determineIdentifiers(packet) {
  let identifiers = {};
  let advData = packet.substring(16);
  let gapElements = determineGapElements(advData);

  gapElements.forEach((gapElement) => {
    let flag = gapElement.substring(2, 4);
    let data = gapElement.substring(4);
    let identifier = interpretGapElement(flag, data);

    mergeIdentifiers(identifiers, identifier);
  });

  return identifiers;
}

// Determine the GAP elements
function determineGapElements(advData) {
  let gapElements = [];
  let index = 0;

  while(advData.length > (index + 2)) {
    let length = parseInt(advData.substring(index, index + 2), 16);
    let nextIndex = index + 2 + (length * 2);

    if(length < 2) { return []; }

    gapElements.push(advData.substring(index, nextIndex));
    index = nextIndex;
  }

  return gapElements;
}

// Interpret the given GAP element
function interpretGapElement(flag, data) {
  switch(flag) {
    case '02':
    case '03':
      return { uuid16: [ reendify(data, 2) ] };
    case '06':
    case '07':
      return { uuid128: [ reendify(data, 16) ] };
    case '08':
    case '09':
      let nameBytes = new Uint8Array(data.length / 2);
      for(let i = 0; i < data.length; i += 2) {
        nameBytes[i / 2] = parseInt(data.substr(i, 2), 16);
      }
      let name = new TextDecoder().decode(nameBytes);
      return { name: [ name ] };
    case '16':
      return { uuid16: [ reendify(data, 2) ] };
    case 'ff':
      return { companyCode: [ reendify(data, 2) ] };
    default:
      return {};
  }
}

// Reverse the endianness
function reendify(data, numberOfBytes) {
  let reendified = '';

  for(let index = (numberOfBytes * 2) - 2; index >= 0; index -= 2) {
    reendified += data.substring(index, index + 2);
  }

  return reendified;
}

// Create the table row
function createRow(signature, identifiers) {
  let tds = [];
  tds.push(createElement('td', null, createDeviceSignature(signature)));
  tds.push(createElement('td', null, identifiers.name || ''));
  tds.push(createElement('td', null, identifiers.companyCode || ''));
  tds.push(createElement('td', null, identifiers.uuid16 || ''));
  tds.push(createElement('td', null, identifiers.uuid128 || ''));

  return createElement('tr', null, tds);
}

// Create the device signature
function createDeviceSignature(signature) {
  let a = createElement('a', 'font-monospace text-decoration-none', signature);

  a.addEventListener('click', (event) => { handleDeviceClick(signature); });

  return a;
}

// Update the given table row
function updateRow(deviceRow, identifiers) {
  deviceRow.childNodes[1].textContent = identifiers.name || '';
  deviceRow.childNodes[2].textContent = identifiers.companyCode || '';
  deviceRow.childNodes[3].textContent = identifiers.uuid16 || '';
  deviceRow.childNodes[4].textContent = identifiers.uuid128 || '';
}

// Update the offcanvas body based on the selected device
function updateOffcanvasBody(deviceSignature) {
  let device = beaver.devices.get(deviceSignature) || {};
  let packets = device?.raddec?.packets || [];

  packetsDisplay.textContent = '';
  packets.forEach((packet) => {
    packetsDisplay.textContent += packet + '\r\n';
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
