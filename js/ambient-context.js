/**
 * Copyright reelyActive 2023
 * We believe in an open Internet of Things
 */


// Constants
const DEMO_SEARCH_PARAMETER = 'demo';


// DOM elements
let connectIcon = document.querySelector('#connectIcon');
let demoalert = document.querySelector('#demoalert');
let message = document.querySelector('#message');
let time = document.querySelector('#time');
let deviceCount = document.querySelector('#deviceCount');
let raddecRate = document.querySelector('#raddecRate');
let dynambRate = document.querySelector('#dynambRate');


// Other variables
let baseUrl = window.location.protocol + '//' + window.location.hostname +
              ':' + window.location.port;
let cormorantOptions;

// Initialise based on URL search parameters, if any
let searchParams = new URLSearchParams(location.search);
let isDemo = searchParams.has(DEMO_SEARCH_PARAMETER);


let continuousDataTable = new ContinuousDataTable('#continuousData',
                                                  beaver.devices);
let discreteDataTableOptions = { isClockDisplayed: true,
                                 digitalTwins: cormorant.digitalTwins,
                                 maxRows: 10 };
let discreteDataTable = new DiscreteDataTable('#discreteData',
                                              discreteDataTableOptions);

// Handle beaver events
beaver.on('dynamb', handleDynamb);
beaver.on('connect', () => {
  if(isDemo) { return; }
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-success'));
  demoalert.hidden = true;
});
beaver.on('stats', (stats) => {
  deviceCount.textContent = stats.numberOfDevices;
  raddecRate.textContent = stats.eventsPerSecond.raddec.toFixed(1);
  dynambRate.textContent = stats.eventsPerSecond.dynamb.toFixed(1);
});
beaver.on('error', (error) => {
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-danger'));
  demoalert.hidden = false;
});
beaver.on('disconnect', () => {
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-warning'));
});

// Demo mode: connect to starling.js
if(isDemo) {
  let demoIcon = createElement('b', 'animate-breathing text-success', 'DEMO');
  let context = starling.getContext();

  connectIcon.replaceChildren(demoIcon);
  beaver.stream(null, { io: starling, ioUrl: "http://pareto.local" });

  for(let deviceSignature in context.devices) {
    let device = context.devices[deviceSignature];
    beaver.devices.set(deviceSignature, device);
  }
}

// Normal mode: connect to socket.io
else {
  beaver.stream(baseUrl, { io: io });
  cormorantOptions = { associationsServerUrl: baseUrl };
}


// Handle a dynamb event
function handleDynamb(dynamb) {
  let deviceSignature = dynamb.deviceId + '/' + dynamb.deviceIdType;
  cormorant.retrieveDigitalTwin(deviceSignature, null, cormorantOptions,
                                (digitalTwin, isRetrievedFromMemory) => {
    if(digitalTwin && !isRetrievedFromMemory) {
      discreteDataTable.updateDigitalTwin(deviceSignature, digitalTwin);
    }
  });
  discreteDataTable.handleDynamb(dynamb);
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
