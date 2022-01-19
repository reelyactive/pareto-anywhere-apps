/**
 * Copyright reelyActive 2022
 * We believe in an open Internet of Things
 */


// Constants
const SIGNATURE_SEPARATOR = '/';

// DOM elements
let welcomeCard = document.querySelector('#welcome');
let enableAudioButton = document.querySelector('#enableaudio');

// Other variables
let isAudioEnabled = false;
let audibleDevices = new Map();

// Connect to the socket.io stream and feed to beaver
let baseUrl = window.location.protocol + '//' + window.location.hostname +
              ':' + window.location.port;
let socket = io(baseUrl);
socket.on("raddec", handleRaddec);
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


// Handle a radio decoding (raddec) data event
function handleRaddec(raddec) {
  let transmitterSignature = raddec.transmitterId + SIGNATURE_SEPARATOR +
                             raddec.transmitterIdType;

  updateAudibleDevices(transmitterSignature, raddec.timestamp);

  // TODO: loop through rssiSignature
}


// Handle a dynamic ambient (dynamb) data event
function handleDynamb(dynamb) {
  let deviceSignature = dynamb.deviceId + SIGNATURE_SEPARATOR +
                        dynamb.deviceIdType;

  updateAudibleDevices(deviceSignature, dynamb.timestamp);

  // TODO: loop through nearest, if present
}


// Update the list of audible devices based on the device signature
function updateAudibleDevices(deviceSignature, timestamp) {
  let isKnownAudibleDevice = audibleDevices.has(deviceSignature);

  if(isKnownAudibleDevice) {
    let audibleDevice = audibleDevices.get(deviceSignature);

    if(timestamp > audibleDevice.lastEventTimestamp) {
      audibleDevice.lastEventTimestamp = timestamp;
    }
  }
  else {
    retrieveAudioUrl(deviceSignature, function(audioUrl) {
      if(audioUrl) {
        const player = new Tone.Player(audioUrl).toDestination();
        let audibleDevice = { player: player,
                              lastEventTimestamp: timestamp };

        player.autostart = true;
        player.loop = true;
        audibleDevices.set(deviceSignature, audibleDevice);
      }
    });
  }
}


// Attempt to retrieve the audio URL
function retrieveAudioUrl(transmitterSignature, callback) {
  cormorant.retrieveAssociations(baseUrl, transmitterSignature, true,
                                 function(associations, story) {
    let audioUrl = null;

    if(story && story.hasOwnProperty('@graph')) {
      let thing = story['@graph'][0];

      if(thing && thing.hasOwnProperty('schema:interactionStatistic') &&
         Array.isArray(thing['schema:interactionStatistic'])) {
        let interactions = thing['schema:interactionStatistic'];

        interactions.forEach(function(interaction) {
          if(interaction.hasOwnProperty('schema:url')) {
            let url = interaction['schema:url'];
            let extension = url.substr(-4);

            if((extension === '.mp3') || (extension === '.wav')) {
              audioUrl = url; // TODO: check if highest interaction count?
            }
          }
        });
      }
    }

    return callback(audioUrl);
  });
}


// Update the audio playback based on the current spatial context
function updateAudioPlayback() {
  audibleDevices.forEach((audibleDevice) => {
    // TODO: manage disappearance and fade out
  });
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
    element.textContent = content;
  }

  return element;
}


// Enable audio with a user action (required on modern browsers)
enableAudioButton.addEventListener('click', async function() {
  await Tone.start();
  isAudioEnabled = true;
  welcomeCard.hidden = true;
  console.log('Tone.js started. Audio is ready.');
  setInterval(updateAudioPlayback, 1000);
});