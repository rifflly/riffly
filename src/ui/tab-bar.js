/**
 * Bottom tab bar. Large touch targets (rule: min 44px) with icon + label.
 */
import { el, clear } from './dom.js';
import { icon } from './icons.js';
import { ROUTES } from '../config.js';

/**
 * @param {HTMLElement} host
 * @param {string} activePath
 * @param {(path:string)=>void} onSelect
 */
export function renderTabBar(host, activePath, onSelect) {
  clear(host);
  host.setAttribute('aria-label', 'Main navigation');
  for (const route of ROUTES) {
    const isActive = route.path === activePath;
    const btn = el(
      'button',
      {
        class: `tab${isActive ? ' is-active' : ''}`,
        type: 'button',
        'aria-current': isActive ? 'page' : null,
        onclick: () => onSelect(route.path),
      },
      icon(route.icon, 24),
      el('span', { class: 'tab-label' }, route.label)
    );
    host.append(btn);
  }
}
