import { useState, useRef, useEffect } from 'react';
import { formatCurrency, today, uid } from '../../lib/utils.js';

// ── Searchable select ────────────────────────────────────────────────────────
function SearchableSelect({ value, options, onChange, placeholder = 'Buscar...' }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const selected = options.find(o => o.value === value);
  const filtered = q.trim()
    ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) return;
    function onDown(e) { if (!wrapRef.current?.contains(e.target)) setOpen(false); }
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', minHeight: 40 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          value={open ? q : (selected?.label || '')}
          placeholder={placeholder}
          onChange={e => setQ(e.target.value)}
          onFocus={() => { setOpen(true); setQ(''); }}
          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 'var(--text-sm)', color: 'var(--ink)', minHeight: 38 }}
        />
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 200, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          {filtered.map(o => (
            <div
              key={o.value}
              onPointerDown={e => { e.preventDefault(); onChange(o.value); setOpen(false); setQ(''); }}
              style={{ padding: '10px 12px', fontSize: 'var(--text-sm)', color: o.value === value ? '#ccff00' : 'var(--ink)', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
            >
              {o.label}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '10px 12px', color: 'var(--ink-3)', fontSize: 'var(--text-sm)' }}>Sin resultados</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── New product inline ───────────────────────────────────────────────────────
function NewProductInline({ onCreated, onCancel, toast }) {
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [costo, setCosto] = useState('');

  function handleCreate() {
    if (!nombre.trim()) { toast('Ingresá el nombre', 'error'); return; }
    if (!precio || parseFloat(precio) <= 0) { toast('Ingresá el precio', 'error'); return; }
    const np = { id: uid(), nombre: nombre.trim(), precio: parseFloat(precio), costo: parseFloat(costo) || 0 };
    onCreated(np);
  }

  return (
    <div className="new-prod-inline">
      <input type="text" className="np-nombre" placeholder="Nombre del producto" value={nombre} onChange={e => setNombre(e.target.value)} autoFocus />
      <input type="number" className="np-precio" placeholder="Precio" min="0" step="0.01" value={precio} onChange={e => setPrecio(e.target.value)} />
      <input type="number" className="np-costo" placeholder="Costo" min="0" step="0.01" value={costo} onChange={e => setCosto(e.target.value)} />
      <div className="np-actions">
        <button className="btn btn-primary" onClick={handleCreate}>✓ Crear</button>
        <button className="btn btn-secondary" onClick={onCancel}>✕</button>
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

  function setMode(mode) {
    onChangeManual(idx, { mode, productoId: '', manualNombre: '', manualPrecio: '', cantidad: item.cantidad, _creatingNew: false });
  }

  const productoOptions = [
    ...productos.map(p => ({
      value: p.id,
      label: p.nombre + (tipoPrecio === 'mayorista' && p.precio_mayorista > 0 ? ' (may.)' : ''),
    })),
    { value: '__new__', label: '+ Crear producto...' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <div className="item-type-toggle">
        <button type="button" className={`item-type-btn${isCatalog ? ' active' : ''}`} onClick={() => setMode('catalog')}>Catálogo</button>
        <button type="button" className={`item-type-btn${!isCatalog ? ' active' : ''}`} onClick={() => setMode('manual')}>Manual</button>
      </div>

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
            <span className="item-subtotal">{item.productoId ? formatCurrency(subtotal) : '—'}</span>
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
            <span className="item-subtotal">{item.manualPrecio ? formatCurrency(manualSubtotal) : '—'}</span>
            <button className="btn-icon danger" type="button" onClick={() => onDelete(idx)} disabled={!canDelete} aria-label="Quitar" style={{ opacity: canDelete ? 1 : 0.3 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      )}

      {isCatalog && item._creatingNew && (
        <NewProductInline onCreated={(np) => onNewProductCreated(idx, np)} onCancel={() => onChangeProducto(idx, '')} toast={toast} />
      )}

      {/* Entregado toggle + fecha */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 2 }}>
        <button
          type="button"
          onClick={() => onToggleEntregado(idx)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 'var(--text-xs)', color: item.entregado ? '#ccff00' : 'var(--ink-3)', flexShrink: 0 }}
        >
          <span style={{ width: 15, height: 15, borderRadius: 3, border: `1.5px solid ${item.entregado ? '#ccff00' : 'var(--ink-3)'}`, background: item.entregado ? '#ccff00' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {item.entregado && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><polyline points="1,3.5 3.5,6 8,1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </span>
          Entregado
        </button>
        {item.entregado && (
          <input
            type="date"
            value={item.fechaEntrega || ''}
            onChange={e => onChangeFechaEntrega(idx, e.target.value)}
            style={{ fontSize: 'var(--text-xs)', minHeight: 28, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)' }}
          />
        )}
      </div>
    </div>
  );
}

// ── Main form ────────────────────────────────────────────────────────────────
export function PedidoForm({ clientes, productos: initialProductos, preClienteId, existing, onSave, onBack, onProductoCreated, toast }) {
  const hasProducts = initialProductos.length > 0;
  const defaultMode = hasProducts ? 'catalog' : 'manual';

  const [productos, setProductos] = useState(initialProductos);
  const [clienteId, setClienteId] = useState(existing?.clienteId || preClienteId || clientes[0]?.id || '');
  const [fecha, setFecha] = useState(existing?.fecha || today());
  const [medioPago, setMedioPago] = useState(existing?.medioPago || 'efectivo');
  const [cuotas, setCuotas] = useState(existing?.cuotas || 1);
  const [interes, setInteres] = useState('');
  const [tipo, setTipo] = useState(existing?.tipo || 'pedido');
  const [cobrado, setCobrado] = useState(existing?.cobrado || false);
  const [finalManual, setFinalManual] = useState(existing ? true : false);
  const [totalFinalVal, setTotalFinalVal] = useState(existing?.totalFinal ? String(existing.totalFinal) : '');
  const [nota, setNota] = useState(existing?.nota || '');
  const [descuentoHab, setDescuentoHab] = useState(!!(existing?.descuentoTipo));
  const [descuentoTipo, setDescuentoTipo] = useState(existing?.descuentoTipo || 'porcentaje');
  const [descuentoVal, setDescuentoVal] = useState(existing?.descuentoValor ? String(existing.descuentoValor) : '');

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

  const esTarjeta = medioPago === 'tarjeta';
  const efectivoCobrado = esTarjeta ? false : cobrado;
  const pctInteres = medioPago === 'tarjeta' ? (parseFloat(interes) || 0) : 0;

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

  function handleNewProductCreated(idx, newProd) {
    const newProds = [...productos, newProd];
    setProductos(newProds);
    onProductoCreated(newProd);
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
    if (!clienteId || !fecha) { toast('Completá fecha y cliente', 'error'); return; }
    const validItems = items.filter(item => {
      if (item.mode === 'catalog') return item.productoId && item.cantidad > 0;
      return item.manualNombre?.trim() && item.manualPrecio && parseFloat(item.manualPrecio) >= 0 && item.cantidad > 0;
    });
    if (!validItems.length) { toast('Agregá al menos un ítem válido', 'error'); return; }

    const totalConInteres = totalConDescuento * (1 + pctInteres / 100);
    const totalFinal = finalManual && totalFinalVal !== '' ? parseFloat(totalFinalVal) : totalConInteres;

    const pedidoItems = validItems.map(item => {
      if (item.mode === 'catalog') {
        const p = getProd(item.productoId);
        return { productoId: item.productoId, nombre: p.nombre, cantidad: item.cantidad, precioUnitario: getPrecioEfectivo(p), costoUnitario: p.costo || 0, entregado: item.entregado || false, fechaEntrega: item.fechaEntrega || null };
      }
      return { productoId: null, nombre: item.manualNombre.trim(), cantidad: item.cantidad, precioUnitario: parseFloat(item.manualPrecio) || 0, costoUnitario: 0, entregado: item.entregado || false, fechaEntrega: item.fechaEntrega || null };
    });

    onSave({
      id: existing?.id || uid(),
      clienteId, fecha, items: pedidoItems,
      totalCalculado, totalFinal, medioPago,
      cuotas: medioPago === 'tarjeta' ? cuotas : 1,
      cobrado: tipo === 'presupuesto' ? false : efectivoCobrado,
      montoAbonado: tipo === 'presupuesto' ? 0 : (efectivoCobrado ? totalFinal : (existing?.montoAbonado || 0)),
      nota: nota.trim() || null, tipo,
      descuentoTipo: descuentoHab ? descuentoTipo : null,
      descuentoValor: descuentoHab ? (parseFloat(descuentoVal) || 0) : 0,
    });
  }

  const clienteOptions = clientes.map(c => ({ value: c.id, label: c.nombre + (c.tipo_precio === 'mayorista' ? ' ★' : '') }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div className="detail-header">
        <button className="btn-icon" onClick={onBack} aria-label="Volver">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2>{existing ? 'Editar pedido' : 'Nuevo pedido'}</h2>
      </div>

      <div className="form-wrap" style={{ paddingBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button type="button" className={`filter-chip${tipo === 'pedido' ? ' active' : ''}`} style={{ flex: 1, minHeight: 44 }} onClick={() => setTipo('pedido')}>Pedido</button>
          <button type="button" className={`filter-chip${tipo === 'presupuesto' ? ' active' : ''}`} style={{ flex: 1, minHeight: 44 }} onClick={() => setTipo('presupuesto')}>Presupuesto</button>
        </div>
        {tipo === 'presupuesto' && (
          <div style={{ background: 'var(--tarjeta-bg)', border: '1px solid var(--tarjeta)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--tarjeta)' }}>
            No descuenta stock ni afecta el saldo del cliente hasta que se convierta en pedido.
          </div>
        )}

        <div className="form-group">
          <label>Cliente</label>
          <SearchableSelect value={clienteId} options={clienteOptions} onChange={setClienteId} placeholder="Buscar cliente..." />
        </div>

        {tipoPrecio === 'mayorista' && (
          <div style={{ background: 'rgba(204,255,0,0.08)', border: '1px solid rgba(204,255,0,0.3)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--primary)', fontWeight: 600 }}>
            ★ Cliente mayorista — se aplican precios mayoristas automáticamente
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="pf-fecha">Fecha</label>
            <input type="date" id="pf-fecha" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="pf-medio">Medio de pago</label>
            <select id="pf-medio" value={medioPago} onChange={e => { setMedioPago(e.target.value); if (e.target.value !== 'tarjeta') setCuotas(1); }}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </div>
        </div>

        {medioPago === 'tarjeta' && (
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--ink-2)' }}>Ítems</label>
            <button className="btn btn-secondary" type="button" style={{ minHeight: 36, padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-sm)' }} onClick={handleAddItem}>+ Ítem</button>
          </div>
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
        </div>

        {!esTarjeta && (
          <div className="toggle-row">
            <label htmlFor="pf-cobrado">Cobrado ahora</label>
            <div className="toggle">
              <input type="checkbox" id="pf-cobrado" checked={cobrado} onChange={e => setCobrado(e.target.checked)} />
              <span className="toggle-track" onClick={() => setCobrado(v => !v)} />
            </div>
          </div>
        )}

        <div>
          <div className="toggle-row" style={{ marginBottom: descuentoHab ? 'var(--space-3)' : 0 }}>
            <label>Aplicar descuento</label>
            <div className="toggle">
              <input type="checkbox" id="pf-descuento" checked={descuentoHab} onChange={e => setDescuentoHab(e.target.checked)} />
              <span className="toggle-track" onClick={() => setDescuentoHab(v => !v)} />
            </div>
          </div>
          {descuentoHab && (
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <select value={descuentoTipo} onChange={e => setDescuentoTipo(e.target.value)} style={{ flex: '0 0 auto', minHeight: 40, fontSize: 'var(--text-sm)' }}>
                <option value="porcentaje">%</option>
                <option value="monto_fijo">$ fijo</option>
              </select>
              <input type="number" min="0" step="0.01" placeholder={descuentoTipo === 'porcentaje' ? '10' : '500'} value={descuentoVal} onChange={e => { setDescuentoVal(e.target.value); setFinalManual(false); setTotalFinalVal(''); }} style={{ flex: 1, minHeight: 40, fontSize: 'var(--text-sm)' }} />
            </div>
          )}
        </div>

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

        <button className="btn btn-primary btn-full" type="button" onClick={handleSave}>
          {existing ? 'Actualizar pedido' : 'Guardar pedido'}
        </button>
      </div>
    </div>
  );
}
