import { placeholder } from '../ui/screen.js';

export function render() {
  return placeholder({
    emoji: '🌱',
    title: 'Your lessons live here',
    lines: [
      'Step-by-step lessons that start from the very beginning — no experience needed.',
      'Coming together now in Phase 1.',
    ],
  });
}
