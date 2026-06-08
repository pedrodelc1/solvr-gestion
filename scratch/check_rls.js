import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read .env manually
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkRLS() {
  // Query RLS policies from postgres system catalogs using rpc or direct sql (since we are using anon key, we might not have direct select on pg_policies unless a function exists, but let's try direct SQL query or just check table access)
  // Wait, let's try to query allowed_emails as an anonymous user (which is what a user is before logging in, or right after logging in)
  const { data: dataAnon, error: errorAnon } = await supabase
    .from('allowed_emails')
    .select('*');
  console.log("Querying allowed_emails as Anonymous/Anon Key:");
  console.log("Data:", dataAnon);
  console.log("Error:", errorAnon);
}

checkRLS();
