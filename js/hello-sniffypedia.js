/**
 * Copyright reelyActive 2021-2023
 * We believe in an open Internet of Things
 */


// Constants
const STATUS_OK = 200;
const SIGNATURE_SEPARATOR = '/';
const DIRECTORY_SEPARATOR = ':';
const POLLING_INTERVAL_MILLISECONDS = 5000;
const CONTEXT_ROUTE = '/context';
const SNIFFYPEDIA_BASE_URI = 'https://sniffypedia.org/';
const DEMO_SEARCH_PARAMETER = 'demo';

// DOM elements
let connectIcon = document.querySelector('#connectIcon');
let demoalert = document.querySelector('#demoalert');
let firsthalf = document.querySelector('#firsthalf');
let secondhalf = document.querySelector('#secondhalf');

// Other variables
let baseUrl = window.location.protocol + '//' + window.location.hostname +
              ':' + window.location.port;
let selectedUrl = baseUrl + CONTEXT_ROUTE;
let isPollPending = false;
let pollingInterval;

// Initialise based on URL search parameters, if any
let searchParams = new URLSearchParams(location.search);
let isDemo = searchParams.has(DEMO_SEARCH_PARAMETER);

// Demo mode: connect to starling.js
if(isDemo) {
  let demoIcon = createElement('b', 'animate-breathing text-success', 'DEMO');
  connectIcon.replaceChildren(demoIcon);
}


setInterval(pollAndDisplay, POLLING_INTERVAL_MILLISECONDS);
pollAndDisplay();


// GET the devices and display in DOM
function pollAndDisplay() {
  if(!isPollPending) {
    isPollPending = true;

    if(isDemo) {
      let response = starling.getContext();
      let devices = response.devices || {};
      isPollPending = false;
      updateDisplay(devices);
      return;
    }

    getContext(selectedUrl, function(status, response) {
      let statusIcon = createElement('i', 'fas fa-cloud text-danger');
      isPollPending = false;

      if(status === STATUS_OK) {
        let devices = JSON.parse(response).devices || {};
        statusIcon = createElement('i', 'fas fa-cloud text-success');
        demoalert.hidden = true;
        updateDisplay(devices);
      }
      else {
        connectIcon.hidden = false;
        demoalert.hidden = false;
        updateDisplay({});
      }

      connectIcon.replaceChildren(statusIcon);
    });
  }
}


// GET the context
function getContext(url, callback) {
  let httpRequest = new XMLHttpRequest();

  httpRequest.onreadystatechange = function() {
    if(httpRequest.readyState === XMLHttpRequest.DONE) {
      return callback(httpRequest.status, httpRequest.responseText);
    }
  };
  httpRequest.open('GET', url);
  httpRequest.setRequestHeader('Accept', 'application/json');
  httpRequest.send();
}


// Update the display based on the latest devices
function updateDisplay(devices) {
  let sniffypediaUris = tallyStatid(devices);
  let firstGroup = new DocumentFragment();
  let secondGroup = new DocumentFragment();

  if(sniffypediaUris.size > 0) {
    let halfwayMark = Math.ceil(sniffypediaUris.size / 2);
    let maxCount = sniffypediaUris.entries().next().value[1];
    let offset = 0;

    fetchStories(sniffypediaUris.keys());
    sniffypediaUris.forEach((count, uri) => {
      if(offset++ < halfwayMark) {
        appendCard(firstGroup, uri, count, maxCount);
      }
      else {
        appendCard(secondGroup, uri, count, maxCount);
      }
    });
  }

  firsthalf.replaceChildren(firstGroup);
  secondhalf.replaceChildren(secondGroup);
}


// Tally all the static identifiers of the given devices and sort by count
function tallyStatid(devices) {
  let tallies = new Map();

  for(const deviceSignature in devices) {
    let device = devices[deviceSignature];

    if(device.statid) {
      let hasSniffypedia = device.statid.uri &&
                           device.statid.uri.startsWith(SNIFFYPEDIA_BASE_URI);
      if(hasSniffypedia) {
        let count = tallies.get(device.statid.uri) || 0;
        tallies.set(device.statid.uri, count + 1);
      }
    }
  }

  return new Map([...tallies.entries()].sort((a, b) => b[1] - a[1]));
}


// Create and append a card with device count
function appendCard(parent, uri, count, maxCount) {
  let img = '';
  let title = uri.substring(SNIFFYPEDIA_BASE_URI.length);
  let story = cormorant.stories.get(uri);

  if(story) {
    img = createElement('img', 'img-fluid rounded-start');
    img.setAttribute('src', cuttlefishStory.determineImageUrl(story));
    title = cuttlefishStory.determineTitle(story);
  }

  let cardTitle = createElement('h4', 'card-title', title);
  let progressBar = createElement('div', 'progress-bar', count);
  let progress = createElement('div', 'progress', progressBar);
  let cardText = createElement('p', 'card-text', progress);
  let cardBody = createElement('div', 'card-body', [ cardTitle, cardText ]);
  let rightCol = createElement('div', 'col-9 col-sm-10', cardBody);
  let leftCol = createElement('div', 'col-3 col-sm-2', img);
  let row = createElement('div', 'row g-0', [ leftCol, rightCol ]);
  let card = createElement('div', 'card hover-shadow mb-3', row);
  let widthPercentage = Math.floor(100 * count / maxCount);

  progressBar.setAttribute('style', 'width: ' + widthPercentage + '%');

  parent.appendChild(card);
}


// Fetch stories from devices with URIs
function fetchStories(uris) {
  for(const uri of uris) {
    cormorant.retrieveStory(uri, { isStoryToBeRefetched: false },
                            (story, status) => {});
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
