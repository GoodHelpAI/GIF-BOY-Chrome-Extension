importScripts('gif.js');

let gif = null;
let frameQueue = [];
let isProcessing = false;
let activeTabId = null;

function sendResponseToTab(tabId, message) {
  if (tabId) {
    try {
      chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      console.error('Error sending message to tab:', error);
    }
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);
  
  if (request.action === 'startGIFGeneration') {
    try {
      const { settings } = request;
      activeTabId = sender.tab.id;
      
      // Initialize GIF encoder
      gif = new GIF({
        workers: 1,
        quality: settings.quality,
        width: settings.width,
        height: settings.height,
        workerScript: chrome.runtime.getURL('gif.worker.js')
      });

      gif.on('finished', function(blob) {
        console.log('GIF generation finished');
        sendResponseToTab(activeTabId, {
          action: 'gifComplete',
          blob: blob
        });
        isProcessing = false;
        activeTabId = null;
      });

      gif.on('error', function(error) {
        console.error('GIF generation error:', error);
        sendResponseToTab(activeTabId, {
          action: 'gifError',
          error: error.message
        });
        isProcessing = false;
        activeTabId = null;
      });

      console.log('GIF initialization successful');
      sendResponse({status: 'started'});
    } catch (error) {
      console.error('Error initializing GIF:', error);
      sendResponse({status: 'error', error: error.message});
    }
    return true;
  } else if (request.action === 'addFrame') {
    if (!gif) {
      console.error('GIF not initialized');
      sendResponse({status: 'error', error: 'GIF not initialized'});
      return true;
    }

    if (!isProcessing) {
      try {
        isProcessing = true;
        const { frameData, delay } = request;
        
        // Create ImageData from the received data
        const imageData = new ImageData(
          new Uint8ClampedArray(frameData.data),
          frameData.width,
          frameData.height
        );
        
        console.log('Adding frame to GIF');
        gif.addFrame(imageData, {delay: delay});
        gif.render();
        sendResponse({status: 'frameAdded'});
      } catch (error) {
        console.error('Error adding frame:', error);
        sendResponse({status: 'error', error: error.message});
      } finally {
        isProcessing = false;
      }
    } else {
      console.log('GIF is busy processing');
      sendResponse({status: 'busy'});
    }
    return true;
  }
  return false;
}); 