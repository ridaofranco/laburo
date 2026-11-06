import "server-only";

/**
 * MeCubro (seguro de accidentes personales por día). Franco 06/11: la productora
 * asegura a la gente que contrató y le paga DIRECTO a MeCubro con su link de
 * MercadoPago. LABURO no cobra ni toca la plata: solo arma el pedido.
 *
 * API v4.1: https://documenter.getpostman.com/view/19390555/2sB2cPiQca
 * Variables (las carga Franco en Vercel): MECUBRO_API_URL, MECUBRO_EMAIL,
 * MECUBRO_PASSWORD, MECUBRO_APP_ID. Sin ellas, la función queda apagada.
 * Probado contra el sandbox el 06/11 (trabajo/laburo-mecubro/).
 */

const ENTIDAD_FISICA = 1040036465;
const ENTIDAD_JURIDICA = 985070790;
const NO_REPETICION = 1040036465;
// Los ids de tipo de documento son iguales en sandbox y producción (catálogo común).
const DOC_PERSONA: Record<string, number> = { DNI: 1040036465, PASAPORTE: 853191741, OTRO: 769986619 };
const DOC_CUIT_JURIDICA = 482115241;

export function mecubroActivo(): boolean {
  return Boolean(
    process.env.MECUBRO_API_URL && process.env.MECUBRO_EMAIL && process.env.MECUBRO_PASSWORD && process.env.MECUBRO_APP_ID,
  );
}

export function mecubroAmbiente(): "sandbox" | "produccion" {
  return /sandbox/.test(process.env.MECUBRO_API_URL ?? "") ? "sandbox" : "produccion";
}

let token: { valor: string; vence: number } | null = null;

async function api<T = unknown>(method: string, path: string, body?: unknown, reintento = true): Promise<T> {
  if (!token || token.vence < Date.now()) await login();
  const r = await fetch(`${process.env.MECUBRO_API_URL}${path}`, {
    method,
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token!.valor}` },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (r.status === 401 && reintento) {
    token = null;
    return api(method, path, body, false);
  }
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    const det = j?.validations ? JSON.stringify(j.validations) : (j?.message ?? r.statusText);
    throw new Error(`MeCubro ${r.status}: ${det}`);
  }
  return j as T;
}

async function login() {
  const r = await fetch(`${process.env.MECUBRO_API_URL}/auth/login`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.MECUBRO_EMAIL, password: process.env.MECUBRO_PASSWORD }),
    cache: "no-store",
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.data?.access_token) throw new Error(`MeCubro login ${r.status}`);
  // El token dura semanas; se renueva cada 12 h por las dudas.
  token = { valor: j.data.access_token, vence: Date.now() + 12 * 3600_000 };
}

const app = () => process.env.MECUBRO_APP_ID;

/**
 * Rol de LABURO → actividad («subtipo de riesgo») de MeCubro. Reglas simples;
 * lo que no matchea va como «Producción de eventos». Ids del catálogo común.
 */
const ACTIVIDADES: [RegExp, number][] = [
  [/bartender|barman|barra|coctel/i, 1578530043],
  [/mozo|moza|camarer|catering/i, 1571962206],
  [/segurid|custod|vigila|control de acceso|puerta/i, 1356943507],
  [/acredit|recepci|anfitri|host|azafat|ticket|escáner|escaner|pulsera|credencial/i, 302831179],
  [/promot/i, 721541278],
  [/armad|montaj|desmontaj|stand|escenograf|riggin/i, 268986657],
  [/fot[oó]graf|c[aá]mar|video|drone/i, 1944021682],
  [/\bdj\b/i, 948858016],
  [/sonid|ilumin|t[eé]cnic|audiovisual|led/i, 106821600],
  [/acomod/i, 985070790],
  [/guardarrop/i, 1181417826],
  [/limpie/i, 580501414],
  [/cajer|venta|merch/i, 806656729],
  [/valet/i, 989635473],
  [/locut|present/i, 1156959133],
];
const ACTIVIDAD_DEFAULT = 1305615226; // Producción de eventos

export function actividadDe(rol: string | null | undefined): number {
  for (const [re, id] of ACTIVIDADES) if (re.test(rol ?? "")) return id;
  return ACTIVIDAD_DEFAULT;
}

export interface Cobertura {
  id: number;
  nombre: string;
}

/** Coberturas (suma asegurada) disponibles para esas fechas y actividades. */
export async function cotizar(desde: string, hasta: string, roles: string[]): Promise<Cobertura[]> {
  const cuenta = new Map<number, number>();
  for (const r of roles) cuenta.set(actividadDe(r), (cuenta.get(actividadDe(r)) ?? 0) + 1);
  const j = await api<{ data: { id: number; name: string; public_name: string | null }[] }>(
    "POST",
    `/customers/linked-applications/${app()}/quote/personal-accident/coverages`,
    {
      validity_start: desde,
      validity_end: hasta,
      risks: [...cuenta].map(([risk_sub_type_id, quantity]) => ({ risk_sub_type_id, quantity })),
    },
  );
  return (j.data ?? [])
    .filter((c) => !/turismo/i.test(c.name))
    .map((c) => ({ id: c.id, nombre: c.public_name || c.name }));
}

export interface Asegurado {
  documento_tipo: string;
  documento: string;
  nombre: string;
  apellido: string;
  nacimiento: string; // AAAA-MM-DD
  genero: "f" | "m";
  rol: string;
}

/** Contrata UN seguro para toda la tanda (un solo pago) y devuelve el link de MercadoPago de MeCubro. */
export async function contratar(input: {
  desde: string;
  hasta: string;
  coverageId: number;
  personas: Asegurado[];
  beneficiario?: { nombre: string; cuit: string } | null;
  volverA: string;
}) {
  const ins = await api<{ data: { id: number; uuid: string; code?: string; name: string; status: string } }>(
    "POST",
    `/customers/linked-applications/${app()}/insurances/personal-accident`,
    {
      validity_start: input.desde,
      validity_end: input.hasta,
      coverage_id: input.coverageId,
      insurance_risks: input.personas.map((p) => ({
        risk_sub_type_id: actividadDe(p.rol),
        insured_entity: {
          entity_type_id: ENTIDAD_FISICA,
          document_type_id: DOC_PERSONA[p.documento_tipo] ?? DOC_PERSONA.DNI,
          document: p.documento,
          first_name: p.nombre,
          last_name: p.apellido,
          birthday: p.nacimiento,
          gender: p.genero,
        },
      })),
      ...(input.beneficiario
        ? {
            insurance_entities: [
              {
                insurance_entity_type_id: NO_REPETICION,
                // Persona jurídica: MeCubro pide la razón social en first_name y género «b».
                entity: {
                  entity_type_id: ENTIDAD_JURIDICA,
                  document_type_id: DOC_CUIT_JURIDICA,
                  document: input.beneficiario.cuit,
                  first_name: input.beneficiario.nombre,
                  gender: "b",
                },
              },
            ],
          }
        : {}),
    },
  );
  const id = ins.data.id;
  const det = await estado(id);
  const link = await api<{ data: { payment_link: string } }>("POST", `/customers/insurances/${id}/mp-payment-link`, {
    back_urls: { success: input.volverA, pending: input.volverA, failure: input.volverA },
  });
  return {
    insuranceId: id,
    uuid: ins.data.uuid,
    codigo: ins.data.code ?? ins.data.name,
    estado: det.estado,
    total: det.total,
    linkPago: link.data.payment_link,
  };
}

/** Estado en MeCubro. No hay webhooks: se consulta al abrir la pantalla. */
export async function estado(insuranceId: number) {
  const j = await api<{ data: { status: string; total_to_pay: number; total_wallet_paid: number; status_nice?: string } }>(
    "GET",
    `/customers/insurances/${insuranceId}?load[Insurance]=*`,
  );
  const d = j.data;
  return {
    estado: d.status,
    estadoTexto: d.status_nice ?? d.status,
    total: Number(d.total_to_pay ?? 0) + Number(d.total_wallet_paid ?? 0),
    pagado: d.status !== "open" && d.status !== "cancel" && Number(d.total_to_pay ?? 0) === 0,
  };
}

/** PDF del certificado (solo existe cuando está pagado). */
export async function certificado(uuid: string): Promise<Response> {
  if (!token || token.vence < Date.now()) await login();
  return fetch(`${process.env.MECUBRO_API_URL}/common/insurances/${uuid}/certificate`, {
    headers: { Authorization: `Bearer ${token!.valor}`, Accept: "application/pdf" },
    cache: "no-store",
  });
}
