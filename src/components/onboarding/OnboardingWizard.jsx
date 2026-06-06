import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { saveNegocioConfig, saveCliente, savePedido } from '../../lib/db.js';
import { today, uid } from '../../lib/utils.js';

const STEPS = ['Negocio', 'Cliente', 'Primera venta', '¡Listo!'];

function Stepper({ current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 'var(--space-6)' }}>
      {STEPS.map((label, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: i <= current ? 'var(--primary)' : 'var(--bg-3)',
            color: i <= current ? '#080808' : 'var(--ink-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'var(--text-xs)', fontWeight: 800,
            transition: 'background 0.3s',
          }}>
            {i < current ? '✓' : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div style={{
              flex: 1, height: 2,
              background: i < current ? 'var(--primary)' : 'var(--bg-3)',
              transition: 'background 0.3s',
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

export function OnboardingWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [negocioNombre, setNegocioNombre] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteContacto, setClienteContacto] = useState('');
  const [clienteCreado, setClienteCreado] = useState(null);

  const [itemNombre, setItemNombre] = useState('');
  const [itemPrecio, setItemPrecio] = useState('');
  const [itemCantidad, setItemCantidad] = useState('1');
  const [medioPago, setMedioPago] = useState('efectivo');

  async function handleSkip() {
    try {
      await saveNegocioConfig({ nombre: negocioNombre || 'Mi Negocio', logo_url: null, onboarding_done: true });
    } catch (_) {}
    onComplete();
  }

  async function handleStep0() {
    if (!negocioNombre.trim()) return;
    setSaving(true);
    await saveNegocioConfig({ nombre: negocioNombre.trim(), logo_url: logoUrl.trim() || null, onboarding_done: false });
    setSaving(false);
    setStep(1);
  }

  async function handleStep1() {
    if (!clienteNombre.trim()) return;
    setSaving(true);
    try {
      const arr = await saveCliente({ nombre: clienteNombre.trim(), contacto: clienteContacto.trim(), tipo_precio: 'minorista' });
      const nuevo = arr.find(c => c.nombre === clienteNombre.trim());
      setClienteCreado(nuevo || null);
    } catch (_) {}
    setSaving(false);
    setStep(2);
  }

  function skipStep1() {
    setStep(2);
  }

  async function handleStep2() {
    if (!itemNombre.trim() || !itemPrecio) return;
    if (!clienteCreado) { setStep(3); return; }
    setSaving(true);
    try {
      const precio = parseFloat(itemPrecio) || 0;
      const cant = parseInt(itemCantidad) || 1;
      await savePedido({
        id: uid(),
        clienteId: clienteCreado.id,
        fecha: today(),
        items: [{ productoId: null, nombre: itemNombre.trim(), cantidad: cant, precioUnitario: precio, costoUnitario: 0 }],
        totalCalculado: precio * cant,
        totalFinal: precio * cant,
        medioPago,
        cuotas: 1,
        cobrado: medioPago === 'efectivo',
        montoAbonado: medioPago === 'efectivo' ? precio * cant : 0,
        nota: null,
        tipo: 'pedido',
      });
    } catch (_) {}
    setSaving(false);
    setStep(3);
  }

  function skipStep2() {
    setStep(3);
  }

  async function handleFinish() {
    await saveNegocioConfig({ nombre: negocioNombre || 'Mi Negocio', logo_url: logoUrl || null, onboarding_done: true });
    onComplete();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'var(--bg)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-6)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        <Stepper current={step} />

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, marginBottom: 'var(--space-2)' }}>Bienvenido a Solvnt</h2>
              <p style={{ color: 'var(--ink-3)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>Empecemos configurando tu negocio.</p>
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label>Nombre del negocio *</label>
                <input type="text" placeholder="Ej: Ferretería López" value={negocioNombre} onChange={e => setNegocioNombre(e.target.value)} autoFocus />
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                <label>Logo (URL, opcional)</label>
                <input type="url" placeholder="https://..." value={logoUrl} onChange={e => setLogoUrl(e.target.value)} />
              </div>
              <button className="btn btn-primary btn-full" onClick={handleStep0} disabled={saving || !negocioNombre.trim()} style={{ minHeight: 48, marginBottom: 'var(--space-3)' }}>
                {saving ? 'Guardando...' : 'Continuar →'}
              </button>
              <button className="btn btn-secondary btn-full" onClick={handleSkip} style={{ minHeight: 44 }}>Saltar configuración</button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, marginBottom: 'var(--space-2)' }}>Agregá tu primer cliente</h2>
              <p style={{ color: 'var(--ink-3)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>Podés agregar más después.</p>
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label>Nombre *</label>
                <input type="text" placeholder="Nombre del cliente" value={clienteNombre} onChange={e => setClienteNombre(e.target.value)} autoFocus />
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                <label>Teléfono (opcional)</label>
                <input type="tel" placeholder="1123456789" value={clienteContacto} onChange={e => setClienteContacto(e.target.value)} />
              </div>
              <button className="btn btn-primary btn-full" onClick={handleStep1} disabled={saving || !clienteNombre.trim()} style={{ minHeight: 48, marginBottom: 'var(--space-3)' }}>
                {saving ? 'Guardando...' : 'Guardar y continuar →'}
              </button>
              <button className="btn btn-secondary btn-full" onClick={skipStep1} style={{ minHeight: 44 }}>Saltar</button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, marginBottom: 'var(--space-2)' }}>Registrá tu primera venta</h2>
              <p style={{ color: 'var(--ink-3)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
                {clienteCreado ? `Cliente: ${clienteCreado.nombre}` : 'Sin cliente seleccionado — podés saltear.'}
              </p>
              <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                <label>Producto / servicio *</label>
                <input type="text" placeholder="Ej: Caja de tornillos" value={itemNombre} onChange={e => setItemNombre(e.target.value)} autoFocus />
              </div>
              <div className="form-row" style={{ marginBottom: 'var(--space-3)' }}>
                <div className="form-group">
                  <label>Precio ($)</label>
                  <input type="number" min="0" step="0.01" placeholder="0" value={itemPrecio} onChange={e => setItemPrecio(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Cantidad</label>
                  <input type="number" min="1" step="1" value={itemCantidad} onChange={e => setItemCantidad(e.target.value)} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                <label>Medio de pago</label>
                <select value={medioPago} onChange={e => setMedioPago(e.target.value)}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>
              <button className="btn btn-primary btn-full" onClick={handleStep2} disabled={saving || !itemNombre.trim() || !itemPrecio} style={{ minHeight: 48, marginBottom: 'var(--space-3)' }}>
                {saving ? 'Guardando...' : 'Guardar y continuar →'}
              </button>
              <button className="btn btn-secondary btn-full" onClick={skipStep2} style={{ minHeight: 44 }}>Saltar</button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 64, marginBottom: 'var(--space-4)' }}>🎉</div>
              <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, marginBottom: 'var(--space-3)' }}>¡Todo listo!</h2>
              <p style={{ color: 'var(--ink-2)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-8)', lineHeight: 1.7 }}>
                Tu negocio está configurado.<br />Podés seguir agregando clientes, productos y pedidos.
              </p>
              <button className="btn btn-primary btn-full" onClick={handleFinish} style={{ minHeight: 52, fontSize: 'var(--text-base)', fontWeight: 700 }}>
                Ir a la app →
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
