// Chequeos de rol para la UI — son hints visuales únicamente.
// La autorización real siempre la decide el backend (RLS + RPCs).

export function canManageTeam(role) {
  return role === 'owner' || role === 'admin';
}

export function canEdit(role) {
  return role === 'owner' || role === 'admin' || role === 'vendedor';
}

export function canDelete(role) {
  return role === 'owner' || role === 'admin';
}

export function canViewOnly(role) {
  return role === 'visualizador';
}
