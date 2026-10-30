// Copiado de PASE (src/lib/email.ts, c739d6a, 29/10). En LABURO había 11 fichas
// así (gmail.con, gamil.com, sin @): la bienvenida rebota y la persona nunca entra.
//
// Revisión del email ANTES de registrar a alguien.
//
// Por qué existe: el navegador (type="email") deja pasar «x@gmial.com», «x@gmai.com»
// o «x@gmail.con», porque son direcciones bien formadas. En ArPa y en la base de
// septiembre entraron más de 20 así: Resend las acepta (quedan «sent») y el pase
// nunca llega, y la persona se entera en la puerta. Acá se corrige lo seguro en
// silencio (espacios, punto final, mayúsculas del dominio) y lo dudoso se le
// propone a la persona: si insiste con lo que escribió, pasa igual.

const DOMINIOS: Record<string, string> = {
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gmal.com": "gmail.com",
  "gmaill.com": "gmail.com", "gamil.com": "gmail.com", "gnail.com": "gmail.com",
  "gmail.co": "gmail.com", "gmail.cm": "gmail.com", "gmail.om": "gmail.com",
  "gmail.comm": "gmail.com", "gmail.com.ar": "gmail.com", "gmail.es": "gmail.com",
  "gimail.com": "gmail.com", "gmeil.com": "gmail.com", "gemail.com": "gmail.com",
  "hotmial.com": "hotmail.com", "hotmal.com": "hotmail.com", "hotmai.com": "hotmail.com",
  "hotmil.com": "hotmail.com", "hotamil.com": "hotmail.com", "hotmail.co": "hotmail.com",
  "hotmail.cm": "hotmail.com", "hotmial.com.ar": "hotmail.com.ar", "hotmal.com.ar": "hotmail.com.ar",
  "outlok.com": "outlook.com", "outllok.com": "outlook.com", "outlook.co": "outlook.com",
  "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com", "yaho.com.ar": "yahoo.com.ar",
  "icloud.co": "icloud.com", "iclod.com": "icloud.com",
};

export type RevisionEmail =
  | { estado: "vacio" }
  | { estado: "ok"; email: string }
  | { estado: "dudoso"; email: string; sugerencia: string }
  | { estado: "invalido"; email: string };

export function revisarEmail(crudo: string): RevisionEmail {
  // Tabs, espacios y saltos de línea en cualquier lado: nunca son parte de un mail.
  let e = crudo.replace(/\s+/g, "");
  const conEspacios = e !== crudo.trim();
  if (!e) return { estado: "vacio" };
  e = e.replace(/\.+$/, ""); // «x@gmail.com.» rebota
  const partes = e.split("@");
  if (partes.length === 3 && partes[2] && partes[1].toLowerCase() === partes[2].toLowerCase()) {
    // «x@gmail.com@gmail.com»: el autocompletar del teclado pegó el dominio dos veces.
    const propuesta = `${partes[0]}@${partes[1]}`.toLowerCase();
    return { estado: "dudoso", email: e, sugerencia: propuesta };
  }
  if (partes.length !== 2 || !partes[0] || !/^[^@]+\.[a-z]{2,}$/i.test(partes[1])) {
    return { estado: "invalido", email: e };
  }
  // Todo en minúsculas: LABURO también guarda y busca así, y en la práctica ningún
  // proveedor distingue mayúsculas en la parte de antes de la @.
  const local = partes[0].toLowerCase();
  let dominio = partes[1].toLowerCase();
  dominio = dominio.replace(/\.con$/, ".com").replace(/\.cmo$/, ".com").replace(/\.con\.ar$/, ".com.ar");
  dominio = DOMINIOS[dominio] ?? dominio;
  const propuesta = `${local}@${dominio}`;
  if (dominio !== partes[1].toLowerCase()) return { estado: "dudoso", email: e, sugerencia: propuesta };
  if (conEspacios) return { estado: "dudoso", email: e, sugerencia: propuesta };
  return { estado: "ok", email: propuesta };
}

export function textoEmail(r: RevisionEmail): string {
  if (r.estado === "invalido") return "Revisá tu email: tiene que ser como nombre@gmail.com.";
  if (r.estado === "dudoso") return `¿Quisiste decir ${r.sugerencia}? Ya lo corregimos: revisalo y enviá de nuevo.`;
  return "";
}

/**
 * Para el submit de un formulario. `insistido` guarda el último mail dudoso que
 * se le corrigió a la persona: si lo vuelve a poner tal cual y manda, pasa igual
 * (puede ser un dominio real que no conocemos).
 * Devuelve el mail a mandar, o qué poner en el campo y qué decirle.
 */
export function revisarAntesDeEnviar(
  crudo: string,
  insistido: { current: string | null },
): { enviar: string } | { corregir: string | null; mensaje: string } {
  const r = revisarEmail(crudo);
  if (r.estado === "ok") return { enviar: r.email };
  if (r.estado === "vacio") return { enviar: "" };
  if (r.estado === "dudoso" && insistido.current === r.email) return { enviar: r.email };
  if (r.estado === "dudoso") {
    insistido.current = r.email;
    return { corregir: r.sugerencia, mensaje: textoEmail(r) };
  }
  return { corregir: null, mensaje: textoEmail(r) };
}
