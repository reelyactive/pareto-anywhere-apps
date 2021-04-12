/**
 * Copyright reelyActive 2021
 * We believe in an open Internet of Things
 */


// Constants
const SIGNATURE_SEPARATOR = '/';

// DOM elements
let welcomeCard = document.querySelector('#welcome');
let enableAudioButton = document.querySelector('#enableaudio');

// Other variables
let isAudioEnabled = false;

// Connect to the socket.io stream and feed to beaver
let baseUrl = window.location.protocol + '//' + window.location.hostname +
              ':' + window.location.port;
let socket = io(baseUrl);
beaver.listen(socket, true);


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


// Appearance events
beaver.on([ 0 ], function(raddec) {
  if(isAudioEnabled) {
    handleAppearance(raddec);
  }
});


// Handle a device appearance
function handleAppearance(raddec) {
  let transmitterSignature = raddec.transmitterId + SIGNATURE_SEPARATOR +
                             raddec.transmitterIdType;

  cormorant.retrieveAssociations(baseUrl, transmitterSignature, true,
                                 function(associations, story) {
    if(story && story.hasOwnProperty('@graph')) {
      let thing = story['@graph'][0];

      if(thing && thing.hasOwnProperty('schema:interactionStatistic') &&
         Array.isArray(thing['schema:interactionStatistic'])) {
        let interactions = thing['schema:interactionStatistic'];
        let audioUrl;

        interactions.forEach(function(interaction) {
          if(interaction.hasOwnProperty('schema:url')) {
            let url = interaction['schema:url'];
            let extension = url.substr(-4);

            if((extension === '.mp3') || (extension === '.wav')) {
              audioUrl = url; // TODO: check if highest interaction count?
            }
          }
        });

        if(audioUrl) {
          const player = new Tone.Player(audioUrl).toDestination();
          Tone.loaded().then(() => { player.start(); });
        }
        else {
          const osc = new Tone.Oscillator().toDestination();
          osc.frequency.value = 'D4';
          osc.frequency.rampTo('D5', '16n');
          osc.start().stop('+16n');
        }
      }
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
});