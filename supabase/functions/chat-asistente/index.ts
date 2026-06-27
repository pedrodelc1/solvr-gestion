import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SYSTEM_PROMPT = `Sos un asistente interno de gestión para un negocio.
Tenés acceso a los datos reales del negocio: clientes, pedidos, cobros, gastos, productos y devoluciones.
Respondé preguntas de forma clara, directa y en español.
Si no tenés suficiente información para responder, decilo.
Nunca inventes datos. Siempre basate en el contexto provisto.`;

const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const MAX_HISTORIAL = 10;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sseError(status: number, body: unknown) {
  return new Response(
    `event: error\ndata: ${JSON.stringify(body)}\n\n`,
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    },
  );
}

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return "0";
  return Number(n).toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

function buildContexto(d: {
  clientes: any[];
  pedidos: any[];
  cobros: any[];
  gastos: any[];
  productos: any[];
  devoluciones: any[];
  negocio: any | null;
}) {
  const totalCobros = d.cobros.reduce((a, x) => a + Number(x.monto ?? 0), 0);
  const totalGastos = d.gastos.reduce((a, x) => a + Number(x.monto ?? 0), 0);
  const totalPedidos = d.pedidos.reduce((a, x) => a + Number(x.total ?? 0), 0);

  const lineasClientes = d.clientes.slice(0, 50).map((c) =>
    `- #${c.id} | ${c.nombre ?? "(sin nombre)"}${c.telefono ? ` | tel:${c.telefono}` : ""}${c.saldo != null ? ` | saldo:${fmtMoney(c.saldo)}` : ""}`
  );

  const lineasPedidos = d.pedidos.slice(0, 100).map((p) =>
    `- #${p.id} | ${p.fecha ?? p.created_at ?? ""}${p.cliente_id ? ` | cli:${p.cliente_id}` : ""}${p.estado ? ` | estado:${p.estado}` : ""}${p.total != null ? ` | total:${fmtMoney(p.total)}` : ""}`
  );

  const lineasCobros = d.cobros.slice(0, 100).map((c) =>
    `- #${c.id} | ${c.fecha ?? c.created_at ?? ""}${c.cliente_id ? ` | cli:${c.cliente_id}` : ""}${c.medio ? ` | medio:${c.medio}` : ""}${c.monto != null ? ` | monto:${fmtMoney(c.monto)}` : ""}`
  );

  const lineasGastos = d.gastos.slice(0, 100).map((g) =>
    `- #${g.id} | ${g.fecha ?? g.created_at ?? ""}${g.categoria ? ` | cat:${g.categoria}` : ""}${g.descripcion ? ` | desc:${g.descripcion}` : ""}${g.monto != null ? ` | monto:${fmtMoney(g.monto)}` : ""}`
  );

  const lineasProductos = d.productos.slice(0, 100).map((p) =>
    `- #${p.id} | ${p.nombre ?? "(sin nombre)"}${p.precio != null ? ` | precio:${fmtMoney(p.precio)}` : ""}${p.stock != null ? ` | stock:${p.stock}` : ""}${p.categoria ? ` | cat:${p.categoria}` : ""}`
  );

  const lineasDevoluciones = d.devoluciones.slice(0, 50).map((dv) =>
    `- #${dv.id} | ${dv.fecha ?? dv.created_at ?? ""}${dv.cliente_id ? ` | cli:${dv.cliente_id}` : ""}${dv.pedido_id ? ` | ped:${dv.pedido_id}` : ""}${dv.total != null ? ` | total:${fmtMoney(dv.total)}` : ""}`
  );

  const clientesConDeuda = d.clientes.filter((c) => Number(c.saldo ?? 0) > 0);
  const totalDeuda = clientesConDeuda.reduce((a, c) => a + Number(c.saldo ?? 0), 0);

  return `DATOS DEL NEGOCIO (pedidos/cobros/gastos/devoluciones: últimos 90 días)
${d.negocio?.nombre ? `Negocio: ${d.negocio.nombre}` : ""}

RESUMEN
- Clientes: ${d.clientes.length} (mostrando hasta 50)
- Clientes con deuda: ${clientesConDeuda.length} — total adeudado: $${fmtMoney(totalDeuda)}
- Productos: ${d.productos.length} (mostrando hasta 100)
- Pedidos (90d): ${d.pedidos.length} — total $${fmtMoney(totalPedidos)}
- Cobros (90d): ${d.cobros.length} — total $${fmtMoney(totalCobros)}
- Gastos (90d): ${d.gastos.length} — total $${fmtMoney(totalGastos)}
- Devoluciones (90d): ${d.devoluciones.length}
- Neto cobros - gastos (90d): $${fmtMoney(totalCobros - totalGastos)}

CLIENTES
${lineasClientes.join("\n") || "(sin clientes)"}

PRODUCTOS
${lineasProductos.join("\n") || "(sin productos)"}

PEDIDOS (90d)
${lineasPedidos.join("\n") || "(sin pedidos)"}

COBROS (90d)
${lineasCobros.join("\n") || "(sin cobros)"}

GASTOS (90d)
${lineasGastos.join("\n") || "(sin gastos)"}

DEVOLUCIONES (90d)
${lineasDevoluciones.join("\n") || "(sin devoluciones)"}
`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResp({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResp({ error: "No autenticado" }, 401);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return jsonResp({ error: "Supabase env vars faltantes" }, 500);
  if (!ANTHROPIC_API_KEY) return jsonResp({ error: "ANTHROPIC_API_KEY no configurada" }, 500);

  // Cliente con JWT del usuario: solo para auth y claim_team_access
  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !userData?.user) return jsonResp({ error: "No autenticado" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return jsonResp({ error: "Body inválido" }, 400); }

  let mensajes: { role: "user" | "assistant"; content: string }[] = [];
  if (Array.isArray(body?.mensajes)) {
    mensajes = body.mensajes
      .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-MAX_HISTORIAL);
  } else if (typeof body?.pregunta === "string") {
    mensajes = [{ role: "user", content: body.pregunta }];
  }
  if (mensajes.length === 0 || mensajes[mensajes.length - 1].role !== "user") {
    return jsonResp({ error: "Faltan mensajes o último mensaje no es del usuario" }, 400);
  }
  const totalChars = mensajes.reduce((a, m) => a + m.content.length, 0);
  if (totalChars > 20000) return jsonResp({ error: "Conversación demasiado larga" }, 400);

  const { data: negocioId, error: rpcError } = await supabaseUser.rpc("claim_team_access");
  if (rpcError) return jsonResp({ error: "Error obteniendo negocio", detail: rpcError.message }, 500);
  if (!negocioId) return jsonResp({ error: "Sin acceso a ningún negocio" }, 403);

  // Cliente service role: queries de datos sin RLS (negocio_id ya verificado arriba)
  const adminKey = SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY;
  const supabaseAdmin = createClient(SUPABASE_URL, adminKey, {
    auth: { persistSession: false },
  });

  const desde = isoDaysAgo(90);

  const [
    clientesRes, pedidosRes, cobrosRes, gastosRes, productosRes, devolucionesRes, negocioRes,
  ] = await Promise.all([
    supabaseAdmin.from("clientes").select("*").eq("negocio_id", negocioId).order("created_at", { ascending: false }).limit(50),
    supabaseAdmin.from("pedidos").select("*").eq("negocio_id", negocioId).gte("created_at", desde).order("created_at", { ascending: false }),
    supabaseAdmin.from("cobros").select("*").eq("negocio_id", negocioId).gte("created_at", desde).order("created_at", { ascending: false }),
    supabaseAdmin.from("gastos").select("*").eq("negocio_id", negocioId).gte("created_at", desde).order("created_at", { ascending: false }),
    supabaseAdmin.from("productos").select("*").eq("negocio_id", negocioId).order("nombre", { ascending: true }).limit(100),
    supabaseAdmin.from("devoluciones").select("*").eq("negocio_id", negocioId).gte("created_at", desde).order("created_at", { ascending: false }),
    supabaseAdmin.from("negocio_config").select("*").eq("negocio_id", negocioId).maybeSingle(),
  ]);

  const firstError =
    clientesRes.error || pedidosRes.error || cobrosRes.error ||
    gastosRes.error || productosRes.error || devolucionesRes.error;
  if (firstError) return jsonResp({ error: "Error consultando datos", detail: firstError.message }, 500);

  console.log(`[chat-asistente] negocio=${negocioId} clientes=${clientesRes.data?.length ?? 0} pedidos=${pedidosRes.data?.length ?? 0} cobros=${cobrosRes.data?.length ?? 0} gastos=${gastosRes.data?.length ?? 0} productos=${productosRes.data?.length ?? 0}`);

  const contexto = buildContexto({
    clientes: clientesRes.data ?? [],
    pedidos: pedidosRes.data ?? [],
    cobros: cobrosRes.data ?? [],
    gastos: gastosRes.data ?? [],
    productos: productosRes.data ?? [],
    devoluciones: devolucionesRes.data ?? [],
    negocio: negocioRes.data ?? null,
  });

  const mensajesParaClaude = [...mensajes];
  const ultimo = mensajesParaClaude[mensajesParaClaude.length - 1];
  mensajesParaClaude[mensajesParaClaude.length - 1] = {
    role: "user",
    content: `${contexto}\n\nPREGUNTA DEL USUARIO:\n${ultimo.content}`,
  };

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      stream: true,
      messages: mensajesParaClaude,
    }),
  });

  if (!anthropicRes.ok || !anthropicRes.body) {
    const errText = await anthropicRes.text().catch(() => "");
    console.error("Anthropic error", anthropicRes.status, errText);
    return sseError(502, { error: "Error llamando a Claude", status: anthropicRes.status, detail: errText });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const reader = anthropicRes.body!.getReader();
      let buf = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const partes = buf.split("\n\n");
          buf = partes.pop() ?? "";
          for (const parte of partes) {
            const linEvent = parte.split("\n").find((l) => l.startsWith("event:"));
            const linData = parte.split("\n").find((l) => l.startsWith("data:"));
            if (!linEvent || !linData) continue;
            const ev = linEvent.slice(6).trim();
            const data = linData.slice(5).trim();
            if (ev === "content_block_delta") {
              try {
                const parsed = JSON.parse(data);
                const txt = parsed?.delta?.text;
                if (typeof txt === "string" && txt.length > 0) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: txt })}\n\n`));
                }
              } catch { /* ignore */ }
            } else if (ev === "message_stop") {
              controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
            }
          }
        }
      } catch (e) {
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: String(e) })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
});
