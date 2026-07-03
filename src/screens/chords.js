import { placeholder } from '../ui/screen.js';

export function render() {
  return placeholder({
    emoji: '🎸',
    title: 'A friendly chord library',
    lines: [
      'Clear finger-by-finger diagrams for every chord you learn.',
      'Left-handed? Turn on Left-handed mode in Settings and every diagram flips for you.',
    ],
  });
}
