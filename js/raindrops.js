/**
 * Copyright reelyActive 2025
 * We believe in an open Internet of Things
 */


// Constants
const DEMO_SEARCH_PARAMETER = 'demo';
const TILE_SOURCE_PARAMETER = 'tileSource';
const RAINDROP_DURATION_MILLISECONDS = 3600;
const MAP_MIN_HEIGHT_PX = 480;
const MAP_UNUSABLE_HEIGHT_PX = 120;
const INITIAL_ZOOM = 19;

// DOM elements
let connectIcon = document.querySelector('#connectIcon');
let demoalert = document.querySelector('#demoalert');

// Other variables
let tileLayerSource;
let selectedDeviceSignature;
let cormorantOptions;
let isMapCentered = false;

// Initialise based on URL search parameters, if any
let searchParams = new URLSearchParams(location.search);
let isDemo = searchParams.has(DEMO_SEARCH_PARAMETER);
let tileSource = searchParams.get(TILE_SOURCE_PARAMETER);
let baseUrl = window.location.protocol + '//' + window.location.hostname + ':' +
              window.location.port;
switch(tileSource) {
  case 'OSM':
    tileLayerSource = new ol.source.OSM({});
    break;
  default:
    tileLayerSource = new ol.source.VectorTile({});
}

setContainerHeight();

// OpenLayers components
const GeoJSON = ol.format.GeoJSON;
const tileLayer = new ol.layer.Tile({ source: tileLayerSource });
const raindropSource = new ol.source.Vector({ wrapX: false });
const raindropLayer = new ol.layer.Vector({ source: raindropSource });
const featureSource = new ol.source.Vector({ wrapX: false });
const featureLayer = new ol.layer.Vector({ source: featureSource });
const map = new ol.Map({
  layers: [ tileLayer, raindropLayer, featureLayer ],
  target: 'map',
  view: new ol.View({
    projection: 'EPSG:4326',
    center: [ 0, 0 ],
    zoom: 3,
    multiWorld: true
  }),
});
const featureStyle = new ol.style.Style({
    stroke: new ol.style.Stroke({ color: [ 0x5a, 0x5a, 0x5a ] })
});

// Handle OpenLayers events
raindropSource.on('addfeature', (event) => { animateRaindrop(event.feature); });

// Handle beaver events
beaver.on('connect', handleConnect);
beaver.on('spatem', handleSpatem);
beaver.on('stats', handleStats);
beaver.on('error', handleError);
beaver.on('disconnect', handleDisconnect);

// Demo mode: connect to starling.js
if(isDemo) {
  let demoIcon = createElement('b', 'animate-breathing text-success', 'DEMO');
  connectIcon.replaceChildren(demoIcon);
  beaver.stream(null, { io: starling, ioUrl: "http://pareto.local" });
}

// Normal mode: connect to socket.io
else {
  beaver.stream(baseUrl, { io: io });
  cormorantOptions = { associationsServerUrl: baseUrl };
}

// Handle stream connection
function handleConnect() {
  demoalert.hidden = true;
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-success'));
}

// Handle stream disconnection
function handleDisconnect() {
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-warning'));
}

// Handle error
function handleError(error) {
  connectIcon.replaceChildren(createElement('i', 'fas fa-cloud text-danger'));
  demoalert.hidden = false;
}

// Handle stats
function handleStats(stats) {
  //deviceCount.textContent = stats.numberOfDevices;
  //spatemRate.textContent = stats.eventsPerSecond.spatem.toFixed(1);
}

// Handle a spatem event
function handleSpatem(spatem) {
  let deviceSignature = spatem.deviceId + '/' + spatem.deviceIdType;
  let device = beaver.devices.get(deviceSignature);

  //cormorant.retrieveDigitalTwin(deviceSignature, null, cormorantOptions,
  //                              (digitalTwin, isRetrievedFromMemory) => {
  //  if(digitalTwin && !isRetrievedFromMemory) {}
  //});

  raindropSource.addFeature(new GeoJSON().readFeature(spatem.data.features[0]));
  if(spatem.type === 'location') {
    spatem.data.features.forEach((feature, index) => {
      if(index > 1) {
        let styledFeature = new GeoJSON().readFeature(feature);
        styledFeature.setStyle(featureStyle);
        featureSource.addFeature(styledFeature); // OpenLayers handles dupes
      }
    });
  }

  if(!isMapCentered) {
    map.getView().setCenter(spatem.data.features[0].geometry.coordinates);
    map.getView().setZoom(INITIAL_ZOOM);
    isMapCentered = true;
  }
}

// Animate the raindrop
// See: https://openlayers.org/en/latest/examples/feature-animation.html
function animateRaindrop(feature) {
  const start = Date.now();
  const rippleGeometry = feature.getGeometry().clone();
  const listenerKey = tileLayer.on('postrender', animate);

  function animate(event) {
    const frameState = event.frameState;
    const elapsed = frameState.time - start;
    if (elapsed >= RAINDROP_DURATION_MILLISECONDS) {
      ol.Observable.unByKey(listenerKey);
      raindropSource.removeFeature(feature);
      return;
    }
    const vectorContext = ol.render.getVectorContext(event);
    const elapsedRatio = elapsed / RAINDROP_DURATION_MILLISECONDS;
    // radius will be 5 at start and 30 at end.
    const radius = ol.easing.easeOut(elapsedRatio) * 25 + 5;
    const opacity = ol.easing.easeOut(1 - elapsedRatio);

    const style = new ol.style.Style({
      image: new ol.style.Circle({
        radius: radius,
        stroke: new ol.style.Stroke({
          color: 'rgba(7, 112, 162, ' + opacity + ')',
          width: 0.25 + opacity
        })
      })
    });

    vectorContext.setStyle(style);
    vectorContext.drawGeometry(rippleGeometry);
    map.render();
  }
}

// Set the height of the map container
function setContainerHeight() {
  let container = document.getElementById('map-container');
  let height = Math.max(window.innerHeight - MAP_UNUSABLE_HEIGHT_PX,
                        MAP_MIN_HEIGHT_PX) + 'px';
  container.setAttribute('style', 'height:' + height);
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
