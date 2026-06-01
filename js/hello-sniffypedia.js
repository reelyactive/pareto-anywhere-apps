/**
 * Copyright reelyActive 2021-2026
 * We believe in an open Internet of Things
 */


// Constants
const POLLING_INTERVAL_MILLISECONDS = 5000;
const CONTEXT_ROUTE = '/context';
const SNIFFYPEDIA_BASE_URI = 'https://sniffypedia.org/';
const DEMO_SEARCH_PARAMETER = 'demo';

// DOM elements
let connectIcon = document.querySelector('#connectIcon');
let demoalert = document.querySelector('#demoalert');
let cards = document.querySelector('#cards');

// Other variables
let baseUrl = window.location.protocol + '//' + window.location.hostname +
              ':' + window.location.port;
let isPollPending = false;

// Initialise based on URL search parameters, if any
let searchParams = new URLSearchParams(location.search);
let isDemo = searchParams.has(DEMO_SEARCH_PARAMETER);

// Demo mode: connect to starling.js
if(isDemo) {
  let demoIcon = createElement('b', 'animate-breathing text-success', 'DEMO');
  connectIcon.replaceChildren(demoIcon);
}

// Handle beaver events
beaver.on('connect', () => {
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-success'));
  demoalert.hidden = true;
});
beaver.on('poll', (isSuccess) => {
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-success'));
  demoalert.hidden = isSuccess;
  updateDisplay(beaver.devices);
  isPollPending = false;
});
beaver.on('error', () => {
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-danger'));
  demoalert.hidden = false;
});

setInterval(pollAndDisplay, POLLING_INTERVAL_MILLISECONDS);
pollAndDisplay();


// Poll the devices and display in DOM
function pollAndDisplay() {
  if(!isPollPending) {
    isPollPending = true;

    if(isDemo) {
      let response = starling.getContext(CONTEXT_ROUTE);
      devices = new Map(Object.entries(response.devices || {}));
      updateDisplay(devices);
      isPollPending = false;
    }
    else {
      beaver.poll(baseUrl, { clearDevices: true });
    }
  }
}


// Update the display based on the latest devices
function updateDisplay(devices) {
  let sniffypediaUris = tallyStatid(devices);
  cards.replaceChildren();

  sniffypediaUris.forEach((count, uri) => {
    cormorant.retrieveStory(uri, { isStoryToBeRefetched: false },
                            (story, status) => {
      let card = createCard(uri, count);
      cards.appendChild(card);
    });
  });
}


// Tally all the static identifiers of the given devices and sort by count
function tallyStatid(devices) {
  let tallies = new Map();

  devices.forEach((device) => {
    if(device.statid) {
      let hasSniffypedia = device.statid.uri &&
                           device.statid.uri.startsWith(SNIFFYPEDIA_BASE_URI);
      if(hasSniffypedia) {
        let count = tallies.get(device.statid.uri) || 0;
        tallies.set(device.statid.uri, count + 1);
      }
    }
  });

  return new Map([...tallies.entries()].sort((a, b) => b[1] - a[1]));
}


// Create a card with image, name and device count
function createCard(uri, count) {
  let img = '';
  let name = uri.substring(SNIFFYPEDIA_BASE_URI.length);
  let story = cormorant.stories.get(uri);

  if(story) {
    img = createElement('img', 'card-img-top');
    img.setAttribute('src', cuttlefishStory.determineImageUrl(story));
    name = cuttlefishStory.determineTitle(story) || '-';
  }

  let cardTitle = createElement('p', 'card-title text-center display-4', count);
  let footerText = createElement('small', 'text-truncate', name);
  let cardFooter = createElement('div', 'card-footer text-center', footerText);
  let cardBody = createElement('div', 'card-body', cardTitle);
  let card = createElement('div', 'card hover-shadow mb-3',
                           [ img, cardBody, cardFooter ]);

  return createElement('div', 'col', card);
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
