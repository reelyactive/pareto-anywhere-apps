/**
 * Copyright reelyActive 2026
 * We believe in an open Internet of Things
 */


// Constant definitions
const ASSOCIATIONS_ROUTE = '/associations';


// DOM elements
let availableMessage = document.querySelector('#availableMessage');
let unavailableMessage = document.querySelector('#unavailableMessage');
let numberOfAssociations = document.querySelector('#numberOfAssociations');
let numberOfCreatedAssociations =
                        document.querySelector('#numberOfCreatedAssociations');
let numberOfUpdatedAssociations =
                        document.querySelector('#numberOfUpdatedAssociations');
let statusAlert = document.querySelector('#statusAlert');
let csvInput = document.querySelector('#csvInput');


// Other variables
let baseUrl = window.location.protocol + '//' + window.location.hostname +
              ':' + window.location.port;
let associationsUpdateIndex; // TODO: include these in a
let associationsUpdateCount; //       progress bar?


// Handle file inputs
csvInput.addEventListener('change', handleCsvUpdate);


// Start by confirming that the /associations API is available
getAssociations(updateDisplayedElements);


// Handle a CSV update
function handleCsvUpdate(event) {
  let file = csvInput.files[0];
  statusAlert.hidden = true;

  if(!file || (file.type !== 'text/csv')) {
    csvInput.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    let associations = csvToAssociations(reader.result);

    updateAssociations(associations, (numberCreated, numberUpdated) => {
      numberOfCreatedAssociations.textContent = numberCreated;
      numberOfUpdatedAssociations.textContent = numberUpdated;
      statusAlert.hidden = false;
      getAssociations(updateDisplayedElements);
    });
  };
  reader.onerror = () => { }; // TODO: handle errors
  reader.readAsText(file);
}


// Convert the given CSV file data to a list of associations
function csvToAssociations(csvData) {
  let associations = {};
  let rows = csvData.split(/\r?\n/);
  let columnHeaders = rows.shift().split(',');
  let propertyIndexes = createPropertyIndexes(columnHeaders);
  if(!propertyIndexes) {
    return console.log('Invalid column headers:', columnHeaders);
  }

  rows.forEach((row, index) => {
    let rowData = toDataArray(row);
    let entry = createAssociation(propertyIndexes, rowData);

    if(entry) {
      associations[entry.deviceSignature] = entry.association;
    }
  });

  return associations;
}


// Establish the index of each property from the column headers
function createPropertyIndexes(columnHeaders) {
  if(!columnHeaders.includes('deviceId') ||
     !columnHeaders.includes('deviceIdType')) {
    return null;
  }

  let indexes = {};

  columnHeaders.forEach((column, index) => {
    indexes[column] = index;
  });

  return indexes;
}


// Create the association entry from the given columns of data
function createAssociation(propertyIndexes, rowData) {
  if(!rowData[propertyIndexes.deviceId] ||
     !rowData[propertyIndexes.deviceIdType]) {
    return null;
  }

  let deviceSignature = formatId(rowData[propertyIndexes.deviceId]) + '/' +
                        rowData[propertyIndexes.deviceIdType];
  let association = {};

  if(propertyIndexes.hasOwnProperty('url') &&
     isValidUrl(rowData[propertyIndexes.url])) {
    association.url = rowData[propertyIndexes.url];
  }
  if(propertyIndexes.hasOwnProperty('directory') &&
     (typeof rowData[propertyIndexes.directory] === 'string')) {
    association.directory = rowData[propertyIndexes.directory];
  }
  if(propertyIndexes.hasOwnProperty('tags') &&
     (typeof rowData[propertyIndexes.tags] === 'string')) {
    association.tags = rowData[propertyIndexes.tags].split(',');
  }
  if(propertyIndexes.hasOwnProperty('x') &&
     propertyIndexes.hasOwnProperty('y')) {
    let position;
    let x = parseFloat(rowData[propertyIndexes.x]);
    let y = parseFloat(rowData[propertyIndexes.y]);

    if((x !== NaN) && (y !== NaN)) { position = [ x, y ]; }

    if(Array.isArray(position) && propertyIndexes.hasOwnProperty('z')) {
      let z = parseFloat(rowData[propertyIndexes.z]);

      if(z !== NaN) { position.push(z); }
      else { position = null; }
    }

    if(Array.isArray(position)) { association.position = position }
  }

  return { deviceSignature: deviceSignature, association: association };
}


// Split the given line based on the CSV separator,
// handling the case where strings include the separator
function toDataArray(line) {
  let columns = line.split(',');

  columns.forEach((column, index) => {
    let isSplitString = (countOccurrences(column, '"') % 2 === 1);
    if(isSplitString) {
      let mergedColumn = column + ',' + columns[index + 1];
      columns.splice(index, 2, mergedColumn);
    }
  });

  return columns;
}


// Count the occurences of the given character in the given string
function countOccurrences(string, character) {
  return [...string].filter((item) => item === character).length;
}


// Convert the given identifier to a valid identifier string, if possible.
function formatId(identifier) {
  let hexIdentifier = identifier.replace(/[^A-Fa-f0-9]/g, '');
  return hexIdentifier.toLowerCase();
}


// Check if the given string is a valid URL
function isValidUrl(string) {
  try {
    let url = new URL(string);
    return true;
  }
  catch (err) { return false; }
}


// Updated the displayed elements based on whether the API is available or not
function updateDisplayedElements(isApiAvailable) {
  availableMessage.hidden = !isApiAvailable;
  unavailableMessage.hidden = isApiAvailable;
  updateSection.hidden = !isApiAvailable;
}


// GET all associations
function getAssociations(callback) {
  retrieve(baseUrl + ASSOCIATIONS_ROUTE, (data) => {
    if(data?.associations) {
      numberOfAssociations.textContent = Object.keys(data.associations).length;
      return callback(true);
    }
    return callback(false);
  });
}


// Update the associations sequentially
function updateAssociations(associations, callback) {
  let deviceSignatures = Object.keys(associations);
  let numberCreated = 0;
  let numberUpdated = 0;
  associationsUpdateIndex = 0;
  associationsUpdateCount = deviceSignatures.length;

  updateNextAssociation(() => {
    return callback(numberCreated, numberUpdated);
  });

  // Uses self-iteration to update each association
  function updateNextAssociation(callback) {
    let deviceSignature = deviceSignatures[associationsUpdateIndex];
    let association = associations[deviceSignature];

    putAssociation(deviceSignature, association, (status) => {
      if(status === 200) { numberUpdated++; }
      if(status === 201) { numberCreated++; }
      if(++associationsUpdateIndex < associationsUpdateCount) {
        updateNextAssociation(callback);
      }
      else {
        return callback();
      }
    });
  }
}


// PUT the given association
function putAssociation(deviceSignature, association, callback) {
  let url = baseUrl + ASSOCIATIONS_ROUTE + '/' + deviceSignature;
  let httpRequest = new XMLHttpRequest();
  let associationString = JSON.stringify(association);

  httpRequest.onreadystatechange = () => {
    if(httpRequest.readyState === XMLHttpRequest.DONE) {
      if((httpRequest.status === 200) ||
         (httpRequest.status === 201)) {
        return callback(httpRequest.status,
                        JSON.parse(httpRequest.responseText));
      }
      else {
        return callback(httpRequest.status);
      }
    }
  };
  httpRequest.open('PUT', url);
  httpRequest.setRequestHeader('Content-Type', 'application/json');
  httpRequest.setRequestHeader('Accept', 'application/json');
  httpRequest.send(associationString);
}


// Perform a HTTP GET on the given URL
function retrieve(url, callback) {
  fetch(url, { headers: { "Accept": "application/json" } })
    .then((response) => {
      if(!response.ok) { throw new Error('GET returned ' + response.status); }
      let contentType = response.headers.get('Content-Type');
      if(contentType.startsWith('application/json')) {
        return response.json();
      }
      return null;
    })
    .then((result) => { return callback(result); })
    .catch((error) => { return callback(null); });
}