/**
 * Copyright reelyActive 2021-2023
 * We believe in an open Internet of Things
 */


// Constant definitions
const DEMO_SEARCH_PARAMETER = 'demo';
const HLC_MIN_HEIGHT_PX = 480;
const HLC_UNUSABLE_HEIGHT_PX = 120;
const POLL_MILLISECONDS = 10000;
const TIME_OPTIONS = { hour12: false };
const CONTEXT_ROUTE = '/context';
const DEVICE_ROUTE = '/device';
const DIRECTORY_ROUTE = '/directory';
const TAG_ROUTE = '/tag';
const ASSOCIATIONS_ROUTE = '/associations';
const URL_ROUTE = '/url';
const TAGS_ROUTE = '/tags';
const POSITION_ROUTE = '/position';
const STORIES_ROUTE = '/stories';
const IMAGES_ROUTE = '/store/images';
const UPDATES_SEARCH_PARAMETER = 'updates';


// DOM elements
let connectIcon = document.querySelector('#connectIcon');
let demoalert = document.querySelector('#demoalert');
let reinitialise = document.querySelector('#reinitialise');
let enablePollingSwitch = document.querySelector('#enablePollingSwitch');
let enablePollingMessage = document.querySelector('#enablePollingMessage');
let intervalValue = document.querySelector('#intervalValue');
let intervalRange = document.querySelector('#intervalRange');
let searchRoute = document.querySelector('#searchRoute');
let time = document.querySelector('#time');
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
let target = document.getElementById('cy');

// Other variables
let baseUrl = window.location.protocol + '//' + window.location.hostname +
              ':' + window.location.port;
let selectedRoute = CONTEXT_ROUTE;
let isPollPending = false;
let pollingInterval;
let bsOffcanvas = new bootstrap.Offcanvas(offcanvas);
let selectedDeviceSignature;
let storyImageData;
let streams = {};


// Initialise based on URL search parameters, if any
let searchParams = new URLSearchParams(location.search);
let hasUpdatesSearch = searchParams.has(UPDATES_SEARCH_PARAMETER);
let isDemo = searchParams.has(DEMO_SEARCH_PARAMETER);

setContainerHeight();

// Demo mode: update connection status
if(isDemo) {
  let demoIcon = createElement('b', 'animate-breathing text-success', 'DEMO');
  connectIcon.replaceChildren(demoIcon);
}

// Initialise charlotte and handle node taps
charlotte.init(target, { digitalTwins: cormorant.digitalTwins });
charlotte.on('tap', handleNodeTap);

// Handle beaver events
beaver.on('connect', () => {
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-success'));
});
beaver.on('poll', () => {
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-success'));
  displayDevices(beaver.devices);
  isPollPending = false;
});
beaver.on('dynamb', displayDynamb);
beaver.on('error', () => {
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-danger'));
  demoalert.hidden = false;
});


// Monitor buttons
reinitialise.onclick = init;
createStory.onclick = createAndAssociateStory;

// Monitor updates controls
enablePollingSwitch.onchange = updateUpdates;
intervalRange.onchange = updateUpdates;


// Initialisation: poll the context once and display the result
init(true);


// Initialise to full context, polling
function init(isInitialPageLoad) {
  if(streams.socket) { streams.socket.disconnect(); }

  if((isInitialPageLoad === true) && hasUpdatesSearch) {
    let selectedUpdates = searchParams.get(UPDATES_SEARCH_PARAMETER);

    if(selectedUpdates === 'none') {
      enablePollingSwitch.checked = false;
      pollAndDisplay(); // Just once
    }
  }
  else {
    enablePollingSwitch.checked = true;
  }

  selectedRoute = CONTEXT_ROUTE;
  searchRoute.textContent = selectedRoute;
  selectedDeviceSignature = null;
  isPollPending = false;
  bsOffcanvas.hide();

  updateUpdates();
}


// GET the devices and display in DOM
function pollAndDisplay() {
  if(!isPollPending) {
    isPollPending = true;

    if(isDemo) {
      let response = starling.getContext(selectedRoute);
      devices = new Map(Object.entries(response.devices || {}));
      isPollPending = false;
      connectIcon.hidden = false;

      setContainerHeight();
      displayDevices(devices);
    }
    else {
      let pollOptions = {};
      if(selectedDeviceSignature) {
        pollOptions.deviceSignature = selectedDeviceSignature;
        pollOptions.clearDevices = true;
      }
      beaver.poll(baseUrl, pollOptions);
      connectIcon.hidden = false;
    }
  }
}


// Display the given devices from a poll or event
function displayDevices(devices) {
  devices.forEach((device, deviceSignature) => {
    cormorant.retrieveDigitalTwin(deviceSignature, device, null,
                                  (digitalTwin, isRetrievedFromMemory) => {
      if(digitalTwin && !isRetrievedFromMemory) {
        charlotte.updateDigitalTwin(deviceSignature, digitalTwin);
      }
    });
  });
  charlotte.spin(devices, target, {});
  time.textContent = new Date().toLocaleTimeString([], TIME_OPTIONS);
}

// Display the given dynamb, if the device is selected
function displayDynamb(dynamb) {
  let deviceSignature = dynamb.deviceId + '/' + dynamb.deviceIdType;
  if(deviceSignature === selectedDeviceSignature) {
    let dynambContent = cuttlefishDynamb.render(dynamb);
    dynambDisplay.replaceChildren(dynambContent);
  }
}


// Update the API query/method based on user selection
function updateQuery() {
  if(streams.socket) { streams.socket.disconnect(); }

  selectedRoute = 'context/device/' + selectedDeviceSignature;
  searchRoute.textContent = selectedRoute;
  pollAndDisplay();
  if(!isDemo) {
    streams = beaver.stream(baseUrl, { deviceSignature: selectedDeviceSignature,
                                       io: io });
  }
}


// Update the update method
function updateUpdates() {
  clearInterval(pollingInterval);

  if(enablePollingSwitch.checked) {
    enablePollingMessage.textContent = 'Enabled';
    intervalValue.textContent = intervalRange.value;
    pollAndDisplay();
    pollingInterval = setInterval(pollAndDisplay, intervalRange.value * 1000);
    connectIcon.hidden = false;
  }
  else {
    enablePollingMessage.textContent = 'Disabled';
    if(streams.socket) { streams.socket.disconnect(); }
    connectIcon.hidden = true;
  }

  intervalRangeDisplay.hidden = !enablePollingSwitch.checked;
  updateSearchString();
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


// Handle a user tap on a specific node
function handleNodeTap(deviceSignature) {
  selectedDeviceSignature = deviceSignature;
  offcanvasTitle.textContent = selectedDeviceSignature;
  updateOffcanvasBody(selectedDeviceSignature);
  bsOffcanvas.show();
  updateQuery();
}


// Update the search string
function updateSearchString() {
  let searchString = new URLSearchParams();

  if(isDemo) {
    searchString.append(DEMO_SEARCH_PARAMETER, 'default');
  }
  if(enablePollingSwitch.checked) {
    searchString.append(UPDATES_SEARCH_PARAMETER, 'periodic');
  }
  else {
    searchString.append(UPDATES_SEARCH_PARAMETER, 'none');
  }

  let isEmptySearchString = (Array.from(searchString).length === 0);
  let url = location.pathname;

  if(!isEmptySearchString) {
    url += '?' + searchString;
  }

  history.pushState(null, '', url);
}


// Set the height of the graph container
function setContainerHeight() {
  let container = document.getElementById('cy-container');
  let height = Math.max(window.innerHeight - HLC_UNUSABLE_HEIGHT_PX,
                        HLC_MIN_HEIGHT_PX) + 'px';
  container.setAttribute('style', 'height:' + height);
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
