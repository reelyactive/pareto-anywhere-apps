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
    { selector: "node[type='device']",
      style: { "background-color": "#83b7d0", label: "data(name)",
               "font-size": "0.6em", "min-zoomed-font-size": "16px" } },
    { selector: "node[type='anchor']",
      style: { "background-color": "#0770a2", label: "data(name)",
               "font-size": "0.6em", "min-zoomed-font-size": "16px" } },
    { selector: "node[image]",
      style: { "background-image": "data(image)", "border-color": "#aec844",
               "background-fit": "cover cover", "border-width": "2px" } },
    { selector: "edge", style: { "curve-style": "haystack",
                                 "line-color": "#ddd", label: "data(name)",
                                 "text-rotation": "autorotate",
                                 color: "#5a5a5a", "font-size": "0.25em",
                                 "min-zoomed-font-size": "12px" } },
];

// DOM elements
let connection = document.querySelector('#connection');
let noUpdates = document.querySelector('#settingsNoUpdates');
let realTimeUpdates = document.querySelector('#settingsRealTimeUpdates');
let periodicUpdates = document.querySelector('#settingsPeriodicUpdates');
let offcanvas = document.querySelector('#offcanvas');
let offcanvasTitle = document.querySelector('#offcanvasTitle');
let offcanvasBody = document.querySelector('#offcanvasBody');
let focusId = document.querySelector('#focusId');
let focusTagsList = document.querySelector('#focusTagsList');
let focusDirectoriesList = document.querySelector('#focusDirectoriesList');

// Other variables
let baseUrl = window.location.protocol + '//' + window.location.hostname +
              ':' + window.location.port;
let selectedUrl = baseUrl + CONTEXT_ROUTE;
let isPollPending = false;
let pollingInterval;
let bsOffcanvas = new bootstrap.Offcanvas(offcanvas);
let selectedDeviceSignature;
let devices = {};
let socket;
let cy;
let layout;


// Monitor each settings radio button
noUpdates.onchange = updateUpdates;
realTimeUpdates.onchange = updateUpdates;
periodicUpdates.onchange = updateUpdates;


// Monitor button clicks to change focus
focusId.onclick = updateQuery;


// Initialisation: poll the context once and display the result
pollAndDisplay();


// GET the devices and display in DOM
function pollAndDisplay() {
  if(!isPollPending) {
    isPollPending = true;

    getContext(selectedUrl, function(status, response) {
      let statusIcon = createElement('i', 'fas fa-cloud text-danger');
      devices = response.devices || {};
      isPollPending = false;

      if(status === STATUS_OK) {
        statusIcon = createElement('i', 'fas fa-cloud text-success');
        setContainerHeight();
        renderHyperlocalContext();
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
  socket = io(selectedUrl);

  socket.on('connect', function() {
    connection.replaceChildren(createElement('i', 'fas fa-cloud text-success'));
  });

  socket.on('devices', function(updatedDevices) {
    devices = updatedDevices;
    renderHyperlocalContext();
  });

  socket.on('dynamb', function(dynamb) {
    let signature = dynamb.deviceId + SIGNATURE_SEPARATOR + dynamb.deviceIdType;
    // TODO
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
  switch(event.currentTarget.id) {
    case 'focusId':
      selectedUrl = baseUrl + CONTEXT_ROUTE + DEVICE_ROUTE + '/' +
                    selectedDeviceSignature;
      break;
    case 'focusTag':
      let tag = event.currentTarget.textContent;
      selectedUrl = baseUrl + CONTEXT_ROUTE + TAG_ROUTE + '/' + tag;
      break;
    case 'focusDirectory':
      let directory = event.currentTarget.textContent;
      selectedUrl = baseUrl + CONTEXT_ROUTE + DIRECTORY_ROUTE + '/' + directory;
      break;
  }

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
}


// Add a device node to the hyperlocal context graph
function addDeviceNode(deviceSignature, device) {
  let name = determineDeviceName(device);
  let isAnchor = device.hasOwnProperty('position');
  let type = isAnchor ? 'anchor' : 'device';
  let isExistingNode = (cy.getElementById(deviceSignature).size() > 0);

  if(!isExistingNode) {
    cy.add({ group: "nodes", renderedPosition: { x: 0, y: 0 },
             data: { id: deviceSignature, type: type, name: name } });
  }
  else {
    cy.getElementById(deviceSignature).data('name', name);
    cy.getElementById(deviceSignature).data('type', type);
  }

  if(device.hasOwnProperty('nearest')) {
    device.nearest.forEach(function(entry) {
      let peerSignature = entry.device;
      let edgeSignature = deviceSignature + '@' + peerSignature;
      let isExistingEdge = (cy.getElementById(edgeSignature).size() > 0);
      isExistingNode = (cy.getElementById(peerSignature).size() > 0);

      if(!isExistingNode) {
        cy.add({ group: "nodes", data: { id: peerSignature, type: "device" } });
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
}


// Handle a user tap on a specific node
function handleNodeTap(event) {
  let device = event.target;

  selectedDeviceSignature = device.id();
  offcanvasTitle.textContent = selectedDeviceSignature;
  updateOffcanvasBody(devices[selectedDeviceSignature]);
  bsOffcanvas.show();
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
  }

  layout.stop();
  layout = cy.elements().makeLayout(options.layout);
  layout.run();
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