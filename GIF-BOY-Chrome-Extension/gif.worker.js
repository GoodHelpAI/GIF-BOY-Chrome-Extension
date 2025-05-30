importScripts('gif.js');

self.onmessage = function(e) {
  const { data, width, height, quality } = e.data;
  const gif = new GIF({
    workers: 1,
    quality: quality,
    width: width,
    height: height
  });
  
  gif.addFrame(data);
  gif.on('finished', function(blob) {
    self.postMessage({ type: 'finished', blob: blob });
  });
  
  gif.render();
};