/**
 * Copyright reelyActive 2016-2023
 * We believe in an open Internet of Things
 */


let cormorant = (function() {

  // Internal constants
  const STATUS_OK = 200;
  const SIGNATURE_SEPARATOR = '/';

  // Internal variables
  let associations = new Map();
  let stories = new Map();

  // Extract the JSON-LD, if present, from the given HTML
  function extractFromHtml(html) {
    let tagIndex = html.search(/(<script\s*?type\s*?=\s*?"application\/ld\+json">)/);
    if(tagIndex < 0) {
      return null;
    }
    let startIndex = html.indexOf('>', tagIndex) + 1;
    let stopIndex = html.indexOf('</script>', startIndex);
    let jsonString = html.substring(startIndex, stopIndex);
    
    return parseAsStory(jsonString);
  }

  // Parse the given stringified JSON as a standardised story
  function parseAsStory(jsonString) {
    let json = null;

    try {
      json = JSON.parse(jsonString);

      // Handle standard reelyActive API response case
      if(json.hasOwnProperty('stories')) {
        let storyId = Object.keys(json.stories)[0];
        let story = json.stories[storyId];
        return story;
      }
    }
    catch(e) { }

    return json;
  }

  // Perform a HTTP GET on the given URL with the given accept headers
  function retrieve(url, acceptHeaders, callback) {
    let httpRequest = new XMLHttpRequest();

    httpRequest.onreadystatechange = () => {
      if(httpRequest.readyState === XMLHttpRequest.DONE) {
        let contentType = httpRequest.getResponseHeader('Content-Type');
        return callback(httpRequest.status, httpRequest.responseText,
                        contentType);
      }
    };
    httpRequest.open('GET', url);
    httpRequest.setRequestHeader('Accept', acceptHeaders);
    httpRequest.send();
  }

  // Get the associations for the given device signature
  function retrieveAssociations(serverUrl, deviceSignature, options, callback) {
    options = options || {};
    let url = serverUrl + '/associations/' + deviceSignature;

    retrieve(url, 'application/json', (status, responseText) => {
      let deviceAssociations = null;
      let isStoryBeingRetrieved = false;

      if(status === STATUS_OK) {
        let response = JSON.parse(responseText);
        let returnedDeviceId = null;
        if(response.hasOwnProperty('associations')) { // chickadee v1.x
          returnedDeviceSignature = Object.keys(response.associations)[0];
          deviceAssociations = response.associations[returnedDeviceSignature];
        }
        else if(response.hasOwnProperty('devices')) { // chickadee v0.x
          returnedDeviceSignature = Object.keys(response.devices)[0];
          deviceAssociations = response.devices[returnedDeviceSignature];
        }
        associations.set(deviceSignature, deviceAssociations);
        associations.set(returnedDeviceSignature, deviceAssociations);

        if(options.isStoryToBeRetrieved && deviceAssociations.url) {
          isStoryBeingRetrieved = true;
          retrieveStory(deviceAssociations.url, options, (story, status) => {
            return callback(deviceAssociations, story, status);
          });
        }
      }

      if(!isStoryBeingRetrieved) {
        return callback(deviceAssociations);
      }
    });
  }

  // Get the story for the given URL
  function retrieveStory(storyUrl, options, callback) {
    options = options || {};

    if(stories.has(storyUrl) && !options.isStoryToBeRefetched) {
      return callback(stories.get(storyUrl), undefined);
    }

    retrieve(storyUrl, 'application/json, text/plain',
             (status, responseText, contentType) => {
      if(status !== STATUS_OK) {
        return callback(null, status);
      }

      let isJson = (contentType.indexOf('application/json') === 0);
      let story;
      if(isJson) {
        story = parseAsStory(responseText);
      }
      else {
        story = extractFromHtml(responseText);
      }
      if(story) {
        stories.set(storyUrl, story);
      }
      return callback(story, status);
    });
  }

  // Expose the following functions and variables
  return {
    retrieveAssociations: retrieveAssociations,
    retrieveStory: retrieveStory,
    associations: associations,
    stories: stories
  }

}());
