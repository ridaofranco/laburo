/**
 * MANDA UN CORREO DE PRUEBA DE CADA MAIL DE LABURO.
 *
 * Franco pidió (26/7) ver cómo llegan los mails a su casilla real, no una
 * maqueta. Esto los renderiza desde los componentes de verdad y los manda.
 *
 * ── CÓMO SE USA ──
 *   Para MANDARLOS de verdad (necesita las SMTP_* cargadas en .env.local):
 *     npx tsx scripts/preview-mails.mjs
 *
 *   Para solo generar los HTML sin mandar nada:
 *     PREVIEW_DIR=/tmp/mails npx tsx scripts/preview-mails.mjs
 *
 * ⚠️ Al 26/7 las SMTP_* del .env.local están VACÍAS (SMTP_HOST=""), así que sin
 * cargarlas esto no puede enviar. Los valores reales están en Vercel.
 *
 * Cada mail sale con un cartel arriba que aclara que es una prueba con datos
 * inventados, para no confundirlo con uno real si queda en la bandeja.
 */
import fs from 'fs';
// Si se pide PREVIEW_DIR y no existe, se crea: antes fallaban los 7 con ENOENT y
// parecía un problema de los mails.
if (process.env.PREVIEW_DIR) fs.mkdirSync(process.env.PREVIEW_DIR, { recursive: true });
// Cargo .env.local a mano (dotenv no esta instalado en este repo).
for (const linea of fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = linea.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
import nodemailer from 'nodemailer';
import { render } from '@react-email/components';
import { createElement } from 'react';
import * as React from 'react';
globalThis.React = React;

import { WelcomeEmail } from '../components/emails/welcome-email.tsx';
import { WelcomeLegacyEmail } from '../components/emails/welcome-legacy-email.tsx';
import { OfferEmail } from '../components/emails/offer-email.tsx';
import { ReminderEmail } from '../components/emails/reminder-email.tsx';
import { HiredEmail } from '../components/emails/hired-email.tsx';
import { ShiftReminderEmail } from '../components/emails/shift-reminder-email.tsx';
import { OfferAnswerEmail } from '../components/emails/offer-answer-email.tsx';
import { PagoListoEmail } from '../components/emails/pago-listo-email.tsx';
import { QuienFichoEmail } from '../components/emails/quien-ficho-email.tsx';

const PARA = 'ridaofrancorg@gmail.com';
const LINK = 'https://laburo.somosder.ar/o/PREVIEW-no-es-un-link-real';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE) !== 'false',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
});

const mails = [
  {
    n: 'Bienvenida CORTA: el que se registra hoy en la web',
    subject: 'Bienvenido/a a LABURO · SOMOS DER',
    el: () => createElement(WelcomeEmail, { firstName: 'Franco', link: 'https://laburo.somosder.ar/acceso-staff' }),
  },
  {
    n: 'Bienvenida LARGA: los que ya se habían postulado (la tanda a los 699)',
    subject: 'Te queríamos contar algo: se llama LABURO',
    el: () => createElement(WelcomeLegacyEmail, {
      firstName: 'Franco',
      link: 'https://laburo.somosder.ar/acceso-staff',
      bajaLink: 'https://laburo.somosder.ar/baja?p=demo&t=demo',
    }),
  },
  {
    n: 'Propuesta de trabajo',
    subject: 'Tenés una propuesta de laburo · Campus Party 2026',
    el: () => createElement(OfferEmail, {
      firstName: 'Franco', gigTitle: 'Campus Party 2026', role: 'Acreditación',
      amount: 45000, conditions: 'Se pide ropa negra y llegar 1 hora antes.',
      whenText: 'sábado 12 de septiembre, 09:00', link: LINK,
      venue: 'La Rural, Av. Sarmiento 2704, CABA',
      expiresText: 'miércoles 30 de julio, 18:00',
      // La política real (PAGO_TEXTO de lib/pago.ts), no la frase vieja.
      paymentText: 'El pago se coordina con SOMOS DER dentro de los 10 días hábiles de realizado el trabajo.',
    }),
  },
  {
    n: 'La propuesta está por vencer (ahora con botón)',
    subject: 'Tu propuesta está por vencer · Campus Party 2026',
    el: () => createElement(ReminderEmail, {
      firstName: 'Franco', gigTitle: 'Campus Party 2026', role: 'Acreditación',
      expiresText: 'miércoles 30 de julio', link: LINK,
    }),
  },
  {
    n: 'Quedaste confirmado (el del arreglo legal)',
    subject: 'Quedaste confirmado/a · Campus Party 2026',
    el: () => createElement(HiredEmail, {
      firstName: 'Franco', gigTitle: 'Campus Party 2026', role: 'Acreditación',
      whenText: 'sábado 12 de septiembre, 09:00', venue: 'La Rural, CABA',
      amountText: '$ 45.000', conditions: 'Ropa negra. Llegar 1 hora antes.',
      link: 'https://laburo.somosder.ar/panel-staff',
    }),
  },
  {
    n: 'Mañana trabajás (recordatorio del día antes)',
    subject: 'Mañana trabajás · Campus Party 2026',
    el: () => createElement(ShiftReminderEmail, {
      firstName: 'Franco', gigTitle: 'Campus Party 2026', role: 'Acreditación',
      whenText: 'mañana sábado, 09:00', venue: 'La Rural, CABA',
      link: 'https://laburo.somosder.ar/panel-staff',
    }),
  },
  {
    n: 'Tu pago está listo (cierre del ciclo laburo hecho, pago coordinado)',
    subject: 'Tu pago está listo · Campus Party 2026',
    el: () => createElement(PagoListoEmail, {
      firstName: 'Franco', gigTitle: 'Campus Party 2026', role: 'Acreditación',
      amountText: '$ 45.000',
      paymentText: 'El pago se coordina con SOMOS DER dentro de los 10 días hábiles de realizado el trabajo.',
    }),
  },
  {
    n: 'INTERNO: quién fichó (resumen post-evento del geofencing)',
    subject: 'Quién fichó · Campus Party 2026 (2 de 3)',
    el: () => createElement(QuienFichoEmail, {
      gigTitle: 'Campus Party 2026',
      whenText: 'sábado 12 de septiembre, 09:00',
      venue: 'La Rural, Av. Sarmiento 2704, CABA',
      ficharon: [
        { nombre: 'Ana Gómez', role: 'Acreditación', entrada: '08:41', salida: '18:12', distanciaM: 35 },
        { nombre: 'Julián Paredes', role: 'Control de accesos', entrada: '09:15', salida: null, distanciaM: 1800 },
      ],
      sinFichar: [{ nombre: 'Micaela Duarte', role: 'Acreditación' }],
      link: 'https://laburo.somosder.ar/tablero',
    }),
  },
  {
    n: 'INTERNO: te respondieron una propuesta',
    subject: 'Ana aceptó · Campus Party 2026',
    el: () => createElement(OfferAnswerEmail, {
      staffName: 'Ana Gómez', gigTitle: 'Campus Party 2026', role: 'Acreditación',
      accepted: true, amountText: '$ 45.000', crewTotal: 6, slotsTotal: 8,
      link: 'https://laburo.somosder.ar/tablero',
    }),
  },
];

const aviso = (nombre, i, total) => `
<div style="background:#FFF7E6;border:1px solid #F5C26B;border-radius:8px;padding:14px 18px;margin:0 0 18px 0;font-family:Arial,sans-serif;">
  <div style="font-size:11px;font-weight:bold;color:#8A5A00;letter-spacing:1.5px;text-transform:uppercase;">Preview ${i} de ${total} · LABURO</div>
  <div style="font-size:15px;color:#3B2A00;margin-top:6px;"><b>${nombre}</b></div>
  <div style="font-size:12px;color:#6B5220;margin-top:6px;">Esto es una prueba con datos inventados. Los links no llevan a ningún lado real. Abajo empieza el mail tal como le llega a la persona.</div>
</div>`;

const SALIDA = process.env.PREVIEW_DIR || '';
const HAY_SMTP = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
if (!HAY_SMTP && !SALIDA) {
  console.error('Sin credenciales SMTP y sin PREVIEW_DIR. Cargá SMTP_* en .env.local para enviar de verdad.');
  process.exit(1);
}

let ok = 0, fail = 0;
for (let i = 0; i < mails.length; i++) {
  const m = mails[i];
  try {
    const html = await render(m.el());
    const conAviso = html.replace(/(<body[^>]*>)/i, `$1${aviso(m.n, i + 1, mails.length)}`);
    if (HAY_SMTP) {
      await transporter.sendMail({
        from: `"${process.env.MAIL_FROM_NAME || 'SOMOS DER'}" <${process.env.SMTP_USER}>`,
        to: PARA,
        subject: `[PREVIEW ${i + 1}/${mails.length}] ${m.subject}`,
        html: conAviso,
      });
    } else {
      fs.writeFileSync(`${SALIDA}/laburo-${i + 1}.html`, conAviso);
      fs.appendFileSync(`${SALIDA}/indice.tsv`, `LABURO\t${m.n}\t${m.subject}\tlaburo-${i + 1}.html\n`);
    }
    console.log(`✓ ${i + 1}. ${m.n}`);
    ok++;
    await new Promise((r) => setTimeout(r, 1200));
  } catch (e) {
    console.error(`✗ ${i + 1}. ${m.n}: ${e.message}`);
    fail++;
  }
}
console.log(`\nEnviados: ${ok} · Fallados: ${fail}`);
