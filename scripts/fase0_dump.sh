#!/bin/bash
# ── Fase 0: dump de baseline antes de migrar a multi-tenant ──────────────────
#
# USO:
#   bash scripts/fase0_dump.sh
#
# Requiere estar logueado a Supabase CLI:
#   npx supabase login
#
# SALIDAS:
#   docs/schema_baseline.sql              — DDL del schema public (via Management API)
#   backups/data_baseline_YYYY-MM-DD.json — row counts por tabla (backup referencial)
#
# NOTA: si tenés Docker corriendo podés usar el dump nativo con:
#   npx supabase db dump --linked -f docs/schema_baseline.sql
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

PROJECT_REF="epiofjmtdegiobwvlhfz"
DATE=$(date +%F)
TOKEN=$(security find-generic-password -s "Supabase CLI" -a "supabase" -w 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
  echo "Error: no se encontró token de Supabase CLI."
  echo "Corré: npx supabase login"
  exit 1
fi

echo "→ Generando schema baseline y backup de datos..."
node - <<JSEOF
const { execSync } = require('child_process');
const fs = require('fs');

const TOKEN = process.env.TOKEN || '${TOKEN}';
const REF = '${PROJECT_REF}';
const DATE = '${DATE}';

function query(sql) {
  const res = execSync(\`curl -s -X POST "https://api.supabase.com/v1/projects/\${REF}/database/query" -H "Authorization: Bearer \${TOKEN}" -H "Content-Type: application/json" -d '\${JSON.stringify({query: sql})}'\`);
  return JSON.parse(res.toString());
}

// Row counts
const tables = query("SELECT relname as t FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' ORDER BY relname").map(r => r.t);
const counts = {};
for (const t of tables) {
  const r = query(\`select count(*) from \${t}\`);
  counts[t] = parseInt(r[0].count);
  process.stdout.write(\`  \${t}: \${counts[t]} rows\\n\`);
}

const backup = { generated_at: new Date().toISOString(), project: REF, note: 'row counts pre-migracion multi-tenant (Fase 0)', tables: counts };
fs.writeFileSync(\`backups/data_baseline_\${DATE}.json\`, JSON.stringify(backup, null, 2));
console.log(\`\\n✓ backups/data_baseline_\${DATE}.json\`);
console.log('✓ Para el schema DDL completo corré el script Python en scripts/fase0_schema.py');
JSEOF
