import assert from 'node:assert/strict';
import {
  getTranslateServiceUrl,
  isDangerousDownloadFile,
  isPdfResource,
  resolveOmniboxInput,
  validateSafeNavigationUrl,
} from './platformBridge';

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`PASS: ${name}`);
}

test('validateSafeNavigationUrl accepts valid HTTPS URLs', () => {
  const res = validateSafeNavigationUrl('https://es.wikipedia.org/wiki/Derecho');
  assert.equal(res.valid, true);
  assert.equal(res.isHttps, true);
  assert.equal(res.hostname, 'es.wikipedia.org');
  assert.equal(res.securityLabel, 'HTTPS Seguro');
});

test('validateSafeNavigationUrl rejects javascript: and file: URIs', () => {
  assert.equal(validateSafeNavigationUrl('javascript:alert(1)').valid, false);
  assert.equal(validateSafeNavigationUrl('file:///etc/passwd').valid, false);
  assert.equal(validateSafeNavigationUrl('data:text/html,<script>').valid, false);
});

test('validateSafeNavigationUrl blocks private LAN & metadata hosts', () => {
  assert.equal(validateSafeNavigationUrl('http://127.0.0.1:8080/').valid, false);
  assert.equal(validateSafeNavigationUrl('http://169.254.169.254/latest/meta-data').valid, false);
  assert.equal(validateSafeNavigationUrl('https://192.168.1.1/').valid, false);
});

test('resolveOmniboxInput resolves domains vs search queries', () => {
  const domainRes = resolveOmniboxInput('openalex.org', 'google');
  assert.equal(domainRes.isSearch, false);
  assert.equal(domainRes.validation.normalizedUrl, 'https://openalex.org/');

  const searchRes = resolveOmniboxInput('derecho constitucional argentino', 'scholar');
  assert.equal(searchRes.isSearch, true);
  assert.ok(searchRes.validation.normalizedUrl.startsWith('https://scholar.google.com/scholar?q='));
});

test('isDangerousDownloadFile flags risky executables and permits PDFs', () => {
  assert.equal(isDangerousDownloadFile('setup.exe'), true);
  assert.equal(isDangerousDownloadFile('script.ps1'), true);
  assert.equal(isDangerousDownloadFile('manual-derecho.pdf'), false);
});

test('isPdfResource identifies PDF filenames and MIME types', () => {
  assert.equal(isPdfResource('https://example.org/codigo.pdf?download=1'), true);
  assert.equal(isPdfResource('https://example.org/doc', 'application/pdf'), true);
  assert.equal(isPdfResource('https://example.org/index.html', 'text/html'), false);
});

test('getTranslateServiceUrl encodes target URL safely', () => {
  const url = getTranslateServiceUrl('https://en.wikipedia.org/wiki/Jurisprudence');
  assert.ok(url.includes('translate.google.com'));
  assert.ok(url.includes(encodeURIComponent('https://en.wikipedia.org/wiki/Jurisprudence')));
});

console.log(`All ${passed} browser platformBridge tests passed.`);
