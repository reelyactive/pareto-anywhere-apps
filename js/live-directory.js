/**
 * Copyright reelyActive 2021-2023
 * We believe in an open Internet of Things
 */


// Constants
const DEMO_SEARCH_PARAMETER = 'demo';
const ACCEPTED_STORY_TYPES = [ 'schema:Person' ];


// DOM elements
let connectIcon = document.querySelector('#connectIcon');
let demoalert = document.querySelector('#demoalert');
let activestorycolumn = document.querySelector('#activestorycolumn');
let time = document.querySelector('#time');
let deviceCount = document.querySelector('#deviceCount');
let raddecRate = document.querySelector('#raddecRate');
let dynambRate = document.querySelector('#dynambRate');


// Other variables
let baseUrl = window.location.protocol + '//' + window.location.hostname +
              ':' + window.location.port;
let cards = new Map();

// Initialise based on URL search parameters, if any
let searchParams = new URLSearchParams(location.search);
let isDemo = searchParams.has(DEMO_SEARCH_PARAMETER);

let discreteDataTableOptions = { isClockDisplayed: true,
                                 digitalTwins: cormorant.digitalTwins,
                                 propertiesToDisplay: [ 'unicodeCodePoints' ],
                                 maxRows: 10 };
let discreteDataTable = new DiscreteDataTable('#discreteData',
                                              discreteDataTableOptions);

// Handle beaver events
beaver.on('dynamb', handleDynamb);
beaver.on('connect', () => {
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-success'));
});
beaver.on('stats', (stats) => {
  deviceCount.textContent = stats.numberOfDevices;
  raddecRate.textContent = stats.eventsPerSecond.raddec.toFixed(1);
  dynambRate.textContent = stats.eventsPerSecond.dynamb.toFixed(1);
});
beaver.on('error', (error) => {
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-danger'));
});
beaver.on('disconnect', () => {
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-warning'));
});

// Demo mode: connect to starling.js
if(isDemo) {
  let demoIcon = createElement('b', 'animate-breathing text-success', 'DEMO');
  connectIcon.replaceChildren(demoIcon);
  beaver.stream(baseUrl, { io: starling });
}

// Normal mode: connect to socket.io
else {
  beaver.stream(baseUrl, { io: io });
}

updateDisplay();


// Handle a dynamb event
function handleDynamb(dynamb) {
  let deviceSignature = dynamb.deviceId + '/' + dynamb.deviceIdType;
  cormorant.retrieveDigitalTwin(deviceSignature, null,
                                { associationsServerUrl: baseUrl },
                                (digitalTwin, isRetrievedFromMemory) => {
    if(digitalTwin && !isRetrievedFromMemory) {
      discreteDataTable.updateDigitalTwin(deviceSignature, digitalTwin);
    }
  });
  discreteDataTable.handleDynamb(dynamb);
}


// Update the display based on the latest devices
function updateDisplay() {
  beaver.devices.forEach((device, deviceSignature) => {
    let lastSeenTimestamp = Date.now();
    if(device.hasOwnProperty('raddec')) {
      lastSeenTimestamp = device.raddec.timestamp;
    }

    if(cards.has(deviceSignature)) {
      let card = cards.get(deviceSignature);
      card.lastSeenTimestamp = lastSeenTimestamp;
    }
    else {
      cormorant.retrieveDigitalTwin(deviceSignature, device,
                                    { associationsServerUrl: baseUrl },
                                    (digitalTwin, isRetrievedFromMemory) => {
        if(digitalTwin &&
           isAcceptedStoryType(digitalTwin.story, ACCEPTED_STORY_TYPES)) {
          cards.set(deviceSignature, { story: digitalTwin.story,
                                       lastSeenTimestamp: lastSeenTimestamp });
          activestorycolumn.appendChild(prepareStoryCard(digitalTwin.story));
        }
      });
    }
  });

  cards.forEach((card) => {
    // TODO: triage active & recent cards between columns
  });

  setTimeout(updateDisplay, 5000);
}


// Prepare a story card
function prepareStoryCard(story) {
  let card = cuttlefishStory.render(story);
  let col = createElement('div', 'col', card);
  card.setAttribute('class', 'card hover-shadow');

  return card;
}


// Determine if the given story is a member of one of the accepted types
function isAcceptedStoryType(story, acceptedTypes) {
  if(story && Array.isArray(story['@graph']) && Array.isArray(acceptedTypes)) {
    for(const element of story['@graph']) {
      if(element.hasOwnProperty('@type') &&
         acceptedTypes.includes(element['@type'])) {
        return true;
      }
    }
  }

  return false;
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
