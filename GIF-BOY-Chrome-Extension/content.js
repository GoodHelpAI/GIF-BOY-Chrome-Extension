let captureInterval;
let frames = [];
let isCapturing = false;
let settings = {};
let isProcessing = false;
let currentFrameIndex = 0;
let gif = null;

// Load GIF.js script
const script = document.createElement('script');
script.src = chrome.runtime.getURL('gif.js');
document.head.appendChild(script);

script.onload = function() {
  console.log('GIF.js loaded');
};

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'startCapture') {
    startCapture(request.settings);
    sendResponse({status: 'started'});
  } else if (request.action === 'stopCapture') {
    stopCapture();
    sendResponse({status: 'stopped'});
  }
  return true;
});

function startCapture(captureSettings) {
  settings = captureSettings;
  frames = [];
  isCapturing = true;
  isProcessing = false;
  currentFrameIndex = 0;
  
  const captureFrame = () => {
    if (!isCapturing) return;
    
    try {
      html2canvas(document.body, {
        scale: settings.resolution,
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: null,
        logging: false,
        useCORS: true,
        allowTaint: true,
        foreignObjectRendering: true,
        imageTimeout: 0,
        removeContainer: true,
        onclone: (clonedDoc) => {
          const images = clonedDoc.getElementsByTagName('img');
          for (let img of images) {
            if (!img.complete) {
              img.crossOrigin = 'anonymous';
            }
          }
        }
      }).then(canvas => {
        try {
          // Convert canvas to ImageData
          const ctx = canvas.getContext('2d');
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          frames.push({
            data: Array.from(imageData.data),
            width: canvas.width,
            height: canvas.height
          });
          
          // Update progress
          const progress = (frames.length / (settings.duration * settings.fps)) * 100;
          chrome.runtime.sendMessage({
            action: 'updateProgress',
            progress: Math.min(progress, 100)
          });
          
          // Check if we've captured enough frames
          if (frames.length >= settings.duration * settings.fps) {
            stopCapture();
          }
        } catch (error) {
          console.error('Frame processing error:', error);
          stopCapture();
        }
      }).catch(error => {
        console.error('Canvas capture error:', error);
        stopCapture();
      });
    } catch (error) {
      console.error('Frame capture error:', error);
      stopCapture();
    }
  };
  
  // Start capturing frames
  captureInterval = setInterval(captureFrame, 1000 / settings.fps);
  captureFrame(); // Capture first frame immediately
}

function stopCapture() {
  isCapturing = false;
  
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
  
  if (frames.length > 0 && !isProcessing) {
    processFrames();
  }
}

function processFrames() {
  if (isProcessing) return;
  isProcessing = true;
  
  try {
    // Calculate dimensions
    const width = Math.floor(window.innerWidth * settings.resolution);
    const height = Math.floor(window.innerHeight * settings.resolution);
    
    // Initialize GIF encoder
    gif = new GIF({
      workers: 1,
      quality: settings.quality,
      width: width,
      height: height,
      workerScript: chrome.runtime.getURL('gif.worker.js')
    });

    gif.on('finished', function(blob) {
      handleGIFComplete(blob);
    });

    gif.on('error', function(error) {
      handleGIFError(error.message);
    });

    // Start adding frames
    addNextFrame();
  } catch (error) {
    console.error('Frame processing error:', error);
    handleGIFError(error.message);
  }
}

function addNextFrame() {
  if (currentFrameIndex >= frames.length) {
    return;
  }

  try {
    const frame = frames[currentFrameIndex];
    const delay = 1000 / settings.fps;
    
    // Create ImageData from the stored data
    const imageData = new ImageData(
      new Uint8ClampedArray(frame.data),
      frame.width,
      frame.height
    );
    
    gif.addFrame(imageData, {delay: delay});
    gif.render();
    
    currentFrameIndex++;
    if (currentFrameIndex < frames.length) {
      // Add a small delay between frames
      setTimeout(addNextFrame, 50);
    }
  } catch (error) {
    console.error('Error adding frame:', error);
    handleGIFError(error.message);
  }
}

function handleGIFComplete(blob) {
  try {
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `animation-${Date.now()}.gif`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    chrome.runtime.sendMessage({action: 'captureComplete'});
  } catch (error) {
    console.error('Error saving GIF:', error);
    handleGIFError(error.message);
  } finally {
    isProcessing = false;
    currentFrameIndex = 0;
  }
}

function handleGIFError(error) {
  console.error('GIF generation error:', error);
  chrome.runtime.sendMessage({
    action: 'captureError',
    error: 'Failed to generate GIF: ' + error
  });
  isProcessing = false;
  currentFrameIndex = 0;
}