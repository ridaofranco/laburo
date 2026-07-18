/**
 * Base de OFICIOS / puestos para el registro de staff eventual.
 * Pensada como fuente única: alimenta el formulario de "Trabajá con nosotros"
 * y será la taxonomía de roles del futuro pool/app de staffing.
 * Bilingüe (es/en). Agregá items sin romper nada; el form los renderiza solos.
 */
export interface OficioCat {
  cat: { es: string; en: string };
  items: { es: string; en: string }[];
}

export const oficios: OficioCat[] = [
  {
    cat: { es: 'Bar y gastronomía', en: 'Bar & catering' },
    items: [
      { es: 'Bartender', en: 'Bartender' },
      { es: 'Ayudante de barra', en: 'Bar back' },
      { es: 'Mozo / Camarero', en: 'Waiter / Server' },
      { es: 'Runner', en: 'Food runner' },
      { es: 'Cocinero/a', en: 'Cook' },
      { es: 'Ayudante de cocina', en: 'Kitchen assistant' },
      { es: 'Bachero/a', en: 'Dishwasher' },
      { es: 'Barista', en: 'Barista' },
      { es: 'Sommelier', en: 'Sommelier' },
      { es: 'Maître', en: 'Maître' },
      { es: 'Operador de food truck', en: 'Food truck operator' },
    ],
  },
  {
    cat: { es: 'Accesos y acreditación', en: 'Access & accreditation' },
    items: [
      { es: 'Control de accesos', en: 'Access control' },
      { es: 'Acreditador/a', en: 'Accreditation staff' },
      { es: 'Operador de escáner / ticketing', en: 'Scanner / ticketing operator' },
      { es: 'Seguridad de puerta', en: 'Door security' },
      { es: 'Guardarropa', en: 'Coat check' },
      { es: 'Pulseras y credenciales', en: 'Wristbands & credentials' },
    ],
  },
  {
    cat: { es: 'Producción y logística', en: 'Production & logistics' },
    items: [
      { es: 'Asistente de producción', en: 'Production assistant' },
      { es: 'Productor/a de campo', en: 'Field producer' },
      { es: 'Stage manager', en: 'Stage manager' },
      { es: 'Régisseur', en: 'Régisseur' },
      { es: 'Montaje y desmontaje', en: 'Setup & teardown' },
      { es: 'Carga y descarga (peón)', en: 'Loader / hand' },
      { es: 'Pañolero/a', en: 'Tool/store keeper' },
      { es: 'Utilero/a', en: 'Props handler' },
      { es: 'Coordinador/a de logística', en: 'Logistics coordinator' },
    ],
  },
  {
    cat: { es: 'Técnica (sonido, luces, video)', en: 'Technical (sound, lights, video)' },
    items: [
      { es: 'Técnico/a de sonido', en: 'Sound technician' },
      { es: 'Técnico/a de luces', en: 'Lighting technician' },
      { es: 'Técnico/a de video / LED', en: 'Video / LED technician' },
      { es: 'Operador/a de switcher', en: 'Switcher operator' },
      { es: 'Stagehand', en: 'Stagehand' },
      { es: 'Rigger', en: 'Rigger' },
      { es: 'Electricista', en: 'Electrician' },
      { es: 'Backline', en: 'Backline tech' },
    ],
  },
  {
    cat: { es: 'Audiovisual', en: 'Audiovisual' },
    items: [
      { es: 'Fotógrafo/a', en: 'Photographer' },
      { es: 'Camarógrafo/a', en: 'Camera operator' },
      { es: 'Operador/a de dron', en: 'Drone operator' },
      { es: 'Editor/a', en: 'Editor' },
      { es: 'Streaming / transmisión', en: 'Streaming / broadcast' },
    ],
  },
  {
    cat: { es: 'Atención y experiencia', en: 'Hospitality & experience' },
    items: [
      { es: 'Promotor/a', en: 'Promoter' },
      { es: 'Azafata / Edecán', en: 'Hostess / Brand host' },
      { es: 'Recepcionista', en: 'Receptionist' },
      { es: 'Host / Anfitrión', en: 'Host' },
      { es: 'Sampling / degustación', en: 'Sampling' },
      { es: 'Brand ambassador', en: 'Brand ambassador' },
      { es: 'Animador/a', en: 'Animator / MC' },
      { es: 'Coordinador/a de invitados', en: 'Guest coordinator' },
    ],
  },
  {
    cat: { es: 'Comercial y ventas', en: 'Sales' },
    items: [
      { es: 'Vendedor/a', en: 'Salesperson' },
      { es: 'Cajero/a', en: 'Cashier' },
      { es: 'Venta de merchandising', en: 'Merchandising sales' },
    ],
  },
  {
    cat: { es: 'Limpieza y mantenimiento', en: 'Cleaning & maintenance' },
    items: [
      { es: 'Personal de limpieza', en: 'Cleaning staff' },
      { es: 'Mantenimiento', en: 'Maintenance' },
      { es: 'Sanitarios', en: 'Restroom attendant' },
    ],
  },
  {
    cat: { es: 'Salud y seguridad', en: 'Health & safety' },
    items: [
      { es: 'Médico/a', en: 'Doctor' },
      { es: 'Enfermero/a', en: 'Nurse' },
      { es: 'Brigadista / bombero', en: 'Fire warden' },
      { es: 'Socorrista', en: 'Lifeguard / first responder' },
    ],
  },
  {
    cat: { es: 'Transporte', en: 'Transport' },
    items: [
      { es: 'Chofer', en: 'Driver' },
      { es: 'Conductor/a de shuttle', en: 'Shuttle driver' },
      { es: 'Valet parking', en: 'Valet parking' },
    ],
  },
  {
    cat: { es: 'Otros perfiles', en: 'Other profiles' },
    items: [
      { es: 'Traductor/a / intérprete', en: 'Translator / interpreter' },
      { es: 'Coordinador/a de voluntarios', en: 'Volunteer coordinator' },
      { es: 'Community manager en vivo', en: 'Live community manager' },
      { es: 'Locución / cabina', en: 'Announcer / booth' },
    ],
  },
];
