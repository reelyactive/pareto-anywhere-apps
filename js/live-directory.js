/**
 * Copyright reelyActive 2021
 * We believe in an open Internet of Things
 */


// Constants
const STATUS_OK = 200;
const SIGNATURE_SEPARATOR = '/';
const DIRECTORY_SEPARATOR = ':';
const POLLING_INTERVAL_MILLISECONDS = 5000;
const CONTEXT_ROUTE = '/context';
const SNIFFYPEDIA_BASE_URI = 'https://sniffypedia.org/';

// DOM elements
let connection = document.querySelector('#connection');
let storycolumn = document.querySelector('#storycolumn');
let charcolumn = document.querySelector('#charcolumn');

// Other variables
let baseUrl = window.location.protocol + '//' + window.location.hostname +
              ':' + window.location.port;
let selectedUrl = baseUrl + CONTEXT_ROUTE;
let isPollPending = false;
let pollingInterval;


setInterval(pollAndDisplay, POLLING_INTERVAL_MILLISECONDS);
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
        updateDisplay(devices);
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


// Update the display based on the latest devices
function updateDisplay(devices) {
  let updatedStoryCards = prepareStoryCards(devices);
  let updatedCharCards = new DocumentFragment();
  let charTallies = tallyUnicodeCodePoints(devices);
  let maxCount = charTallies.entries().next().value[1];

  charTallies.forEach((count, unicodeCodePoint) => {
    appendCard(updatedCharCards, unicodeCodePoint, count, maxCount);
  });

  storycolumn.replaceChildren(updatedStoryCards);
  charcolumn.replaceChildren(updatedCharCards);
}


// Prepare the story cards based on the given devices
function prepareStoryCards(devices) {
  let storyCards = new DocumentFragment();

  for(const deviceSignature in devices) {
    let device = devices[deviceSignature];
    let uri;

    if(device.hasOwnProperty('url')) {
      uri = device.url;
    }
    else if(device.hasOwnProperty('statid') &&
            device.statid.hasOwnProperty('url') &&
            !device.statid.uri.startsWith(SNIFFYPEDIA_BASE_URL)) {
      uri = device.statid.uri;
    }

    if(uri) {
      let isStoryFetched = cormorant.stories.hasOwnProperty(uri);

      if(isStoryFetched) {
        let card = cuttlefishStory.render(cormorant.stories[uri]);
        let col = createElement('div', 'col', card);
        storyCards.appendChild(col);
      }
      else {
        cormorant.retrieveStory(uri, function(story) {
          let card = cuttlefishStory.render(story);
          let col = createElement('div', 'col', card);
          storycolumn.appendChild(col);
        }); 
      }
    }
  }

  return storyCards;
}


// Tally all the Unicode code points of the given devices and sort by count
function tallyUnicodeCodePoints(devices) {
  let tallies = new Map();

  for(const deviceSignature in devices) {
    let device = devices[deviceSignature];
    let hasUnicodeCodePoints = device.hasOwnProperty('dynamb') &&
                               Array.isArray(device.dynamb.unicodeCodePoints);

    if(hasUnicodeCodePoints) {
      for(const unicodeCodePoint of device.dynamb.unicodeCodePoints) {
        let count = tallies.get(unicodeCodePoint) || 0;
        tallies.set(unicodeCodePoint, count + 1);
      }
    }
  }

  return new Map([...tallies.entries()].sort((a, b) => b[1] - a[1]));
}


// Create and append a card with character count
function appendCard(parent, unicodeCodePoint, count, maxCount) {
  let charText = createElement('span', 'card-text display-4',
                               String.fromCodePoint(unicodeCodePoint));
  let charBody = createElement('div', 'card-body text-center', charText);
  let leftCol = createElement('div', 'col-4 col-sm-3', charBody);
  let progressBar = createElement('div', 'progress-bar', count);
  let progress = createElement('div', 'progress', progressBar);
  let countText = createElement('p', 'card-text', progress);
  let countBody = createElement('div', 'card-body', countText);
  let rightCol = createElement('div', 'col-8 col-sm-9', countBody);
  let row = createElement('div', 'row g-0', [ leftCol, rightCol ]);
  let card = createElement('div', 'card hover-shadow mb-3', row);
  let widthPercentage = Math.floor(100 * count / maxCount);

  progressBar.setAttribute('style', 'width: ' + widthPercentage + '%');

  parent.appendChild(card);
}


// Fetch stories from devices with URIs
function fetchStories(uris) {
  for(const uri of uris) {
    cormorant.retrieveStory(uri, function(story) {});
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