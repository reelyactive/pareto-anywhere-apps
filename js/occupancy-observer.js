/**
 * Copyright reelyActive 2022
 * We believe in an open Internet of Things
 */


// Constants
const DYNAMB_ROUTE = '/devices/dynamb';
const SIGNATURE_SEPARATOR = '/';
const TIME_OPTIONS = { hour: "2-digit", minute: "2-digit", hour12: false };

// DOM elements
let connection = document.querySelector('#connection');
let occupancytable = document.querySelector('#occupancytable');
let time = document.querySelector('#time');

// Other variables
let occupancyCompilation = new Map();


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


// Handle a dynamb event
function handleDynamb(dynamb) {
  let deviceSignature = dynamb.deviceId + SIGNATURE_SEPARATOR +
                        dynamb.deviceIdType;

  if(dynamb.hasOwnProperty('isMotionDetected')) {
    let status = occupancyCompilation.get(deviceSignature);
    let isMotionDetected = dynamb.isMotionDetected.includes(true);

    if(status) {
      status.current = isMotionDetected;
    }
    else {
      status = { current: isMotionDetected, previous: [ null, null, null ] };
    }

    updateOccupancyRow(status, deviceSignature);
    occupancyCompilation.set(deviceSignature, status);
  }
}


// Compile statistics, update time and display
function update() {
  time.textContent = new Date().toLocaleTimeString([], TIME_OPTIONS);

  updateCompilation();
  updateDisplay();

  let millisecondsToNextMinute = 60000 - (Date.now() % 60000);
  setTimeout(update, millisecondsToNextMinute);
}


// Remove stale samples from the dynamb compilation
function updateCompilation() {
  occupancyCompilation.forEach((status, deviceSignature) => {
    status.previous.pop();
    status.previous.unshift(status.current);
    status.current = null;
  });
}


// Update the compilation display
function updateDisplay() {
  occupancyCompilation.forEach(updateOccupancyRow);
}


// Update (or create) a single occupancy row
function updateOccupancyRow(status, deviceSignature) {
  let tr = document.getElementById(deviceSignature);

  if(tr) {
    let tds = tr.getElementsByTagName('td');

    if(status.current !== null) {
      tds[1].replaceChildren(createOccupancyIcon(status.current));
    }
    else {
      tds[1].replaceChildren();
    }
    tds[2].replaceChildren(createOccupancyIcon(status.previous[0]));
    tds[3].replaceChildren(createOccupancyIcon(status.previous[1]));
    tds[4].replaceChildren(createOccupancyIcon(status.previous[2]));
  }
  else {
    let tds = [
      createElement('td', null, deviceSignature),
      createElement('td', 'animate-breathing',
                    createOccupancyIcon(status.current)),
      createElement('td', 'table-info',
                    createOccupancyIcon(status.previous[0])),
      createElement('td', null, createOccupancyIcon(status.previous[1])),
      createElement('td', null, createOccupancyIcon(status.previous[2]))
    ];
    tr = createElement('tr', null, tds);
    tr.setAttribute('id', deviceSignature);
    occupancytable.appendChild(tr);
  }
}


// Create an icon depending on whether true, false or null
function createOccupancyIcon(isMotionDetected) {
  let iconClass;

  switch(isMotionDetected) {
    case true:
      iconClass = 'fas fa-walking text-secondary';
      break;
    case false:
      iconClass = 'fas fa-times-circle text-success';
      break;
    default:
      iconClass = 'fas fa-question-circle text-light';
  }

  return createElement('i', iconClass);
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