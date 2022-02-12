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
let chairsoccupied = document.querySelector('#chairsoccupied');
let chairsavailable = document.querySelector('#chairsavailable');
let desksoccupied = document.querySelector('#desksoccupied');
let desksavailable = document.querySelector('#desksavailable');
let roomsoccupied = document.querySelector('#roomsoccupied');
let roomsavailable = document.querySelector('#roomsavailable');
let time = document.querySelector('#time');

// Other variables
let occupancyCompilation = new Map();
let assetStatus = { chairsOccupied: 0, chairsAvailable: 0,
                    desksoccupied: 0, desksAvailable: 0,
                    roomsOccupied: 0, roomsAvailable: 0 };


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
      status = { current: isMotionDetected,
                 previous: [ null, null, null ],
                 tags: [] };
      retrieveMetadata(deviceSignature);
    }

    updateOccupancyRow(status, deviceSignature);
    occupancyCompilation.set(deviceSignature, status);
  }
}


// Retrieve the associations and story, if any, for the given device
function retrieveMetadata(deviceSignature) {
  cormorant.retrieveAssociations(baseUrl, deviceSignature, true,
                                 function(associations, story) {
    if(associations) { 
      let status = occupancyCompilation.get(deviceSignature) ||
                   { current: null, previous: [ null, null, null ], tags: [] };

      if(Array.isArray(associations.tags)) {
        if(associations.tags.includes('chair')) { status.tags.push('chair'); }
        if(associations.tags.includes('desk')) { status.tags.push('desk'); }
        if(associations.tags.includes('room')) { status.tags.push('room'); }
      }

      if(story) {
        status.title = cuttlefishStory.determineTitle(story) || deviceSignature;
      }

      occupancyCompilation.set(deviceSignature, status);
    }
  });
}


// Compile statistics, update time and display
function update() {
  time.textContent = new Date().toLocaleTimeString([], TIME_OPTIONS);

  updateCompilation();
  updateDisplay();

  let millisecondsToNextMinute = 60000 - (Date.now() % 60000);
  setTimeout(update, millisecondsToNextMinute);
}


// Update isMotionDetected samples and chair/desk/room stats
function updateCompilation() {
  assetStatus.chairsOccupied = 0;
  assetStatus.chairsAvailable = 0;
  assetStatus.desksOccupied = 0;
  assetStatus.desksAvailable = 0;
  assetStatus.roomsOccupied = 0;
  assetStatus.roomsAvailable = 0;

  occupancyCompilation.forEach((status, deviceSignature) => {
    if(status.current === true) {
      if(status.tags.includes('chair')) { assetStatus.chairsOccupied++; }
      if(status.tags.includes('desk')) { assetStatus.desksOccupied++; }
      if(status.tags.includes('room')) { assetStatus.roomsOccupied++; }   
    }
    else if(status.current === false) {
      if(status.tags.includes('chair')) { assetStatus.chairsAvailable++; }
      if(status.tags.includes('desk')) { assetStatus.desksAvailable++; }
      if(status.tags.includes('room')) { assetStatus.roomsAvailable++; }   
    }
    status.previous.pop();
    status.previous.unshift(status.current);
    status.current = null;
  });
}


// Update the compilation display
function updateDisplay() {
  occupancyCompilation.forEach(updateOccupancyRow);

  let totalChairs = assetStatus.chairsOccupied + assetStatus.chairsAvailable;
  let totalDesks = assetStatus.desksOccupied + assetStatus.desksAvailable;
  let totalRooms = assetStatus.roomsOccupied + assetStatus.roomsAvailable;

  if(totalChairs === 0) {
    chairsoccupied.setAttribute('style', 'width:0%;');
    chairsavailable.setAttribute('style', 'width:0%;');
  }
  else {
    let occupied = Math.round(100 * assetStatus.chairsOccupied / totalChairs); 
    let available = Math.round(100 * assetStatus.chairsAvailable / totalChairs);
    chairsoccupied.setAttribute('style', 'width:' + occupied + '%;');
    chairsavailable.setAttribute('style', 'width:' + available + '%;');
  }
  chairsoccupied.textContent = assetStatus.chairsOccupied;
  chairsavailable.textContent = assetStatus.chairsAvailable;

  if(totalDesks === 0) {
    desksoccupied.setAttribute('style', 'width:0%;');
    desksavailable.setAttribute('style', 'width:0%;');
  }
  else {
    let occupied = Math.round(100 * assetStatus.desksOccupied / totalDesks); 
    let available = Math.round(100 * assetStatus.desksAvailable / totalDesks);
    desksoccupied.setAttribute('style', 'width:' + occupied + '%;');
    desksavailable.setAttribute('style', 'width:' + available + '%;');
  }
  desksoccupied.textContent = assetStatus.desksOccupied;
  desksavailable.textContent = assetStatus.desksAvailable;

  if(totalRooms === 0) {
    roomsoccupied.setAttribute('style', 'width:0%;');
    roomsavailable.setAttribute('style', 'width:0%;');
  }
  else {
    let occupied = Math.round(100 * assetStatus.roomsOccupied / totalRooms); 
    let available = Math.round(100 * assetStatus.roomsAvailable / totalRooms);
    roomsoccupied.setAttribute('style', 'width:' + occupied + '%;');
    roomsavailable.setAttribute('style', 'width:' + available + '%;');
  }
  roomsoccupied.textContent = assetStatus.roomsOccupied;
  roomsavailable.textContent = assetStatus.roomsAvailable;
}


// Update (or create) a single occupancy row
function updateOccupancyRow(status, deviceSignature) {
  let tr = document.getElementById(deviceSignature);

  if(tr) {
    let tds = tr.getElementsByTagName('td');

    if(status.title) {
      tds[0].replaceChildren(status.title);
    }
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
      createElement('td', null, status.title || deviceSignature),
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