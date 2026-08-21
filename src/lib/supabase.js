import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const DUMMY_URL = 'https://placeholder.supabase.co';
const DUMMY_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.placeholder';

// Cota máxima para cualquier request a Supabase. Sin esto, si la red se cuelga
// la promesa del fetch nunca resuelve ni rechaza y la función async queda
// colgada para siempre. Con el timeout, el request rechaza limpio y el manejo
// de errores existente (fallback a caché / throw) se encarga.
//
// 8s era demasiado corto: en 4G flaky, una tanda de paginación de pedidos +
// items abortaba y la app caía a la caché (vacía en un dispositivo nuevo), con
// lo que el usuario veía su negocio sin datos. Esto es una red de seguridad
// contra cuelgues, no un presupuesto de latencia — conviene generoso.
const REQUEST_TIMEOUT_MS = 30000;

function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException('Request a Supabase excedió el tiempo límite', 'TimeoutError')),
    REQUEST_TIMEOUT_MS,
  );

  // Respetar una posible señal de cancelación que ya traiga supabase-js
  const external = init.signal;
  if (external) {
    if (external.aborted) controller.abort(external.reason);
    else external.addEventListener('abort', () => controller.abort(external.reason), { once: true });
  }

  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export const supabase = createClient(
  supabaseUrl || DUMMY_URL,
  supabaseAnonKey || DUMMY_KEY,
  { global: { fetch: fetchWithTimeout } },
);
