import test from 'node:test';
import assert from 'node:assert/strict';
import { requestUrl } from '../server/request-url.mjs';

test('untrusted forwarded headers cannot change the request origin', () => {
  const url = requestUrl('/api/budget', { host: 'localhost:5173', 'x-forwarded-proto': 'https' });
  assert.equal(url.origin, 'http://localhost:5173');
});

test('a trusted HTTPS proxy preserves the browser origin for same-origin checks', () => {
  const url = requestUrl('/api/budget', { host: 'barra-demo.azurewebsites.net', 'x-forwarded-proto': 'https' }, true);
  assert.equal(url.origin, new URL('https://barra-demo.azurewebsites.net').origin);
  assert.equal(url.pathname, '/api/budget');
});

test('internal HTTP supplier calls remain HTTP behind the proxy', () => {
  assert.equal(requestUrl('/api/supplier/quote', { host: '127.0.0.1:8080' }, true).origin, 'http://127.0.0.1:8080');
  assert.equal(requestUrl('/', { host: 'localhost', 'x-forwarded-proto': 'javascript' }, true).protocol, 'http:');
});
