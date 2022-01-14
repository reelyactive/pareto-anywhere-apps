/**
 * Copyright reelyActive 2022
 * We believe in an open Internet of Things
 */


// Constants
const DYNAMB_ROUTE = '/devices/dynamb';
const SIGNATURE_SEPARATOR = '/';


// DOM elements
let connection = document.querySelector('#connection');
let firsthalf = document.querySelector('#firsthalf');
let secondhalf = document.querySelector('#secondhalf');


// Other variables


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


// Handle a dynamb event
function handleDynamb(dynamb) {
  cuttlefishDynamb.render(dynamb, firsthalf);
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