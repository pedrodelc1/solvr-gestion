import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase.js';
import { formatCurrency, formatDate, saldoCliente, inRange } from '../../lib/utils.js';
import {
  getAllowedEmails, addAllowedEmail, removeAllowedEmail, updateMemberRol,
  getAlertasConfig, saveAlertasConfig,
  getSuscripciones, updateSuscripcion,
} from '../../lib/db.js';

const ROLES = [
  { id: 'admin',        label: 'Admin',        desc: 'Acceso completo al sistema',             color: '#ccff00', bg: 'rgba(204,255,0,0.1)' },
  { id: 'vendedor',     label: 'Vendedor',      desc: 'Gestiona pedidos y clientes',            color: '#ccff00', bg: 'rgba(204,255,0,0.1)' },
  { id: 'visualizador', label: 'Solo lectura',  desc: 'Puede ver todo pero no modificar nada', color: '#ccff00', bg: 'rgba(204,255,0,0.1)' },
];

function RolBadge({ rol }) {
  const r = ROLES.find(x => x.id === rol);
  if (!r) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999, background: r.bg, border: `1px solid ${r.color}44`, color: r.color, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
      {r.label}
    </span>
  );
}

export function PerfilPanel({ session, isOwner, userRole, clientes, pedidos, gastos, suscripcion, negocioConfig, onNegocioSave, toast, theme, onThemeChange }) {
  const email = session?.user?.email || null;
  const inicial = email ? email[0].toUpperCase() : '?';

  const totalClientes = clientes.length;
  const pendientes = pedidos.filter(p => !p.cobrado && p.tipo !== 'presupuesto').length;
  const totalDeuda = clientes.reduce((s, c) => s + Math.max(0, saldoCliente(c, pedidos)), 0);
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);

  const [negocioNombre, setNegocioNombre] = useState('');
  const [moneda, setMoneda] = useState('$');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [negocioEmail, setNegocioEmail] = useState('');
  const [cuit, setCuit] = useState('');
  const [notaPdf, setNotaPdf] = useState('');
  const [numInicial, setNumInicial] = useState(1);
  const [metodosPago, setMetodosPago] = useState('');
  const [savingNegocio, setSavingNegocio] = useState(false);

  useEffect(() => {
    setNegocioNombre(negocioConfig?.nombre || '');
    setMoneda(negocioConfig?.moneda || '$');
    setTelefono(negocioConfig?.telefono || '');
    setDireccion(negocioConfig?.direccion || '');
    setNegocioEmail(negocioConfig?.email || '');
    setCuit(negocioConfig?.cuit || '');
    setNotaPdf(negocioConfig?.nota_pdf || '');
    setNumInicial(negocioConfig?.num_inicial || 1);
    setMetodosPago(negocioConfig?.metodos_pago || 'Efectivo, Transferencia, Tarjeta');
  }, [negocioConfig]);

  async function handleSaveConfig() {
    if (!negocioNombre.trim()) return;
    setSavingNegocio(true);
    try {
      const isMonedaChanged = moneda !== negocioConfig?.moneda;
      await onNegocioSave({
        ...negocioConfig,
        nombre: negocioNombre.trim(),
        moneda: moneda,
        telefono: telefono.trim(),
        direccion: direccion.trim(),
        email: negocioEmail.trim(),
        cuit: cuit.trim(),
        nota_pdf: notaPdf.trim(),
        num_inicial: parseInt(numInicial) || 1,
        metodos_pago: metodosPago.trim(),
      });
      toast('Configuración guardada');
      if (isMonedaChanged) {
        setTimeout(() => window.location.reload(), 300);
      }
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSavingNegocio(false);
    }
  }

  const [allowedEmails, setAllowedEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [newRol, setNewRol] = useState('vendedor');
  const [adding, setAdding] = useState(false);
  const [editingRolId, setEditingRolId] = useState(null);

  // Alertas config
  const [diasAlerta, setDiasAlerta] = useState(7);
  const [savingAlerta, setSavingAlerta] = useState(false);

  // Panel admin suscripciones
  const [suscripciones, setSuscripciones] = useState([]);
  const [loadingSus, setLoadingSus] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  useEffect(() => {
    getAllowedEmails().then(setAllowedEmails);
    getAlertasConfig().then(cfg => setDiasAlerta(cfg.dias_sin_cobro));
  }, []);

  useEffect(() => {
    if (isOwner && showAdminPanel) {
      setLoadingSus(true);
      getSuscripciones().then(data => {
        setSuscripciones(data);
        setLoadingSus(false);
      });
    }
  }, [isOwner, showAdminPanel]);

  async function handleAdd() {
    if (!newEmail.trim()) return;
    setAdding(true);
    try {
      const arr = await addAllowedEmail(newEmail.trim(), newRol);
      setAllowedEmails(arr);
      setNewEmail('');
      toast('Miembro agregado al equipo');
    } catch (e) {
      toast(e.message.includes('unique') ? 'Ese email ya está en el equipo' : e.message, 'error');
    } finally {
      setAdding(false);
    }
  }

  async function handleChangeRol(id, rol) {
    try {
      const arr = await updateMemberRol(id, rol);
      setAllowedEmails(arr);
      setEditingRolId(null);
      toast('Rol actualizado');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function handleRemove(id) {
    try {
      const arr = await removeAllowedEmail(id);
      setAllowedEmails(arr);
      toast('Email eliminado');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function handleSaveAlerta() {
    setSavingAlerta(true);
    try {
      await saveAlertasConfig(diasAlerta);
      toast('Configuración guardada');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSavingAlerta(false);
    }
  }

  async function handleUpdateSuscripcion(id, estado) {
    try {
      const arr = await updateSuscripcion(id, { estado });
      setSuscripciones(arr);
      toast(`Suscripción ${estado}`);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    toast('Sesión cerrada');
    setTimeout(() => window.location.reload(), 500);
  }

  // Info del trial / suscripción actual
  const diasRestantes = suscripcion ? Math.round((new Date(suscripcion.fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
      <div className="page-header">
        <h1>Perfil</h1>
      </div>

      {/* Avatar + info */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--space-8) var(--space-4) var(--space-6)', gap: 'var(--space-3)' }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, #ccff00, #88dd00)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, fontWeight: 800, color: '#080808',
            boxShadow: '0 0 24px #ccff0044',
          }}
        >
          {inicial}
        </motion.div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>{email}</div>
          <div style={{ marginTop: 6 }}>
            {isOwner
              ? <span style={{ fontSize: 'var(--text-xs)', color: '#ccff00', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dueño</span>
              : <RolBadge rol={userRole} />
            }
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 'var(--text-sm)', color: '#ccff00' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ccff00', display: 'inline-block', boxShadow: '0 0 6px #ccff00' }} />
            Conectado
          </div>
        </div>
      </div>

      {/* Suscripción trial banner */}
      {suscripcion && diasRestantes !== null && diasRestantes <= 10 && diasRestantes >= 0 && (
        <div style={{ margin: '0 var(--space-4) var(--space-4)', background: 'var(--tarjeta-bg)', border: '1px solid var(--tarjeta)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--tarjeta)' }}>
          {diasRestantes === 0
            ? 'Tu prueba gratuita vence hoy.'
            : `Tu prueba gratuita vence en ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}.`
          }
        </div>
      )}



      {/* Tu acceso — solo para vendedor/visualizador */}
      {!isOwner && userRole !== 'admin' && (() => {
        const ownerEntry = allowedEmails.find(e => e.is_owner);
        const ownerEmail = ownerEntry?.email || null;
        const negocioNombreDisplay = negocioConfig?.nombre || null;
        return (
          <div style={{ padding: '0 var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div className="section-label">Tu acceso</div>
            <div className="card" style={{ gap: 'var(--space-3)' }}>
              {/* Contexto de la cuenta */}
              {(negocioNombreDisplay || ownerEmail) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--border)' }}>
                  {negocioNombreDisplay && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', fontWeight: 500 }}>EMPRESA</span>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: '#ccff00' }}>{negocioNombreDisplay}</span>
                    </div>
                  )}
                  {ownerEmail && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', fontWeight: 500 }}>TITULAR</span>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-2)' }}>{ownerEmail}</span>
                    </div>
                  )}
                </div>
              )}
              {userRole === 'vendedor' ? (
                <ul style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', paddingLeft: 'var(--space-4)', margin: 0 }}>
                  <li>✓ Crear y editar clientes y pedidos</li>
                  <li>✓ Registrar cobros y pagos parciales</li>
                  <li>✓ Ver catálogo y estadísticas</li>
                  <li style={{ color: 'var(--ink-3)' }}>✗ Gastos, Caja, configuración del negocio</li>
                  <li style={{ color: 'var(--ink-3)' }}>✗ Eliminar registros</li>
                </ul>
              ) : (
                <ul style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', paddingLeft: 'var(--space-4)', margin: 0 }}>
                  <li>✓ Ver clientes, pedidos, catálogo y estadísticas</li>
                  <li>✓ Ver cuenta corriente y descargarla</li>
                  <li style={{ color: 'var(--ink-3)' }}>✗ Crear, editar o eliminar cualquier registro</li>
                  <li style={{ color: 'var(--ink-3)' }}>✗ Registrar cobros ni enviar mensajes</li>
                </ul>
              )}
            </div>
          </div>
        );
      })()}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', padding: '0 var(--space-4) var(--space-4)' }}>
        {[
          { label: 'Clientes', value: totalClientes },
          { label: 'Pedidos pendientes', value: pendientes },
          { label: 'Saldo por cobrar', value: formatCurrency(totalDeuda), accent: totalDeuda > 0 },
          { label: 'Total gastos', value: formatCurrency(totalGastos) },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            className="card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, type: 'spring', stiffness: 300, damping: 24 }}
            style={{ gap: 'var(--space-1)' }}
          >
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', fontWeight: 500 }}>{item.label}</div>
            <div style={{
              fontSize: typeof item.value === 'string' && item.value.length > 12
                ? '14px'
                : typeof item.value === 'string' && item.value.length > 9
                  ? '17px'
                  : 'var(--text-xl)',
              fontWeight: 800,
              color: item.accent ? 'var(--danger)' : 'var(--ink)',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              width: '100%'
            }}>
              {item.value}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Configuración del Sistema — solo owner/admin */}
      {(isOwner || userRole === 'admin') && (
        <div style={{ padding: '0 var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div className="section-label">Configuración del Sistema</div>
          <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            
            {/* Nombre del negocio */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Nombre del negocio</label>
              <input
                type="text"
                placeholder="Ej: Ferrari Repuestos"
                value={negocioNombre}
                onChange={e => setNegocioNombre(e.target.value)}
                style={{ minHeight: 40, fontSize: 'var(--text-sm)' }}
                autoComplete="off"
                autoCorrect="off"
              />
            </div>

            {/* Datos de contacto para PDFs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>CUIT / Tax ID</label>
                <input
                  type="text"
                  placeholder="Ej: 30-12345678-9"
                  value={cuit}
                  onChange={e => setCuit(e.target.value)}
                  style={{ minHeight: 40, fontSize: 'var(--text-sm)' }}
                  autoComplete="off"
                  autoCorrect="off"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Teléfono</label>
                <input
                  type="text"
                  placeholder="Ej: +54 9 11 1234 5678"
                  value={telefono}
                  onChange={e => setTelefono(e.target.value)}
                  style={{ minHeight: 40, fontSize: 'var(--text-sm)' }}
                  autoComplete="off"
                  autoCorrect="off"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', gridColumn: 'span 2' }}>
                <label style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Dirección</label>
                <input
                  type="text"
                  placeholder="Ej: Av. Siempreviva 742"
                  value={direccion}
                  onChange={e => setDireccion(e.target.value)}
                  style={{ minHeight: 40, fontSize: 'var(--text-sm)' }}
                  autoComplete="off"
                  autoCorrect="off"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', gridColumn: 'span 2' }}>
                <label style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Email del negocio</label>
                <input
                  type="email"
                  placeholder="Ej: contacto@minegocio.com"
                  value={negocioEmail}
                  onChange={e => setNegocioEmail(e.target.value)}
                  style={{ minHeight: 40, fontSize: 'var(--text-sm)' }}
                  autoComplete="off"
                  autoCorrect="off"
                />
              </div>
            </div>

            {/* Configuración de Documentos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <label style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Símbolo de Moneda</label>
                  <select
                    value={moneda}
                    onChange={e => setMoneda(e.target.value)}
                    style={{ 
                      minHeight: 40, 
                      fontSize: 'var(--text-sm)',
                      background: 'var(--bg-3)',
                      color: 'var(--ink)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0 var(--space-2)'
                    }}
                  >
                    <option value="$">$ (Pesos)</option>
                    <option value="U$D">USD (U$D)</option>
                    <option value="€">€ (Euros)</option>
                    <option value="Gs">Gs (Guaraníes)</option>
                    <option value="R$">R$ (Reales)</option>
                    <option value="UF">UF (Unidades de Fomento)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <label style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Nº Inicial de Pedido</label>
                  <input
                    type="number"
                    min="1"
                    value={numInicial}
                    onChange={e => setNumInicial(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ minHeight: 40, fontSize: 'var(--text-sm)', textAlign: 'center' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Métodos de Pago Aceptados</label>
                <input
                  type="text"
                  placeholder="Ej: Efectivo, Transferencia, Tarjeta"
                  value={metodosPago}
                  onChange={e => setMetodosPago(e.target.value)}
                  style={{ minHeight: 40, fontSize: 'var(--text-sm)' }}
                  autoComplete="off"
                  autoCorrect="off"
                />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>Separados por comas. Define las opciones disponibles para nuevos cobros.</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Términos / Notas al pie (PDF)</label>
                <textarea
                  placeholder="Ej: Validez del presupuesto: 15 días. Cuentas para transferencia: ..."
                  value={notaPdf}
                  onChange={e => setNotaPdf(e.target.value)}
                  style={{ minHeight: 60, fontSize: 'var(--text-sm)', padding: 'var(--space-2)', background: 'var(--bg-2)', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                  autoComplete="off"
                  autoCorrect="off"
                />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>Se imprime al final de los presupuestos y remitos generados.</span>
              </div>
            </div>

            {/* Botón Guardar Configuración del Negocio */}
            <div style={{ display: 'flex', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' }}>
              <button 
                className="btn btn-primary btn-full" 
                onClick={handleSaveConfig} 
                disabled={savingNegocio || !negocioNombre.trim()} 
                style={{ minHeight: 44, fontSize: 'var(--text-sm)' }}
              >
                {savingNegocio ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </div>

            {/* Alertas de cobro */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' }}>
              <label style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Alertas de cobro</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={diasAlerta}
                  onChange={e => setDiasAlerta(parseInt(e.target.value) || 7)}
                  style={{ width: 80, minHeight: 40, textAlign: 'center', fontSize: 'var(--text-base)' }}
                />
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-2)' }}>días sin cobrar</span>
                <button
                  className="btn btn-secondary"
                  style={{ minHeight: 40, padding: '0 var(--space-4)', fontSize: 'var(--text-sm)', marginLeft: 'auto' }}
                  onClick={handleSaveAlerta}
                  disabled={savingAlerta}
                >
                  {savingAlerta ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>Alerta en la lista de clientes si tienen saldos sin cobrar por más de este tiempo.</span>
            </div>

          </div>
        </div>
      )}

      {/* Equipo — solo owner o admin */}
      {(isOwner || userRole === 'admin') && (
        <div style={{ padding: '0 var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div className="section-label">Equipo</div>
          <div className="card" style={{ gap: 'var(--space-4)' }}>

            {/* Invitar nuevo miembro */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Invitar miembro</div>
              <input
                type="email"
                placeholder="email@empresa.com"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                style={{ minHeight: 40, fontSize: 'var(--text-sm)' }}
              />
              {/* Role picker */}
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {ROLES.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setNewRol(r.id)}
                    style={{
                      flex: 1, minWidth: 90, minHeight: 52, padding: '6px 10px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${newRol === r.id ? r.color : 'var(--border)'}`,
                      background: newRol === r.id ? r.bg : 'var(--bg-3)',
                      color: newRol === r.id ? r.color : 'var(--ink-3)',
                      cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2,
                      transition: 'all 140ms',
                    }}
                  >
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700 }}>{r.label}</span>
                    <span style={{ fontSize: 10, opacity: 0.7, lineHeight: 1.3 }}>{r.desc}</span>
                  </button>
                ))}
              </div>
              <button
                className="btn btn-primary btn-full"
                style={{ minHeight: 40, fontSize: 'var(--text-sm)' }}
                onClick={handleAdd}
                disabled={adding || !newEmail.trim()}
              >
                {adding ? 'Agregando...' : '+ Agregar al equipo'}
              </button>
            </div>

            {/* Lista de miembros */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-3)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Miembros actuales
              </div>
              {allowedEmails.length === 0 ? (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>Sin miembros en el equipo.</p>
              ) : (
                allowedEmails.map(m => (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-3)', background: 'var(--bg-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                        {m.email[0].toUpperCase()}
                      </div>
                      <span style={{ fontSize: 'var(--text-sm)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>
                        {m.email}
                      </span>
                      {m.is_owner
                        ? <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(204,255,0,0.1)', border: '1px solid rgba(204,255,0,0.4)', color: '#ccff00', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>Dueño</span>
                        : <RolBadge rol={m.rol || 'vendedor'} />
                      }
                    </div>

                    {/* Cambiar rol inline — solo si no es owner */}
                    {!m.is_owner && isOwner && (
                      editingRolId === m.id ? (
                        <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                          {ROLES.map(r => (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => handleChangeRol(m.id, r.id)}
                              style={{
                                padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                border: `1px solid ${(m.rol || 'vendedor') === r.id ? r.color : 'var(--border)'}`,
                                background: (m.rol || 'vendedor') === r.id ? r.bg : 'none',
                                color: (m.rol || 'vendedor') === r.id ? r.color : 'var(--ink-3)',
                                transition: 'all 120ms',
                              }}
                            >
                              {r.label}
                            </button>
                          ))}
                          <button onClick={() => setEditingRolId(null)} style={{ padding: '4px 8px', borderRadius: 999, fontSize: 11, background: 'none', border: '1px solid var(--border)', color: 'var(--ink-3)', cursor: 'pointer' }}>✕</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                          <button
                            onClick={() => setEditingRolId(m.id)}
                            style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                          >
                            Cambiar rol
                          </button>
                          <span style={{ color: 'var(--ink-3)', fontSize: 'var(--text-xs)' }}>·</span>
                          <button
                            onClick={() => handleRemove(m.id)}
                            style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            Quitar acceso
                          </button>
                        </div>
                      )
                    )}
                  </div>
                ))
              )}
            </div>

          </div>
        </div>
      )}

      {/* Panel admin suscripciones — solo owner */}
      {isOwner && (
        <div style={{ padding: '0 var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div className="section-label">
            <button
              onClick={() => setShowAdminPanel(v => !v)}
              style={{ background: 'none', border: 'none', color: 'var(--ink-3)', font: 'inherit', cursor: 'pointer', padding: 0, fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}
            >
              Suscripciones {showAdminPanel ? '▲' : '▼'}
            </button>
          </div>
          {showAdminPanel && (
            <div className="card" style={{ gap: 'var(--space-3)' }}>
              {loadingSus ? (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>Cargando...</p>
              ) : suscripciones.length === 0 ? (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>Sin suscripciones activas.</p>
              ) : (() => {
                const PRECIO_PLAN = 4990;
                const activas = suscripciones.filter(s => s.estado === 'activa').length;
                const mrr = activas * PRECIO_PLAN;
                return (
                  <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-3)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>MRR</div>
                      <div style={{ fontWeight: 800, fontSize: 'var(--text-lg)', color: '#ccff00' }}>{formatCurrency(mrr)}</div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>Activas</div>
                      <div style={{ fontWeight: 800, fontSize: 'var(--text-lg)' }}>{activas}</div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>Total</div>
                      <div style={{ fontWeight: 800, fontSize: 'var(--text-lg)' }}>{suscripciones.length}</div>
                    </div>
                  </div>
                );
              })()}
              {!loadingSus && suscripciones.length > 0 && (
                suscripciones.map(s => {
                  const esOwn = s.user_email === email;
                  const dias = Math.round((new Date(s.fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {s.user_email || s.user_id.slice(0, 8) + '...'}
                        </span>
                        {esOwn
                          ? <span style={{ fontSize: 'var(--text-xs)', color: '#ccff00', fontWeight: 700 }}>owner</span>
                          : <span className={`badge ${s.estado === 'activa' ? 'badge-ok' : s.estado === 'prueba' ? 'badge-info' : s.estado === 'vencida' ? 'badge-warn' : 'badge-neutral'}`}>{s.estado}</span>
                        }
                      </div>
                      {!esOwn && (
                        <>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>
                            Vence: {formatDate(s.fecha_vencimiento)} · {dias >= 0 ? `${dias} días restantes` : `Vencida hace ${Math.abs(dias)} días`}
                          </div>
                          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            {s.estado !== 'activa' && (
                              <button
                                className="btn btn-secondary"
                                style={{ flex: 1, minHeight: 36, fontSize: 'var(--text-xs)' }}
                                onClick={() => handleUpdateSuscripcion(s.id, 'activa')}
                              >
                                Activar
                              </button>
                            )}
                            {s.estado !== 'bloqueada' && (
                              <button
                                className="btn btn-danger"
                                style={{ flex: 1, minHeight: 36, fontSize: 'var(--text-xs)' }}
                                onClick={() => handleUpdateSuscripcion(s.id, 'bloqueada')}
                              >
                                Bloquear
                              </button>
                            )}
                            {s.estado !== 'vencida' && s.estado !== 'bloqueada' && (
                              <button
                                className="btn btn-secondary"
                                style={{ flex: 1, minHeight: 36, fontSize: 'var(--text-xs)' }}
                                onClick={() => handleUpdateSuscripcion(s.id, 'vencida')}
                              >
                                Vencer
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Tema — accesible para todos */}
      <div style={{ padding: '0 var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <div className="section-label">Preferencias</div>
        <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Tema de la App</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', marginTop: 2 }}>Cambiá entre modo oscuro y claro.</div>
            </div>
            <div style={{ display: 'flex', background: 'var(--bg-3)', padding: 4, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => onThemeChange('dark')}
                style={{
                  background: theme === 'dark' ? 'var(--bg-2)' : 'none',
                  border: 'none',
                  color: theme === 'dark' ? 'var(--ink)' : 'var(--ink-3)',
                  padding: '6px 12px',
                  borderRadius: 'calc(var(--radius-sm) - 2px)',
                  cursor: 'pointer',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  transition: 'all 120ms',
                }}
              >
                Oscuro
              </button>
              <button
                type="button"
                onClick={() => onThemeChange('light')}
                style={{
                  background: theme === 'light' ? 'var(--bg-2)' : 'none',
                  border: 'none',
                  color: theme === 'light' ? 'var(--ink)' : 'var(--ink-3)',
                  padding: '6px 12px',
                  borderRadius: 'calc(var(--radius-sm) - 2px)',
                  cursor: 'pointer',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  transition: 'all 120ms',
                }}
              >
                Claro
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Logout */}
      <div style={{ padding: '0 var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', paddingBottom: 'var(--space-6)' }}>
        <button
          className="btn btn-secondary btn-full"
          style={{ minHeight: 48, color: 'var(--danger)', borderColor: 'var(--danger)' }}
          onClick={handleLogout}
        >
          Cerrar sesión
        </button>
        <div style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>
          Solvnt Gestión · v1.0
        </div>
      </div>
    </div>
  );
}
