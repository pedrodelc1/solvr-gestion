import { useState, useRef, useEffect } from 'react';
import { Modal } from '../shared/Modal.jsx';
import { saveProductosBulk } from '../../lib/db.js';
import { formatCurrency } from '../../lib/utils.js';

export function ImportarProductosModal({ open, productos, onClose, onImportada, toast }) {
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef(null);
  const importingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setImporting(false);
      importingRef.current = false;
    }
  }, [open]);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') parseCsv(file);
    else if (ext === 'xlsx' || ext === 'xls') parseExcel(file);
    else toast('Formato no soportado. Usá CSV o Excel.', 'error');
  }

  function parseCsv(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      const rows = text.trim().split('\n').map(r => r.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
      processRows(rows);
    };
    reader.readAsText(file);
  }

  async function parseExcel(file) {
    const { read, utils } = await import('xlsx');
    const data = await file.arrayBuffer();
    const workbook = read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = utils.sheet_to_array_of_arrays(sheet);
    processRows(rows);
  }

  function parseNum(val) {
    return parseFloat(String(val || '').replace(/[^0-9.-]/g, '')) || 0;
  }

  function processRows(rows) {
    if (rows.length < 2) { toast('El archivo está vacío o no tiene datos.', 'error'); return; }

    const header = rows[0].map(h => String(h).toLowerCase().trim());
    const nombreIdx      = header.findIndex(h => h.includes('nombre') || h === 'producto');
    const marcaIdx       = header.findIndex(h => h.includes('marca'));
    const precioIdx      = header.findIndex(h => (h.includes('precio') && !h.includes('mayor') && !h.includes('costo')) || h === 'precio');
    const mayorIdx       = header.findIndex(h => h.includes('mayor'));
    const costoIdx       = header.findIndex(h => h.includes('costo'));
    const stockIdx       = header.findIndex(h => h.includes('stock') && !h.includes('min'));
    const stockMinIdx    = header.findIndex(h => h.includes('stock') && h.includes('min'));

    if (nombreIdx === -1) { toast('Falta columna "nombre" o "producto".', 'error'); return; }
    if (precioIdx === -1) { toast('Falta columna "precio".', 'error'); return; }

    const nombresExistentes = new Set(productos.map(p => p.nombre.toLowerCase().trim()));

    const parsed = rows.slice(1).map(row => {
      const nombre = String(row[nombreIdx] || '').trim();
      if (!nombre) return null;
      return {
        nombre,
        marca:           marcaIdx !== -1    ? String(row[marcaIdx] || '').trim() || null : null,
        precio:          parseNum(row[precioIdx]),
        precio_mayorista: mayorIdx !== -1   ? parseNum(row[mayorIdx])  : 0,
        costo:           costoIdx !== -1    ? parseNum(row[costoIdx])  : 0,
        stock:           stockIdx !== -1    ? parseInt(row[stockIdx])  || 0 : 0,
        stock_minimo:    stockMinIdx !== -1 ? parseInt(row[stockMinIdx]) || 5 : 5,
        duplicado: nombresExistentes.has(nombre.toLowerCase()),
      };
    }).filter(Boolean);

    setPreview(parsed);
  }

  async function handleImportar() {
    if (!preview || importingRef.current) return;
    importingRef.current = true;
    setImporting(true);
    const nuevos = preview.filter(r => !r.duplicado && r.precio > 0);
    let importados = 0;
    try {
      importados = await saveProductosBulk(nuevos);
    } catch (_) {}
    const ignorados = preview.length - nuevos.length;
    toast(`${importados} productos importados${ignorados > 0 ? `, ${ignorados} ignorados` : ''}`);
    onImportada?.();
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
    importingRef.current = false;
    setImporting(false);
    onClose();
  }

  function handleClose() {
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
    importingRef.current = false;
    onClose();
  }

  const duplicados = preview?.filter(r => r.duplicado).length ?? 0;
  const sinPrecio  = preview?.filter(r => !r.duplicado && r.precio <= 0).length ?? 0;
  const nuevos     = preview ? preview.length - duplicados - sinPrecio : 0;

  return (
    <Modal open={open} title="Importar productos" onClose={importing ? () => {} : handleClose}>
      {open && (
        <>
          <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {!preview ? (
              <>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-2)', lineHeight: 1.6 }}>
                  Subí un archivo CSV o Excel. Columnas reconocidas:
                </p>
                <div style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontSize: 'var(--text-xs)', fontFamily: 'monospace', color: 'var(--ink-2)', lineHeight: 2 }}>
                  <span style={{ color: 'var(--lime)', fontWeight: 700 }}>nombre</span>
                  {' · '}
                  <span style={{ color: 'var(--lime)', fontWeight: 700 }}>precio</span>
                  {' · '}
                  <span style={{ color: 'var(--ink-3)' }}>marca · costo · precio_mayorista · stock · stock_min</span>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFile}
                  style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)' }}
                />
              </>
            ) : (
              <>
                <div style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontSize: 'var(--text-sm)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--success)', fontWeight: 700 }}>{nuevos} a importar</span>
                  {duplicados > 0 && <span style={{ color: 'var(--ink-3)' }}>{duplicados} duplicados (se ignoran)</span>}
                  {sinPrecio > 0  && <span style={{ color: 'var(--danger)' }}>{sinPrecio} sin precio (se ignoran)</span>}
                </div>
                <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {preview.map((r, i) => {
                    const ignorado = r.duplicado || r.precio <= 0;
                    return (
                      <div
                        key={i}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                          padding: 'var(--space-2) var(--space-3)',
                          background: ignorado ? 'var(--bg-3)' : 'var(--bg-2)',
                          borderRadius: 'var(--radius-sm)',
                          opacity: ignorado ? 0.45 : 1,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.nombre}
                            {r.marca && <span style={{ color: 'var(--ink-3)', fontWeight: 400, marginLeft: 6 }}>{r.marca}</span>}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', display: 'flex', gap: 8, marginTop: 2 }}>
                            {r.precio > 0 && <span style={{ color: 'var(--ink-2)' }}>{formatCurrency(r.precio)}</span>}
                            {r.costo > 0  && <span>Costo: {formatCurrency(r.costo)}</span>}
                            {r.stock > 0  && <span>Stock: {r.stock}</span>}
                          </div>
                        </div>
                        {r.duplicado   && <span style={{ fontSize: 11, color: 'var(--ink-3)', flexShrink: 0 }}>duplicado</span>}
                        {!r.duplicado && r.precio <= 0 && <span style={{ fontSize: 11, color: 'var(--danger)', flexShrink: 0 }}>sin precio</span>}
                      </div>
                    );
                  })}
                </div>
                <button
                  style={{ alignSelf: 'flex-start', fontSize: 'var(--text-sm)', background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', padding: 0 }}
                  onClick={() => { setPreview(null); if (inputRef.current) inputRef.current.value = ''; }}
                >
                  ← Cambiar archivo
                </button>
              </>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)', paddingTop: 0 }}>
            {preview && (
              <button className="btn btn-primary btn-full" onClick={handleImportar} disabled={importing || nuevos === 0}>
                {importing ? 'Importando...' : `Importar ${nuevos} productos`}
              </button>
            )}
            <button className="btn btn-secondary btn-full" onClick={handleClose} disabled={importing}>Cancelar</button>
          </div>
        </>
      )}
    </Modal>
  );
}
