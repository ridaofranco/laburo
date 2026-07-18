/**
 * Países para el registro de staff (multi-país). Argentina y LATAM primero
 * (mercados más relevantes), luego el resto. Usado en el selector de "país de
 * residencia". Mantener simple: el nombre es el valor que se guarda.
 */
export const paises: string[] = [
  // LATAM
  'Argentina',
  'Bolivia',
  'Brasil',
  'Chile',
  'Colombia',
  'Costa Rica',
  'Cuba',
  'Ecuador',
  'El Salvador',
  'Guatemala',
  'Honduras',
  'México',
  'Nicaragua',
  'Panamá',
  'Paraguay',
  'Perú',
  'Puerto Rico',
  'República Dominicana',
  'Uruguay',
  'Venezuela',
  // Europa / mercados frecuentes
  'España',
  'Portugal',
  'Reino Unido',
  'Irlanda',
  'Francia',
  'Italia',
  'Alemania',
  'Países Bajos',
  'Bélgica',
  'Suiza',
  'Austria',
  'Suecia',
  'Noruega',
  'Dinamarca',
  'Polonia',
  // Norteamérica
  'Estados Unidos',
  'Canadá',
  // Medio Oriente / Asia / Oceanía frecuentes
  'Emiratos Árabes Unidos',
  'Catar',
  'Arabia Saudita',
  'Australia',
  'Nueva Zelanda',
  'Japón',
  'China',
  'Singapur',
  // Resto (alfabético)
  'Sudáfrica',
  'India',
  'Otro',
];

/** Código telefónico por país (para prefijar el teléfono automáticamente). */
export const codigoPais: Record<string, string> = {
  Argentina: '+54', Bolivia: '+591', Brasil: '+55', Chile: '+56', Colombia: '+57',
  'Costa Rica': '+506', Cuba: '+53', Ecuador: '+593', 'El Salvador': '+503',
  Guatemala: '+502', Honduras: '+504', México: '+52', Nicaragua: '+505',
  Panamá: '+507', Paraguay: '+595', Perú: '+51', 'Puerto Rico': '+1',
  'República Dominicana': '+1', Uruguay: '+598', Venezuela: '+58', España: '+34',
  Portugal: '+351', 'Reino Unido': '+44', Irlanda: '+353', Francia: '+33',
  Italia: '+39', Alemania: '+49', 'Países Bajos': '+31', Bélgica: '+32',
  Suiza: '+41', Austria: '+43', Suecia: '+46', Noruega: '+47', Dinamarca: '+45',
  Polonia: '+48', 'Estados Unidos': '+1', Canadá: '+1',
  'Emiratos Árabes Unidos': '+971', Catar: '+974', 'Arabia Saudita': '+966',
  Australia: '+61', 'Nueva Zelanda': '+64', Japón: '+81', China: '+86',
  Singapur: '+65', Sudáfrica: '+27', India: '+91', Otro: '',
};

/** Provincias de Argentina (para el selector de ciudad/zona cuando el país es Argentina). */
export const provinciasAr: string[] = [
  'Buenos Aires (Provincia)',
  'Ciudad Autónoma de Buenos Aires (CABA)',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
];
