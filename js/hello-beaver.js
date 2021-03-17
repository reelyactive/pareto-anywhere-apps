/**
 * Copyright reelyActive 2021
 * We believe in an open Internet of Things
 */


// Constants
const SIGNATURE_SEPARATOR = '/';
const RDPS = ' / ';
const EVENT_ICONS = [
    'fas fa-sign-in-alt',
    'fas fa-route',
    'fas fa-info',
    'fas fa-heartbeat',
    'fas fa-sign-out-alt'
];

// DOM elements
let connection = document.querySelector('#connection');
let raddecs = document.querySelector('#raddecs');
let filters = [
    document.querySelector('#filterAppearances'),
    document.querySelector('#filterDisplacements'),
    document.querySelector('#filterPackets'),
    document.querySelector('#filterKeepalives'),
    document.querySelector('#filterDisappearances')
];
let progressBars = [
    document.querySelector('#progressAppearances'),
    document.querySelector('#progressDisplacements'),
    document.querySelector('#progressPackets'),
    document.querySelector('#progressKeepalives'),
    document.querySelector('#progressDisappearances')
];

// Other variables
let updateMilliseconds = 1000;
let eventCounts = [ 0, 0, 0, 0, 0 ];

// Connect to the socket.io stream and feed to beaver
let baseUrl = window.location.protocol + '//' + window.location.hostname +
              ':' + window.location.port;
let socket = io(baseUrl);
beaver.listen(socket, true);


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


// Non-disappearance events
beaver.on([ 0, 1, 2, 3 ], function(raddec) {
  raddec.events.forEach(function(event) {
    eventCounts[event]++;
  });
});


// Disappearance events
beaver.on([ 4 ], function(raddec) {
  let transmitterSignature = raddec.transmitterId + SIGNATURE_SEPARATOR +
                             raddec.transmitterIdType;
  let transmitter = document.getElementById(transmitterSignature);
  if(transmitter) {
    transmitter.remove();
  }
  eventCounts[4]++;
});


// Update the transmitters table
function updateTransmitters() {
  for(const transmitterSignature in beaver.transmitters) {
    let raddec = beaver.transmitters[transmitterSignature].raddec;
    let rec = raddec.rssiSignature.length;
    let dec = 1;
    let pac = raddec.packets.length;
    let timestamp = new Date(raddec.timestamp).toLocaleTimeString();
    let tr = document.getElementById(transmitterSignature);
    let isFiltered = false;

    raddec.rssiSignature.forEach(function(signature) {
      if(signature.numberOfDecodings > dec) {
        dec = signature.numberOfDecodings;
      }
    });
    raddec.events.forEach(function(event) {
      if(filters[event].checked) {
        isFiltered = true;
      }
    });

    // Existing transmitter
    if(tr) {
      let tds = tr.getElementsByTagName('td');
      tds[1].replaceChildren(createEventElements(raddec));
      tds[2].textContent = raddec.rssiSignature[0].receiverId;
      tds[3].textContent = raddec.rssiSignature[0].rssi;
      tds[4].textContent = rec + RDPS + dec + RDPS + pac;
      tds[5].textContent = timestamp;
      tr.style.display = (isFiltered ? '' : 'none');
    }

    // New transmitter
    else if(isFiltered) {
      tr = document.createElement('tr');
      tr.setAttribute('id', transmitterSignature);

      append(tr, 'td', raddec.transmitterId);
      append(tr, 'td', createEventElements(raddec));
      append(tr, 'td', raddec.rssiSignature[0].receiverId);
      append(tr, 'td', raddec.rssiSignature[0].rssi);
      append(tr, 'td', rec + RDPS + dec + RDPS + pac,
            'text-muted d-none d-lg-table-cell');
      append(tr, 'td', timestamp, 'd-none d-lg-table-cell');

      raddecs.appendChild(tr);
    }
  }
}


// Update the statistics progess bars
function updateStats() {
  let maxEventCount = Math.max(...eventCounts);

  progressBars.forEach(function(progressBar, index) {
    let percentWidth = Math.round(100 * (eventCounts[index] / maxEventCount));

    progressBar.textContent = eventCounts[index];
    progressBar.style.width = percentWidth + '%';
  });

  eventCounts.fill(0);
}


// Update the display
function update() {
  updateStats();
  updateTransmitters();
}


// Prepare the event icons as a DocumentFragment
function createEventElements(raddec) {
  let elements = document.createDocumentFragment();

  raddec.events.forEach(function(event) {
    let i = document.createElement('i');
    let space = document.createTextNode(' ');
    i.setAttribute('class', EVENT_ICONS[event]);
    elements.appendChild(i);
    elements.appendChild(space);
  });

  return elements;
}


// Create an element as specified
function createElement(elementName, classNames) {
  let element = document.createElement(elementName);

  if(classNames) {
    element.setAttribute('class', classNames);
  }

  return element;
}


// Create an element, as specified, and append it to the given child
function append(parent, elementName, content, classNames) {
  let element = document.createElement(elementName);

  if((content instanceof Element) || (content instanceof DocumentFragment)) {
    element.appendChild(content);
  }
  else {
    element.textContent = content;
  }

  if(classNames) {
    element.setAttribute('class', classNames);
  }

  parent.appendChild(element);
}


setInterval(update, updateMilliseconds);