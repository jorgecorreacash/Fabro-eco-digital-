import type { NextFunction, Response } from 'express';
import {
  checkAntiSpamWindow,
  getClientIp,
  requireAuth,
  type AuthenticatedRequest,
} from './authMiddleware.ts';
import {
  commitAiUsage,
  getSystemLimitsSnapshot,
  getUserFreemiumStatus,
  releaseAiQuotaReservation,
  reserveAiQuota,
  type QuotaReservation,
} from './freemiumStore.ts';
import { GATEWAY_MODELS_BASE, calculateEstimatedCostUsd } from './aiGateway.ts';

function estimateTokens(raw: string): number {
  const clean = (raw || '').trim();
  if (!clean) return 0;
  return Math.max(1, Math.ceil(clean.length / 4));
}

function inferProviderAndModel(
  payload: Record<string, unknown> | undefined
): {
  providerId: string;
  modelId: string;
  tierUsed: 'free' | 'paid';
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  fallbackUsed: boolean;
} {
  if (!payload || typeof payload !== 'object') {
    return { providerId: 'gemini', modelId: 'gemini-4-hydrogen', tierUsed: 'free', fallbackUsed: false };
  }

  const explicitPid = typeof payload.providerId === 'string' ? payload.providerId : '';
  const explicitModel =
    (typeof payload.apiModelName === 'string' && payload.apiModelName) ||
    (typeof payload.modelUsed === 'string' && payload.modelUsed) ||
    '';
  const rawUsed = typeof payload.providerUsed === 'string' ? payload.providerUsed.toLowerCase() : '';

  let providerId = explicitPid || 'gemini';
  if (!explicitPid && rawUsed) {
    if (rawUsed.includes('chatgpt') || rawUsed.includes('openai') || rawUsed.includes('gpt-')) providerId = 'openai';
    else if (rawUsed.includes('gemini')) providerId = 'gemini';
  }

  let modelId = explicitModel;
  if (!modelId && rawUsed) {
    const paren = rawUsed.match(/\(([^)]+)\)/);
    if (paren?.[1]) modelId = paren[1].trim();
  }
  if (!modelId) {
    modelId = providerId === 'openai' ? 'gpt-4o-mini' : providerId === 'gemini' ? 'gemini-4-hydrogen' : providerId;
  }

  const catalogModel = GATEWAY_MODELS_BASE.find(
    (m) => m.id === modelId || m.apiModelName === modelId || m.providerId === providerId
  );
  const tierUsed: 'free' | 'paid' =
    payload.accessTier === 'commercial' || catalogModel?.accessTier === 'commercial' ? 'paid' : 'free';

  return {
    providerId,
    modelId: catalogModel?.apiModelName || modelId,
    tierUsed,
    inputTokens: typeof payload.inputTokens === 'number' ? payload.inputTokens : undefined,
    outputTokens: typeof payload.outputTokens === 'number' ? payload.outputTokens : undefined,
    costUsd:
      typeof payload.estimatedCostUsd === 'number'
        ? payload.estimatedCostUsd
        : typeof payload.totalEstimatedCostUsd === 'number'
        ? payload.totalEstimatedCostUsd
        : undefined,
    fallbackUsed: Boolean(payload.fallbackUsed),
  };
}

function clampStringInputs(body: Record<string, unknown>, maxChars: number) {
  const keys = [
    'message',
    'prompt',
    'textContent',
    'selectedText',
    'contextText',
    'studyContext',
    'chapterContent',
    'customFocus',
    'transcript',
  ];
  for (const k of keys) {
    if (typeof body[k] === 'string' && (body[k] as string).length > maxChars) {
      body[k] = (body[k] as string).slice(0, maxChars);
    }
  }
}

export async function freemiumAiGuardMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  // Public catalog / health / provider availability endpoints remain accessible without consuming quota
  if (req.method === 'GET' && (req.path === '/providers' || req.path === '/catalog' || req.path === '/usage')) {
    next();
    return;
  }

  await new Promise<void>((resolve) => {
    void requireAuth(req, res, () => resolve());
  });
  if (!req.authUser || res.headersSent) {
    return;
  }

  const limits = getSystemLimitsSnapshot();
  const userSpam = checkAntiSpamWindow(`user:${req.authUser.uid}`, limits.antiSpamPerMinute);
  if (!userSpam.allowed) {
    res.status(429).json({
      error: `Demasiadas solicitudes seguidas. Esperá ${userSpam.retryAfterSec} segundos antes de volver a consultar.`,
      code: 'RATE_LIMIT_USER',
      retryAfterSec: userSpam.retryAfterSec,
    });
    return;
  }

  const ip = getClientIp(req);
  const ipSpam = checkAntiSpamWindow(`ip:${ip}`, limits.antiSpamPerMinute * 3);
  if (!ipSpam.allowed) {
    res.status(429).json({
      error: `Límite temporal de tráfico alcanzado. Esperá ${ipSpam.retryAfterSec} segundos.`,
      code: 'RATE_LIMIT_IP',
      retryAfterSec: ipSpam.retryAfterSec,
    });
    return;
  }

  const endpointPath = req.originalUrl.split('?')[0];
  let reservation: QuotaReservation;
  try {
    reservation = await reserveAiQuota({
      uid: req.authUser.uid,
      email: req.authUser.email,
      displayName: req.authUser.displayName,
      endpoint: endpointPath,
      operationType: endpointPath.replace(/^\/api\/(ai|gateway|media)\//, ''),
    });
  } catch (err) {
    const status = (err as { status?: number })?.status || 429;
    const code = (err as { code?: string })?.code || 'QUOTA_EXHAUSTED';
    res.status(status).json({
      error: err instanceof Error ? err.message : 'Límite de consultas alcanzado.',
      code,
    });
    return;
  }

  if (req.body && typeof req.body === 'object') {
    clampStringInputs(req.body as Record<string, unknown>, reservation.maxInputChars);
  }

  res.locals.freemiumReservation = reservation;
  res.locals.aiStartedAt = Date.now();

  // Streaming endpoints handle commit/refund manually when SSE finishes or errors
  if (endpointPath.endsWith('/stream')) {
    res.on('close', () => {
      if (!reservation.committed && !reservation.released) {
        void releaseAiQuotaReservation(reservation, {
          endpoint: endpointPath,
          errorMessage: 'Conexión streaming cerrada antes de entregar respuesta completa.',
          latencyMs: Date.now() - Number(res.locals.aiStartedAt || Date.now()),
        });
      }
    });
    next();
    return;
  }

  const origJson = res.json.bind(res);
  let handled = false;
  res.json = ((body: unknown) => {
    if (!handled) {
      handled = true;
      const elapsed = Date.now() - Number(res.locals.aiStartedAt || Date.now());
      if (res.statusCode >= 400) {
        const errMsg =
          body && typeof body === 'object' && 'error' in body
            ? String((body as { error?: unknown }).error || `HTTP ${res.statusCode}`)
            : `HTTP ${res.statusCode}`;
        void releaseAiQuotaReservation(reservation, {
          endpoint: endpointPath,
          errorMessage: errMsg,
          latencyMs: elapsed,
        });
      } else {
        const obj = body && typeof body === 'object' ? (body as Record<string, unknown>) : undefined;
        const meta = inferProviderAndModel(obj);
        const inputStr = req.body ? JSON.stringify(req.body).slice(0, reservation.maxInputChars) : '';
        const outputStr = obj ? JSON.stringify(obj) : '';
        const inTok = meta.inputTokens ?? estimateTokens(inputStr);
        const outTok = meta.outputTokens ?? estimateTokens(outputStr);
        const modelDef =
          GATEWAY_MODELS_BASE.find((m) => m.apiModelName === meta.modelId || m.providerId === meta.providerId) ||
          GATEWAY_MODELS_BASE[0];
        const costUsd = meta.costUsd ?? calculateEstimatedCostUsd(modelDef, inTok, outTok);

        void commitAiUsage(reservation, {
          endpoint: endpointPath,
          operationType: endpointPath.replace(/^\/api\/(ai|gateway|media)\//, ''),
          providerId: meta.providerId,
          modelId: meta.modelId,
          tierUsed: meta.tierUsed,
          inputTokens: inTok,
          outputTokens: outTok,
          costUsd,
          fallbackUsed: meta.fallbackUsed,
          latencyMs: elapsed,
        });

        try {
          const updatedStatus = getUserFreemiumStatus(req.authUser!.uid, req.authUser!.email);
          res.setHeader(
            'X-Fabro-Quota',
            JSON.stringify({
              planTier: updatedStatus.planTier,
              usedToday: updatedStatus.usedToday,
              dailyLimit: updatedStatus.dailyLimit,
              remainingToday: updatedStatus.remainingToday,
              extraCredits: updatedStatus.extraCredits,
              nextResetFormatted: updatedStatus.nextResetFormatted,
            })
          );
        } catch {
          // ignore header encode error
        }
      }
    }
    return origJson(body);
  }) as typeof res.json;

  res.on('close', () => {
    if (!handled && !reservation.committed && !reservation.released) {
      handled = true;
      void releaseAiQuotaReservation(reservation, {
        endpoint: endpointPath,
        errorMessage: 'Solicitud interrumpida antes de entregar respuesta.',
        latencyMs: Date.now() - Number(res.locals.aiStartedAt || Date.now()),
      });
    }
  });

  next();
}
