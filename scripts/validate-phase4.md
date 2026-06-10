# Validación Fase 4 — Checklist de criterios

Ejecutar manualmente en staging o producción (con datos de prueba).

## Criterios del plan (§7 Fase 4)

### F4-1. `db.js` no tiene `_effectiveUserId` ni `setEffectiveUserId`
```
grep -n "setEffectiveUserId\|_effectiveUserId" src/lib/db.js
# Debe retornar vacío
```

### F4-2. Los INSERTs de tablas de datos no incluyen `user_id: userId` como campo de tenancy
Tablas a verificar: clientes, productos, pedidos, gastos, devoluciones, comunicaciones,
pedidos_recurrentes, proveedores, ordenes_compra, productos_precio_historial.
```
grep -n "user_id: userId" src/lib/db.js
# Solo deben aparecer en: crearSuscripcionTrial, saveCategorias (fallback INSERT), saveAlertasConfig (fallback INSERT), saveNegocioConfig (fallback INSERT)
```

### F4-3. `updatePedido` no tiene `.eq('user_id', userId)`
```
grep -n "user_id.*userId\|userId.*user_id" src/lib/db.js
# No debe aparecer como filtro WHERE en updates
```

### F4-4. `App.jsx` no importa ni llama `setEffectiveUserId`, `isOwnerEmail`, `getUserRole`, `isEmailAllowed`
```
grep -n "setEffectiveUserId\|isOwnerEmail\|getUserRole\|isEmailAllowed" src/App.jsx
# Debe retornar vacío
```

### F4-5. `App.jsx` carga el rol desde `negocio_members`
```
grep -n "negocio_members\|mi_negocio_id\|member.rol" src/App.jsx
# Debe aparecer la consulta a negocio_members y mi_negocio_id()
```

### F4-6. Build limpio sin errores TypeScript/lint
```
npm run build
# ✓ sin errores
```

### F4-7. Smoke test manual CRUD en staging
Para cada tabla: crear, editar y eliminar un registro como owner y verificar que aparece.
Como vendedor: crear y editar OK; eliminar → debe fallar (bloqueado por RLS).
Como visualizador: solo lectura.

### F4-8. Team member ve los datos del owner (no su propia cuenta vacía)
1. Loguear como miembro de negocio (vendedor/admin).
2. Verificar que los clientes, pedidos y productos del owner son visibles.
3. El miembro NO usó "setEffectiveUserId" — el acceso es por RLS (negocio_members).

## Resultados (2026-06-10)

- [x] F4-1: grep retorna vacío ✅
- [x] F4-2: `user_id: userId` solo aparece en fallback INSERT de upserts ✅
- [x] F4-3: ningún `.eq('user_id', userId)` en filtros UPDATE ✅
- [x] F4-4: grep retorna vacío ✅
- [x] F4-5: `negocio_members` y `mi_negocio_id` presentes en App.jsx ✅
- [x] F4-6: `npm run build` ✓ sin errores (2.07s) ✅
- [ ] F4-7: smoke test manual pendiente (requiere entorno staging con datos)
- [ ] F4-8: test de team member pendiente (requiere dos sesiones)
