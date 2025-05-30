let isRecording = false;

document.addEventListener('DOMContentLoaded', function() {
  const captureBtn = document.getElementById('captureBtn');
  const stopBtn = document.getElementById('stopBtn');
  const status = document.getElementById('status');
  const progressBar = document.getElementById('progressBar');
  const progressFill = document.getElementById('progressFill');
  const qualitySlider = document.getElementById('quality');
  const qualityValue = document.getElementById('qualityValue');
  
  // Update quality display
  qualitySlider.addEventListener('input', function() {
    const value = parseInt(this.value);
    let text = 'Low';
    if (value > 15) text = 'Ultra';
    else if (value > 10) text = 'High';
    else if (value > 5) text = 'Medium';
    qualityValue.textContent = text;
  });
  
  // Load saved settings
  chrome.storage.local.get(['resolution', 'fps', 'duration', 'quality'], function(items) {
    if (items.resolution) document.getElementById('resolution').value = items.resolution;
    if (items.fps) document.getElementById('fps').value = items.fps;
    if (items.duration) document.getElementById('duration').value = items.duration;
    if (items.quality) {
      document.getElementById('quality').value = items.quality;
      qualitySlider.dispatchEvent(new Event('input'));
    }
  });
  
  captureBtn.addEventListener('click', async function() {
    if (isRecording) return;
    
    // Save settings
    const settings = {
      resolution: parseFloat(document.getElementById('resolution').value),
      fps: parseInt(document.getElementById('fps').value),
      duration: parseFloat(document.getElementById('duration').value),
      quality: parseInt(document.getElementById('quality').value)
    };
    
    chrome.storage.local.set(settings);
    
    // Update UI
    isRecording = true;
    captureBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    status.className = 'status recording';
    status.textContent = 'Recording animation...';
    progressBar.classList.add('active');
    
    // Send message to content script
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    chrome.tabs.sendMessage(tab.id, {
      action: 'startCapture',
      settings: settings
    }, function(response) {
      if (chrome.runtime.lastError) {
        showError('Failed to start capture. Please refresh the page and try again.');
        resetUI();
      }
    });
  });
  
  stopBtn.addEventListener('click', async function() {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    chrome.tabs.sendMessage(tab.id, {action: 'stopCapture'});
    resetUI();
  });
  
  // Listen for messages from content script
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'updateProgress') {
      progressFill.style.width = request.progress + '%';
    } else if (request.action === 'captureComplete') {
      status.className = 'status success';
      status.textContent = 'GIF saved successfully!';
      progressBar.classList.remove('active');
      resetUI();
      setTimeout(() => {
        status.style.display = 'none';
      }, 3000);
    } else if (request.action === 'captureError') {
      showError(request.error);
      resetUI();
    }
  });
  
  function resetUI() {
    isRecording = false;
    captureBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    progressFill.style.width = '0%';
    progressBar.classList.remove('active');
  }
  
  function showError(message) {
    status.className = 'status error';
    status.textContent = message;
    setTimeout(() => {
      status.style.display = 'none';
    }, 5000);
  }
});