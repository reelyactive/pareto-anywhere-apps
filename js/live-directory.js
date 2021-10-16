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
const TIME_OPTIONS = { hour: "2-digit", minute: "2-digit", hour12: false };

// DOM elements
let connection = document.querySelector('#connection');
let storycolumn = document.querySelector('#storycolumn');
let chartable = document.querySelector('#chartable');
let time = document.querySelector('#time');

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
      isPollPending = false;

      if(status === STATUS_OK) {
        let devices = JSON.parse(response).devices || {};
        statusIcon = createElement('i', 'fas fa-cloud text-success');
        updateDisplay(devices);
      }
      else {
        connection.hidden = false;
        updateDisplay({});
      }

      connection.replaceChildren(statusIcon);
    });
  }
  time.textContent = new Date().toLocaleTimeString([], TIME_OPTIONS);
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
  let updatedStoryCards = prepareStoryCards(devices);
  let updatedCharTableRows = new DocumentFragment();
  let charTallies = tallyUnicodeCodePoints(devices);

  if(charTallies.size > 0) {
    let maxCount = charTallies.entries().next().value[1];

    charTallies.forEach((count, unicodeCodePoint) => {
      appendCharTableRow(updatedCharTableRows, unicodeCodePoint, count,
                         maxCount);
    });
  }

  storycolumn.replaceChildren(updatedStoryCards);
  chartable.replaceChildren(updatedCharTableRows);
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
        card.setAttribute('class', 'card hover-shadow');
        storyCards.appendChild(col);
      }
      else {
        cormorant.retrieveStory(uri, function(story) {
          let card = cuttlefishStory.render(story);
          let col = createElement('div', 'col', card);
          card.setAttribute('class', 'card hover-shadow');
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


// Create and append a table row character count
function appendCharTableRow(parent, unicodeCodePoint, count, maxCount) {
  let th = createElement('th', 'w-25 table-light display-2 mb-1',
                               String.fromCodePoint(unicodeCodePoint));
  let progressBar = createElement('div', 'progress-bar', count);
  let progress = createElement('div', 'progress', progressBar);
  let td = createElement('td', 'w-75 align-middle', progress);
  let tr = createElement('tr', '', [ th, td ]);
  let widthPercentage = Math.floor(100 * count / maxCount);

  progressBar.setAttribute('style', 'width: ' + widthPercentage + '%');

  parent.appendChild(tr);
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