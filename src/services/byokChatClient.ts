import type { ByokConversationMessage, ByokProviderKey } from '../types/ecosystem';

export interface ByokPromptAttachment {
  id: string;
  title: string;
  subject: string;
  contentText: string;
}

export interface ByokCompletionResult {
  ok: boolean;
  content: string;
  error?: string;
}

function resolveDefaultBaseUrl(keyMeta: ByokProviderKey): string {
  const custom = keyMeta.baseUrl?.trim();
  if (custom && /^https?:\/\//i.test(custom)) {
    return custom.replace(/\/+$/, '');
  }
  const lower = keyMeta.providerName.toLowerCase();
  if (keyMeta.endpointFormat === 'gemini' || lower.includes('gemini')) {
    return 'https://generativelanguage.googleapis.com/v1beta';
  }
  if (keyMeta.endpointFormat === 'anthropic-compatible' || lower.includes('claude') || lower.includes('anthropic')) {
    return 'https://api.anthropic.com/v1';
  }
  if (lower.includes('deepseek')) {
    return 'https://api.deepseek.com/v1';
  }
  if (lower.includes('qwen') || lower.includes('dashscope')) {
    return 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
  }
  return 'https://api.openai.com/v1';
}

function resolveDefaultModel(keyMeta: ByokProviderKey): string {
  const m = keyMeta.modelName?.trim();
  if (m && !m.toLowerCase().includes('especificado por el usuario')) {
    return m;
  }
  const lower = keyMeta.providerName.toLowerCase();
  if (keyMeta.endpointFormat === 'gemini' || lower.includes('gemini')) {
    return 'gemini-2.5-flash';
  }
  if (keyMeta.endpointFormat === 'anthropic-compatible' || lower.includes('claude')) {
    return 'claude-3-5-sonnet-latest';
  }
  if (lower.includes('deepseek')) {
    return 'deepseek-chat';
  }
  if (lower.includes('qwen')) {
    return 'qwen-plus';
  }
  return 'gpt-4o-mini';
}

/**
 * Ejecuta una consulta real directamente desde el navegador hacia el proveedor elegido por el usuario,
 * usando exclusivamente la clave BYOK guardada en su bóveda local (nunca APIs precargadas).
 */
export async function sendByokChatCompletion(params: {
  keyMeta: ByokProviderKey;
  rawApiKey: string;
  history: ByokConversationMessage[];
  userText: string;
  attachments?: ByokPromptAttachment[];
  systemInstructionOverride?: string;
  signal?: AbortSignal;
}): Promise<ByokCompletionResult> {
  const {
    keyMeta,
    rawApiKey,
    history,
    userText,
    attachments = [],
    systemInstructionOverride,
    signal,
  } = params;

  if (!rawApiKey.trim()) {
    return {
      ok: false,
      content: '',
      error:
        'Esta clave BYOK no tiene el secreto guardado localmente en este navegador. Volvé a pegarla en «Mis claves API (BYOK)».',
    };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      ok: false,
      content: '',
      error:
        'Estás sin conexión a internet. Tu historial queda guardado localmente y podrás consultar tu IA al reconectar.',
    };
  }

  const baseUrl = resolveDefaultBaseUrl(keyMeta);
  const model = resolveDefaultModel(keyMeta);

  const attachmentContext =
    attachments.length > 0
      ? `\n\n[APUNTES O DOCUMENTOS ADJUNTOS DE FABRO]\n${attachments
          .map(
            (att, idx) =>
              `--- Documento ${idx + 1}: ${att.title} (${att.subject}) ---\n${att.contentText.slice(0, 6000)}`
          )
          .join('\n\n')}`
      : '';

  const systemInstruction =
    systemInstructionOverride?.trim() ||
    'Sos un asistente claro, estructurado y preciso dentro del ecosistema FABRO. Respondé en español usando Markdown limpio (títulos, listas, negritas y bloques de código cuando corresponda).';

  const recentTurns = history.slice(-12).filter((m) => !m.error);
  const finalUserContent = `${userText.trim()}${attachmentContext}`;

  try {
    if (keyMeta.endpointFormat === 'gemini') {
      const endpoint = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(
        rawApiKey.trim()
      )}`;
      const contents = [
        ...recentTurns.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        {
          role: 'user',
          parts: [{ text: finalUserContent }],
        },
      ];

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents,
        }),
        signal,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          data?.error?.message || `Error HTTP ${res.status} al consultar Google Gemini API.`;
        return { ok: false, content: '', error: msg };
      }
      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text || '')
          .join('')
          .trim() || '';
      if (!text) {
        return { ok: false, content: '', error: 'El modelo no devolvió contenido visible.' };
      }
      return { ok: true, content: text };
    }

    if (keyMeta.endpointFormat === 'anthropic-compatible') {
      const endpoint = baseUrl.endsWith('/messages') ? baseUrl : `${baseUrl}/messages`;
      const messages = [
        ...recentTurns.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: 'user', content: finalUserContent },
      ];

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': rawApiKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          system: systemInstruction,
          messages,
        }),
        signal,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          data?.error?.message || `Error HTTP ${res.status} al consultar Anthropic Messages API.`;
        return { ok: false, content: '', error: msg };
      }
      const text = Array.isArray(data?.content)
        ? data.content
            .map((block: { text?: string }) => block.text || '')
            .join('\n')
            .trim()
        : '';
      if (!text) {
        return { ok: false, content: '', error: 'Anthropic no devolvió texto en la respuesta.' };
      }
      return { ok: true, content: text };
    }

    // OpenAI-compatible / DeepSeek / Qwen / Custom
    const endpoint = baseUrl.endsWith('/chat/completions')
      ? baseUrl
      : `${baseUrl}/chat/completions`;
    const messages = [
      { role: 'system', content: systemInstruction },
      ...recentTurns.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: finalUserContent },
    ];

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rawApiKey.trim()}`,
      },
      body: JSON.stringify({
        model,
        messages,
      }),
      signal,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        data?.error?.message || `Error HTTP ${res.status} en ${keyMeta.providerName}.`;
      return { ok: false, content: '', error: msg };
    }
    const text = data?.choices?.[0]?.message?.content?.trim() || '';
    if (!text) {
      return { ok: false, content: '', error: 'El proveedor devolvió una respuesta vacía.' };
    }
    return { ok: true, content: text };
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      return { ok: false, content: '', error: 'Consulta cancelada por el usuario.' };
    }
    return {
      ok: false,
      content: '',
      error:
        'No se pudo conectar directo desde el navegador con el endpoint configurado (revisá conexión, URL base o política CORS del proveedor).',
    };
  }
}
