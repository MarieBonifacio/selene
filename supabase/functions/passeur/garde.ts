/* Le passeur, partie pure : ce qu'on a le droit d'aller chercher, et comment le lire.
   Aucune entrée/sortie ici (ni réseau, ni DNS, ni environnement) : tout se teste seul (garde_test.ts).

   La menace principale est la SSRF (Server-Side Request Forgery) : faire appeler par le serveur une adresse
   qu'il est seul à pouvoir joindre (réseau interne, métadonnées du nuage en 169.254.169.254, la base elle-même).
   D'où : http(s) seulement, ports usuels, pas d'identifiants dans l'adresse, pas de nom local, et toute adresse IP
   (écrite dans l'URL ou obtenue par le DNS) doit être publique. */

export type Genre = "feed" | "page" | "ics";
export const GENRES: readonly Genre[] = ["feed", "page", "ics"];
export const MAX_OCTETS = 2 * 1024 * 1024; // 2 Mo : un flux ou une page, jamais une vidéo
export const MAX_SAUTS = 4; // redirections suivies au plus, chacune revérifiée

const NOMS_LOCAUX = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|home\.arpa|localdomain)$/i;

/* Une IPv4 écrite a.b.c.d (forme canonique : le parseur d'URL a déjà ramené 0x7f.1 ou 2130706433 à 127.0.0.1). */
function octets4(ip: string): number[] | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const o = m.slice(1).map(Number);
  return o.every(n => n <= 255) ? o : null;
}
function ipv4Publique(o: number[]): boolean {
  const [a, b, c] = o;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false; // « ce réseau », privé, boucle locale, multidiffusion et réservé
  if (a === 100 && b >= 64 && b <= 127) return false; // NAT de l'opérateur (100.64/10)
  if (a === 169 && b === 254) return false; // lien local, dont les métadonnées du nuage
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false; // 192.0.0/24 (IETF), 192.0.2/24 (documentation)
  if (a === 192 && b === 88 && c === 99) return false; // relais 6to4
  if (a === 198 && (b === 18 || b === 19)) return false; // bancs d'essai
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}
/* Une IPv6 développée en huit groupes de 16 bits ; null si ce n'en est pas une. */
function groupes6(ip: string): number[] | null {
  let s = ip.replace(/^\[|\]$/g, "").toLowerCase();
  if (!s.includes(":") || s.includes("%")) return null; // pas d'IPv6, ou un identifiant de zone (lien local)
  const v4 = s.match(/(\d{1,3}(?:\.\d{1,3}){3})$/); // forme mixte ::ffff:1.2.3.4
  if (v4) { const o = octets4(v4[1]); if (!o) return null; s = s.slice(0, -v4[1].length) + ((o[0] << 8) | o[1]).toString(16) + ":" + ((o[2] << 8) | o[3]).toString(16); }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const part = (x: string) => x ? x.split(":") : [];
  const head = part(halves[0]), tail = halves.length === 2 ? part(halves[1]) : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;
  const all = [...head, ...Array(fill).fill("0"), ...tail];
  if (all.length !== 8 || all.some(g => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return all.map(g => parseInt(g, 16));
}
function ipv6Publique(g: number[]): boolean {
  if (g.every(x => x === 0)) return false; // ::
  if (g.slice(0, 7).every(x => x === 0) && g[7] === 1) return false; // ::1
  const v4 = [g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255];
  if (g.slice(0, 5).every(x => x === 0) && (g[5] === 0xffff || g[5] === 0)) return ipv4Publique(v4); // IPv4 dans IPv6
  if (g[0] === 0x64 && g[1] === 0xff9b) return ipv4Publique(v4); // NAT64
  if ((g[0] & 0xfe00) === 0xfc00) return false; // adresses uniques locales fc00::/7
  if ((g[0] & 0xffc0) === 0xfe80) return false; // lien local fe80::/10
  if ((g[0] & 0xff00) === 0xff00) return false; // multidiffusion
  if (g[0] === 0x2001 && (g[1] === 0x0db8 || g[1] === 0)) return false; // documentation, Teredo
  if (g[0] === 0x2002) return false; // 6to4 : l'IPv4 enfouie pourrait être privée
  if (g[0] === 0x100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return false; // 100::/64, rebut
  return true;
}
/* Une adresse IP (v4 ou v6) est-elle joignable par tout internet, donc sans danger à appeler ? */
export function ipPublique(ip: string): boolean {
  const o = octets4(ip); if (o) return ipv4Publique(o);
  const g = groupes6(ip); if (g) return ipv6Publique(g);
  return false; // ce n'est pas une IP : on ne devine pas
}
export const estIp = (h: string) => !!octets4(h) || !!groupes6(h);

/* L'adresse demandée, si elle est acceptable ; sinon une raison, en français, pour l'interface. */
export function cible(brut: unknown): { url: URL } | { refus: string } {
  if (typeof brut !== "string" || brut.length > 2000) return { refus: "adresse absente ou trop longue" };
  let u: URL;
  try { u = new URL(brut.trim()); } catch { return { refus: "adresse illisible" }; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { refus: "seulement http et https" };
  if (u.username || u.password) return { refus: "pas d'identifiants dans l'adresse" };
  if (u.port && u.port !== "80" && u.port !== "443") return { refus: "port inhabituel" };
  const h = u.hostname.replace(/\.$/, "");
  if (estIp(h)) return ipPublique(h) ? { url: u } : { refus: "adresse privée ou réservée" };
  if (!h.includes(".") || NOMS_LOCAUX.test(h)) return { refus: "nom de réseau local" };
  u.hash = "";
  return { url: u };
}

/* Les types de contenu acceptés : du texte, selon ce qu'on attend. Un type absent est toléré (on lira du texte). */
export function typeAccepte(genre: Genre, type: string | null): boolean {
  const t = (type || "").split(";")[0].trim().toLowerCase();
  if (!t) return true;
  if (genre === "ics") return t === "text/calendar" || t === "text/plain";
  if (genre === "page") return t === "text/html" || t === "application/xhtml+xml";
  return /^(text\/(xml|html|plain)|application\/((rss|atom|rdf|feed)\+)?(xml|json)|application\/(rss|atom)\+xml|application\/feed\+json)$/.test(t);
}

/* L'encodage d'une réponse : l'en-tête d'abord, sinon la déclaration XML ou la balise meta du début, sinon UTF-8. */
export function encodage(type: string | null, debut: Uint8Array): string {
  const h = (type || "").match(/charset\s*=\s*"?([\w.:-]+)/i);
  if (h) return h[1].toLowerCase();
  const tete = new TextDecoder("latin1").decode(debut.subarray(0, 2048));
  const m = tete.match(/<\?xml[^>]*encoding\s*=\s*["']([\w.:-]+)/i) || tete.match(/<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i);
  return m ? m[1].toLowerCase() : "utf-8";
}
export function decoder(octets: Uint8Array, label: string): string {
  try { return new TextDecoder(label).decode(octets); } catch { return new TextDecoder("utf-8").decode(octets); }
}

/* Les origines autorisées à appeler le passeur (liste séparée par des virgules). */
export function origines(env: string | undefined): string[] {
  return (env || "https://mariebonifacio.github.io").split(",").map(s => s.trim().replace(/\/$/, "")).filter(Boolean);
}
/* Les comptes autorisés : sans liste, personne (fermé par défaut). */
export function comptes(env: string | undefined): Set<string> {
  return new Set((env || "").split(",").map(s => s.trim().toLowerCase()).filter(s => /^[0-9a-f-]{36}$/.test(s)));
}
