import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Uses the installed Vite/React runtime; no new test dependency or backend access.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
try {
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { pathname: '/', search: '' } });
  const { Button, Chip, LoadingState } = await server.ssrLoadModule('/src/components/customer-ui.tsx');
  const { ProjectShell } = await server.ssrLoadModule('/src/app/ProjectShell.tsx');
  const { AppLocaleProvider, appTranslations } = await server.ssrLoadModule('/src/i18n/app-locale.tsx');
  const { Router } = await server.ssrLoadModule('wouter');
  const busy = renderToStaticMarkup(h(Button, { loading: true }, 'Saving'));
  assert.match(busy, /disabled=""/);
  assert.match(busy, /aria-busy="true"/);
  assert.match(busy, /type="button"/);
  assert.match(renderToStaticMarkup(h(Button, { type: 'submit' }, 'Save')), /type="submit"/);
  assert.match(renderToStaticMarkup(h(Chip, { selected: true }, 'All')), /aria-pressed="true"/);
  assert.match(renderToStaticMarkup(h(Chip, { selected: false, disabled: true }, 'Unavailable')), /disabled=""/);
  assert.match(renderToStaticMarkup(h(LoadingState, { label: 'Loading' })), /role="status"/);
  for (const locale of ['ar', 'en']) {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => locale } });
    for (const type of ['wedding', 'party']) {
      const root = type === 'wedding' ? 'weddings' : 'parties';
      const markup = renderToStaticMarkup(h(AppLocaleProvider, null, h(Router, { ssrPath: `/${root}/fixture/guests` }, h(ProjectShell, { project: { id: 'fixture', type, name: 'Example', date: '', venue: '' }, section: 'guests' }, 'Content'))));
      for (const section of ['overview', 'invitation', 'guests', 'send', 'scanner', 'settings']) {
        assert.ok(markup.includes(`href="/${root}/fixture/${section}"`), `${locale}/${type}: missing ${section}`);
      }
      assert.equal((markup.match(/aria-current="page"/g) ?? []).length, 2, 'Desktop and mobile expose the same current destination');
      assert.ok(markup.includes(appTranslations[locale].guests));
    }
  }
  // Check actual semantic text/background pairs, including muted and status text.
  const css = await readFile(new URL('../src/customer-ui.css', import.meta.url), 'utf8');
  const tokens = Object.fromEntries([...css.matchAll(/--qr-([\w-]+): (#[\da-f]{6});/g)].map(m => [m[1], m[2]]));
  const luminance = hex => hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  for (const [fg, bg] of [['text', 'canvas'], ['secondary', 'surface'], ['muted', 'surface'], ['placeholder', 'surface'], ['on-primary', 'primary'], ['on-gold', 'gold-subtle'], ...['success', 'warning', 'error', 'info'].map(t => [t, `${t}-subtle`])]) {
    const values = [luminance(tokens[fg]), luminance(tokens[bg])].sort((a, b) => b - a);
    const contrast = (values[0] + .05) / (values[1] + .05);
    assert.ok(contrast >= 4.5, `${fg}/${bg} contrast ${contrast.toFixed(2)} < 4.5`);
  }
  console.log('PASS: loading/disabled controls, chip semantics, AR/EN Wedding/Party navigation, 10 text contrast pairs.');
} finally {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
  if (originalLocation) Object.defineProperty(globalThis, 'location', originalLocation);
  else delete globalThis.location;
  await server.close();
}
