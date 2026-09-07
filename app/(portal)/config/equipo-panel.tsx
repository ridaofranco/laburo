"use client";

/**
 * Acceso del equipo: quién está, a quién invitaste y qué puede hacer cada uno.
 *
 * ⚠️ SOLO SE OFRECE LO QUE EL ROL PERMITE. Un `writer` puede cargar eventos pero
 * no agrandar el equipo, así que no ve el formulario: la RPC ya lo rechaza, pero
 * mostrar un botón que va a fallar es peor que no mostrarlo.
 */

import { useState, useTransition } from "react";
import { ShieldCheck, Mail, X, Clock, AlertTriangle } from "lucide-react";
import {
  invitarMiembro,
  revocarInvitacion,
  quitarMiembro,
  cambiarRol,
  type Equipo,
} from "./equipo-actions";

const ROLES = [
  { valor: "manager", nombre: "Gerente", que: "Todo, y además puede invitar" },
  { valor: "writer", nombre: "Editor", que: "Busca staff, arma eventos y manda ofertas" },
  { valor: "viewer", nombre: "Solo lectura", que: "Mira, no toca" },
];

function nombreRol(rol: string): string {
  switch (rol) {
    case "owner": return "Dueño";
    case "manager": return "Gerente";
    case "writer": return "Editor";
    case "viewer": return "Solo lectura";
    default: return rol;
  }
}

const LABEL = "label-tech text-[11px] text-[#cfc4c5] uppercase tracking-[0.1em]";

export function EquipoPanel({ equipo, emailPropio }: { equipo: Equipo; emailPropio: string }) {
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function correr(fn: () => Promise<{ ok: boolean; error?: string; aviso?: string }>) {
    setError(null);
    setAviso(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "No pudimos hacerlo.");
      else if (r.aviso) setAviso(r.aviso);
    });
  }

  function onInvitar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    correr(async () => {
      const r = await invitarMiembro(fd);
      if (r.ok) form.reset();
      return r;
    });
  }

  return (
    <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-6 lg:p-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-2 border-b border-[#1A1A1A] gap-4">
        <h3 className="t-section text-[#e5e2e1] flex items-center gap-3">
          <ShieldCheck size={24} className="shrink-0" />
          Acceso del equipo
        </h3>
      </div>

      {/* ── Los que ya están ── */}
      <div className="flex flex-col">
        {equipo.miembros.map((m) => {
          const soyYo = m.email?.toLowerCase() === emailPropio.toLowerCase();
          return (
            <div
              key={m.id}
              className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center py-4 border-b border-[#1A1A1A]"
            >
              <div className="md:col-span-6 min-w-0">
                <p className="text-[16px] text-[#e5e2e1] truncate">
                  {m.email ?? "—"}
                  {soyYo ? <span className="text-[#8a8a8a]"> · vos</span> : null}
                </p>
              </div>
              <div className="md:col-span-3">
                {equipo.puede_invitar && m.rol !== "owner" && !soyYo ? (
                  <select
                    defaultValue={m.rol}
                    disabled={pendiente}
                    onChange={(e) => correr(() => cambiarRol(m.id, e.target.value))}
                    className="bg-transparent border border-[#4c4546] text-[#e5e2e1] text-[13px] py-2 px-3 outline-none focus:border-[#e5e2e1]"
                  >
                    {ROLES.map((r) => (
                      <option key={r.valor} value={r.valor} className="bg-[#0A0A0A]">
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={LABEL}>{nombreRol(m.rol)}</span>
                )}
              </div>
              <div className="md:col-span-3 flex md:justify-end">
                {equipo.puede_invitar && m.rol !== "owner" && !soyYo ? (
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() => correr(() => quitarMiembro(m.id))}
                    className="label-tech text-[11px] uppercase tracking-[0.1em] text-[#8a8a8a] hover:text-[#ff8a8a] transition-colors disabled:opacity-50"
                  >
                    Sacar del equipo
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}

        {/* ── Las invitaciones que todavía no aceptaron ── */}
        {equipo.invitaciones.map((i) => (
          <div
            key={i.id}
            className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center py-4 border-b border-[#1A1A1A]"
          >
            <div className="md:col-span-6 min-w-0">
              <p className="text-[16px] text-[#cfc4c5] truncate flex items-center gap-2">
                <Clock size={14} className="shrink-0 text-[#8a8a8a]" />
                {i.email}
              </p>
              {/* ⚠️ Si el mail no salió hay que decirlo: la invitación existe
                  igual, y sin este aviso se invita tres veces a la misma persona
                  creyendo que no se creó nada. */}
              {!i.enviado ? (
                <p className="text-[13px] text-[#ffb4ab] mt-1 flex items-center gap-2">
                  <AlertTriangle size={13} className="shrink-0" />
                  El mail no salió. Volvé a invitarla para reenviarlo.
                </p>
              ) : null}
            </div>
            <div className="md:col-span-3">
              <span className={LABEL}>Invitado · {nombreRol(i.rol)}</span>
            </div>
            <div className="md:col-span-3 flex md:justify-end">
              {equipo.puede_invitar ? (
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => correr(() => revocarInvitacion(i.id))}
                  className="label-tech text-[11px] uppercase tracking-[0.1em] text-[#8a8a8a] hover:text-[#ff8a8a] transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <X size={13} /> Cancelar
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* ── Invitar ── */}
      {equipo.puede_invitar ? (
        <form onSubmit={onInvitar} className="mt-8 pt-8 border-t border-[#1A1A1A] flex flex-col gap-4">
          <p className={LABEL}>Invitar a alguien más</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Mail size={16} className="absolute left-0 top-1/2 -translate-y-1/2 text-[#8a8a8a]" />
              <input
                type="email"
                name="email"
                required
                placeholder="su@email.com"
                className="w-full bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[16px] text-[#e5e2e1] py-3 pl-7 pr-0 rounded-none transition-colors placeholder:text-[#565656]"
              />
            </div>
            <select
              name="rol"
              defaultValue="writer"
              className="bg-transparent border border-[#4c4546] text-[#e5e2e1] text-[14px] py-3 px-4 outline-none focus:border-[#e5e2e1]"
            >
              {ROLES.map((r) => (
                <option key={r.valor} value={r.valor} className="bg-[#0A0A0A]">
                  {r.nombre} — {r.que}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pendiente}
              className="bg-[#f5f5f5] text-black label-tech text-[12px] uppercase tracking-[0.1em] py-3 px-8 hover:bg-[#0047ff] hover:text-white transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {pendiente ? "Invitando..." : "Invitar"}
            </button>
          </div>
          <p className="text-[13px] text-[#8a8a8a]">
            Le llega un mail con un link que vale 14 días. Solo puede entrar con
            esa misma dirección.
          </p>
        </form>
      ) : (
        <p className="mt-8 pt-8 border-t border-[#1A1A1A] text-[14px] text-[#8a8a8a]">
          Para sumar gente al equipo hace falta ser dueño o gerente de la cuenta.
        </p>
      )}

      {error ? (
        <p role="alert" className="mt-4 text-[14px] text-[#ff8a8a]">{error}</p>
      ) : null}
      {aviso ? (
        <p className="mt-4 text-[14px] text-[#ffb4ab]">{aviso}</p>
      ) : null}
    </div>
  );
}
