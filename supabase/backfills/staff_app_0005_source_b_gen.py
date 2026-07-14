#!/usr/bin/env python3
"""
Source-B (Google-Sheet legacy applicants) deterministic normalizer + transport
generator for staff_app (plan 01-04, DATA-02).

Reads .planning/phases/01-own-data-foundation/source-b-applicants.csv (711 rows, 17
cols, saved from the live Sheet via Drive MCP on 2026-07-14) and builds the
deterministic normalization:
  - name split (first token -> nombre, rest -> apellido; lossless, reconstructable)
  - "Sí"/"No" -> booleans (experiencia, disponibilidad_finde, movilidad_propia)
  - dd/mm/yyyy dates -> YYYY-MM-DD; birthdates outside 1920..2012 -> NULL (9 rows:
    years 0004/0005/0086/0090/1887 garbage + 2016/2025/2025/2026 implausible)
  - oficios free text -> text[] (typo-fixed + mapped to the somosder-web oficios
    catalog where unambiguous; long-tail kept Title-cased)
  - LOCATION NORMALIZATION (Franco's requirement): the 'Provincia' free text
    (221 raw variants) -> provincia (one of the 24 official AR jurisdictions, named
    per somosder-web/src/data/paises.ts provinciasAr) + ciudad (locality; uses
    'Ciudad de Residencia' where the Provincia string has no known city). Deterministic
    keyword/city classifier below. Raw string kept in notas_internas '[sheet:provincia] ...'.
    1 variant unmapped -> provincia NULL, flagged: 'Argentina'.
  - CV Drive link -> cv_url as-is (no Storage object assumed)

Transport: emits supabase/backfills/staff_app_0005_source_b_load.sql -- one INSERT per
chunk into staff_app.staging_line(chunk_id,payload). Payload uses '$' field delim,
'^' oficios sub-delim, '~' row delim (all verified absent from every value), wrapped
in $SBLOAD$...$SBLOAD$; each INSERT is a single physical line. The import SQL
(staff_app_0005_source_b_import.sql) parses staging_line -> staging_sheet -> dedup
INSERT ... SELECT into staff_app.staff_profiles.

Re-runnable and deterministic: same CSV in -> identical SQL out.
"""
import csv, re, unicodedata, datetime
from collections import Counter

CSV = '.planning/phases/01-own-data-foundation/source-b-applicants.csv'
ORG = 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123'
OUT = 'supabase/backfills/staff_app_0005_source_b_load.sql'
SOURCE_A_EMAILS = {
    'agosbini@gmail.com','anaiscontrerasc@gmail.com','camilamercol@gmail.com',
    'iaravila90@gmail.com','juliscarimbolo1@gmail.con','lopezvalentin107@gmail.com',
    'ridaofranco@icloud.com','ridaofrancorg@gmail.com',
}

def norm(s):
    s = (s or '').strip().lower()
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9]+', ' ', s).strip())

def flat(s):
    return None if s is None else re.sub(r'\s+', ' ', s).strip()

# ---- location: canonical province names match provinciasAr ----
BA   = 'Buenos Aires (Provincia)'
CABA = 'Ciudad Autónoma de Buenos Aires (CABA)'
CITY2PROV = {}
def addcity(prov, *cities):
    for c in cities:
        CITY2PROV[norm(c)] = (prov, c)
addcity(CABA,'Palermo','Caballito','Recoleta','Belgrano','Flores','Monserrat','Montserrat',
        'Nunez','Villa Crespo','Almagro','Boedo','Barracas','Once','Constitucion','San Nicolas')
addcity(BA,'Bahia Blanca','Tandil','Mar del Plata','La Plata','Lanus','Lanus Oeste','Lanus Este',
        'Lomas de Zamora','La Matanza','San Martin','Moreno','Tigre','San Isidro','Escobar','Pilar',
        'Hurlingham','Almirante Brown','Adrogue','Banfield','Longchamps','Burzaco','Grand Bourg',
        'San Fernando','Bella Vista','Martinez','Merlo','Loma Hermosa','Bernal','Villa Zagala',
        'La Tablada','Tres de Febrero','Rafael Castillo','Ciudad Evita','San Miguel','Victoria',
        'Mercedes','Villa Granaderos','Tapiales','Quilmes')
addcity('Misiones','Posadas','Posada','Podadas','Garupa','Eldorado','Obera','Montecarlo','Wanda',
        'Candelaria','San Ignacio','Santa Ana','Puerto Iguazu','Campo Grande','San Jose')
addcity('Río Negro','Bariloche','Bariloc')
addcity('Santa Fe','Rosario','Villa Gobernador Galvez','Capitan Bermudez')
addcity('Chaco','Resistencia','Puerto Vilelas')
addcity('Corrientes','Goya','Ita Ibate')
addcity('Catamarca','San Fernando del Valle de Catamarca')
addcity('Neuquén','Neuquen')
addcity('Tierra del Fuego','Ushuaia')
PROV_TOKENS = [
    ('ciudad autonoma de buenos aires', CABA),('ciudad autonoma', CABA),
    ('ciudad de buenos aires', CABA),('capital federal', CABA),('c a b a', CABA),('caba', CABA),
    ('tierra del fuego','Tierra del Fuego'),('rio negrio','Río Negro'),('rio negro','Río Negro'),
    ('santa fe','Santa Fe'),('santafe','Santa Fe'),('entre rios','Entre Ríos'),
    ('santiago del estero','Santiago del Estero'),('san luis','San Luis'),('san juan','San Juan'),
    ('la rioja','La Rioja'),('la pampa','La Pampa'),('santa cruz','Santa Cruz'),
    ('buenos aires', BA),('buenos sires', BA),('bueno aires', BA),('buenas aires', BA),
    ('bs as', BA),('bsas', BA),('bs aires', BA),
    ('misiones','Misiones'),('catamarca','Catamarca'),('formosa','Formosa'),('cordoba','Córdoba'),
    ('corrientes','Corrientes'),('chaco','Chaco'),('neuquen','Neuquén'),('mendoza','Mendoza'),
    ('jujuy','Jujuy'),('salta','Salta'),('chubut','Chubut'),('tucuman','Tucumán'),
]
def classify_loc(prov_raw, ciudad_res):
    padded = ' ' + norm(prov_raw) + ' '
    prov = city = None
    for ck,(cp,cc) in CITY2PROV.items():
        if ' '+ck+' ' in padded:
            city, prov = cc, cp; break
    if prov is None:
        for tk,pv in PROV_TOKENS:
            if ' '+tk+' ' in padded:
                prov = pv; break
    if not city and (ciudad_res or '').strip():
        city = ciudad_res.strip()
    return prov, (city or None)

# ---- oficios ----
OFICIO_MAP = {
    'accesos':'Control de accesos','acceso':'Control de accesos',
    'acreditaciones':'Acreditador/a','acreditacion':'Acreditador/a','acreditación':'Acreditador/a',
    'acomodadora':'Acomodador/a','acomodador':'Acomodador/a','acomodadores':'Acomodador/a',
    'orientadora':'Orientador/a','orientador':'Orientador/a','orientadores':'Orientador/a',
    'orientacion':'Orientador/a','orientación':'Orientador/a','catering':'Catering',
    'produccion':'Producción','producción':'Producción','poducción':'Producción','poduccion':'Producción',
    'asistencia de produccion':'Asistente de producción','asistencia de producción':'Asistente de producción',
    'asistente de produccion':'Asistente de producción','fotografia':'Fotógrafo/a','fotografía':'Fotógrafo/a',
    'audiovisual':'Audiovisual','tecnica':'Técnica','técnica':'Técnica',
    'moza':'Mozo / Camarero','mozo':'Mozo / Camarero','camarera':'Mozo / Camarero','camarero':'Mozo / Camarero',
    'promotora':'Promotor/a','promotor':'Promotor/a','promocion':'Promotor/a','promoción':'Promotor/a',
    'hidratacion':'Hidratación','hidratación':'Hidratación','organizacion':'Organización','organización':'Organización',
    'seguridad':'Seguridad de puerta','limpieza':'Personal de limpieza',
    'caja':'Cajero/a','cajera':'Cajero/a','cajero':'Cajero/a',
    'bartender':'Bartender','barman':'Bartender','barra':'Ayudante de barra','bartenders':'Bartender',
    'recepcionista':'Recepcionista','asistente':'Asistente de producción',
    'atencion al cliente':'Atención al cliente','atención al cliente':'Atención al cliente',
    'logistica':'Coordinador/a de logística','logística':'Coordinador/a de logística',
}
DROP_OFICIO = {'ninguno','ninguna','no','n/a','na','','-'}
def normalize_oficios(raw):
    out = []
    for p in re.split(r'[,;/\n]+', raw or ''):
        p = p.strip(); key = norm(p)
        if key in DROP_OFICIO: continue
        val = OFICIO_MAP.get(key) or (p[:1].upper() + p[1:] if p else p)
        if val and val not in out: out.append(val)
    return out

def parse_bool_si(s): return norm(s) in ('si','si claro','sii','s')
def parse_date(s):
    s = (s or '').strip()
    for fmt in ('%d/%m/%Y','%Y-%m-%d','%d/%m/%y'):
        try:
            d = datetime.datetime.strptime(s, fmt).date()
            return d.isoformat() if 1920 <= d.year <= 2012 else None
        except ValueError: pass
    return None
def parse_ts(s):
    s = (s or '').strip()
    for fmt in ('%d/%m/%Y %H:%M:%S','%d/%m/%Y %H:%M','%Y-%m-%d %H:%M:%S','%m/%d/%Y %H:%M:%S'):
        try: return datetime.datetime.strptime(s, fmt).isoformat(sep=' ')
        except ValueError: pass
    return None
def split_name(full):
    parts = (full or '').strip().split()
    if not parts: return ('(sin nombre)', None)
    if len(parts) == 1: return (parts[0], None)
    return (parts[0], ' '.join(parts[1:]))

def main():
    rows = list(csv.reader(open(CSV))); data = rows[1:]
    def c(r,i): return (r[i].strip() if i < len(r) else '')
    FD, OD, RD = '$', '^', '~'
    def bt(b): return 't' if b else 'f'
    def s(v): return '' if v is None else v
    lines, unmapped, null_dates = [], Counter(), []
    for idx, r in enumerate(data, start=1):
        nombre, apellido = split_name(c(r,1))
        fecha = parse_date(c(r,2))
        if fecha is None and c(r,2): null_dates.append(c(r,2))
        prov, ciudad = classify_loc(c(r,4), c(r,15))
        if prov is None and c(r,4): unmapped[c(r,4)] += 1
        notas = '[sheet:provincia] ' + (c(r,4) or '(vacío)')
        if c(r,15): notas += ' | [sheet:ciudad_residencia] ' + c(r,15)
        fields = [
            str(idx), s(flat(nombre)), s(flat(apellido)), s(fecha), s(flat(c(r,3) or c(r,16))),
            s(flat(c(r,6))), s(flat(c(r,5))), s(prov), s(flat(ciudad)),
            OD.join(flat(o) for o in normalize_oficios(c(r,8))),
            bt(parse_bool_si(c(r,7))), bt(parse_bool_si(c(r,9))), bt(parse_bool_si(c(r,10))),
            s(flat(c(r,12))), s(flat(c(r,13))), s(flat(c(r,14))), s(flat(c(r,11))),
            s(flat(notas)), c(r,6).lower().strip(), s(parse_ts(c(r,0))),
        ]
        lines.append(FD.join(fields))

    # chunk to ~20KB single-line payloads
    BUDGET = 20000; chunks, cur, curlen = [], [], 0
    for ln in lines:
        if cur and curlen + len(ln) + 1 > BUDGET:
            chunks.append(cur); cur, curlen = [], 0
        cur.append(ln); curlen += len(ln) + 1
    if cur: chunks.append(cur)
    out = ['-- staff_app_0005 Source-B transport into staff_app.staging_line',
           '-- Generated by this script from source-b-applicants.csv (deterministic).',
           '-- Field delim $, oficios sub ^, row delim ~ (all absent from data). Parsed by',
           '-- staff_app_0005_source_b_import.sql into staff_app.staging_sheet then staff_profiles.']
    for k, ch in enumerate(chunks):
        out.append(f'INSERT INTO staff_app.staging_line(chunk_id,payload) VALUES ({k},$SBLOAD${RD.join(ch)}$SBLOAD$);')
    open(OUT, 'w').write('\n'.join(out) + '\n')

    ec = Counter(l.split(FD)[18] for l in lines)
    print('rows:', len(lines), '| chunks:', len(chunks))
    print('distinct emails:', len(ec), '| dup groups:', sum(1 for v in ec.values() if v>1))
    print('overlap with Source A:', sorted(set(ec) & SOURCE_A_EMAILS))
    print('null dates:', len(null_dates), null_dates)
    print('unmapped provincia:', dict(unmapped))

if __name__ == '__main__':
    main()
