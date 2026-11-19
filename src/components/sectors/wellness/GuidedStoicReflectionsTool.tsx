import React from 'react';
import { Feather } from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { ShareResourceButton } from '../../common/ShareResourceButton';

export const GuidedStoicReflectionsTool: React.FC = () => {
  const { guidedReflections, updateGuidedReflection, profile } = useEcosystem();

  return (
    <div className="rounded-2xl border-2 border-[#F59E0B]/40 fabro-surface p-5 space-y-4 shadow-[0_8px_24px_-12px_rgba(245,158,11,0.22)]">
      <div>
        <h3 className="font-display text-base font-bold flex items-center gap-2">
          <Feather className="w-4 h-4 text-[#F59E0B]" />
          3 Reflexiones Estoicas Guiadas para Responder Hoy
        </h3>
        <p className="text-xs fabro-muted mt-0.5">
          Editá tus respuestas y compartí cualquier reflexión por WhatsApp para inspirar a alguien más.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {guidedReflections.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border-2 fabro-border fabro-surface-elevated p-4 space-y-3 flex flex-col justify-between text-xs"
          >
            <div className="space-y-2">
              <p className="font-bold text-[#047857] dark:text-[#34D399]">{item.title}</p>
              <p className="text-sm font-semibold leading-snug">{item.prompt}</p>
              <p className="text-[11px] italic fabro-muted">{item.stoicQuote}</p>
              <textarea
                rows={3}
                value={item.answer}
                onChange={(e) => updateGuidedReflection(item.id, e.target.value)}
                placeholder="Escribí tu reflexión personal..."
                className="w-full rounded-xl border-2 fabro-border fabro-surface p-2.5 text-xs leading-relaxed fabro-input"
              />
            </div>

            <ShareResourceButton
              compact
              label="WhatsApp"
              payload={{
                v: 1,
                kind: 'stoic',
                title: item.title,
                prompt: item.prompt,
                reflection: item.answer,
                quote: item.stoicQuote,
                author: profile.displayName,
              }}
            />
          </article>
        ))}
      </div>
    </div>
  );
};
