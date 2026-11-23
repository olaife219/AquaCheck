const hexToRgb = (hex) => hex.match(/\w\w/g).map((part) => parseInt(part, 16));
const distance = (one, two) => Math.sqrt(one.reduce((total, value, index) => total + (value - two[index]) ** 2, 0));

export function samplePatch(imageData, center) {
  const x = Math.round(center.x * (imageData.width - 1));
  const y = Math.round(center.y * (imageData.height - 1));
  const radius = Math.max(2, Math.round(Math.min(imageData.width, imageData.height) * 0.018));
  const pixels = [];

  for (let row = Math.max(0, y - radius); row <= Math.min(imageData.height - 1, y + radius); row++) {
    for (let column = Math.max(0, x - radius); column <= Math.min(imageData.width - 1, x + radius); column++) {
      const offset = (row * imageData.width + column) * 4;
      if (imageData.data[offset + 3] > 200) pixels.push([imageData.data[offset], imageData.data[offset + 1], imageData.data[offset + 2]]);
    }
  }
  if (!pixels.length) return { error: 'We could not see the coloured part. Try again.' };

  const rgb = [0, 1, 2].map((channel) => {
    const values = pixels.map((pixel) => pixel[channel]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  });
  const brightness = rgb.reduce((total, value) => total + value, 0) / 3;
  const variation = Math.sqrt(pixels.reduce((total, pixel) => total + pixel.reduce((sum, value, index) => sum + (value - rgb[index]) ** 2, 0) / 3, 0) / pixels.length);

  if (brightness < 30) return { error: 'The photo is too dark. Move to a brighter place and snap again.' };
  if (brightness > 240) return { error: 'There is too much glare. Move away from bright reflections and snap again.' };
  if (variation > 28) return { error: 'The colour is not clear. Keep the strip flat and inside the square.' };
  return { rgb };
}

export function classifyColour(rgb, profile) {
  const matches = profile.colors
    .map(({ ph, color }) => ({ ph, color, distance: distance(rgb, hexToRgb(color)) }))
    .sort((one, two) => one.distance - two.distance);
  if (matches[0].distance > 70) return { error: 'This strip colour does not match the saved chart. Snap again in even light.' };
  if (matches[1].distance - matches[0].distance < 12) return { error: 'The colour is between two pH values. Snap another clear photo.' };
  return { ph: matches[0].ph, color: `#${rgb.map((value) => value.toString(16).padStart(2, '0')).join('')}` };
}

export function waterType(ph) {
  if (ph < 6.5) return { title: 'High acidity', detail: 'pH below the drinking-water range (6.5–8.5).', tone: 'acidic' };
  if (ph > 8.5) return { title: 'High alkalinity', detail: 'pH above the drinking-water range (6.5–8.5).', tone: 'alkaline' };
  if (ph === 7) return { title: 'Neutral', detail: 'pH within drinking-water range (6.5–8.5).', tone: 'neutral' };
  return { title: ph < 7 ? 'Slightly acidic' : 'Slightly alkaline', detail: 'pH within drinking-water range (6.5–8.5).', tone: 'neutral' };
}
