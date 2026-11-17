import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import {
  resetAntiSpamWindowsForTests,
  setTestTokenVerifierForTests,
} from './authMiddleware.ts';
import {
  createPortalsRouter,
  evaluateFrameHeaders,
  probeExternalPortalHeaders,
} from './portalsRouter.ts';
import {
  INITIAL_AI_BROWSER_PORTALS,
  INITIAL_EXPLORER_PORTALS,
  getPortalsSnapshot,
  resetPortalsStoreForTests,
} from './portalsStore.ts';

async function runTests() {
  const tmpStore = path.join(os.tmpdir(), `fabro-portals-test-${Date.now()}.json`);
  resetPortalsStoreForTests(tmpStore);
  resetAntiSpamWindowsForTests();

  // 1. Verify exact initial catalog counts & untested defaults
  assert.equal(INITIAL_EXPLORER_PORTALS.length, 36, 'Explorer must start with exact 36 portals');
  assert.equal(INITIAL_AI_BROWSER_PORTALS.length, 2, 'AI Browser must start with exact 2 AI portals');

  const explorerCats = new Set(INITIAL_EXPLORER_PORTALS.map((p) => p.categoryName));
  assert.deepEqual(
    explorerCats,
    new Set([
      'Inteligencia Artificial',
      'Buscadores',
      'Investigación Académica',
      'Educación y Conocimiento',
      'Comunidades y Recursos',
      'Argentina',
    ])
  );

  for (const p of [...INITIAL_EXPLORER_PORTALS, ...INITIAL_AI_BROWSER_PORTALS]) {
    assert.equal(p.compatibilityStatus, 'untested', `${p.name} must not be fake-verified before probe`);
    assert.equal(p.iframeAllowed, null);
  }

  // 2. Verify header evaluation logic (NO header stripping, faithful iframe policy reporting)
  const denyResult = evaluateFrameHeaders({
    url: 'https://www.google.com/',
    httpStatus: 200,
    xFrameOptions: 'SAMEORIGIN',
    csp: '',
  });
  assert.equal(denyResult.iframeAllowed, false);
  assert.equal(denyResult.requiresExternal, true);
  assert.equal(denyResult.compatibilityStatus, 'external_required');
  assert.equal(denyResult.openingMode, 'apertura_externa');

  const cspDenyResult = evaluateFrameHeaders({
    url: 'https://chatgpt.com/',
    httpStatus: 200,
    xFrameOptions: '',
    csp: "default-src 'self'; frame-ancestors 'none';",
  });
  assert.equal(cspDenyResult.iframeAllowed, false);
  assert.equal(cspDenyResult.requiresExternal, true);
  assert.equal(cspDenyResult.compatibilityStatus, 'external_required');
  assert.equal(cspDenyResult.cspFrameAncestors, "'none'");

  const openResult = evaluateFrameHeaders({
    url: 'https://www.wikipedia.org/',
    httpStatus: 200,
    xFrameOptions: '',
    csp: "default-src 'self' https:",
  });
  assert.equal(openResult.iframeAllowed, true);
  assert.equal(openResult.requiresExternal, false);
  assert.equal(openResult.compatibilityStatus, 'iframe_compatible');
  assert.equal(openResult.openingMode, 'iframe_integrado');

  // 3. Verify SSRF protection blocks private/loopback probes cleanly
  for (const unsafeUrl of [
    'http://127.0.0.1:3000/',
    'http://localhost/admin',
    'http://169.254.169.254/latest/meta-data',
  ]) {
    const ssrfOutcome = await probeExternalPortalHeaders(unsafeUrl);
    assert.equal(ssrfOutcome.iframeAllowed, false);
    assert.equal(ssrfOutcome.requiresExternal, true);
    assert.equal(ssrfOutcome.compatibilityStatus, 'unreachable');
  }

  // 4. Express Router API & Auth/Admin/Student Persistence Tests
  setTestTokenVerifierForTests(async (token) => {
    if (token === 'token-student-1') {
      return {
        uid: 'student_1',
        email: 'est1@ejemplo.edu.ar',
        displayName: 'Estudiante 1',
        emailVerified: true,
        isAdmin: false,
        isSuperAdmin: false,
      };
    }
    if (token === 'token-student-2') {
      return {
        uid: 'student_2',
        email: 'est2@ejemplo.edu.ar',
        displayName: 'Estudiante 2',
        emailVerified: true,
        isAdmin: false,
        isSuperAdmin: false,
      };
    }
    if (token === 'token-admin') {
      return {
        uid: 'admin_1',
        email: 'jorgecorreasp@gmail.com',
        displayName: 'Administrador FABRO',
        emailVerified: true,
        isAdmin: true,
        isSuperAdmin: true,
      };
    }
    return null;
  });

  const app = express();
  app.use(express.json());
  app.use('/api/portals', createPortalsRouter());

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;

  try {
    const resExp = await fetch(`${baseUrl}/api/portals/explorer`);
    assert.equal(resExp.status, 200);
    const expData = (await resExp.json()) as {
      portals: Array<{ id: string }>;
      categories: Array<{ id: string }>;
      homeConfig: { homeUrl: string; homeTitle: string; startPages: Array<{ url: string }> };
    };
    assert.equal(expData.portals.length, 36);
    assert.equal(expData.categories.length, 6);
    assert.equal(expData.homeConfig.homeUrl, 'https://www.wikipedia.org/');
    assert.equal(expData.homeConfig.startPages.length, 1);

    const resAi = await fetch(`${baseUrl}/api/portals/ai-browser`);
    assert.equal(resAi.status, 200);
    const aiData = (await resAi.json()) as { portals: Array<{ id: string }> };
    assert.equal(aiData.portals.length, 2);

    // Student cannot invoke admin endpoints
    const nonAdminCreate = await fetch(`${baseUrl}/api/portals/admin/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-student-1',
      },
      body: JSON.stringify({
        module: 'explorer',
        name: 'Hack Portal',
        url: 'https://example.org/',
      }),
    });
    assert.equal(nonAdminCreate.status, 403);

    const nonAdminHome = await fetch(`${baseUrl}/api/portals/admin/home-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-student-1',
      },
      body: JSON.stringify({
        module: 'explorer',
        homeUrl: 'https://www.wikipedia.org/',
        homeTitle: 'Wiki',
      }),
    });
    assert.equal(nonAdminHome.status, 403);

    // Student 1 favorites, custom portal, and history isolation
    const favResp = await fetch(`${baseUrl}/api/portals/me/favorites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-student-1',
      },
      body: JSON.stringify({ portalId: 'exp_wikipedia' }),
    });
    assert.equal(favResp.status, 200);
    const favJson = (await favResp.json()) as { favoritePortalIds: string[] };
    assert.ok(favJson.favoritePortalIds.includes('exp_wikipedia'));

    const customResp = await fetch(`${baseUrl}/api/portals/me/custom`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-student-1',
      },
      body: JSON.stringify({
        module: 'explorer',
        name: 'Mi Repositorio',
        url: 'https://example.org/docs',
      }),
    });
    assert.equal(customResp.status, 200);

    const s2Snap = await fetch(`${baseUrl}/api/portals/me/explorer`, {
      headers: { Authorization: 'Bearer token-student-2' },
    });
    const s2Json = (await s2Snap.json()) as {
      userPrefs: { favoritePortalIds: string[]; customPortals: Array<{ id: string }> };
    };
    assert.equal(s2Json.userPrefs.favoritePortalIds.length, 0);
    assert.equal(s2Json.userPrefs.customPortals.length, 0);

    // Admin CRUD: create category, add portal, reorder, delete
    const catResp = await fetch(`${baseUrl}/api/portals/admin/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-admin',
      },
      body: JSON.stringify({ module: 'explorer', name: 'Bibliotecas Nacionales' }),
    });
    assert.equal(catResp.status, 200);
    const catJson = (await catResp.json()) as { category: { id: string; name: string } };
    assert.equal(catJson.category.name, 'Bibliotecas Nacionales');

    const addPortalResp = await fetch(`${baseUrl}/api/portals/admin/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-admin',
      },
      body: JSON.stringify({
        module: 'explorer',
        name: 'Biblioteca Nacional Mariano Moreno',
        url: 'https://www.bn.gov.ar/',
        categoryId: catJson.category.id,
        iconName: 'Library',
        active: true,
      }),
    });
    assert.equal(addPortalResp.status, 200);
    const addedJson = (await addPortalResp.json()) as { portal: { id: string; order: number } };
    assert.ok(addedJson.portal.id);

    const reorderResp = await fetch(`${baseUrl}/api/portals/admin/items/reorder`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-admin',
      },
      body: JSON.stringify({ module: 'explorer', id: addedJson.portal.id, direction: 'up' }),
    });
    assert.equal(reorderResp.status, 200);

    const delResp = await fetch(
      `${baseUrl}/api/portals/admin/items/explorer/${addedJson.portal.id}`,
      {
        method: 'DELETE',
        headers: { Authorization: 'Bearer token-admin' },
      }
    );
    assert.equal(delResp.status, 200);
    assert.equal(getPortalsSnapshot('explorer', undefined, true).portals.length, 36);

    // Admin Home Config: reject private URL & accept public start pages
    const invalidHomeResp = await fetch(`${baseUrl}/api/portals/admin/home-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-admin',
      },
      body: JSON.stringify({
        module: 'explorer',
        homeUrl: 'http://127.0.0.1:8080/internal',
        homeTitle: 'Local',
      }),
    });
    assert.equal(invalidHomeResp.status, 400);

    const validHomeResp = await fetch(`${baseUrl}/api/portals/admin/home-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-admin',
      },
      body: JSON.stringify({
        module: 'explorer',
        homeUrl: 'https://scielo.org/',
        homeTitle: 'SciELO',
        defaultPortalId: 'exp_scielo',
        startPages: [
          { title: 'SciELO', url: 'https://scielo.org/', portalId: 'exp_scielo' },
          { title: 'Wikipedia', url: 'https://www.wikipedia.org/', portalId: 'exp_wikipedia' },
        ],
      }),
    });
    assert.equal(validHomeResp.status, 200);
    const updatedHomeJson = (await validHomeResp.json()) as {
      homeConfig: { homeUrl: string; homeTitle: string; startPages: Array<{ title: string }> };
    };
    assert.equal(updatedHomeJson.homeConfig.homeUrl, 'https://scielo.org/');
    assert.equal(updatedHomeJson.homeConfig.startPages.length, 2);

    // Bulk delete incompatible portals (mark one as external_required and another as iframe_compatible)
    const { updatePortalProbeResult } = await import('./portalsStore.ts');
    await updatePortalProbeResult('exp_chatgpt', {
      compatibilityStatus: 'external_required',
      openingMode: 'apertura_externa',
      iframeAllowed: false,
      requiresExternal: true,
      statusMessage: 'X-Frame-Options: SAMEORIGIN',
      lastTestedAt: new Date().toISOString(),
    });
    await updatePortalProbeResult('exp_wikipedia', {
      compatibilityStatus: 'iframe_compatible',
      openingMode: 'iframe_integrado',
      iframeAllowed: true,
      requiresExternal: false,
      statusMessage: 'Compatible',
      lastTestedAt: new Date().toISOString(),
    });

    const bulkDeleteResp = await fetch(`${baseUrl}/api/portals/admin/incompatible/explorer`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-admin' },
    });
    assert.equal(bulkDeleteResp.status, 200);
    const bulkDeleteJson = (await bulkDeleteResp.json()) as {
      deletedCount: number;
      deletedNames: string[];
    };
    assert.equal(bulkDeleteJson.deletedCount, 1);
    assert.deepEqual(bulkDeleteJson.deletedNames, ['ChatGPT']);
    assert.equal(getPortalsSnapshot('explorer', undefined, true).portals.length, 35);

    // Admin marks a portal as exclusive external-only, then removes its shortcut while retaining the rule
    const markAdminExtResp = await fetch(
      `${baseUrl}/api/portals/admin/items/explorer/exp_google/external-only`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-admin',
        },
        body: JSON.stringify({
          removeShortcut: false,
          reason: 'No carga correctamente mediante iframe en navegador web.',
        }),
      }
    );
    assert.equal(markAdminExtResp.status, 200);
    const markAdminExtJson = (await markAdminExtResp.json()) as {
      portal: { compatibilityStatus: string; openingMode: string; iframeAllowed: boolean; requiresExternal: boolean };
      removed: boolean;
      externalOnlyRules: Array<{ portalId?: string; hostname: string }>;
    };
    assert.equal(markAdminExtJson.removed, false);
    assert.equal(markAdminExtJson.portal.compatibilityStatus, 'external_required');
    assert.equal(markAdminExtJson.portal.openingMode, 'apertura_externa');
    assert.equal(markAdminExtJson.portal.iframeAllowed, false);
    assert.equal(markAdminExtJson.portal.requiresExternal, true);
    assert.ok(markAdminExtJson.externalOnlyRules.some((r) => r.portalId === 'exp_google'));

    const removeAdminShortcutResp = await fetch(
      `${baseUrl}/api/portals/admin/items/explorer/exp_google/external-only`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-admin',
        },
        body: JSON.stringify({ removeShortcut: true }),
      }
    );
    assert.equal(removeAdminShortcutResp.status, 200);
    const removeAdminShortcutJson = (await removeAdminShortcutResp.json()) as {
      removed: boolean;
      externalOnlyRules: Array<{ portalId?: string }>;
    };
    assert.equal(removeAdminShortcutJson.removed, true);
    assert.equal(getPortalsSnapshot('explorer', undefined, true).portals.length, 34);
    assert.ok(
      getPortalsSnapshot('explorer').externalOnlyRules.some((r) => r.portalId === 'exp_google'),
      'Deleted shortcut rule must remain marked for exclusive external opening'
    );

    // Non-admin student removes shortcut & marks external-only for themselves (isolated from student 2)
    const userRemoveResp = await fetch(`${baseUrl}/api/portals/me/shortcuts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-student-1',
      },
      body: JSON.stringify({
        action: 'remove_shortcut_external',
        module: 'explorer',
        portalId: 'exp_bing',
        name: 'Bing',
        url: 'https://www.bing.com/',
      }),
    });
    assert.equal(userRemoveResp.status, 200);
    const userRemoveJson = (await userRemoveResp.json()) as {
      userPrefs: {
        hiddenPortalIds: string[];
        externalOnlyPortalIds: string[];
        externalOnlyRules: Array<{ portalId?: string }>;
      };
    };
    assert.ok(userRemoveJson.userPrefs.hiddenPortalIds.includes('exp_bing'));
    assert.ok(userRemoveJson.userPrefs.externalOnlyPortalIds.includes('exp_bing'));
    assert.ok(userRemoveJson.userPrefs.externalOnlyRules.some((r) => r.portalId === 'exp_bing'));

    const s2CheckResp = await fetch(`${baseUrl}/api/portals/me/explorer`, {
      headers: { Authorization: 'Bearer token-student-2' },
    });
    const s2CheckJson = (await s2CheckResp.json()) as {
      userPrefs: { hiddenPortalIds: string[]; externalOnlyPortalIds: string[] };
    };
    assert.equal(s2CheckJson.userPrefs.hiddenPortalIds.length, 0);
    assert.equal(s2CheckJson.userPrefs.externalOnlyPortalIds.length, 0);

    const userRestoreResp = await fetch(`${baseUrl}/api/portals/me/shortcuts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-student-1',
      },
      body: JSON.stringify({
        action: 'restore_shortcut',
        module: 'explorer',
        portalId: 'exp_bing',
        clearExternalOnly: false,
      }),
    });
    assert.equal(userRestoreResp.status, 200);
    const userRestoreJson = (await userRestoreResp.json()) as {
      userPrefs: { hiddenPortalIds: string[]; externalOnlyPortalIds: string[] };
    };
    assert.ok(!userRestoreJson.userPrefs.hiddenPortalIds.includes('exp_bing'));
    assert.ok(userRestoreJson.userPrefs.externalOnlyPortalIds.includes('exp_bing'));

    console.log('PASS: All portals catalog, header probe, SSRF, isolation, Home Config, External-Only & Admin CRUD tests passed!');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    setTestTokenVerifierForTests(null);
    if (fs.existsSync(tmpStore)) fs.unlinkSync(tmpStore);
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
