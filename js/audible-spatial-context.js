/**
 * Copyright reelyActive 2022
 * We believe in an open Internet of Things
 */


// Constants
const SIGNATURE_SEPARATOR = '/';
const DEFAULT_FADE_IN_SECONDS = 3;
const DEFAULT_FADE_OUT_SECONDS = 3;
const AUDIO_UPDATE_MILLISECONDS = 500;
const STALE_THRESHOLD_MILLISECONDS = 10000;
const MAX_VOLUME_RSSI = -60;
const MAX_VOLUME_CHANGE_DECIBELS = 1;
const DEVICE_SIGNATURE_SEARCH_PARAMETER = 'deviceSignature';

// DOM elements
let welcomeCard = document.querySelector('#welcome');
let enableAudioButton = document.querySelector('#enableaudio');

// Other variables
let isAudioEnabled = false;
let audibleDevices = new Map();


// Initialise based on URL search parameters, if any
let searchParams = new URLSearchParams(location.search);
let hasTargetDevice = searchParams.has(DEVICE_SIGNATURE_SEARCH_PARAMETER);
let targetDeviceSignature = searchParams.get(DEVICE_SIGNATURE_SEARCH_PARAMETER);


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

  if(hasTargetDevice && (transmitterSignature !== targetDeviceSignature)) {
    return;
  }

  let rssi = raddec.rssiSignature[0].rssi;

  updateAudibleDevices(transmitterSignature, raddec.timestamp, rssi);

  for(const decoding of raddec.rssiSignature) {
    let receiverSignature = decoding.receiverId + SIGNATURE_SEPARATOR +
                            decoding.receiverIdType;
    updateAudibleDevices(receiverSignature, raddec.timestamp, decoding.rssi);
  }
}


// Handle a dynamic ambient (dynamb) data event
function handleDynamb(dynamb) {
  let deviceSignature = dynamb.deviceId + SIGNATURE_SEPARATOR +
                        dynamb.deviceIdType;

  if(hasTargetDevice && (deviceSignature !== targetDeviceSignature)) {
    return;
  }

  updateAudibleDevices(deviceSignature, dynamb.timestamp);

  if(dynamb.hasOwnProperty('nearest')) {
    for(const peer of dynamb.nearest) {
      let peerSignature = peer.deviceId + SIGNATURE_SEPARATOR +
                          (peer.deviceIdType || '0'); // Hack!
      updateAudibleDevices(peerSignature, dynamb.timestamp, peer.rssi);
    }
  }
}


// Update the list of audible devices based on the device signature
function updateAudibleDevices(deviceSignature, timestamp, rssi) {
  let isKnownAudibleDevice = audibleDevices.has(deviceSignature);
  let targetVolume = 0;

  if(rssi) {
    targetVolume = Math.min(rssi - MAX_VOLUME_RSSI, 0);
  }

  if(isKnownAudibleDevice) {
    let audibleDevice = audibleDevices.get(deviceSignature);

    if(timestamp > audibleDevice.lastEventTimestamp) {
      audibleDevice.lastEventTimestamp = timestamp;
      audibleDevice.targetVolume = targetVolume;
    }
  }
  else {
    retrieveAudioUrl(deviceSignature, function(audioUrl) {
      if(audioUrl) {
        const player = new Tone.Player(audioUrl).toDestination();
        let audibleDevice = { player: player,
                              targetVolume: targetVolume,
                              lastEventTimestamp: timestamp };

        player.autostart = true;
        player.loop = true;
        player.volume.value = targetVolume;
        player.fadeIn = DEFAULT_FADE_IN_SECONDS;
        player.fadeOut = DEFAULT_FADE_OUT_SECONDS;
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
  let staleTimestampThreshold = Date.now() - STALE_THRESHOLD_MILLISECONDS;

  audibleDevices.forEach((audibleDevice) => {
    let isStale = (audibleDevice.lastEventTimestamp < staleTimestampThreshold);
    let isPlaying = (audibleDevice.player.state === 'started');

    if(isPlaying && isStale) {
      audibleDevice.player.stop();
    }
    else if(isPlaying) {
      let volume = audibleDevice.player.volume.value;

      if(volume < audibleDevice.targetVolume) {
        volume = Math.min(volume + MAX_VOLUME_CHANGE_DECIBELS,
                          audibleDevice.targetVolume);
      }
      else if(volume > audibleDevice.targetVolume) {
        volume = Math.max(volume - MAX_VOLUME_CHANGE_DECIBELS,
                          audibleDevice.targetVolume);
      }

      audibleDevice.player.volume.value = volume;
    }
    else if(!isPlaying && !isStale) {
      audibleDevice.player.start();
    }
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
  setInterval(updateAudioPlayback, AUDIO_UPDATE_MILLISECONDS);
});