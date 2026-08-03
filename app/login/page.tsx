import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ⚠️ VA A /auth/callback Y NO A /dashboard (arreglado el 3/8). Acá mandaba a
  // todos al panel del productor sin mirar quién era: un empleado logueado que
  // entraba a /login (el link que circula, el que está en los mails) terminaba
  // en "Esta cuenta no tiene acceso", que es la pantalla de rechazo.
  //
  // /auth/callback rutea por identidad y de paso corre provision_member, así que
  // también es lo que repara a una productora que quedó sin membresía.
  if (user) {
    redirect("/auth/callback?from=login");
  }

  return <LoginForm />;
}
