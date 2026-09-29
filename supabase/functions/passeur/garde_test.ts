/* La garde du passeur : les adresses qu'une SSRF essaierait, et celles qu'on doit laisser passer. */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { cible, comptes, decoder, encodage, ipPublique, origines, typeAccepte } from "./garde.ts";

const refus = (u: string) => "refus" in cible(u);

Deno.test("IP privées, réservées, locales : refusées ; publiques : acceptées", () => {
  for (const ip of ["127.0.0.1", "10.2.3.4", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
    "224.0.0.1", "255.255.255.255", "198.18.0.1", "192.0.2.5", "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "::ffff:127.0.0.1",
    "::ffff:7f00:1", "64:ff9b::a9fe:a9fe", "2001:db8::1", "ff02::1", "2002:c0a8:101::1"]) assert(!ipPublique(ip), ip);
  for (const ip of ["93.184.216.34", "1.1.1.1", "172.32.0.1", "2606:4700::1111", "::ffff:8.8.8.8", "2a00:1450:4007:80e::200e"]) assert(ipPublique(ip), ip);
  assert(!ipPublique("exemple.org"));
});

Deno.test("adresses : http(s), ports usuels, sans identifiants ni nom local ; les IP déguisées sont reconnues", () => {
  for (const u of ["http://127.0.0.1/", "http://2130706433/", "http://0x7f.1/", "http://[::1]/", "http://[::ffff:169.254.169.254]/latest/meta-data/",
    "http://169.254.169.254/latest/meta-data/", "http://localhost:8080/", "http://db.internal/", "http://imprimante.local/", "http://intranet/",
    "file:///etc/passwd", "ftp://exemple.org/", "gopher://exemple.org/", "https://moi:secret@exemple.org/", "https://exemple.org:6379/",
    "javascript:alert(1)", "pas une adresse", "https://" + "a".repeat(2000) + ".org/"]) assert(refus(u), u);
  assert(refus(42 as unknown as string));
  const ok = cible("https://www.Exemple.org/flux.xml#haut");
  assert("url" in ok); assertEquals(ok.url.toString(), "https://www.exemple.org/flux.xml");
  assert(!refus("http://exemple.org:80/rss"));
  assert(!refus("http://93.184.216.34/"));
});

Deno.test("types : du texte selon le genre, jamais un binaire", () => {
  assert(typeAccepte("feed", "application/rss+xml; charset=utf-8"));
  assert(typeAccepte("feed", "application/atom+xml")); assert(typeAccepte("feed", "application/feed+json")); assert(typeAccepte("feed", "text/xml"));
  assert(!typeAccepte("feed", "image/png")); assert(!typeAccepte("feed", "application/octet-stream"));
  assert(typeAccepte("page", "text/html")); assert(!typeAccepte("page", "application/pdf"));
  assert(typeAccepte("ics", "text/calendar")); assert(!typeAccepte("ics", "text/html"));
  assert(typeAccepte("page", null));
  assert(typeAccepte("json", "application/json; charset=utf-8")); assert(!typeAccepte("json", "text/html"));
});

Deno.test("encodage : en-tête, déclaration XML, balise meta, sinon UTF-8", () => {
  const b = (s: string) => new TextEncoder().encode(s);
  assertEquals(encodage("text/xml; charset=ISO-8859-1", b("")), "iso-8859-1");
  assertEquals(encodage("text/xml", b('<?xml version="1.0" encoding="windows-1252"?><rss/>')), "windows-1252");
  assertEquals(encodage("text/html", b('<html><head><meta charset="iso-8859-15">')), "iso-8859-15");
  assertEquals(encodage(null, b("<rss/>")), "utf-8");
  assertEquals(decoder(new Uint8Array([0x63, 0x61, 0x66, 0xe9]), "iso-8859-1"), "café");
  assertEquals(decoder(b("été"), "pas-un-encodage"), "été");
});

Deno.test("configuration : origines par défaut, comptes fermés par défaut", () => {
  assertEquals(origines(undefined), ["https://mariebonifacio.github.io"]);
  assertEquals(origines("https://a.org/, https://b.org"), ["https://a.org", "https://b.org"]);
  assertEquals(comptes(undefined).size, 0);
  assertEquals([...comptes(" 0B8F0C2E-1111-2222-3333-444455556666 ,pas-un-id")], ["0b8f0c2e-1111-2222-3333-444455556666"]);
});
