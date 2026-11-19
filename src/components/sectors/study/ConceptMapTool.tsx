import React, { useEffect, useState } from 'react';
import { Download, FileText, GitBranch, Plus, Trash2 } from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { DEFAULT_CONCEPT_NODES, vaultGet, vaultSet } from '../../../services/localVault';
import type { ConceptNode } from '../../../types/ecosystem';
import { ShareResourceButton } from '../../common/ShareResourceButton';

const BRANCH_COLORS = ['#2563EB', '#06B6D4', '#10B981', '#F59E0B', '#7C3AED', '#EC4899'];

export const ConceptMapTool: React.FC = () => {
  const { profile } = useEcosystem();
  const [nodes, setNodes] = useState<ConceptNode[]>(DEFAULT_CONCEPT_NODES);
  const [selectedId, setSelectedId] = useState<string>('n-root');
  const [newLabel, setNewLabel] = useState('');
  const [newParentId, setNewParentId] = useState<string>('n-root');
  const [newColor, setNewColor] = useState<string>(BRANCH_COLORS[1]);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  useEffect(() => {
    void vaultGet<ConceptNode[]>('concept_nodes', DEFAULT_CONCEPT_NODES).then((loaded) => {
      if (loaded.length > 0) {
        setNodes(loaded);
        setSelectedId(loaded[0].id);
        setNewParentId(loaded[0].id);
      }
    });
  }, []);

  const persistNodes = (next: ConceptNode[]) => {
    setNodes(next);
    void vaultSet('concept_nodes', next);
  };

  const handleAddNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    const parent = nodes.find((n) => n.id === newParentId) || nodes[0];
    const siblingsCount = nodes.filter((n) => n.parentId === parent?.id).length;
    const offsetX = ((siblingsCount % 3) - 1) * 22;
    const nextNode: ConceptNode = {
      id: `node-${Date.now()}`,
      label: newLabel.trim(),
      parentId: parent ? parent.id : null,
      color: newColor,
      x: Math.max(14, Math.min(86, (parent?.x ?? 50) + offsetX)),
      y: Math.max(15, Math.min(88, (parent?.y ?? 20) + 28)),
    };
    const next = [...nodes, nextNode];
    persistNodes(next);
    setNewLabel('');
    setSelectedId(nextNode.id);
  };

  const handleMoveSelected = (dx: number, dy: number) => {
    const next = nodes.map((n) =>
      n.id === selectedId
        ? {
            ...n,
            x: Math.max(10, Math.min(90, n.x + dx)),
            y: Math.max(10, Math.min(90, n.y + dy)),
          }
        : n
    );
    persistNodes(next);
  };

  const handleDeleteNode = (id: string) => {
    if (nodes.length <= 1) return;
    const next = nodes.filter((n) => n.id !== id && n.parentId !== id);
    persistNodes(next);
    if (next[0]) setSelectedId(next[0].id);
  };

  const handleExportPng = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw colored branches
    nodes.forEach((node) => {
      if (!node.parentId) return;
      const parent = nodes.find((p) => p.id === node.parentId);
      if (!parent) return;
      const x1 = (parent.x / 100) * canvas.width;
      const y1 = (parent.y / 100) * canvas.height;
      const x2 = (node.x / 100) * canvas.width;
      const y2 = (node.y / 100) * canvas.height;
      ctx.strokeStyle = node.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(x1, (y1 + y2) / 2, x2, y2);
      ctx.stroke();
    });

    // Draw node pills
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    nodes.forEach((node) => {
      const cx = (node.x / 100) * canvas.width;
      const cy = (node.y / 100) * canvas.height;
      const w = Math.max(160, ctx.measureText(node.label).width + 36);
      const h = 44;
      ctx.fillStyle = '#F8FAFC';
      ctx.strokeStyle = node.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0F172A';
      ctx.fillText(node.label, cx, cy);
    });

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'fabro-mapa-conceptual.png';
    a.click();
    setExportMsg('Imagen PNG del mapa conceptual descargada.');
    window.setTimeout(() => setExportMsg(null), 2500);
  };

  const handleExportSummary = () => {
    const lines = ['# Mapa Conceptual FABRO', ''];
    const buildTree = (parentId: string | null, depth: number) => {
      nodes
        .filter((n) => n.parentId === parentId)
        .forEach((n) => {
          lines.push(`${'  '.repeat(depth)}- ${n.label}`);
          buildTree(n.id, depth + 1);
        });
    };
    buildTree(null, 0);
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fabro-esquema-resumen.md';
    a.click();
    URL.revokeObjectURL(url);
    setExportMsg('Resumen estructurado (.md) descargado.');
    window.setTimeout(() => setExportMsg(null), 2500);
  };

  const selectedNode = nodes.find((n) => n.id === selectedId);

  return (
    <div className="rounded-2xl border-2 border-[#2563EB]/40 fabro-surface p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-bold flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-[#2563EB] dark:text-[#38BDF8]" />
            Generador de Mapas Conceptuales y Esquemas Visuales
          </h2>
          <p className="text-xs fabro-muted mt-0.5">
            Creá nodos conectados por ramas de colores, movelos en el lienzo y exportalos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExportPng}
            className="fabro-btn border-[#2563EB] bg-[#2563EB] text-white"
          >
            <Download className="w-4 h-4" />
            Exportar PNG
          </button>
          <button
            type="button"
            onClick={handleExportSummary}
            className="fabro-btn border-[#06B6D4] bg-[#06B6D4]/15 text-[#0E7490] dark:text-[#22D3EE]"
          >
            <FileText className="w-4 h-4" />
            Resumen .MD
          </button>
        </div>
      </div>

      <ShareResourceButton
        label="Compartir mapa por WhatsApp"
        payload={{
          v: 1,
          kind: 'concept-map',
          title: nodes[0]?.label || 'Mapa Conceptual FABRO',
          nodes,
          author: profile.displayName,
        }}
      />

      {/* Add Node Form */}
      <form onSubmit={handleAddNode} className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Nuevo concepto o nodo..."
          className="sm:col-span-2 min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
        />
        <select
          value={newParentId}
          onChange={(e) => setNewParentId(e.target.value)}
          aria-label="Conectar desde nodo"
          className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
        >
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              Desde: {n.label}
            </option>
          ))}
        </select>
        <button type="submit" className="fabro-btn border-[#2563EB] bg-[#2563EB] text-white">
          <Plus className="w-4 h-4" />
          Agregar nodo
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="fabro-muted font-semibold">Color de rama:</span>
          {BRANCH_COLORS.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => setNewColor(hex)}
              aria-label={`Color ${hex}`}
              className={`w-8 h-8 rounded-full border-2 cursor-pointer transition-transform active:scale-95 ${
                newColor === hex ? 'scale-110 border-slate-900 dark:border-white' : 'border-transparent'
              }`}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>

        {selectedNode && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold truncate max-w-[140px]">
              Nodo: {selectedNode.label}
            </span>
            <button
              type="button"
              onClick={() => handleMoveSelected(-8, 0)}
              className="min-h-[44px] min-w-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated font-bold cursor-pointer active:scale-95"
              aria-label="Mover a la izquierda"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => handleMoveSelected(0, -8)}
              className="min-h-[44px] min-w-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated font-bold cursor-pointer active:scale-95"
              aria-label="Mover arriba"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => handleMoveSelected(0, 8)}
              className="min-h-[44px] min-w-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated font-bold cursor-pointer active:scale-95"
              aria-label="Mover abajo"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => handleMoveSelected(8, 0)}
              className="min-h-[44px] min-w-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated font-bold cursor-pointer active:scale-95"
              aria-label="Mover a la derecha"
            >
              →
            </button>
            {selectedNode.parentId !== null && (
              <button
                type="button"
                onClick={() => handleDeleteNode(selectedNode.id)}
                aria-label="Eliminar nodo seleccionado"
                className="min-h-[44px] min-w-[44px] rounded-xl border-2 border-red-500/40 text-red-600 dark:text-red-400 flex items-center justify-center cursor-pointer active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Interactive SVG Canvas */}
      <div className="relative h-72 sm:h-80 rounded-2xl border-2 fabro-border fabro-surface-elevated overflow-hidden">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          <defs>
            <marker
              id="fabro-arrow"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill="#64748B" />
            </marker>
          </defs>
          {nodes.map((node) => {
            if (!node.parentId) return null;
            const parent = nodes.find((p) => p.id === node.parentId);
            if (!parent) return null;
            return (
              <path
                key={`edge-${node.id}`}
                d={`M ${parent.x} ${parent.y} Q ${parent.x} ${(parent.y + node.y) / 2}, ${node.x} ${node.y}`}
                fill="none"
                stroke={node.color}
                strokeWidth="1.2"
                markerEnd="url(#fabro-arrow)"
              />
            );
          })}
        </svg>

        {nodes.map((node) => {
          const isSelected = node.id === selectedId;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => setSelectedId(node.id)}
              className="absolute -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 min-h-[36px] rounded-xl border-2 text-xs font-bold fabro-surface shadow-sm cursor-pointer active:scale-95 transition-transform max-w-[150px] truncate"
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                borderColor: node.color,
                boxShadow: isSelected ? `0 0 0 3px ${node.color}44` : undefined,
              }}
            >
              {node.label}
            </button>
          );
        })}
      </div>

      {exportMsg && (
        <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">{exportMsg}</p>
      )}
    </div>
  );
};
