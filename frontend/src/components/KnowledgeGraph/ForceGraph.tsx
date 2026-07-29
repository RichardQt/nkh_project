import { useEffect, useRef } from 'react';
import type { KgCategory, KgLink, KgNode } from '../../types/kg';
import styles from './KnowledgeGraph.module.css';

interface ForceGraphProps {
  nodes: KgNode[];
  links: KgLink[];
  categories: KgCategory[];
  centerNodeId?: string;
  selectedNodeId?: string | null;
  /** Fired on clean click (no drag). */
  onSelectNode: (node: KgNode) => void;
  /**
   * Fired on clean click of a non-center node — used for subgraph drill-down.
   * Center-node clicks only select for detail.
   */
  onDrillNode?: (node: KgNode) => void;
}

interface SimNode {
  id: string;
  name: string;
  category: string;
  color: string;
  radius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isCenter: boolean;
  raw: KgNode;
}

interface SimLink {
  source: SimNode;
  target: SimNode;
  label: string;
}

function colorFor(
  category: string,
  categories: KgCategory[],
  fallbackIndex: number,
): string {
  const found = categories.find((c) => c.name === category);
  if (found?.color) {
    return found.color;
  }
  const palette = [
    '#F59E0B',
    '#8B5CF6',
    '#0EA5E9',
    '#10B981',
    '#6366F1',
    '#14B8A6',
    '#EC4899',
    '#F97316',
  ];
  return palette[fallbackIndex % palette.length];
}

/**
 * Lightweight force-directed canvas graph (no third-party graph runtime).
 * Supports pan, zoom, drag, and node click for detail.
 */
const CLICK_MOVE_THRESHOLD = 6;

export function ForceGraph({
  nodes,
  links,
  categories,
  centerNodeId,
  selectedNodeId,
  onSelectNode,
  onDrillNode,
}: ForceGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<string | null | undefined>(selectedNodeId);
  const onSelectRef = useRef(onSelectNode);
  const onDrillRef = useRef(onDrillNode);
  const centerIdRef = useRef(centerNodeId);
  selectedRef.current = selectedNodeId;
  onSelectRef.current = onSelectNode;
  onDrillRef.current = onDrillNode;
  centerIdRef.current = centerNodeId;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) {
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = wrap.clientWidth || 640;
    let height = wrap.clientHeight || 420;

    const colorIndex = new Map<string, number>();
    let colorSeq = 0;
    const getColor = (category: string) => {
      if (!colorIndex.has(category)) {
        colorIndex.set(category, colorSeq++);
      }
      return colorFor(category, categories, colorIndex.get(category) ?? 0);
    };

    const centerId = centerNodeId || nodes[0]?.id;
    const angleStep = (Math.PI * 2) / Math.max(nodes.length, 1);
    const ring = Math.min(width, height) * 0.28;

    const simNodes: SimNode[] = nodes.map((n, i) => {
      const isCenter = n.id === centerId;
      const angle = i * angleStep;
      const baseR = Math.max(14, Math.min(28, (n.symbolSize ?? 40) * 0.42));
      return {
        id: n.id,
        name: n.name || n.id,
        category: n.category || '',
        color: getColor(n.category || ''),
        radius: isCenter ? baseR + 6 : baseR,
        x: isCenter
          ? width / 2
          : width / 2 + Math.cos(angle) * ring,
        y: isCenter
          ? height / 2
          : height / 2 + Math.sin(angle) * ring,
        vx: 0,
        vy: 0,
        isCenter,
        raw: n,
      };
    });

    const byId = new Map(simNodes.map((n) => [n.id, n]));
    const simLinks: SimLink[] = [];
    for (const link of links) {
      const source = byId.get(link.source);
      const target = byId.get(link.target);
      if (!source || !target) {
        continue;
      }
      simLinks.push({
        source,
        target,
        label: link.value || link.category || '',
      });
    }

    const transform = { x: 0, y: 0, k: 1 };
    const state = {
      simNodes,
      simLinks,
      transform,
      dragging: null as SimNode | null,
      panning: false,
      lastPointer: null as { x: number; y: number } | null,
      /** Pointer-down origin for click-vs-drag detection. */
      pointerOrigin: null as { x: number; y: number } | null,
      pointerMoved: false,
      hitOnDown: null as SimNode | null,
      raf: 0,
      width,
      height,
    };
    const resize = () => {
      width = wrap.clientWidth || 640;
      height = wrap.clientHeight || 420;
      state.width = width;
      state.height = height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };
    resize();

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    let ticks = 0;
    const maxTicks = 220;

    const step = () => {
      const { simNodes: ns, simLinks: ls } = state;
      const alpha = Math.max(0.02, 1 - ticks / maxTicks);

      // repulsion
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const a = ns[i];
          const b = ns[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.hypot(dx, dy) || 0.01;
          const minDist = a.radius + b.radius + 36;
          if (dist < minDist) {
            const force = ((minDist - dist) / dist) * 0.55 * alpha;
            dx *= force;
            dy *= force;
            if (!state.dragging || state.dragging.id !== a.id) {
              a.vx -= dx;
              a.vy -= dy;
            }
            if (!state.dragging || state.dragging.id !== b.id) {
              b.vx += dx;
              b.vy += dy;
            }
          } else {
            const force = (140 * alpha) / (dist * dist);
            dx *= force;
            dy *= force;
            if (!state.dragging || state.dragging.id !== a.id) {
              a.vx -= dx;
              a.vy -= dy;
            }
            if (!state.dragging || state.dragging.id !== b.id) {
              b.vx += dx;
              b.vy += dy;
            }
          }
        }
      }

      // spring links
      for (const link of ls) {
        const a = link.source;
        const b = link.target;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const ideal = 110;
        const force = ((dist - ideal) / dist) * 0.06 * alpha;
        dx *= force;
        dy *= force;
        if (!state.dragging || state.dragging.id !== a.id) {
          a.vx += dx;
          a.vy += dy;
        }
        if (!state.dragging || state.dragging.id !== b.id) {
          b.vx -= dx;
          b.vy -= dy;
        }
      }

      // center gravity
      for (const n of ns) {
        if (state.dragging && state.dragging.id === n.id) {
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        const cx = state.width / 2;
        const cy = state.height / 2;
        n.vx += (cx - n.x) * 0.004 * alpha;
        n.vy += (cy - n.y) * 0.004 * alpha;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
      }

      ticks += 1;
      draw();
      state.raf = requestAnimationFrame(step);
    };

    const screenToWorld = (sx: number, sy: number) => {
      const t = state.transform;
      return {
        x: (sx - t.x) / t.k,
        y: (sy - t.y) / t.k,
      };
    };

    const hitTest = (sx: number, sy: number): SimNode | null => {
      const p = screenToWorld(sx, sy);
      let hit: SimNode | null = null;
      for (let i = state.simNodes.length - 1; i >= 0; i--) {
        const n = state.simNodes[i];
        const d = Math.hypot(n.x - p.x, n.y - p.y);
        if (d <= n.radius + 4) {
          hit = n;
          break;
        }
      }
      return hit;
    };

    const draw = () => {
      const { transform: t, simNodes: ns, simLinks: ls } = state;
      ctx.clearRect(0, 0, state.width, state.height);
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      // links
      for (const link of ls) {
        const { source, target, label } = link;
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = 'rgba(17, 24, 39, 0.14)';
        ctx.lineWidth = 1.25 / t.k;
        ctx.stroke();

        if (label && t.k > 0.75) {
          const mx = (source.x + target.x) / 2;
          const my = (source.y + target.y) / 2;
          ctx.font = `${11 / t.k}px system-ui, sans-serif`;
          ctx.fillStyle = 'rgba(91, 100, 114, 0.9)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, mx, my - 6 / t.k);
        }
      }

      // nodes
      for (const n of ns) {
        const selected = selectedRef.current === n.id;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.globalAlpha = selected ? 1 : 0.92;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = (selected ? 3 : n.isCenter ? 2.5 : 1.5) / t.k;
        ctx.strokeStyle = selected
          ? '#111827'
          : n.isCenter
            ? 'rgba(17, 24, 39, 0.55)'
            : 'rgba(255,255,255,0.85)';
        ctx.stroke();

        // label
        const fontSize = Math.max(11, Math.min(13, n.radius * 0.7)) / t.k;
        ctx.font = `600 ${fontSize}px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`;
        ctx.fillStyle = '#111827';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const label = n.name.length > 12 ? `${n.name.slice(0, 12)}…` : n.name;
        ctx.fillText(label, n.x, n.y + n.radius + 4 / t.k);
      }

      ctx.restore();
    };

    const onPointerDown = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = event.clientX - rect.left;
      const sy = event.clientY - rect.top;
      const hit = hitTest(sx, sy);
      state.lastPointer = { x: sx, y: sy };
      state.pointerOrigin = { x: sx, y: sy };
      state.pointerMoved = false;
      state.hitOnDown = hit;
      if (hit) {
        state.dragging = hit;
        canvas.setPointerCapture(event.pointerId);
      } else {
        state.panning = true;
        canvas.setPointerCapture(event.pointerId);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = event.clientX - rect.left;
      const sy = event.clientY - rect.top;
      if (!state.lastPointer) {
        canvas.style.cursor = hitTest(sx, sy) ? 'pointer' : 'grab';
        return;
      }
      const dx = sx - state.lastPointer.x;
      const dy = sy - state.lastPointer.y;
      state.lastPointer = { x: sx, y: sy };

      if (state.pointerOrigin) {
        const total = Math.hypot(
          sx - state.pointerOrigin.x,
          sy - state.pointerOrigin.y,
        );
        if (total > CLICK_MOVE_THRESHOLD) {
          state.pointerMoved = true;
        }
      }

      if (state.dragging && state.pointerMoved) {
        const world = screenToWorld(sx, sy);
        state.dragging.x = world.x;
        state.dragging.y = world.y;
        state.dragging.vx = 0;
        state.dragging.vy = 0;
      } else if (state.panning) {
        state.transform.x += dx;
        state.transform.y += dy;
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      const hit = state.hitOnDown;
      const wasClick = Boolean(hit) && !state.pointerMoved;
      state.dragging = null;
      state.panning = false;
      state.lastPointer = null;
      state.pointerOrigin = null;
      state.hitOnDown = null;
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }

      if (!wasClick || !hit) {
        state.pointerMoved = false;
        return;
      }
      state.pointerMoved = false;

      // Always select for detail pane.
      onSelectRef.current(hit.raw);

      // Drill into subgraph for non-center nodes.
      const centerId = centerIdRef.current || state.simNodes[0]?.id;
      if (hit.id !== centerId && onDrillRef.current) {
        onDrillRef.current(hit.raw);
      }
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = event.clientX - rect.left;
      const sy = event.clientY - rect.top;
      const factor = event.deltaY < 0 ? 1.08 : 0.92;
      const nextK = Math.min(2.8, Math.max(0.4, state.transform.k * factor));
      const wx = (sx - state.transform.x) / state.transform.k;
      const wy = (sy - state.transform.y) / state.transform.k;
      state.transform.k = nextK;
      state.transform.x = sx - wx * nextK;
      state.transform.y = sy - wy * nextK;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    const ro = new ResizeObserver(() => resize());
    ro.observe(wrap);

    state.raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(state.raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [nodes, links, categories, centerNodeId]);

  return (
    <div ref={wrapRef} className={styles.graphCanvasWrap}>
      <canvas ref={canvasRef} className={styles.graphCanvas} />
    </div>
  );
}
