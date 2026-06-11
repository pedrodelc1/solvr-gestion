import { useState, useRef, useEffect } from 'react';
import { formatCurrency, formatDate, today, uid } from '../../lib/utils.js';

// ── Searchable select ────────────────────────────────────────────────────────
function SearchableSelect({ value, options, onChange, placeholder = 'Buscar...' }) {
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find(o => o.value === value);
  const filtered = q.trim()
    ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase()))
    : options;

  useEffect(() => {
    if (!focused) return;
    function onDown(e) {
      if (!wrapRef.current?.contains(e.target)) { setFocused(false); setQ(''); }
    }
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [focused]);

  const borderColor = focused ? '#ccff00' : hovered ? 'rgba(255,255,255,0.3)' : 'var(--border)';

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onPointerDown={() => { setFocused(true); setTimeout(() => inputRef.current?.focus(), 0); }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: hovered && !focused ? 'rgba(255,255,255,0.05)' : 'var(--surface)', border: `1px solid ${borderColor}`, borderRadius: 8, padding: '0 12px', minHeight: 40, cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s' }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={focused ? '#ccff00' : 'var(--ink-3)'} strokeWidth="2" style={{ flexShrink: 0, transition: 'stroke 0.15s' }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={focused ? q : (selected?.label || '')}
          placeholder={focused ? 'Escribí para buscar...' : placeholder}
          onChange={e => setQ(e.target.value)}
          onFocus={() => { setFocused(true); setQ(''); }}
          readOnly={!focused}
          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 'var(--text-sm)', color: focused || selected ? 'var(--ink)' : 'var(--ink-3)', minHeight: 38, cursor: 'pointer' }}
        />
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" style={{ flexShrink: 0, transform: focused ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {focused && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, zIndex: 999, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.8)' }}>
          {filtered.map((o, i) => (
            <div
              key={o.value}
              onPointerDown={e => { e.preventDefault(); onChange(o.value); setFocused(false); setQ(''); setHoveredIdx(-1); }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(-1)}
              style={{ padding: '12px 14px', fontSize: 'var(--text-sm)', color: o.value === value ? '#ccff00' : 'var(--ink)', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.06)', background: o.value === value ? 'rgba(204,255,0,0.08)' : hoveredIdx === i ? 'rgba(255,255,255,0.07)' : 'transparent', transition: 'background 0.1s' }}
            >
              {o.label}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '12px 14px', color: 'var(--ink-3)', fontSize: 'var(--text-sm)' }}>Sin resultados</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── New product inline ───────────────────────────────────────────────────────
function NewProductInline({ onCreated, onCancel, toast }) {
  const [nombre, setNombre] = useState('');
  const [marca, setMarca] = useState('');
  const [precio, setPrecio] = useState('');
  const [costo, setCosto] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!nombre.trim()) { toast('Ingresá el nombre', 'error'); return; }
    if (!precio || parseFloat(precio) <= 0) { toast('Ingresá el precio', 'error'); return; }
    setCreating(true);
    try {
      const np = { id: uid(), nombre: nombre.trim(), marca: marca.trim() || null, precio: parseFloat(precio), costo: parseFloat(costo) || 0 };
      await onCreated(np);
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="new-prod-inline">
      <input type="text" className="np-nombre" placeholder="Nombre del producto" value={nombre} onChange={e => setNombre(e.target.value)} autoFocus disabled={creating} />
      <input type="text" className="np-marca" placeholder="Marca" value={marca} onChange={e => setMarca(e.target.value)} disabled={creating} />
      <input type="number" className="np-precio" placeholder="Precio" min="0" step="0.01" value={precio} onChange={e => setPrecio(e.target.value)} disabled={creating} />
      <input type="number" className="np-costo" placeholder="Costo" min="0" step="0.01" value={costo} onChange={e => setCosto(e.target.value)} disabled={creating} />
      <div className="np-actions">
        <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
          {creating ? 'Creando...' : '✓ Crear'}
        </button>
        <button className="btn btn-secondary" onClick={onCancel} disabled={creating}>✕</button>
      </div>
    </div>
  );
}

// ── Item row ─────────────────────────────────────────────────────────────────
function ItemRow({ item, idx, productos, tipoPrecio, onChangeProducto, onChangeCantidad, onDelete, canDelete, onNewProductCreated, onChangeManual, onToggleEntregado, onChangeFechaEntrega, toast }) {
  const isCatalog = item.mode === 'catalog';
  const prod = isCatalog ? productos.find(p => p.id === item.productoId) : null;
  const precioEfectivo = prod
    ? (tipoPrecio === 'mayorista' && prod.precio_mayorista > 0 ? prod.precio_mayorista : prod.precio)
    : 0;
  const catalogSubtotal = prod ? precioEfectivo * (item.cantidad || 0) : 0;
  const manualSubtotal = !isCatalog ? (parseFloat(item.manualPrecio) || 0) * (item.cantidad || 0) : 0;
  const subtotal = isCatalog ? catalogSubtotal : manualSubtotal;

  const productoOptions = [
    ...productos.map(p => ({
      value: p.id,
      label: p.nombre + (tipoPrecio === 'mayorista' && p.precio_mayorista > 0 ? ' (may.)' : ''),
    })),
    { value: '__new__', label: '+ Crear producto...' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      {isCatalog ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <SearchableSelect
                value={item._creatingNew ? '' : (item.productoId || '')}
                options={productoOptions}
                onChange={v => onChangeProducto(idx, v)}
                placeholder="Buscar producto..."
              />
            </div>
            <input type="number" className="item-qty" min="1" value={item.cantidad} onChange={e => onChangeCantidad(idx, e.target.value)} />
            <button className="btn-icon danger" type="button" onClick={() => onDelete(idx)} disabled={!canDelete} aria-label="Quitar" style={{ opacity: canDelete ? 1 : 0.3 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      ) : (
        <div className="item-row-manual">
          <div className="item-row-manual-fields">
            <input type="text" placeholder="Nombre del ítem" value={item.manualNombre || ''} onChange={e => onChangeManual(idx, { manualNombre: e.target.value })} style={{ minHeight: 40, fontSize: 'var(--text-sm)', padding: 'var(--space-2) var(--space-3)' }} />
            <input type="number" placeholder="Precio" min="0" step="0.01" value={item.manualPrecio || ''} onChange={e => onChangeManual(idx, { manualPrecio: e.target.value })} style={{ minHeight: 40, fontSize: 'var(--text-sm)', padding: 'var(--space-2) var(--space-3)' }} />
            <input type="number" className="item-qty" min="1" value={item.cantidad} onChange={e => onChangeCantidad(idx, e.target.value)} />
            <button className="btn-icon danger" type="button" onClick={() => onDelete(idx)} disabled={!canDelete} aria-label="Quitar" style={{ opacity: canDelete ? 1 : 0.3 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      )}

      {isCatalog && item._creatingNew && (
        <NewProductInline onCreated={(np) => onNewProductCreated(idx, np)} onCancel={() => onChangeProducto(idx, '')} toast={toast} />
      )}

      {/* Entregado */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4, borderTop: '1px solid var(--border)', marginTop: 4 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-2)', cursor: 'pointer', userSelect: 'none' }} onClick={() => onToggleEntregado(idx)}>Entregado</label>
          <div className="toggle">
            <input type="checkbox" checked={item.entregado} onChange={() => onToggleEntregado(idx)} />
            <span className="toggle-track" onClick={() => onToggleEntregado(idx)} />
          </div>
        </div>
        {item.entregado && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>Fecha entrega</label>
            <input
              type="date"
              value={item.fechaEntrega || ''}
              onChange={e => onChangeFechaEntrega(idx, e.target.value)}
              style={{ width: 140, fontSize: 'var(--text-sm)', minHeight: 34, padding: '4px 8px' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main form ────────────────────────────────────────────────────────────────
export function PedidoForm({ clientes, productos: initialProductos, preClienteId, existing, onSave, onBack, onProductoCreated, toast }) {
  const hasProducts = initialProductos.length > 0;
  const defaultMode = hasProducts ? 'catalog' : 'manual';

  const localNegocio = JSON.parse(localStorage.getItem('sg_negocio') || '{}');
  const metodosConfig = localNegocio.metodos_pago || 'Efectivo, Transferencia, Tarjeta';
  const metodosArr = metodosConfig.split(',').map(m => m.trim()).filter(Boolean);
  const defaultMedio = metodosArr[0]?.toLowerCase() || 'efectivo';

  const [productos, setProductos] = useState(initialProductos);
  const [clienteId, setClienteId] = useState(existing?.clienteId || preClienteId || clientes[0]?.id || '');
  const [fecha, setFecha] = useState(existing?.fecha || today());
  const [medioPago, setMedioPago] = useState(existing?.medioPago || defaultMedio);
  const [cuotas, setCuotas] = useState(existing?.cuotas || 1);
  const [interes, setInteres] = useState('');
  const [tipo, setTipo] = useState(existing?.tipo || 'pedido');
  const [cobrado, setCobrado] = useState(existing?.cobrado || false);
  const [finalManual, setFinalManual] = useState(false);
  const [totalFinalVal, setTotalFinalVal] = useState('');
  const [nota, setNota] = useState(existing?.nota || '');
  const [descuentoHab, setDescuentoHab] = useState(!!(existing?.descuentoTipo));
  const [descuentoTipo, setDescuentoTipo] = useState(existing?.descuentoTipo || 'porcentaje');
  const [descuentoVal, setDescuentoVal] = useState(existing?.descuentoValor ? String(existing.descuentoValor) : '');
  const [plazoHab, setPlazoHab] = useState(!!(existing?.diasPlazo));
  const [diasPlazo, setDiasPlazo] = useState(existing?.diasPlazo ? String(existing.diasPlazo) : '30');
  const [tasaMora, setTasaMora] = useState(existing?.tasaMora ? String(existing.tasaMora) : '');
  const [saving, setSaving] = useState(false);

  const tipoPrecio = clientes.find(c => c.id === clienteId)?.tipo_precio || 'minorista';
  const [items, setItems] = useState(
    existing?.items?.length
      ? existing.items.map(i => ({
          mode: i.productoId ? 'catalog' : 'manual',
          productoId: i.productoId || '',
          cantidad: i.cantidad,
          _creatingNew: false,
          manualNombre: i.productoId ? '' : i.nombre,
          manualPrecio: i.productoId ? '' : String(i.precioUnitario),
          entregado: i.entregado || false,
          fechaEntrega: i.fechaEntrega || null,
        }))
      : [{ mode: defaultMode, productoId: '', cantidad: 1, _creatingNew: false, manualNombre: '', manualPrecio: '', entregado: false }]
  );

  if (!clientes.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div className="detail-header">
          <button className="btn-icon" onClick={onBack}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg></button>
          <h2>Nuevo pedido</h2>
        </div>
        <div className="empty-state"><p>Primero agregá un cliente.</p></div>
      </div>
    );
  }

  const getProd = (id) => productos.find(p => p.id === id);
  const getPrecioEfectivo = (prod) =>
    prod ? (tipoPrecio === 'mayorista' && prod.precio_mayorista > 0 ? prod.precio_mayorista : prod.precio) : 0;

  const esTarjeta = medioPago.toLowerCase().includes('tarjeta');
  const efectivoCobrado = esTarjeta ? true : cobrado;
  const pctInteres = esTarjeta ? (parseFloat(interes) || 0) : 0;

  const fechaVenc = (() => {
    try {
      const dias = parseInt(diasPlazo) || 0;
      if (!dias || !fecha) return null;
      const d = new Date(fecha);
      d.setUTCDate(d.getUTCDate() + dias);
      return d.toISOString().slice(0, 10);
    } catch { return null; }
  })();

  const totalCalculado = items.reduce((s, item) => {
    if (item.mode === 'catalog') {
      const p = getProd(item.productoId);
      return s + (p ? getPrecioEfectivo(p) * (item.cantidad || 0) : 0);
    }
    return s + (parseFloat(item.manualPrecio) || 0) * (item.cantidad || 0);
  }, 0);

  const descuentoMonto = descuentoHab
    ? (descuentoTipo === 'porcentaje' ? totalCalculado * (parseFloat(descuentoVal) || 0) / 100 : parseFloat(descuentoVal) || 0)
    : 0;
  const totalConDescuento = Math.max(0, totalCalculado - descuentoMonto);

  function handleChangeProducto(idx, value) {
    setItems(items.map((it, i) => {
      if (i !== idx) return it;
      if (value === '__new__') return { ...it, productoId: '', _creatingNew: true };
      return { ...it, productoId: value, _creatingNew: false };
    }));
  }

  async function handleNewProductCreated(idx, newProd) {
    const newProds = [...productos, newProd];
    setProductos(newProds);
    try {
      await onProductoCreated(newProd);
    } catch (_) {}
    setItems(items.map((it, i) => i === idx ? { ...it, productoId: newProd.id, _creatingNew: false } : it));
    toast('Producto creado');
  }

  function handleChangeCantidad(idx, value) {
    setItems(items.map((it, i) => i === idx ? { ...it, cantidad: Math.max(1, parseInt(value) || 1) } : it));
  }

  function handleChangeManual(idx, patch) {
    setItems(items.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  function handleDeleteItem(idx) {
    setItems(items.filter((_, i) => i !== idx));
  }

  function handleToggleEntregado(idx) {
    setItems(items.map((it, i) => i === idx
      ? { ...it, entregado: !it.entregado, fechaEntrega: !it.entregado ? today() : it.fechaEntrega }
      : it
    ));
  }

  function handleChangeFechaEntrega(idx, value) {
    setItems(items.map((it, i) => i === idx ? { ...it, fechaEntrega: value } : it));
  }

  function handleAddItem() {
    setItems([{ mode: hasProducts ? 'catalog' : 'manual', productoId: '', cantidad: 1, _creatingNew: false, manualNombre: '', manualPrecio: '', entregado: false }, ...items]);
  }

  function handleSave() {
    if (saving) return;
    if (!clienteId || !fecha) { toast('Completá fecha y cliente', 'error'); return; }
    const validItems = items.filter(item => {
      if (item.mode === 'catalog') return item.productoId && item.cantidad > 0;
      return item.manualNombre?.trim() && item.manualPrecio && parseFloat(item.manualPrecio) >= 0 && item.cantidad > 0;
    });
    if (!validItems.length) { toast('Agregá al menos un ítem válido', 'error'); return; }
    if (interes !== '' && (isNaN(parseFloat(interes)) || parseFloat(interes) < 0)) {
      toast('El interés no puede ser negativo', 'error'); return;
    }
    if (descuentoHab && descuentoVal !== '') {
      const dv = parseFloat(descuentoVal);
      if (isNaN(dv) || dv < 0) { toast('El descuento no puede ser negativo', 'error'); return; }
      if (descuentoTipo === 'porcentaje' && dv > 100) { toast('El descuento no puede superar el 100%', 'error'); return; }
    }
    if (finalManual && totalFinalVal !== '' && (isNaN(parseFloat(totalFinalVal)) || parseFloat(totalFinalVal) < 0)) {
      toast('El total final no puede ser negativo', 'error'); return;
    }

    const totalConInteres = totalConDescuento * (1 + pctInteres / 100);
    const totalFinal = finalManual && totalFinalVal !== '' ? parseFloat(totalFinalVal) : totalConInteres;

    const pedidoItems = validItems.map(item => {
      if (item.mode === 'catalog') {
        const p = getProd(item.productoId);
        return { productoId: item.productoId, nombre: p.nombre, cantidad: item.cantidad, precioUnitario: getPrecioEfectivo(p), costoUnitario: p.costo || 0, entregado: item.entregado || false, fechaEntrega: item.fechaEntrega || null };
      }
      return { productoId: null, nombre: item.manualNombre.trim(), cantidad: item.cantidad, precioUnitario: parseFloat(item.manualPrecio) || 0, costoUnitario: 0, entregado: item.entregado || false, fechaEntrega: item.fechaEntrega || null };
    });

    setSaving(true);
    onSave({
      id: existing?.id || uid(),
      clienteId, fecha, items: pedidoItems,
      totalCalculado, totalFinal, medioPago,
      cuotas: esTarjeta ? cuotas : 1,
      cobrado: tipo === 'presupuesto' ? false : efectivoCobrado,
      montoAbonado: tipo === 'presupuesto' ? 0 : (efectivoCobrado ? totalFinal : (existing?.montoAbonado || 0)),
      nota: nota.trim() || null, tipo,
      descuentoTipo: descuentoHab ? descuentoTipo : null,
      descuentoValor: descuentoHab ? (parseFloat(descuentoVal) || 0) : 0,
      diasPlazo: tipo === 'pedido' && plazoHab ? (parseInt(diasPlazo) || 0) : 0,
      tasaMora: tipo === 'pedido' && plazoHab ? (parseFloat(tasaMora) || 0) : 0,
    });
  }

  const clienteOptions = clientes.map(c => ({ value: c.id, label: c.nombre + (c.tipo_precio === 'mayorista' ? ' [may.]' : '') }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div className="detail-header">
        <button className="btn-icon" onClick={saving ? undefined : onBack} aria-label="Volver" style={{ opacity: saving ? 0.5 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2>{existing ? 'Editar pedido' : 'Nuevo pedido'}</h2>
      </div>

      <div className="form-wrap" style={{ paddingBottom: 'var(--space-8)' }}>
        {!existing && (
          <>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button type="button" className={`filter-chip${tipo === 'pedido' ? ' active' : ''}`} style={{ flex: 1, minHeight: 44 }} onClick={() => setTipo('pedido')}>Pedido</button>
              <button type="button" className={`filter-chip${tipo === 'presupuesto' ? ' active' : ''}`} style={{ flex: 1, minHeight: 44 }} onClick={() => setTipo('presupuesto')}>Presupuesto</button>
            </div>
            {tipo === 'presupuesto' && (
              <div style={{ background: 'var(--tarjeta-bg)', border: '1px solid var(--tarjeta)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--tarjeta)' }}>
                No descuenta stock ni afecta el saldo del cliente hasta que se convierta en pedido.
              </div>
            )}
          </>
        )}

        <div className="form-group">
          <label>Cliente</label>
          <SearchableSelect value={clienteId} options={clienteOptions} onChange={setClienteId} placeholder="Buscar cliente..." />
        </div>

        {tipoPrecio === 'mayorista' && (
          <div style={{ background: 'rgba(204,255,0,0.08)', border: '1px solid rgba(204,255,0,0.3)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--primary)', fontWeight: 600 }}>
            Cliente mayorista — se aplican precios mayoristas automáticamente
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="pf-fecha">Fecha</label>
            <input type="date" id="pf-fecha" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="pf-medio">Medio de pago</label>
            <select id="pf-medio" value={medioPago} onChange={e => { setMedioPago(e.target.value); if (!e.target.value.toLowerCase().includes('tarjeta')) setCuotas(1); }}>
              {metodosArr.map(m => (
                <option key={m} value={m.toLowerCase()}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {esTarjeta && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div className="form-row">
              <div className="form-group">
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--ink-2)' }}>Cuotas</label>
                <select value={cuotas} onChange={e => { setCuotas(parseInt(e.target.value)); setFinalManual(false); setTotalFinalVal(''); }}>
                  <option value={1}>1 cuota (contado)</option>
                  <option value={3}>3 cuotas</option>
                  <option value={6}>6 cuotas</option>
                  <option value={12}>12 cuotas</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--ink-2)' }}>Interés % <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>(opcional)</span></label>
                <input type="number" placeholder="0" min="0" step="0.1" value={interes} onChange={e => { setInteres(e.target.value); setFinalManual(false); setTotalFinalVal(''); }} />
              </div>
            </div>
            {pctInteres > 0 && (
              <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--ink-2)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Recargo {pctInteres}%</span>
                <span style={{ color: 'var(--ink)', fontWeight: 600 }}>+ {formatCurrency(totalCalculado * pctInteres / 100)}</span>
              </div>
            )}
          </div>
        )}

        <div>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--ink-2)', display: 'block', marginBottom: 'var(--space-2)' }}>Ítems</label>
          <div className="items-list">
            {items.map((item, idx) => (
              <ItemRow
                key={idx}
                item={item}
                idx={idx}
                productos={productos}
                tipoPrecio={tipoPrecio}
                onChangeProducto={handleChangeProducto}
                onChangeCantidad={handleChangeCantidad}
                onDelete={handleDeleteItem}
                canDelete={items.length > 1}
                onNewProductCreated={handleNewProductCreated}
                onChangeManual={handleChangeManual}
                onToggleEntregado={handleToggleEntregado}
                onChangeFechaEntrega={handleChangeFechaEntrega}
                toast={toast}
              />
            ))}
          </div>
          <button className="btn btn-secondary btn-full" type="button" style={{ marginTop: 'var(--space-3)' }} onClick={handleAddItem}>+ Agregar ítem</button>
        </div>

        {tipo === 'pedido' && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {!esTarjeta && (
              <button type="button" className={`opt-chip${cobrado ? ' opt-chip--cobrado' : ''}`} onClick={() => setCobrado(v => !v)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Cobrado
              </button>
            )}
            <button type="button" className={`opt-chip${plazoHab ? ' opt-chip--plazo' : ''}`} onClick={() => setPlazoHab(v => !v)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              A plazo
            </button>
            <button type="button" className={`opt-chip${descuentoHab ? ' opt-chip--descuento' : ''}`} onClick={() => setDescuentoHab(v => !v)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
              Descuento
            </button>
          </div>
        )}

        {tipo === 'pedido' && plazoHab && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div className="form-group">
              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--ink-2)' }}>Días de plazo</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {['15','30','45','60','90'].map(d => (
                  <button key={d} type="button" className={`filter-chip${diasPlazo === d ? ' active' : ''}`} style={{ minHeight: 36 }} onClick={() => setDiasPlazo(d)}>{d} días</button>
                ))}
                <input
                  type="number" inputMode="numeric" min="1" placeholder="Otro"
                  value={['15','30','45','60','90'].includes(diasPlazo) ? '' : diasPlazo}
                  onChange={e => setDiasPlazo(e.target.value)}
                  style={{ width: 80, minHeight: 36, fontSize: 'var(--text-sm)', padding: '4px 10px' }}
                />
              </div>
            </div>
            <div className="form-group">
              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--ink-2)' }}>
                Tasa de mora mensual % <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>(opcional)</span>
              </label>
              <input type="number" inputMode="decimal" min="0" step="0.1" placeholder="Ej: 3" value={tasaMora} onChange={e => setTasaMora(e.target.value)} style={{ minHeight: 40, fontSize: 'var(--text-sm)' }} />
            </div>
            {fechaVenc && (
              <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--ink-2)' }}>
                Vence el {formatDate(fechaVenc)}
                {tasaMora && parseFloat(tasaMora) > 0 && ` · ${tasaMora}% mensual de mora si no paga`}
              </div>
            )}
          </div>
        )}

        {descuentoHab && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button type="button" className={`filter-chip${descuentoTipo === 'porcentaje' ? ' active' : ''}`} style={{ flex: 1, minHeight: 38 }} onClick={() => setDescuentoTipo('porcentaje')}>%</button>
              <button type="button" className={`filter-chip${descuentoTipo === 'monto_fijo' ? ' active' : ''}`} style={{ flex: 1, minHeight: 38 }} onClick={() => setDescuentoTipo('monto_fijo')}>$ fijo</button>
            </div>
            <input type="number" inputMode="decimal" min="0" step="0.01" placeholder={descuentoTipo === 'porcentaje' ? '10' : '500'} value={descuentoVal} onChange={e => { setDescuentoVal(e.target.value); setFinalManual(false); setTotalFinalVal(''); }} style={{ minHeight: 40, fontSize: 'var(--text-sm)' }} />
          </div>
        )}

        <div style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>
            <span>Subtotal</span><span>{formatCurrency(totalCalculado)}</span>
          </div>
          {descuentoMonto > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--danger)' }}>
              <span>Descuento{descuentoTipo === 'porcentaje' ? ` (${descuentoVal}%)` : ''}</span>
              <span>−{formatCurrency(descuentoMonto)}</span>
            </div>
          )}
          {pctInteres > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--ink-2)' }}>
              <span>Recargo {pctInteres}%</span>
              <span>+{formatCurrency(totalConDescuento * pctInteres / 100)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--ink)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-2)' }}>
            <span>Total</span>
            <span>{formatCurrency(finalManual && totalFinalVal !== '' ? parseFloat(totalFinalVal) || 0 : totalConDescuento * (1 + pctInteres / 100))}</span>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="pf-final">Ajustar total final <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: 'var(--text-xs)' }}>(opcional)</span></label>
          <input id="pf-final" type="number" placeholder={String(Math.round(totalConDescuento * (1 + pctInteres / 100) * 100) / 100)} min="0" value={totalFinalVal} onChange={e => { setTotalFinalVal(e.target.value); setFinalManual(true); }} />
        </div>

        <div className="form-group">
          <label htmlFor="pf-nota">Nota <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>(opcional)</span></label>
          <textarea id="pf-nota" placeholder="Ej: entregar en depósito, llamar antes..." value={nota} onChange={e => setNota(e.target.value)} rows={2} style={{ resize: 'none', minHeight: 64 }} />
        </div>

        <button className="btn btn-primary btn-full" type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : existing ? 'Actualizar pedido' : 'Guardar pedido'}
        </button>
      </div>
    </div>
  );
}
