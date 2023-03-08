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

    try {
      return parseAsStory(JSON.parse(html.substring(startIndex, stopIndex)));
    }
    catch(error) {
      return null;
    }
  }

  // Parse the given JSON as a standardised story
  function parseAsStory(data) {
    // Handle standard reelyActive API response case
    if(data.hasOwnProperty('stories')) {
      let storyId = Object.keys(data.stories)[0];
      let story = data.stories[storyId];

      return story;
    }

    return data;
  }

  // Perform a HTTP GET on the given URL with the given accept headers
  function retrieve(url, acceptHeaders, callback) {
    fetch(url, { headers: { "Accept": acceptHeaders } })
      .then((response) => {
        if(!response.ok) { throw new Error('GET returned ' + response.status); }
        let contentType = response.headers.get('Content-Type');
        if(contentType.startsWith('application/json')) {
          return response.json();
        }
        return response.text();
      })
      .then((result) => { return callback(result); })
      .catch((error) => { return callback(null); });
  }

  // Get the associations for the given device signature
  function retrieveAssociations(serverUrl, deviceSignature, options, callback) {
    options = options || {};
    let url = serverUrl + '/associations/' + deviceSignature;

    retrieve(url, 'application/json', (data) => {
      let deviceAssociations = null;
      let isStoryBeingRetrieved = false;
      let isJsonData = (typeof data === 'object');

      if(isJsonData) {
        let returnedDeviceId = null;
        if(data.hasOwnProperty('associations')) { // chickadee v1.x
          returnedDeviceSignature = Object.keys(data.associations)[0];
          deviceAssociations = data.associations[returnedDeviceSignature];
        }
        else if(data.hasOwnProperty('devices')) { // chickadee v0.x
          returnedDeviceSignature = Object.keys(data.devices)[0];
          deviceAssociations = data.devices[returnedDeviceSignature];
        }
        associations.set(deviceSignature, deviceAssociations);
        associations.set(returnedDeviceSignature, deviceAssociations);

        if(options.isStoryToBeRetrieved && deviceAssociations.url) {
          isStoryBeingRetrieved = true;
          retrieveStory(deviceAssociations.url, options,
                        (story, isRetrievedFromMemory) => {
            return callback(deviceAssociations, story, isRetrievedFromMemory);
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
      return callback(stories.get(storyUrl), true);
    }

    retrieve(storyUrl, 'application/json, text/plain', (data) => {
      if(!data) { return callback(null, false); }

      let isJsonData = (typeof data === 'object');
      story = isJsonData ? parseAsStory(data) : extractFromHtml(data);
      if(story) { stories.set(storyUrl, story); }

      return callback(story, false);
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
