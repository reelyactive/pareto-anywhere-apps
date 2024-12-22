/**
 * Copyright reelyActive 2023-2024
 * We believe in an open Internet of Things
 */


// Constant definitions
const DEMO_SEARCH_PARAMETER = 'demo';
const TIME_OPTIONS = { hour: "2-digit", minute: "2-digit", second: "2-digit",
                       hour12: false };
const CLOCK_OPTIONS = { hour: "2-digit", minute: "2-digit", second: "2-digit",
                        hour12: false };

// DOM elements
let connectIcon = document.querySelector('#connectIcon');
let demoalert = document.querySelector('#demoalert');
let filterSelect = document.querySelector('#filterSelect');
let searchInput = document.querySelector('#searchInput');
let time = document.querySelector('#time');
let devicesCount = document.querySelector('#devicesCount');
let devicesTableBody = document.querySelector('#devicesTableBody');

// Other variables
let baseUrl = window.location.protocol + '//' + window.location.hostname +
              ':' + window.location.port;
let displayedDevices = new Map();

// Update clock
updateClock();

// Handle filter/seach events
filterSelect.addEventListener('change', sortDisplayedDevices);
searchInput.addEventListener('input', handleSearchInput);

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

// Update the clock to the current time
function updateClock() {
  time.textContent = new Date().toLocaleTimeString([], CLOCK_OPTIONS);
  setTimeout(updateClock, 1000 - Date.now() % 1000);
}

// Handle a device appearance
function handleAppearance(deviceSignature, device) {
  if(isPassingFilters(deviceSignature, device, null)) {
    let deviceRow = createDeviceRow(deviceSignature, device);
    deviceRow.hidden = !deviceSignature.includes(searchInput.value);
    displayedDevices.set(deviceSignature, deviceRow);
    devicesTableBody.appendChild(deviceRow);
    sortDisplayedDevices();
  }
  devicesCount.textContent = beaver.devices.size;
}

// Handle a device disappearance
function handleDisappearance(deviceSignature, device) {
  if(displayedDevices.has(deviceSignature)) {
    devicesTableBody.removeChild(displayedDevices.get(deviceSignature));
    displayedDevices.delete(deviceSignature);
  }
  devicesCount.textContent = beaver.devices.size;
}

// Handle a raddec
function handleRaddec(raddec) {
  let deviceSignature = raddec.transmitterId + '/' + raddec.transmitterIdType;

  if(displayedDevices.has(deviceSignature)) {
    updateDeviceRow(displayedDevices.get(deviceSignature),
                    beaver.devices.get(deviceSignature));
    sortDisplayedDevices();
  }
}

// Handle a dynamb
function handleDynamb(dynamb) {
  let deviceSignature = dynamb.deviceId + '/' + dynamb.deviceIdType;

  if(displayedDevices.has(deviceSignature)) {
    // TODO
  }
}

// Handle a search input
function handleSearchInput() {
  displayedDevices.forEach((row, deviceSignature) => {
    row.hidden = !deviceSignature.includes(searchInput.value);
  });
}

// Sort the displayed devices based on the filter selection
function sortDisplayedDevices() {
  if(filterSelect.value === 'none') return;

  let sortedDevices = [];

  for(const tr of devicesTableBody.childNodes) {
    if(tr.nodeType === 1) {
      sortedDevices.push(tr);
    }
  }

  sortedDevices.sort((a, b) => {
    switch(filterSelect.value) {
      case 'rssiDec':
        return (Number(b.childNodes[2].textContent) || -200) -
               (Number(a.childNodes[2].textContent) || -200);
      case 'rssiInc':
        return (Number(a.childNodes[2].textContent) || -200) -
               (Number(b.childNodes[2].textContent) || -200);
    }
  });

  sortedDevices.forEach((tr) => { devicesTableBody.appendChild(tr); });
}

// Determine if the given device and digital twin passes the specified filters
function isPassingFilters(deviceSignature, device, digitalTwin) {
  return true; // TODO: actually check
}

// Create the device row
function createDeviceRow(deviceSignature, device) {
  let isAppearance = device.raddec?.events?.includes(0);
  let tds = [];
  tds.push(createElement('td', 'font-monospace', deviceSignature));
  tds.push(createElement('td', null, createDeviceEvents(device)));
  tds.push(createElement('td', null, createDeviceRssi(device)));
  tds.push(createElement('td', 'font-monospace', createDeviceReceiver(device)));
  tds.push(createElement('td', null, createDeviceRecDecPac(device)));
  tds.push(createElement('td', 'font-monospace',
                         createDeviceTimestamp(device)));
  return createElement('tr', isAppearance ? 'table-active' : '', tds);
}

// Update the device row
function updateDeviceRow(deviceRow, device) {
  if(deviceRow.childNodes.length !== 6) {
    return; // TODO: create row anew?
  }

  let isAppearance = device.raddec?.events?.includes(0);
  let isDisplacement = device.raddec?.events?.includes(1);
  let tdEvents = createElement('td', null, createDeviceEvents(device));

  deviceRow.childNodes[1].replaceWith(tdEvents);
  deviceRow.childNodes[2].textContent = createDeviceRssi(device);
  deviceRow.childNodes[3].textContent = createDeviceReceiver(device);
  deviceRow.childNodes[4].textContent = createDeviceRecDecPac(device);
  deviceRow.childNodes[5].textContent = createDeviceTimestamp(device);
  deviceRow.setAttribute('class', isAppearance ? 'table-active' : '');
  deviceRow.childNodes[2].setAttribute('class', isDisplacement ? 'fw-bold' : '');
  deviceRow.childNodes[3].setAttribute('class', isDisplacement ?
                                                'font-monospace fw-bold' :
                                                'font-monospace');
}

// Create the device events icons
function createDeviceEvents(device) {
  let eventIcons = [];

  if(Array.isArray(device.raddec?.events)) {
    let iconClass;
    device.raddec.events.forEach((event) => {
      switch(event) {
        case 0: iconClass = 'fa-sign-in-alt me-2'; break;
        case 1: iconClass = 'fa-route me-2'; break;
        case 2: iconClass = 'fa-info me-2'; break;
        case 3: iconClass = 'fa-heartbeat me-2'; break;
        case 4: iconClass = 'fa-sign-out-alt me-2'; break;
      }
      eventIcons.push(createElement('i', 'fas ' + iconClass));
    });
  }

  return eventIcons;
}

// Create the device rssi
function createDeviceRssi(device) {
  if(Array.isArray(device.raddec?.rssiSignature) &&
     device.raddec.rssiSignature.length > 0) {
    return device.raddec.rssiSignature[0].rssi;
  }
  return '-';
}

// Create the device receiver
// TODO: receiverAntenna
function createDeviceReceiver(device) {
  if(Array.isArray(device.raddec?.rssiSignature) &&
     device.raddec.rssiSignature.length > 0) {
    return device.raddec.rssiSignature[0].receiverId + '/' +
           device.raddec.rssiSignature[0].receiverIdType;
  }
  return '-';
}

// Create the device number of receivers/decodings/packets
function createDeviceRecDecPac(device) {
  let maxNumberOfDecodings = 0;
  if(Array.isArray(device.raddec?.rssiSignature)) {
    device.raddec.rssiSignature.forEach((receiver) => {
      if(receiver.numberOfDecodings > maxNumberOfDecodings) {
        maxNumberOfDecodings = receiver.numberOfDecodings;
      }
    });
  }
  return (device.raddec?.rssiSignature?.length || '-') + ' / ' +
         ((maxNumberOfDecodings === 0) ? '-' : maxNumberOfDecodings) + ' / ' +
         (device.raddec?.packets?.length || '-');
}

// Create the device timestamp
function createDeviceTimestamp(device) {
  let timestamp = device.raddec?.timestamp || Date.now();
  return new Date(timestamp).toLocaleTimeString([], TIME_OPTIONS);
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
