import { placeholder } from '../ui/screen.js';

export function render() {
  return placeholder({
    emoji: '🥁',
    title: 'Your practice tools',
    lines: [
      'A metronome to keep time, plus trainers to build smooth, confident playing.',
      'The metronome is up next in Phase 1.',
    ],
  });
}
