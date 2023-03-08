/**
 * Copyright reelyActive 2022
 * We believe in an open Internet of Things
 */


let starling = (function() {

  // Internal constants
  let DEFAULT_TRANSMITTERS = [
      { id: "fee150bada55", idType: 3, dynambProperties: [],
        statid: { uri: "https://sniffypedia.org/Product/Any_BLE-Device/",
        name: "Harald" } },
      { id: "d070b11d070b", idType: 3, dynambProperties: [],
        statid: { deviceIds: [ "496f4944434f4445b73e5554462d3332/0001/f989" ] },
        url: "https://www.reelyactive.com/team/barnowl/" },
      { id: "0be118ad0660", idType: 3, dynambProperties: [],
        statid: { deviceIds: [ "496f49445554462d3332/00000001f415"] },
        url: "https://www.reelyactive.com/team/obelix/" },
      { id: "c07105de81ce", idType: 3, dynambProperties: [],
        statid: { uri: "https://sniffypedia.org/Product/Any_Curious-Device/" } },
      { id: "a991ede81ce1", idType: 3, dynambProperties: [],
        statid: { uri: "https://sniffypedia.org/Organization/Apple_Inc/" } },
      { id: "a991ede81ce2", idType: 3, dynambProperties: [],
        statid: { uri: "https://sniffypedia.org/Organization/Apple_Inc/AirPlay/" } },
      { id: "a991ede81ce3", idType: 3, dynambProperties: [],
        statid: { deviceIds: [ "1beac04beac04beac04beac04beac045/1234/5678" ],
                  uri: "https://sniffypedia.org/Organization/Apple_Inc/iBeacon/" } },
      { id: "a991ede81ce4", idType: 3, dynambProperties: [],
        statid: { uri: "https://sniffypedia.org/Product/Apple_AirPods/" } },
      { id: "ac233fa00001", idType: 2, dynambProperties: [ 'acceleration' ],
        statid: { uri: "https://sniffypedia.org/Product/Minew_E8/" } },
      { id: "ac233fa00002", idType: 2,
        dynambProperties: [ 'temperature', 'relativeHumidity' ],
        statid: { uri: "https://sniffypedia.org/Organization/Shenzhen_Minew_Technologies_Co_Ltd/" } },
      { id: "ac233fa00003", idType: 2,
        dynambProperties: [ 'isButtonPressed' ],
        statid: { uri: "https://sniffypedia.org/Organization/Shenzhen_Minew_Technologies_Co_Ltd/" } },
      { id: "e50000000001", idType: 3,
        dynambProperties: [ 'illuminance', 'isMotionDetected' ],
        statid: { uri: "https://sniffypedia.org/Organization/EnOcean_GmbH/" },
        tags: [ "room" ]  },
      { id: "e50010000002", idType: 3 ,
        dynambProperties: [ 'acceleration', 'illuminance', 'isContactDetected',
                            'isMotionDetected', 'temperature',
                            'relativeHumidity' ],
        statid: { uri: "https://sniffypedia.org/Organization/EnOcean_GmbH/" },
        tags: [ "chair" ]  },
      { id: "0c4708eca570", idType: 3, dynambProperties: [],
        statid: { uri: "https://sniffypedia.org/Product/Google_Chromecast/",
                  uuids: [ "fea0" ], name: "Ambient Display" } }
  ];
  let DEFAULT_RECEIVERS = [
      { id: "001bc50940810000", idType: 1,
        url: "https://www.reelyactive.com/parc/stories/entrance/",
        directory: "parc:entrance", position: [ -73.57127, 45.50889 ] },
      { id: "0b1e6a7e8a40", idType: 2,
        url: "https://www.reelyactive.com/parc/stories/reelyactive/",
        directory: "parc:reelyactive", position: [ -73.57120, 45.50886 ] }
  ];
  let DEFAULT_UPDATE_CYCLE_MILLISECONDS = 4000;

  // Internal variables
  let eventCallbacks = { raddec: [], dynamb: [], connect: [] };
  let transmitters = DEFAULT_TRANSMITTERS;
  let receivers = DEFAULT_RECEIVERS;
  let transmitterIndex = 0;
  let isEmulating = false;
  let isConnect = false;

  // Emulate a raddec
  function createRaddec(transmitter, receivers) {
    let raddec = {
      transmitterId: transmitter.id,
      transmitterIdType: transmitter.idType,
      rssiSignature: [],
      events: [],
      timestamp: Date.now()
    };

    receivers.forEach((receiver) => {
      raddec.rssiSignature.push({
        receiverId: receiver.id,
        receiverIdType: receiver.idType,
        rssi: -90 + Math.round(Math.random() * 40)
      });
    });
    raddec.rssiSignature.sort((a, b) => (b.rssi - a.rssi));

    if(Math.random() > 0.5) {
      raddec.events.push(1);
    }
    if(transmitter.dynambProperties.length > 0) {
      raddec.events.push(2);
    }
    if(raddec.events.length === 0) {
      raddec.events.push(3);
    }

    return raddec;
  }

  // Emulate a dynamb
  function createDynamb(device) {
    if(device.dynambProperties.length === 0) {
      return null;
    }

    let dynamb = {
      deviceId: device.id,
      deviceIdType: device.idType,
      timestamp: Date.now()
    };

    device.dynambProperties.forEach((property) => {
      dynamb[property] = createDynambProperty(property);
    });

    return dynamb;
  }

  // Emulate a dynamb property
  function createDynambProperty(property) {
    let randomBoolean = (Math.random() > 0.5) ? true : false;
    switch(property) {
      case 'acceleration':
        return [ (Math.random() * 2) - 1, (Math.random() * 2) - 1,
                 (Math.random() * 2) - 1 ];
      case 'illuminance':
        return Math.round(Math.random() * 1000);
      case 'isButtonPressed':
        return [ randomBoolean ];
      case 'isContactDetected':
        return [ randomBoolean ];
      case 'isMotionDetected':
        return [ randomBoolean ];
      case 'temperature':
        return Math.round(Math.random() * 20) + 15;
      case 'relativeHumidity':
        return Math.round(Math.random() * 100);
    }
  }

  // Emulate a context of devices
  function createDevices(route) {
    let devices = {};

    transmitters.forEach((transmitter) => {
      let signature = transmitter.id + SIGNATURE_SEPARATOR + transmitter.idType;
      let device = { nearest: [] };
      let dynamb = createDynamb(transmitter);

      receivers.forEach((receiver) => {
        if((Math.random() * device.nearest.length) < 0.7) {
          device.nearest.push({
            device: receiver.id + SIGNATURE_SEPARATOR + receiver.idType,
            rssi: -90 + Math.round(Math.random() * 40)
          });
        }
      });
      device.nearest.sort((a, b) => (b.rssi - a.rssi));

      if(dynamb) { device.dynamb = dynamb; }
      if(transmitter.statid) { device.statid = transmitter.statid; }
      if(transmitter.tags) { device.tags = transmitter.tags; }
      if(transmitter.url) { device.url = transmitter.url; }

      devices[signature] = device;
    });

    receivers.forEach((receiver) => {
      let signature = receiver.id + SIGNATURE_SEPARATOR + receiver.idType;
      let device = {};

      if(receiver.url) { device.url = receiver.url; }
      if(receiver.directory) { device.directory = receiver.directory; }
      if(receiver.position) { device.position = receiver.position; }

      devices[signature] = device;
    });

    return devices;
  }

  // Iterate a single emulated event and set timeout for the next
  function iterate() {
    let raddec = createRaddec(transmitters[transmitterIndex], receivers);
    let dynamb = createDynamb(transmitters[transmitterIndex]);
    let interval = DEFAULT_UPDATE_CYCLE_MILLISECONDS / transmitters.length;

    eventCallbacks.raddec.forEach((callback) => {
      callback(raddec);
    });
    if(dynamb) {
      eventCallbacks.dynamb.forEach((callback) => {
        callback(dynamb);
      });
    }
    if(isConnect) {
      eventCallbacks.connect.forEach((callback) => callback());
      isConnect = false;
    }

    transmitterIndex = (transmitterIndex + 1) % transmitters.length;
    setTimeout(iterate, interval);
  }

  // Emulate a connection
  let connect = function(url) {
    isConnect = true;
    return this;
  }

  // Get the (emulated) context for a specific route
  let getContext = function(route) {
    return { devices: createDevices(route) };
  };

  // Register a callback for the given event type
  let setEventCallback = function(event, callback) {
    if(!(callback && (typeof callback === 'function'))) { 
      return;
    }
    if(eventCallbacks.hasOwnProperty(event)) {
      eventCallbacks[event].push(callback);
      if(!isEmulating) {
        iterate();
        isEmulating = true;
      }
    }
  };

  // Expose the following functions and variables
  return {
    on: setEventCallback,
    getContext: getContext,
    connect: connect
  }

}());
