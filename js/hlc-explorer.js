/**
 * Copyright reelyActive 2021
 * We believe in an open Internet of Things
 */


// Constants
const STATUS_OK = 200;
const SIGNATURE_SEPARATOR = '/';
const DIRECTORY_SEPARATOR = ':';
const POLLING_INTERVAL_MILLISECONDS = 10000;
const CONTEXT_ROUTE = '/context';
const DEVICE_ROUTE = '/device';
const DIRECTORY_ROUTE = '/directory';
const TAG_ROUTE = '/tag';
const UPDATES_SEARCH_PARAMETER = 'updates';
const MAX_RSSI = -30;
const HLC_MIN_HEIGHT_PX = 480;
const HLC_UNUSABLE_HEIGHT_PX = 120;
const COSE_LAYOUT_OPTIONS = {
    name: "cose",
    animate: false,
    randomize: false,
    idealEdgeLength: function(edge) { return MAX_RSSI - edge.data('rssi'); },
    edgeElasticity: function(edge) { return 32 *
                                           (MAX_RSSI - edge.data('rssi')); },
    initialTemp: 40
};
const GRAPH_STYLE = [
    { selector: "node",
      style: { label: "data(name)", "font-size": "0.6em",
               "min-zoomed-font-size": "16px" } },
    { selector: "node[image]",
      style: { "background-image": "data(image)", "border-color": "#83b7d0",
               "background-fit": "cover cover", "border-width": "2px" } },
    { selector: "edge", style: { "curve-style": "haystack",
                                 "line-color": "#ddd", label: "data(name)",
                                 "text-rotation": "autorotate",
                                 color: "#5a5a5a", "font-size": "0.25em",
                                 "min-zoomed-font-size": "12px" } },
    { selector: ".cyDeviceNode",
      style: { "background-color": "#83b7d0", "border-color": "#83b7d0" } },
    { selector: ".cyAnchorNode",
      style: { "background-color": "#0770a2", "border-color": "#0770a2" } },
    { selector: ".cySelectedNode",
      style: { "background-color": "#ff6900", "border-color": "#ff6900" } }
];

// DOM elements
let connection = document.querySelector('#connection');
let reinitialise = document.querySelector('#reinitialise');
let noUpdates = document.querySelector('#settingsNoUpdates');
let realTimeUpdates = document.querySelector('#settingsRealTimeUpdates');
let periodicUpdates = document.querySelector('#settingsPeriodicUpdates');
let searchRoute = document.querySelector('#searchRoute');
let offcanvas = document.querySelector('#offcanvas');
let offcanvasTitle = document.querySelector('#offcanvasTitle');
let offcanvasBody = document.querySelector('#offcanvasBody');
let storyDisplay = document.querySelector('#storyDisplay');
let focusId = document.querySelector('#focusId');
let focusTagsList = document.querySelector('#focusTagsList');
let focusDirectoriesList = document.querySelector('#focusDirectoriesList');
let dynambDisplay = document.querySelector('#dynambDisplay');

// Other variables
let baseUrl = window.location.protocol + '//' + window.location.hostname +
              ':' + window.location.port;
let selectedRoute = CONTEXT_ROUTE;
let isPollPending = false;
let pollingInterval;
let bsOffcanvas = new bootstrap.Offcanvas(offcanvas);
let selectedDeviceSignature;
let devices = {};
let isFocusId;
let socket;
let cy;
let layout;

// Initialise based on URL search parameters, if any
let searchParams = new URLSearchParams(location.search);
let hasUpdatesSearch = searchParams.has(UPDATES_SEARCH_PARAMETER);


// Monitor reinitialisation button
reinitialise.onclick = init;

// Monitor each settings radio button
noUpdates.onchange = updateUpdates;
realTimeUpdates.onchange = updateUpdates;
periodicUpdates.onchange = updateUpdates;

// Monitor button clicks to change focus
focusId.onclick = updateQuery;

// Monitor offcanvas hide/close
offcanvas.addEventListener('hidden.bs.offcanvas', handleOffcanvasHide);


// Initialisation: poll the context once and display the result
init(true);


// Initialise to full context, no polling
function init(isInitialPageLoad) {
  if(socket) { socket.disconnect(); }

  if((isInitialPageLoad === true) && hasUpdatesSearch) {
    let selectedUpdates = searchParams.get(UPDATES_SEARCH_PARAMETER);

    if(selectedUpdates === 'periodic') {
      noUpdates.checked = false;
      realTimeUpdates.checked = false;
      periodicUpdates.checked = true;
    }
    else if(selectedUpdates === 'realtime') {
      noUpdates.checked = false;
      realTimeUpdates.checked = true;
      periodicUpdates.checked = false;
    }
  }
  else {
    noUpdates.checked = true;
    realTimeUpdates.checked = false;
    periodicUpdates.checked = false;
    realTimeUpdates.disabled = true;
  }

  selectedRoute = CONTEXT_ROUTE;
  searchRoute.textContent = selectedRoute;
  selectedDeviceSignature = null;
  isFocusId = false;
  isPollPending = false;
  bsOffcanvas.hide();

  updateUpdates();

  if(noUpdates.checked) {
    pollAndDisplay();
  }
}


// GET the devices and display in DOM
function pollAndDisplay() {
  if(!isPollPending) {
    isPollPending = true;

    getContext(baseUrl + selectedRoute, function(status, response) {
      let statusIcon = createElement('i', 'fas fa-cloud text-danger');
      devices = response.devices || {};
      isPollPending = false;

      if(status === STATUS_OK) {
        statusIcon = createElement('i', 'fas fa-cloud text-success');
        setContainerHeight();
        renderHyperlocalContext();
        fetchStories();
      }
      else {
        connection.hidden = false;
      }

      connection.replaceChildren(statusIcon);
    });
  }
}


// GET the context
function getContext(url, callback) {
  let httpRequest = new XMLHttpRequest();

  httpRequest.onreadystatechange = function() {
    if(httpRequest.readyState === XMLHttpRequest.DONE) {
      return callback(httpRequest.status,
                      JSON.parse(httpRequest.responseText));
    }
  };
  httpRequest.open('GET', url);
  httpRequest.setRequestHeader('Accept', 'application/json');
  httpRequest.send();
}


// Create and manage a socket.io connection
function createSocket() {
  socket = io(baseUrl + selectedRoute);

  socket.on('connect', function() {
    connection.replaceChildren(createElement('i', 'fas fa-cloud text-success'));
  });

  socket.on('devices', function(updatedDevices) {
    devices = updatedDevices;
    renderHyperlocalContext();
  });

  socket.on('dynamb', function(dynamb) {
    let signature = dynamb.deviceId + SIGNATURE_SEPARATOR + dynamb.deviceIdType;
    if(signature === selectedDeviceSignature) {
      let dynambContent = cuttlefishDynamb.render(dynamb);
      dynambDisplay.replaceChildren(dynambContent);
    }
  });

  socket.on('connect_error', function() {
    connection.replaceChildren(createElement('i', 'fas fa-cloud text-danger'));
  });

  socket.on('disconnect', function() {
    connection.replaceChildren(createElement('i', 'fas fa-cloud text-warning'));
  });
}


// Update the API query/method based on user selection
function updateQuery(event) {
  if(socket) { socket.disconnect(); }

  switch(event.currentTarget.id) {
    case 'focusId':
      selectedRoute = CONTEXT_ROUTE + DEVICE_ROUTE + '/' +
                      selectedDeviceSignature;
      isFocusId = true;
      if(realTimeUpdates.checked) { createSocket(); }
      break;
    case 'focusTag':
      let tag = event.currentTarget.textContent;
      selectedRoute = CONTEXT_ROUTE + TAG_ROUTE + '/' + tag;
      isFocusId = false;
      break;
    case 'focusDirectory':
      let directory = event.currentTarget.textContent;
      selectedRoute = CONTEXT_ROUTE + DIRECTORY_ROUTE + '/' + directory;
      isFocusId = false;
      break;
  }

  searchRoute.textContent = selectedRoute;
  realTimeUpdates.disabled = false;
  pollAndDisplay();
}


// Update the update method
function updateUpdates(event) {
  if(noUpdates.checked) {
    connection.hidden = true;
    if(socket) { socket.disconnect(); }
    clearInterval(pollingInterval);
  }

  if(realTimeUpdates.checked) { 
    connection.hidden = false;
    clearInterval(pollingInterval);
    createSocket();
  }

  if(periodicUpdates.checked) {
    connection.hidden = true;
    if(socket) { socket.disconnect(); }
    pollAndDisplay();
    pollingInterval = setInterval(pollAndDisplay,
                                  POLLING_INTERVAL_MILLISECONDS);
  }

  updateSearchString();
}


// Fetch stories from devices with URIs
function fetchStories() {
  for(const deviceSignature in devices) {
    let device = devices[deviceSignature];
    let url = device.url;

    if(!url && device.hasOwnProperty('statid')) {
      url = device.statid.uri;
    }

    if(url) {
      cormorant.retrieveStory(url, function(story) {
        let isExistingNode = (cy.getElementById(deviceSignature).size() > 0);
        if(story && isExistingNode) {
          let node = cy.getElementById(deviceSignature);
          let name = cuttlefishStory.determineTitle(story);
          let imageUrl = cuttlefishStory.determineImageUrl(story);

          node.data('name', name);
          if(imageUrl) { node.data('image', imageUrl); }
        }
      });
    }
  }
}


// Retrieve the device story if already fetched by cormorant
function retrieveDeviceStory(device) {
  if(device.url && cormorant.stories[device.url]) {
    return cormorant.stories[device.url];
  }

  if(device.hasOwnProperty('statid') && device.statid.uri &&
     cormorant.stories[device.statid.uri]) {
    return cormorant.stories[device.statid.uri];
  }

  return null;
}


// Add a device node to the hyperlocal context graph
function addDeviceNode(deviceSignature, device) {
  let name = determineDeviceName(device);
  let imageUrl;
  let story = retrieveDeviceStory(device);

  if(story) {
    name = cuttlefishStory.determineTitle(story) || name;
    imageUrl = cuttlefishStory.determineImageUrl(story);
  }

  let isAnchor = device.hasOwnProperty('position') &&
                 Array.isArray(device.position) &&
                 (device.position.length >= 2) &&
                 (typeof device.position[0] === 'number') &&
                 (typeof device.position[1] === 'number');
  let nodeClass = isAnchor ? 'cyAnchorNode' : 'cyDeviceNode';
  let isExistingNode = (cy.getElementById(deviceSignature).size() > 0);

  if(!isExistingNode && !isAnchor) {
    cy.add({ group: "nodes", data: { id: deviceSignature } });
  }
  else if(!isExistingNode) {
    cy.add({ group: "nodes", data: { id: deviceSignature,
                                     position: { x: device.position[0],
                                                 y: device.position[1] } } });
  }

  let node = cy.getElementById(deviceSignature);
  node.data('name', name);
  node.addClass(nodeClass);
  if(imageUrl) { node.data('image', imageUrl); }

  if(device.hasOwnProperty('nearest')) {
    device.nearest.forEach(function(entry) {
      let peerSignature = entry.device;
      let edgeSignature = deviceSignature + '@' + peerSignature;
      let isExistingEdge = (cy.getElementById(edgeSignature).size() > 0);
      isExistingNode = (cy.getElementById(peerSignature).size() > 0);

      if(!isExistingNode) {
        cy.add({ group: "nodes", data: { id: peerSignature } });
      }
      if(!isExistingEdge) {
        cy.add({ group: "edges", data: { id: edgeSignature,
                                         source: deviceSignature,
                                         target: peerSignature,
                                         name: entry.rssi + "dBm",
                                         rssi: entry.rssi } });
      }
    });
  }
}


// Determine the name of the device, if any
function determineDeviceName(device) {
  if(device.hasOwnProperty('directory')) {
    return device.directory;
  }

  if(device.hasOwnProperty('statid') && device.statid.hasOwnProperty('name')) {
    return device.statid.name;
  }

  if(device.hasOwnProperty('tags') && Array.isArray(device.tags)) {
    return device.tags[0];
  }

  if(device.hasOwnProperty('position')) {
    return device.position;
  }

  return '';
}


// Update the offcanvas body based on the selected device
function updateOffcanvasBody(device) {
  let dropdownItems = new DocumentFragment();
  let dynambContent = new DocumentFragment();
  let statidContent = new DocumentFragment();
  let story = retrieveDeviceStory(device);

  if(story) {
    cuttlefishStory.render(story, storyDisplay);
  }
  else {
    storyDisplay.replaceChildren();
  }

  if(device.hasOwnProperty('tags') && Array.isArray(device.tags)) {
    device.tags.forEach(function(tag) {
      let li = createElement('li');
      let dropdownItem = createElement('a', 'dropdown-item', tag);
      dropdownItem.setAttribute('id', 'focusTag');
      dropdownItem.onclick = updateQuery;
      li.appendChild(dropdownItem);
      dropdownItems.appendChild(li);
    });

    focusTags.removeAttribute('disabled', '');
  }
  else {
    focusTags.setAttribute('disabled', '');
  }

  focusTagsList.replaceChildren(dropdownItems);

  dropdownItems = new DocumentFragment();

  if(device.hasOwnProperty('directory')) {
    let directoryElements = device.directory.split(DIRECTORY_SEPARATOR);

    directoryElements.forEach(function(element, index) {
      let li = createElement('li');
      let directoryName = directoryElements[0];

      for(let cElement = 1; cElement < (directoryElements.length - index);
          cElement++) {
        directoryName += DIRECTORY_SEPARATOR + directoryElements[cElement];
      }
      let dropdownItem = createElement('a', 'dropdown-item', directoryName);
      dropdownItem.setAttribute('id', 'focusDirectory');
      dropdownItem.onclick = updateQuery;
      li.appendChild(dropdownItem);
      dropdownItems.appendChild(li);
    });

    focusDirectories.removeAttribute('disabled', '');
  }
  else {
    focusDirectories.setAttribute('disabled', '');
  }

  focusDirectoriesList.replaceChildren(dropdownItems);

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
function handleNodeTap(event) {
  let device = event.target;

  if(selectedDeviceSignature &&
     (cy.getElementById(selectedDeviceSignature).size() > 0)) {
    cy.getElementById(selectedDeviceSignature).removeClass('cySelectedNode');
  }

  selectedDeviceSignature = device.id();
  cy.getElementById(selectedDeviceSignature).addClass('cySelectedNode');
  offcanvasTitle.textContent = selectedDeviceSignature;
  updateOffcanvasBody(devices[selectedDeviceSignature]);
  bsOffcanvas.show();
}


// Handle an offcanvas hide
function handleOffcanvasHide() {
  if(!isFocusId) {
    if(selectedDeviceSignature &&
       (cy.getElementById(selectedDeviceSignature).size() > 0)) {
      cy.getElementById(selectedDeviceSignature).removeClass('cySelectedNode');
    }

    selectedDeviceSignature = null;
  }
}


// Render the hyperlocal context graph
function renderHyperlocalContext() {
  let options = {
      container: document.getElementById('cy'),
      layout: COSE_LAYOUT_OPTIONS,
      style: GRAPH_STYLE
  };
  let layoutName = 'cose';

  cy = cytoscape(options);
  layout = cy.layout({ name: layoutName, cy: cy });

  cy.on('tap', 'node', handleNodeTap);

  for(const deviceSignature in devices) {
    let device = devices[deviceSignature];

    addDeviceNode(deviceSignature, device);

    if(deviceSignature === selectedDeviceSignature) {
      updateOffcanvasBody(device);
    }
  }

  if(selectedDeviceSignature &&
     (cy.getElementById(selectedDeviceSignature).size() > 0)) {
    cy.getElementById(selectedDeviceSignature).addClass('cySelectedNode');
  }

  layout.stop();
  layout = cy.elements().makeLayout(options.layout);
  layout.run();
}


// Update the search string
function updateSearchString() {
  let searchString = new URLSearchParams();

  if(realTimeUpdates.checked) { 
    searchString.append(UPDATES_SEARCH_PARAMETER, 'realtime');
  }
  else if(periodicUpdates.checked) {
    searchString.append(UPDATES_SEARCH_PARAMETER, 'periodic');
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


renderHyperlocalContext();