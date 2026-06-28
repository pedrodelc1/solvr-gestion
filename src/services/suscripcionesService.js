import { supabase } from '../lib/supabase.js';
import { friendlyError } from '../lib/db.js';

// ── Usuario normal ────────────────────────────────────────

export async function getSuscripcion() {
  const { data, error } = await supabase.rpc('mi_negocio_id');
  if (error || !data) return null;
  const { data: sus } = await supabase
    .from('suscripciones')
    .select('*')
    .eq('negocio_id', data)
    .maybeSingle();
  return sus;
}

export async function renovarSuscripcion(suscripcionId) {
  const { error } = await supabase.rpc('admin_renovar_suscripcion', { p_id: suscripcionId });
  if (error) throw friendlyError(error);
  return getSuscripciones();
}

// ── Superadmin ────────────────────────────────────────────

export async function esSuperadmin() {
  const { data, error } = await supabase.rpc('es_superadmin');
  if (error) return false;
  return data === true;
}

export async function getSuscripciones() {
  const { data, error } = await supabase.rpc('admin_suscripciones');
  if (error) return [];
  return data || [];
}

export async function getAdminWhitelist() {
  const { data, error } = await supabase.rpc('admin_whitelist');
  if (error) return [];
  return data || [];
}

export async function updateSuscripcion(id, changes) {
  const { error } = await supabase.rpc('admin_update_suscripcion', {
    p_id: id,
    p_estado: changes.estado,
  });
  if (error) throw friendlyError(error);
  return getSuscripciones();
}

export async function getAdminPlanes() {
  const { data, error } = await supabase.rpc('admin_planes');
  if (error) return [];
  return data || [];
}

export async function adminSetPlan(suscripcionId, planId) {
  const { error } = await supabase.rpc('admin_set_plan', {
    p_suscripcion_id: suscripcionId,
    p_plan_id: planId || null,
  });
  if (error) throw friendlyError(error);
  return getSuscripciones();
}

export async function adminGrantOwner(email) {
  const clean = String(email || '').toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error('Ingresá un email válido');
  const { data, error } = await supabase.rpc('admin_grant_owner', { p_email: clean });
  if (error) throw friendlyError(error);
  return data || [];
}

export async function adminRevokeAccess(email) {
  const clean = String(email || '').toLowerCase().trim();
  const { data, error } = await supabase.rpc('admin_revoke_access', { p_email: clean });
  if (error) throw friendlyError(error);
  return data || [];
}
