/* Hallmark · component: chat-widget · genre: modern-minimal · theme: project-locked (dark + lime)
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 * pre-emit critique: P4 H5 E4 S5 R5 V4
 */
import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const MAX_HISTORIAL = 10;

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderInline(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,!?)]|$)/g, '$1<em>$2</em>')
    .replace(/`([^`\n]+)`/g, '<code class="md-code">$1</code>');
}

function renderMd(text) {
  const lines = escapeHtml(text).split('\n');
  const out = [];
  let inUl = false;
  let inOl = false;
  const closeLists = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) { closeLists(); out.push(''); continue; }

    let m;
    if ((m = line.match(/^###\s+(.+)$/))) {
      closeLists();
      out.push(`<h4 class="md-h">${renderInline(m[1])}</h4>`);
    } else if ((m = line.match(/^##\s+(.+)$/))) {
      closeLists();
      out.push(`<h3 class="md-h">${renderInline(m[1])}</h3>`);
    } else if ((m = line.match(/^#\s+(.+)$/))) {
      closeLists();
      out.push(`<h3 class="md-h">${renderInline(m[1])}</h3>`);
    } else if ((m = line.match(/^\s*[-*]\s+(.+)$/))) {
      if (!inUl) { closeLists(); out.push('<ul class="md-ul">'); inUl = true; }
      out.push(`<li>${renderInline(m[1])}</li>`);
    } else if ((m = line.match(/^\s*(\d+)\.\s+(.+)$/))) {
      if (!inOl) { closeLists(); out.push('<ol class="md-ol">'); inOl = true; }
      out.push(`<li>${renderInline(m[2])}</li>`);
    } else {
      closeLists();
      out.push(renderInline(line));
    }
  }
  closeLists();
  return out.join('\n');
}

const styles = `
.sg-chat-md p, .sg-chat-md { line-height: 1.55; }
.sg-chat-md .md-h { font-size: 0.95em; font-weight: 700; margin: 8px 0 4px; letter-spacing: -0.01em; }
.sg-chat-md .md-h:first-child { margin-top: 0; }
.sg-chat-md .md-ul, .sg-chat-md .md-ol { margin: 4px 0 4px 0; padding-left: 18px; display: flex; flex-direction: column; gap: 2px; }
.sg-chat-md .md-code { background: rgba(255,255,255,0.07); padding: 1px 5px; border-radius: 4px; font-size: 0.88em; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.sg-chat-md strong { font-weight: 700; color: var(--ink-1); }
.sg-chat-md em { font-style: italic; }
.sg-chat-dots { display: inline-flex; gap: 3px; align-items: center; }
.sg-chat-dots span { width: 5px; height: 5px; border-radius: 50%; background: var(--ink-2); opacity: 0.4; animation: sg-chat-dot 1.2s infinite ease-in-out; }
.sg-chat-dots span:nth-child(2) { animation-delay: 0.2s; }
.sg-chat-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes sg-chat-dot { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }
.sg-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: 999px; font-size: 10px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; background: rgba(255,255,255,0.06); color: var(--ink-2); border: 1px solid var(--border); }
.sg-chip-live { color: var(--primary); border-color: color-mix(in oklab, var(--primary) 35%, transparent); background: color-mix(in oklab, var(--primary) 8%, transparent); }
.sg-prompt-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; font-size: var(--text-sm); color: var(--ink-1); cursor: pointer; text-align: left; transition: border-color 0.15s ease, transform 0.1s ease; line-height: 1.4; }
.sg-prompt-card:hover { border-color: color-mix(in oklab, var(--primary) 45%, var(--border)); }
.sg-prompt-card:active { transform: translateY(1px); }
.sg-send-btn { width: 36px; height: 36px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: var(--primary); color: #000; border: none; cursor: pointer; transition: background 0.15s ease, transform 0.1s ease; }
.sg-send-btn:hover:not(:disabled) { background: color-mix(in oklab, var(--primary) 88%, white); }
.sg-send-btn:active:not(:disabled) { transform: translateY(1px); }
.sg-send-btn:disabled { background: var(--surface); color: var(--ink-2); cursor: not-allowed; }
.sg-stop-btn { width: 36px; height: 36px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: var(--surface); color: var(--ink-1); border: 1px solid var(--border); cursor: pointer; }
.sg-stop-btn:hover { border-color: var(--warning); color: var(--warning); }
.sg-icon-btn { width: 30px; height: 30px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; background: transparent; color: var(--ink-2); border: none; cursor: pointer; transition: background 0.15s ease, color 0.15s ease; }
.sg-icon-btn:hover { background: var(--surface); color: var(--ink-1); }
.sg-input { flex: 1; resize: none; background: transparent; border: none; outline: none; color: var(--ink-1); padding: 0; font-size: var(--text-sm); font-family: inherit; max-height: 120px; line-height: 1.4; }
.sg-input::placeholder { color: var(--ink-2); opacity: 0.7; }
.sg-input-wrap { display: flex; align-items: flex-end; gap: 8px; padding: 10px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; transition: border-color 0.15s ease; }
.sg-input-wrap:focus-within { border-color: color-mix(in oklab, var(--primary) 55%, var(--border)); }
`;

export function AsistenteChat() {
  const [open, setOpen] = useState(false);
  const [pregunta, setPregunta] = useState('');
  const [mensajes, setMensajes] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef(null);
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes, streaming]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  async function enviar(textoForzado) {
    const texto = (textoForzado ?? pregunta).trim();
    if (!texto || streaming) return;
    setPregunta('');

    const nuevoUser = { role: 'user', content: texto };
    const historial = [...mensajes.filter((m) => m.role === 'user' || m.role === 'assistant'), nuevoUser]
      .slice(-MAX_HISTORIAL);

    setMensajes((m) => [...m, nuevoUser, { role: 'assistant', content: '' }]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No hay sesión activa');

      const res = await fetch(`${SUPABASE_URL}/functions/v1/chat-asistente`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mensajes: historial }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const partes = buf.split('\n\n');
        buf = partes.pop() ?? '';
        for (const parte of partes) {
          const lineas = parte.split('\n');
          const linEvent = lineas.find((l) => l.startsWith('event:'));
          const linData = lineas.find((l) => l.startsWith('data:'));
          const ev = linEvent ? linEvent.slice(6).trim() : 'message';
          const data = linData ? linData.slice(5).trim() : '';
          if (!data) continue;
          if (ev === 'error') {
            try {
              const parsed = JSON.parse(data);
              throw new Error(parsed.error || 'Error en stream');
            } catch (e) {
              throw e instanceof Error ? e : new Error(String(e));
            }
          }
          if (ev === 'done') continue;
          try {
            const parsed = JSON.parse(data);
            const txt = parsed?.text;
            if (typeof txt === 'string' && txt.length > 0) {
              setMensajes((m) => {
                const next = [...m];
                const last = next[next.length - 1];
                if (last && last.role === 'assistant') {
                  next[next.length - 1] = { ...last, content: last.content + txt };
                }
                return next;
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      setMensajes((m) => {
        const next = [...m];
        const last = next[next.length - 1];
        const errMsg = e?.message || 'Error consultando al asistente.';
        if (last && last.role === 'assistant' && !last.content) {
          next[next.length - 1] = { role: 'error', content: errMsg };
        } else {
          next.push({ role: 'error', content: errMsg });
        }
        return next;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function cancelar() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  function limpiar() {
    if (streaming) return;
    setMensajes([]);
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  const turnos = mensajes.filter((m) => m.role === 'user').length;
  const pct = Math.min(100, Math.round((turnos / MAX_HISTORIAL) * 100));
  const sugerirNueva = turnos >= Math.floor(MAX_HISTORIAL * 0.7);

  const sugerencias = [
    '¿Cuánto facturé los últimos 30 días?',
    '¿Qué clientes me deben más?',
    '¿Cuál fue mi producto más vendido?',
    '¿En qué categoría gasté más este mes?',
  ];

  return (
    <>
      <style>{styles}</style>

      <motion.button
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir asistente"
        whileHover="hover"
        whileTap={{ scale: 0.94 }}
        animate={{ opacity: open ? 0 : 1, pointerEvents: open ? 'none' : 'auto' }}
        transition={{ duration: 0.15 }}
        variants={{
          hover: {
            boxShadow: '0 0 0 6px oklch(88% 0.22 130 / 0.15), 0 0 0 12px oklch(88% 0.22 130 / 0.07), 0 16px 40px rgba(0,0,0,0.5)',
            y: -2,
            transition: { duration: 0.2 },
          }
        }}
        style={{
          position: 'fixed', right: 16,
          bottom: 'calc(var(--nav-h, 58px) + 16px)',
          height: 48, borderRadius: 999,
          padding: '0 18px 0 14px',
          background: 'var(--primary)', color: '#000', border: 'none',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: 8,
          cursor: 'pointer', zIndex: 150,
          fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
          letterSpacing: '-0.01em', whiteSpace: 'nowrap',
        }}
      >
        <span style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 20, height: 20 }}>
          {/* Cara */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
            <circle cx="15" cy="9" r="1" fill="currentColor" stroke="none" />
          </svg>

          {/* Brazo + mano — sale del costado derecho de la cara */}
          <motion.span
            variants={{
              hover: {
                opacity: 1, x: 0,
                rotate: [0, -28, 20, -14, 10, 0],
                transition: {
                  opacity: { duration: 0.12 },
                  x: { duration: 0.12 },
                  rotate: { duration: 0.65, ease: 'easeInOut', delay: 0.05 },
                }
              }
            }}
            style={{
              position: 'absolute', left: 14, top: -8,
              opacity: 0, x: -4,
              transformOrigin: 'bottom left',
            }}
          >
            <svg width="14" height="24" viewBox="0 0 14 24" fill="currentColor" stroke="none">
              {/* Dedos */}
              <rect x="0"   y="7"   width="2.2" height="5.5" rx="1.1" />
              <rect x="2.8" y="4"   width="2.2" height="7"   rx="1.1" />
              <rect x="5.6" y="3"   width="2.2" height="7.5" rx="1.1" />
              <rect x="8.4" y="4.5" width="2.2" height="6.5" rx="1.1" />
              <rect x="11"  y="6"   width="2.2" height="5.5" rx="1.1" />
              {/* Palma */}
              <rect x="0" y="9.5" width="13.2" height="6.5" rx="2.5" />
              {/* Brazo */}
              <rect x="4" y="15" width="5.5" height="9" rx="2.75" />
            </svg>
          </motion.span>
        </span>

        <motion.span
          variants={{ hover: { letterSpacing: '0.03em', transition: { duration: 0.2 } } }}
        >
          Asistente IA
        </motion.span>
      </motion.button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              style={{
                position: 'fixed',
                right: 'clamp(0px, 16px, 4vw)',
                bottom: 'var(--nav-h, 58px)',
                width: 'min(380px, 100vw)',
                height: 'calc(100dvh - var(--nav-h, 58px) - 64px)',
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 24px 60px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
                zIndex: 220,
              }}
            >
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: 'color-mix(in oklab, var(--primary) 18%, transparent)',
                    border: '1px solid color-mix(in oklab, var(--primary) 40%, transparent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--primary)',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                      <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="3" />
                      <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="3" />
                    </svg>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 700, color: 'var(--ink-1)',
                      letterSpacing: '-0.01em', lineHeight: 1,
                    }}>
                      Asistente
                    </div>
                    <span className={`sg-chip ${streaming ? 'sg-chip-live' : ''}`}>
                      {streaming ? 'pensando' : 'en línea'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 2 }}>
                  {mensajes.length > 0 && !streaming && (
                    <button className="sg-icon-btn" onClick={limpiar} aria-label="Nueva conversación" title="Nueva conversación">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                  )}
                  <button className="sg-icon-btn" onClick={() => !streaming && setOpen(false)} aria-label="Cerrar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Progress hairline */}
              {turnos > 0 && (
                <div style={{ padding: '0 16px 8px' }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 10.5, color: 'var(--ink-2)', marginBottom: 4,
                    letterSpacing: '0.02em',
                  }}>
                    <span>{turnos}/{MAX_HISTORIAL} preguntas en esta sesión</span>
                    {sugerirNueva && !streaming && (
                      <button
                        onClick={limpiar}
                        style={{
                          background: 'transparent', border: 'none', padding: 0,
                          color: 'var(--warning)', cursor: 'pointer',
                          fontSize: 10.5, fontWeight: 600,
                        }}
                      >
                        Empezar nueva →
                      </button>
                    )}
                  </div>
                  <div style={{ height: 2, background: 'var(--surface)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`,
                      background: sugerirNueva ? 'var(--warning)' : 'var(--primary)',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              )}

              {/* Messages */}
              <div
                ref={scrollRef}
                style={{
                  flex: mensajes.length > 0 ? 1 : '0 0 auto',
                  overflowY: 'auto',
                  padding: '8px 16px 16px',
                  display: 'flex', flexDirection: 'column', gap: 14,
                  minHeight: 0,
                }}
              >
                {mensajes.length === 0 && !streaming && (
                  <div style={{ paddingTop: 8 }}>
                    <div style={{
                      fontSize: 13, color: 'var(--ink-2)',
                      lineHeight: 1.5, marginBottom: 14,
                    }}>
                      Te respondo sobre clientes, pedidos, cobros, gastos, productos y devoluciones de tu negocio. Probá algo así:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {sugerencias.map((s) => (
                        <button
                          key={s}
                          className="sg-prompt-card"
                          onClick={() => enviar(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <div style={{
                      marginTop: 18, fontSize: 11.5, color: 'var(--ink-2)',
                      lineHeight: 1.5, opacity: 0.8,
                    }}>
                      Tip: nombrá clientes y productos por nombre, y dale un período concreto (este mes, últimos 7 días).
                    </div>
                  </div>
                )}

                {mensajes.map((m, i) => {
                  if (m.role === 'user') {
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{
                          maxWidth: '85%',
                          padding: '8px 12px',
                          borderRadius: '14px 14px 4px 14px',
                          background: 'var(--primary)',
                          color: '#000',
                          fontSize: 13.5, lineHeight: 1.45,
                          fontWeight: 500,
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>
                          {m.content}
                        </div>
                      </div>
                    );
                  }
                  if (m.role === 'error') {
                    return (
                      <div key={i} style={{
                        display: 'flex', gap: 8, alignItems: 'flex-start',
                        padding: '10px 12px',
                        background: 'color-mix(in oklab, var(--warning) 12%, transparent)',
                        border: '1px solid color-mix(in oklab, var(--warning) 30%, transparent)',
                        borderRadius: 10, color: 'var(--warning)',
                        fontSize: 12.5, lineHeight: 1.45,
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12" y2="16" />
                        </svg>
                        <span style={{ wordBreak: 'break-word' }}>{m.content}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                        background: 'color-mix(in oklab, var(--primary) 18%, transparent)',
                        border: '1px solid color-mix(in oklab, var(--primary) 35%, transparent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--primary)', marginTop: 1,
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                          <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="3" />
                          <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="3" />
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {m.content ? (
                          <div
                            className="sg-chat-md"
                            style={{
                              fontSize: 13.5, color: 'var(--ink-1)',
                              wordBreak: 'break-word',
                            }}
                            dangerouslySetInnerHTML={{ __html: renderMd(m.content) }}
                          />
                        ) : streaming && i === mensajes.length - 1 ? (
                          <div className="sg-chat-dots" style={{ paddingTop: 6 }}>
                            <span /><span /><span />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Input */}
              <div style={{ padding: '10px 12px 12px' }}>
                <div className="sg-input-wrap">
                  <textarea
                    ref={inputRef}
                    className="sg-input"
                    value={pregunta}
                    onChange={(e) => {
                      setPregunta(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    }}
                    onKeyDown={onKeyDown}
                    placeholder="Preguntá lo que necesites…"
                    rows={1}
                    disabled={streaming}
                    style={{ height: '24px' }}
                  />
                  {streaming ? (
                    <button className="sg-stop-btn" onClick={cancelar} aria-label="Parar">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="6" width="12" height="12" rx="1.5" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      className="sg-send-btn"
                      onClick={() => enviar()}
                      disabled={!pregunta.trim()}
                      aria-label="Enviar"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
