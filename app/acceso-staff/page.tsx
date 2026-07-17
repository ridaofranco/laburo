/**
 * Acceso del lado STAFF (fork "staff con cuenta"). Página pública que monta el
 * form de login de staff (magic link + Google). El ruteo por identidad lo hace
 * /auth/callback: member → /dashboard, staff → /panel-staff, ninguno → acá.
 */

import type { Metadata } from "next";
import { StaffLoginForm } from "./staff-login-form";

export const metadata: Metadata = {
  title: "LABURO. | Portal de Staff",
};

export default function AccesoStaffPage() {
  return <StaffLoginForm />;
}
