/**
 * Copyright reelyActive 2021-2023
 * We believe in an open Internet of Things
 */


// Constants
const DEMO_SEARCH_PARAMETER = 'demo';
const ACCEPTED_STORY_TYPES = [ 'schema:Person' ];
const ACTIVE_TIMEOUT_MILLISECONDS = 60000;


// DOM elements
let connectIcon = document.querySelector('#connectIcon');
let demoalert = document.querySelector('#demoalert');
let activestorycolumn = document.querySelector('#activestorycolumn');
let recentstorycolumn = document.querySelector('#recentstorycolumn');
let time = document.querySelector('#time');
let deviceCount = document.querySelector('#deviceCount');
let raddecRate = document.querySelector('#raddecRate');
let dynambRate = document.querySelector('#dynambRate');


// Other variables
let baseUrl = window.location.protocol + '//' + window.location.hostname +
              ':' + window.location.port;
let cards = new Map();
let cormorantOptions;

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

updateDisplay();


// Handle a dynamb event
function handleDynamb(dynamb) {
  let deviceSignature = dynamb.deviceId + '/' + dynamb.deviceIdType;
  if(cards.has(deviceSignature)) {
    cormorant.retrieveDigitalTwin(deviceSignature, null, cormorantOptions,
                                  (digitalTwin, isRetrievedFromMemory) => {
      if(digitalTwin && !isRetrievedFromMemory) {
        discreteDataTable.updateDigitalTwin(deviceSignature, digitalTwin);
      }
    });
    discreteDataTable.handleDynamb(dynamb);
  }
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
      cormorant.retrieveDigitalTwin(deviceSignature, device, cormorantOptions,
                                    (digitalTwin, isRetrievedFromMemory) => {
        if(digitalTwin &&
           isAcceptedStoryType(digitalTwin.story, ACCEPTED_STORY_TYPES)) {
          let card = prepareCard(digitalTwin.story, deviceSignature);
          card.lastSeenTimestamp = lastSeenTimestamp;
          card.isActiveStory = true;
          cards.set(deviceSignature, card);
          activestorycolumn.appendChild(card.node);
        }
      });
    }
  });

  cards.forEach((card) => {
    let activeThresholdTime = Date.now() - ACTIVE_TIMEOUT_MILLISECONDS;
    let isActive = (card.lastSeenTimestamp >= activeThresholdTime);

    if(isActive && !card.isActiveStory) {
      prependChild(activestorycolumn, card.node);
      card.isActiveStory = true;
      card.footer.hidden = true;
    }
    else if(!isActive && card.isActiveStory) {
      let lastSeenTime = new Date(card.lastSeenTimestamp).toLocaleTimeString([],
                         { hour: "2-digit", minute: "2-digit", hour12: false });
      prependChild(recentstorycolumn, card.node);
      card.lastSeen.textContent = lastSeenTime;
      card.isActiveStory = false;
      card.footer.hidden = false;
    }

    // TODO: limit number of displayed cards?
  });

  setTimeout(updateDisplay, 5000);
}


// Prepare a card
function prepareCard(story, deviceSignature) {
  let card = cuttlefishStory.render(story);
  let disappearanceIcon = createElement('i', 'fas fa-sign-out-alt');
  let lastSeen = createElement('span', null);
  let footer = createElement('div',
                             'card-footer text-center text-muted bg-transparent',
                             [ disappearanceIcon, '\u00a0', lastSeen ]);
  let col = createElement('div', 'col', card);
  card.appendChild(footer);
  card.setAttribute('class', 'card hover-shadow');
  footer.setAttribute('id', deviceSignature + '-footer');
  footer.hidden = true;

  return {
      story: story,
      node: card,
      footer: footer,
      lastSeen: lastSeen
  };
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


// Prepend as the first child
function prependChild(parent, child) {
  if(parent.firstChild) {
    parent.insertBefore(child, parent.firstChild);
  }
  else {
    parent.appendChild();
  }
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
