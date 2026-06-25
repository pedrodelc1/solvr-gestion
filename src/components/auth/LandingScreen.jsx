/* Hallmark · component: landing · genre: modern-minimal · theme: project-locked
 * states: default · hover · focus · active
 */
import { useState } from 'react';
import { motion } from 'framer-motion';

const planes = [
  {
    codigo: 'basico',
    nombre: 'Básico',
    precio: '—',
    periodo: 'por mes',
    bullet: 'Para empezar a ordenar el negocio.',
    features: [
      'Clientes, pedidos y cobros',
      'Caja del día',
      'Estadísticas básicas',
      'Sin asistente IA',
    ],
    cta: 'Empezar',
    destacado: false,
  },
  {
    codigo: 'pro',
    nombre: 'Pro',
    precio: '—',
    periodo: 'por mes',
    bullet: 'Para negocios que ya cobran y quieren crecer.',
    features: [
      'Todo lo del Básico',
      'Equipo: vendedores y visualizadores',
      'Catálogo de productos + stock',
      'Devoluciones y cuenta corriente',
      'Asistente IA — saldo mensual',
    ],
    cta: 'Empezar prueba',
    destacado: true,
  },
  {
    codigo: 'pro_plus',
    nombre: 'Pro+',
    precio: '—',
    periodo: 'por mes',
    bullet: 'Para escalar sin techo en IA.',
    features: [
      'Todo lo del Pro',
      'Asistente IA con saldo ampliado',
      'Soporte prioritario',
      'Onboarding 1 a 1',
    ],
    cta: 'Hablar con ventas',
    destacado: false,
  },
];

const styles = `
.lg-shell { min-height: 100dvh; background: var(--bg, #0a0a0a); color: var(--ink-1, #f4f4f4); overflow-y: auto; }
.lg-nav { display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; max-width: 1120px; margin: 0 auto; }
.lg-brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 16px; letter-spacing: -0.01em; }
.lg-brand-mark { width: 22px; height: 22px; border-radius: 6px; background: var(--primary); display: inline-flex; align-items: center; justify-content: center; color: #000; font-size: 13px; font-weight: 900; }
.lg-nav-btn { background: transparent; color: var(--ink-1); border: 1px solid var(--border); padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease; font-family: inherit; }
.lg-nav-btn:hover { border-color: var(--primary); background: color-mix(in oklab, var(--primary) 8%, transparent); }

.lg-hero { max-width: 880px; margin: 0 auto; padding: 64px 24px 48px; text-align: center; }
.lg-eyebrow { display: inline-flex; align-items: center; gap: 8px; padding: 5px 12px; border-radius: 999px; font-size: 11.5px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; background: color-mix(in oklab, var(--primary) 10%, transparent); border: 1px solid color-mix(in oklab, var(--primary) 30%, transparent); color: var(--primary); margin-bottom: 22px; }
.lg-h1 { font-size: clamp(36px, 6vw, 64px); font-weight: 800; line-height: 1.02; letter-spacing: -0.035em; margin: 0 0 18px; }
.lg-h1 .accent { color: var(--primary); font-style: italic; font-weight: 700; }
.lg-sub { font-size: clamp(15px, 1.7vw, 18px); color: var(--ink-2); line-height: 1.55; max-width: 640px; margin: 0 auto 30px; }
.lg-cta-row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.lg-cta-primary { background: var(--primary); color: #000; border: none; padding: 12px 22px; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; transition: transform 0.1s ease, background 0.15s ease; font-family: inherit; }
.lg-cta-primary:hover { background: color-mix(in oklab, var(--primary) 88%, white); }
.lg-cta-primary:active { transform: translateY(1px); }
.lg-cta-secondary { background: transparent; color: var(--ink-1); border: 1px solid var(--border); padding: 12px 22px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: border-color 0.15s ease; font-family: inherit; }
.lg-cta-secondary:hover { border-color: var(--ink-2); }

.lg-section { max-width: 1120px; margin: 0 auto; padding: 56px 24px 80px; }
.lg-section-head { text-align: center; margin-bottom: 36px; }
.lg-section-title { font-size: clamp(26px, 3.5vw, 36px); font-weight: 800; letter-spacing: -0.025em; margin: 0 0 10px; }
.lg-section-sub { color: var(--ink-2); font-size: 14.5px; line-height: 1.5; max-width: 520px; margin: 0 auto; }

.lg-plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr)); gap: 14px; }
.lg-plan { background: var(--bg-2, #141414); border: 1px solid var(--border); border-radius: 16px; padding: 24px 22px; display: flex; flex-direction: column; gap: 18px; position: relative; transition: border-color 0.2s ease, transform 0.2s ease; }
.lg-plan:hover { transform: translateY(-2px); }
.lg-plan-featured { border-color: color-mix(in oklab, var(--primary) 55%, var(--border)); background: linear-gradient(180deg, color-mix(in oklab, var(--primary) 6%, var(--bg-2)) 0%, var(--bg-2) 60%); }
.lg-plan-badge { position: absolute; top: -10px; right: 18px; background: var(--primary); color: #000; font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 4px 10px; border-radius: 999px; }
.lg-plan-name { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; margin: 0; }
.lg-plan-bullet { font-size: 13px; color: var(--ink-2); line-height: 1.45; margin: 4px 0 0; min-height: 36px; }
.lg-plan-price { display: flex; align-items: baseline; gap: 6px; padding-top: 4px; border-top: 1px dashed var(--border); padding: 14px 0 4px; }
.lg-plan-price-num { font-size: 32px; font-weight: 800; letter-spacing: -0.03em; color: var(--ink-1); line-height: 1; }
.lg-plan-price-per { font-size: 12.5px; color: var(--ink-2); }
.lg-plan-features { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 9px; }
.lg-plan-features li { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: var(--ink-1); line-height: 1.45; }
.lg-plan-features li svg { flex-shrink: 0; margin-top: 2px; color: var(--primary); }
.lg-plan-cta { margin-top: auto; padding: 11px 16px; border-radius: 10px; font-size: 13.5px; font-weight: 700; cursor: pointer; border: none; transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease; font-family: inherit; }
.lg-plan-cta-primary { background: var(--primary); color: #000; }
.lg-plan-cta-primary:hover { background: color-mix(in oklab, var(--primary) 88%, white); }
.lg-plan-cta-secondary { background: transparent; color: var(--ink-1); border: 1px solid var(--border); }
.lg-plan-cta-secondary:hover { border-color: var(--ink-2); }
.lg-plan-cta:active { transform: translateY(1px); }

.lg-foot { border-top: 1px solid var(--border); padding: 20px 24px; text-align: center; font-size: 12px; color: var(--ink-2); }
`;

export function LandingScreen({ onLogin }) {
  const [hoverPlan, setHoverPlan] = useState(null);

  return (
    <div className="lg-shell">
      <style>{styles}</style>

      <nav className="lg-nav">
        <div className="lg-brand">
          <span className="lg-brand-mark">S</span>
          <span>Solvr Gestión</span>
        </div>
        <button className="lg-nav-btn" onClick={onLogin}>
          Iniciar sesión
        </button>
      </nav>

      <header className="lg-hero">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="lg-eyebrow">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6" /></svg>
            Hecho para negocios chicos
          </div>
          <h1 className="lg-h1">
            Tu negocio, <span className="accent">en orden</span><br />de verdad.
          </h1>
          <p className="lg-sub">
            Clientes, pedidos, cobros y stock en un solo lugar.
            Suma un asistente con IA que te responde sobre tus números reales.
          </p>
          <div className="lg-cta-row">
            <button className="lg-cta-primary" onClick={onLogin}>
              Empezar prueba gratis
            </button>
            <a className="lg-cta-secondary" href="#planes" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              Ver planes
            </a>
          </div>
        </motion.div>
      </header>

      <section className="lg-section" id="planes">
        <div className="lg-section-head">
          <h2 className="lg-section-title">Elegí tu plan</h2>
          <p className="lg-section-sub">
            Probá 14 días sin tarjeta. Cambiás o cancelás cuando quieras.
          </p>
        </div>

        <div className="lg-plans">
          {planes.map((p) => (
            <motion.div
              key={p.codigo}
              className={`lg-plan ${p.destacado ? 'lg-plan-featured' : ''}`}
              onMouseEnter={() => setHoverPlan(p.codigo)}
              onMouseLeave={() => setHoverPlan(null)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 * planes.indexOf(p) }}
            >
              {p.destacado && <div className="lg-plan-badge">Más elegido</div>}

              <div>
                <h3 className="lg-plan-name">{p.nombre}</h3>
                <p className="lg-plan-bullet">{p.bullet}</p>
              </div>

              <div className="lg-plan-price">
                <span className="lg-plan-price-num">{p.precio}</span>
                <span className="lg-plan-price-per">{p.periodo}</span>
              </div>

              <ul className="lg-plan-features">
                {p.features.map((f, i) => (
                  <li key={i}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`lg-plan-cta ${p.destacado ? 'lg-plan-cta-primary' : 'lg-plan-cta-secondary'}`}
                onClick={onLogin}
              >
                {p.cta}
              </button>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="lg-foot">
        Solvr Gestión · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
