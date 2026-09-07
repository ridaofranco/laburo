"use client";

/**
 * Campo de contraseña con el ojito para verla mientras se escribe.
 *
 * LO PIDIÓ FRANCO EL 7/9/2026, entrando él mismo: *"estaría bueno que puedan ver
 * la contraseña mientras van poniendo, yo recién no sé qué puse"*. Es el
 * problema clásico de una contraseña a ciegas en el teléfono, y acá pega más
 * fuerte que en otras apps: en LABURO la contraseña es OPCIONAL (el que entra
 * con el link mágico nunca definió una), así que alguien que se equivoca al
 * tipear no tiene forma de saber si el problema es la contraseña o que nunca
 * tuvo una.
 *
 * ⚠️ EL BOTÓN VA AL LADO, DENTRO DEL CAMPO, y no debajo: la ayuda que ya estaba
 * abajo se lee después de haber escrito, y para entonces el error ya se cometió.
 *
 * Detalles que hacen que no moleste:
 *  - `type="button"`, o dentro de un form el ojito manda el formulario.
 *  - `tabIndex={-1}`: tabulando se va del campo al botón de entrar, no al ojo.
 *  - El input recibe padding a la derecha para que el texto no pase por debajo.
 *  - Vuelve a ocultarse solo al enviar, no: se respeta lo que eligió la persona.
 */

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function CampoContrasena({
  className = "",
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`${className} pr-12`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar la contraseña" : "Mostrar la contraseña"}
        aria-pressed={visible}
        title={visible ? "Ocultar" : "Mostrar"}
        className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-[#8a8a8a] hover:text-[#f5f5f5] transition-colors duration-200"
      >
        {visible ? <EyeOff size={18} strokeWidth={1.6} /> : <Eye size={18} strokeWidth={1.6} />}
      </button>
    </div>
  );
}
