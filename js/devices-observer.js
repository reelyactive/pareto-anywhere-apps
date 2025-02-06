/**
 * Copyright reelyActive 2023-2025
 * We believe in an open Internet of Things
 */


// Constant definitions
const DEMO_SEARCH_PARAMETER = 'demo';
const TIME_OPTIONS = { hour: "2-digit", minute: "2-digit", second: "2-digit",
                       hour12: false };
const CLOCK_OPTIONS = { hour: "2-digit", minute: "2-digit", second: "2-digit",
                        hour12: false };
const DIRECTORY_ROUTE = '/directory';
const TAG_ROUTE = '/tag';
const ASSOCIATIONS_ROUTE = '/associations';
const URL_ROUTE = '/url';
const TAGS_ROUTE = '/tags';
const POSITION_ROUTE = '/position';
const STORIES_ROUTE = '/stories';
const IMAGES_ROUTE = '/store/images';
const MAX_STALE_MILLISECONDS = 10000;

// DOM elements
let connectIcon = document.querySelector('#connectIcon');
let demoalert = document.querySelector('#demoalert');
let stalealert = document.querySelector('#stalealert');
let reviseTimestampsSwitch = document.querySelector('#reviseTimestampsSwitch');
let filterSelect = document.querySelector('#filterSelect');
let searchInput = document.querySelector('#searchInput');
let time = document.querySelector('#time');
let devicesCount = document.querySelector('#devicesCount');
let devicesTableBody = document.querySelector('#devicesTableBody');
let offcanvas = document.querySelector('#offcanvas');
let offcanvasTitle = document.querySelector('#offcanvasTitle');
let offcanvasBody = document.querySelector('#offcanvasBody');
let storyDisplay = document.querySelector('#storyDisplay');
let dynambDisplay = document.querySelector('#dynambDisplay');
let inputImage = document.querySelector('#inputImage');
let createStory = document.querySelector('#createStory');
let inputUrl = document.querySelector('#inputUrl');
let inputTags = document.querySelector('#inputTags');
let inputDirectory = document.querySelector('#inputDirectory');
let inputPosition = document.querySelector('#inputPosition');
let updateUrl = document.querySelector('#updateUrl');
let updateTags = document.querySelector('#updateTags');
let updateDirectory = document.querySelector('#updateDirectory');
let updatePosition = document.querySelector('#updatePosition');
let associationError = document.querySelector('#associationError');

// Other variables
let baseUrl = window.location.protocol + '//' + window.location.hostname +
              ':' + window.location.port;
let displayedDevices = new Map();
let bsOffcanvas = new bootstrap.Offcanvas(offcanvas);
let selectedDeviceSignature;

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
beaver.on('stats', (stats) => {
  let isStale = (stats.averageEventStaleMilliseconds > MAX_STALE_MILLISECONDS);
  stalealert.hidden = !isStale || reviseTimestampsSwitch.checked;
});
beaver.on('error', (error) => {
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-danger'));
  demoalert.hidden = false;
});
beaver.on('disconnect', () => {
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-warning'));
});

// Monitor buttons
createStory.onclick = createAndAssociateStory;

// Monitor options controls
reviseTimestampsSwitch.onchange = init;

// Initialise based on URL search parameters, if any
let searchParams = new URLSearchParams(location.search);
let isDemo = searchParams.has(DEMO_SEARCH_PARAMETER);
init();

// Initialise
function init() {
  beaver.reset();;
  stalealert.hidden = true;

  if(isDemo) { // Demo mode: connect to starling.js
    let demoIcon = createElement('b', 'animate-breathing text-success', 'DEMO');
    let context = starling.getContext();

    connectIcon.replaceChildren(demoIcon);
    beaver.stream(null, { io: starling, ioUrl: "http://pareto.local",
                          reviseTimestamps: reviseTimestampsSwitch.checked });

    for(let deviceSignature in context.devices) {
      let device = context.devices[deviceSignature];
      beaver.devices.set(deviceSignature, device);
      handleAppearance(deviceSignature, device);
    }
  }
  else { // Normal mode: connect to socket.io
    beaver.stream(baseUrl, { io: io, reviseTimestamps:
                                              reviseTimestampsSwitch.checked });
  }
}

// Update the clock to the current time and sort devices
function updateClock() {
  time.textContent = new Date().toLocaleTimeString([], CLOCK_OPTIONS);
  sortDisplayedDevices();
  setTimeout(updateClock, 1000 - Date.now() % 1000);
}

// Handle a device appearance
function handleAppearance(deviceSignature, device) {
  if(isPassingFilters(deviceSignature, device, null)) {
    let deviceRow = createDeviceRow(deviceSignature, device);
    deviceRow.hidden = !deviceSignature.includes(searchInput.value);
    displayedDevices.set(deviceSignature, deviceRow);
    devicesTableBody.appendChild(deviceRow);
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
  }
}

// Handle a dynamb
function handleDynamb(dynamb) {
  let deviceSignature = dynamb.deviceId + '/' + dynamb.deviceIdType;

  if(deviceSignature === selectedDeviceSignature) {
    let dynambContent = cuttlefishDynamb.render(dynamb);
    dynambDisplay.replaceChildren(dynambContent);
  }
}

// Handle a search input
function handleSearchInput() {
  displayedDevices.forEach((row, deviceSignature) => {
    row.hidden = !deviceSignature.includes(searchInput.value);
  });
}

// Handle device click
function handleDeviceClick(deviceSignature) {
  selectedDeviceSignature = deviceSignature;
  offcanvasTitle.textContent = selectedDeviceSignature;
  updateOffcanvasBody(selectedDeviceSignature);
  bsOffcanvas.show();
}

// Sort the displayed devices based on the filter selection
function sortDisplayedDevices() {
  if(filterSelect.value === 'none') return;

  let sortedDevices = [];

  for(const tr of devicesTableBody.childNodes) {
    if((tr.nodeType === 1) && (tr.hidden !== true)) {
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
  tds.push(createElement('td', null, createDeviceSignature(deviceSignature)));
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

// Create the device signature
function createDeviceSignature(signature) {
  let a = createElement('a', 'font-monospace text-decoration-none', signature);

  a.addEventListener('click', (event) => { handleDeviceClick(signature); });

  return a;
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

// Update the offcanvas body based on the selected device
function updateOffcanvasBody(deviceSignature) {
  let device = beaver.devices.get(deviceSignature) || {};
  let dropdownItems = new DocumentFragment();
  let dynambContent = new DocumentFragment();
  let statidContent = new DocumentFragment();

  if(cormorant.digitalTwins.has(deviceSignature)) {
    let story = cormorant.digitalTwins.get(deviceSignature).story;
    cuttlefishStory.render(story, storyDisplay);
  }
  else {
    storyDisplay.replaceChildren();
    cormorant.retrieveDigitalTwin(deviceSignature, device, null,
                                  (digitalTwin, isRetrievedFromMemory) => {
      cuttlefishStory.render(digitalTwin.story, storyDisplay);
    });
  }

  inputUrl.value = device.url || '';
  inputTags.value = device.tags || '';
  inputDirectory.value = device.directory || '';
  inputPosition.value = device.position || '';

  if(device.hasOwnProperty('dynamb')) {
    dynambContent = cuttlefishDynamb.render(device.dynamb);
  }
  if(device.hasOwnProperty('statid')) {
    statidContent = cuttlefishStatid.render(device.statid);
  }

  dynambDisplay.replaceChildren(dynambContent);
  statidDisplay.replaceChildren(statidContent);
}

// Create the story
function postStory(story, callback) {
  let httpRequest = new XMLHttpRequest();

  httpRequest.onreadystatechange = function() {
    if(httpRequest.readyState === XMLHttpRequest.DONE) {
      if(httpRequest.status === 201) {
        let response = JSON.parse(httpRequest.responseText);
        let storyId = Object.keys(response.stories)[0];
        let storyUrl = baseUrl + STORIES_ROUTE + '/' + storyId;
        callback(storyUrl);
      }
      else {
        callback();
      }
    }
  };
  httpRequest.open('POST', baseUrl + STORIES_ROUTE);
  httpRequest.setRequestHeader('Content-Type', 'application/json');
  httpRequest.setRequestHeader('Accept', 'application/json');
  httpRequest.send(JSON.stringify(story));
}

// Create the image
function postImage(callback) {
  let httpRequest = new XMLHttpRequest();
  let formData = new FormData();
  formData.append('image', inputImage.files[0]);

  httpRequest.onload = function(event) {
    if(httpRequest.status === 201) {
      let response = JSON.parse(httpRequest.responseText);
      let imageId = Object.keys(response.images)[0];
      let url = baseUrl + IMAGES_ROUTE + '/' + imageId;

      return callback(url);
    }
    else {
      return callback();
    } 
  };
  httpRequest.open('POST', baseUrl + IMAGES_ROUTE, true);
  httpRequest.send(formData);  
}

// Create and associate the story given in the form
function createAndAssociateStory() {
  let hasImageFile = (inputImage.files.length > 0);
  let name = inputName.value;
  let id = name.toLowerCase();
  let type = 'schema:' + inputSelectType.value;
  let story = {
      "@context": {
        "schema": "http://schema.org/"
      },
      "@graph": [
        {
          "@id": id,
          "@type": type,
          "schema:name": name
        }
      ]
  };

  if(hasImageFile) {
    postImage((imageUrl) => {
      if(imageUrl) {
        story['@graph'][0]["schema:image"] = imageUrl;
      }
      postStory(story, (storyUrl) => {
        if(storyUrl) {
          putAssociationProperty(URL_ROUTE, { url: storyUrl },
                                 handlePropertyUpdate);
          cuttlefishStory.render(story, storyDisplay);
        }
      });
    });
  }
  else {
    postStory(story, (storyUrl) => {
      if(storyUrl) {
        putAssociationProperty(URL_ROUTE, { url: storyUrl },
                               handlePropertyUpdate);
        cuttlefishStory.render(story, storyDisplay);
      }
    });
  }
}

// PUT the given association property
function putAssociationProperty(route, json, callback) {
  let url = baseUrl + ASSOCIATIONS_ROUTE + '/' + selectedDeviceSignature +
            route;
  let httpRequest = new XMLHttpRequest();
  let jsonString = JSON.stringify(json);

  associationError.hidden = true;
  httpRequest.onreadystatechange = function() {
    if(httpRequest.readyState === XMLHttpRequest.DONE) {
      if((httpRequest.status === 200) ||
         (httpRequest.status === 201)) {
        return callback(httpRequest.status,
                        JSON.parse(httpRequest.responseText));
      }
      else {
        return callback(httpRequest.status);
      }
    }
  };
  httpRequest.open('PUT', url);
  httpRequest.setRequestHeader('Content-Type', 'application/json');
  httpRequest.setRequestHeader('Accept', 'application/json');
  httpRequest.send(jsonString);
}

// Handle the update of an association property
function handlePropertyUpdate(status, response) {
  if(status === 200) {
    deviceIdSignature = Object.keys(response.associations)[0];
    let deviceAssociations = response.associations[deviceIdSignature];
    inputUrl.value = deviceAssociations.url || '';
    inputTags.value = deviceAssociations.tags || '';
    inputDirectory.value =  deviceAssociations.directory || '';
    inputPosition.value = deviceAssociations.position || '';
  }
  else if(status === 400) {
    associationErrorMessage.textContent = 'Error: Bad Request [400].';
    associationError.hidden = false;
  }
  else if(status === 404) {
    associationErrorMessage.textContent = 'Error: Not Found [404].';
    associationError.hidden = false;
  }
}

// Association update functions (by property)
let associationActions = {
    "url":
       function() {
         let json = { url: inputUrl.value };
         putAssociationProperty(URL_ROUTE, json, handlePropertyUpdate);
       },
    "tags":
       function() {
         let json = { tags: inputTags.value.split(',') };
         putAssociationProperty(TAGS_ROUTE, json, handlePropertyUpdate);
       },
    "directory":
       function() {
         let json = { directory: inputDirectory.value };
         putAssociationProperty(DIRECTORY_ROUTE, json, handlePropertyUpdate);
       },
    "position":
       function() {
         let positionArray = [];

         inputPosition.value.split(',').forEach(function(coordinate) {
           positionArray.push(parseFloat(coordinate));
         });

         let json = { position: positionArray };
         putAssociationProperty(POSITION_ROUTE, json, handlePropertyUpdate);
       }
};

updateUrl.onclick = associationActions['url'];
updateTags.onclick = associationActions['tags'];
updateDirectory.onclick = associationActions['directory'];
updatePosition.onclick = associationActions['position'];

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
