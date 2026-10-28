#!/usr/bin/env node
/**
 * INDEXNOW: le avisa a Bing, Yandex y demás buscadores que usan IndexNow
 * cuáles son las URLs del sitio, sin esperar a que pasen a rastrear.
 *
 * Lee los sitemaps EN VIVO (lo publicado, no el dist local), sigue los
 * sitemaps índice, separa las URLs por host y hace un POST por host a
 * https://api.indexnow.org/indexnow en lotes de hasta 10.000 URLs.
 *
 * La clave es pública a propósito: se sirve como /<clave>.txt en la raíz de
 * laburo.somosder.ar (archivo en public/; el middleware deja pasar los .txt). No es un secreto.
 *
 * Uso:  npm run indexnow            (envía)
 *       npm run indexnow -- --dry   (solo cuenta, no envía)
 *
 * Gratis, sin cuenta ni API paga.
 */

const KEY = '94763d2734274822aec29fcd0449c819';
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const LOTE = 10000;
const HOSTS = ['laburo.somosder.ar'];
const SITEMAPS = ['https://laburo.somosder.ar/sitemap.xml'];
const DRY = process.argv.includes('--dry');

const desescapar = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

async function leerSitemap(url, vistos, urls) {
  if (vistos.has(url)) return;
  vistos.add(url);
  const res = await fetch(url, { headers: { 'user-agent': 'laburo-indexnow/1.0' } });
  if (!res.ok) {
    console.warn(`[indexnow] ${url} devolvió ${res.status}, se saltea`);
    return;
  }
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => desescapar(m[1]));
  if (/<sitemapindex[\s>]/.test(xml)) {
    for (const hijo of locs) await leerSitemap(hijo, vistos, urls);
  } else {
    for (const u of locs) urls.add(u);
  }
}

async function main() {
  const vistos = new Set();
  const urls = new Set();
  for (const s of SITEMAPS) await leerSitemap(s, vistos, urls);

  const porHost = new Map(HOSTS.map((h) => [h, []]));
  const afuera = [];
  for (const u of urls) {
    let host;
    try { host = new URL(u).host; } catch { afuera.push(u); continue; }
    if (porHost.has(host)) porHost.get(host).push(u);
    else afuera.push(u);
  }
  if (afuera.length) console.warn(`[indexnow] ${afuera.length} URLs con host no reconocido, no se envían`);

  let fallo = false;
  for (const [host, lista] of porHost) {
    console.log(`[indexnow] ${host}: ${lista.length} URLs`);
    if (DRY || !lista.length) continue;
    for (let i = 0; i < lista.length; i += LOTE) {
      const urlList = lista.slice(i, i + LOTE);
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ host, key: KEY, keyLocation: `https://${host}/${KEY}.txt`, urlList }),
      });
      const cuerpo = (await res.text()).slice(0, 300);
      console.log(`[indexnow] ${host} lote ${i / LOTE + 1} (${urlList.length}): HTTP ${res.status} ${cuerpo}`);
      if (res.status !== 200 && res.status !== 202) fallo = true;
    }
  }
  if (fallo) process.exitCode = 1;
}

main().catch((e) => {
  console.error('[indexnow]', e);
  process.exitCode = 1;
});
