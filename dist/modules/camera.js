export class StripCamera {
  constructor(video) {
    this.video = video;
    this.stream = null;
  }

  async open() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera is unavailable in this browser.');
    this.close();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } } });
    this.video.srcObject = this.stream;
    await this.video.play();
  }

  capture() {
    if (!this.stream || !this.video.videoWidth) throw new Error('Wait for the camera picture, then snap.');
    return frameFromSource(this.video, this.video.videoWidth, this.video.videoHeight);
  }

  close() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
  }
}

export function imageDataFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type.startsWith('image/')) return reject(new Error('Choose a photo of your strip.'));
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        resolve(frameFromSource(image, image.naturalWidth, image.naturalHeight));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That photo could not be opened. Try another one.'));
    };
    image.src = url;
  });
}

function frameFromSource(source, width, height) {
  if (!width || !height) throw new Error('Wait for the picture, then try again.');
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1200 / Math.max(width, height));
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return { canvas, image: context.getImageData(0, 0, canvas.width, canvas.height) };
}
