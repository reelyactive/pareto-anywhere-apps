/**
 * Copyright reelyActive 2022
 * We believe in an open Internet of Things
 */


let starling = (function() {

  // Internal constants
  let DEFAULT_TRANSMITTERS = [
      { id: "fee150bada55", idType: 2, dynambProperties: [] },
      { id: "ac233fa00001", idType: 2, dynambProperties: [ 'acceleration' ] },
      { id: "ac233fa00002", idType: 2,
        dynambProperties: [ 'temperature', 'relativeHumidity' ] },
      { id: "ac233fa00003", idType: 2,
        dynambProperties: [ 'isButtonPressed' ] },
      { id: "e50000000001", idType: 3,
        dynambProperties: [ 'illuminance', 'isMotionDetected' ]  },
      { id: "e50010000002", idType: 3 ,
        dynambProperties: [ 'acceleration', 'illuminance', 'isContactDetected',
                            'isMotionDetected', 'temperature',
                            'relativeHumidity' ]  }

  ];
  let DEFAULT_RECEIVERS = [
      { id: "001bc50940810000", idType: 1 },
      { id: "0b1e6a7e8a40", idType: 2 }
  ];
  let DEFAULT_UPDATE_CYCLE_MILLISECONDS = 4000;

  // Internal variables
  let eventCallbacks = { raddec: [], dynamb: [] };
  let transmitters = DEFAULT_TRANSMITTERS;
  let receivers = DEFAULT_RECEIVERS;
  let transmitterIndex = 0;
  let isEmulating = false;

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
        return Math.round(Math.random() * 10000);
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

    transmitterIndex = (transmitterIndex + 1) % transmitters.length;
    setTimeout(iterate, interval);
  }

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
  }

  // Expose the following functions and variables
  return {
    on: setEventCallback
  }

}());
