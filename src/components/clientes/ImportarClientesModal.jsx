import { useState, useRef, useEffect } from 'react';
import { Modal } from '../shared/Modal.jsx';
import { saveClientesBulk } from '../../lib/db.js';
import { formatCurrency } from '../../lib/utils.js';

export function ImportarClientesModal({ open, clientes, onClose, onImportada, toast }) {
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
    if (ext === 'csv') {
      parseCsv(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      parseExcel(file);
    } else {
      toast('Formato no soportado. Usá CSV o Excel.', 'error');
    }
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

  function processRows(rows) {
    if (rows.length < 2) { toast('El archivo está vacío o no tiene datos.', 'error'); return; }

    const header = rows[0].map(h => String(h).toLowerCase().trim());
    const nombreIdx = header.findIndex(h => h.includes('nombre'));
    const contactoIdx = header.findIndex(h => h.includes('contacto') || h.includes('telefono') || h.includes('teléfono') || h.includes('tel'));
    const saldoIdx = header.findIndex(h => h.includes('saldo') || h.includes('deuda'));
    const tipoIdx = header.findIndex(h => h.includes('tipo'));

    if (nombreIdx === -1) { toast('Falta columna "nombre" en el archivo.', 'error'); return; }

    const nombresExistentes = new Set(clientes.map(c => c.nombre.toLowerCase().trim()));

    const parsed = rows.slice(1).map(row => {
      const nombre = String(row[nombreIdx] || '').trim();
      if (!nombre) return null;

      let contacto = contactoIdx !== -1 ? String(row[contactoIdx] || '').replace(/\D/g, '') : '';
      if (contacto.startsWith('54')) contacto = contacto.slice(2);
      if (contacto.length === 11 && contacto.startsWith('9')) contacto = contacto.slice(1);

      const saldo_inicial = saldoIdx !== -1
        ? parseFloat(String(row[saldoIdx] || '').replace(/[^0-9.-]/g, '')) || 0
        : 0;

      const tipo = tipoIdx !== -1 ? String(row[tipoIdx] || '').trim().toLowerCase() : 'minorista';
      const tipo_precio = tipo === 'mayorista' ? 'mayorista' : 'minorista';
      const duplicado = nombresExistentes.has(nombre.toLowerCase());

      return { nombre, contacto, saldo_inicial, tipo_precio, duplicado };
    }).filter(Boolean);

    setPreview(parsed);
  }

  async function handleImportar() {
    if (!preview || importingRef.current) return;
    importingRef.current = true;
    setImporting(true);
    const nuevos = preview.filter(r => !r.duplicado);
    let importados = 0;
    try {
      importados = await saveClientesBulk(nuevos.map(r => ({
        nombre: r.nombre,
        contacto: r.contacto,
        tipo_precio: r.tipo_precio,
        saldo_inicial: r.saldo_inicial,
      })));
    } catch (_) {}
    toast(`${importados} clientes importados${preview.length - nuevos.length > 0 ? `, ${preview.length - nuevos.length} duplicados ignorados` : ''}`);
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
  const nuevos = preview ? preview.length - duplicados : 0;

  return (
    <Modal open={open} title="Importar clientes" onClose={importing ? () => {} : handleClose}>
      {open && (
        <>
          <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {!preview ? (
              <>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-2)', lineHeight: 1.6 }}>
                  Subí un archivo CSV o Excel con estas columnas:
                </p>
                <div style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontSize: 'var(--text-xs)', fontFamily: 'monospace', color: 'var(--ink-2)', lineHeight: 1.8 }}>
                  <span style={{ color: 'var(--primary)', fontWeight: 700 }}>nombre</span>
                  {' · '}
                  <span style={{ color: 'var(--ink-3)' }}>telefono (opcional)</span>
                  {' · '}
                  <span style={{ color: 'var(--ink-3)' }}>saldo (opcional)</span>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFile}
                  style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-1)' }}
                />
              </>
            ) : (
              <>
                <div style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontSize: 'var(--text-sm)', display: 'flex', gap: 'var(--space-4)' }}>
                  <span style={{ color: 'var(--success)', fontWeight: 700 }}>{nuevos} a importar</span>
                  {duplicados > 0 && <span style={{ color: 'var(--ink-3)' }}>{duplicados} duplicados (se ignoran)</span>}
                </div>
                <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {preview.map((r, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        padding: 'var(--space-2) var(--space-3)',
                        background: r.duplicado ? 'var(--bg-3)' : 'var(--bg-2)',
                        borderRadius: 'var(--radius-sm)',
                        opacity: r.duplicado ? 0.5 : 1,
                      }}
                    >
                      <div className="cliente-avatar" style={{ width: 28, height: 28, fontSize: 'var(--text-xs)' }}>{r.nombre.charAt(0)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', display: 'flex', gap: 8 }}>
                          {r.contacto && <span>{r.contacto}</span>}
                          {r.saldo_inicial > 0 && <span style={{ color: 'var(--danger)' }}>Saldo: {formatCurrency(r.saldo_inicial)}</span>}
                        </div>
                      </div>
                      {r.tipo_precio === 'mayorista' && (
                        <span className="badge" style={{ fontSize: 'var(--text-xs)', background: 'var(--accent-2)', color: 'var(--accent)' }}>May.</span>
                      )}
                      {r.duplicado && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>duplicado</span>}
                    </div>
                  ))}
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ alignSelf: 'flex-start', fontSize: 'var(--text-sm)', padding: '0' }}
                  onClick={() => { setPreview(null); if (inputRef.current) inputRef.current.value = ''; }}
                >
                  ← Cambiar archivo
                </button>
              </>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)', paddingTop: 0 }}>
            {preview && (
              <button
                className="btn btn-primary btn-full"
                onClick={handleImportar}
                disabled={importing || nuevos === 0}
              >
                {importing ? 'Importando...' : `Importar ${nuevos} clientes`}
              </button>
            )}
            <button className="btn btn-secondary btn-full" onClick={handleClose} disabled={importing}>Cancelar</button>
          </div>
        </>
      )}
    </Modal>
  );
}
