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
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1200 / Math.max(this.video.videoWidth, this.video.videoHeight));
    canvas.width = Math.round(this.video.videoWidth * scale);
    canvas.height = Math.round(this.video.videoHeight * scale);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(this.video, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    this.close();
    return { canvas, image };
  }

  close() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.srcObject = null;
  }
}
