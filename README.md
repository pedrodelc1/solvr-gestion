# Solvr Gestión

SaaS de gestión de pedidos, clientes y gastos para negocios.

## Instalación en 5 pasos

1. **Clonar / descargar** este directorio y entrar a él:
   ```bash
   cd solvr-gestion
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Crear proyecto en Supabase**:
   - Ir a [supabase.com](https://supabase.com) y crear un nuevo proyecto
   - En el SQL Editor, pegar y ejecutar el contenido de `supabase_schema.sql`
   - En Authentication > Email Templates, habilitar Magic Link

4. **Configurar variables de entorno**:
   ```bash
   cp .env.example .env
   ```
   Editar `.env` con los valores del proyecto Supabase:
   - `VITE_SUPABASE_URL`: Settings > API > Project URL
   - `VITE_SUPABASE_ANON_KEY`: Settings > API > anon public key

5. **Correr en desarrollo**:
   ```bash
   npm run dev
   ```
   Abrir [http://localhost:5173](http://localhost:5173)

## Build para producción

```bash
npm run build
npm run preview
```
