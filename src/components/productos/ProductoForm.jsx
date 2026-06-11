import { useState, useEffect, useRef } from 'react';
import { Modal } from '../shared/Modal.jsx';

export function ProductoForm({ open, existing, onSave, onClose }) {
  const [nombre, setNombre] = useState('');
  const [marca, setMarca] = useState('');
  const [precio, setPrecio] = useState('');
  const [costo, setCosto] = useState('');
  const [precioMayorista, setPrecioMayorista] = useState('');
  const [stock, setStock] = useState('0');
  const [stockMinimo, setStockMinimo] = useState('5');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setNombre(existing?.nombre || '');
      setMarca(existing?.marca || '');
      setPrecio(existing?.precio != null ? String(existing.precio) : '');
      setCosto(existing?.costo != null ? String(existing.costo) : '');
      setPrecioMayorista(existing?.precio_mayorista != null ? String(existing.precio_mayorista) : '');
      setStock(existing?.stock != null ? String(existing.stock) : '0');
      setStockMinimo(existing?.stock_minimo != null ? String(existing.stock_minimo) : '5');
      setError('');
    }
  }, [open, existing]);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setSaving(false);
      savingRef.current = false;
    }
  }, [open]);

  async function handleSave() {
    if (savingRef.current) return;
    if (!nombre.trim() || isNaN(parseFloat(precio)) || parseFloat(precio) < 0) {
      setError('Completá nombre y precio');
      return;
    }
    const campos = [
      [costo, 'El costo'],
      [precioMayorista, 'El precio mayorista'],
      [stock, 'El stock'],
      [stockMinimo, 'El stock mínimo'],
    ];
    for (const [val, label] of campos) {
      if (val !== '' && (isNaN(parseFloat(val)) || parseFloat(val) < 0)) {
        setError(`${label} no puede ser negativo`);
        return;
      }
    }
    savingRef.current = true;
    setSaving(true);
    try {
      await onSave({
        ...existing,
        nombre: nombre.trim(),
        marca: marca.trim() || null,
        precio: parseFloat(precio),
        costo: parseFloat(costo) || 0,
        precio_mayorista: parseFloat(precioMayorista) || 0,
        stock: parseInt(stock) || 0,
        stock_minimo: parseInt(stockMinimo) || 5,
      });
    } catch (e) {
      setError(e.message);
      savingRef.current = false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={existing ? 'Editar producto' : 'Nuevo producto'}
      onClose={saving ? () => {} : onClose}
    >
      {open && (
        <>
          <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="pp-nombre">Nombre</label>
                <input id="pp-nombre" type="text" placeholder="Nombre del producto" value={nombre} onChange={e => setNombre(e.target.value)} autoCorrect="off" autoFocus disabled={saving} />
              </div>
              <div className="form-group">
                <label htmlFor="pp-marca">Marca <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>(opcional)</span></label>
                <input id="pp-marca" type="text" placeholder="Ej: Nike, Samsung..." value={marca} onChange={e => setMarca(e.target.value)} autoCorrect="off" disabled={saving} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="pp-precio">Precio minorista ($)</label>
                <input id="pp-precio" type="number" placeholder="0" min="0" value={precio} onChange={e => setPrecio(e.target.value)} disabled={saving} />
              </div>
              <div className="form-group">
                <label htmlFor="pp-mayorista">Precio mayorista ($)</label>
                <input id="pp-mayorista" type="number" placeholder="0" min="0" value={precioMayorista} onChange={e => setPrecioMayorista(e.target.value)} disabled={saving} />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="pp-costo">Costo unitario ($)</label>
              <input id="pp-costo" type="number" placeholder="0" min="0" value={costo} onChange={e => setCosto(e.target.value)} disabled={saving} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="pp-stock">Stock actual</label>
                <input
                  id="pp-stock"
                  type="number"
                  placeholder="0"
                  min="0"
                  step="1"
                  value={stock}
                  onChange={e => setStock(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="form-group">
                <label htmlFor="pp-stock-min">Stock mínimo</label>
                <input
                  id="pp-stock-min"
                  type="number"
                  placeholder="5"
                  min="0"
                  step="1"
                  value={stockMinimo}
                  onChange={e => setStockMinimo(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-sm)' }}>{error}</p>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)', paddingTop: 0 }}>
            <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button className="btn btn-secondary btn-full" onClick={onClose} disabled={saving}>Cancelar</button>
          </div>
        </>
      )}
    </Modal>
  );
}
