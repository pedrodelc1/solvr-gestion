import { supabase } from '../lib/supabase.js';

async function getAllowedEmails() {
  const { data, error } = await supabase
    .from('allowed_emails')
    .select('id, email, is_owner, rol, trial_activo, owner_user_id, created_at')
    .order('created_at', { ascending: true });
  if (error) return [];
  return data;
}

export async function getMembers() {
  return getAllowedEmails();
}

export async function addMember(email, rol = 'vendedor') {
  const { error } = await supabase.rpc('add_member_email', { p_email: email, p_rol: rol });
  if (error) throw error;
  return getAllowedEmails();
}

export async function updateMemberRol(id, rol) {
  const { error } = await supabase.rpc('update_member_rol', { p_member_id: id, p_nuevo_rol: rol });
  if (error) throw error;
  return getAllowedEmails();
}

export async function removeMember(id) {
  const { error } = await supabase.rpc('remove_member_email', { p_member_id: id });
  if (error) throw error;
  return getAllowedEmails();
}
