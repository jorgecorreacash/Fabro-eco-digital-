import assert from 'node:assert/strict';
import {
  buildTrustedShellWebPreferences,
  buildUntrustedPortalWebPreferences,
  evaluatePermissionRequest,
  isDangerousDownloadFilename,
  sanitizePartitionKey,
  validateExternalNavigationUrl,
} from '../src/main/security';

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`PASS: ${name}`);
}

test('untrusted portal WebPreferences enforce full sandbox & isolation', () => {
  const prefs = buildUntrustedPortalWebPreferences('persist:fabro_profile_estudiante1');
  assert.equal(prefs.nodeIntegration, false);
  assert.equal(prefs.nodeIntegrationInWorker, false);
  assert.equal(prefs.nodeIntegrationInSubFrames, false);
  assert.equal(prefs.contextIsolation, true);
  assert.equal(prefs.sandbox, true);
  assert.equal(prefs.webSecurity, true);
  assert.equal(prefs.allowRunningInsecureContent, false);
  assert.equal(prefs.preload, undefined);
});

test('trusted FABRO shell WebPreferences restrict Node and enforce sandbox + preload', () => {
  const prefs = buildTrustedShellWebPreferences('/app/preload.js');
  assert.equal(prefs.nodeIntegration, false);
  assert.equal(prefs.contextIsolation, true);
  assert.equal(prefs.sandbox, true);
  assert.equal(prefs.webSecurity, true);
  assert.equal(prefs.preload, '/app/preload.js');
});

test('sanitizePartitionKey isolates profile storage safely', () => {
  assert.equal(sanitizePartitionKey('tesis 2026/a'), 'persist:fabro_profile_tesis_2026_a');
});

test('validateExternalNavigationUrl blocks dangerous protocols and local SSRF targets', () => {
  assert.equal(validateExternalNavigationUrl('https://chatgpt.com/').valid, true);
  assert.equal(validateExternalNavigationUrl('file:///C:/Windows/System32/cmd.exe').valid, false);
  assert.equal(validateExternalNavigationUrl('javascript:alert(1)').valid, false);
  assert.equal(validateExternalNavigationUrl('http://127.0.0.1:3000/').valid, false);
});

test('isDangerousDownloadFilename blocks Windows executables and permits PDFs', () => {
  assert.equal(isDangerousDownloadFilename('instalador.exe'), true);
  assert.equal(isDangerousDownloadFilename('payload.bat'), true);
  assert.equal(isDangerousDownloadFilename('codigo_civil.pdf'), false);
});

test('evaluatePermissionRequest denies camera/mic by default unless explicitly granted', () => {
  assert.equal(evaluatePermissionRequest('https://chatgpt.com', 'media', {}), false);
  assert.equal(
    evaluatePermissionRequest('https://chatgpt.com', 'media', {
      'https://chatgpt.com': { media: true },
    }),
    true
  );
  assert.equal(evaluatePermissionRequest('https://chatgpt.com', 'openExternal', {}), false);
});

console.log(`All ${passed} Electron Windows security tests passed.`);
