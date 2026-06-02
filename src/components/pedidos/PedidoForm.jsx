import { useState } from 'react';
import { formatCurrency, today, uid } from '../../lib/utils.js';

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
      <input
        type="text"
        className="np-nombre"
        placeholder="Nombre del producto"
        value={nombre}
        onChange={e => setNombre(e.target.value)}
        autoFocus
      />
      <input
        type="number"
        className="np-precio"
        placeholder="Precio"
        min="0"
        step="0.01"
        value={precio}
        onChange={e => setPrecio(e.target.value)}
      />
      <input
        type="number"
        className="np-costo"
        placeholder="Costo"
        min="0"
        step="0.01"
        value={costo}
        onChange={e => setCosto(e.target.value)}
      />
      <div className="np-actions">
        <button className="btn btn-primary" onClick={handleCreate}>✓ Crear</button>
        <button className="btn btn-secondary" onClick={onCancel}>✕</button>
      </div>
    </div>
  );
}

// ── Single item row — supports catalog and manual mode ──────────────────────
function ItemRow({ item, idx, productos, onChangeProducto, onChangeCantidad, onDelete, canDelete, onNewProductCreated, onChangeManual, toast }) {
  const isCatalog = item.mode === 'catalog';

  // For catalog mode
  const prod = isCatalog ? productos.find(p => p.id === item.productoId) : null;
  const catalogSubtotal = prod ? prod.precio * (item.cantidad || 0) : 0;

  // For manual mode
  const manualSubtotal = !isCatalog ? (parseFloat(item.manualPrecio) || 0) * (item.cantidad || 0) : 0;

  const subtotal = isCatalog ? catalogSubtotal : manualSubtotal;

  function setMode(mode) {
    onChangeManual(idx, { mode, productoId: '', manualNombre: '', manualPrecio: '', cantidad: item.cantidad, _creatingNew: false });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      {/* Mode toggle */}
      <div className="item-type-toggle">
        <button
          type="button"
          className={`item-type-btn${isCatalog ? ' active' : ''}`}
          onClick={() => setMode('catalog')}
        >
          Catálogo
        </button>
        <button
          type="button"
          className={`item-type-btn${!isCatalog ? ' active' : ''}`}
          onClick={() => setMode('manual')}
        >
          Manual
        </button>
      </div>

      {isCatalog ? (
        <div className="item-row">
          <select
            value={item._creatingNew ? '' : (item.productoId || '')}
            onChange={e => onChangeProducto(idx, e.target.value)}
          >
            <option value="">Seleccionar...</option>
            {productos.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
            <option value="__new__">+ Crear producto...</option>
          </select>
          <input
            type="number"
            className="item-qty"
            min="1"
            value={item.cantidad}
            onChange={e => onChangeCantidad(idx, e.target.value)}
          />
          <span className="item-subtotal">{item.productoId ? formatCurrency(subtotal) : '—'}</span>
          <button
            className="btn-icon danger"
            type="button"
            onClick={() => onDelete(idx)}
            disabled={!canDelete}
            aria-label="Quitar"
            style={{ opacity: canDelete ? 1 : 0.3 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="item-row-manual">
          <div className="item-row-manual-fields">
            <input
              type="text"
              placeholder="Nombre del ítem"
              value={item.manualNombre || ''}
              onChange={e => onChangeManual(idx, { manualNombre: e.target.value })}
              style={{ minHeight: 40, fontSize: 'var(--text-sm)', padding: 'var(--space-2) var(--space-3)' }}
            />
            <input
              type="number"
              placeholder="Precio"
              min="0"
              step="0.01"
              value={item.manualPrecio || ''}
              onChange={e => onChangeManual(idx, { manualPrecio: e.target.value })}
              style={{ minHeight: 40, fontSize: 'var(--text-sm)', padding: 'var(--space-2) var(--space-3)' }}
            />
            <input
              type="number"
              className="item-qty"
              min="1"
              value={item.cantidad}
              onChange={e => onChangeCantidad(idx, e.target.value)}
            />
            <span className="item-subtotal">{item.manualPrecio ? formatCurrency(manualSubtotal) : '—'}</span>
            <button
              className="btn-icon danger"
              type="button"
              onClick={() => onDelete(idx)}
              disabled={!canDelete}
              aria-label="Quitar"
              style={{ opacity: canDelete ? 1 : 0.3 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {isCatalog && item._creatingNew && (
        <NewProductInline
          onCreated={(np) => onNewProductCreated(idx, np)}
          onCancel={() => onChangeProducto(idx, '')}
          toast={toast}
        />
      )}
    </div>
  );
}

// ── Main form ────────────────────────────────────────────────────────────────
export function PedidoForm({ clientes, productos: initialProductos, preClienteId, onSave, onBack, onProductoCreated, toast }) {
  const hasProducts = initialProductos.length > 0;
  const defaultMode = hasProducts ? 'catalog' : 'manual';

  const [productos, setProductos] = useState(initialProductos);
  const [clienteId, setClienteId] = useState(preClienteId || clientes[0]?.id || '');
  const [fecha, setFecha] = useState(today());
  const [medioPago, setMedioPago] = useState('efectivo');
  const [cuotas, setCuotas] = useState(1);
  const [interes, setInteres] = useState('');
  const [cobrado, setCobrado] = useState(false);
  const [finalManual, setFinalManual] = useState(false);
  const [totalFinalVal, setTotalFinalVal] = useState('');
  const [items, setItems] = useState([{
    mode: defaultMode,
    productoId: '',
    cantidad: 1,
    _creatingNew: false,
    manualNombre: '',
    manualPrecio: '',
  }]);

  if (!clientes.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div className="detail-header">
          <button className="btn-icon" onClick={onBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h2>Nuevo pedido</h2>
        </div>
        <div className="empty-state"><p>Primero agregá un cliente.</p></div>
      </div>
    );
  }

  const getProd = (id) => productos.find(p => p.id === id);

  const autoCobrado = medioPago === 'tarjeta' && cuotas === 1;
  const efectivoCobrado = autoCobrado ? true : cobrado;

  const pctInteres = medioPago === 'tarjeta' ? (parseFloat(interes) || 0) : 0;

  const totalCalculado = items.reduce((s, item) => {
    if (item.mode === 'catalog') {
      const p = getProd(item.productoId);
      return s + (p ? p.precio * (item.cantidad || 0) : 0);
    } else {
      return s + (parseFloat(item.manualPrecio) || 0) * (item.cantidad || 0);
    }
  }, 0);

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
    setItems(items.map((it, i) =>
      i === idx ? { ...it, productoId: newProd.id, _creatingNew: false } : it
    ));
    toast('Producto creado');
  }

  function handleChangeCantidad(idx, value) {
    setItems(items.map((it, i) =>
      i === idx ? { ...it, cantidad: Math.max(1, parseInt(value) || 1) } : it
    ));
  }

  function handleChangeManual(idx, patch) {
    setItems(items.map((it, i) =>
      i === idx ? { ...it, ...patch } : it
    ));
  }

  function handleDeleteItem(idx) {
    setItems(items.filter((_, i) => i !== idx));
  }

  function handleAddItem() {
    setItems([...items, {
      mode: hasProducts ? 'catalog' : 'manual',
      productoId: '',
      cantidad: 1,
      _creatingNew: false,
      manualNombre: '',
      manualPrecio: '',
    }]);
  }

  function handleSave() {
    if (!clienteId || !fecha) { toast('Completá fecha y cliente', 'error'); return; }

    const validItems = items.filter(item => {
      if (item.mode === 'catalog') return item.productoId && item.cantidad > 0;
      return item.manualNombre && item.manualNombre.trim() && item.manualPrecio && parseFloat(item.manualPrecio) >= 0 && item.cantidad > 0;
    });

    if (!validItems.length) { toast('Agregá al menos un ítem válido', 'error'); return; }

    const totalConInteres = totalCalculado * (1 + pctInteres / 100);
    const totalFinal = finalManual && totalFinalVal !== '' ? parseFloat(totalFinalVal) : totalConInteres;

    const pedidoItems = validItems.map(item => {
      if (item.mode === 'catalog') {
        const p = getProd(item.productoId);
        return {
          productoId: item.productoId,
          nombre: p.nombre,
          cantidad: item.cantidad,
          precioUnitario: p.precio,
          costoUnitario: p.costo || 0,
        };
      } else {
        return {
          productoId: null,
          nombre: item.manualNombre.trim(),
          cantidad: item.cantidad,
          precioUnitario: parseFloat(item.manualPrecio) || 0,
          costoUnitario: 0,
        };
      }
    });

    const pedido = {
      id: uid(),
      clienteId,
      fecha,
      items: pedidoItems,
      totalCalculado,
      totalFinal,
      medioPago,
      cuotas: medioPago === 'tarjeta' ? cuotas : 1,
      cobrado: efectivoCobrado,
      montoAbonado: efectivoCobrado ? totalFinal : 0,
    };

    onSave(pedido);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div className="detail-header">
        <button className="btn-icon" onClick={onBack} aria-label="Volver">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h2>Nuevo pedido</h2>
      </div>

      <div className="form-wrap" style={{ paddingBottom: 'var(--space-8)' }}>
        <div className="form-group">
          <label htmlFor="pf-cliente">Cliente</label>
          <select id="pf-cliente" value={clienteId} onChange={e => setClienteId(e.target.value)}>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

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
                <input
                  type="number"
                  placeholder="0"
                  min="0"
                  step="0.1"
                  value={interes}
                  onChange={e => { setInteres(e.target.value); setFinalManual(false); setTotalFinalVal(''); }}
                />
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
            <button
              className="btn btn-secondary"
              type="button"
              style={{ minHeight: 36, padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-sm)' }}
              onClick={handleAddItem}
            >
              + Ítem
            </button>
          </div>
          <div className="items-list">
            {items.map((item, idx) => (
              <ItemRow
                key={idx}
                item={item}
                idx={idx}
                productos={productos}
                onChangeProducto={handleChangeProducto}
                onChangeCantidad={handleChangeCantidad}
                onDelete={handleDeleteItem}
                canDelete={items.length > 1}
                onNewProductCreated={handleNewProductCreated}
                onChangeManual={handleChangeManual}
                toast={toast}
              />
            ))}
          </div>
        </div>

        {autoCobrado ? (
          <div className="toggle-row" style={{ opacity: 0.6 }}>
            <label>Cobrado ahora</label>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--success)' }}>Automático (tarjeta 1 cuota)</span>
          </div>
        ) : (
          <div className="toggle-row">
            <label htmlFor="pf-cobrado">Cobrado ahora</label>
            <div className="toggle">
              <input
                type="checkbox"
                id="pf-cobrado"
                checked={cobrado}
                onChange={e => setCobrado(e.target.checked)}
              />
              <span className="toggle-track" onClick={() => setCobrado(v => !v)} />
            </div>
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label>Subtotal</label>
            <input
              type="text"
              value={formatCurrency(totalCalculado)}
              readOnly
              style={{ color: 'var(--ink-3)' }}
            />
          </div>
          <div className="form-group">
            <label htmlFor="pf-final">Total final ($){pctInteres > 0 && <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: 'var(--text-xs)' }}> con interés</span>}</label>
            <input
              id="pf-final"
              type="number"
              placeholder={String(Math.round((totalCalculado * (1 + pctInteres / 100)) * 100) / 100)}
              min="0"
              value={totalFinalVal}
              onChange={e => { setTotalFinalVal(e.target.value); setFinalManual(true); }}
            />
          </div>
        </div>

        <button className="btn btn-primary btn-full" type="button" onClick={handleSave}>
          Guardar pedido
        </button>
      </div>
    </div>
  );
}
