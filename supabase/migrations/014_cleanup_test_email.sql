-- Limpieza de datos de prueba: elimina el email de prueba que se creó al
-- verificar admin_grant_owner durante el desarrollo de la feature.
begin;
delete from allowed_emails where lower(email) = 'nuevo-dueno-test@example.com';
commit;
