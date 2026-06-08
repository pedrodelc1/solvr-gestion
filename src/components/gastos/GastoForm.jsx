import { useState, useRef, useEffect } from 'react';
import { Modal } from '../shared/Modal.jsx';
import { today } from '../../lib/utils.js';

export function GastoForm({ open, categorias, onSave, onClose }) {
  const [desc, setDesc] = useState('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(today());
  const [cat, setCat] = useState(categorias[0] || 'Otros');
  const [error, setError] = useState('');

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
    if (!desc.trim() || !fecha || isNaN(parseFloat(monto)) || parseFloat(monto) <= 0) {
      setError('Completá todos los campos');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      await onSave({ descripcion: desc.trim(), monto: parseFloat(monto), fecha, categoria: cat });
      setDesc('');
      setMonto('');
      setFecha(today());
      setCat(categorias[0] || 'Otros');
      setError('');
    } catch (e) {
      setError(e.message);
      savingRef.current = false;
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setError('');
    onClose();
  }

  return (
    <Modal open={open} title="Nuevo gasto" onClose={saving ? () => {} : handleClose}>
      {open && (
        <>
          <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label htmlFor="fg-desc">Descripción</label>
              <input
                id="fg-desc"
                type="text"
                placeholder="Ej: Nafta, mercadería..."
                value={desc}
                onChange={e => setDesc(e.target.value)}
                autoCorrect="off"
                autoFocus
                disabled={saving}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="fg-monto">Monto ($)</label>
                <input
                  id="fg-monto"
                  type="number"
                  placeholder="0"
                  min="0"
                  value={monto}
                  onChange={e => setMonto(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="form-group">
                <label htmlFor="fg-fecha">Fecha</label>
                <input
                  id="fg-fecha"
                  type="date"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="fg-cat">Categoría</label>
              <select id="fg-cat" value={cat} onChange={e => setCat(e.target.value)} disabled={saving}>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {error && <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>{error}</p>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)', paddingTop: 0 }}>
            <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button className="btn btn-secondary btn-full" onClick={handleClose} disabled={saving}>Cancelar</button>
          </div>
        </>
      )}
    </Modal>
  );
}
