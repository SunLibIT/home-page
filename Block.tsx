/* ============================================================================
   SunLib CRM — PAGE D'ACCUEIL · Bloc in-page vibe code (Softr ↔ Airtable)
   ----------------------------------------------------------------------------
   Conforme à :
   · 🎨 Charte UI/UX & Couleurs — IT (Notion 382b09d7…)
   · 🎨 Bloc In-Page Vibe Code — gabarit refonte CRM (Notion 3a3b09d7…)

   Layout : héro (dégradé SunLib + logo rond animé) → ONGLETS DE NAVIGATION (souligné
   teal, sticky au scroll) → contenu de l'onglet actif.
   Deux onglets : « Accueil » = raccourcis vers les pages de l'espace + TABLEAU DE BORD
   (widgets indépendants et compacts, scrollables individuellement, dont les deux feeds
   LinkedIn) ; « Outils » = une grille de boutons qui ouvre chaque outil IN PAGE (le
   départ en nouvel onglet reste prévu pour une app non iframable, cf. `OUTILS`).

   Les données métier passent par un CACHE D'INSTANTANÉS (§6-ter) : au retour sur la page,
   les widgets affichent les lignes de la dernière lecture complète pendant que la relecture
   tourne, et le chip du héro dit d'où viennent les chiffres et les rafraîchit.

   Primitives (T, StyleInjector, Badge, TabBar, cartes) copiées du kit visuel
   de référence (partenaire-detail-inpage / abo-detail-inpage) — NE PAS les
   réécrire. Écarts documentés inline :
   · PageNavBar sticky ; TABBAR interne non sticky (plusieurs sections)
   · statusVariant : + « incomplet » dans les statuts d'attente (statuts homepage)
   · TabBar : pastille compteur (charte §2) + variante dense pour les widgets
   · PageNavBar : même visuel que la TabBar mais en liens <a target=_top>
     pour naviguer entre les pages Softr (le bloc vit dans une iframe)

   LIVRABLE UNIQUE : copier-coller le contenu de CE fichier dans le bloc vibe
   coding de Softr. Rien d'autre ne part (ni src/, ni package.json).

   Imports autorisés (fournis nativement par Softr) UNIQUEMENT :
     react · lucide-react · @/components/ui/card · @/lib/datasource · @/lib/user

   ────────────────────────────────────────────────────────────────────────────
   BRANCHEMENT — ce qui reste [À COMPLÉTER] :
     A) datasource.define        → §6 : ✅ COMPLET depuis le 2026-08-05, les 9 sources
                                  sont connectées et `CATALOG` ne porte plus aucun
                                  `connected: false`.
                                  ⚠️ `notifC` est câblée sur les formules INVERSÉES de
                                  la table (case cochée = « non lue ») : si la base est
                                  corrigée, inverser aussi ici (cf. SELECT_NOTIF_C).
     B) TOUTES LES ADRESSES      → §0-bis : un seul registre `PAGES` / `TOOLS`. ✅ plus
                                  aucune adresse manquante (8 pages de l'espace,
                                  1 outil externe, 5 apps embarquables)
     C) LinkedInSection          → embed LinkedIn existant : ✅ intégré (Elfsight)
     D) Paramètre d'URL des pages de détail → `PAGE_RECORD_PARAM` (§0-bis) : reste à
                                  CONFIRMER que Softr attend bien « recordId »
     E) ⚠️ À FAIRE DANS SOFTR (2026-08-06) → la datasource `notifC` doit EXPOSER cinq
                                  champs de plus, sinon le bloc échoue au chargement
                                  (« New data source does not match / Remap the fields ») :
                                    · Notification
                                    · Nom (from Liens BDD)
                                    · Installateur (from Liens BDD)
                                    · Statut Dossiers (from Liens BDD)
                                    · Proprietaire (from Installateur ) (from Liens BDD)
                                  Onglet Sources du bloc → « Notification Center » → cocher
                                  ces champs. Les champs exposés se choisissent À LA
                                  CONNEXION, pas d'après la table (leçon du 2026-08-04).
   ⚠️ USE_MOCK est passé à FALSE le 2026-08-04 : le bloc lit Airtable en direct.
   ============================================================================ */

import {
  Children,
  Fragment,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
  type FC,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  UserPlus, Handshake, BookUser, Users, Library, BarChart3, Trash2,
  FileSignature, Calculator, LayoutGrid, Briefcase, Ticket, Mail, Pencil, Bold, Italic, Strikethrough, List,
  ChevronRight, Bell,
  Check, CheckCircle, Clock, XCircle, ClipboardList, Building2,
  Inbox, CalendarClock, HardHat, Target, MoreVertical, Plus, Eye, EyeOff, Home,
  SlidersHorizontal, GripVertical, ChevronUp, ChevronDown, RotateCcw,
  Save, X, Newspaper, Megaphone, Sparkles, Trophy, RefreshCw,
  // ⚠️ `Filter` est renommé : le fichier a déjà un TYPE `Filter` (§9-bis, les filtres
  //    d'une cfg). Importer l'icône sous son nom d'origine masquerait le type.
  Wrench, ExternalLink, Search, Filter as FilterIcon,
  // ⚠️ `Map` est renommée : le nom `Map` est celui du constructeur natif JS, utilisé
  //    ailleurs dans le fichier. L'importer tel quel le masquerait dans tout le module.
  Map as MapIcon, Boxes,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { datasource, q, useRecords, useRecordUpdate, useRecordCreate } from "@/lib/datasource";
import { useCurrentUser } from "@/lib/user";

/* ============================================================================
   0. FLAG DE BRANCHEMENT
   ----------------------------------------------------------------------------
   USE_MOCK = true  → aperçu sur les données mock du prototype (aucune datasource
                      requise). USE_MOCK = false → lecture Airtable via useRecords.
   C'est le SEUL interrupteur mock ↔ live, mais il n'est PAS le seul niveau : une
   source dont le descripteur porte `connected: false` sert son mock même ici en
   `false` (cf. `offlineState`) — c'est ce qui permet de brancher les tables une par
   une sans jamais appeler `useRecords` sur un id absent du `define`.

   ⚠️ Passé à FALSE le 2026-08-04, les 6 datasources de §6 étant connectées et leurs
   noms de champs revérifiés contre Airtable. Le repli est immédiat : remettre `true`
   fait retomber tout le bloc sur ses mocks, sans autre changement.
   ============================================================================ */
const USE_MOCK: boolean = false;

/* ============================================================================
   0-bis. ADRESSES — LE SEUL ENDROIT OÙ VIT UNE URL
   ----------------------------------------------------------------------------
   Toutes les cibles de navigation du bloc sont ici : pages de l'espace Softr
   (`PAGES`) et outils externes (`TOOLS`). Une adresse qui change se change ICI, une
   fois, et tous les liens suivent — plus de chasse à l'URL au milieu de 5 000 lignes.

   ── Pourquoi des SLUGS et non des URLs complètes ──
   Un lien vers une page de l'espace ne peut pas être relatif : `href="/sav"` serait
   résolu contre le document courant, c'est-à-dire l'IFRAME du bloc, et non contre
   l'app. Il faut donc une URL absolue, donc l'origine de la page PARENTE — et
   `window.parent.location` est bloqué dès que l'iframe est d'une autre origine.
   `topOrigin()` la déduit à l'exécution, avec trois sources dans cet ordre :
     1. `ancestorOrigins` — l'information exacte, mais absente de Firefox ;
     2. `document.referrer` — la page qui a chargé l'iframe (présent en pratique) ;
     3. un repli codé en dur, pour ne jamais fabriquer un lien vide.
   C'est ce qui fait fonctionner les mêmes liens EN APERÇU ET EN PRODUCTION sans
   condition : l'origine est LUE, jamais devinée. Un passage à un domaine
   personnalisé ne demanderait rien à changer ici (seul le repli mériterait une
   retouche). En aperçu local (`npm run dev`), on retombe sur localhost — normal, la
   page cible n'y existe pas.

   ⚠️ Ne JAMAIS écrire une origine en dur dans un slug (« https://…/sav ») : ce serait
   exactement l'erreur que `topOrigin()` existe pour éviter.
   ⚠️ Une entrée VIDE ("") est un choix explicite : « adresse pas encore connue ».
   `pageUrl` renvoie alors "" et l'appelant rend un lien INERTE plutôt qu'un lien mort.

   Ce que ce bloc NE couvre PAS, pour ne pas le chercher ici : les images de la charte
   (constante `IMG`, §1) et l'URL du runtime des embeds, qui vit dans le document servi à
   leur iframe (`elfsightDoc`, §9-sexies — son unique endroit).
   Ce ne sont pas des cibles de navigation mais des ressources techniques, chacune
   déjà unique en son endroit.
   ============================================================================ */
const SOFTR_ORIGIN_FALLBACK = "https://sunlibcrm2.softr.app";

/** Slugs des pages de l'espace, sans slash initial. Relevés le 2026-08-04. */
const PAGES = {
  /* Pages CONFIRMÉES (fournies le 2026-08-04, valables en aperçu comme en prod). */
  abonne: "abonn-s-details-3",           // FICHE d'un abonné → attend un recordId
  /* FICHE d'un installateur → attend un recordId. DÉCLARÉE MAIS PAS ENCORE UTILISÉE :
     les widgets de notes affichent le NOM de l'installateur, pas son record id (le
     champ lien « Installateurs » n'est pas dans SELECT_NOTE_INS). L'ajouter au select
     suffirait à offrir un lien « Voir la fiche » sur chaque note. */
  installateur: "installateurs-details",
  sav: "sav",                            // Pilotage SAV
  kpi: "dashboard-kpi",                  // Tableau de bord KPI

  /* LISTES (fournies le 2026-08-04). ⚠️ Les noms de slug ne suivent pas le
     vocabulaire du CRM : « partenaires » vit sur /clients-list et « prospects » sur
     /tous-les-prospects. C'est la raison d'être de ce registre — le code parle métier
     (`PAGES.partenaires`), l'espace Softr garde ses adresses historiques. */
  abonnes: "abonn-s",                    // LISTE des abonnés (≠ `abonne`, qui est la fiche)
  partenaires: "clients-list",
  prospects: "tous-les-prospects",
  contactPartenaire: "contact-partenaire",
} as const;

/** Nom du paramètre d'URL qui porte l'enregistrement ciblé sur une page de détail.
 *  ⚠️ `recordId` est la convention Softr la plus courante, PAS une certitude : à
 *  confirmer en ouvrant une fiche depuis l'app et en lisant son URL. */
const PAGE_RECORD_PARAM = "recordId";

/** Outils externes. Même règle : "" = adresse inconnue → tuile inerte. */
const TOOLS = {
  /* Calculette d'abonnement (fournie le 2026-08-04). App Vercel PUBLIQUE, donc
     EMBARQUÉE depuis le 2026-08-05 : elle s'ouvre in-page dans l'onglet « Outils ».
     ⚠️ ADRESSE CHANGÉE LE 2026-08-18 : `sunlib-simulation-economique.vercel.app` →
     `calculette-abonnement.vercel.app` (nouveau déploiement). L'ancienne peut encore
     répondre : si la tuile affiche une version périmée, c'est qu'un cache la sert. */
  calculette: "https://calculette-abonnement.vercel.app/",
  /* Plus d'entrée « Sellsy » : la tuile « Services Sellsy » a été RETIRÉE des Outils le
     2026-08-04 (demande explicite). La remettre = une entrée ici + une dans
     QUICK_LINKS (§7) ; l'icône `Briefcase` est toujours importée, elle sert à la map
     ICONS. */
  /* Plus d'entrées « You Sign » ni « Tik&Lib » : les deux tuiles ont été RETIRÉES des
     Outils le 2026-08-18 (demande explicite), et leurs adresses avec elles. Pour
     mémoire si l'une revenait : Tik&Lib (`ticketing2-six.vercel.app`) était une app
     Vercel PUBLIQUE donc embarquable (`embed`) ; You Sign non — app à login derrière
     Auth0, qui refuse l'iframing (X-Frame-Options / CSP frame-ancestors) et n'aurait
     rendu qu'un cadre blanc, d'où son `url` en nouvel onglet vers la RACINE
     `yousign.app`. Et ne jamais recoller pour elle l'URL copiée en cours de session
     (`auth.yousign.app/u/login/identifier?state=…&tid=…&cid=…`) : ces paramètres
     expirent, là où la racine redirige d'elle-même vers l'écran de connexion sans
     périmer. */
  /* Les autres apps Vercel PUBLIQUES embarquées en iframe (§7). Toutes les entrées de
     ce registre sont désormais des sources d'iframe et non des liens : c'est `OUTILS`
     (§7) qui tranche, via `embed` ou `url`.
     ⚠️ On ne navigue JAMAIS l'iframe DU BLOC lui-même, qui ferait disparaître le CRM
     autour : un outil s'affiche dans SA propre iframe, ou dans un nouvel onglet. */
  formulaireContact: "https://formulairedecontact.vercel.app/",
  /* ⚠️ `simulateurGrille` reste ici alors que sa tuile est MASQUÉE (`hidden` dans
     `OUTILS`, §7) : l'adresse est bonne, c'est l'affichage qui est suspendu. Ne pas la
     supprimer — la rendre visible se fait en retirant le `hidden`, pas en recollant
     une URL. */
  simulateurGrille: "https://simulateur-grille-v2.vercel.app/",
  bibliotheque: "https://documentation-interne.vercel.app/",
  /* Carte des installateurs et ERP (fournis le 2026-08-18). Apps Vercel PUBLIQUES,
     donc EMBARQUÉES comme les autres. */
  carteInstallateurs: "https://sunlib-carte-installateurs.vercel.app/",
  erp: "https://erp-sunlib.vercel.app/",
} as const;

function topOrigin(): string {
  if (typeof window === "undefined") return SOFTR_ORIGIN_FALLBACK;
  try {
    if (window.parent === window) return window.location.origin;   // hors iframe
    const anc = (window.location as unknown as { ancestorOrigins?: DOMStringList }).ancestorOrigins;
    if (anc && anc.length) return anc[anc.length - 1];             // le plus haut ancêtre
    if (document.referrer) return new URL(document.referrer).origin;
  } catch { /* origine illisible : on tombe sur le repli */ }
  return SOFTR_ORIGIN_FALLBACK;
}

/** URL absolue d'une page de l'espace. Slug vide → "" (lien à rendre inerte).
 *  ⚠️ Appelée AU RENDU et non à l'évaluation du module : `topOrigin()` lit le DOM,
 *  et une URL figée au chargement se tromperait si le bloc était monté autrement. */
function pageUrl(slug: string, params?: Record<string, string>): string {
  if (!slug) return "";
  const base = `${topOrigin()}/${slug.replace(/^\/+/, "")}`;
  const query = new URLSearchParams(params ?? {}).toString();
  return query ? `${base}?${query}` : base;
}

/* Assets officiels — dépôt SunLibIT/Documents-PNG (charte, §Dépôt images)
   `logoRond` n'est plus affiché : le héro utilise <Sunburst>, le même motif
   reconstruit en SVG inline pour pouvoir l'animer rayon par rayon. Conservé
   comme référence de charte et comme retour arrière d'un geste. */
const IMG = {
  logoRond: "https://raw.githubusercontent.com/SunLibIT/Documents-PNG/main/logo_Blanc_rond.svg",
};

/* ============================================================================
   1. DESIGN TOKENS `T` + constantes de style — kit visuel de référence
   ============================================================================ */
/* ⚠️ `canvas` est BLANC depuis le 2026-08-06, et c'est un ÉCART ASSUMÉ à la charte
   (qui prescrit #F3F6F7, un gris bleuté destiné à faire ressortir les cartes) —
   demandé à l'écran : « le fond n'est pas blanc alors qu'il est censé l'être ».
   Conséquence à connaître avant de retoucher les cartes : sur fond blanc, une carte
   blanche ne se distingue plus que par sa BORDURE (`T.line`) et son ombre `shSm`. Ne
   pas les supprimer en croyant alléger le rendu — elles portent seules la séparation.
   Un seul token à remettre à "#F3F6F7" pour revenir en arrière : les barres d'onglets
   sticky (`TABBAR`, `PageNavBar`) le lisent aussi, donc elles suivront. */
const T = {
  canvas: "#FFFFFF", surface: "#FFFFFF", surface2: "#F8FAFB",
  line: "#EAEEF0", line2: "#E0E6E9",
  ink: "#101A28", ink2: "#465264", ink3: "#6A7686", ink4: "#9AA5B2",
  brand: "#0E9384", brand600: "#0B7A6E", brand700: "#0A5F56", brand050: "#EBF8F6", brand100: "#CFEEEA",
  solar: "#F59E0B", solar600: "#D97706", solar050: "#FEF5E6", solar100: "#FCE9C4",
  ok: "#12A150", ok050: "#E8F7EF", okInk: "#0D7A3C",
  warn: "#D97706", warn050: "#FCF1E1", warnInk: "#A15C05",
  info: "#3B7DF6", info050: "#ECF2FE", infoInk: "#2B5FD0",
  danger: "#DC2626", danger050: "#FEF2F2", dangerInk: "#B91C1C",
  neutral050: "#F1F4F7",
  shSm: "0 1px 2px rgba(16,26,40,.05), 0 1px 3px rgba(16,26,40,.05)",
  shMd: "0 6px 16px -6px rgba(16,26,40,.14), 0 2px 6px -2px rgba(16,26,40,.08)",
  rXl: "18px", rLg: "15px", rMd: "11px", rSm: "8px",
  font: "'Plus Jakarta Sans', system-ui, sans-serif",
};

const DASH = "—";

// Cartes — neutralise les défauts shadcn du Card Softr (display:block + padding:0)
const CARD: CSSProperties = { backgroundColor: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rXl, boxShadow: T.shSm, display: "block", padding: 0 };

// Onglets — souligné coulissant teal (PAS de pilule pleine !)
// Écart gabarit documenté : position "static" (barre interne non sticky)
const TABBAR: CSSProperties = { position: "static", zIndex: 20, backgroundColor: T.canvas, marginBottom: "20px" };
const TABS_ROW: CSSProperties = { display: "flex", gap: "4px", overflowX: "auto", scrollbarWidth: "none", position: "relative", borderBottom: `1.5px solid ${T.line}` };
const TAB: CSSProperties = { display: "inline-flex", alignItems: "center", gap: "7px", whiteSpace: "nowrap", padding: "13px 12px", fontSize: "13.5px", fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", transition: "color .16s" };

const NBTN: CSSProperties = { display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: T.rSm, color: T.ink4, background: "none", border: "none", cursor: "pointer", flex: "none", fontFamily: "inherit" };

// Pastille icône d'en-tête de carte (teal, ou ambre si solar)
const icoPill = (solar?: boolean): CSSProperties => ({ width: 36, height: 36, borderRadius: "10px", flex: "none", display: "grid", placeItems: "center", backgroundColor: solar ? T.solar050 : T.brand050, color: solar ? T.solar600 : T.brand600, boxShadow: `inset 0 0 0 1px ${solar ? T.solar100 : T.brand100}` });

// Ligne de liste (icône)
const LIST_ICO: CSSProperties = { width: 34, height: 34, borderRadius: "9px", flex: "none", display: "grid", placeItems: "center", color: T.ink2, backgroundColor: T.surface2, border: `1px solid ${T.line}` };
const LIST_K: CSSProperties = { fontSize: "11px", fontWeight: 600, color: T.ink4, textTransform: "uppercase", letterSpacing: ".05em" };

// Titre de section hors carte
const H2: CSSProperties = { fontSize: "16px", fontWeight: 700, letterSpacing: "-.01em", color: T.ink, margin: 0 };

// --- Widgets compacts du tableau de bord ---
const WHEAD: CSSProperties = { display: "flex", alignItems: "center", gap: "10px", padding: "13px 16px", borderBottom: `1px solid ${T.line}` };
const WTITLE: CSSProperties = { fontSize: "13.5px", fontWeight: 700, letterSpacing: "-.01em", color: T.ink };
const WSUB: CSSProperties = { fontSize: "11.5px", color: T.ink3, fontWeight: 500, marginTop: "1px" };
const icoPillSm = (solar?: boolean): CSSProperties => ({ ...icoPill(solar), width: 28, height: 28, borderRadius: "8px" });
const NBTN_SM: CSSProperties = { ...NBTN, width: 28, height: 28 };
// Troncature à 2 lignes — en objet inline (l'équivalent CSS `.slb-clamp2` peut ne
// pas s'appliquer dans le bloc Softr, cf. §2). Le cast couvre les propriétés
// préfixées -webkit- absentes du typage React.
const CLAMP2 = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as CSSProperties;

// Primitive du kit (pied de widget). Sans usage depuis le passage des widgets notes
// au type liste ; conservée telle quelle — les primitives ne se réécrivent pas.
const FOOT_LINK: CSSProperties = { background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: 700, color: T.brand700, padding: "2px 6px" };

/* ============================================================================
   2. StyleInjector — UNIQUEMENT du COSMÉTIQUE (focus, hover, scrollbars, keyframes)
   ----------------------------------------------------------------------------
   ⚠️ RÈGLE, apprise en collant le bloc dans Softr : cette feuille peut ne PAS
   s'appliquer (Softr style ses blocs avec Tailwind, rien ne garantit qu'une balise
   <style> injectée atteigne le bloc, ni que l'attribut id du conteneur survive).
   Symptômes observés quand elle ne s'applique pas : widgets collés sans gouttière,
   « pleine largeur » sans effet, corps de widget qui s'étire au lieu de scroller.

   Donc : **tout ce qui est FONCTIONNEL (mise en page, dimensions, débordement) vit
   en style inline** — grille et gouttières (§11), hauteur du corps scrollable
   (`ScrollBody`), troncature (`CLAMP2`), filets de séparation. Ici ne restent que
   des embellissements dont l'absence ne casse rien.

   Les sélecteurs de classe ne sont plus préfixés par `#slb` (ils ne matchaient plus
   si l'id disparaissait) : toutes nos classes portent déjà le préfixe `slb-`, donc
   aucun risque de fuite vers le reste de la page. Seules les deux règles vraiment
   génériques restent scopées à `#slb`.
   ============================================================================ */
function StyleInjector() {
  useEffect(() => {
    const id = "slb-styles";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
      #slb :focus-visible{ outline:2px solid ${T.brand}; outline-offset:2px; border-radius:6px; }
      .slb-tabs::-webkit-scrollbar{ display:none; }
      .slb-row{ transition:background .15s ease; }
      .slb-row + .slb-row{ border-top:1px solid ${T.line}; }
      /* La teinte d'un widget peut remplacer ce gris : la variable --slb-row-hover est
         publiée par la carte teintée (§8). Le gris reste le défaut, listes sans teinte.
         ⚠️ Pas de backtick dans ce commentaire : il vit DANS un template literal JS. */
      .slb-row:hover{ background:var(--slb-row-hover, ${T.surface2}); }
      .slb-tab:hover{ color:${T.ink}; }
      .slb-nbtn{ transition:background .15s ease, color .15s ease; }
      .slb-nbtn:hover{ background:${T.neutral050} !important; color:${T.ink2} !important; }
      @keyframes slb-fade{ from{opacity:0} to{opacity:1} }
      @keyframes slb-panel-fwd{ from{opacity:0; transform:translate3d(22px,0,0)} to{opacity:1; transform:none} }

      /* Boutons + tuiles */
      .slb-btng{ transition:border-color .15s ease, color .15s ease, background .15s ease; }
      .slb-btng:hover{ border-color:${T.brand100}; color:${T.brand700}; background:${T.brand050}; }
      .slb-tile{ transition:border-color .16s ease, box-shadow .16s ease, transform .16s ease; }
      .slb-tile:hover{ border-color:${T.brand100}; box-shadow:${T.shMd}; transform:translateY(-1px); }
      /* Micro-interaction flèche de la charte : glisse ~6px, ~0.5s */
      .slb-arrow{ transition:transform .5s ease, color .16s ease; }
      .slb-tile:hover .slb-arrow{ transform:translateX(6px); color:${T.brand600}; }
      .slb-clamp2{ display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
      /* Widgets : corps scrollable individuellement (scrollbar fine) */
      .slb-scrolly{ overflow-y:auto; max-height:var(--slb-wh, 340px); scrollbar-width:thin; scrollbar-color:${T.line2} transparent; }
      .slb-scrolly::-webkit-scrollbar{ width:6px; }
      .slb-scrolly::-webkit-scrollbar-thumb{ background:${T.line2}; border-radius:999px; }
      .slb-scrolly::-webkit-scrollbar-track{ background:transparent; }
      /* Actions de ligne révélées au survol et au focus clavier */
      .slb-hact{ opacity:0; transition:opacity .15s ease; }
      .slb-row:hover .slb-hact, .slb-row:focus-within .slb-hact{ opacity:1; }
      .slb-nbtn-ok:hover{ background:${T.ok050} !important; color:${T.okInk} !important; }

      /* Réglage des widgets : bouton primaire, items de menu ⋮, wrapper DnD */
      .slb-btnp{ transition:background .15s ease; }
      .slb-btnp:hover{ background:${T.brand600}; }
      .slb-menu-item{ transition:background .12s ease; }
      .slb-menu-item:hover:not(:disabled){ background:${T.surface2}; }
      .slb-menu-item:disabled{ opacity:.45; cursor:not-allowed; }
      .slb-dragwrap{ transition:opacity .15s ease, outline-color .15s ease; }
      /* ⚠️ La GRILLE du dashboard n'est plus décrite ici : display:grid, gap et le
         nombre de colonnes sont posés EN LIGNE par Dashboard (§11), qui mesure la
         largeur du bloc avec un ResizeObserver. Raison : dans le bloc Softr, cette
         feuille de style peut ne pas s'appliquer (cf. §2) — et sans display:grid,
         les widgets se collent et « pleine largeur » n'a plus aucun effet. Tout ce
         qui est FONCTIONNEL doit donc rester en style inline. */
      /* Poignées de réglage : .slb-rzh = largeur (bords G/D), .slb-rzv = hauteur (bas) */
      .slb-rzh > span{ transition:background .15s ease, height .15s ease; }
      .slb-rzh:hover > span, .slb-rzh:active > span{ background:${T.brand}; height:48px; }
      .slb-rzv > span{ transition:background .15s ease, width .15s ease; }
      .slb-rzv:hover > span, .slb-rzv:active > span{ background:${T.brand}; width:48px; }
      /* Le trait n'apparaît qu'au survol de SON bord (au repos il est à opacity:0 en
         ligne). Doublon volontaire de la règle HoverFX de §2-bis. */
      .slb-rzh > span, .slb-rzv > span{ transition:opacity .15s ease, background .15s ease, height .15s ease, width .15s ease; }
      .slb-rzh:hover > span, .slb-rzh:active > span, .slb-rzv:hover > span, .slb-rzv:active > span{ opacity:1; }
      /* SQUELETTES et BARRE DE CHARGEMENT : leur animation ne vit PAS ici, elle vit dans le
         moteur JS de §2-ter (MotionFX).
         Ce n'est pas un choix de style, c'est un constat : cette feuille peut ne pas
         s'appliquer dans le bloc Softr — exactement ce qui prive HoverFX (§2-bis) de tous ses
         survols — et le 2026-08-19 le symptôme a ete rapporte tel quel a l'ecran, les loaders
         ne bougeaient pas. Un indicateur d'attente figé ressemble à un écran gelé : il dit
         l'inverse de ce qu'on lui demande. La Web Animations API, elle, ne dépend d'aucune
         feuille.
         Une premiere version posait le reflet en ::after ici meme, pour ne pas toucher aux
         seize squelettes deja ecrits. Sans feuille, le pseudo-element n'existe pas : elle
         etait donc morte precisement dans le cas qu'elle devait couvrir.
         ⚠️ Ne pas « remettre les keyframes au cas où » POUR LE SQUELETTE : la feuille ne peut
         pas produire le meme effet (le fond inline l'emporte sur elle), et deux effets
         differents selon qu'elle s'applique ou non seraient pires qu'un seul. La barre et la
         rotation, elles, restent declarees ci-dessous : leurs valeurs sont IDENTIQUES des deux
         cotes, donc elles cohabitent sans se voir. */
      /* Rotation du chip de fraîcheur et de l'icône « relire » d'un widget.
         PORTÉE AUSSI PAR LE MOTEUR JS (§2-ter) depuis le 2026-08-19 : les deux posent la même
         rotation, donc aucun conflit visible. La feuille est le repli, le JS la garantie —
         c'est la regle etablie pour les survols (§2-bis). Sans le JS, feuille absente, l'icone
         restait fixe et c'etait le TEXTE du chip qui portait tout (« Actualisation... »). */
      @keyframes slb-spin{ to{ transform:rotate(360deg) } }
      .slb-spin{ animation:slb-spin 1s linear infinite; }
      /* BARRE DE CHARGEMENT d'un widget : un segment qui traverse le bas de l'en-tête tant que
         la source lit. Mêmes valeurs que la règle correspondante du moteur JS (§2-ter), qui est
         celle qui s'applique réellement dans le bloc Softr — ici, c'est le repli.
         La largeur du segment (38 %) et la distance parcourue (260 %) vont de pair :
         38 × 2,6 ≈ 100 %, donc il sort exactement par le bord droit. Changer l'une des deux
         valeurs sans l'autre, ou sans toucher a MOTION_RULES, les desaccorderait. */
      @keyframes slb-bar{ 0%{ transform:translateX(-100%) } 100%{ transform:translateX(260%) } }
      .slb-bar{ animation:slb-bar 1.15s ease-in-out infinite; }

      /* Podium CAPEX : la marche survolée se soulève, sa pastille et son numéro
         grossissent un peu. Purement DÉCORATIF, donc légitime en feuille de style —
         si elle ne s'applique pas dans le bloc Softr (cf. §2), le podium s'affiche
         exactement pareil, simplement sans mouvement.
         ⚠️ On n'anime que transform : marche et numéro portent leur box-shadow EN
         LIGNE, qui l'emporterait sur toute règle d'ici sans un !important. */
      .slb-pod{ transition:transform .18s cubic-bezier(.22,.61,.36,1); }
      .slb-pod:hover{ transform:translateY(-4px); }
      .slb-pod-av, .slb-pod-rk{ transition:transform .18s cubic-bezier(.22,.61,.36,1); }
      .slb-pod:hover .slb-pod-av{ transform:scale(1.07); }
      .slb-pod:hover .slb-pod-rk{ transform:scale(1.14); }

      @media (prefers-reduced-motion: reduce){ #slb *{ animation:none !important; transition:none !important; } }
    `;
    document.head.appendChild(el);
  }, []);
  return null;
}

/* ============================================================================
   2-bis. HoverFX — les effets de SURVOL, en JS et en style INLINE
   ----------------------------------------------------------------------------
   POURQUOI. Dans le bloc Softr, la feuille de §2 peut ne pas s'appliquer — et
   avec elle disparaissent d'un coup TOUS les `:hover` : tuiles Raccourcis et
   Outils, boutons, lignes de widget, podium. Symptôme rapporté à l'écran :
   « les animations de survol ne fonctionnent pas dans Softr ».

   Le remède suit les deux règles déjà établies du fichier : ce qui doit marcher
   vit en style INLINE (§2), et une animation nécessaire passe par le JS plutôt
   que par la feuille (comme le dégradé du héro et le sunburst, §12). Ici : UN
   SEUL écouteur délégué sur le conteneur du bloc traduit chaque survol en
   écritures `element.style` — du style inline posé via le CSSOM, qui ne dépend
   d'aucune feuille et l'emporte sur le Tailwind de Softr.

   MÉCANIQUE.
   · `HOVER_RULES` reprend, règle pour règle, les `:hover` de §2 : `self` = ce
     qui change sur l'élément survolé, `kids` = sur ses descendants (ce que
     faisait `.slb-tile:hover .slb-arrow`).
   · À chaque `mouseover` / `focusin`, on remonte la chaîne des ancêtres, on
     calcule l'ensemble des déclencheurs VOULUS et on ne touche qu'à la
     différence avec ceux déjà actifs — une tuile qui contient un bouton ne
     clignote donc pas quand la souris passe de l'une à l'autre.
   · L'ancienne valeur inline de chaque propriété est MÉMORISÉE à l'entrée et
     restaurée à la sortie. Jamais de `removeProperty` aveugle : il effacerait
     une valeur posée par React (p. ex. la couleur de repos de la flèche, ou le
     fond d'une tuile active) que React ne réécrirait pas sans re-rendu.
   · La `transition` est posée au premier contact et n'est plus retirée : c'est
     elle qui rend le mouvement progressif à l'aller ET au retour. Sous
     `prefers-reduced-motion: reduce` elle n'est jamais posée — les états
     basculent alors instantanément, ce qui est le comportement attendu (même
     garde que le FLIP et le pan du héro).
   · Le focus clavier passe par le même moteur (`focusin`), donc les lignes
     révèlent aussi leurs actions à la tabulation, et l'anneau `:focus-visible`
     est posé en ligne — §2 ne peut plus l'assurer non plus.

   ⚠️ INVARIANT : un élément ne doit matcher qu'UNE règle déclenchante (d'où le
   `:not(.slb-nbtn-ok)`). Deux règles sur le même élément mémoriseraient la même
   propriété et la restauration rendrait une valeur déjà écrasée.
   ⚠️ Propriétés en LONGHAND uniquement (`background-color`, jamais `background`) :
   sur un raccourci, `getPropertyValue` rend souvent "" et la sortie effacerait
   alors TOUS les longhands, dont celui posé par React.
   ⚠️ §2 garde les mêmes `:hover` : si la feuille s'applique, les deux posent les
   mêmes valeurs — aucun conflit visible. Ne pas « dédoublonner » l'un des deux ;
   la feuille sert de repli, le JS de garantie.
   ============================================================================ */
type HoverStyles = Record<string, string>;
type HoverRule = {
  sel: string;                                            // déclencheur (survol ou focus)
  trans?: string;                                         // transition posée sur le déclencheur
  self?: HoverStyles;                                     // ce qui change sur le déclencheur
  kids?: { sel: string; trans?: string; on: HoverStyles }[]; // … et sur ses descendants
};

const HOVER_RULES: HoverRule[] = [
  // Ligne de widget : fond au survol, et les actions de ligne apparaissent. `.slb-hact`
  // porte `opacity:0` EN LIGNE (sans quoi, feuille absente, elle serait toujours visible).
  /* `var(--slb-row-hover, …)` et non la couleur en dur : une carte teintée publie sa propre
     nuance (§8), et une valeur figée ici ramènerait du gris au milieu d'un widget coloré.
     Le repli du `var()` garde le comportement d'origine partout ailleurs. */
  { sel: ".slb-row", trans: "background-color .15s ease", self: { "background-color": `var(--slb-row-hover, ${T.surface2})` },
    kids: [{ sel: ".slb-hact", trans: "opacity .15s ease", on: { opacity: "1" } }] },
  { sel: ".slb-tab", trans: "color .16s ease", self: { color: T.ink } },
  { sel: ".slb-nbtn:not(.slb-nbtn-ok)", trans: "background-color .15s ease, color .15s ease",
    self: { "background-color": T.neutral050, color: T.ink2 } },
  { sel: ".slb-nbtn-ok", trans: "background-color .15s ease, color .15s ease",
    self: { "background-color": T.ok050, color: T.okInk } },
  { sel: ".slb-btng:not(:disabled)", trans: "border-color .15s ease, color .15s ease, background-color .15s ease",
    self: { "border-color": T.brand100, color: T.brand700, "background-color": T.brand050 } },
  // Tuiles (Raccourcis, Outils) : la tuile se soulève, sa flèche glisse de ~6 px — la
  // micro-interaction de la charte, c'est-à-dire précisément ce que l'écran ne montrait plus.
  { sel: ".slb-tile:not(:disabled)", trans: "border-color .16s ease, box-shadow .16s ease, transform .16s ease",
    self: { "border-color": T.brand100, "box-shadow": T.shMd, transform: "translateY(-1px)" },
    kids: [{ sel: ".slb-arrow", trans: "transform .5s ease, color .16s ease", on: { transform: "translateX(6px)", color: T.brand600 } }] },
  { sel: ".slb-btnp:not(:disabled)", trans: "background-color .15s ease", self: { "background-color": T.brand600 } },
  { sel: ".slb-menu-item:not(:disabled)", trans: "background-color .12s ease", self: { "background-color": T.surface2 } },
  /* Poignées de redimensionnement — RÉVÉLÉES PAR LEUR PROPRE BORD, et par lui seul.
     Le trait apparaît, s'allonge et prend la couleur de marque quand la souris entre dans
     SA bande ; les deux autres poignées de la même carte restent invisibles.
     C'est le comportement d'un bord de fenêtre : on ne montre pas les quatre côtés parce
     que le pointeur est entré dans la fenêtre. Le `cursor` de la bande (`ew-resize` /
     `ns-resize`) est ce qui annonce le geste AVANT même que le trait ne se montre.
     ⚠️ Au repos, le trait est à `opacity: 0` EN LIGNE (§11) : sans cette règle il
     resterait invisible pour toujours. */
  { sel: ".slb-rzh", kids: [{ sel: ":scope > span", trans: "opacity .15s ease, background-color .15s ease, height .15s ease", on: { opacity: "1", "background-color": T.brand, height: "48px" } }] },
  { sel: ".slb-rzv", kids: [{ sel: ":scope > span", trans: "opacity .15s ease, background-color .15s ease, width .15s ease", on: { opacity: "1", "background-color": T.brand, width: "48px" } }] },
  // Podium CAPEX : la marche survolée se soulève, pastille et numéro grossissent. On
  // n'anime que `transform` — leur `box-shadow` est en ligne (cf. §2).
  { sel: ".slb-pod", trans: "transform .18s cubic-bezier(.22,.61,.36,1)", self: { transform: "translateY(-4px)" },
    kids: [
      { sel: ".slb-pod-av", trans: "transform .18s cubic-bezier(.22,.61,.36,1)", on: { transform: "scale(1.07)" } },
      { sel: ".slb-pod-rk", trans: "transform .18s cubic-bezier(.22,.61,.36,1)", on: { transform: "scale(1.14)" } },
    ] },
];

// Anneau de focus clavier — l'équivalent en ligne de `#slb :focus-visible` (§2).
const FOCUS_RING: HoverStyles = { outline: `2px solid ${T.brand}`, "outline-offset": "2px", "border-radius": "6px" };

function useHoverFX(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // Même garde que les autres animations du bloc : sous « réduire les animations »,
    // les états changent, mais sans transition.
    const motion = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    type Entry = { saved: Map<HTMLElement, HoverStyles> };
    const active = new Map<HTMLElement, Entry>();          // déclencheur → valeurs à rendre
    let hoverNode: Element | null = null;
    let focusNode: Element | null = null;

    /** Pose des propriétés en mémorisant CE QU'ELLES VALAIENT en ligne. */
    const put = (el: HTMLElement, on: HoverStyles, saved: Map<HTMLElement, HoverStyles>, trans?: string) => {
      if (motion && trans) el.style.setProperty("transition", trans);
      const prev: HoverStyles = { ...(saved.get(el) ?? {}) };
      for (const p of Object.keys(on)) {
        if (!(p in prev)) prev[p] = el.style.getPropertyValue(p);
        el.style.setProperty(p, on[p]);
      }
      saved.set(el, prev);
    };
    const restore = (saved: Map<HTMLElement, HoverStyles>) => {
      saved.forEach((prev, el) => {
        for (const p of Object.keys(prev)) {
          const v = prev[p];
          if (v) el.style.setProperty(p, v); else el.style.removeProperty(p);
        }
      });
    };

    const enter = (el: HTMLElement, rule: HoverRule) => {
      const saved = new Map<HTMLElement, HoverStyles>();
      if (rule.self) put(el, rule.self, saved, rule.trans);
      else if (motion && rule.trans) el.style.setProperty("transition", rule.trans);
      rule.kids?.forEach((k) => el.querySelectorAll<HTMLElement>(k.sel).forEach((n) => put(n, k.on, saved, k.trans)));
      active.set(el, { saved });
    };
    const leave = (el: HTMLElement) => {
      const e = active.get(el);
      if (!e) return;
      active.delete(el);
      restore(e.saved);
    };

    /** Déclencheurs sous un nœud : lui-même puis ses ancêtres, jusqu'au conteneur. */
    const chain = (node: Element | null, out: Map<HTMLElement, HoverRule>) => {
      let n: Element | null = node;
      while (n && root.contains(n)) {
        const el = n as HTMLElement;
        // `break` = l'invariant « une seule règle par élément », vérifié à la lecture.
        for (const rule of HOVER_RULES) { if (el.matches?.(rule.sel)) { out.set(el, rule); break; } }
        n = el.parentElement;
      }
    };

    const sync = () => {
      const want = new Map<HTMLElement, HoverRule>();
      chain(hoverNode, want);
      chain(focusNode, want);
      // Copie des clés : `leave` mute la map qu'on parcourt.
      for (const el of [...active.keys()]) if (!want.has(el) || !el.isConnected) leave(el);
      want.forEach((rule, el) => { if (!active.has(el)) enter(el, rule); });
    };

    // Anneau de focus : un seul élément à la fois, propriétés disjointes des règles
    // ci-dessus — il vit donc à côté de `active`, sans risque de collision.
    let ring: { el: HTMLElement; saved: Map<HTMLElement, HoverStyles> } | null = null;
    const dropRing = () => { if (ring) { restore(ring.saved); ring = null; } };

    const onOver = (e: Event) => { hoverNode = e.target as Element; sync(); };
    const onOut = (e: Event) => {
      const rel = (e as MouseEvent).relatedTarget as Element | null;
      hoverNode = rel && root.contains(rel) ? rel : null;
      sync();
    };
    const onFocusIn = (e: Event) => {
      focusNode = e.target as Element;
      dropRing();
      const el = e.target as HTMLElement;
      // `:focus-visible` n'existe pas partout ; sans lui, pas d'anneau — jamais d'erreur.
      try {
        if (el.matches?.(":focus-visible")) {
          const saved = new Map<HTMLElement, HoverStyles>();
          put(el, FOCUS_RING, saved);
          ring = { el, saved };
        }
      } catch { /* pseudo-classe non supportée */ }
      sync();
    };
    const onFocusOut = () => { focusNode = null; dropRing(); sync(); };

    root.addEventListener("mouseover", onOver);
    root.addEventListener("mouseout", onOut);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    return () => {
      root.removeEventListener("mouseover", onOver);
      root.removeEventListener("mouseout", onOut);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      for (const el of [...active.keys()]) leave(el);
      dropRing();
    };
  }, [rootRef]);
}

/* ============================================================================
   2-ter. MotionFX — les ANIMATIONS D'ATTENTE, en JS (Web Animations API)
   ----------------------------------------------------------------------------
   POURQUOI, et c'est mot pour mot la raison d'HoverFX (§2-bis) : dans le bloc Softr,
   la feuille de §2 peut ne pas s'appliquer, et avec elle disparaissent TOUTES les
   `@keyframes`. Symptôme rapporté à l'écran le 2026-08-19 : « les loaders ne bougent
   pas sur les widgets ». Les squelettes s'affichaient, la barre de chargement aussi —
   immobiles.

   Et un indicateur d'attente FIGÉ est pire que pas d'indicateur : une forme grise qui
   ne bouge pas ressemble à un écran gelé, c'est-à-dire à une panne. C'est l'inverse
   exact de ce qu'on lui demande de dire.

   Le remède suit la règle déjà établie du fichier : une animation NÉCESSAIRE passe par
   le JS, comme le dégradé du héro et le sunburst (§12). `element.animate()` ne dépend
   d'aucune feuille de style et l'emporte sur les animations CSS.

   MÉCANIQUE. Un `MutationObserver` sur le conteneur du bloc : au montage et à chaque
   nœud ajouté, les éléments porteurs d'une classe d'animation reçoivent leur
   `Animation`. Un `WeakSet` évite de les animer deux fois — un squelette est monté puis
   démonté des dizaines de fois par visite.

   ⚠️ UN SQUELETTE NE PEUT PAS ÊTRE ANIMÉ PAR UN PSEUDO-ÉLÉMENT. La première version
   posait le reflet en `::after` dans la feuille, justement pour ne pas toucher aux seize
   squelettes déjà écrits — mais sans feuille, le pseudo-élément n'existe pas du tout.
   On anime donc leur PROPRE fond : le moteur pose un dégradé en style inline, ce que la
   feuille ne pourrait pas faire (le `background` inline de chaque squelette l'emporte
   sur elle), et déplace sa `background-position`.
   ⚠️ `prefers-reduced-motion: reduce` : rien n'est lancé, et les formes restent
   visibles. Même garde que le FLIP, le pan du héro et HoverFX.
   ⚠️ Les classes restent DÉCLARÉES dans la feuille (§2) pour `slb-spin` : les deux
   posent la même rotation, donc aucun conflit visible — la feuille sert de repli, le JS
   de garantie. Pour le squelette et la barre, la feuille ne porte plus rien : elle ne
   pouvait pas produire le même effet, et deux effets différents selon le contexte
   seraient pires qu'un seul.
   ============================================================================ */
type MotionRule = {
  sel: string;
  /** Styles inline posés AVANT l'animation (le dégradé d'un squelette). En longhand, pour la
   *  même raison qu'HoverFX : un raccourci effacerait ce que React a posé. */
  prep?: Record<string, string>;
  frames: Keyframe[];
  duree: number;
  easing?: string;
};

const MOTION_RULES: MotionRule[] = [
  /* SQUELETTE — un reflet qui traverse la forme. `background-size: 220%` laisse la bande
     claire entrer et sortir du cadre ; c'est `background-position` qui la déplace, de la
     droite vers la gauche. Le dégradé part et revient à `neutral050`, la couleur que les
     seize squelettes du fichier posent en ligne : le reflet passe donc sans que la forme
     change de teinte. */
  {
    sel: ".slb-skel",
    prep: {
      "background-image": `linear-gradient(90deg, ${T.neutral050} 0%, #FFFFFF 48%, ${T.neutral050} 96%)`,
      "background-size": "220% 100%",
      "background-repeat": "no-repeat",
    },
    frames: [{ backgroundPosition: "160% 0" }, { backgroundPosition: "-60% 0" }],
    duree: 1350,
    easing: "ease-in-out",
  },
  /* BARRE DE CHARGEMENT de l'en-tête d'un widget (§8). Le segment fait 38 % de large et
     parcourt 260 % : 38 × 2,6 ≈ 100 %, donc il sort exactement par le bord droit. */
  {
    sel: ".slb-bar",
    frames: [{ transform: "translateX(-100%)" }, { transform: "translateX(260%)" }],
    duree: 1150,
    easing: "ease-in-out",
  },
  /* ROTATION de l'icône « relire » pendant une lecture. Portée aussi par la feuille
     (`slb-spin`), et c'est volontaire : même rotation des deux côtés. */
  {
    sel: ".slb-spin",
    frames: [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
    duree: 1000,
    easing: "linear",
  },
];

const MOTION_SEL = MOTION_RULES.map((r) => r.sel).join(",");

function useMotionFX(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    /* `animate` manque sur les moteurs très anciens : on ne fait alors RIEN plutôt que de
       casser le rendu — les squelettes restent des formes grises, comme avant ce moteur. */
    if (typeof Element === "undefined" || !Element.prototype.animate) return;

    const vus = new WeakSet<Element>();
    const anime = (el: Element) => {
      if (vus.has(el)) return;
      for (const r of MOTION_RULES) {
        if (!el.matches(r.sel)) continue;
        vus.add(el);
        if (r.prep && el instanceof HTMLElement) {
          for (const [k, v] of Object.entries(r.prep)) el.style.setProperty(k, v);
        }
        try {
          el.animate(r.frames, { duration: r.duree, iterations: Infinity, easing: r.easing });
        } catch { /* frames refusées par ce moteur : la forme reste, sans mouvement */ }
        return;                                   // une règle par élément, comme HoverFX
      }
    };
    /* Le nœud ajouté PEUT être le squelette lui-même (`anime`) ou le contenir
       (`querySelectorAll`) : un widget entier arrive d'un coup, squelettes inclus. */
    const balayer = (n: Node) => {
      if (!(n instanceof Element)) return;
      anime(n);
      n.querySelectorAll(MOTION_SEL).forEach(anime);
    };

    balayer(root);
    const obs = new MutationObserver((muts) => {
      for (const m of muts) m.addedNodes.forEach(balayer);
    });
    obs.observe(root, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [rootRef]);
}

/* ============================================================================
   3. Badge + statusVariant (statut métier → variant)
   ============================================================================ */
type BadgeVariant = "brand" | "neutral" | "ok" | "warn" | "info" | "solar" | "danger";

function statusVariant(value: string): BadgeVariant {
  const l = value.toLowerCase();
  if (/(non conforme|annul|refus|rejet|erreur|échec|echec|blocage|panne)/.test(l)) return "danger";
  // + « incomplet » : statuts dossier de la homepage (action requise → ambre)
  if (/(contrôler|controler|attente|en cours|traitement|alerte|incomplet)/.test(l)) return "warn";
  if (/(ok|conforme|valid|signé|signe|payé|paye|terminé|termine|complet|actif)/.test(l)) return "ok";
  return "neutral";
}

function Badge({
  variant = "neutral",
  icon: Icon,
  dot,
  children,
}: {
  variant?: BadgeVariant;
  icon?: LucideIcon;
  dot?: boolean;
  children?: ReactNode;
}) {
  const V: Record<BadgeVariant, { bg: string; fg: string }> = {
    brand: { bg: T.brand050, fg: T.brand700 },
    neutral: { bg: T.neutral050, fg: T.ink2 },
    ok: { bg: T.ok050, fg: T.okInk },
    warn: { bg: T.warn050, fg: T.warnInk },
    info: { bg: T.info050, fg: T.infoInk },
    solar: { bg: T.solar050, fg: T.solar600 },
    danger: { bg: T.danger050, fg: T.dangerInk },
  };
  const c = V[variant] || V.neutral;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap", backgroundColor: c.bg, color: c.fg }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "currentColor" }} />}
      {Icon && <Icon style={{ width: 13, height: 13 }} />}
      {children}
    </span>
  );
}

// Statut métier → badge coloré + icône (double codage couleur + icône, a11y)
/* Statut d'EXCEPTION — dédiée, et c'est un piège payé par le bloc `dashboard-KPI` :
   `statusVariant` matche `/actif/`, donc « Inactif » (l'une des quatre options réelles du
   champ « Statut » de la table « Partenaire ») ressortirait EN VERT, c'est-à-dire lu comme
   une exception en vigueur alors qu'elle ne s'applique plus. Les quatre options :
   Brouillon (neutre) · En cours (ambre) · Validée (vert) · Inactif (NEUTRE). */
function excStatutVariant(value: string): BadgeVariant {
  const l = value.trim().toLowerCase();
  if (!l) return "neutral";
  if (l.startsWith("inactif")) return "neutral";
  if (l.startsWith("brouillon")) return "neutral";
  return statusVariant(value);
}

function StatusBadge({ value, variant }: { value: string; variant?: BadgeVariant }) {
  const v = variant ?? statusVariant(value);
  const Icon = v === "ok" ? CheckCircle : v === "warn" ? Clock : v === "danger" ? XCircle : undefined;
  return <Badge variant={v} icon={Icon}>{value}</Badge>;
}

/* ============================================================================
   4. TabBar — souligné coulissant teal
   Ajouts gabarit : pastille compteur (charte §2) + variante `dense` pour les
   widgets du tableau de bord (mêmes règles, échelle réduite)
   ============================================================================ */
type Tab = { id: string; label: string; icon: LucideIcon; count?: number };

function TabBar({
  tabs,
  activeTab,
  onSelect,
  dense,
}: {
  tabs: Tab[];
  activeTab: string;
  onSelect: (id: string) => void;
  dense?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  useEffect(() => {
    const idx = tabs.findIndex((t) => t.id === activeTab);
    const el = refs.current[idx];
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [activeTab, tabs.length]);
  const wrapStyle: CSSProperties = dense ? { ...TABBAR, backgroundColor: "transparent", marginBottom: 0 } : TABBAR;
  const tabStyle: CSSProperties = dense ? { ...TAB, padding: "10px 10px", fontSize: "12.5px" } : TAB;
  const icoSize = dense ? 14 : 16;
  return (
    <div style={wrapStyle}>
      <div className="slb-tabs" role="tablist" style={TABS_ROW}>
        {tabs.map((tab, i) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} ref={(el) => { refs.current[i] = el; }} role="tab" aria-selected={active}
              className="slb-tab" onClick={() => onSelect(tab.id)} style={{ ...tabStyle, color: active ? T.brand : T.ink3 }}>
              <Icon style={{ width: icoSize, height: icoSize }} strokeWidth={1.7} />{tab.label}
              {typeof tab.count === "number" && (
                <span style={{ fontSize: "11px", fontWeight: 700, lineHeight: 1, padding: "3px 7px", borderRadius: "999px", backgroundColor: active ? T.brand050 : T.neutral050, color: active ? T.brand700 : T.ink3 }}>{tab.count}</span>
              )}
            </button>
          );
        })}
        <div style={{ position: "absolute", bottom: 0, height: "2px", borderRadius: "2px 2px 0 0", backgroundColor: T.brand, left: indicator.left, width: indicator.width, transition: "left .3s cubic-bezier(.22,.61,.36,1), width .3s cubic-bezier(.22,.61,.36,1)" }} />
      </div>
    </div>
  );
}

/* ============================================================================
   5. Helpers — extraction de valeurs, dates relatives (charte §1.5), avatars
   ============================================================================ */
/** Extrait le libellé d'une valeur, quelle que soit sa forme. Airtable/Softr
 *  renvoie les single/multipleSelects sous forme d'OBJETS ({id,name,color}),
 *  parfois avec une autre clé — on couvre name/label/value/text/title/filename. */
function labelOf(x: any): string {
  if (x == null) return "";
  if (typeof x === "object")
    return String(x.name ?? x.label ?? x.value ?? x.text ?? x.title ?? x.filename ?? "");
  return String(x);
}
function asText(v: any): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(labelOf).filter(Boolean).join(", ");
  return labelOf(v);
}

type DateInput = string | number | Date;
const fmtDate = (d: DateInput) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

function relDays(date: DateInput) {
  const a = new Date(date); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}
// « il y a X j » / « dans X j » — date absolue toujours en tooltip (title)
function fmtRel(date: DateInput) {
  const d = relDays(date);
  if (d === 0) return "aujourd'hui";
  if (d === 1) return "demain";
  if (d === -1) return "hier";
  return d > 0 ? `dans ${d} j` : `il y a ${-d} j`;
}
// Au-delà de 30 j, la date absolue redevient plus lisible (notes anciennes)
function fmtSmart(date: DateInput) {
  return Math.abs(relDays(date)) > 30 ? fmtDate(date) : fmtRel(date);
}
// Échéances de tâches
function fmtDue(date: DateInput) {
  const d = relDays(date);
  if (d < 0) return `En retard de ${-d} j`;
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return "Demain";
  return `Dans ${d} j`;
}
// Badge temporel par seuil (charte §2) : vert > 14 j, ambre 3–14 j, rouge < 3 j ou dépassé
function dueVariant(date: DateInput): BadgeVariant {
  const d = relDays(date);
  if (d > 14) return "ok";
  if (d >= 3) return "warn";
  return "danger";
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/* --- MONOGRAMME D'INITIALES — refonte du 2026-08-06 ----------------------------
   AVANT : un dégradé `hsl()` calculé sur le nom, saturé, avec les initiales en
   BLANC. Deux défauts, et le second est le vrai :
   · la teinte était LIBRE (360 valeurs possibles), donc hors charte par
     construction — elle tombait aussi bien sur un rouge alarme que sur un violet
     criard, et le contraste du texte blanc variait avec elle ;
   · à douze lignes par widget, ces pastilles saturées devenaient le premier
     élément vu de la carte. Un monogramme sert à RECONNAÎTRE une ligne du coin de
     l'œil, pas à attirer le regard avant le contenu.

   MAINTENANT : fond PASTEL + initiales dans l'encre FONCÉE de la même famille
   (variante « monogramme teinté » validée par l'utilisateur). La palette est
   FERMÉE et reprend les paires de la charte déjà utilisées par les badges, donc
   leur contraste est acquis. Même règle que `WIDGET_TINTS` : on choisit une paire
   dans une liste, jamais une couleur au hasard.

   ⚠️ La sélection reste DÉTERMINISTE sur le nom (même hachage) : la même personne
   ou le même installateur garde sa couleur partout dans le bloc, d'un widget à
   l'autre et d'une session à l'autre. C'est ce qui rend le monogramme utile.
   ⚠️ PAS DE ROUGE dans la palette. Le rouge est la couleur d'alerte de la charte :
   un monogramme rouge se lirait comme un statut, et apprendrait à l'œil à ignorer
   le rouge là où il compte. Même raison que pour les teintes de widget. */
/* ⚠️ CONTRASTE VÉRIFIÉ, PAS SUPPOSÉ (WCAG, 2026-08-06). Les initiales font 10 à 19 px
   selon l'endroit : c'est du TEXTE NORMAL, donc le seuil est 4,5:1 — pas les 3:1 du gros
   texte. Ratios mesurés : teal 6,9 · vert 4,9 · bleu 5,1 · lavande 6,6 · rosé 5,4 ·
   ambre 4,8 · cyan 5,4 · ardoise 7,2.
   ⚠️ L'ambre n'utilise PAS `T.solar600` (#D97706) comme le fait le badge solaire :
   sur `solar050` il ne donne que 2,95:1, illisible pour deux lettres de 11 px. C'est
   `T.warnInk`, plus foncé, qui est employé ici. Ne pas « harmoniser » avec le badge —
   un badge porte un mot entier, un monogramme deux lettres serrées. */
const MONOGRAMS: { bg: string; ink: string }[] = [
  { bg: T.brand050, ink: T.brand700 },
  { bg: T.ok050, ink: T.okInk },
  { bg: T.info050, ink: T.infoInk },
  { bg: "#F2EFFC", ink: "#57489E" },   // lavande — comme WIDGET_TINTS
  { bg: "#FCEFF5", ink: "#9C4374" },   // rosé
  { bg: T.solar050, ink: T.warnInk },  // ambre (cf. l'avertissement ci-dessus)
  { bg: "#E7F3F5", ink: "#1E6B76" },   // cyan sourd
  { bg: T.neutral050, ink: T.ink2 },   // ardoise — le repli neutre
];

/** Paire (fond, encre) d'un nom. PURE et stable. */
function monogramOf(name: string): { bg: string; ink: string } {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 9973;   // 9973 premier : meilleure dispersion
  return MONOGRAMS[h % MONOGRAMS.length];
}

/* Le monogramme lui-même. Une SEULE implémentation pour les cinq endroits qui en
   affichaient un (lignes de liste, notifications, fiche détaillée, podium, classement) :
   avant cette refonte, chacun redéclarait sa taille, son rayon et son poids en ligne, et
   ils avaient déjà divergé (rayons de 8, 9 et 10 px pour des tailles voisines).
   Le rayon suit la taille (~29 %, soit 11 px pour 38 comme dans la maquette) : un carré
   arrondi garde sa forme à toutes les échelles, là où un rayon fixe paraît carré en
   grand et rond en petit. */
function Monogram({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  const { bg, ink } = monogramOf(name);
  return (
    <span aria-hidden className={className} style={{
      width: size, height: size, flex: "none", display: "grid", placeItems: "center",
      borderRadius: Math.round(size * 0.29),
      background: bg, color: ink,
      fontSize: Math.max(10, Math.round(size * 0.34)),
      fontWeight: 600, letterSpacing: ".01em",
    }}>
      {initials(name)}
    </span>
  );
}

/* --- IDENTITÉ DE LA SESSION ↔ un champ « propriétaire » de la base ---------------
   ⚠️ LE PROBLÈME EST DANS LES DONNÉES, PAS DANS LE CODE. Softr identifie
   l'utilisateur par son E-MAIL ; le champ « Proprietaire (from Installateur ) » ne
   porte que des NOMS — relevés le 2026-08-06 sur les 400 notifications les plus
   récentes : Ilan LEVY, Julien RAMON, Philippe GERY, Frédéric HUET, Edouard Da Silva,
   Guillaume Niggli, Fabrice MORVAN, Alexandre DUGOIS. Aucune table ne fait le pont
   entre les deux : le rapprochement se fait donc sur les MOTS du nom, et c'est la
   seule chose que la base rende possible aujourd'hui.

   RÈGLE, choisie pour ne JAMAIS montrer les dossiers de quelqu'un d'autre :
   · deux informations sont tentées — le `name` de la session, et la partie locale de
     l'e-mail éclatée sur « . _ - » (`ilan.levy@…` → « ilan », « levy ») ;
   · le nombre de mots communs EXIGÉ est `min(2, mots de l'identité, mots du
     propriétaire)`. Dès que les deux côtés ont un prénom ET un nom, il faut donc les
     DEUX : c'est ce qui écarte le faux positif le plus probable — « Frédéric Martin »
     ne doit pas ouvrir les dossiers de « Frédéric HUET » ;
   · une identité d'un seul mot (`romain@…`) exige ce mot comme MOT ENTIER : « romain »
     ne matche donc ni « Romainville » ni « Ilan LEVY ».
   Reste assumé : deux homonymes exacts partageraient leur vue, et un propriétaire
   écrit en prénom seul (« Arnaud ») matche tous les Arnaud. Mieux vaut ces cas rares
   qu'un filtre qui laisse fuir les dossiers d'autrui.

   ⚠️ Accents et casse sont neutralisés (« Frédéric » ↔ « frederic »), et les mots de
   moins de 3 lettres écartés : un filtre qui échoue sur un accent ne se voit pas, et
   « da » (de « Da Silva ») matcherait la moitié du fichier.
   ⚠️ LA VRAIE SOLUTION est côté base : un champ e-mail sur le propriétaire, ou un
   « Propio SOFTR » renseigné en e-mail. Le jour où il existe, ce rapprochement devient
   une égalité de chaînes et ces trente lignes disparaissent. */
const identWords = (s: string): string[] =>
  asText(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter((w) => w.length >= 3);

/** Identité de la session, sous les deux formes exploitables. `known: false` = aucune
 *  information : le filtre « mes dossiers » ne peut alors PAS être appliqué (il rendrait
 *  une liste vide sans que personne puisse comprendre pourquoi). */
type UserIdent = { name: string[]; mail: string[]; known: boolean };

function identOf(user: { name?: string; email?: string } | null | undefined): UserIdent {
  const name = identWords(asText(user?.name));
  const mail = identWords(asText(user?.email).split("@")[0]);
  return { name, mail, known: name.length > 0 || mail.length > 0 };
}

/** Ce propriétaire désigne-t-il l'utilisateur connecté ? PURE (cf. la règle ci-dessus). */
function ownerIsUser(proprio: string, ident: UserIdent): boolean {
  const owner = identWords(proprio);
  if (!owner.length) return false;
  const correspond = (mine: string[]) => {
    if (!mine.length) return false;
    const requis = Math.min(2, mine.length, owner.length);
    return mine.filter((w) => owner.includes(w)).length >= requis;
  };
  return correspond(ident.name) || correspond(ident.mail);
}

/** Prénom pour le héro. En prod, user.name est souvent vide → repli sur l'e-mail. */
function firstNameOf(user: { name?: string; email?: string } | null | undefined): string {
  const name = asText(user?.name).trim();
  if (name) return name.split(/\s+/)[0];
  const email = asText(user?.email).trim();
  if (email) {
    const local = email.split("@")[0].split(/[._-]/)[0];
    return local ? local.charAt(0).toUpperCase() + local.slice(1) : "";
  }
  return "";
}

/* ============================================================================
   6. DONNÉES — datasource + mapping (schéma Airtable réel), sinon mock du prototype
   ----------------------------------------------------------------------------
   Pattern multi-datasource du gabarit : UN SEUL define, IDs en LITTÉRAUX,
   `from` = DS.membre en direct, `select`/filtres/tri par ALIAS.

   Mapping widget → table Airtable (voir README §4) :
     · Nouveaux dossiers abonnés → base BDD Abonné · table « Notification Center »
       (⚠️ 2026-08-06 : ce widget lisait « Abonnés » ; il lit maintenant cette table SEULE.
        Cinq champs de plus lui sont nécessaires — voir SELECT_NOTIF_C et le point E.)
     · Notes — Installateurs     → base Installateurs · table « Suivi client »
     · Notes — Prospects         → base BDD Propect · table « Suivi propect »
     · Tâches — Partenaires      → base Installateurs · table « Taches »
     · Tâches — Prospects        → base Installateurs · table « Taches prospect »

   ⚠️ Les 4 sources notes/tâches sont des tables ENFANTS : connecter chacune dans
   l'onglet Sources du bloc, récupérer l'ID (onglet Chat) et remplacer les "TODO-…"
   ci-dessous. Ne passer USE_MOCK=false qu'une fois les 5 IDs réels renseignés.
   ============================================================================ */
type Rec = { id: string; fields: Record<string, any> };

/* Sources RÉELLEMENT CONNECTÉES uniquement. ⚠️ Softr valide STATIQUEMENT chaque
   id déclaré ici contre les datasources branchées (onglet Sources) : n'y mettre
   QUE des ids connectés, sinon Softr bloque le bloc (« New data source does not
   match / Remap the fields »). */
const DS = datasource.define({
  abonnes: "8fc957d0-232b-4b24-906e-d0be7c636f30", // ✅ BDD Abonné · « Abonnés »
  // ✅ Persistance du layout (§11) — table AIRTABLE (migrée depuis Softr Tables le
  //    2026-07-31) : base « SunLib CRM — Préférences » (appHZaD5BkDsWxR65) · table
  //    « Home Preferences » (tbl18J0zC47myPJLO).
  prefs: "dcc7928c-3906-4807-8224-0532c3e30fc5",
  // ✅ Connectées le 2026-08-04. Les noms de champs des SELECT_* ci-dessous ont été
  //    REVÉRIFIÉS ce jour-là contre le schéma Airtable (espaces finaux et casses
  //    irrégulières compris) avant d'ouvrir la lecture en direct.
  notesIns: "122fbc71-06e9-40ce-8b4d-01544c1ac022", // Bdd Installateurs · « Suivi client »
  notesPro: "dbd7e501-deba-482d-86f9-7b3a47abfe4f", // BDD Propect · « Suivi propect »
  tachesPa: "7198b954-7fdd-41a7-b92b-a114ff88009e", // Bdd Installateurs Sunlib · « Taches » (tblebnLi0r90yuqry)
  /* « Tâches » de BDD PROPECT Sunlib (appKrZfi0alQwq7HX · tblqcm9RYT1KgIe6K) — id CONFIRMÉ
     par le propriétaire du bloc le 2026-08-07. La connexion Softr porte encore le nom de
     l ancienne table (« Taches prospect », base Installateurs).
     ⚠️ SI LE JOURNAL AFFICHAIT DES TÂCHES ÉTRANGÈRES AUX PROSPECTS, c est ici qu il faut
     regarder : les deux tables portent les MÊMES noms de champs, donc une datasource restée
     sur l ancienne lit SANS ERREUR — simplement les mauvaises lignes. Le signe distinctif :
     dans « Tâches » (BDD Propect) « Prospect associé » est un LIEN, dans « Taches prospect »
     c est du texte libre. */
  tachesPr: "9414183e-2624-4e6e-8d7c-89470546251b",
  sav: "3f5f8f6c-c6af-4909-a8dc-46e2f123e9a6",      // SAV · « Tickets »
  // ✅ Connectées le 2026-08-05 — les deux périmètres du registre des exceptions.
  excAbo: "b8340293-183b-40c3-acfa-63b5cb237957",   // « Projet solaire »  (tblDiXeZn207S4hBE)
  excPart: "9cf1e459-e689-48b1-9876-487b8084db84",  // « Partenaire »      (tbl6RsrSjP1FijHzJ)
  parcPart: "e82df933-0c1b-434c-9970-f9a341777e74", // « BDD Installateur »(tblQLEpjqyUn54XTb)
  // ✅ Connectée le 2026-08-05. SEULE source ÉCRIVABLE du bloc en dehors des notes/tâches.
  //    ⚠️ Le sens de « Statut de lecture » suit les formules INVERSÉES de la table : voir
  //    SELECT_NOTIF_C. Le jour où elles sont corrigées côté Airtable, inverser ici aussi.
  notifC: "fecd4e37-cc12-4780-ae87-e412b431a852",   // « Notification Center » (tblqF71AO8nFVpWi5)
  /* ✅ Connectée le 2026-08-19 (id fourni par le propriétaire du bloc) — « Détails des contacts
     par installateur » (appvD32dWRPmogRgn · tblplaeeb843AHLqo), l'annuaire de la page Softr
     `contact-partenaire`. LECTURE SEULE, et 1 266 lignes drainées page par page.
     ⚠️ Les DIX champs de `SELECT_CONTACT_INS` doivent être cochés sur CETTE connexion : un seul
     oubli fait échouer la datasource entière au collage, donc tout le bloc. */
  contactsIns: "acc8398e-5798-4e1c-9b57-f13ee1cbb2b1",
});

/* Le registre est COMPLET depuis le 2026-08-05 : les 9 sources du catalogue qui
   demandaient une datasource ont la leur, et `CATALOG` ne porte plus aucun
   `connected: false`. Toute source ajoutée ensuite repart du même chemin : la
   connecter (onglet Sources DE CE BLOC), relever son id (onglet Chat), l'ajouter
   comme membre ci-dessus, écrire son adapter et son `case` dans `SourceFeed`, puis
   passer `connected: true` dans CATALOG.

   ⚠️ Un id de datasource appartient à UNE connexion d'UN bloc : « Notification
   Center » est lue par deux autres blocs de page (dont la page d'accueil) sous
   D'AUTRES ids, qui ne fonctionneraient pas ici. Même règle pour les trois ids du
   bloc `dashboard-KPI`. Voir la note au-dessus de `SourceFeed`. */

// alias (clé JS) -> nom EXACT du champ Airtable. Filtres/tri par ALIAS.
// ⚠️ Certains noms comportent des espaces exacts (« … Installateur ) », « Date »,
//    « date ») ou une casse précise (« date de fin » vs « Date de fin ») : NE PAS
//    normaliser — Softr résout le champ par ce nom littéral.

// Dossiers ← « Abonnés ». Sert les widgets GÉNÉRIQUES de la galerie (dossiers
// incomplets, tableau, indicateur du mois) et le comptage du parc.
// ⚠️ Ne sert PLUS « Nouveaux dossiers abonnés » : depuis le 2026-08-06 ce widget lit
// « Notification Center » et rien d'autre (§9). Cette table n'a pas de champ « Lu » —
// c'est justement ce qui a fait passer le widget sur l'autre table.
/* ⚠️ ÉLARGI le 2026-08-06 pour la POP-UP DE DÉTAIL (`RecordDialog`) : cliquer une ligne
   doit montrer le dossier, pas les quatre colonnes que la ligne avait la place d'écrire.
   Les 10 champs ajoutés ne sont pas un pari — ils sont TOUS déjà lus sur CETTE MÊME
   datasource par `SELECT_COM` (podium CAPEX) et `SELECT_PARC_ABO` (dénominateur du
   parc), donc leur exposition côté Softr est prouvée par du code qui tourne.
   ⚠️ NE PAS y ajouter « Nom de l'entreprise » ni « Propio SOFTR » sans vérifier : ces
   champs existent dans la table mais rien ne prouve qu'ils sont exposés par CETTE
   connexion, et un champ non exposé fait échouer le bloc entier.
   ⚠️ `partenaire` s'écrit « (from Installateur ) » AVEC un espace avant la parenthèse,
   là où `SELECT_COM.installateur` s'écrit SANS : ce sont deux champs distincts de la
   même table. Ne pas « harmoniser ». */
const SELECT_ABONNE = q.select({
  nom: "Nom",
  prenom: "Prenom",
  partenaire: "Nom de l'entreprise (from Installateur )", // lookup installateur (espace avant ")")
  statut: "Statut Dossiers",
  offre: "Type d installation", // pas de Duo/Solo/Pro → « PV seul », « PV + Batterie Virtuelle »…
  /* TYPE DE CLIENT — Pro / Solo / Duo (2026-08-18). C'est un champ FORMULE :
       civilité vide → « Pro » · « Monsieur » ou « Madame » → « Solo » · sinon → « Duo ».
     Donc PARTICULIER = Solo ∪ Duo, et c'est ce que fait `clientKind` (§9-bis) : la base
     ne connaît pas le mot « particulier », il n'existe que dans notre lecture.
     ⚠️⚠️ À COCHER DANS L'ONGLET SOURCES du bloc pour la datasource `abonnes`, sinon Softr
     refuse la datasource ENTIÈRE (« does not match / Remap the fields ») — même piège que
     les champs de `notifC`. Non coché, le champ arriverait vide sur toutes les lignes ;
     `clientScope` le détecte et n'applique alors aucun filtre plutôt que de vider la
     liste en silence. */
  client: "Champs IA Config client",
  /* RAISON SOCIALE — sur un dossier PRO, « Nom » est VIDE : c'est ce champ qui porte le
     client. Sans lui, les listes mappées sur `nom` affichaient une ligne SANS TITRE pour
     les deux tiers des dossiers en attente. C'est `clientNom` (§6-bis) qui choisit lequel
     des deux montrer.
     ⚠️⚠️ À COCHER DANS L'ONGLET SOURCES du bloc, comme `client`. */
  entreprise: "Nom de l'entreprise",
  creeLe: "date de création",
  // ── Ajouts « fiche détaillée ». Ils servent aussi de colonnes et de filtres aux
  //    widgets génériques, puisque le catalogue les déclare (§6-bis).
  ref: "Contrat abonné",                       // référence du dossier (SL-…)
  statutAbonne: "Statut de l'abonné",          // ≠ « Statut Dossiers » : Annulé / Repris / Refusé
  capex: "Prix Installation HT total",
  aboMoyen: "Prix En nombre",                  // abonnement mensuel
  kwc: "Puissance installe en KWC",
  etatFacture2: "Etat facture 2",
  dateSignature: "Date signature contrat",
  dateEdition: "Date édition contrat",
  contratSigne: "Contrat abonnement signe",    // PIÈCE JOINTE → « signé » = fichier présent
  contratNonSigne: "Contrat d abonnement non signe",
});

/* Notes installateurs ← « Suivi client » (base « Bdd Installateurs Sunlib »,
   appvD32dWRPmogRgn · tblkP20xivQbSSLUj — relevé le 2026-08-07).
   ⚠️ `proprio` est un LOOKUP (`multipleLookupValues`) qui remonte le propriétaire SunLib
   depuis la fiche installateur liée. Il sert le filtre « mes installateurs »
   (`ownerField` du descripteur, §6-bis) : sans lui, chacun voyait les notes de tout le
   monde. Un lookup rend un TABLEAU côté Airtable — `asText` s'en charge (§3), comme pour
   le propriétaire de « Notification Center ».
   ⚠️⚠️ À COCHER DANS L'ONGLET SOURCES DU BLOC pour la datasource `notesIns`. Un champ
   absent de la sélection Softr fait échouer le bloc entier (« New data source does not
   match / Remap the fields »), pas seulement ce widget. */
const SELECT_NOTE_INS = q.select({
  nom: "Installateur", // champ primaire = nom de l'installateur
  note: "Notes",
  date: "Date ",       // ⚠️ espace final
  proprio: "Proprietaire (from Installateurs)",
});
/* Notes prospects ← « Suivi propect » (base « BDD Propect Sunlib », appKrZfi0alQwq7HX ·
   tblaWCbZGGz7IUdNm).
   ⚠️ `proprio` = LOOKUP « Propriétaire (from Propects) » (fldvdeSn4sQoJimR3), CRÉÉ LE
   2026-08-07 pour ce filtre : la table ne portait aucun propriétaire, celui-ci vit sur
   « Propects » et remonte ici par le lien `Propects`. Le champ source étant lui-même un
   LIEN (`multipleRecordLinks` vers la table des collaborateurs), le lookup rend un tableau
   de noms — `asText` (§3) le met à plat, comme pour les autres lookups du bloc.
   ⚠️⚠️ À COCHER DANS L'ONGLET SOURCES du bloc pour la datasource `notesPro`, sinon Softr
   refuse toute la datasource (« does not match / Remap the fields »). */
const SELECT_NOTE_PRO = q.select({
  nom: "Nom",
  note: "Notes",
  date: "date ",       // ⚠️ espace final (createdTime)
  proprio: "Propriétaire (from Propects)",
});

/* Tâches partenaires ← « Taches » (base « Bdd Installateurs Sunlib » · tblebnLi0r90yuqry).
   ⚠️ `assignee` sert le filtre « mes tâches » (2026-08-07) : sans lui, le journal montrait
   les tâches de toute l'équipe. À COCHER DANS L'ONGLET SOURCES du bloc, sans quoi Softr
   refuse la datasource entière. */
const SELECT_TACHE_PA = q.select({
  desc: "Description",
  associe: "Partenaire associé",
  fin: "date de fin",  // ⚠️ minuscule
  fait: "Fait",        // pour n'afficher que les tâches en cours
  assignee: "Assignee",
});
/* Tâches prospects ← « Tâches » de la base « BDD Propect Sunlib » (appKrZfi0alQwq7HX ·
   tblqcm9RYT1KgIe6K), et NON « Taches prospect » de la base Installateurs. La datasource a
   été confirmée le 2026-08-07 (cf. la note sur `DS.tachesPr`, §6).
   ⚠️ Les quatre noms de champs ci-dessous existent dans les DEUX tables : une datasource qui
   pointerait l'ancienne lirait sans erreur, simplement les mauvaises lignes. C'est le genre de
   méprise qui ne se voit pas — ne pas « corriger » ces noms sans vérifier laquelle est lue.
   ⚠️ `assignee` sert le filtre « mes tâches » (2026-08-07) ; à cocher côté Softr. */
const SELECT_TACHE_PR = q.select({
  desc: "Description",
  associe: "Prospect associé",
  fin: "Date de fin",  // ⚠️ majuscule
  fait: "Fait",
  assignee: "Assignee",
});

/* ── CONTACTS PARTENAIRES ← base « Bdd Installateurs Sunlib » (appvD32dWRPmogRgn) ·
   table « Détails des contacts par installateur » (tblplaeeb843AHLqo, 1 266 lignes au
   2026-08-19). Schéma RELEVÉ SUR AIRTABLE ce jour-là, pas recopié d'un écran : les dix
   noms ci-dessous sont ceux du schéma, casse et accents exacts.
   C'est l'annuaire que porte la page Softr `contact-partenaire` (§0-bis) — un installateur
   y a autant de lignes qu'il a d'interlocuteurs, ce que le nom de la table dit à la lettre.

   ⚠️ `entreprise` est un champ LIEN (`multipleRecordLinks` vers « Installateurs »), donc un
   TABLEAU côté Airtable, que `asText` met à plat (§5) — même mécanique que les lookups des
   notes. C'est LUI qui porte le nom de l'installateur, et donc tout le regroupement de ce
   widget (`defaultFacet`).
   ⚠️ `service` et `typeContact` sont des MULTI-SÉLECTIONS : une même personne est souvent
   « Commercial » ET « Admin » (la page Softr affiche bien deux pastilles, et `FieldValue` les
   rend comme telles depuis le 2026-08-19). Mis à plat ils donnent « Commercial, Admin » :
   un filtre `eq` sur « Commercial » ne les trouverait donc PAS — il faut `contains`.
   ⚠️ `proprio` est un LOOKUP de la formule « Propriétaire TBD » portée par la fiche
   installateur. Il est LU (affiché en fiche, cherchable) mais ne restreint RIEN d'office :
   voir pourquoi `ownerField` est délibérément absent du descripteur.
   ⚠️⚠️ LES DIX CHAMPS SONT À COCHER DANS L'ONGLET SOURCES DU BLOC pour cette datasource.
   Un seul oubli fait échouer la datasource ENTIÈRE (« New data source does not match /
   Remap the fields »), pas seulement ce widget — c'est le piège qui a déjà coûté sur
   `notifC` et sur « Champs IA Config client ». */
const SELECT_CONTACT_INS = q.select({
  nom: "Nom",                             // champ primaire (le NOM de famille seul)
  prenom: "Prénom",
  entreprise: "Nom Entreprise",           // LIEN → « Installateurs »
  mail: "Mail",
  tel: "Téléphone",
  service: "Service",                     // multi-sélection (16 choix relevés)
  typeContact: "Type de contact SunLib",  // multi-sélection (5 choix relevés)
  commentaire: "Commentaire installateur",
  proprio: "Propriétaire TBD (from Nom Entreprise)",
  creeLe: "Date de création",             // createdTime
});

/* ── NOTIFICATION CENTER ← base « BDD Abonné » (appe55vTZRk6Ssd2w) · table
   « Notification Center » (tblqF71AO8nFVpWi5, ~2 130 lignes au 2026-08-03).
   Relevé sur Airtable ce jour-là. C'est la table qui porte l'état LU / NON LU des
   dossiers abonnés, et depuis le 2026-08-06 la SEULE table lue par le widget
   « Nouveaux dossiers abonnés » (§9), qui y lit ses lignes et y écrit « Vu ».

   ⚠️⚠️⚠️ LE SENS DE LA CASE EST INVERSÉ PAR RAPPORT À SON NOM, et c'est vérifié sur
   les données, pas supposé :

       « Statut de lecture » COCHÉE   →  « Statut de la notification » = « Non lue »
       « Statut de lecture » DÉCOCHÉE →  « Statut de la notification » = « Lue »

   La case veut donc dire « À LIRE », pas « lue ». Arbitrage du 2026-08-03 : on
   s'adapte à l'existant, on ne touche PAS aux formules Airtable — d'autres écrans les
   consomment et s'inverseraient. Conséquence dans tout le code qui suit :
       marquer comme vu  =  ÉCRIRE false  (décocher)
       non lu            =  case à true
   L'alias est nommé `aLire` et non `lu` exprès : un alias qui mentirait sur son
   contenu rendrait chaque relecture de ce fichier dangereuse.

   ⚠️ Seul « Statut de lecture » est ÉCRIVABLE. Tout le reste est formule ou lookup
   (`… (from Liens BDD)`) : les déclarer en écriture ferait échouer l'écriture du
   record entier — même règle que « Total interventions » côté SAV.
   ⚠️ DEUX DÉFAUTS CONNUS de cette table, à traiter côté base et non ici : chaque
   événement crée DEUX lignes (une « Lue », une « Non lue », à quelques secondes), et
   ~380 lignes n'ont aucun lien vers un abonné. Le widget ne peut que les subir.
   ⚠️ Aucun champ destinataire : l'état de lecture est GLOBAL, pas par utilisateur.
   Cocher vaut pour tout le monde — à dire aux utilisateurs. */
/* ⚠️⚠️ CINQ CHAMPS AJOUTÉS le 2026-08-06, quand ce widget est devenu une lecture de
   CETTE SEULE table (avant, il lisait « Abonnés » et ne venait chercher ici que l'état
   de lecture). Les noms sont relevés sur Airtable par l'API, à la lettre — noter que
   « Proprietaire » n'a PAS d'accent et qu'il y a un ESPACE avant sa parenthèse
   fermante, tel quel dans la base. Ne pas « corriger » l'orthographe : le nom doit
   correspondre au champ, pas au français.
   ⚠️ ILS DOIVENT ÊTRE COCHÉS DANS LA CONNEXION de la datasource `notifC` (onglet
   Sources du bloc) : les champs qu'une datasource expose sont choisis À LA CONNEXION,
   pas déduits de la table. Un champ demandé ici mais non exposé là-bas fait échouer le
   bloc (« New data source does not match / Remap the fields »). */
const SELECT_NOTIF_C = q.select({
  liens: "Liens BDD",                 // lien vers l'abonné → porte son record id (lien « Détail »)
  aLire: "Statut de lecture",         // ⚠️ COCHÉE = NON LUE (voir ci-dessus)
  etat: "Statut de la notification",  // formule « Lue » / « Non lue » (lecture seule)
  creeLe: "Created Date",
  texte: "Notification",              // formule : « Nouveau abonné créé pour : Prénom Nom »
  nom: "Nom (from Liens BDD)",        // nom de famille de l'abonné → titre de ligne
  partenaire: "Installateur (from Liens BDD)",
  statut: "Statut Dossiers (from Liens BDD)",
  // Le champ du FILTRE du widget : une ligne sans propriétaire n'est pas montrée.
  proprio: "Proprietaire (from Installateur ) (from Liens BDD)",
  /* TYPE DE CLIENT — 6e champ ajouté, le 2026-08-20 (demandé), pour le réglage
     « Clientèle » du widget. C'est le LOOKUP du champ formule d'« Abonnés » (« Pro » /
     « Solo » / « Duo »), et il EXISTE DÉJÀ dans la table : relevé par l'API le
     2026-08-20 sous `fldEimoiZuVIvuMP7`, nom exact ci-dessous. Rien à créer côté Airtable.
     ⚠️⚠️ À COCHER DANS LA CONNEXION de la datasource `notifC` (onglet Sources du bloc),
     comme les cinq autres champs du 2026-08-06 : non exposé, il fait échouer le BLOC
     ENTIER (« New data source does not match / Remap the fields »), pas seulement ce
     widget. Une fois coché, plus rien à faire — s'il arrivait vide malgré tout,
     `clienteleRows` détecte qu'aucune ligne n'est classable et ne filtre alors RIEN,
     le widget disant lui-même que le réglage est inopérant. */
  client: "Champs IA Config client (from Liens BDD)",
});
/* WHITELIST d'écriture : la case, et rien d'autre. */
const SELECT_NOTIF_C_W = q.select({ aLire: "Statut de lecture" });

/* Dossiers SAV ← base « SAV » (appGKl3XIjDvH0mkr) · table « Tickets »
   (tblf4KgGHCaZXKnBX). C'est la table du bloc SUNLIB/SAV « Pilotage SAV » : les
   noms de champs ci-dessous sont recopiés de son README §5, où ils sont relevés
   colonne par colonne. Les 12 compteurs de catégorie sont lus parce que le
   classement des causes s'en déduit (§10, SavCard) — pas pour être affichés un
   par un.
   ⚠️⚠️ « Total interventions » (fld3jNTS01cmss313) est VOLONTAIREMENT ABSENT :
   c'est un champ FORMULE. Le déclarer dans un select ferait échouer l'écriture du
   record entier côté Softr — la règle est notée aux deux endroits du projet SAV
   (README §5 et docs/modele-donnees-sav.md §2). Le total se resomme ici, comme le
   fait `useKpis` dans le bloc SAV. Même règle pour tout futur rollup ou lookup. */
const SELECT_SAV = q.select({
  ticket: "Ticket / ID",
  client: "Client / Centrale",
  installateur: "Installateur initial",
  debut: "Date début",
  fin: "Date fin",
  panneaux: "Panneaux", onduleurs: "Onduleurs / MO", protection: "Protection électrique",
  cablage: "Câblage", supervision: "Supervision", raccordement: "Raccordement",
  consuel: "Consuel", batterie: "Batterie virtuelle", alerte: "Alerte", fuite: "Fuite",
  calepinage: "Calepinage", autre: "Autre",
  fabricant: "Fabricant / matériel",
  priorite: "Priorité",
  statut: "Statut",
  tiers: "Tiers SAV",
  cout: "Coût tiers SAV",
});

/* ── PERFORMANCE COMMERCIALE ← « Abonnés », lue une SECONDE fois avec son propre
   select. Même table, même datasource, deux lectures : celle-ci sert le podium CAPEX
   et ne charge que 5 champs, mais elle les charge SUR TOUT LE PARC (pagination
   complète, cf. ComKpiSource) — alors que `SELECT_ABONNE` lit large sur les 12
   derniers dossiers. Fusionner les deux ferait payer au widget « Derniers dossiers »
   le prix d'un parc entier, ou au podium l'inexactitude d'un échantillon.

   Champs et critères RECOPIÉS du bloc `dashboard-KPI` (onglet Commercial), pour que
   les deux écrans donnent le même podium :
     · commercial   « Propio SOFTR » — vide ⇒ « Non assigné », exclu du podium
     · capex        « Prix Installation HT total »
     · contratSigne « Contrat abonnement signe » — PIÈCE JOINTE, pas un statut
     · statutAbonne « Statut de l'abonné » — « Annulé » exclut du décompte
     · moisSignature « Mois de signature contrat » — clé « AAAA-MM » du filtre de période

   ⚠️ « SIGNÉ » = LE PDF DU CONTRAT EST JOINT, et non un statut : un dossier peut
   porter un statut sans contrat, et l'inverse. C'est le critère du bloc KPI comme de
   `sunlib-kpi` ; en prendre un autre ici donnerait deux classements concurrents. */
const SELECT_COM = q.select({
  commercial: "Propio SOFTR",
  capex: "Prix Installation HT total",
  contratSigne: "Contrat abonnement signe",
  statutAbonne: "Statut de l'abonné",
  moisSignature: "Mois de signature contrat",
  /* Colonnes du CLASSEMENT (§9-septies). Noms VÉRIFIÉS sur Airtable le 2026-08-04
     (base appe55vTZRk6Ssd2w · table tblcACuSWYttnFQNr, 1 771 dossiers).
     ⚠️ `installateur` s'écrit « (from Installateur) » SANS espace avant la parenthèse,
     là où `partenaire` de SELECT_ABONNE s'écrit « (from Installateur ) » AVEC espace :
     ce sont DEUX champs distincts de la même table, et les confondre casse la lecture.
     ⚠️ `commercial` est un singleSelect : Softr peut le rendre en objet `{ id, name }`,
     d'où le passage systématique par `asText` (qui lit `.name`). */
  aboMoyen: "Prix En nombre",
  etatFacture2: "Etat facture 2",
  dateSignature: "Date signature contrat",
  dateCreation: "date de création",
  installateur: "Nom de l'entreprise (from Installateur)",
  /* Indicateurs globaux (§9-septies, `comGlobal`). Vérifiés le 2026-08-04 eux aussi.
     `contratNonSigne` est une PIÈCE JOINTE comme `contratSigne` : c'est elle qui définit
     un dossier « en attente de signature », donc le pipeline. */
  kwc: "Puissance installe en KWC",
  dateEdition: "Date édition contrat",
  contratNonSigne: "Contrat d abonnement non signe",
  /* TYPE DE CLIENT (2026-08-20) — le MÊME champ formule que `SELECT_ABONNE.client`
     (« Pro » / « Solo » / « Duo »), lu ici pour que les quatre widgets commerciaux
     puissent se restreindre à une clientèle (§9-septies). C'est ce qui permet de lire
     « le podium des dossiers PRO » sans ouvrir le tableau de bord KPI.
     ⚠️ Rien à cocher côté Softr pour celui-ci : cette lecture passe par la datasource
     `abonnes`, où le champ est déjà exposé depuis le 2026-08-18 (cf. SELECT_ABONNE). Deux
     selects sur la même connexion — un champ exposé l'est pour les deux. */
  client: "Champs IA Config client",
});

/* ── EXCEPTIONS ← deux tables, deux PÉRIMÈTRES ─────────────────────────────────
   Le registre des exceptions du bloc `dashboard-KPI` est l'UNION de deux tables qui ne
   portent pas les mêmes champs. Toutes deux vivent dans la base AIRTABLE « Exception »
   (`appsvzvqbgcGURcJ1`) — PAS dans « Bdd Installateurs », qui ne porte que le parc :
     · « Projet solaire » (tblDiXeZn207S4hBE) → exceptions ABONNÉ. Son titre est le
       dossier (« SL- Dossier ») et elle n'a PAS de statut ;
     · « Partenaire » (tbl6RsrSjP1FijHzJ) → exceptions PARTENAIRE. Son titre est
       « Name », et elle porte un statut (« Validée »…) ;
     · « BDD Installateur » (tblQLEpjqyUn54XTb) → le PARC partenaire, dénominateur.
   Les deux alias sont volontairement IDENTIQUES quand le sens l'est (description,
   categorie, valideur…) : c'est ce qui permet aux widgets de traiter une seule forme de
   ligne, le périmètre étant porté par la source qui l'a lue.

   État relevé par l'API Airtable le 2026-08-04 (ces nombres bougent chaque semaine —
   les revérifier avant de conclure qu'un chiffre affiché est faux) : **6** exceptions
   abonné, **15** exceptions partenaire, **510** partenaires au parc. Les NOMS de champs
   des deux selects ci-dessous ont été résolus contre le schéma réel ce jour-là.

   ⚠️ Deux creux de saisie constatés dans le réel, qui ne sont PAS des bugs d'affichage :
   le lien « BDD Installateur » est vide sur les 6 exceptions abonné (colonne Partenaire
   à « — »), et 5 des 15 exceptions partenaire n'ont pas encore de statut.

   ⚠️ Les ids de datasource du bloc `dashboard-KPI` (77b25e6b, ef44c8f5, 6415ed0c) NE
   FONCTIONNENT PAS ici : un id appartient à UNE connexion d'UN bloc. Les TROIS tables
   ont donc reçu leurs propres ids sur CE bloc le 2026-08-05 (cf. `DS`). */
const SELECT_EXC_ABO = q.select({
  dossier: "SL- Dossier",
  description: "Description",
  categorie: "Catégorie",
  sousCategorie: "Sous catégorie",
  service: "Tag",
  valideur: "Valideur",
  justificatif: "Justificatif",
  installateur: "BDD Installateur",
  creeLe: "Date de création",
});
const SELECT_EXC_PART = q.select({
  nom: "Name",
  description: "Description",
  categorie: "Catégorie",
  sousCategorie: "Sous catégorie",
  service: "Tag",
  valideur: "Valideur",
  justificatif: "Justificatif",
  installateur: "BDD Installateur",
  statut: "Statut",
  creeLe: "Date de création",
});

/* Dénominateurs des taux de couverture — deux PARCS, lus en UN SEUL CHAMP chacun.
   ⚠️ Un seul champ, et c'est délibéré : on ne veut que COMPTER. Y ajouter des colonnes
   ferait payer 1 771 lignes plus larges à chaque affichage, pour rien. Et ne JAMAIS
   remplacer ces lectures par un total codé en dur : le parc grossit chaque semaine, et
   un dénominateur figé fabriquerait un taux faux qui aurait l'air juste. */
const SELECT_PARC_ABO = q.select({ ref: "Contrat abonné" });
const SELECT_PARC_PART = q.select({ nom: "Nom de l'entreprise" });

/* --- SELECTS D'ÉCRITURE (§9-ter). Ce sont LES WHITELISTS : un alias absent d'ici
   est physiquement inécrivable depuis le bloc (Softr répond 400), quoi que puisse
   déclarer le catalogue. N'y mettre que des champs que l'utilisateur a le droit de
   modifier depuis l'accueil.

   Volontairement PAS de select d'écriture pour « Abonnés » : le statut d'un dossier
   se change dans le CRM, pas depuis un widget d'accueil.

   ⚠️ Les champs calculés ne sont jamais inscriptibles : `date` de « Suivi propect »
   est un createdTime, il est donc exclu de son select d'écriture. --- */
const SELECT_TACHE_PA_W = q.select({ fait: "Fait" });
const SELECT_TACHE_PR_W = q.select({ fait: "Fait" });
const SELECT_NOTE_INS_W = q.select({ nom: "Installateur", note: "Notes", date: "Date " });
const SELECT_NOTE_PRO_W = q.select({ nom: "Nom", note: "Notes" });

// Préférences d'accueil ← AIRTABLE, base « SunLib CRM — Préférences » · table
// « Home Preferences » (persistance du layout par utilisateur, §11).
// ⚠️ Table AIRTABLE (plus Softr Tables) → les VALEURS sont les NOMS EXACTS des champs,
// pas des FIELD IDs. Ces noms ont été créés sans piège (aucun espace final, casse
// régulière, sans accent) : ne les renommer NI ici NI dans Airtable.
// Les 4 champs de la table sont tous écrits — plus de champs « en réserve » : sur
// Airtable, en ajouter un prend dix secondes le jour où le besoin existe.
const SELECT_PREFS = q.select({
  email: "user_email",           // clé logique (email de useCurrentUser(), en minuscules)
  layout: "layout_json",         // document v2 {v,items,parked,seeded} sérialisé (Plan A)
  updatedAt: "updated_at",       // DATETIME (chaîne ISO)
  schemaVersion: "schema_version", // Number — recopie de LAYOUT_VERSION (diagnostic du parc)
});

// Modèles de vue — mêmes formes pour le mock et le mapping Airtable.
/* Une ligne du widget « Nouveaux dossiers abonnés ». Elle décrit une NOTIFICATION
   (une ligne de « Notification Center »), et non plus un dossier de « Abonnés » —
   changement du 2026-08-06, cf. §9. D'où deux ids distincts, et il faut les garder
   distincts : `id` sert la liste ET l'écriture de l'état de lecture, `abonneId` sert
   le lien « Détail » et peut être vide (~380 lignes de la table n'ont aucun lien). */
type Notif = {
  id: string;          // record id de la LIGNE Notification Center
  abonneId: string;    // record id de l'ABONNÉ lié, "" si la ligne est orpheline
  nom: string; texte: string; partenaire: string; statut: string; proprio: string;
  /** « Pro », « Solo » ou « Duo » — le type de client du dossier lié, "" si le champ n'est
   *  pas exposé par la datasource. Sert le réglage « Clientèle » (2026-08-20). */
  client: string;
  creeLe: string; nonLu: boolean;
  /** La ligne BRUTE, conservée pour la pop-up de détail : `RecordDialog` est générique
   *  et lit les alias du descripteur, pas ce modèle de vue. Sans elle, il faudrait
   *  écrire une fiche sur-mesure pour ce widget — exactement ce que le catalogue existe
   *  pour éviter. */
  raw: Row;
};
type Task = { id: string; desc: string; associe: string; fin: string };
/* (Le modèle de vue « Note » a disparu avec le passage des widgets notes au type
   liste générique : ces widgets lisent désormais les alias directement.) */

const flatten = (res: { data?: { pages?: { items: any[] }[] } } | undefined): Rec[] =>
  (res?.data?.pages ?? []).flatMap((p) => p.items) as Rec[];

/* --- Forme de ligne UNIQUE (§6-bis) : `{ id, …alias }` — l'enregistrement Softr
   est APLATI dès la lecture, si bien que les lignes mock et les lignes live ont
   exactement la même forme (clés = alias du SELECT_*). Toutes les transformations
   en aval (mappers ci-dessous, filtres/tris à venir) s'écrivent donc UNE fois. --- */
type Row = { id: string } & Record<string, unknown>;

const flattenRows = (res: { data?: { pages?: { items: any[] }[] } } | undefined): Row[] =>
  flatten(res).map((r) => ({ id: r.id, ...r.fields }));

/** Ids portés par un champ LIEN. Les trois formes qu'une valeur de lien peut prendre
 *  selon la couche traversée sont acceptées : tableau d'objets `{id, name}` (Airtable),
 *  tableau de chaînes, ou chaîne unique.
 *  ⚠️ Rien ne garantit que Softr expose les IDS d'un champ lien plutôt que les libellés
 *  du champ primaire. Si ce sont des libellés, `abonneId` ne sera pas un record id et le
 *  bouton « Détail » mènerait à une fiche vide : c'est pourquoi le widget ne l'affiche
 *  que sur une valeur en forme de record id (cf. `NotifRow`). */
const linkIds = (v: unknown): string[] => {
  if (Array.isArray(v)) {
    return v.map((x) => (x && typeof x === "object" ? asText((x as Record<string, unknown>).id) : asText(x))).filter(Boolean);
  }
  const s = asText(v);
  return s ? [s] : [];
};

const mapNotifC = (r: Row): Notif => ({
  id: r.id,
  abonneId: linkIds(r.liens)[0] ?? "",
  nom: asText(r.nom),
  texte: asText(r.texte),
  partenaire: asText(r.partenaire),
  statut: asText(r.statut),
  proprio: asText(r.proprio),
  client: asText(r.client),
  creeLe: asText(r.creeLe),
  nonLu: isTruthy(r.aLire),           // ⚠️ case COCHÉE = non lue (cf. SELECT_NOTIF_C)
  raw: r,
});
const mapTask = (r: Row): Task => ({
  id: r.id,
  desc: asText(r.desc),
  associe: asText(r.associe),
  fin: asText(r.fin),
});
/* NB : plus de `mapNote` — les widgets « notes » sont devenus des listes génériques
   (§9-bis) qui lisent les alias directement, sans modèle de vue intermédiaire. */

/* Vérité d'une valeur booléenne telle qu'elle revient d'Airtable/Softr : une
   checkbox peut arriver en `true`, en `"true"`, ou absente. */
const isTruthy = (v: unknown): boolean => v === true || asText(v).toLowerCase() === "true";

/** Un champ PIÈCE JOINTE porte-t-il au moins un fichier ? Airtable renvoie un tableau
 *  d'objets `{ url, filename }` ; vide ou absent quand rien n'est joint.
 *  ⚠️ `asText` ne convient pas : sur un tableau d'objets il rend la chaîne vide (cf.
 *  `labelOf`), donc tout dossier passerait pour non signé. */
const hasFile = (v: unknown): boolean => Array.isArray(v) && v.length > 0;

// Une tâche « Fait » (checkbox Airtable) ne doit pas rester au journal.
const isDone = (r: Row): boolean => isTruthy(r.fait);

/* --- Données mock d'aperçu (identiques au prototype validé) --- */
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };
/** Clé « AAAA-MM » d'il y a n mois — forme du champ « Mois de signature contrat ». */
const monthAgo = (n: number) => {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString(); };

const MOCK_USER = { firstName: "Frédéric" };

/* Mock indexé par SOURCE (§6-bis) et non par widget : les lignes ont la forme des
   ALIAS du SELECT_* correspondant, donc elles traversent les mêmes mappers que le
   live. Conséquence utile : une source non connectée sert automatiquement son mock,
   même quand USE_MOCK=false (granularité mock/live gratuite, cf. offlineState). */
const MOCK_ROWS: Partial<Record<SourceKey, Row[]>> = {
  // ← SELECT_ABONNE : nom / prenom / partenaire / statut / offre / creeLe
  // ⚠️ `offre` : les valeurs sont celles RÉELLEMENT proposées par le champ Airtable
  // « Type d installation » (les anciennes Duo / Solo / Pro n'existent plus). Le
  // catalogue (§6-bis) en porte la liste, et un banc d'essai vérifie que le mock
  // n'utilise que des valeurs déclarées.
  /* ⚠️ Les 10 champs de la FICHE DÉTAILLÉE sont renseignés ici (2026-08-06), sans quoi la
     pop-up n'afficherait que des tirets en aperçu et on ne verrait jamais sa mise en
     page réelle. Deux lignes portent des creux VOLONTAIRES — n1 sans signature ni PDF
     (dossier en cours), n2 sans CAPEX — parce que la fiche doit rester lisible quand la
     base est incomplète, et que c'est le cas le plus fréquent en vrai. */
  /* ⚠️ STATUTS REPRIS LE 2026-08-18 sur les valeurs RÉELLES du champ (les anciennes
     n'existent plus, cf. la note de `statut` dans CATALOG). Sans ça l'aperçu montrait des
     badges gris et les deux nouveaux modèles rendaient une liste vide EN APERÇU — de quoi
     chercher longtemps un défaut qui n'était que dans le mock.
     Les lignes couvrent les trois valeurs de `client` (Pro / Solo / Duo) et les deux files
     d'attente : c'est le minimum pour éprouver le réglage « Clientèle » sans base. */
  abonnes: [
    { id: "n1", prenom: "Nicolas", nom: "Laborderie", partenaire: "Mandat Energie", statut: "Demande d'infos : technique", offre: "PV + Batterie", creeLe: daysAgo(1), client: "Solo",
      ref: "SL-002310", statutAbonne: "", capex: 21400, aboMoyen: 189, kwc: 9, etatFacture2: "A traiter",
      dateSignature: "", dateEdition: "", contratSigne: [], contratNonSigne: [] },
    /* ⚠️ `nom` VIDE sur les pros, comme dans la base : c'est ce qui rend visible en aperçu
       le trou que `clientNom` bouche. Ne pas « réparer » ces lignes en y remettant un nom. */
    { id: "n2", prenom: "", nom: "", entreprise: "Commune de Payssous", partenaire: "FLG SOLAR", statut: "Demande d'infos : solvabilité", offre: "PV seul", creeLe: daysAgo(2), client: "Pro",
      ref: "SL-002104", statutAbonne: "", capex: 0, aboMoyen: 0, kwc: 36, etatFacture2: "En attente de document",
      dateSignature: "", dateEdition: daysAgo(1), contratSigne: [], contratNonSigne: [{ url: "#", filename: "contrat-a-signer.pdf" }] },
    { id: "n3", prenom: "", nom: "", entreprise: "TOULOSE TRANSIT", partenaire: "Neosoleil", statut: "En attente de solvabilité", offre: "PV seul", creeLe: daysAgo(120), client: "Pro",
      ref: "SL-002291", statutAbonne: "", capex: 118500, aboMoyen: 940, kwc: 62, etatFacture2: "Traitement IA en cours",
      dateSignature: "", dateEdition: daysAgo(1), contratSigne: [], contratNonSigne: [{ url: "#", filename: "contrat-a-signer.pdf" }] },
    /* Le plus ANCIEN des dossiers en attente : il doit sortir EN TÊTE des deux nouveaux
       modèles (tri ascendant). S'il s'affiche en bas, c'est le tri qui est faux. */
    { id: "n7", prenom: "Amandine", nom: "Castéran", partenaire: "Neosoleil", statut: "En attente de solvabilité", offre: "PV seul", creeLe: daysAgo(240), client: "Duo",
      ref: "SL-001845", statutAbonne: "", capex: 16800, aboMoyen: 141, kwc: 7, etatFacture2: "A traiter",
      dateSignature: "", dateEdition: "", contratSigne: [], contratNonSigne: [] },
    { id: "n4", prenom: "Salvatore", nom: "Vizzini", partenaire: "MC ENERGY", statut: "Contrat envoyé et en attente signature", offre: "PV + Batterie Virtuelle", creeLe: daysAgo(15), client: "Solo",
      ref: "SL-002188", statutAbonne: "", capex: 27300, aboMoyen: 232, kwc: 11.5, etatFacture2: "A traiter",
      dateSignature: "", dateEdition: daysAgo(9), contratSigne: [], contratNonSigne: [{ url: "#", filename: "contrat-a-signer.pdf" }] },
    { id: "n5", prenom: "Jocelyne", nom: "Guintrand", partenaire: "MC ENERGY", statut: "Contrat signé", offre: "Batterie seule (sur une installation SunLib)", creeLe: daysAgo(15), client: "Duo",
      ref: "SL-002077", statutAbonne: "Repris", capex: 14900, aboMoyen: 128, kwc: 6, etatFacture2: "Validée",
      dateSignature: daysAgo(6), dateEdition: daysAgo(12), contratSigne: [{ url: "#", filename: "contrat-signe.pdf" }], contratNonSigne: [] },
    { id: "n6", prenom: "Julian", nom: "Maillo Moreno", partenaire: "MC ENERGY", statut: "Dossier finalisé", offre: "Extension PV", creeLe: daysAgo(15), client: "Solo",
      ref: "SL-002050", statutAbonne: "Annulé", capex: 9200, aboMoyen: 84, kwc: 4.5, etatFacture2: "Non conforme",
      dateSignature: daysAgo(8), dateEdition: daysAgo(14), contratSigne: [{ url: "#", filename: "contrat-signe.pdf" }], contratNonSigne: [] },
  ],

  /* ← SELECT_TACHE_PR / SELECT_TACHE_PA : desc / associe / fin / fait / assignee.
     ⚠️ `assignee` mélange l'utilisateur mock (« Frédéric Martin », src/lib/user.tsx) et
     d'autres noms : le journal filtre sur « assigné à moi » (2026-08-07), donc sans ce
     mélange l'aperçu ne montrerait qu'un seul des deux cas. Une tâche `fait: true` est là
     pour vérifier qu'elle reste HORS du journal. */
  tachesPr: [
    { id: "p1", desc: "Rappeler JS Energies après l'envoi de la plaquette", associe: "JS Energies", fin: inDays(-1), fait: false, assignee: "Frédéric Martin" },
    { id: "p2", desc: "Qualifier Aurora Energie (RGE à vérifier)", associe: "Aurora Energie", fin: inDays(3), fait: false, assignee: "Frédéric Martin" },
    { id: "p3", desc: "Envoyer la simulation à Mon Poseur Energie", associe: "Mon Poseur Energie", fin: inDays(9), fait: false, assignee: "Audrey QUINTANA" },
    { id: "p4", desc: "Relance salon MIX.E", associe: "Solaris Habitat", fin: inDays(4), fait: true, assignee: "Frédéric Martin" },
  ],
  tachesPa: [
    { id: "t1", desc: "Relancer pour les pièces du dossier RGE", associe: "MC ENERGY", fin: inDays(-2), fait: false, assignee: "Frédéric Martin" },
    { id: "t2", desc: "Envoyer la grille tarifaire 2026", associe: "FLG SOLAR", fin: inDays(1), fait: false, assignee: "Philippe GERY" },
    { id: "t3", desc: "Point mensuel pipeline", associe: "Neosoleil", fin: inDays(6), fait: false, assignee: "Frédéric Martin" },
    { id: "t4", desc: "Préparer la formation financement", associe: "Mandat Energie", fin: inDays(21), fait: false, assignee: "" },
  ],

  /* ← SELECT_NOTE_INS / SELECT_NOTE_PRO : nom / note / date (+ `proprio` pour les deux, cf. ci-dessous).
     ⚠️ `proprio` MÉLANGE VOLONTAIREMENT trois cas, sans quoi le filtre « mes fiches »
     (actif par défaut, cf. `ownerField`) ne serait pas observable en aperçu :
       · au nom de l'utilisateur mock (« Frédéric Martin », src/lib/user.tsx) — ce qui
         doit RESTER visible ;
       · à d'autres propriétaires — ce qui doit disparaître ;
       · vide — une note dont l'installateur n'est rattaché à personne, écartée aussi.
     Même précaution que pour le mock de « Notification Center » ci-dessous. */
  notesIns: [
    { id: "i1", nom: "WattElse Energies SAS", date: "2025-05-19", note: "Contact via LinkedIn, en attente de retour sur la présentation.", proprio: "Frédéric Martin" },
    { id: "i2", nom: "3J Environnement", date: "2025-11-25", note: "Dossier admin à jour, RGE renouvelé.", proprio: "Philippe GERY" },
    { id: "i3", nom: "Louiseco", date: "2025-08-26", note: "26/08 → présentation faite, très intéressés par l'offre Duo.", proprio: "Frédéric Martin" },
    { id: "i4", nom: "KE Energies", date: "2024-09-16", note: "Introduit par Hanna, premier échange positif.", proprio: "Audrey QUINTANA" },
    { id: "i5", nom: "Aura Sun", date: "2025-11-17", note: "Vu Solar and Storage, à recontacter début décembre.", proprio: "Frédéric Martin" },
    { id: "i6", nom: "renov&sun VIP Montpellier", date: "2025-11-24", note: "RGE et décennale reçus, dossier complet.", proprio: "" },
    { id: "i7", nom: "Gaïa l'Énergie de Demain", date: "2025-05-16", note: "Nouvel email pour la mise en relation avec le pôle études.", proprio: "Frédéric Martin" },
  ],
  notesPro: [
    { id: "p1", nom: "JS Energies", date: "2026-03-25", note: "Tentative d'appel, laissé message, à relancer semaine prochaine.", proprio: "Frédéric Martin" },
    { id: "p2", nom: "Mon Poseur Energie", date: "2025-09-26", note: "Rappel ce jour d'un autre gérant, intéressé par le modèle abonnement.", proprio: "Audrey QUINTANA" },
    { id: "p3", nom: "Aurora Energie", date: "2025-07-08", note: "laurent@aurora-energie.fr — envoi de la plaquette et de la grille.", proprio: "Frédéric Martin" },
    { id: "p4", nom: "LM Energie — Perpignan", date: "2025-07-08", note: "Damien : présentation faite, relance faite.", proprio: "Frédéric Martin" },
    { id: "p5", nom: "ATEXE Group — Montpellier", date: "2025-06-11", note: "Prise de rdv pour le jeudi 19/06.", proprio: "Philippe GERY" },
    { id: "p6", nom: "Voltissima", date: "2025-05-21", note: "OK contrat, va m'envoyer au mois de juin ses premières affaires.", proprio: "Frédéric Martin" },
    { id: "p7", nom: "Enecopro — Thuir (66)", date: "2025-05-19", note: "Ancien associé de Mr Chaufrias, connaît déjà l'offre SunLib.", proprio: "" },
  ],

  /* ← SELECT_CONTACT_INS : contact / prenom / nom / entreprise / mail / tel / service /
     typeContact / commentaire / proprio / creeLe (`contact` est CALCULÉ, cf. `derive`).

     ⚠️ LES PERSONNES ET LES COORDONNÉES SONT INVENTÉES, et les domaines sont en `.example`
     — jamais routable (RFC 2606). Ce n'est pas de la pudeur : depuis le 2026-08-19 les mails
     et les téléphones sont des liens `mailto:` / `tel:` CLIQUABLES, et un mock « réaliste »
     ferait partir un vrai courriel au premier clic d'essai en aperçu. Les noms d'ENTREPRISE,
     eux, sont ceux des autres mocks du fichier : c'est ce qui permet de reconnaître le même
     installateur d'un widget à l'autre.

     Ce que l'échantillon reproduit exprès, parce que la table réelle le porte :
       · TROIS contacts chez le même installateur (MC ENERGY) et DEUX chez un autre — c'est
         la raison d'être du widget, et le seul moyen de voir que le filtre par entreprise
         regroupe au lieu de dédoublonner ;
       · des MULTI-SÉLECTIONS (« Commercial » + « Admin ») : deux pastilles, pas une ;
       · un contact SANS MAIL et un SANS TÉLÉPHONE — les deux creux les plus fréquents ;
       · un contact sans service NI type (la table en compte beaucoup : la ligne doit rester
         lisible, pas se réduire à des tirets) ;
       · un « Secrétariat » SANS PRÉNOM : c'est le cas que `derive` doit rendre sans espace
         parasite devant le nom ;
       · des propriétaires variés, dont l'utilisateur mock (« Frédéric Martin », cf.
         src/lib/user.tsx) : sans ce mélange, activer un jour `ownerField` ne se verrait pas
         en aperçu. */
  contactsIns: [
    { id: "k1", prenom: "Sébastien", nom: "MARCHAND", entreprise: "MC ENERGY", mail: "s.marchand@mc-energy.example", tel: "+33 6 12 34 56 78",
      service: ["Gérant(e)"], typeContact: ["Commercial", "Direction"], proprio: "Frédéric Martin", creeLe: daysAgo(320),
      commentaire: "Interlocuteur unique pour les grilles tarifaires." },
    { id: "k2", prenom: "Nadia", nom: "BELKACEM", entreprise: "MC ENERGY", mail: "n.belkacem@mc-energy.example", tel: "+33 4 90 40 46 62",
      service: ["Administratif", "Comptable"], typeContact: ["Admin", "Finance"], proprio: "Frédéric Martin", creeLe: daysAgo(280),
      commentaire: "" },
    // SANS TÉLÉPHONE : la colonne doit afficher un tiret, pas un lien `tel:` vide.
    { id: "k3", prenom: "Yoann", nom: "PERRET", entreprise: "MC ENERGY", mail: "y.perret@mc-energy.example", tel: "",
      service: ["Technique"], typeContact: ["Technique"], proprio: "Frédéric Martin", creeLe: daysAgo(95),
      commentaire: "Suit les mises en service et les Consuel." },
    { id: "k4", prenom: "Élodie", nom: "RAVEL", entreprise: "Neosoleil", mail: "e.ravel@neosoleil.example", tel: "+33 6 65 09 86 82",
      service: ["Directeur commercial"], typeContact: ["Commercial"], proprio: "Philippe GERY", creeLe: daysAgo(410),
      commentaire: "" },
    { id: "k5", prenom: "Marc", nom: "TEISSIER", entreprise: "Neosoleil", mail: "m.teissier@neosoleil.example", tel: "+33 7 68 57 81 32",
      service: ["Poseur"], typeContact: ["Technique"], proprio: "Philippe GERY", creeLe: daysAgo(150),
      commentaire: "" },
    // SANS MAIL : c'est le contact qu'on ne peut qu'appeler, et il faut le voir.
    { id: "k6", prenom: "Christelle", nom: "AUBRY", entreprise: "FLG SOLAR", mail: "", tel: "+33 6 59 97 19 79",
      service: ["Président"], typeContact: ["Direction"], proprio: "Audrey QUINTANA", creeLe: daysAgo(200),
      commentaire: "Ne répond qu'aux appels, jamais aux mails." },
    // NI SERVICE NI TYPE — la table en compte beaucoup. La ligne reste lisible.
    { id: "k7", prenom: "Idriss", nom: "OUAZZANI", entreprise: "Mandat Energie", mail: "i.ouazzani@mandat-energie.example", tel: "+33 7 61 90 12 65",
      service: [], typeContact: [], proprio: "", creeLe: daysAgo(60), commentaire: "" },
    // SANS PRÉNOM : « Secrétariat » doit sortir seul, sans espace devant (cf. `derive`).
    { id: "k8", prenom: "", nom: "Secrétariat", entreprise: "HDD ENERGIES", mail: "contact@hdd-energies.example", tel: "+33 5 53 20 65 00",
      service: ["Administratif"], typeContact: ["Admin"], proprio: "Ilan LEVY", creeLe: daysAgo(500),
      commentaire: "Boîte partagée : passer par elle pour les pièces de dossier." },
    { id: "k9", prenom: "Amélie", nom: "FONTAINE", entreprise: "Enertec", mail: "a.fontaine@enertec.example", tel: "+33 6 24 51 56 16",
      service: ["Marketing", "Commercial"], typeContact: ["Commercial"], proprio: "Frédéric Martin", creeLe: daysAgo(30),
      commentaire: "" },
  ],

  /* ← SELECT_NOTIF_C. Depuis la refonte du 2026-08-06, ces lignes sont TOUT ce que lit
     le widget « Nouveaux dossiers abonnés » : plus de jointure avec `abonnes`, donc les
     `liens` ne renvoient plus aux lignes mock ci-dessus mais portent des record ids de
     la FORME réelle (`rec` + 14 caractères) — c'est cette forme que le bouton « Détail »
     exige avant de s'afficher.
     L'échantillon reproduit exprès les deux défauts de la table, pour que le filtre et
     le regroupement soient testés sur ce qu'ils rencontreront : une paire de JUMELLES
     (nc1 / nc1b) et une ligne SANS PROPRIÉTAIRE (nc5).
     ⚠️ RAPPEL : `aLire: true` = NON LUE.
     `client` (2026-08-20) porte les TROIS valeurs réelles, dont un Pro et un Solo au nom
     de l'utilisateur mock : sans ça, le réglage « Clientèle » n'aurait rien à filtrer en
     aperçu là où le filtre « mes dossiers » est actif par défaut. La ligne orpheline le
     laisse VIDE, comme la base — c'est le cas non classable. */
  notifC: [
    { id: "nc1", liens: [{ id: "recAAAAAAAAAAAAA1", name: "09185962330167" }], aLire: true, etat: "Non lue", creeLe: daysAgo(1),
      texte: "Nouveau contrat signé pour l'abonné : Mathéo et Lionel RAMBEAUX", nom: "RAMBEAUX",
      partenaire: "HDD ENERGIES", statut: "Contrat envoyé et en attente signature", proprio: "Ilan LEVY", client: "Duo" },
    // ⚠️ La JUMELLE de nc1 (même dossier, même texte, état inverse) : elle doit être
    // regroupée avec elle, et c'est nc1 — encore « à lire » — qui doit rester.
    { id: "nc1b", liens: [{ id: "recAAAAAAAAAAAAA1", name: "09185962330167" }], aLire: false, etat: "Lue", creeLe: daysAgo(1),
      texte: "Nouveau contrat signé pour l'abonné : Mathéo et Lionel RAMBEAUX", nom: "RAMBEAUX",
      partenaire: "HDD ENERGIES", statut: "Contrat envoyé et en attente signature", proprio: "Ilan LEVY", client: "Duo" },
    { id: "nc2", liens: [{ id: "recAAAAAAAAAAAAA2", name: "80000000572270" }], aLire: true, etat: "Non lue", creeLe: daysAgo(2),
      texte: "Nouveau abonné créé pour : Frederic Fouqueteau", nom: "Fouqueteau",
      partenaire: "HORIZON ENERGIE", statut: "En attente de validation technique", proprio: "Fabrice MORVAN", client: "Solo" },
    { id: "nc3", liens: [{ id: "recAAAAAAAAAAAAA3", name: "80000000318842" }], aLire: false, etat: "Lue", creeLe: daysAgo(2),
      texte: "Nouveau abonné créé pour : Sandrine Delaunay", nom: "Delaunay",
      partenaire: "MC ENERGY", statut: "Contrat signé", proprio: "Philippe GERY", client: "Pro" },
    { id: "nc4", liens: [{ id: "recAAAAAAAAAAAAA4", name: "09185962331004" }], aLire: true, etat: "Non lue", creeLe: daysAgo(15),
      texte: "Nouveau abonné créé pour : Julien Charrier", nom: "Charrier",
      partenaire: "Enertec", statut: "Demande d'infos : solvabilité", proprio: "Audrey QUINTANA", client: "Pro" },
    /* ⚠️ AU NOM DE L'UTILISATEUR MOCK (« Frédéric Martin », cf. src/lib/user.tsx) : sans
       elle, le filtre « mes dossiers » écarterait TOUT en aperçu et on ne verrait jamais
       le cas qui fonctionne — seulement l'état vide. Le mock porte donc les deux.
       ⚠️ « Frédéric HUET » est volontairement ABSENT de cet échantillon : c'est le
       faux positif que `ownerIsUser` doit refuser (même prénom, autre personne). Le
       jour où on l'ajoute, il DOIT apparaître dans « à un autre propriétaire ». */
    { id: "nc6", liens: [{ id: "recAAAAAAAAAAAAA6", name: "09185962331188" }], aLire: true, etat: "Non lue", creeLe: daysAgo(4),
      texte: "Nouveau contrat signé pour l'abonné : Claire BONNET", nom: "BONNET",
      partenaire: "Neosoleil", statut: "Contrat signé", proprio: "Frédéric Martin", client: "Solo" },
    /* SECONDE ligne au nom de l'utilisateur mock, et PRO (2026-08-20) : « mes dossiers »
       étant actif par défaut, sans elle le périmètre « Professionnels » ne laisserait
       RIEN en aperçu et on ne saurait pas distinguer un filtre qui marche d'un filtre qui
       vide tout. Les deux périmètres ont donc chacun une ligne, chez la même personne. */
    { id: "nc7", liens: [{ id: "recAAAAAAAAAAAAA7", name: "09185962331402" }], aLire: true, etat: "Non lue", creeLe: daysAgo(6),
      texte: "Nouveau abonné créé pour : Commune de Payssous", nom: "Commune de Payssous",
      partenaire: "FLG SOLAR", statut: "En attente de solvabilité", proprio: "Frédéric Martin", client: "Pro" },
    // ⚠️ SANS PROPRIÉTAIRE : le widget doit l'ÉCARTER et la compter dans « lignes
    // écartées ». C'est le cas des ~380 lignes réelles sans lien vers un abonné.
    { id: "nc5", liens: [], aLire: true, etat: "Non lue", creeLe: daysAgo(15),
      texte: "Nouveau abonné créé pour :  ", nom: "", partenaire: "", statut: "", proprio: "", client: "" },
  ],

  /* ← SELECT_SAV. Échantillon RÉALISTE plutôt qu'aléatoire : il reproduit les
     anomalies que le classeur partenaire porte réellement et que le bloc SAV
     documente (docs/modele-donnees-sav.md §1) — une date de fin antérieure au
     début (s5), un dossier sans installateur (s6), un tiers mandaté sans coût
     rapproché (s7). C'est le seul moyen de voir la ligne « qualité des données »
     du widget faire quelque chose en aperçu.
     ⚠️ `statut`, `fabricant`, `tiers` et `installateur` n'utilisent QUE des valeurs
     déclarées dans le descripteur (§6-bis), lui-même relevé sur Airtable — même
     règle que pour `offre` d'`abonnes`. Les installateurs SAV ne sont PAS ceux des
     mocks notes/abonnés de ce bloc : deux tables, deux vocabulaires. */
  sav: [
    { id: "s1", ticket: "SAV-SL-000412", client: "Toulouse Transit · SL-2291", installateur: "Enertec", debut: daysAgo(3), fin: "", statut: "En cours", priorite: 9, fabricant: "APSYSTEMS", supervision: 2, alerte: 1, tiers: "", cout: 0 },
    { id: "s2", ticket: "SAV-SL-000408", client: "Vizzini Salvatore · SL-2188", installateur: "MC ENERGY", debut: daysAgo(11), fin: "", statut: "En attente", priorite: 8, fabricant: "HUAWEI", onduleurs: 1, cablage: 1, tiers: "INNOVA", cout: 180 },
    { id: "s3", ticket: "SAV-SL-000401", client: "Commune de Payssous · SL-2104", installateur: "Panda Energie", debut: daysAgo(74), fin: "", statut: "En cours", priorite: 6, fabricant: "KOSTAL", panneaux: 3, calepinage: 1, tiers: "", cout: 0 },
    { id: "s4", ticket: "SAV-SL-000397", client: "Guintrand Jocelyne · SL-2077", installateur: "MC ENERGY", debut: daysAgo(38), fin: daysAgo(9), statut: "Résolu", priorite: 4, fabricant: "APSYSTEMS", supervision: 1, raccordement: 1, tiers: "", cout: 0 },
    { id: "s5", ticket: "SAV-SL-000389", client: "Maillo Moreno Julian · SL-2050", installateur: "MC ENERGY", debut: daysAgo(20), fin: daysAgo(41), statut: "Résolu", priorite: 3, fabricant: "HUAWEI", protection: 1, tiers: "", cout: 0 },
    { id: "s6", ticket: "SAV-SL-000381", client: "Laborderie Nicolas · SL-1998", installateur: "", debut: daysAgo(6), fin: "", statut: "Nouveau", priorite: 7, fabricant: "HOYMILES", fuite: 1, tiers: "", cout: 0 },
    { id: "s7", ticket: "SAV-SL-000376", client: "WattElse Energies · SL-1954", installateur: "Eversun", debut: daysAgo(64), fin: "", statut: "En attente", priorite: 5, fabricant: "ENVERTECH", supervision: 3, consuel: 1, tiers: "INNOVA", cout: 0 },
    { id: "s8", ticket: "SAV-SL-000370", client: "Archivolta · SL-1901", installateur: "Archivolta", debut: daysAgo(52), fin: daysAgo(31), statut: "Clos", priorite: 2, fabricant: "HOYMILES", batterie: 1, autre: 1, tiers: "SOLEBAT", cout: 200 },
  ],

  /* ← SELECT_COM. Dossiers du parc, vus par le podium CAPEX. L'échantillon est
     construit pour que le podium ait quelque chose à dire ET que ses gardes se voient :
     · trois commerciaux avec des CAPEX proches (le classement doit être lisible) ;
     · un dossier ANNULÉ (m9) — il compte dans le portefeuille mais pas dans les
       contrats ni le CAPEX ;
     · un dossier SANS contrat joint (m10) — hors portefeuille, donc invisible ;
     · un dossier SANS commercial (m11) → « Non assigné », exclu du podium : ce n'est
       pas une personne, et il finirait régulièrement premier.
     ⚠️ `contratSigne` est une PIÈCE JOINTE : un tableau, pas un booléen. Le mock doit
     donc porter des tableaux, sinon `hasFile` renverrait faux partout et l'aperçu
     montrerait un podium vide. */
  comKpi: (() => {
    /* Fabriqué plutôt qu'écrit à la main : le classement a dix colonnes, dont une
       sparkline sur douze mois — à la main, l'échantillon serait soit minuscule, soit
       illisible. Les VARIATIONS sont voulues et déterministes (aucun `Math.random` :
       un mock qui bouge à chaque rendu rend un défaut d'affichage impossible à
       reproduire) : chaque commercial a son volume, son taux de pose, son délai et sa
       part d'annulations, et deux d'entre eux se tiennent à quelques milliers d'euros
       pour que le podium ait un sens.
       Les trois gardes de `comStats` restent testables : un dossier ANNULÉ, un SANS
       contrat joint (hors portefeuille), un SANS commercial (« Non assigné », exclu). */
    /* TYPE DE CLIENT du mock (2026-08-20) : les TROIS valeurs réelles, réparties de façon
       déterministe (`i % 3`) pour que le réglage « Clientèle » des widgets commerciaux ait
       quelque chose à filtrer en aperçu — et que chacun des trois périmètres rende un
       classement non vide, sinon on ne saurait pas distinguer « filtre qui marche » de
       « échantillon sans Duo ». */
    const CLIENTS = ["Pro", "Solo", "Duo"];
    const gens = [
      { nom: "Edouard Da Silva", n: 26, capex: 153_000, abo: 352, pose: 0.70, delai: 28, annul: 0.08, inst: 4 },
      { nom: "Philippe GERY", n: 24, capex: 164_000, abo: 850, pose: 0.59, delai: 20, annul: 0.07, inst: 3 },
      { nom: "Ilan LEVY", n: 21, capex: 136_000, abo: 282, pose: 0.42, delai: 24, annul: 0.09, inst: 5 },
      { nom: "Julien RAMON", n: 19, capex: 121_000, abo: 137, pose: 0.75, delai: 29, annul: 0.17, inst: 6 },
      { nom: "Frédéric HUET", n: 14, capex: 126_000, abo: 193, pose: 0.83, delai: 22, annul: 0.15, inst: 2 },
      { nom: "Arnaud", n: 11, capex: 125_000, abo: 138, pose: 0.82, delai: 20, annul: 0.09, inst: 3 },
      { nom: "Antoine KELBERT", n: 5, capex: 60_000, abo: 164, pose: 0.70, delai: 37, annul: 0.13, inst: 1 },
    ];
    const rows: Row[] = [];
    gens.forEach((g, gi) => {
      for (let i = 0; i < g.n; i++) {
        const mois = i % 12;                                  // étale sur douze mois
        const annule = i > 0 && i % Math.max(2, Math.round(1 / g.annul)) === 0;
        const pose = !annule && (i % 100) / 100 < g.pose;
        const debut = new Date(); debut.setMonth(debut.getMonth() - mois); debut.setDate(2);
        const signature = new Date(debut); signature.setDate(signature.getDate() + g.delai);
        rows.push({
          id: `m${gi}_${i}`,
          commercial: g.nom,
          capex: g.capex + i * 900,
          contratSigne: [{ url: "#", filename: "contrat.pdf" }],
          statutAbonne: annule ? "Annulé" : "Actif",
          moisSignature: monthAgo(mois),
          aboMoyen: g.abo,
          etatFacture2: pose ? "Validée" : "En attente",
          dateCreation: debut.toISOString(),
          dateSignature: signature.toISOString(),
          installateur: `Installateur ${(i % g.inst) + 1}`,
          kwc: 9 + (i % 7) * 1.5,
          client: CLIENTS[(gi + i) % 3],
          dateEdition: "", contratNonSigne: [],   // signé : donc hors pipeline
        });
      }
    });
    // Les deux lignes qui doivent RESTER INVISIBLES au classement.
    rows.push({ id: "m_nocontrat", commercial: "Philippe GERY", capex: 880_000, contratSigne: [], statutAbonne: "Actif", moisSignature: monthAgo(0), aboMoyen: 200, etatFacture2: "", dateCreation: "", dateSignature: "", installateur: "", kwc: 0, client: "Pro", dateEdition: "", contratNonSigne: [] });
    rows.push({ id: "m_nonassigne", commercial: "", capex: 2_400_000, contratSigne: [{ url: "#", filename: "c.pdf" }], statutAbonne: "Actif", moisSignature: monthAgo(0), aboMoyen: 300, etatFacture2: "Validée", dateCreation: "", dateSignature: "", installateur: "Installateur 1", kwc: 12, client: "Solo", dateEdition: "", contratNonSigne: [] });
    /* PIPELINE : contrat NON signé joint et édition récente. Deux dans la fenêtre de 30
       jours, un HORS fenêtre (édité il y a 60 j) — sans lui, rien ne prouverait que la
       borne est bien appliquée. */
    [4, 18, 60].forEach((jours, i) => {
      const edite = new Date(); edite.setDate(edite.getDate() - jours);
      rows.push({
        id: `m_pipe${i}`, commercial: "Julien RAMON", capex: 118_000 + i * 4000,
        contratSigne: [], contratNonSigne: [{ url: "#", filename: "a-signer.pdf" }],
        statutAbonne: "Actif", moisSignature: "", aboMoyen: 150, etatFacture2: "",
        dateCreation: edite.toISOString(), dateSignature: "", installateur: "Installateur 2",
        kwc: 8.5, client: CLIENTS[i % 3], dateEdition: edite.toISOString(),
      });
    });
    return rows;
  })(),

  /* ← SELECT_EXC_ABO / _PART. Les deux périmètres du registre, calibrés sur ce que les
     tuiles doivent pouvoir dire : des exceptions récentes ET anciennes (fenêtre de 30
     jours), des lignes SANS justificatif (le taux ambre), des statuts partenaire variés
     (dont « Validée », qui alimente sa propre tuile), et plusieurs exceptions sur un même
     dossier comme sur un même partenaire — sinon « exceptions / dossier » vaudrait 1,0 et
     on ne verrait pas si la moyenne se calcule. */
  excAbo: [
    { id: "ea1", dossier: "SL-002104", description: "Dossier ZNI (dont Guadeloupe) : ATTENTION à la TVA applicable.", categorie: "Etude solaire", sousCategorie: "", service: "Service technique", valideur: "Arnaud LANGLOIS", justificatif: [{ url: "#", filename: "j.pdf" }], installateur: "Neosoleil", creeLe: daysAgo(3) },
    { id: "ea2", dossier: "SL-002104", description: "Calepinage modifié après visite technique.", categorie: "Etude solaire", sousCategorie: "Calepinage", service: "Service technique", valideur: "Arnaud LANGLOIS", justificatif: [], installateur: "Neosoleil", creeLe: daysAgo(9) },
    { id: "ea3", dossier: "SL-001998", description: "Contractualisation : envoi du contrat en deux fois.", categorie: "Contractualisation", sousCategorie: "", service: "Service technique", valideur: "Julien RAMON", justificatif: [], installateur: "A.D.W", creeLe: daysAgo(17) },
    { id: "ea4", dossier: "SL-001954", description: "Conditions spéciales Premium appliquées au dossier.", categorie: "Etude solaire", sousCategorie: "", service: "Commerce", valideur: "Arnaud LANGLOIS", justificatif: [], installateur: "Premium Solar", creeLe: daysAgo(44) },
    { id: "ea5", dossier: "SL-001901", description: "TVA Guadeloupe : justificatif fourni par l'installateur.", categorie: "Etude solaire", sousCategorie: "", service: "Service technique", valideur: "Julien RAMON", justificatif: [{ url: "#", filename: "tva.pdf" }], installateur: "CAPEO", creeLe: daysAgo(61) },
  ],
  excPart: [
    { id: "ep1", nom: "Etude solaire", description: "Pour les dossiers CAPEO déposés dans le CRM avant juillet.", categorie: "Etude solaire", sousCategorie: "", service: "Service technique", valideur: "Arnaud LANGLOIS", justificatif: [], installateur: "CAPEO", statut: "Validée", creeLe: daysAgo(1) },
    { id: "ep2", nom: "Contractualisation", description: "Dossiers avant la signature : le contrat est préparé en amont.", categorie: "Contractualisation", sousCategorie: "", service: "Service technique", valideur: "Arnaud LANGLOIS", justificatif: [{ url: "#", filename: "c.pdf" }], installateur: "Premium Solar", statut: "Validée", creeLe: daysAgo(1) },
    /* ⚠️ Les statuts du mock sont les QUATRE options réelles du champ (Brouillon · En
       cours · Validée · Inactif), plus UNE ligne SANS statut : 5 des 15 exceptions
       partenaire n'en portent pas dans le réel, et « Inactif » est là exprès pour que
       l'aperçu montre le badge NEUTRE (le générique le passerait en vert, cf.
       `excStatutVariant`). Un mock qui n'utilise que « Validée » ne le révélerait pas. */
    { id: "ep3", nom: "Etude solaire", description: "Les conditions spéciales Premium s'appliquent au périmètre entier.", categorie: "Etude solaire", sousCategorie: "", service: "Service technique", valideur: "Arnaud LANGLOIS", justificatif: [], installateur: "Premium Solar", statut: "En cours", creeLe: daysAgo(2) },
    { id: "ep4", nom: "Etude solaire", description: "Dossier GUADELOUPE : la TVA en Guadeloupe suit un régime propre.", categorie: "Etude solaire", sousCategorie: "Fiscalité", service: "Service technique", valideur: "Arnaud LANGLOIS", justificatif: [], installateur: "Neosoleil", statut: "", creeLe: daysAgo(5) },
    { id: "ep5", nom: "Contractualisation", description: "Envoi contrat : prévoir l'envoi en recommandé.", categorie: "Contractualisation", sousCategorie: "", service: "Commerce", valideur: "Julien RAMON", justificatif: [], installateur: "A.D.W", statut: "Inactif", creeLe: daysAgo(12) },
    { id: "ep6", nom: "Contrat Grande Distribution", description: "Pas de nécessité de contrat cadre pour ce partenaire.", categorie: "Contractualisation", sousCategorie: "", service: "Service technique", valideur: "Arnaud LANGLOIS", justificatif: [{ url: "#", filename: "gd.pdf" }], installateur: "Premium Solar", statut: "Brouillon", creeLe: daysAgo(28) },
  ],
  /* Les deux PARCS : seul leur NOMBRE de lignes compte (dénominateurs). Assez de lignes
     pour que les pourcentages de couverture ne soient pas absurdes en aperçu. */
  parcAbo: Array.from({ length: 120 }, (_, i) => ({ id: `pa${i}`, ref: `SL-${1000 + i}` })),
  parcPart: Array.from({ length: 40 }, (_, i) => ({ id: `pp${i}`, nom: `Partenaire ${i + 1}` })),
};

/* ============================================================================
   6-bis. COUCHE CATALOG — le registre de données (phase 1 de la cible v2)
   ----------------------------------------------------------------------------
   Un widget ne lit plus une table : il consomme une SOURCE. Trois pièces par
   source — le littéral dans `datasource.define` (§6), le `SELECT_*` (§6), et un
   ADAPTER de 5 lignes ci-dessous — plus une entrée du catalogue `CATALOG` qui la
   décrit (label, champs, mappage proposé) aux widgets configurables à venir.

   ⚠️ La contrainte Softr sur `from` n'est pas contournée, elle est CANALISÉE :
   on n'écrit JAMAIS `<Feed from={x}>`. Chaque adapter appelle `useRecords` avec
   `from = DS.membre` en DIRECT, et `SourceFeed` fait un **dispatch statique**
   (switch) qui monte le bon adapter. Ajouter une source = 1 `case`.
   Monter/démonter des composants entiers est légal pour React : aucun hook n'est
   appelé dans `SourceFeed` lui-même.
   ============================================================================ */
type SourceKey = "abonnes" | "notesIns" | "notesPro" | "tachesPa" | "tachesPr" | "sav" | "notifC" | "comKpi"
  | "excAbo" | "excPart" | "parcAbo" | "parcPart"
  | "contactsIns";   // annuaire des contacts par installateur (2026-08-19)

// Nature d'un champ → sert au rendu (badge, date relative…) et au tri typé.
/* `email` et `phone` ajoutés le 2026-08-19 avec l'annuaire des contacts partenaires : un
   annuaire dont on ne peut ni écrire ni appeler d'un clic oblige à recopier l'adresse à la
   main, et c'est précisément le geste qu'il doit supprimer. Partout ailleurs qu'au rendu
   (`FieldValue`) ils se comportent comme du `text` — tri alphabétique, recherche
   plein-texte, filtres `contains` : aucun autre point du moteur n'a eu à les connaître. */
type FieldKind = "text" | "longtext" | "date" | "badge" | "number" | "bool" | "url"
  | "email" | "phone";
// Champ (par ALIAS) proposé pour chaque rôle d'affichage d'un widget liste.
type FieldRoleMap = { title?: string; sub?: string; date?: string; badge?: string };

/* Descripteur d'un CHAMP. `options` alimente les menus de valeur des formulaires
   (plus de saisie libre pour un statut) ; `variants` donne la couleur de badge par
   valeur métier, avec repli sur l'heuristique `statusVariant` (§3) si la valeur
   n'est pas listée. Les noms de variants sont ceux du kit visuel (`ok`, `warn`, …),
   pas ceux du document cible (`success`, `warning`) : on ne renomme pas le kit. */
type FieldDesc = {
  label: string;
  kind: FieldKind;
  options?: string[];
  variants?: Record<string, BadgeVariant>;
  /* --- CHAMP CALCULÉ (2026-08-18) ------------------------------------------------
     Rempli à partir des AUTRES alias de la ligne au lieu d'être lu dans un select.
     Le cas qui l'a introduit : sur un dossier PRO, « Nom » est vide et c'est « Nom de
     l'entreprise » qui porte le client — une liste mappée sur l'un ou l'autre affiche donc
     des lignes sans titre pour la moitié du parc.
     La règle vit ICI, dans le descripteur, et non dans un widget : « qui est le client »
     est une propriété de la TABLE, et tous les widgets doivent en hériter.
     ⚠️ Appliqué par `deriveRows` dans `feedFor`, donc APRÈS le cache d'instantanés : le
     cache ne garde que ce que la base a rendu, et corriger la règle prend effet sans le
     vider. */
  derive?: (row: Row) => unknown;
  /* CHAMP À PLUSIEURS VALEURS (2026-08-19) — une multi-sélection Airtable, qu'`asText` met à
     plat en « A, B » (§5). Deux conséquences, déclarées ici plutôt que devinées ailleurs :
       · `FieldValue` rend UNE PASTILLE PAR VALEUR, là où « Commercial, Admin » en une seule
         pastille perdait sa couleur (aucune entrée de `variants` ne porte la paire) ;
       · le filtre à cases liste les VALEURS et non leurs combinaisons — sans quoi « Service »
         proposait « Commercial », « Commercial, Admin », « Admin, Commercial »… et cocher
         l'une d'elles ratait les deux autres.
     ⚠️ Le découpage se fait sur la VIRGULE : à ne déclarer que là où la base porte vraiment
     plusieurs valeurs. Sur du texte libre, une raison sociale du genre « MARTIN, SARL » serait
     coupée en deux — c'est pourquoi ce n'est pas déduit du `kind`. */
  multi?: boolean;
  /* `false` = champ ABSENT de la pop-up de détail. Pour un champ calculé qui n'y serait
     qu'un doublon des colonnes dont il est tiré. Il reste utilisable partout ailleurs —
     titre de ligne, colonne, tri, filtre. */
  detail?: boolean;
};

/* Actions PAR LIGNE offertes par une source (§9-ter). Pure donnée : l'exécuteur
   est du code générique. `set` écrit des valeurs fixes, `toggle` inverse un
   booléen, `link` ouvre une URL dont les `{alias}` sont interpolés depuis la ligne
   (`{id}` = recordId). ⚠️ Ce qu'une action peut écrire est borné par le
   `SELECT_*_W` de l'adapter, pas par cette déclaration. */
type ActionDesc =
  | { id: string; label: string; kind: "set"; set: Record<string, unknown>; confirm?: string }
  | { id: string; label: string; kind: "toggle"; field: string }
  | { id: string; label: string; kind: "link"; href: string; target?: "_top" | "_blank" };

/* Formulaire de création rapide (bouton « + » de l'en-tête). `default: "@me.email"`
   est résolu à l'exécution avec l'e-mail de la session. */
type CreateFormDesc = {
  label: string;
  fields: { field: string; required?: boolean; default?: unknown }[];
};

/* Modèle « prêt à poser » proposé dans la galerie. `cfg` est une InstanceCfg
   partielle : elle est passée par `coerceCfg` à la pose, donc les manques sont
   comblés par le descripteur. Elle est COPIÉE dans l'instance (jamais référencée) :
   l'instance est autoportante et survit aux évolutions du catalogue. */
type PresetDesc = {
  label: string; icon?: string; h?: WidgetHeight; cfg: Record<string, unknown>;
  /** `true` = modèle RETIRÉ de la galerie : plus posable, mais toujours DÉCLARÉ ici.
   *  ⚠️ Ne jamais supprimer la ligne d'un preset qu'on retire, la masquer. La clé de
   *  galerie est `"<source>:<index dans ce tableau>"` (cf. `presetsOf`), donc effacer une
   *  entrée décale toutes les suivantes : les widgets déjà posés depuis les presets
   *  d'après pointeraient vers un AUTRE modèle, et la galerie griserait le mauvais
   *  (« un seul exemplaire par modèle » se tromperait de modèle). `hidden` garde l'index
   *  et rend le geste réversible. */
  hidden?: boolean;
};

type SourceDesc = {
  key: SourceKey;
  label: string;
  icon: string;         // CLÉ de la map ICONS — un JSON ne peut pas porter un composant
  connected: boolean;   // false tant que l'ID n'est pas un membre de DS (§6)
  fields: Record<string, FieldDesc>;   // clés = ALIAS du SELECT_*
  defaultSort: { by: string; dir: "asc" | "desc" };
  defaultMap?: FieldRoleMap;
  presets?: PresetDesc[];              // modèles « prêts à poser » (galerie, §10-bis)
  actions?: ActionDesc[];
  create?: CreateFormDesc;
  /* Source TECHNIQUE : consommée par un widget sur-mesure, jamais posée telle quelle.
     Elle est exclue de la galerie — sans ce drapeau, `presetsOf` lui fabriquerait un
     modèle « liste » par défaut, et on proposerait de poser « une liste d'états de
     lecture », ce qui n'a aucun sens pour un utilisateur. */
  technical?: boolean;
  /* Page de l'espace Softr qui porte la FICHE d'une ligne de cette source (slug de
     `PAGES`, §0-bis). Renseignée, la pop-up de détail (`RecordDialog`) propose
     « Ouvrir la fiche complète » avec le record id de la ligne.
     ⚠️ À ne déclarer que si la source EST la table de cette fiche : sinon le record id
     transmis ne désignerait rien et le lien ouvrirait une page vide. C'est pourquoi
     cette information est DÉCLARÉE ici et non déduite du nom de la source. */
  detailPage?: string;
  /* Page de l'espace Softr qui porte la LISTE COMPLÈTE de cette source (slug de `PAGES`,
     §0-bis). Renseignée, tout widget `data` de cette source gagne un pied « Ouvrir dans le
     CRM » qui y renvoie en `target="_top"` (cf. `DataView`).
     Pourquoi ce n'est pas un doublon de `detailPage` : un widget d'accueil montre au mieux
     50 lignes d'une table qui en compte des centaines, avec UN filtre à cases. Le pied est
     la porte de sortie assumée vers l'écran complet — sans elle, celui qui ne trouve pas sa
     ligne n'a aucun chemin, sinon deviner le menu du CRM.
     ⚠️ À ne déclarer que si la page liste RÉELLEMENT cette table : un slug qui montre autre
     chose ferait un lien qui trahit son libellé. */
  listPage?: string;
  /* NOM DE LA PAGE, tel qu'il s'affiche dans le CRM (2026-08-19). Sert de libellé aux deux
     boutons qui y mènent — le pied du widget et, à défaut de `detailPage`, celui de la fiche.
     Pourquoi ce n'est pas cosmétique : « Ouvrir dans le CRM » ne dit pas OÙ, et « Ouvrir la
     fiche complète » sur une page qui est une LISTE dit carrément faux. Nommer la page est la
     seule formulation qui reste vraie dans les deux cas. */
  pageLabel?: string;
  /* --- À QUELLE FRÉQUENCE CETTE SOURCE DOIT-ELLE ÊTRE RELUE ? (2026-08-19) -----------
     C'est le réglage qui décide du COÛT de la page d'accueil, et il est déclaré ici parce que
     la réponse est métier, pas technique.
       · `"jour"` (DÉFAUT) — la PREMIÈRE ouverture de la journée lit la base ; les suivantes
         servent l'instantané (§6-ter) SANS AUCUNE REQUÊTE. Le ⟳ de chaque carte force une
         lecture à tout moment.
       · `"ouverture"` — relu à chaque ouverture de la page, comme avant. À réserver aux
         sources qui portent une FILE À TRAITER : un dossier notifié à 10 h doit se voir à
         10 h 05, pas demain.
     Pourquoi une règle CALENDAIRE et non un délai glissant : un TTL de 24 h laisserait
     quelqu'un qui ouvre à 8 h lundi puis à 9 h mardi travailler sur les chiffres de la veille
     — 23 h d'écart, sous le seuil, et pourtant « hier ». Voir `memeJour`.
     ⚠️ Une source servie par le cache n'expose PAS `write` (cf. `CachedSource`) : ses boutons
     d'écriture disparaissent, par la règle du fichier — mieux vaut pas de bouton qu'un bouton
     qui mente. Les trois sources dans lesquelles ce bloc écrit réellement sont en
     `"ouverture"`, donc rien ne se perd aujourd'hui ; le jour où une action est ajoutée à une
     source en `"jour"`, c'est le premier point à revoir. */
  fraicheur?: "jour" | "ouverture";
  /* « CETTE SOURCE N'A DE SENS QUE LUE EN ENTIER » (2026-08-19). Renseignée, tout widget
     `data` de cette source DRAINE sa pagination, comme s'il portait un filtre (cf. la règle
     de `restreint` dans `DataView`).
     Le cas qui l'a introduite : l'annuaire des contacts fait 1 266 lignes, Softr en rend ~25
     par page, et un annuaire dont la RECHERCHE ne fouille que les 25 premières ne dit pas
     qu'elle a vu 2 % de la table — elle répond « aucun contact » avec l'aplomb d'une réponse
     complète. C'est le défaut le plus coûteux de ce projet, et il n'a ici rien à voir avec un
     agrégat : c'est la RECHERCHE qui mentirait.
     ⚠️ CE N'EST PAS GRATUIT : ~51 allers-retours EN SÉRIE au premier chargement (le cache
     d'instantanés, §6-ter, les rend invisibles au retour sur la page). À ne déclarer que sur
     une source qu'on consulte EN LA CHERCHANT, jamais pour « avoir tout ». */
  drain?: boolean;
  /* ALIAS proposé(s) par défaut comme FILTRE À VALEURS (cases à cocher, multi-sélection)
     dans la barre d'outils d'un widget liste ou tableau. Un alias, ou JUSQU'À TROIS depuis le
     2026-08-19 (`FACETS_MAX`) : l'annuaire des contacts en demande trois, comme la page Softr
     dont il reprend la présentation. À choisir sur les champs par lesquels on trie mentalement
     cette table : l'installateur pour des notes, le partenaire pour des dossiers.
     `undefined` = pas de filtre proposé d'office.
     Les VALEURS ne sont pas listées ici : elles sont déduites des lignes lues
     (`facetValues`), donc un nouvel installateur apparaît sans toucher au code. */
  defaultFacet?: string | string[];
  /* --- ALIAS DU CHAMP « PROPRIÉTAIRE SUNLIB » (2026-08-07) ----------------------
     Renseigné, tout widget de cette source gagne le filtre « seulement les fiches dont
     je suis propriétaire » (`cfg.mine`), ACTIF PAR DÉFAUT, et le rapprochement se fait
     par `ownerIsUser` (§5) — le même que celui des notifications, avec les mêmes limites
     assumées : on compare des MOTS DE NOM, parce que ces champs ne portent aucun e-mail.
     Pourquoi c'est déclaré ici et pas devinable : « propriétaire » s'écrit différemment
     dans chaque table (`Proprietaire (from Installateurs)`, `Propriétaire`…), et une
     source SANS propriétaire ne doit pas offrir un filtre qui viderait la liste.
     ⚠️ Le filtre est appliqué CÔTÉ CLIENT (`selectRows`), sur les lignes déjà lues : un
     lookup ne se filtre pas de façon fiable côté serveur. Corollaire à connaître : il
     réduit ce qui est AFFICHÉ, il n'allège pas la lecture. */
  ownerField?: string;
  /* --- ALIAS DU CHAMP « TYPE DE CLIENT » (2026-08-18) --------------------------
     Renseigné, tout widget de cette source gagne le réglage « Clientèle » (`cfg.clientele`)
     et ses CINQ périmètres — tous · Pro · Particuliers · Solo · Duo (cf. `CLIENTELES`) —,
     à TOUS par défaut : contrairement à « mes fiches », restreindre la clientèle n'est pas
     le besoin le plus courant, c'est une question qu'on se pose ponctuellement.
     Déclaré ici et non deviné : le champ s'appelle « Champs IA Config client » et rend
     « Pro » / « Solo » / « Duo ». Aucune de ces trois valeurs ne dit « particulier » —
     la traduction est faite par `clientKind`, à un seul endroit.
     ⚠️ Trois sources le déclarent aujourd'hui, et TOUTES lisent la même formule :
     `abonnes` (le champ), `comKpi` (le même champ, autre select) et `notifC` (son LOOKUP
     « Champs IA Config client (from Liens BDD) »). */
  clientField?: string;
};

/* Catalogue déclaratif — le « descripteur de source ». Il ne contient JAMAIS de nom
   de champ brut : uniquement des alias (les noms Airtable exacts ne vivent que dans
   les `SELECT_*`, §6) et des données pures : libellés, natures, valeurs possibles,
   couleurs, tri par défaut. Les `options`/`variants` d'`abonnes` sont les VRAIS
   choix des champs Airtable (relevés le 2026-07-31 sur « Statut Dossiers » et
   « Type d installation »). */
const CATALOG: Record<SourceKey, SourceDesc> = {
  abonnes: {
    key: "abonnes",
    label: "Abonnés — BDD Abonné",
    icon: "Bell",
    connected: true,
    // La pop-up de détail proposera « Ouvrir la fiche complète » : cette source EST la
    // table des dossiers abonnés, donc son record id est bien celui qu'attend la fiche.
    detailPage: PAGES.abonne,
    fields: {
      nom: { label: "Nom", kind: "text" },
      prenom: { label: "Prénom", kind: "text" },
      partenaire: { label: "Installateur", kind: "text" },
      statut: {
        label: "Statut dossier", kind: "badge",
        /* ⚠️⚠️ LISTE ENTIÈREMENT REFAITE LE 2026-08-18, relevée sur Airtable ce jour-là
           (champ `fldXvGXjjI0yM1BtU`, 17 choix). L'ancienne datait du 2026-07-31 et
           n'était plus juste : le pipeline a été redécoupé entre-temps. SIX statuts
           qu'elle listait N'EXISTENT PLUS (« Dossier incomplet pour instruction »,
           « Dossier complet pour instruction », « Dossier incomplet pour édition de
           contrat », « Assurance non ok », « Dossier PRO en cours d'étude du service
           technique », « En attente validation »), et NEUF nouveaux manquaient.
           Le doublon « En attente de solvabilité » signalé ici a bien été nettoyé côté
           Airtable : il n'y a plus qu'un choix de ce nom.
           ⚠️ Ce que ça casse ailleurs : le preset « Dossiers incomplets » filtre sur
           `statut contains "incomplet"` — plus AUCUN statut ne contient ce mot, donc ce
           modèle rend une liste vide en permanence. Laissé tel quel : décider ce que
           « incomplet » désigne aujourd'hui est un arbitrage métier, pas une correction.
           ⚠️ Un champ singleSelect ne peut porter QUE ces valeurs : une liste périmée ici
           ne provoque aucune erreur, elle rend seulement des filtres qui ne trouvent rien
           et des badges gris. À revérifier quand le pipeline bouge. */
        options: [
          "Dossier annulé", "Dossier refusé",
          "Refusé : technique et solvabilité", "Refusé : validation technique", "Refusé : solvabilité",
          "Demande d'infos : technique et solvabilité", "Demande d'infos : technique", "Demande d'infos : solvabilité",
          "En attente de validation technique", "En attente de solvabilité", "En attente de validation",
          "Contrat à éditer", "En attente édition contrat",
          "Contrat envoyé et en attente signature", "En attente signature contrat",
          "Contrat signé", "Dossier finalisé",
        ],
        /* Deux familles, deux couleurs, et la distinction n'est pas décorative :
           WARN = la balle est dans NOTRE camp (une info à demander, un contrat à éditer) ;
           INFO = on attend un tiers (solvabilité, validation, signature). Un accueil sert
           à voir ce qu'on doit faire, pas ce qu'on doit subir. */
        variants: {
          "Dossier annulé": "neutral",
          "Dossier refusé": "danger",
          "Refusé : technique et solvabilité": "danger",
          "Refusé : validation technique": "danger",
          "Refusé : solvabilité": "danger",
          "Demande d'infos : technique et solvabilité": "warn",
          "Demande d'infos : technique": "warn",
          "Demande d'infos : solvabilité": "warn",
          "En attente de validation technique": "info",
          "En attente de solvabilité": "info",
          "En attente de validation": "info",
          "Contrat à éditer": "warn",
          "En attente édition contrat": "info",
          "Contrat envoyé et en attente signature": "info",
          "En attente signature contrat": "info",
          "Contrat signé": "ok",
          "Dossier finalisé": "ok",
        },
      },
      /* TYPE DE CLIENT (2026-08-18). Les trois valeurs sont celles que rend la formule —
         « Particulier » n'en est PAS une, c'est notre regroupement (Solo ∪ Duo, cf.
         `clientKind`). Les libellés bruts restent affichés tels quels : une fiche doit
         montrer ce que dit la base, pas notre traduction. */
      client: {
        label: "Type de client", kind: "badge",
        options: ["Pro", "Solo", "Duo"],
        variants: { Pro: "brand", Solo: "info", Duo: "solar" },
      },
      entreprise: { label: "Nom de l'entreprise", kind: "text" },
      /* LE CLIENT, tel qu'il faut l'écrire sur une ligne — la raison sociale pour un pro,
         le nom de famille pour un particulier. Les replis vont dans les deux sens : un pro
         sans raison sociale saisie garde son « Nom » plutôt que de n'avoir plus rien.
         `detail: false` : dans la fiche il ne serait qu'un doublon de « Nom » et de « Nom
         de l'entreprise », qui y figurent déjà l'un et l'autre. */
      clientNom: {
        label: "Client", kind: "text", detail: false,
        derive: (r) => clientKind(r.client) === "pro"
          ? (asText(r.entreprise).trim() || asText(r.nom).trim())
          : (asText(r.nom).trim() || asText(r.entreprise).trim()),
      },
      offre: {
        label: "Type d'installation", kind: "badge",
        options: ["PV seul", "PV + Batterie", "PV + Batterie Virtuelle", "Batterie seule (sur une installation SunLib)", "Extension PV"],
        variants: {
          "PV seul": "info",
          "PV + Batterie": "brand",
          "PV + Batterie Virtuelle": "brand",
          "Batterie seule (sur une installation SunLib)": "solar",
          "Extension PV": "neutral",
        },
      },
      creeLe: { label: "Créé le", kind: "date" },
      /* Champs de la FICHE DÉTAILLÉE (2026-08-06). L'ORDRE DE DÉCLARATION EST L'ORDRE
         D'AFFICHAGE dans la pop-up : identité, puis dossier, puis argent, puis dates,
         puis contrats. Réordonner ici réordonne la fiche — c'est le seul réglage. */
      ref: { label: "Référence dossier", kind: "text" },
      statutAbonne: { label: "Statut de l'abonné", kind: "badge",
                      options: ["Annulé", "Repris", "Refusé"],
                      variants: { "Annulé": "neutral", "Repris": "info", "Refusé": "danger" } },
      capex: { label: "CAPEX HT (€)", kind: "number" },
      aboMoyen: { label: "Abonnement mensuel (€)", kind: "number" },
      kwc: { label: "Puissance (kWc)", kind: "number" },
      etatFacture2: { label: "État facture 2", kind: "badge" },
      dateSignature: { label: "Signé le", kind: "date" },
      dateEdition: { label: "Contrat édité le", kind: "date" },
      // ⚠️ `bool` sur des PIÈCES JOINTES : `FieldValue` traite un tableau non vide comme
      // vrai (`hasFile`), donc la coche dit bien « le PDF est là ».
      contratSigne: { label: "Contrat signé (PDF)", kind: "bool" },
      contratNonSigne: { label: "Contrat en attente (PDF)", kind: "bool" },
    },
    defaultSort: { by: "creeLe", dir: "desc" },
    /* `title: "clientNom"` et non `"nom"` depuis le 2026-08-18 : voir ce champ. Les
       instances DÉJÀ POSÉES gardent le mappage enregistré dans leur cfg — elles
       continueront d'afficher un titre vide sur les dossiers pros jusqu'à ce qu'on repasse
       leur titre sur « Client » dans le ⋮. */
    defaultMap: { title: "clientNom", sub: "partenaire", date: "creeLe", badge: "statut" },
    defaultFacet: "partenaire",   // filtre à cases proposé d'office : par installateur
    /* Modèles prêts à poser — pur JSON. C'est ici qu'on ajoute une vue métier utile
       sans écrire de composant : elle apparaît aussitôt dans la galerie. */
    presets: [
      /* ⚠️ PLUS DE PRESET « Derniers dossiers Abonné » (retiré le 2026-08-06). C'était le
         JUMEAU du widget dédié `notifs` : même liste, même tri, sans l'état de lecture —
         donc deux widgets « dossiers abonné » posables sur le même accueil, dont un seul
         savait dire ce qui avait été vu. Le widget dédié lit désormais « Notification
         Center » et s'appelle « Nouveaux dossiers abonnés » (§9). Les presets qui restent
         font tous quelque chose que lui ne fait pas. */
      { label: "Dossiers incomplets", icon: "ClipboardList",
        cfg: { title: "Dossiers incomplets",
               query: { filter: [{ field: "statut", op: "contains", value: "incomplet" }] } } },
      /* RETIRÉ DE LA GALERIE le 2026-08-18 (demandé : « ne fonctionne pas très bien »).
         L'indicateur comptait les dossiers sur 30 JOURS GLISSANTS via `creeLe` alors que
         son titre annonçait « du mois » — deux périmètres différents sous un seul libellé,
         et un écart de période calculé sur une fenêtre que personne ne lisait comme telle.
         Masqué, pas effacé : la ligne tient l'index 1 des presets d'`abonnes`, dont dépend
         la clé « abonnes:2 » du tableau qui suit (cf. `hidden` sur `PresetDesc`).
         ⚠️ Une instance DÉJÀ POSÉE sur un accueil continue de s'afficher : sa cfg est
         autoportante et `coerceCfg` lit toujours `view.kind: "kpi"`. Elle se retire au ⋮
         du widget, pas ici. */
      { label: "Dossiers du mois (indicateur)", icon: "BarChart3", h: 168, hidden: true,
        cfg: { title: "Dossiers du mois",
               view: { kind: "kpi", agg: "count", dateField: "creeLe", compareDays: 30 } } },
      { label: "Tableau des dossiers", icon: "LayoutGrid",
        cfg: { view: { kind: "table", columns: ["nom", "partenaire", "statut", "creeLe"] } } },
      /* ── AJOUTÉS LE 2026-08-18 (demande) — les deux FILES D'ATTENTE du pipeline.
         Ajoutés EN FIN de tableau, jamais insérés : la clé de galerie est
         « abonnes:<index> » (cf. `hidden` sur `PresetDesc`), donc intercaler déplacerait
         les modèles déjà posés.

         TRI ASCENDANT sur `creeLe`, à l'inverse du reste du bloc, et c'est le point :
         une file d'attente se lit par le HAUT — le dossier qui traîne depuis décembre
         doit passer devant celui d'hier. Trié par le plus récent, un widget d'attente
         montrerait précisément ce dont personne ne s'inquiète.

         « Demande d'infos » est filtré en `contains` parce que le pipeline en compte
         TROIS (technique · solvabilité · les deux) : les énumérer figerait le widget au
         jour où on ajouterait le quatrième. « En attente de solvabilité » est filtré en
         `eq`, et il le faut : `contains "solvabilité"` ramasserait aussi « Refusé :
         solvabilité » et « Demande d'infos : solvabilité » — trois files distinctes sous
         un seul titre. */
      /* ⚠️ MASQUÉS LE JOUR MÊME (`hidden`), remplacés par de VRAIS TYPES — `attSolva` et
         `demInfos` (§10). En modèles du widget générique, ils héritaient de tout son
         formulaire : on pouvait leur changer la source, le filtre, le tri… c'est-à-dire
         leur faire afficher autre chose que ce que leur titre promet. Leur `limit: 20`
         cachait aussi 5 des 25 dossiers en attente, sans le dire.
         Masqués et non supprimés : la clé de galerie est « abonnes:<index> », et effacer
         une ligne déplacerait les modèles suivants (cf. `hidden` sur `PresetDesc`). */
      { label: "Dossiers en demande d'infos", icon: "Inbox", hidden: true,
        cfg: { title: "Demandes d'infos", unit: "dossier",
               query: { filter: [{ field: "statut", op: "contains", value: "Demande d'infos" }],
                        sort: { by: "creeLe", dir: "asc" }, limit: 20 } } },
      { label: "Dossiers en attente de solvabilité", icon: "Clock", hidden: true,
        cfg: { title: "En attente de solvabilité", unit: "dossier",
               query: { filter: [{ field: "statut", op: "eq", value: "En attente de solvabilité" }],
                        sort: { by: "creeLe", dir: "asc" }, limit: 20 } } },
    ],
    // Le champ qui distingue Pro / Solo / Duo → réglage « Clientèle » sur tout widget
    // de cette source (cf. `clientField` sur `SourceDesc`).
    clientField: "client",
    // Pas d'action d'écriture : « Abonnés » n'a pas de select d'écriture (§6).
  },
  notesIns: {
    key: "notesIns",
    label: "Notes installateurs — Suivi client",
    icon: "HardHat",
    connected: true,    // ⚠️ ne passer à true qu'avec l'id dans DS ET un adapter
    fields: {
      nom: { label: "Installateur", kind: "text" },
      note: { label: "Note", kind: "longtext" },
      date: { label: "Date", kind: "date" },
      proprio: { label: "Propriétaire (SunLib)", kind: "text" },
    },
    defaultSort: { by: "date", dir: "desc" },
    defaultMap: { title: "nom", sub: "note", date: "date" },
    defaultFacet: "nom",          // filtre à cases : par installateur
    /* Chacun ne voit QUE ses installateurs (2026-08-07, demandé). Le champ est le lookup
       `Proprietaire (from Installateurs)` de « Suivi client » — cf. SELECT_NOTE_INS, et
       n'oublier ni de le cocher côté Softr ni ce que `ownerField` implique (filtre
       client, rapprochement par nom). */
    ownerField: "proprio",
    presets: [{ label: "Dernières notes — Installateurs", cfg: { title: "Dernières notes — Installateurs", unit: "note" } }],
    /* ⚠️ PAS DE `create`, retiré le 2026-08-04 en ouvrant la lecture en direct. Le
       formulaire fonctionnait techniquement (les trois champs sont dans la whitelist),
       mais « Suivi client » rattache ses notes à l'installateur par un champ LIEN
       (`Installateurs`, multipleRecordLinks) qui attend un RECORD ID, pas un nom. Une
       note créée d'ici serait donc absente de la fiche de l'installateur : l'auteur
       croirait avoir écrit là où personne ne lira. Le jour où le bloc saura résoudre un
       lien (menu alimenté par la table parente), le formulaire revient tel quel. En
       attendant, une note se crée depuis la fiche installateur. */
  },
  notesPro: {
    key: "notesPro",
    label: "Notes prospects — Suivi propect",
    icon: "Target",
    connected: true,
    fields: {
      nom: { label: "Prospect", kind: "text" },
      note: { label: "Note", kind: "longtext" },
      date: { label: "Date", kind: "date" },
      proprio: { label: "Propriétaire (SunLib)", kind: "text" },
    },
    defaultSort: { by: "date", dir: "desc" },
    defaultMap: { title: "nom", sub: "note", date: "date" },
    defaultFacet: "nom",          // filtre à cases : par prospect
    /* Chacun ne voit QUE ses prospects (2026-08-07, demandé). Le champ est le lookup
       « Propriétaire (from Propects) », créé ce jour-là — cf. SELECT_NOTE_PRO. */
    ownerField: "proprio",
    presets: [{ label: "Dernières notes — Prospects", cfg: { title: "Dernières notes — Prospects", unit: "note" } }],
    // Pas de `create` — même raison que pour les notes installateurs : le rattachement
    // au prospect passe par un champ LIEN (`Propects`). `date` est de surcroît un
    // createdTime, donc absent du select d'écriture.
  },
  tachesPa: {
    key: "tachesPa",
    // File à traiter et source écrivable (« Fait ») : relue à chaque ouverture, comme `notifC`.
    fraicheur: "ouverture",
    label: "Tâches partenaires — Taches (Installateurs)",
    icon: "CalendarClock",
    connected: true,
    fields: {
      desc: { label: "Description", kind: "text" },
      associe: { label: "Partenaire associé", kind: "text" },
      fin: { label: "Date de fin", kind: "date" },
      fait: { label: "Fait", kind: "bool" },
      assignee: { label: "Assigné à", kind: "text" },
    },
    // Chacun ne voit que SES tâches (2026-08-07). Cf. `ownerField` (§6-bis).
    ownerField: "assignee",
    defaultSort: { by: "fin", dir: "asc" },
    defaultMap: { title: "desc", sub: "associe", date: "fin" },
    defaultFacet: "associe",      // filtre à cases : par partenaire
    presets: [
      { label: "Tâches partenaires à faire", cfg: { title: "Tâches partenaires", unit: "tâche",
        query: { filter: [{ field: "fait", op: "neq", value: "true" }] },
        actions: { use: ["fait"] } } },
      { label: "Tâches en retard", icon: "CalendarClock", cfg: { title: "Tâches en retard", unit: "tâche",
        query: { filter: [{ field: "fait", op: "neq", value: "true" }] },
        actions: { use: ["fait"] } } },
    ],
    /* PREMIÈRE ÉCRITURE RÉELLE DU BLOC (§9-ter) : cocher « Fait » depuis l'accueil.
       C'est le seul champ de `SELECT_TACHE_PA_W`, donc le seul qu'un widget puisse
       toucher. */
    actions: [{ id: "fait", label: "Fait", kind: "toggle", field: "fait" }],
    /* ⚠️ PAS DE CRÉATION DE TÂCHE, retiré le 2026-08-04. Le formulaire demandait
       `desc`/`associe`/`fin`, tous ABSENTS de la whitelist d'écriture : Softr aurait
       répondu 400 dès le premier essai. Élargir la whitelist ne suffirait pas —
       « Partenaire associé » est un champ LIEN qui attend un record id, pas un nom, et
       une tâche sans partenaire rattaché n'apparaît sur la fiche de personne. Une tâche
       se crée dans /taches, qui sait choisir le partenaire. */
  },
  tachesPr: {
    key: "tachesPr",
    // Idem `tachesPa` : c'est le même widget, il ne peut pas être frais d'un seul côté.
    fraicheur: "ouverture",
    label: "Tâches prospects — Tâches (BDD Propect)",
    icon: "ClipboardList",
    connected: true,
    fields: {
      desc: { label: "Description", kind: "text" },
      associe: { label: "Prospect associé", kind: "text" },
      fin: { label: "Date de fin", kind: "date" },
      fait: { label: "Fait", kind: "bool" },
      assignee: { label: "Assigné à", kind: "text" },
    },
    ownerField: "assignee",
    defaultSort: { by: "fin", dir: "asc" },
    defaultMap: { title: "desc", sub: "associe", date: "fin" },
    defaultFacet: "associe",      // filtre à cases : par prospect
    presets: [
      { label: "Tâches prospects à faire", cfg: { title: "Tâches prospects", unit: "tâche",
        query: { filter: [{ field: "fait", op: "neq", value: "true" }] },
        actions: { use: ["fait"] } } },
    ],
    actions: [{ id: "fait", label: "Fait", kind: "toggle", field: "fait" }],
    // Pas de création — même raison que pour les tâches partenaires (whitelist réduite
    // à `fait`, et « Prospect associé » est un lien).
  },
  /* ── NOTIFICATION CENTER ── Les nouveaux dossiers abonnés, ET leur état de lecture.
     Depuis le 2026-08-06 c'est la SEULE source du widget « Nouveaux dossiers abonnés »
     (§9), qui y lit ses lignes et y écrit « Vu ».
     Source TECHNIQUE : pas de preset, donc absente de la galerie. Non par manque
     d'intérêt, mais parce que la table demande deux traitements qu'un widget générique
     ne sait pas faire (écarter les lignes sans propriétaire, regrouper les jumelles) :
     une « liste de notifications » posée à la main afficherait tout en double.
     ⚠️ Sens de la case inversé : voir SELECT_NOTIF_C. */
  /* ── CONTACTS PARTENAIRES — l'annuaire de la page Softr `contact-partenaire`.
     Branché le 2026-08-19 sur demande : « le même niveau de présentation » que la page du
     CRM, et un chemin de retour vers elle.

     CE QUE LA PAGE SOFTR MONTRE, et ce que le widget en reprend :
       · une recherche plein-texte → `search`, offert par défaut (§9-bis), et qui cherche
         RÉELLEMENT dans les 1 266 lignes grâce à `drain` ci-dessous ;
       · trois filtres à valeurs (Nom Entreprise · Service · Type de contact SunLib) → UN seul
         filtre à cases existe dans le moteur, et c'est l'entreprise qui le mérite : c'est
         ainsi qu'on cherche un contact (« qui appelle-t-on chez MC ENERGY ? »). Les deux
         autres colonnes restent triables, cherchables et filtrables par la grammaire `query`
         (⚠️ en `contains` : ce sont des multi-sélections) ;
       · sept colonnes → six, `contact` fusionnant Prénom et Nom (cf. `derive`) :
         `TABLE_COLS_MAX` en autorise six, et deux colonnes pour un seul nom de personne
         coûtent la largeur du mail dans une carte de demi-page.

     ⚠️ AUCUN `ownerField`, et c'est le choix INVERSE de celui des notes. Un annuaire se
     consulte en entier : on y cherche justement le contact d'un installateur qu'on ne suit
     pas (une astreinte, un remplacement, un dossier repris). Le propriétaire est lu et
     affiché, il ne filtre rien. Pour l'activer un jour : `ownerField: "proprio"` — le filtre
     « mes fiches » apparaîtra alors, ACTIF par défaut (§6-bis).
     ⚠️ Ni action d'écriture ni `create` : un contact se crée sur la fiche de l'installateur,
     qui porte le champ LIEN. Même raison que les notes — un lien attend un record id, pas un
     nom — d'où l'absence de SELECT_CONTACT_INS_W. */
  contactsIns: {
    key: "contactsIns",
    label: "Contacts partenaires — Détails des contacts par installateur",
    icon: "BookUser",
    // ✅ Connectée le 2026-08-19 (`acc8398e-…`, §6). ⚠️ Les dix champs du select doivent être
    //    cochés sur cette connexion — voir l'avertissement au-dessus de `ContactsInsSource`.
    connected: true,
    /* ⚠️ PAS DE `detailPage`, et c'est une CORRECTION du 2026-08-19 : la page
       `contact-partenaire` est une LISTE, elle ignore le record id qu'on lui passerait. Elle
       était d'abord déclarée là, ce qui faisait promettre à la pop-up « Ouvrir la fiche
       complète » pour rendre un tableau de 371 lignes — un bouton juste dans sa destination et
       faux dans son libellé. Le descripteur dit ce que la page SAIT faire, le bouton en
       découle (cf. `RecordDialog`).
       Le jour où l'espace Softr gagne une vraie fiche de contact, une ligne suffit :
       `detailPage: PAGES.<slug de la fiche>` — et le libellé redevient « fiche complète »
       tout seul. */
    listPage: PAGES.contactPartenaire,
    pageLabel: "Contact partenaire",
    // 1 266 lignes, ~25 par page : sans ceci, la recherche du widget ne verrait que 2 % de
    // l'annuaire sans le dire. Voir `drain` sur `SourceDesc` pour ce que ça coûte.
    drain: true,
    fields: {
      /* CALCULÉ — « Prénom Nom », dans cet ordre, et sans espace parasite quand l'un des deux
         manque (les deux cas existent en base : « Secrétariat » sans prénom, un prénom sans
         nom de famille). La règle vit ICI parce qu'une personne se nomme d'une façon : c'est
         une propriété de la TABLE, dont tous les widgets héritent (§6-bis).
         `detail: false` : la fiche montre déjà Prénom et Nom, chacun sur sa ligne. */
      contact: {
        label: "Contact", kind: "text", detail: false,
        derive: (r) => [asText(r.prenom).trim(), asText(r.nom).trim()].filter(Boolean).join(" "),
      },
      prenom: { label: "Prénom", kind: "text" },
      nom: { label: "Nom", kind: "text" },
      entreprise: { label: "Nom Entreprise", kind: "text" },
      mail: { label: "Mail", kind: "email" },
      tel: { label: "Téléphone", kind: "phone" },
      /* Les 16 choix RELEVÉS le 2026-08-19. Les doublons de graphie (« Gerant » / « Gérant » /
         « Gérant(e) », « Directeur général » / « Directeur Général ») sont ceux de la base :
         les recopier tels quels EST le point — un filtre `eq` sur une valeur « harmonisée »
         ne trouverait rien, et le jour où le champ deviendrait écrivable, l'écriture
         échouerait.
         Pas de `variants` : un service n'est pas un ÉTAT, et la charte réserve la couleur au
         sens (même arbitrage que « fabricant » sur le SAV). Ils sortiront donc en neutre. */
      service: {
        label: "Service", kind: "badge", multi: true,
        options: ["Gerant", "Gérant", "Gérant(e)", "Président", "Directeur général",
          "Directeur Général", "Directeur d'Agence", "Directeur commercial",
          "Directeur Commercial", "Commercial", "Administratif", "Comptable",
          "Technique", "Poseur", "Marketing", "Indépendant"],
      },
      /* Ici, au contraire, la couleur DIT quelque chose : à qui l'on parle, et de quoi. Cinq
         choix, cinq variants — c'est le seul champ de cette table qui porte un sens. */
      typeContact: {
        label: "Type de contact SunLib", kind: "badge", multi: true,
        options: ["Admin", "Commercial", "Technique", "Finance", "Direction"],
        variants: { "Admin": "info", "Commercial": "brand", "Technique": "warn",
                    "Finance": "ok", "Direction": "neutral" },
      },
      commentaire: { label: "Commentaire installateur", kind: "longtext" },
      proprio: { label: "Propriétaire (SunLib)", kind: "text" },
      creeLe: { label: "Ajouté le", kind: "date" },
    },
    /* Tri par ENTREPRISE, à l'inverse du reste du bloc qui trie par date : un annuaire se lit
       par installateur, et la date d'ajout d'un contact n'apprend rien à personne. */
    defaultSort: { by: "entreprise", dir: "asc" },
    /* Pas de rôle `date` dans le mappage : « ajouté il y a 240 j » sous un nom de contact est
       du bruit — ce n'est pas un flux, c'est un annuaire. */
    defaultMap: { title: "contact", sub: "entreprise", badge: "typeContact" },
    /* LES TROIS FILTRES DE LA PAGE SOFTR (demandés le 2026-08-19) : entreprise, service, type
       de contact. Dans cet ordre — c'est celui de la page, et c'est aussi l'ordre d'usage : on
       cherche d'abord chez qui, puis à quel service, puis pour quel motif.
       ⚠️ Les deux derniers sont des multi-sélections (`multi` sur leur champ) : le filtre liste
       donc « Commercial » et « Admin » séparément, et cocher « Commercial » trouve bien les
       contacts qui portent les deux. */
    defaultFacet: ["entreprise", "service", "typeContact"],
    /* UN SEUL MODÈLE, et c'est une demande explicite du 2026-08-19 : « un suffit amplement ».
       Une variante en LISTE (demi-carte, trois lignes par contact) a existé quelques minutes
       et a été retirée — pas masquée, parce qu'aucun accueil n'avait encore pu la poser : le
       bloc n'était pas recollé, donc aucune instance ne porte la clé « contactsIns:1 » (c'est
       la seule situation où l'on peut effacer une ligne de preset sans décaler les autres, cf.
       `hidden` sur `PresetDesc`).
       ⚠️ Ne pas « compléter » ce tableau par habitude : la forme d'un widget est décidée à la
       pose et ne se change plus (le choix de vue a été retiré des Options le 2026-08-06). Deux
       modèles pour la même table, c'est donc deux fois la même carte dans la galerie, à charge
       pour l'utilisateur de devenir devin sur la différence. */
    presets: [
      /* Calqué sur la page Softr : six colonnes, l'entreprise en filtre à cases, la recherche
         au-dessus. `h: 560` parce qu'un annuaire a besoin de HAUTEUR et non de largeur — en
         340 px il montre huit lignes sur 1 266.
         `limit: 50` et non les 12 par défaut : on CHERCHE ici, et une recherche qui trouve 30
         contacts ne doit pas en cacher 18. C'est le plafond du moteur (`LIST_LIMIT_MAX`), écrit
         en dur : la constante est déclarée en §9-bis, bien après ce catalogue, et un `const`
         cité avant sa déclaration lèverait une erreur au chargement du bloc. */
      { label: "Contact partenaire", icon: "BookUser", h: 560,
        cfg: { title: "Contact partenaire", unit: "contact",
               query: { limit: 50 },
               view: { kind: "table",
                       columns: ["contact", "entreprise", "mail", "tel", "service", "typeContact"] } } },
    ],
  },
  notifC: {
    key: "notifC",
    /* FILE À TRAITER — relue à CHAQUE ouverture (§6-bis, `fraicheur`). C'est la seule source du
       widget « Nouveaux dossiers abonnés », qui sert à traiter ce qui arrive : un dossier
       notifié à 10 h doit se voir à 10 h 05, pas le lendemain matin. Elle est aussi ÉCRIVABLE
       (« Vu »), et une source servie par le cache n'expose pas `write`. */
    fraicheur: "ouverture",
    label: "Nouveaux dossiers — Notification Center",
    icon: "Inbox",
    connected: true,    // connectée à CE bloc le 2026-08-05 (id dans DS.notifC)
    technical: true,
    fields: {
      liens: { label: "Abonné lié", kind: "text" },
      texte: { label: "Notification", kind: "text" },
      nom: { label: "Nom de l'abonné", kind: "text" },
      partenaire: { label: "Installateur", kind: "text" },
      statut: { label: "Statut du dossier", kind: "badge" },
      proprio: { label: "Propriétaire (SunLib)", kind: "text" },
      aLire: { label: "À lire (case cochée = non lue)", kind: "bool" },
      etat: { label: "Statut de la notification", kind: "badge",
              options: ["Lue", "Non lue"], variants: { "Non lue": "warn", "Lue": "neutral" } },
      /* Type de client du dossier lié (2026-08-20) — mêmes options et mêmes couleurs que
         sur `abonnes` : la même information doit se lire pareil sur les deux écrans. */
      client: { label: "Type de client", kind: "badge",
                options: ["Pro", "Solo", "Duo"],
                variants: { Pro: "brand", Solo: "info", Duo: "solar" } },
      creeLe: { label: "Créée le", kind: "date" },
    },
    defaultSort: { by: "creeLe", dir: "desc" },
    defaultMap: { title: "nom", sub: "texte", date: "creeLe", badge: "statut" },
    /* Déclaré pour la même raison que sur `comKpi` : le widget des notifications porte sa
       propre cfg (`NotifsCfg.clientele`), mais la source LIT le champ — la fiche de détail
       l'affiche, et le catalogue doit dire ce qu'elle sait. */
    clientField: "client",
    // Pas de `presets` : source technique, absente de la galerie (voir presetsOf).
    // Pas d'`actions` : le marquage vit dans le widget dédié, pas en action de ligne.
  },
  /* ── PERFORMANCE COMMERCIALE ── La table « Abonnés » relue sur TOUT LE PARC, en 5
     champs, pour le podium CAPEX (§9-septies). Source TECHNIQUE : elle n'a pas de
     preset, donc pas d'entrée de galerie — poser « une liste de CAPEX » n'aurait aucun
     sens, et surtout ce serait payer une lecture de parc entier pour une liste.
     ⚠️ `connected: true` sans nouvel id : elle lit `DS.abonnes`, déjà connectée. Une
     source du catalogue n'est pas une datasource, c'est une LECTURE — deux entrées
     peuvent viser la même table avec des selects et des volumes différents. */
  /* ── EXCEPTIONS ── Deux périmètres, deux tables (cf. SELECT_EXC_*), plus les deux
     PARCS qui servent de dénominateurs. Toutes techniques : on ne « pose » pas une
     liste d'exceptions depuis la galerie, ce sont les deux widgets du §9-octies qui les
     consomment. ⚠️ Seul le parc partenaire attend encore sa connexion À CE BLOC. */
  excAbo: {
    key: "excAbo",
    label: "Exceptions abonné — Projet solaire",
    icon: "ClipboardList",
    connected: true,    // connectée à CE bloc le 2026-08-05 (id dans DS.excAbo)
    technical: true,
    fields: {
      dossier: { label: "Dossier", kind: "text" },
      description: { label: "Description", kind: "longtext" },
      categorie: { label: "Catégorie", kind: "text" },
      sousCategorie: { label: "Sous-catégorie", kind: "text" },
      service: { label: "Service", kind: "text" },
      valideur: { label: "Valideur", kind: "text" },
      justificatif: { label: "Justificatif", kind: "bool" },
      installateur: { label: "Partenaire", kind: "text" },
      creeLe: { label: "Créée le", kind: "date" },
    },
    defaultSort: { by: "creeLe", dir: "desc" },
  },
  excPart: {
    key: "excPart",
    label: "Exceptions partenaire — Partenaire",
    icon: "Handshake",
    connected: true,    // connectée à CE bloc le 2026-08-05 (id dans DS.excPart)
    technical: true,
    fields: {
      nom: { label: "Exception", kind: "text" },
      description: { label: "Description", kind: "longtext" },
      categorie: { label: "Catégorie", kind: "text" },
      sousCategorie: { label: "Sous-catégorie", kind: "text" },
      service: { label: "Service", kind: "text" },
      valideur: { label: "Valideur", kind: "text" },
      justificatif: { label: "Justificatif", kind: "bool" },
      installateur: { label: "Partenaire", kind: "text" },
      /* ⚠️ LES QUATRE OPTIONS RÉELLES du singleSelect « Statut », relevées sur Airtable
         le 2026-08-04 (`fldnI1T9BvP1C267Y`) : le catalogue annonçait « En attente » et
         « Refusée », qui n'existent pas dans la table — un filtre sur une option absente
         ne rend jamais rien, sans rien dire. « Inactif » est explicitement NEUTRE : voir
         `excStatutVariant`, le générique le classerait « ok » sur son `/actif/`. */
      statut: { label: "Statut", kind: "badge", options: ["Brouillon", "En cours", "Validée", "Inactif"],
                variants: { "Validée": "ok", "En cours": "warn", "Brouillon": "neutral", "Inactif": "neutral" } },
      creeLe: { label: "Créée le", kind: "date" },
    },
    defaultSort: { by: "creeLe", dir: "desc" },
  },
  /* Parc DOSSIERS : `DS.abonnes` relue en UN champ, paginée. C'est le dénominateur de
     « X % du parc » — le compte doit être JUSTE, donc lu, jamais figé. */
  parcAbo: {
    key: "parcAbo",
    label: "Parc dossiers (dénominateur)",
    icon: "Users",
    connected: true,
    technical: true,
    fields: { ref: { label: "Contrat abonné", kind: "text" } },
    defaultSort: { by: "ref", dir: "asc" },
  },
  parcPart: {
    key: "parcPart",
    label: "Parc partenaires (dénominateur)",
    icon: "Handshake",
    connected: true,    // « BDD Installateur » connectée à CE bloc le 2026-08-05
    technical: true,
    fields: { nom: { label: "Nom de l'entreprise", kind: "text" } },
    defaultSort: { by: "nom", dir: "asc" },
  },
  comKpi: {
    key: "comKpi",
    label: "Performance commerciale — Abonnés",
    icon: "Trophy",
    connected: true,
    technical: true,
    fields: {
      commercial: { label: "Commercial", kind: "text" },
      capex: { label: "CAPEX HT", kind: "number" },
      contratSigne: { label: "Contrat signé (pièce jointe)", kind: "bool" },
      statutAbonne: { label: "Statut de l'abonné", kind: "badge" },
      moisSignature: { label: "Mois de signature", kind: "text" },
      aboMoyen: { label: "Abonnement mensuel", kind: "number" },
      etatFacture2: { label: "État facture 2", kind: "badge" },
      dateSignature: { label: "Date de signature", kind: "date" },
      dateCreation: { label: "Date de création", kind: "date" },
      installateur: { label: "Installateur", kind: "text" },
      kwc: { label: "Puissance (kWc)", kind: "number" },
      dateEdition: { label: "Date d'édition du contrat", kind: "date" },
      contratNonSigne: { label: "Contrat en attente (pièce jointe)", kind: "bool" },
      client: { label: "Type de client", kind: "badge",
                options: ["Pro", "Solo", "Duo"],
                variants: { Pro: "brand", Solo: "info", Duo: "solar" } },
    },
    defaultSort: { by: "moisSignature", dir: "desc" },
    /* Les quatre widgets commerciaux (§9-septies) lisent leur périmètre clientèle dans
       LEUR cfg et non dans une `InstanceCfg` — ils ne sont pas des widgets `data`. Ce
       `clientField` ne leur sert donc pas directement ; il est déclaré parce que la source
       PORTE le champ, ce que le catalogue doit dire (fiche de détail, et tout widget `data`
       qu'on poserait un jour dessus). */
    clientField: "client",
  },
  /* ── SAV ── Source du bloc SUNLIB/SAV « Pilotage SAV ». Le descripteur est
     complet (les 22 alias lisibles) alors que le widget d'accueil n'en synthétise
     qu'une poignée : c'est voulu. Le catalogue décrit la SOURCE, pas un écran — et
     tout alias décrit ici devient utilisable par un widget `data` posé depuis la
     galerie, sans une ligne de code (un tableau des dossiers prioritaires, par
     exemple). Les 12 compteurs portent `kind: "number"` : ils deviennent donc
     agrégeables en KPI `sum`/`avg` et filtrables par `gt`/`lt`.
     ⚠️ Vocabulaire FIGÉ. Les `options` ci-dessous sont RELEVÉES SUR AIRTABLE le
     2026-08-03 (base appGKl3XIjDvH0mkr · table Tickets), pas recopiées du README du
     bloc SAV — qui est en retard sur deux champs : il annonce 6 fabricants (il y en
     a 7) et 11 installateurs (il y en a 17). Ne rien inventer ici : `options`
     alimente les menus de valeur des formulaires et des filtres, et une valeur
     absente du champ ferait échouer l'écriture le jour où le SAV deviendra
     écrivable depuis l'accueil.
     ⚠️ Seul `statut` est un `badge` : c'est le seul champ qui porte un ÉTAT. Un
     fabricant ou un installateur en pastille colorée serait de la décoration, et la
     charte réserve la couleur au sens. */
  sav: {
    key: "sav",
    label: "Dossiers SAV — Tickets",
    icon: "Ticket",
    connected: true,    // connectée à CE bloc le 2026-08-04 (cf. la note de SavSource)
    fields: {
      ticket: { label: "Ticket", kind: "text" },
      client: { label: "Client / Centrale", kind: "text" },
      // singleSelect (17 choix). ⚠️ Ce sont les installateurs de la table SAV, PAS
      // ceux des mocks « notes »/« abonnés » de ce bloc — deux vocabulaires distincts.
      installateur: {
        label: "Installateur initial", kind: "text",
        options: [
          "Actenergie", "Maison Solaire Voltalia", "Solefficience", "ACFluide", "Eversun",
          "Amelioration Habitat Conseil", "Rayons Verts Energies", "Aquitaine Transition Energetique",
          "Enertec", "Ecovea", "Archivolta", "Panda Energie", "A.D.W", "MC ENERGY",
          "ABI énergie", "ECOSYSTEM SOLAIRE", "NOVA ENERGIES",
        ],
      },
      debut: { label: "Date de début", kind: "date" },
      fin: { label: "Date de fin", kind: "date" },
      statut: {
        label: "Statut", kind: "badge",
        options: ["Nouveau", "En cours", "En attente", "Résolu", "Clos"],
        // « Clos » en neutral et « Nouveau » en info : ce sont les deux écarts que
        // le bloc SAV a dû ajouter à statusVariant (README SAV §4). Repris tels
        // quels pour que le même statut ait la même couleur sur les deux écrans.
        variants: { "Nouveau": "info", "En cours": "warn", "En attente": "warn", "Résolu": "ok", "Clos": "neutral" },
      },
      priorite: { label: "Priorité (1-10)", kind: "number" },
      // singleSelect (7 choix), tous EN MAJUSCULES dans Airtable — la casse compte
      // pour l'écriture comme pour un filtre `eq`.
      fabricant: {
        label: "Fabricant / matériel", kind: "text",
        options: ["APSYSTEMS", "HUAWEI", "HOYMILES", "KOSTAL", "ENVERTECH", "ATMOCE", "FHE"],
      },
      // singleSelect (2 choix) : les seuls prestataires mandatés à ce jour.
      tiers: { label: "Tiers SAV mandaté", kind: "text", options: ["SOLEBAT", "INNOVA"] },
      cout: { label: "Coût tiers SAV (€)", kind: "number" },
      // Les 12 catégories d'intervention, dans l'ordre figé du classeur.
      panneaux: { label: "Panneaux", kind: "number" },
      onduleurs: { label: "Onduleurs / MO", kind: "number" },
      protection: { label: "Protection électrique", kind: "number" },
      cablage: { label: "Câblage", kind: "number" },
      supervision: { label: "Supervision", kind: "number" },
      raccordement: { label: "Raccordement", kind: "number" },
      consuel: { label: "Consuel", kind: "number" },
      batterie: { label: "Batterie virtuelle", kind: "number" },
      alerte: { label: "Alerte", kind: "number" },
      fuite: { label: "Fuite", kind: "number" },
      calepinage: { label: "Calepinage", kind: "number" },
      autre: { label: "Autre", kind: "number" },
    },
    defaultSort: { by: "debut", dir: "desc" },
    defaultMap: { title: "client", sub: "installateur", date: "debut", badge: "statut" },
    defaultFacet: "installateur", // filtre à cases : par installateur initial
    presets: [
      { label: "Dossiers SAV récents", cfg: { title: "Dossiers SAV", unit: "dossier" } },
      // Seuil 7 et non 8 : `gt` est STRICT, donc « > 7 » = « ≥ 8 », le seuil de
      // priorité élevée du bloc SAV (priority(), p >= 8). Le décaler ici ferait
      // dire deux choses différentes aux deux écrans.
      { label: "Dossiers SAV prioritaires", icon: "Ticket",
        cfg: { title: "SAV — priorité élevée", unit: "dossier",
               query: { filter: [{ field: "priorite", op: "gt", value: "7" }], sort: { by: "priorite", dir: "desc" } } } },
      { label: "Coût tiers SAV (indicateur)", icon: "BarChart3", h: 168,
        cfg: { title: "Coût tiers SAV", view: { kind: "kpi", agg: "sum", field: "cout" } } },
      { label: "Tableau des dossiers SAV", icon: "LayoutGrid",
        cfg: { view: { kind: "table", columns: ["ticket", "client", "statut", "priorite", "debut"] } } },
    ],
    // Aucune action, aucun `create` : un dossier SAV se crée et se modifie dans le
    // bloc « Pilotage SAV », qui porte les validations de cohérence (dates, tiers
    // sans coût). L'accueil en est un LECTEUR — d'où l'absence de SELECT_SAV_W.
  },
};

/* Résolution des icônes : le descripteur porte une CLÉ (donnée), la map porte le
   composant (code). Aucun import dynamique n'est possible dans le bloc, d'où cette
   table — c'est l'illustration du principe « clés en JSON, implémentations en code ».
   Une clé inconnue retombe sur une icône neutre plutôt que de casser le rendu. */
const ICONS: Record<string, LucideIcon> = {
  Bell, CalendarClock, ClipboardList, HardHat, Target, Users, Inbox,
  LayoutGrid, BarChart3, Newspaper, Megaphone, Sparkles, Building2, Briefcase, Ticket,
  // ⚠️ Toute clé citée dans GALLERY_GROUPS doit figurer ici, sinon `iconOf` retombe
  // silencieusement sur l'icône neutre — c'est arrivé à « Utilitaires ».
  Clock, FileSignature, Trophy,
  // Contacts partenaires (2026-08-19) : clé du descripteur `contactsIns` ET du groupe de
  // galerie « Partenaires ». Déjà importée pour le raccourci du même nom (§7).
  BookUser,
};
const iconOf = (key: string): LucideIcon => ICONS[key] ?? LayoutGrid;

/** Couleur de badge d'une valeur métier : `variants` du descripteur d'abord,
 *  heuristique `statusVariant` (§3) en repli. PURE. */
const variantOf = (desc: SourceDesc, alias: string | undefined, value: string): BadgeVariant =>
  (alias ? desc.fields[alias]?.variants?.[value] : undefined) ?? statusVariant(value);

/* ============================================================================
   6-ter. CACHE D'INSTANTANÉS — pourquoi la page n'est plus jamais vide
   ----------------------------------------------------------------------------
   LE PROBLÈME. La page d'accueil est la page la plus visitée du CRM, et elle
   repartait de zéro à CHAQUE visite : la navigation Softr recharge l'iframe, donc
   le cache mémoire de `useRecords` est perdu. Or les onze sources qui agrègent
   DRAINENT leur pagination page par page (`useDrainPages`) — jusqu'à `COM_MAX_PAGES`
   allers-retours EN SÉRIE sur `abonnes` (1 774 lignes), `notifC` (2 142), `sav`
   (~771). Pendant ces secondes-là, la page n'affichait que des squelettes, puis des
   chiffres qui montaient.

   LE CONTRAT. « Stale-while-revalidate » : on sert le dernier instantané complet
   TOUT DE SUITE, on relit en fond, on remplace quand la relecture est TERMINÉE. La
   base reste la source de vérité — l'instantané n'est qu'un point de départ.

   DEUX RÈGLES QUI NE SONT PAS DES DÉTAILS, et qui portent toute la justesse :
   1. On ne SERT l'instantané que tant que la lecture est en cours (`loading ||
      draining`). Dès qu'elle est finie, le live fait autorité MÊME S'IL REND ZÉRO
      LIGNE — sans quoi une table vidée ou un filtre restrictif afficherait
      éternellement des lignes qui n'existent plus.
   2. On n'ÉCRIT l'instantané que sur une lecture COMPLÈTE (`!loading && !draining`).
      Écrire à mi-drainage figerait un agrégat faux, crédible et silencieux —
      exactement le défaut que `draining` a été créé pour signaler, et qui a déjà
      coûté cher au bloc SAV. Un instantané à moitié lu est pire que pas d'instantané.

   LIMITE CONNUE, assumée : l'instantané est écrit UNE FOIS par montage, à la fin de
   la lecture. Une écriture faite ensuite depuis la page (cocher « Fait », marquer une
   notification vue) n'y est donc pas reportée : à la visite suivante, la ligne
   réapparaît dans son ancien état pendant la seconde que dure la relecture. C'est le
   prix du direct, et la relecture le corrige toujours.

   STOCKAGE : localStorage, comme le cache de disposition (§11) — synchrone, donc
   l'affichage est réellement instantané, et `try/catch` partout : quota plein, mode
   privé, iframe au stockage bloqué, tout doit dégrader sans casser la page.
   ⚠️ Ce cache contient des données CRM NOMINATIVES. D'où la clé par e-mail et la
   purge des entrées d'un autre utilisateur au montage (postes partagés).
   ============================================================================ */
const SNAP_PREFIX = "slb-home-snap";
/* ⚠️ Il y avait ici un horodatage GLOBAL (`slb-home-snap-at`), écrit à chaque instantané
   pour alimenter le chip du héro. Il est parti avec lui le 2026-08-18 : chaque widget
   date désormais SES lignes, avec le `at` de SON instantané, remonté par `useSnapshot`.
   Une date « toutes sources confondues » ne voulait de toute façon pas dire grand-chose
   — elle datait la dernière source lue, pas celle qu'on avait sous les yeux.
   Une clé résiduelle sur un poste déjà visité ne gêne rien : elle n'est plus lue, et la
   purge la laisse tranquille (elle ne balaie que les clés en `slb-home-snap:`). */
/* Relever cette version INVALIDE tout le parc de caches d'un coup. À faire le jour où
   la FORME d'une ligne change (et non son contenu) — le hash du select, lui, ne couvre
   que l'ajout, le retrait ou le renommage d'un alias. */
const SNAP_VERSION = 1;
/* Budget par entrée, en CARACTÈRES (localStorage stocke en UTF-16 : ~2 octets pièce).
   ⚠️ CALIBRÉ SUR LES SOURCES RÉELLES, et il a fallu s'y reprendre : à 400 000, les deux
   tables les plus lourdes — `notifC` (2 142 lignes × 9 champs) et `abonnes` (1 774 × 13)
   — dépassaient le plafond et n'étaient donc JAMAIS mises en cache. C'est-à-dire
   exactement les deux qui coûtent 120 requêtes en série : le cache aurait soulagé tout
   sauf ce qui fait mal.
   900 000 les couvre. Le plafond n'en reste pas moins indispensable : il empêche UNE
   source de manger le quota entier, et c'est `evictOldest` qui arbitre le reste.
   ⚠️ Ces tailles sont ESTIMÉES, pas mesurées en production : le poids réel des entrées
   est à relever dans l'inspecteur (Application → Local Storage) à la première recette.
   La trace console ci-dessous donne le chiffre exact le jour où une source est refusée. */
const SNAP_MAX_CHARS = 900_000;
/* Les sources « liste » n'affichent que les N plus récents : garder 80 lignes suffit à
   remplir n'importe lequel de leurs widgets. Les sources DRAINÉES, elles, sont gardées
   entières — c'est tout leur intérêt, un agrégat tronqué serait faux. */
const SNAP_ROWS_LIST = 80;
const SNAP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type Snapshot = { v: number; at: number; rows: Row[] };

/* Hash djb2 des CLÉS du select : si un alias est ajouté, retiré ou renommé, la clé
   change et l'ancienne entrée est ignorée au lieu de servir des lignes dont les champs
   ne correspondent plus à ce que le widget attend. */
function snapSig(select: Record<string, string>): string {
  let h = 5381;
  for (const k of Object.keys(select).sort())
    for (let i = 0; i < k.length; i++) h = ((h * 33) ^ k.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
/* `mode` : deux consommateurs de la MÊME source ne lisent pas la même chose — un widget
   liste tire une page, un widget qui agrège draine tout. Ils ne doivent donc pas
   partager une entrée, sinon l'agrégat se servirait des 80 lignes de la liste. */
const snapKey = (email: string, source: SourceKey, drain: boolean, sig: string): string =>
  `${SNAP_PREFIX}:${email}:${source}:${drain ? "full" : "page"}:${sig}`;

/** Deux horodatages tombent-ils le MÊME JOUR civil (heure locale) ? PURE.
 *  C'est la règle de fraîcheur de `SourceDesc.fraicheur` (§6-bis) : « la première ouverture de
 *  la journée lit la base ». Un délai glissant de 24 h ne dirait pas la même chose — 8 h lundi
 *  puis 9 h mardi font 23 h, et pourtant ce sont les chiffres de la veille. */
const memeJour = (a: number, b: number): boolean => {
  const x = new Date(a), y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
};

/** Combien de temps on attend l'e-mail de la session avant de décider de lire quand même.
 *  ⚠️ Cette attente n'est pas décorative : la clé du cache contient l'e-mail, et Softr rend
 *  souvent l'utilisateur au SECOND render (tout le fichier passe par `?.` pour cette raison).
 *  Décider dès le premier render reviendrait à ne jamais trouver d'instantané, donc à lire à
 *  chaque fois — le cache serait écrit sans jamais servir. Pendant l'attente, le widget montre
 *  ses squelettes ; s'il n'y a pas de session du tout, on lit au bout de ce délai. */
const SESSION_WAIT_MS = 400;

function readSnapshot(key: string): Snapshot | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw) as Snapshot;
    if (!s || s.v !== SNAP_VERSION || !Array.isArray(s.rows)) return null;
    if (!s.at || Date.now() - s.at > SNAP_MAX_AGE_MS) return null;
    return s;
  } catch { return null; }
}

/** Horodatage d'un instantané SANS parser ses lignes.
 *  Une entrée peut peser 900 000 caractères (`SNAP_MAX_CHARS`) : faire un `JSON.parse` complet
 *  sur chacune des dix sources, juste pour lire une date et jeter le résultat, coûterait une
 *  partie de ce que le mécanisme de §6-quater économise. On lit donc l'en-tête seul.
 *  ⚠️ Cela suppose l'ordre de sérialisation de `writeSnapshot` — {"v":…,"at":…,"rows":[…]}.
 *  L'hypothèse est bornée : si la forme ne correspond pas, on paye le parse complet plutôt que
 *  de renoncer au cache. `0` = pas d'instantané utilisable, donc « il faut lire ». */
const readSnapshotStamp = (key: string): number => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return 0;
    const m = /"at":(\d+)/.exec(raw.slice(0, 96));
    if (m) return Number(m[1]);
    return readSnapshot(key)?.at ?? 0;
  } catch { return 0; }
};

/* Une trace par clé, pas une par render : c'est un relevé de calibrage, pas du bruit. */
const snapTooBig = new Set<string>();
/** Écrit l'instantané. Rend `true` s'il a été retenu — `false` s'il dépasse le budget
 *  (la source repartira en squelette à la prochaine visite, et la console le dit une
 *  fois : c'est le relevé qui permettra de recalibrer SNAP_MAX_CHARS). */
function writeSnapshot(key: string, rows: Row[]): boolean {
  let payload: string;
  try {
    payload = JSON.stringify({ v: SNAP_VERSION, at: Date.now(), rows });
  } catch { return false; }
  if (payload.length > SNAP_MAX_CHARS) {
    try { window.localStorage.removeItem(key); } catch { /* rien à retirer */ }
    if (!snapTooBig.has(key)) {
      snapTooBig.add(key);
      console.info(`[SunLib] instantané NON gardé (${Math.round(payload.length / 1000)} k caractères > ${SNAP_MAX_CHARS / 1000} k) : ${key}`);
    }
    return false;
  }
  /* QUOTA PLEIN — on n'abandonne pas du premier coup : localStorage est partagé avec la
     disposition et, un jour, avec ce que d'autres blocs y écriront. On évince le plus
     ANCIEN instantané et on réessaie. Sans cela, le premier remplissage du quota gèlerait
     le cache dans l'état où il se trouve, et l'ordre de montage des widgets déciderait
     silencieusement qui a droit au cache et qui n'y a pas droit.
     Quatre essais : au-delà, ce n'est plus une question de place. */
  for (let essai = 0; essai < 4; essai++) {
    try {
      window.localStorage.setItem(key, payload);
      return true;
    } catch {
      if (!evictOldest(key)) return false;   // plus rien à évincer, ou stockage indisponible
    }
  }
  return false;
}

/** Supprime l'instantané le PLUS ANCIEN (jamais `sauf`, celui qu'on essaie d'écrire).
 *  Les entrées illisibles ou périmées partent en premier — `readSnapshot` les date à 0.
 *  Rend `false` s'il n'y avait plus rien à évincer : c'est la condition d'arrêt. */
function evictOldest(sauf: string): boolean {
  try {
    let vieux = "", quand = Infinity;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || k === sauf || !k.startsWith(`${SNAP_PREFIX}:`)) continue;
      const at = readSnapshot(k)?.at ?? 0;
      if (at < quand) { quand = at; vieux = k; }
    }
    if (!vieux) return false;
    window.localStorage.removeItem(vieux);
    return true;
  } catch { return false; }
}

/** Date+heure courtes d'un instantané — pour le `title` du bouton de relecture, qui doit
 *  dire QUAND et non « il y a combien » : on le lit en survolant, au moment de décider si
 *  ça vaut la peine de relire. */
const fmtStamp = (at: number): string => {
  const d = new Date(at);
  return `${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
};

/** Âge lisible d'un instantané, tourné pour se coller à « Chiffres … » : « de l'instant »,
 *  « d'il y a 12 min », « du 17/08 à 18:04 » au-delà de la journée. Au-delà d'une heure on
 *  cesse de compter en minutes — personne ne lit « il y a 143 min ». */
function snapAge(at?: number): string {
  if (!at) return "de la dernière visite";
  const min = Math.round((Date.now() - at) / 60000);
  if (min < 1) return "de l'instant";
  if (min < 60) return `d'il y a ${min} min`;
  if (min < 24 * 60) return `d'il y a ${Math.round(min / 60)} h`;
  const d = new Date(at);
  return `du ${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

/** Purge au montage : les entrées d'un AUTRE utilisateur (poste partagé), celles d'une
 *  version périmée, et celles qui ont plus de 7 jours. Appelée une fois par `Block()`. */
function purgeSnapshots(email: string): void {
  try {
    const morts: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(`${SNAP_PREFIX}:`)) continue;
      if (!email || !k.startsWith(`${SNAP_PREFIX}:${email}:`)) { morts.push(k); continue; }
      if (!readSnapshot(k)) morts.push(k);          // version ou âge : readSnapshot tranche
    }
    morts.forEach((k) => window.localStorage.removeItem(k));
  } catch { /* stockage inaccessible : rien à purger */ }
}

/* --- RAFRAÎCHIR — UNE SOURCE À LA FOIS, DEPUIS SON WIDGET ---------------------------
   ⚠️ LE BOUTON GLOBAL DU HÉRO A ÉTÉ RETIRÉ le 2026-08-18 (demandé). Il relisait TOUT :
   une dizaine de sources, et jusqu'à 120 requêtes pour certaines, alors que le besoin est
   presque toujours « CE widget-là a bougé, montre-le moi ». Un bouton dont le coût est
   sans rapport avec l'intention est un bouton qu'on n'ose plus cliquer.

   COMMENT ÇA MARCHE. `SourceFeed` tient un `nonce` LOCAL et le passe en `key` :
   l'incrémenter démonte puis remonte l'adapter, donc `useRecords` repart. C'est le seul
   mécanisme qui ne dépende d'AUCUNE hypothèse sur l'API Softr.
   ⚠️ Si Softr s'appuie sur react-query avec un `staleTime` long, un remontage pourrait
   resservir le cache mémoire sans requête. D'où le `refetch()` de secours appelé par
   `useDrainPages` quand le montage fait suite à un rafraîchissement EXPLICITE
   (`nonce > 0`) — jamais au premier montage, où la requête part de toute façon.

   POURQUOI UN CONTEXTE plutôt qu'une prop. `SourceFeed` publie `refresh` dans un contexte
   que la coquille `Widget` consomme : le bouton apparaît donc sur les quinze widgets qui
   lisent une source SANS qu'aucun d'eux soit modifié. Et un widget sans source — horloge,
   pense-bête, liste à cocher, feeds LinkedIn — ne trouve aucun contexte, donc n'a pas de
   bouton. C'est la règle demandée, obtenue par construction plutôt que par une liste à
   tenir à jour.

   WIDGETS À PLUSIEURS SOURCES (les exceptions en lisent quatre) : leurs `SourceFeed` sont
   IMBRIQUÉS, donc chaque niveau COMPOSE avec celui du dessus — un seul bouton, qui les
   relit toutes. Sans cette composition, il n'aurait rafraîchi que la source la plus
   interne et le widget aurait affiché un total mis à jour à moitié. --- */
type SourceRefreshApi = {
  /** Clé de remontage de l'adapter, et déclencheur du `refetch()` de secours. */
  nonce: number;
  refresh: () => void;
  /** Une lecture est en cours sous ce provider — c'est ce qui fait tourner l'icône. */
  busy: boolean;
  /** Date des lignes affichées quand elles viennent du cache (0 sinon), pour le `title`
   *  du bouton : « Instantané du 18/08 à 09:14 — relire ». */
  at: number;
  /** Publié par `useSnapshot`, le seul endroit qui connaisse l'état réel de la lecture.
   *  L'information circule donc de bas en haut, à l'inverse du reste du contexte. */
  publish: (etat: { reading: boolean; at: number }) => void;
};
/* `null` par défaut, et c'est le cœur du mécanisme : hors d'un `SourceFeed`, il n'y a
   RIEN à rafraîchir, et `Widget` n'affiche pas de bouton. */
const SourceRefreshCtx = createContext<SourceRefreshApi | null>(null);

/** Jointure instantané ↔ live, appelée par CHAQUE adapter (§6-bis). Voir le contrat en
 *  tête de section : sert le cache pendant la lecture, l'écrit à la fin, jamais pendant.
 *  Sans e-mail (aperçu non connecté), ne lit ni n'écrit rien. */
function useSnapshot(source: SourceKey, select: Record<string, string>, drain: boolean, live: SourceState): SourceState {
  const email = asText(useCurrentUser()?.email).trim().toLowerCase();
  const key = email ? snapKey(email, source, drain, snapSig(select)) : "";
  const refreshCtx = useContext(SourceRefreshCtx);

  /* Lu UNE SEULE FOIS PAR CLÉ : l'instantané est un point de départ, pas un état vivant.
     Le relire à chaque render le ferait réapparaître après qu'on l'a remplacé par le
     frais. (Le fichier n'emploie pas `useMemo` — un ref dit la même chose.)
     ⚠️ INDEXÉ PAR CLÉ, et ce n'est pas de la coquetterie : en production, Softr rend
     souvent l'utilisateur au SECOND render (le premier n'a pas d'e-mail, cf. le `?.` de
     tout le fichier). Un ref « lu une fois » aurait donc mémorisé `null` pour toujours,
     et le cache n'aurait JAMAIS servi — en passant les tests, puisque le mock local rend
     l'e-mail dès le premier render. */
  const snapRef = useRef<{ key: string; snap: Snapshot | null }>({ key: "\u0000", snap: null });
  if (snapRef.current.key !== key) snapRef.current = { key, snap: key ? readSnapshot(key) : null };
  const snap = snapRef.current.snap;

  /* DEUX ÉTATS, et les confondre coûte dans les deux sens :
       · `sansDonnees` — la lecture n'a encore RIEN de complet à montrer (`loading`), ou son
         total est en cours de constitution (`draining`). C'est LUI, et lui seul, qui autorise à
         servir l'instantané à la place ;
       · `reading` — il se passe quelque chose, RELECTURE COMPRISE (`fetching`). C'est ce que le
         bouton et la barre de la carte doivent montrer.
     Mettre `fetching` dans `serving` ferait réapparaître l'instantané par-dessus des lignes
     fraîches à chaque relecture : le contraire du but. */
  const sansDonnees = live.loading || !!live.draining;
  const reading = sansDonnees || !!live.fetching;
  const serving = !!snap && sansDonnees;

  /* Écriture : une fois par clé, à la fin de la lecture. Indexé par clé pour la même
     raison que la lecture — sinon une lecture terminée AVANT l'arrivée de l'e-mail
     condamnerait la source à ne jamais rien écrire. */
  const ecrit = useRef("");
  useEffect(() => {
    /* `sansDonnees` et non `reading` : on écrit l'instantané dès que la lecture est COMPLÈTE.
       Une relecture en arrière-plan (`fetching`) porte déjà des lignes bonnes à garder. */
    if (!key || sansDonnees || live.error || ecrit.current === key) return;
    ecrit.current = key;
    writeSnapshot(key, drain ? live.rows : live.rows.slice(0, SNAP_ROWS_LIST));
  }, [key, sansDonnees, live.error, live.rows, drain]);

  /* Remontée vers le bouton de la carte : rotation pendant la lecture, et date des lignes
     tant qu'on sert un instantané. `publish` est un `setState` stable, donc absent des
     dépendances — l'y mettre relancerait l'effet à chaque render du provider. */
  const publish = refreshCtx?.publish;
  useEffect(() => {
    publish?.({ reading, at: serving ? snap!.at : 0 });
  }, [reading, serving, snap?.at]);

  if (!serving) return live;
  /* `loading: false` — c'est TOUT le point : les widgets cessent d'afficher leur
     squelette. `partial` / `draining` sont neutralisés : ils qualifient la lecture en
     cours, pas l'instantané complet qu'on affiche à sa place. */
  return { ...live, rows: snap!.rows, loading: false, partial: false, draining: false, stale: true, at: snap!.at };
}

/** `partial` : la lecture est INCOMPLÈTE — plafond de pages atteint alors qu'il en
 *  reste (voir `useDrainPages`). Facultatif parce que la plupart des sources lisent une
 *  seule page et n'ont rien à dire ; mais quand il vaut `true`, un widget qui AGRÈGE
 *  doit le montrer. Un total calculé sur un échantillon ne se distingue pas d'un total
 *  juste : c'est le défaut le plus sournois de ce projet, et il a déjà coûté cher au
 *  bloc SAV (« 60 centrales lues sur 771 », sans erreur ni alerte). */
type SourceState = {
  rows: Row[]; loading: boolean; error: boolean; partial?: boolean;
  /** Lecture du parc EN COURS : il reste des pages et le plafond n'est pas atteint, donc
   *  l'agrégat finira juste — il ne l'est pas encore. À annoncer (cf. `AggregateNote`) :
   *  un total qui monte en silence est indiscernable d'un total faux. */
  draining?: boolean;
  /** Ces lignes viennent du cache et AUCUNE LECTURE N'A ÉTÉ LANCÉE (§6-quater) — à distinguer
   *  de `stale`, qui dit « instantané servi PENDANT une relecture ». La nuance change ce qu'un
   *  widget doit écrire : « mise à jour en cours » est faux ici, il n'y a pas de mise à jour en
   *  cours et il n'y en aura pas avant demain (ou avant un clic sur le ⟳). */
  cached?: boolean;
  /** Une RELECTURE est en cours alors que des lignes sont DÉJÀ affichées (`isFetching` de
   *  l'objet rendu par Softr, distinct d'`isLoading` qui ne couvre que la première requête).
   *  ⚠️ C'EST CE QUI MANQUAIT AU BOUTON « RELIRE » (2026-08-19, signalé : « on a l'impression
   *  qu'il ne fonctionne pas »). Au remontage de l'adapter, Softr rend IMMÉDIATEMENT les lignes
   *  de son cache mémoire : `isLoading` reste donc FAUX, aucun état ne passait à « en cours »,
   *  et ni la rotation de l'icône ni la barre de l'en-tête ne s'allumaient — pour des lignes
   *  identiques, le bouton paraissait inerte alors que la requête repartait bien.
   *  ⚠️ Il ne REMPLACE PAS `loading` : masquer derrière des squelettes des lignes déjà justes,
   *  le temps d'une relecture, serait exactement le recul que le cache d'instantanés a été
   *  écrit pour éviter (§6-ter). Les deux états servent deux choses — l'un le contenu, l'autre
   *  l'accusé de réception. */
  fetching?: boolean;
  /** Ce qui s'affiche vient du CACHE D'INSTANTANÉS (§6-ter), pas de la lecture en
   *  cours : les lignes sont celles de la dernière lecture complète, la relecture est
   *  en route. À DIRE — un chiffre d'hier présenté comme celui de maintenant est le
   *  même défaut qu'un total partiel présenté comme un total. */
  stale?: boolean;
  /** Date (epoch ms) des lignes servies quand `stale` : c'est ce que le widget affiche
   *  pour dater son instantané. Absent sur une lecture fraîche — il vaudrait
   *  « maintenant », ce qui n'apprend rien. */
  at?: number;
};

/* Ce qu'un adapter expose à un widget : les lignes, les états, et — seulement si
   la source déclare un SELECT d'écriture ET qu'une session existe — de quoi
   écrire. `write` ABSENT est le signal « écriture impossible ici » : les widgets
   n'ont pas à savoir pourquoi (source non connectée, aperçu sans session, table
   en lecture seule). */
type SourceWriter = {
  update: (recordId: string, fields: Record<string, unknown>) => Promise<unknown>;
  create?: (values: Record<string, unknown>) => Promise<unknown>;
};
type SourceApi = SourceState & { write?: SourceWriter };
type SourceChildren = (s: SourceApi) => ReactNode;

// Une source est lue en base seulement si le mock global est coupé ET qu'elle est
// réellement connectée (sinon : mock, ou rien — jamais d'appel sur un id absent).
const isLive = (k: SourceKey): boolean => !USE_MOCK && CATALOG[k].connected;

/* NB : l'API Softr expose `isLoading` / `error` (comme le reste du fichier, cf.
   §11 `bddRes.isLoading`) — pas de `status` textuel. */
const liveState = (res: { data?: { pages?: { items: any[] }[] }; isLoading?: boolean; isFetching?: boolean; error?: unknown }): SourceState =>
  /* `isFetching` est lu avec la même prudence que le reste de cette API : s'il est absent de
     l'objet Softr, `fetching` vaut faux et on retombe exactement sur le comportement d'avant —
     le bouton n'aura simplement rien de plus à montrer que son plancher d'accusé de réception
     (cf. `SourceFeed`). */
  ({ rows: flattenRows(res), loading: !!res.isLoading, error: !!res.error, fetching: !!res.isFetching });

const offlineState = (k: SourceKey): SourceState =>
  ({ rows: USE_MOCK ? MOCK_ROWS[k] ?? [] : [], loading: false, error: false });

/* --- Adapters : le SEUL endroit du fichier où une table métier est lue (et écrite).
   Chacun expose un `SourceApi`. Pour une source ÉCRIVABLE, l'adapter monte aussi
   `useRecordUpdate`/`useRecordCreate` avec son `SELECT_*_W` — la whitelist — et
   n'expose `write` QUE si une session existe (sinon Softr refuse, cf. §1). --- */
function AbonnesSource({ children, drain }: { children: SourceChildren; drain?: boolean }) {
  const res = useRecords({ from: DS.abonnes, select: SELECT_ABONNE, orderBy: q.desc("creeLe") });
  const { partial, draining } = useDrainPages(res, COM_MAX_PAGES, !!drain);
  // Pas de `write` : « Abonnés » n'a pas de select d'écriture (choix, §6).
  return <>{children(useSnapshot("abonnes", SELECT_ABONNE, !!drain, { ...liveState(res), partial, draining }))}</>;
}

/* Source hors ligne (mock d'aperçu, ou source pas encore connectée). En APERÇU
   seulement, elle fournit un `write` SIMULÉ : les actions et la création se testent
   sans base, en mutant un état local. En production, une source non connectée n'a
   pas de `write` — mieux vaut un bouton absent qu'un bouton qui ment. */
function OfflineSource({ source, children }: { source: SourceKey; children: SourceChildren }) {
  const [rows, setRows] = useState<Row[]>(() => offlineState(source).rows);
  const write: SourceWriter | undefined = USE_MOCK
    ? {
        update: async (recordId, fields) => {
          console.info("[SunLib] écriture SIMULÉE (aperçu) :", source, recordId, fields);
          setRows((rs) => rs.map((r) => (r.id === recordId ? { ...r, ...fields } : r)));
        },
        create: async (values) => {
          console.info("[SunLib] création SIMULÉE (aperçu) :", source, values);
          setRows((rs) => [{ id: `mock_${Math.random().toString(36).slice(2, 8)}`, ...values } as Row, ...rs]);
        },
      }
    : undefined;
  return <>{children({ rows, loading: false, error: false, write })}</>;
}

/* POUR CONNECTER une source (recette complète : ARCHITECTURE.md §8.4) :
   1) la connecter dans l'onglet Sources du bloc, récupérer son id (onglet Chat) ;
   2) l'ajouter comme membre de `datasource.define` (§6) ;
   3) copier un adapter ci-dessous en changeant `from`/`select`/`orderBy` — et, si la
      source est écrivable, y monter update/create avec son `SELECT_*_W` (§6) ;
   4) ajouter son `case` plus bas ; 5) passer `connected: true` dans CATALOG.

   ⚠️ `orderBy` n'est pas un détail d'affichage : rien n'est paginé ici, donc il
   décide QUELLES lignes sont lues quand la table dépasse la première page. Chaque
   adapter trie donc par la colonne qui garde les lignes UTILES au widget (les plus
   récentes pour des notes, les échéances les plus proches pour des tâches). --- */

/* --- PAGINATION — la seule source qui la fasse, et pourquoi -------------------
   ⚠️⚠️ SOFTR PAGINE `useRecords` : la requête ne rend que la PREMIÈRE page, les
   suivantes n'arrivent QUE si on appelle `fetchNextPage()`. Tous les autres widgets de
   ce bloc affichent « les N plus récents », donc une page leur suffit. Le podium, lui,
   AGRÈGE : sur un échantillon il afficherait un classement faux, sans erreur ni console,
   avec des montants crédibles. C'est le défaut le plus coûteux de la famille — le bloc
   SAV l'a payé (« 60 centrales lues sur 771 »), le bloc KPI aussi.

   Ce hook vide la pagination page par page. Deux gardes qui ne sont pas décoratives :
   · `nPages` (nombre de pages DÉJÀ reçues) EST la dépendance qui fait avancer la
     boucle — `hasNextPage` reste `true` d'une page à l'autre, donc React ne
     relancerait pas l'effet et le chargement s'arrêterait à la deuxième page ;
   · `isFetchingNextPage` empêche de tirer deux pages en parallèle à chaque render.
   Et un PLAFOND, parce qu'une boucle qui dépend de la réponse du serveur doit toujours
   pouvoir s'arrêter : atteint, il rend `partial: true`, que le widget AFFICHE. --- */
/* ⚠️⚠️ RELEVÉ DE 40 À 120 LE 2026-08-06, sur une observation à l'écran : le bandeau
   « Calcul partiel » s'affichait sur le classement commercial alors que la table
   « Abonnés » ne compte que 1 774 lignes (relevé par l'API ce jour-là).

   Ce que ça prouve, par l'arithmétique : 40 pages n'ont pas suffi à lire 1 774 lignes,
   donc une page Softr fait MOINS DE 45 lignes (1774 / 40 = 44,4) — et non les 100 que
   supposait l'ancienne valeur. C'est exactement le cas prévu dans le README §4-F :
   « si le message s'affiche alors que le parc fait moins de 4 000 dossiers, la taille de
   page est plus petite que prévu et il faut relever COM_MAX_PAGES ».

   120 pages couvrent 3 000 lignes à 25 par page — le parc actuel, plus une marge de
   croissance confortable. Le plafond RESTE indispensable : une boucle qui dépend de la
   réponse du serveur doit toujours pouvoir s'arrêter, et `partial` reste affiché s'il est
   atteint. Ne pas le supprimer, seulement le recalibrer.

   ⚠️ CE N'EST PAS GRATUIT : le drainage tire une page par cycle d'effet, donc relever le
   plafond allonge le temps avant qu'un agrégat soit juste (des dizaines d'allers-retours
   sur le parc entier). Les widgets concernés affichent leurs squelettes pendant ce
   temps-là. La vraie sortie serait d'obtenir de plus grandes pages côté API (le mock
   documente un `count`, non vérifié contre Softr) : à tester un jour, pas à supposer. */
const COM_MAX_PAGES = 120;

/* ⚠️ EXPÉRIENCE À MENER SUR LA PAGE PUBLIÉE — LA TAILLE DE PAGE DE SOFTR.
   C'est le levier le moins cher de tout le chantier de performance, et il n'a jamais été
   vérifié : le mock de dev déclare un paramètre `count` sur `useRecords`, mais RIEN ne dit
   que Softr l'honore. S'il le fait, les 120 allers-retours en série d'une source drainée
   tombent à une trentaine — c'est-à-dire plus de gain que tout le cache d'instantanés.

   COMMENT LA MENER, dans cet ordre, sur la page publiée et connecté :
     1. `SOFTR_PAGE_SIZE = 100` et `TRACE_PAGES = true` ci-dessous, puis publier ;
     2. ouvrir la console : chaque source drainée imprime « N pages, M lignes (~X par page) » ;
     3. lire X. Resté à ~25 → Softr ignore `count` : REMETTRE `undefined`, et noter le
        résultat NÉGATIF dans ARCHITECTURE.md §7-9 pour ne pas le retester dans six mois.
        Passé à ~100 → généraliser `count` aux autres adapters drainés et RECALIBRER
        `COM_MAX_PAGES` à la baisse (le plafond doit rester, seulement se resserrer) ;
     4. dans tous les cas, remettre `TRACE_PAGES = false` : onze lignes de console à chaque
        chargement, ce n'est plus un relevé, c'est du bruit.

   ⚠️ Ne pas l'activer « pour voir » sans lire le point 3 : une taille de page changée
   modifie ce que lisent les widgets NON drainés (« les N plus récents »). C'est pourquoi
   `count` n'est branché que sur `parcAbo` — un COMPTEUR à un seul champ, dont aucun widget
   ne dépend pour son contenu. */
const SOFTR_PAGE_SIZE: number | undefined = undefined;
const TRACE_PAGES: boolean = false;

/* `enabled` : on ne draine QUE si le consommateur agrège. Une liste qui montre « les 12
   plus récents » n'a aucun besoin des 1 700 autres lignes, et les tirer coûterait des
   dizaines de requêtes pour rien. Mais dès qu'un widget COMPTE, SOMME ou MOYENNE, la
   fenêtre devient un mensonge : c'est `drain` (voir SourceFeed) qui bascule le même
   adapter d'un mode à l'autre, sans dupliquer de source.
   ⚠️ `enabled: false` rend `partial: false` volontairement : un widget qui n'annonce pas
   de total n'a rien d'incomplet à signaler. Le drapeau ne qualifie pas la lecture, il
   qualifie la PROMESSE du widget. */
function useDrainPages(res: any, maxPages: number, enabled = true): { partial: boolean; draining: boolean } {
  const nPages = Array.isArray(res?.data?.pages) ? res.data.pages.length : 0;
  const hasNext = !!res?.hasNextPage;
  const fetching = !!res?.isFetchingNextPage;
  const canFetch = typeof res?.fetchNextPage === "function";

  /* RAFRAÎCHISSEMENT EXPLICITE — le filet de sécurité du bouton du héro. Le remontage
     par `key` (cf. `SourceFeed`) suffit si `useRecords` relance sa requête au montage ;
     il ne suffit PAS si Softr garde un cache mémoire par-dessus (react-query et son
     `staleTime`). On tire donc un `refetch()` — quand il existe — au premier montage qui
     SUIT un rafraîchissement demandé. Jamais au tout premier (nonce 0) : la requête part
     de toute façon, et on doublerait chaque lecture de la page.
     ⚠️ Rien ne documente la présence de `refetch` sur l'objet rendu par Softr : le `?.`
     est la garde, pas une coquetterie. Si la trace réseau ne montre rien repartir au
     clic, c'est ICI qu'est le point à reprendre. */
  const nonce = useContext(SourceRefreshCtx)?.nonce ?? 0;
  useEffect(() => {
    if (nonce === 0) return;
    if (typeof res?.refetch === "function") { void res.refetch(); return; }
    /* DIAGNOSTIC, et pas du bruit : c'est la seule hypothèse qu'on ne peut pas vérifier depuis
       le code. Si le bouton paraît toujours inerte APRÈS le plancher d'accusé de réception
       (§6-ter) et que cette ligne s'imprime, alors Softr n'expose pas `refetch` et seul le
       remontage a eu lieu — auquel cas la vraie relecture dépend de son `staleTime`, qui ne
       nous appartient pas. Une ligne par clic, jamais au chargement de la page. */
    console.info("[SunLib] relecture : `refetch` absent de l'objet useRecords — seul le remontage de l'adapter a eu lieu.");
  }, []);

  useEffect(() => {
    if (enabled && hasNext && canFetch && !fetching && nPages < maxPages) res.fetchNextPage();
  }, [enabled, hasNext, canFetch, fetching, nPages, maxPages]);
  // Plafond atteint alors qu'il reste des pages : lecture incomplète, à ne jamais taire.
  const partial = enabled && hasNext && nPages >= maxPages;
  /* DRAINAGE EN COURS — il reste des pages, mais le plafond n'est pas atteint : le total
     finira JUSTE, il n'est simplement pas encore complet.
     ⚠️ Sans ce drapeau, un agrégat affiche pendant quelques secondes un chiffre qui MONTE
     à chaque page, sans rien signaler : `isLoading` ne couvre que la première requête, pas
     les suivantes. Un CAPEX lu à mi-chemin est faux — et rien ne le disait. C'est le trou
     que le relèvement du plafond a rendu visible : avant, on finissait par voir « Calcul
     partiel » ; maintenant on lit tout, donc il faut annoncer l'attente au lieu d'une
     troncature. */
  const draining = enabled && hasNext && nPages < maxPages;

  /* TRACE DE DIAGNOSTIC — la TAILLE DE PAGE de Softr n'est écrite nulle part, et c'est
     elle qui décide si `maxPages` est bien calibré. On l'a déduite une fois par
     l'arithmétique (cf. `COM_MAX_PAGES`) ; la prochaine fois, cette ligne la donnera
     directement. Émise UNE SEULE FOIS par montage, et seulement quand le plafond est
     atteint : ce n'est pas du bruit de fonctionnement, c'est le relevé dont on a besoin
     le jour où le bandeau « Calcul partiel » réapparaît. */
  const dit = useRef(false);
  /* `TRACE_PAGES` élargit l'émission à toute lecture TERMINÉE, et pas seulement tronquée :
     c'est ce qui permet de mesurer la taille de page SANS attendre qu'un plafond saute
     (cf. l'expérience documentée sur `SOFTR_PAGE_SIZE`). Faux en fonctionnement normal. */
  const fini = enabled && !hasNext && nPages > 0;
  useEffect(() => {
    if (dit.current || !(partial || (TRACE_PAGES && fini))) return;
    dit.current = true;
    const lignes = (res?.data?.pages ?? []).reduce((n: number, p: any) => n + (p?.items?.length ?? 0), 0);
    const mesure = `${nPages} pages, ${lignes} lignes (~${Math.round(lignes / Math.max(1, nPages))} par page)`;
    console.info(partial
      ? `[SunLib] lecture TRONQUÉE au plafond : ${mesure}. Relever COM_MAX_PAGES.`
      : `[SunLib] lecture complète : ${mesure}.`);
  }, [partial, fini, nPages]);

  return { partial, draining };
}

/* Performance commerciale : `DS.abonnes` relue en entier, 5 champs (cf. SELECT_COM).
   Lecture seule — l'accueil ne modifie pas un dossier abonné. */
function ComKpiSource({ children }: { children: SourceChildren }) {
  const res = useRecords({ from: DS.abonnes, select: SELECT_COM, orderBy: q.desc("moisSignature") });
  const { partial, draining } = useDrainPages(res, COM_MAX_PAGES);
  return <>{children(useSnapshot("comKpi", SELECT_COM, true, { ...liveState(res), partial, draining }))}</>;
}

/* Parc DOSSIERS : même datasource qu'`abonnes`, UN champ, pagination complète. C'est un
   COMPTEUR, pas une liste — d'où le select minimal. */
function ParcAboSource({ children }: { children: SourceChildren }) {
  /* `count` : voir l'expérience documentée sur `SOFTR_PAGE_SIZE`. Sans valeur, l'objet est
     identique à ce qu'il était — la lecture ne change donc pas tant que l'expérience n'est
     pas lancée. Cette source est la bonne cobaye : un seul champ, et c'est un COMPTEUR,
     donc aucun widget n'affiche ses lignes. */
  const res = useRecords({ from: DS.abonnes, select: SELECT_PARC_ABO, ...(SOFTR_PAGE_SIZE ? { count: SOFTR_PAGE_SIZE } : {}) });
  const { partial, draining } = useDrainPages(res, COM_MAX_PAGES);
  return <>{children(useSnapshot("parcAbo", SELECT_PARC_ABO, true, { ...liveState(res), partial, draining }))}</>;
}

/* Les deux périmètres du registre des exceptions, connectés le 2026-08-05. Paginés comme
   ParcAbo, parce que les deux widgets AGRÈGENT (un registre tronqué mentirait sur ses
   totaux). Leur dénominateur `parcPart` est connecté juste en dessous, donc les « X % du
   parc » d'`excKpis` sont désormais chiffrés au lieu de rester muets. */
function ExcAboSource({ children }: { children: SourceChildren }) {
  const res = useRecords({ from: DS.excAbo, select: SELECT_EXC_ABO, orderBy: q.desc("creeLe") });
  const { partial, draining } = useDrainPages(res, COM_MAX_PAGES);
  return <>{children(useSnapshot("excAbo", SELECT_EXC_ABO, true, { ...liveState(res), partial, draining }))}</>;
}
function ExcPartSource({ children }: { children: SourceChildren }) {
  const res = useRecords({ from: DS.excPart, select: SELECT_EXC_PART, orderBy: q.desc("creeLe") });
  const { partial, draining } = useDrainPages(res, COM_MAX_PAGES);
  return <>{children(useSnapshot("excPart", SELECT_EXC_PART, true, { ...liveState(res), partial, draining }))}</>;
}

/* Parc partenaire ← « BDD Installateur », connectée le 2026-08-05. Paginée : c'est le
   dénominateur des « X % du parc », il doit être JUSTE (~510 lignes au 2026-08-04). */
function ParcPartSource({ children }: { children: SourceChildren }) {
  const res = useRecords({ from: DS.parcPart, select: SELECT_PARC_PART });
  const { partial, draining } = useDrainPages(res, COM_MAX_PAGES);
  return <>{children(useSnapshot("parcPart", SELECT_PARC_PART, true, { ...liveState(res), partial, draining }))}</>;
}

function NotesInsSource({ children, drain }: { children: SourceChildren; drain?: boolean }) {
  const res  = useRecords({ from: DS.notesIns, select: SELECT_NOTE_INS, orderBy: q.desc("date") });
  const { partial, draining } = useDrainPages(res, COM_MAX_PAGES, !!drain);
  const updM = useRecordUpdate({ from: DS.notesIns, fields: SELECT_NOTE_INS_W });
  const email = asText(useCurrentUser()?.email).trim();
  const write = email
    ? { update: (recordId: string, fields: Record<string, unknown>) => updM.mutateAsync({ recordId, fields }) }
    : undefined;                        // pas de session → aucune tentative
  return <>{children({ ...useSnapshot("notesIns", SELECT_NOTE_INS, !!drain, { ...liveState(res), partial, draining }), write })}</>;
}

function NotesProSource({ children, drain }: { children: SourceChildren; drain?: boolean }) {
  const res  = useRecords({ from: DS.notesPro, select: SELECT_NOTE_PRO, orderBy: q.desc("date") });
  const { partial, draining } = useDrainPages(res, COM_MAX_PAGES, !!drain);
  const updM = useRecordUpdate({ from: DS.notesPro, fields: SELECT_NOTE_PRO_W });
  const email = asText(useCurrentUser()?.email).trim();
  const write = email
    ? { update: (recordId: string, fields: Record<string, unknown>) => updM.mutateAsync({ recordId, fields }) }
    : undefined;
  return <>{children({ ...useSnapshot("notesPro", SELECT_NOTE_PRO, !!drain, { ...liveState(res), partial, draining }), write })}</>;
}

/* Tâches : `write` porte la PREMIÈRE écriture réelle du bloc — la case « Fait ».
   Sa whitelist ne contient que ce champ, donc c'est tout ce qu'un widget peut
   toucher ici, quoi que puisse déclarer le catalogue. Pas de `create` : voir la
   note « pas de création de tâche » dans le descripteur. */
function TachesPaSource({ children, drain }: { children: SourceChildren; drain?: boolean }) {
  const res  = useRecords({ from: DS.tachesPa, select: SELECT_TACHE_PA, orderBy: q.asc("fin") });
  const { partial, draining } = useDrainPages(res, COM_MAX_PAGES, !!drain);
  const updM = useRecordUpdate({ from: DS.tachesPa, fields: SELECT_TACHE_PA_W });
  const email = asText(useCurrentUser()?.email).trim();
  const write = email
    ? { update: (recordId: string, fields: Record<string, unknown>) => updM.mutateAsync({ recordId, fields }) }
    : undefined;
  return <>{children({ ...useSnapshot("tachesPa", SELECT_TACHE_PA, !!drain, { ...liveState(res), partial, draining }), write })}</>;
}

function TachesPrSource({ children, drain }: { children: SourceChildren; drain?: boolean }) {
  const res  = useRecords({ from: DS.tachesPr, select: SELECT_TACHE_PR, orderBy: q.asc("fin") });
  const { partial, draining } = useDrainPages(res, COM_MAX_PAGES, !!drain);
  const updM = useRecordUpdate({ from: DS.tachesPr, fields: SELECT_TACHE_PR_W });
  const email = asText(useCurrentUser()?.email).trim();
  const write = email
    ? { update: (recordId: string, fields: Record<string, unknown>) => updM.mutateAsync({ recordId, fields }) }
    : undefined;
  return <>{children({ ...useSnapshot("tachesPr", SELECT_TACHE_PR, !!drain, { ...liveState(res), partial, draining }), write })}</>;
}

/* ⚠️⚠️ CAS « SAV », et c'est LE piège qui a été évité de justesse : le bloc
   SUNLIB/SAV lit déjà cette table, mais SON id de datasource (4b5d2aa4-…) NE
   FONCTIONNE PAS ici. Un id de datasource est lié à UNE CONNEXION d'UN bloc, pas à
   une table — le README du bloc SAV le dit noir sur blanc (« l'ID d'un autre bloc
   vibe code ne fonctionne pas, même pour la même table »). L'id ci-dessus
   (3f5f8f6c-…) est bien celui de la connexion DE CE BLOC.

   LECTURE SEULE, volontairement (pas de `write`) : un dossier SAV se saisit dans son
   propre bloc, qui porte les validations de cohérence. Cf. la note du descripteur.

   ⚠️ « Total interventions » (champ FORMULE) est absent de SELECT_SAV, et doit le
   rester : un champ calculé déclaré dans un select fait échouer l'écriture du record
   entier. Le total se resomme côté bloc. Même règle pour tout futur rollup. */
/* PAGINÉ depuis le 2026-08-05, et c'était un BUG, pas un raffinement.
   Cette source ne lisait qu'UNE page. Or `savKpis` AGRÈGE (dossiers ouverts, ancienneté,
   taux de résolution, causes) : ses compteurs portaient donc sur la fenêtre lue et non
   sur la table. Constaté en production : le widget annonçait **6 dossiers ouverts** là
   où le bloc « Pilotage SAV » en comptait **18**.

   Le tri `debut` desc rendait le biais pire qu'un simple sous-comptage : il garde les
   dossiers RÉCENTS, donc il écarte en priorité les plus anciens — précisément ceux que
   l'alerte « ouverts > 60 j » doit trouver. Cette alerte ne s'affichant que si son
   compte est > 0, elle restait muette en paraissant saine. Une alerte qui ne peut
   structurellement pas s'allumer est pire que pas d'alerte.

   On draine donc les pages comme les autres agrégateurs, et `partial` est remonté au
   widget, qui l'AFFICHE : si la lecture n'atteint pas le bout, le chiffre est annoncé
   comme partiel au lieu d'être présenté comme un total. */
function SavSource({ children }: { children: SourceChildren }) {
  const res = useRecords({ from: DS.sav, select: SELECT_SAV, orderBy: q.desc("debut") });
  const { partial, draining } = useDrainPages(res, COM_MAX_PAGES);
  return <>{children(useSnapshot("sav", SELECT_SAV, true, { ...liveState(res), partial, draining }))}</>;
}
/* ── CONTACTS PARTENAIRES — l'annuaire de la page Softr `contact-partenaire`. Connectée le
   2026-08-19 (id propre à CE bloc, cf. §6 : jamais celui d'un autre bloc, même pour la même
   table — c'est la leçon du SAV).

   ⚠️⚠️ PRÉREQUIS AU COLLAGE : les DIX champs de `SELECT_CONTACT_INS` doivent être cochés sur
   la connexion `contactsIns` dans l'onglet Sources. Un champ lu par le code et absent de la
   datasource fait échouer la datasource ENTIÈRE (« New data source does not match / Remap the
   fields »), donc le bloc — pas seulement ce widget. C'est le piège qui a déjà coûté sur
   `notifC` et sur « Champs IA Config client ».

   ⚠️ LECTURE SEULE, comme le SAV : pas de `useRecordUpdate`, donc pas de whitelist
   `SELECT_CONTACT_INS_W`. Un contact se modifie sur la fiche de son installateur, qui porte le
   champ LIEN et les validations.
   ⚠️ 1 266 lignes, ~25 par page : son consommateur DRAINE toujours (`drain: true` au catalogue,
   appliqué par `DataView`), sinon la recherche du widget ne fouillerait que la première page en
   répondant « aucun contact » comme s'il n'y en avait pas. `partial` remonte si le plafond de
   pages est atteint.
   ⚠️ `orderBy` sur `nom` et non sur `entreprise`, alors que le catalogue trie par entreprise :
   le tri d'AFFICHAGE est appliqué côté client (`applyQuery`), et la pagination étant drainée
   en entier, l'ordre de lecture n'a aucune conséquence sur ce qui s'affiche. Reste qu'un
   `orderBy` sur un champ LIEN n'est pas garanti côté Softr, là où le champ primaire l'est :
   autant trier sur ce qui est sûr. */
function ContactsInsSource({ children, drain }: { children: SourceChildren; drain?: boolean }) {
  const res = useRecords({ from: DS.contactsIns, select: SELECT_CONTACT_INS, orderBy: q.asc("nom") });
  const { partial, draining } = useDrainPages(res, COM_MAX_PAGES, !!drain);
  return <>{children(useSnapshot("contactsIns", SELECT_CONTACT_INS, !!drain, { ...liveState(res), partial, draining }))}</>;
}

/* ⚠️ CAS « NOTIFICATION CENTER » — source ÉCRIVABLE, la première du bloc. Connectée le
   2026-08-05 (id propre à CE bloc : onglet Chat, jamais celui d'un autre bloc — cf. la
   note du SAV).

   ⚠️ La table fait 2 142 lignes : `orderBy` desc sur la date décide quelles lignes sont
   lues d'abord, et son SEUL consommateur passe `drain` pour vider la pagination (cf.
   `NotifsCard`) — indispensable depuis que le widget filtre et regroupe ces lignes au
   lieu de simplement y chercher un état. `partial` remonte si le drainage a été coupé. */
function NotifCSource({ children, drain }: { children: SourceChildren; drain?: boolean }) {
  const res  = useRecords({ from: DS.notifC, select: SELECT_NOTIF_C, orderBy: q.desc("creeLe") });
  const { partial, draining } = useDrainPages(res, COM_MAX_PAGES, !!drain);
  const updM = useRecordUpdate({ from: DS.notifC, fields: SELECT_NOTIF_C_W });
  const email = asText(useCurrentUser()?.email).trim();
  const write = email ? {
    update: (recordId: string, fields: Record<string, unknown>) => updM.mutateAsync({ recordId, fields }),
  } : undefined;                       // pas de session → aucune tentative
  return <>{children({ ...useSnapshot("notifC", SELECT_NOTIF_C, !!drain, { ...liveState(res), partial, draining }), write })}</>;
}
/* `drain` : à passer par TOUT consommateur qui agrège (compte, somme, moyenne, ou un
   compteur d'onglet). Les six sources « liste » ne tirent qu'une page par défaut, ce qui
   suffit à afficher « les N plus récents » ; avec `drain`, le même adapter vide la
   pagination et remonte `partial`. Les cinq sources d'agrégat (Performance, Exceptions,
   parcs) et le SAV drainent TOUJOURS : elles n'existent que pour être agrégées.
   ⚠️ Oublier `drain` sur un widget qui compte ne provoque aucune erreur — juste un
   chiffre faux, crédible et silencieux. C'est le bug qu'a connu Pilotage SAV. */
/* Durée MINIMALE pendant laquelle un widget se montre « en cours de relecture » après un clic
   sur son bouton. Une relecture servie par le cache mémoire de Softr peut durer 80 ms : la
   barre et la rotation apparaissent puis disparaissent avant d'avoir été vues, et le bouton
   passe pour inerte — c'est le retour qui a été fait le 2026-08-19.
   Ce plancher n'invente AUCUNE donnée : les lignes affichées restent les vraies, seul l'accusé
   de réception est tenu assez longtemps pour être lu. */
const REFRESH_FLOOR_MS = 650;

function SourceFeed({ source, children, drain }: { source: SourceKey; children: SourceChildren; drain?: boolean }) {
  /* `key={nonce}` sur un Fragment : le bouton de la carte incrémente le nonce, ce qui
     DÉMONTE puis REMONTE l'adapter — donc `useRecords` repart de zéro. La page ne se vide
     pas pour autant : `useSnapshot` relit son instantané au remontage et le sert pendant
     la relecture (§6-ter). */
  const parent = useContext(SourceRefreshCtx);
  const [nonce, setNonce] = useState(0);
  const [etat, setEtat] = useState({ reading: false, at: 0 });
  /* Accusé de réception du clic, indépendant de ce que la source rend (cf. `REFRESH_FLOOR_MS`).
     ⚠️ Le timer est nettoyé au démontage : sans cela, un widget retiré pendant sa relecture
     déclencherait un `setState` sur un composant démonté. */
  const [accuse, setAccuse] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  /* --- FAUT-IL LIRE ? (§6-quater) ---------------------------------------------------
     L'e-mail entre dans la clé du cache : sans lui, aucune décision n'est possible. Il arrive
     souvent au SECOND render (cf. `SESSION_WAIT_MS`), d'où l'attente courte plutôt qu'une
     lecture immédiate qui rendrait le cache inutile. */
  const email = asText(useCurrentUser()?.email).trim().toLowerCase();
  const [sansSession, setSansSession] = useState(false);
  useEffect(() => {
    if (email || sansSession) return;
    const t = window.setTimeout(() => setSansSession(true), SESSION_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [email, sansSession]);

  /* Décision FIGÉE au premier render où l'e-mail est connu, et gardée dans un ref : sans ça un
     widget pourrait basculer du cache à la lecture (ou l'inverse) en cours de vie, et remonter
     deux fois des lignes différentes à son consommateur.
     ⚠️ Indexée par clé, exactement comme le ref de `useSnapshot` et pour la même raison : une
     décision prise avant l'arrivée de l'e-mail resterait figée sur « pas de cache ». */
  const choix = useRef<{ clef: string; snap: Snapshot | null }>({ clef: "\u0000", snap: null });
  const select = SELECT_OF[source];
  const clef = email && select ? snapKey(email, source, !!drain, snapSig(select)) : "";
  if (clef && choix.current.clef !== clef) {
    /* Une source en `"ouverture"` ne consulte même pas son instantané ici : elle en a un, il
       sert pendant sa relecture (§6-ter), mais il ne peut pas la dispenser de lire.
       Ordre volontaire pour les autres : l'HORODATAGE d'abord (une centaine de caractères), le
       parse complet SEULEMENT si la date autorise à servir. Un instantané d'hier ne coûte donc
       pas son `JSON.parse` de 900 000 caractères pour finir jeté. */
    const parJour = CATALOG[source].fraicheur !== "ouverture";
    const stamp = parJour ? readSnapshotStamp(clef) : 0;
    choix.current = { clef, snap: stamp && memeJour(stamp, Date.now()) ? readSnapshot(clef) : null };
  }
  /* `nonce > 0` : le ⟳ de la carte a été cliqué — on lit, quoi qu'en dise le cache. C'est la
     porte de sortie de tout le mécanisme, et la raison pour laquelle il peut être aussi strict.
     ⚠️ `isLive` EN PREMIER, et ce n'est pas une précaution de style : en APERÇU (`USE_MOCK`) ou
     sur une source non connectée, ce composant sert le mock — et un instantané laissé par une
     vraie session sur le même poste passerait devant lui. On travaillerait alors sur des données
     de production dans un écran censé montrer des données fictives, ce qui est le pire des deux
     mondes. Même raison pour l'attente de session juste en dessous : sans base à lire, il n'y a
     rien à attendre. */
  const cache = isLive(source) && nonce === 0 && clef === choix.current.clef ? choix.current.snap : null;
  /* On ne sait pas ENCORE s'il faut lire : squelettes, le temps d'un render ou deux. Lancer la
     lecture « en attendant » annulerait tout le bénéfice, et l'annuler ensuite est impossible. */
  const attenteSession = isLive(source) && !email && !sansSession;

  /* Un `SourceFeed` imbriqué (widget à plusieurs sources) relit AUSSI celles du dessus :
     un bouton qui ne rafraîchirait qu'un quart d'un total serait pire qu'aucun bouton. */
  const refresh = () => {
    parent?.refresh();
    setNonce((n) => n + 1);
    setAccuse(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAccuse(false), REFRESH_FLOOR_MS);
  };
  /* Date affichée = la PLUS ANCIENNE des instantanés servis, pour la même raison qu'un
     total composé se date sur sa source la plus en retard (cf. `AggregateNote`). */
  const at = [etat.at, parent?.at ?? 0].filter(Boolean).sort((a, b) => a - b)[0] ?? 0;
  const api: SourceRefreshApi = {
    nonce, refresh, busy: etat.reading || accuse || !!parent?.busy, at, publish: setEtat,
  };

  /* PAS DE PROVIDER — donc pas de bouton — sur une source qui ne lit pas la base : en
     production, une table non connectée sert son mock (`offlineState`), et un bouton
     « relire » proposerait de relire des lignes écrites en dur. Mieux vaut pas de bouton
     qu'un bouton qui ment, c'est la règle que suit déjà `write` sur ces sources.
     ⚠️ EN APERÇU (`USE_MOCK`), le bouton est au contraire CONSERVÉ : c'est le seul endroit
     où l'on peut vérifier son allure et sa place dans l'en-tête, exactement comme les
     écritures y sont simulées plutôt que masquées. */
  if (!isLive(source) && !USE_MOCK) return <>{feedFor(source, children, drain)}</>;

  /* TROIS chemins, et un seul monte un `useRecords` :
       · attente de la session → squelettes, aucune requête ;
       · instantané du jour → `CachedSource`, aucune requête ;
       · sinon → l'adapter, qui lit (et draine) comme avant.
     Le `key={nonce}` reste sur le Fragment : c'est lui qui démonte-remonte l'adapter au clic sur
     le ⟳, et c'est aussi ce qui fait passer du chemin « cache » au chemin « lecture ». */
  return (
    <SourceRefreshCtx.Provider value={api}>
      <Fragment key={nonce}>
        {attenteSession
          ? children({ rows: [], loading: true, error: false })
          : cache
            ? <CachedSource source={source} snap={cache}>{children}</CachedSource>
            : feedFor(source, children, drain)}
      </Fragment>
    </SourceRefreshCtx.Provider>
  );
}

/** Ajoute aux lignes les champs CALCULÉS du descripteur (`derive`, §6-bis). PURE.
 *  Rend le tableau d'origine si la source n'en déclare aucun — la quasi-totalité des cas,
 *  et il n'y a alors rien à payer. */
const deriveRows = (k: SourceKey, rows: Row[]): Row[] => {
  const calc = Object.entries(CATALOG[k].fields).filter(([, f]) => f.derive);
  if (!calc.length) return rows;
  return rows.map((r) => {
    const o: Row = { ...r };
    for (const [alias, f] of calc) o[alias] = f.derive!(r);
    return o;
  });
};

/** Enveloppe le consommateur d'une source pour lui livrer les lignes AVEC leurs champs
 *  calculés (`derive`, §6-bis). PURE.
 *  ⚠️⚠️ LE PARAMÈTRE S'APPELLE `recoit` ET N'EST JAMAIS RÉASSIGNÉ, et ce n'est pas une
 *  question de style. La première version faisait :
 *      const enrichi = (s) => children({ ...s, rows: derive(s.rows) });
 *      children = enrichi;
 *  Une closure capture la VARIABLE, pas sa valeur : après la réassignation, `enrichi`
 *  s'appelait donc LUI-MÊME. « Maximum call stack size exceeded » au premier rendu, sur
 *  une ligne qui se lit comme un simple aiguillage. */
const withDerived = (source: SourceKey, recoit: SourceChildren): SourceChildren =>
  (s) => recoit({ ...s, rows: deriveRows(source, s.rows) });

/* ============================================================================
   6-quater. LECTURE ÉVITÉE — le cache décide s'il faut appeler la base
   ----------------------------------------------------------------------------
   CE QUE §6-ter NE FAISAIT PAS. Le cache d'instantanés est un cache d'AFFICHAGE :
   il sert les lignes de la dernière lecture complète, puis relit TOUJOURS. Il
   supprime l'attente, pas les requêtes. Or les sources drainées coûtent des
   dizaines d'allers-retours EN SÉRIE chacune (≈ 350 à 450 pour un accueil qui
   porte tous les widgets, à la taille de page déduite de ~25 lignes), et cela à
   CHAQUE ouverture de la page — celle qu'on visite dix fois par jour.

   LA RÈGLE, arbitrée le 2026-08-19 : la donnée doit être fraîche à la première
   ouverture de la journée ; ensuite, l'instantané suffit. Elle est DÉCLARÉE PAR
   SOURCE (`fraicheur`, §6-bis) parce que la réponse est métier : les deux files à
   traiter — notifications de dossiers et journal des tâches — restent relues à
   chaque ouverture, un dossier arrivé à 10 h devant se voir à 10 h 05.

   COMMENT. `SourceFeed` calcule la clé du cache AVANT de monter l'adapter (d'où la
   table `SELECT_OF` : la clé contient le hash du select). Si l'instantané est du
   jour, l'adapter n'est PAS monté du tout — donc `useRecords` n'existe pas, donc
   aucune requête ne part. Le ⟳ de la carte incrémente le `nonce`, ce qui force la
   lecture : c'est le même mécanisme qu'avant, avec une raison de plus d'exister.

   ⚠️ CE QUI RESTE VRAI ET DOIT LE RESTER : rien n'est servi qui ne soit annoncé. Un
   widget d'agrégat affiche « Instantané » (`AggregateNote`), une liste écrit la date
   de ses lignes dans son sous-titre. Une donnée d'hier présentée comme celle de
   maintenant serait le défaut que tout ce fichier s'applique à éviter.
   ============================================================================ */

/** Le SELECT de chaque source, par clé. Cette table existe pour UNE raison : décider s'il faut
 *  lire AVANT de monter l'adapter, donc calculer la clé du cache sans lui.
 *  ⚠️ Une source absente d'ici sera relue à CHAQUE ouverture (repli prudent : pas de clé, pas de
 *  cache). Toute source ajoutée au registre doit donc y figurer aussi — c'est la seule
 *  duplication que le mécanisme impose, et elle est vérifiée par le typage de `SourceKey`. */
const SELECT_OF: Partial<Record<SourceKey, Record<string, string>>> = {
  abonnes: SELECT_ABONNE,
  notesIns: SELECT_NOTE_INS,
  notesPro: SELECT_NOTE_PRO,
  tachesPa: SELECT_TACHE_PA,
  tachesPr: SELECT_TACHE_PR,
  notifC: SELECT_NOTIF_C,
  sav: SELECT_SAV,
  comKpi: SELECT_COM,
  excAbo: SELECT_EXC_ABO,
  excPart: SELECT_EXC_PART,
  parcAbo: SELECT_PARC_ABO,
  parcPart: SELECT_PARC_PART,
  contactsIns: SELECT_CONTACT_INS,
};

/* Sert un instantané SANS RIEN LIRE. Aucun `useRecords` n'est monté ici : c'est tout l'objet du
   mécanisme, et c'est pourquoi ce composant est si court.
   · `cached` ET `stale` : le premier dit « aucune lecture n'est en cours », le second reste vrai
     pour que les widgets qui l'écoutent déjà (les six widgets d'agrégat) continuent d'annoncer
     leur instantané sans une ligne de code de plus.
   · `withDerived` : l'instantané garde les lignes BRUTES (`useSnapshot` reçoit `liveState`, donc
     d'avant les champs calculés). Sans cette enveloppe, `contact` — le « Prénom Nom » de
     l'annuaire — serait VIDE sur toutes les lignes servies par le cache, et la liste afficherait
     des titres manquants un jour sur deux.
   · pas de `write` : voir l'avertissement de `fraicheur` (§6-bis). */
function CachedSource({ source, snap, children }: { source: SourceKey; snap: Snapshot; children: SourceChildren }) {
  const publish = useContext(SourceRefreshCtx)?.publish;
  /* La date remonte au bouton de la carte, qui l'affiche dans son `title` (« Données du … —
     cliquer pour relire »). Sans ça, la seule source servie sans lecture serait aussi la seule
     dont on ne pourrait pas dater les lignes. */
  useEffect(() => { publish?.({ reading: false, at: snap.at }); }, [snap.at]);
  return <>{withDerived(source, children)({ rows: snap.rows, loading: false, error: false, stale: true, cached: true, at: snap.at })}</>;
}

function feedFor(source: SourceKey, recoit: SourceChildren, drain?: boolean) {
  /* UN SEUL point d'application pour les champs calculés : tout ce qui consomme une
     source passe par ici, mock compris. Les mettre dans chaque adapter serait douze
     endroits où l'oublier. */
  const children = withDerived(source, recoit);
  if (!isLive(source)) return <OfflineSource source={source}>{children}</OfflineSource>;
  switch (source) {
    case "abonnes":  return <AbonnesSource drain={drain}>{children}</AbonnesSource>;
    case "notesIns": return <NotesInsSource drain={drain}>{children}</NotesInsSource>;
    case "notesPro": return <NotesProSource drain={drain}>{children}</NotesProSource>;
    case "tachesPa": return <TachesPaSource drain={drain}>{children}</TachesPaSource>;
    case "tachesPr": return <TachesPrSource drain={drain}>{children}</TachesPrSource>;
    case "sav":      return <SavSource>{children}</SavSource>;
    case "comKpi":   return <ComKpiSource>{children}</ComKpiSource>;
    case "parcAbo":  return <ParcAboSource>{children}</ParcAboSource>;
    case "excAbo":   return <ExcAboSource>{children}</ExcAboSource>;
    case "excPart":  return <ExcPartSource>{children}</ExcPartSource>;
    case "parcPart": return <ParcPartSource>{children}</ParcPartSource>;
    case "notifC":   return <NotifCSource drain={drain}>{children}</NotifCSource>;
    case "contactsIns": return <ContactsInsSource drain={drain}>{children}</ContactsInsSource>;
    default: return <OfflineSource source={source}>{children}</OfflineSource>;
  }
}

/* ============================================================================
   7. NAV & OUTILS — la STRUCTURE ; les adresses sont en §0-bis
   ----------------------------------------------------------------------------
   Aucune URL n'est écrite ici : ces tableaux ne portent que des RÉFÉRENCES à
   `PAGES` / `TOOLS`. Changer une adresse se fait en §0-bis, jamais dans ce §7.
   ============================================================================ */
/* Onglets de navigation. « Accueil » = ce bloc (tableau de bord). Un onglet avec
   `embed` intègre une app externe PUBLIQUE (sans login) DANS la page via une
   iframe (bascule de contenu, pas de navigation). Un onglet avec `href` (à
   réactiver plus tard) navigue vers une page de l'espace Softr en target _top.
   NB : les onglets Prospects/Partenaires/Abonnés/Bibliothèque/KPI sont retirés
   « dans un premier temps » — les remettre = une entrée { id, label, icon, href }. */
type NavTab = { id: string; label: string; icon: LucideIcon; embed?: string; href?: string };
const NAV_TABS: NavTab[] = [
  { id: "accueil", label: "Accueil", icon: Home },
  /* Les cinq apps embarquables ne sont plus un onglet chacune : elles vivent dans
     l'onglet « Outils » (voir OUTILS / OutilsTab), qui les ouvre in-page. La barre de
     nav reste ainsi lisible quand un outil s'ajoute. `embed` sur un NavTab reste
     supporté par Block() — c'est le chemin à reprendre pour promouvoir un jour un
     outil en onglet de plein droit. */
  { id: "outils", label: "Outils", icon: Wrench },
];

/* ── LES OUTILS DE L'ONGLET « Outils » ──────────────────────────────────────────
   `embed` = ouvert DANS la page, en iframe, sans quitter le CRM. `url` = ouvert dans
   un NOUVEL ONGLET. Les deux sont EXCLUSIFS et c'est `embed` qui décide : une entrée
   qui porterait les deux ignorerait `url`.

   ⚠️ Les outils affichés sont tous `embed` : ce sont des apps Vercel PUBLIQUES,
   sans login, donc iframables. `url` n'est plus employé par aucune entrée depuis le
   retrait de You Sign (2026-08-18) mais reste SUPPORTÉ, et c'est délibéré : une app à
   login (servie derrière un Auth0 ou équivalent) refuse l'iframing (X-Frame-Options /
   CSP frame-ancestors) et ne rendrait qu'un cadre blanc — elle devra passer par `url`.
   C'est la seule raison de la distinction, pas une préférence d'ergonomie.

   Les adresses viennent de §0-bis : "" signifie « pas encore d'adresse » → le bouton
   reste visible mais inerte, comme les tuiles de `QUICK_LINKS`. */
type Outil = {
  id: string; label: string; icon: LucideIcon; desc: string;
  embed?: string; url?: string; solar?: boolean;
  /** `true` = tuile MASQUÉE : l'entrée reste dans le registre (adresse, libellé, icône
   *  conservés) mais ne s'affiche pas et ne peut pas s'ouvrir. C'est le geste réversible
   *  pour retirer temporairement un outil de la grille — préférable à la suppression,
   *  qui perd l'adresse. La remettre = enlever ce seul champ. */
  hidden?: boolean;
};
const OUTILS: Outil[] = [
  /* MASQUÉ le 2026-08-18 (demande explicite) : l'entrée et son adresse sont intactes,
     seul l'affichage est suspendu. Retirer `hidden` la remet dans la grille. */
  { id: "simulateur", label: "Simulateur Grille", icon: LayoutGrid,
    desc: "Grille tarifaire et scénarios d'abonnement.", embed: TOOLS.simulateurGrille,
    hidden: true },
  { id: "calculette", label: "Calculette d'abonnement", icon: Calculator,
    desc: "Simulation économique d'un projet.", embed: TOOLS.calculette, solar: true },
  { id: "map", label: "Map", icon: MapIcon,
    desc: "Carte des installateurs.", embed: TOOLS.carteInstallateurs },
  { id: "erp", label: "ERP", icon: Boxes,
    desc: "Gestion interne SunLib.", embed: TOOLS.erp },
  { id: "formulaire", label: "Formulaire de contact", icon: Mail,
    desc: "Déposer une demande de contact.", embed: TOOLS.formulaireContact },
  { id: "bibliotheque", label: "Bibliothèque", icon: Library,
    desc: "Documents et supports internes.", embed: TOOLS.bibliotheque },
];

/** Les outils réellement affichés. `OUTILS` garde TOUT (y compris les masqués) pour que
 *  démasquer soit un mot-clé à retirer ; c'est cette liste que la grille parcourt, et
 *  c'est aussi elle qui résout l'outil ouvert — sinon un `openId` pointant sur une
 *  entrée fraîchement masquée resterait embarqué sous une grille qui ne le montre plus. */
const OUTILS_VISIBLES: Outil[] = OUTILS.filter((o) => !o.hidden);

/* Outils. UNE tuile = soit `page` (page de l'espace, ouverte en _top et résolue par
   `pageUrl`), soit `url` (outil externe, nouvel onglet). Les deux valeurs viennent de
   §0-bis, et une chaîne vide y signifie « pas encore d'adresse » → tuile désactivée.
   ⚠️ `page` et `url` sont exclusifs : c'est `page !== undefined` qui décide de la
   cible, donc une entrée qui porterait les deux ignorerait `url` en silence.

   `hidden` = même convention que `OUTILS` : la tuile reste DÉCRITE ici (libellé, icône,
   slug) mais ne s'affiche pas. C'est le geste réversible pour retirer un raccourci de
   l'accueil sans perdre son slug ; la remettre = enlever ce seul champ. */
const QUICK_LINKS: { label: string; icon: LucideIcon; page?: string; url?: string; solar?: boolean; hidden?: boolean }[] = [
  // Pages de l'espace Softr (ex-onglets de nav) restaurées en raccourcis (target _top).
  { label: "Prospects", icon: UserPlus, page: PAGES.prospects },
  { label: "Partenaires", icon: Handshake, page: PAGES.partenaires },
  /* MASQUÉ le 2026-08-18 (demande explicite) : le slug `contact-partenaire` reste bon,
     seul l'affichage du raccourci est suspendu. */
  { label: "Contact Partenaire", icon: BookUser, page: PAGES.contactPartenaire, hidden: true },
  { label: "Abonnés", icon: Users, page: PAGES.abonnes },
  { label: "Pilotage SAV", icon: Ticket, page: PAGES.sav },
  { label: "KPI", icon: BarChart3, page: PAGES.kpi },
  /* ⚠️ PLUS AUCUN OUTIL ICI : la Calculette, Map, l'ERP, le Formulaire de contact, la
     Bibliothèque et le Simulateur sont regroupés dans l'onglet « Outils » (`OUTILS`).
     Cette section ne garde que les PAGES de l'espace Softr, d'où son titre
     « Raccourcis ». Ne pas redédoubler un outil ici : deux chemins vers la même app
     finissent toujours par divulguer deux adresses différentes. */
];

/** Les raccourcis réellement affichés — cf. `hidden` ci-dessus. C'est cette liste que
 *  la grille parcourt ; `QUICK_LINKS` garde tout, masqués compris. */
const QUICK_LINKS_VISIBLES = QUICK_LINKS.filter((l) => !l.hidden);

/* ============================================================================
   8. Composants de page
   ============================================================================ */

// État vide guidant (charte : une invitation à agir, jamais une zone morte)
function EmptyState({ icon: Icon, title, hint, dense }: { icon: LucideIcon; title: string; hint?: string; dense?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: dense ? "8px" : "10px", padding: dense ? "30px 16px" : "42px 20px", textAlign: "center" }}>
      <span style={{ width: dense ? 40 : 46, height: dense ? 40 : 46, borderRadius: "12px", display: "grid", placeItems: "center", backgroundColor: T.surface2, border: `1px solid ${T.line}`, color: T.ink4 }}>
        <Icon style={{ width: dense ? 18 : 20, height: dense ? 18 : 20 }} strokeWidth={1.7} />
      </span>
      <div style={{ fontSize: dense ? "13px" : "14px", fontWeight: 600, color: T.ink2 }}>{title}</div>
      {hint && <div style={{ fontSize: "12px", fontWeight: 500, color: T.ink4, maxWidth: 340 }}>{hint}</div>}
    </div>
  );
}

/* --- HAUTEUR D'UN WIDGET : UN NOMBRE DE PIXELS -------------------------------
   ⚠️⚠️ 2026-08-07 — LES CRANS NOMMÉS ONT ÉTÉ SUPPRIMÉS (`"sm" | "md" | "lg" | "xl"`, quatre
   valeurs figées). Ils ne donnaient pas assez de choix : entre 560 et 860 px il n'y avait
   rien, et un embed qui ne défile pas (le fil LinkedIn en iframe) tombait toujours entre
   deux — coupé d'un côté, entouré de vide de l'autre. `Instance.h` porte désormais une
   HAUTEUR EN PIXELS, réglable au pixel près (arrondie au pas de la grille).

   COMPATIBILITÉ : les layouts déjà enregistrés portent une CHAÎNE. `coerceHeight` les
   traduit à la lecture (168 / 340 / 560 / 860, les valeurs qu'elles désignaient), donc
   AUCUNE disposition ne change d'apparence et rien n'est à migrer en base — le document est
   réécrit en pixels au prochain geste, pas avant.
   ⚠️ NE PAS « nettoyer » `LEGACY_HEIGHTS` : un utilisateur qui n'a pas retouché sa
   disposition depuis des mois a encore des clés dans son document.

   L'arrondi se fait sur `DASH_ROW` (4 px), la granularité des lignes implicites de la
   grille : une hauteur qui tombe entre deux lignes serait de toute façon ramenée là par le
   tassement, autant que la valeur stockée dise la vérité. --- */
type WidgetHeight = number;
const H_MIN = 120;        // en dessous, l'en-tête et le pied mangent tout le corps
const H_MAX = 1600;       // au-delà, la carte dépasse tous les écrans du parc
const H_DEFAULT = 340;    // ce que valait "md", le cran par défaut historique
/* `H_PRESETS` (les repères Petit / Moyen / Grand / XL du ⋮) a été SUPPRIMÉ le 2026-08-07
   avec le réglage de hauteur du panneau : la hauteur ne se règle plus qu'à la POIGNÉE, en
   glissant sous la carte. Les quatre valeurs qu'il portait — 168, 340, 560, 860 — restent
   vivantes ailleurs : `H_DEFAULT` pour la pose, et `LEGACY_HEIGHTS` pour traduire les
   anciennes clés. */
/** Anciennes clés de cran → pixels. Lecture seule, jamais réécrit sous cette forme. */
const LEGACY_HEIGHTS: Record<string, number> = { sm: 168, md: 340, lg: 560, xl: 860 };
/** Toute hauteur qui entre dans le layout passe par ici : bornée, arrondie, et tolérante
 *  aux anciennes clés comme aux saisies en cours de frappe (un champ vide donne le défaut,
 *  pas 0 — une carte de 0 px serait invisible et paraîtrait supprimée).
 *  ⚠️ `DASH_ROW` est déclaré PLUS BAS dans le fichier : légal, parce que cette fonction ne le
 *  lit qu'à l'APPEL (lecture du layout, geste de poignée), longtemps après l'évaluation du
 *  module. Ne pas l'appeler depuis une constante de niveau module — ce serait une TDZ. */
function coerceHeight(raw: unknown): WidgetHeight {
  if (typeof raw === "string" && raw in LEGACY_HEIGHTS) return LEGACY_HEIGHTS[raw];
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return H_DEFAULT;
  return Math.max(H_MIN, Math.min(H_MAX, Math.round(n / DASH_ROW) * DASH_ROW));
}

/* --- GRILLE DU TABLEAU DE BORD — géométrie du TASSEMENT (masonry) -------------
   Avant, la grille était une grille CSS ordinaire : chaque rangée prenait la
   hauteur de son plus grand widget, et le suivant attendait la ligne suivante. Un
   petit widget à côté d'un grand laissait donc un trou sous lui, et ces trous
   alignés donnaient à voir les lignes de la grille — exactement ce qu'on ne veut
   pas voir.

   Le tassement se fait avec la technique des LIGNES FINES : la grille déclare des
   lignes implicites de `DASH_ROW` px, et chaque widget occupe `span n` lignes, avec
   n déduit de sa hauteur RÉELLE. Un widget court occupe moins de lignes, donc son
   voisin du dessous remonte.

   ⚠️ `rowGap` est à ZÉRO, et ce n'est pas un oubli : un gap entre lignes
   s'ajouterait à CHAQUE ligne fine (n − 1 fois), ce qui rendrait le calcul du span
   faux et l'espacement énorme. L'espace vertical entre widgets vient donc d'un
   `paddingBottom: DASH_GAP` posé sur le wrapper de chaque widget, et il est compté
   dans le span. Corollaire à ne pas oublier : les poignées de redimensionnement
   sont positionnées par rapport à ce wrapper — elles doivent être décalées de
   `DASH_GAP` pour rester collées à la CARTE et non au bas du wrapper. --- */
const DASH_GAP = 18;   // espace entre widgets (colonnes ET lignes)
const DASH_ROW = 4;    // granularité des lignes implicites : le résidu ≤ 3 px est invisible

/* --- Corps scrollable d'un widget. La hauteur max vient du contexte (le Dashboard
   la connaît : c'est `instance.h`), et elle est posée EN LIGNE — l'ancienne
   variable CSS `--slb-wh` lue par une règle injectée ne s'appliquait pas dans le
   bloc Softr, et les widgets s'étiraient alors sans jamais scroller. La classe
   `slb-scrolly` reste, mais seulement pour l'habillage de la scrollbar. --- */
const WidgetHeightCtx = createContext<number>(H_DEFAULT);

/* --- ARRONDI AU DERNIER ÉLÉMENT ENTIER (« snap », 2026-08-07) -------------------
   Les crans de hauteur sont des PIXELS (168 / 340 / 560) et le contenu, lui, a sa
   propre granularité : une ligne de liste, une rangée de tuiles. Un cran tombe donc
   presque toujours au milieu d'un élément, et une tuile coupée en deux se lit comme un
   bug d'affichage — c'est ce qui a été rapporté sur « Pilotage SAV » en petit.

   La hauteur réelle du corps est donc RABATTUE sur la dernière frontière d'élément qui
   tient dans le cran. Trois précisions qui comptent :
   · les UNITÉS sont déclarées, pas devinées : `.slb-row` (toutes les listes et lignes de
     tableau du bloc l'ont déjà) et `.slb-unit` (les tuiles de `KpiTiles`, les sections du
     SAV). Un widget sans unité — pense-bête, embed, squelette — garde son cran au pixel :
     rien à rabattre sur du texte libre ;
   · AU MOINS UNE unité est toujours montrée, même si elle dépasse le cran : mieux vaut un
     widget un peu plus haut que demandé qu'un widget qui ne montre rien d'entier ;
   · le PADDING BAS du parent de la dernière unité est réintégré, sinon la tuile toucherait
     le bord de la carte là où la mise en page prévoit 16 px de respiration.

   ⚠️ MESURE EN `offsetTop` / `offsetHeight`, jamais en `getBoundingClientRect()` : les
   wrappers de la grille reçoivent des `scale()` pendant les animations FLIP (§11), et un
   rect inclut les transforms des ancêtres — les frontières seraient fausses à chaque
   réordonnancement. La chaîne des `offsetParent` est remontée jusqu'au conteneur, qui est
   donc `position: relative` (sans quoi il ne serait pas l'`offsetParent` de personne).
   ⚠️ Le rabattement ne vaut que pour l'état de REPOS : une fois qu'on défile, on s'arrête
   où l'on veut. C'est voulu — le défilement libre est la façon dont on lit une liste. --- */
const scrollUnits = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(".slb-row, .slb-unit"));

/** Bas d'un élément, en pixels depuis le haut du CONTENU de `root`. `-1` si l'élément
 *  n'est pas dans le sous-arbre positionné de `root` (cas d'un ancêtre intermédiaire
 *  positionné : on préfère l'ignorer plutôt que de rendre une valeur fausse). */
function offsetBottomIn(el: HTMLElement, root: HTMLElement): number {
  let y = el.offsetHeight;
  let n: HTMLElement | null = el;
  while (n && n !== root) { y += n.offsetTop; n = n.offsetParent as HTMLElement | null; }
  return n === root ? y : -1;
}

/** Hauteur à appliquer pour ne couper aucune unité, ou `max` s'il n'y a rien à rabattre. */
function snapHeight(root: HTMLElement, max: number): number {
  const units = scrollUnits(root);
  if (!units.length) return max;
  let best = 0, bestEl: HTMLElement | null = null;   // plus grande frontière ≤ max
  let first = Infinity, firstEl: HTMLElement | null = null;  // repli « au moins une unité »
  for (const u of units) {
    const b = offsetBottomIn(u, root);
    if (b < 0) continue;
    if (b <= max && b > best) { best = b; bestEl = u; }
    if (b < first) { first = b; firstEl = u; }
  }
  const el = bestEl ?? firstEl;
  const y = bestEl ? best : first;
  if (!el || !Number.isFinite(y)) return max;
  /* Respiration : le padding bas du parent n'est réintégré que si l'unité retenue est la
     DERNIÈRE de ce parent — au milieu d'une liste, ajouter 16 px découvrirait un bandeau
     de la ligne suivante, exactement ce qu'on cherche à éviter. */
  const parent = el.parentElement;
  const dernier = !!parent && parent.lastElementChild === el;
  const pad = dernier && parent ? parseFloat(getComputedStyle(parent).paddingBottom) || 0 : 0;
  return Math.round(y + pad);
}

function ScrollBody({ children }: { children?: ReactNode }) {
  const maxHeight = useContext(WidgetHeightCtx);
  /* Le corps défile TOUJOURS : il n'y a plus de mode où il serait inerte (le mode
     « Personnaliser » a été supprimé le 2026-08-07 — tout se règle en direct).
     ⚠️ La barre de défilement longe le même bord droit que la poignée de largeur : ce
     conflit est réglé côté §11, où les poignées sont déportées DANS LA GOUTTIÈRE, hors
     de la carte. Ne pas les ramener sur le bord intérieur. */
  /* Hauteur RABATTUE (cf. `snapHeight`). Elle part du cran demandé — donc le premier
     rendu est déjà correct au pixel près pour les widgets sans unité — puis se cale à la
     mesure. `null` = pas encore mesuré.
     · Pas de tableau de dépendances, comme les autres mesures du fichier (§11) : le
       contenu d'un widget change (une ligne cochée, une source relue) et la frontière
       change avec lui.
     · Le garde `≠` est OBLIGATOIRE : sans lui, chaque mesure déclencherait un rendu, qui
       remesurerait — boucle infinie.
     · Repli sans ResizeObserver : la hauteur reste le cran demandé, donc l'ancien
       comportement (une unité peut être coupée), jamais un widget cassé. */
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [snap, setSnap] = useState<number | null>(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => {
      const h = snapHeight(el, maxHeight);
      /* TOLÉRANCE D'UN PIXEL, et ce n'est pas de la coquetterie : rabattre la hauteur fait
         apparaître ou disparaître l'ascenseur, ce qui change la largeur utile, donc peut
         changer le nombre de colonnes de la grille de tuiles, donc les hauteurs mesurées.
         Deux valeurs qui alterneraient à un pixel près relanceraient un rendu à chaque
         mesure — une boucle sans fin, invisible à l'œil mais qui mange le processeur.
         `scrollbarGutter: "stable"` (plus bas) retire la cause principale, ce seuil couvre
         le reste (arrondis sub-pixel du zoom navigateur). */
      setSnap((prev) => (prev != null && Math.abs(prev - h) <= 1 ? prev : h));
    };
    measure();
    if (typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    scrollUnits(el).forEach((u) => ro.observe(u));
    return () => ro.disconnect();
  });
  return (
    <div ref={bodyRef} className="slb-scrolly"
      /* `scrollbarGutter: "stable"` réserve la place de l'ascenseur en permanence : la
         largeur utile ne change donc plus selon qu'il est là ou non, et la mesure de
         rabattement ne peut plus osciller entre deux mises en page (cf. `measure`). */
      style={{ position: "relative", overflowY: "auto", scrollbarGutter: "stable", maxHeight: snap ?? maxHeight, scrollbarWidth: "thin", scrollbarColor: `${T.line2} transparent` }}>
      {/* Le filet de séparation entre lignes était une règle injectée
          (`.slb-row + .slb-row`) : il est posé ici, en ligne, autour de chaque
          enfant — un seul endroit pour toutes les listes du bloc. */}
      {Children.map(children, (child, i) => (
        <div style={i > 0 ? { borderTop: `1px solid ${T.line}` } : undefined}>{child}</div>
      ))}
    </div>
  );
}

/* --- Contexte d'OPTIONS : le Dashboard injecte, par instance, sa configuration
      courante, le formulaire du type et le callback de sauvegarde.
      `null` = ce widget n'est pas configurable → le bouton ⋮ reste inerte.
      `any` assumé : chaque type définit SA forme de cfg et son propre formulaire ;
      le contexte est volontairement agnostique.

      ⚠️ 2026-08-07 — LE MODE « PERSONNALISER » A ÉTÉ SUPPRIMÉ. Il n'y a plus qu'un
      seul régime : tout geste (déplacer, redimensionner, régler, retirer) s'applique
      et s'écrit EN DIRECT. Ce contexte est donc fourni en permanence, et c'est lui qui
      porte ce qui se réglait dans l'ancien menu ⋮ d'édition : titre, teinte, contenu,
      encombrement, retrait.
      ⚠️ LA POSITION N'EN FAIT PAS PARTIE (choix du 2026-08-07, demandé) : réordonner se
      fait en GLISSANT l'en-tête d'une carte, et rien d'autre. Conséquence connue et
      acceptée : il n'y a donc PLUS de chemin de réordonnancement au clavier ni au doigt,
      le glisser-déposer HTML5 ne répondant pas au tactile. Ne pas remettre de
      « Monter / Descendre » ici sans revenir sur cet arbitrage. --- */
type WidgetOptions = {
  cfg: any;
  /** Formulaire propre au TYPE. Absent = ce type n'a pas de réglages ; le panneau
   *  n'en garde alors que le champ « Titre », commun à tous (voir `title`). */
  Form?: FC<{ cfg: any; onChange: (next: any) => void }>;
  /** Titre choisi par l'utilisateur pour CETTE instance ("" = titre par défaut). */
  title: string;
  /** Clé de teinte de CETTE instance ("" = aucune). Cf. `WIDGET_TINTS`. */
  tint: string;
  /** LARGEUR de CETTE instance, réglable depuis le ⋮ (les poignées latérales font la même
   *  chose à la souris, cf. §11). Deux valeurs seulement, donc deux boutons suffisent.
   *  ⚠️ LA HAUTEUR N'EST PLUS ICI (retirée le 2026-08-07, demandé) : elle ne se règle qu'en
   *  GLISSANT la poignée sous la carte. Conséquence acceptée, la même que pour la position :
   *  il n'y a donc plus de chemin de réglage de hauteur au clavier ni au doigt. Ne pas
   *  remettre de champ ici sans revenir sur cet arbitrage. */
  wide: boolean;
  onSave: (next: { title: string; tint: string; cfg: any; wide: boolean }) => void;
  /** Retire le widget de l'accueil. Écriture IMMÉDIATE, comme tout le reste depuis la
   *  suppression du mode « Personnaliser » — d'où la confirmation en deux temps dans la
   *  modale : ici, un clic de trop retire vraiment le widget. */
  onRemove?: () => void;
};
const WidgetOptionsCtx = createContext<WidgetOptions | null>(null);

/* --- TITRE PERSONNALISÉ, valable pour TOUS les widgets ------------------------
   Le titre est une propriété de l'INSTANCE, pas du type : il ne vit donc ni dans la
   `cfg` (où chaque type aurait dû le redéclarer, et où les types sans formulaire
   n'auraient jamais pu l'offrir) ni dans le code du widget. Le Dashboard le sert par
   ce contexte, la coquille `Widget` l'applique par-dessus le titre que le composant
   lui passe, et n'importe quel widget devient renommable sans une ligne de plus.

   Chaîne VIDE = « garder le titre par défaut ». C'est ce qui rend le geste réversible
   sans bouton dédié : on vide le champ, le titre d'origine revient — et il continue de
   suivre ses évolutions (le titre d'un widget `data` suit sa source, par exemple).
   ⚠️ Le titre par défaut n'est donc PAS recopié dans l'instance à la première
   ouverture du panneau : ce serait le figer, et un widget renommé « Dossiers SAV »
   garderait ce nom même après avoir changé de source. --- */
const WidgetTitleCtx = createContext<string>("");

/* --- TEINTE D'UN WIDGET — même logique que le titre -----------------------------
   Une palette FERMÉE, et c'est le point : on choisit une CLÉ (`"teal"`), jamais une
   couleur libre. Trois raisons qui tiennent dans la durée — un sélecteur libre
   produirait des accueils illisibles (texte foncé sur fond saturé) ; les teintes
   restent modifiables d'un seul endroit le jour où la charte bouge ; et le document de
   disposition ne stocke pas de valeurs de style, donc rien à migrer.

   La teinte habille la CARTE — fond, bordure, encre du titre, pastille d'icône — et ce
   qui, dans le corps, portait déjà une couleur de DÉCOR : le fond des lignes non vues et
   le survol d'une ligne (`--slb-row-hover`, publiée par `Widget`). Ces deux-là suivaient
   des couleurs figées, si bien qu'un widget rosé gardait des lignes teal et devenait gris
   au passage de la souris — la teinte semblait ne pas s'appliquer.
   Ce qu'elle ne touche PAS : les couleurs de SENS (badges de statut, alertes ambre ou
   rouges) et les contenus délibérément blancs (tuiles de la synthèse SAV, zone de saisie
   du pense-bête), qui ressortent alors comme des cartes posées dessus.

   ⚠️ AUCUN ROUGE, ni orange vif, dans cette palette. Ce sont les couleurs d'ALERTE de
   la charte : les proposer comme décor apprendrait à l'œil à les ignorer là où elles
   comptent. Les pastels ci-dessous s'en tiennent volontairement à distance. --- */
type WidgetTint = { key: string; label: string; head: string; ink: string; pill: string };
const WIDGET_TINTS: WidgetTint[] = [
  /* `head: ""` = pas de teinte → l'en-tête garde le blanc de la carte. C'est le défaut,
     et il reste en tête de liste pour qu'on puisse toujours revenir en arrière. */
  { key: "", label: "Aucune", head: "", ink: T.ink, pill: "" },
  /* Les trois couleurs SUNLIB, reprises des tokens de la charte — pas des à-peu-près. */
  { key: "teal", label: "Teal SunLib", head: T.brand050, ink: T.brand700, pill: T.brand100 },
  { key: "vert", label: "Vert SunLib", head: T.ok050, ink: T.okInk, pill: "#CFEFDC" },
  { key: "ambre", label: "Ambre solaire", head: T.solar050, ink: T.solar600, pill: T.solar100 },
  /* Pastels de base. Le ciel vient des tokens `info`; lavande et rosé n'existent pas
     dans la charte (qui n'a pas de teinte décorative) : ils sont définis ICI, assez
     désaturés pour ne jamais passer pour un état, et assez distincts l'un de l'autre
     pour rester reconnaissables en petite pastille. */
  { key: "ciel", label: "Bleu ciel", head: T.info050, ink: T.infoInk, pill: "#D6E4FD" },
  { key: "lavande", label: "Lavande", head: "#F2EFFC", ink: "#57489E", pill: "#E1DAF7" },
  { key: "rose", label: "Rosé", head: "#FCEFF5", ink: "#9C4374", pill: "#F6DCE8" },
  { key: "ardoise", label: "Ardoise", head: T.neutral050, ink: T.ink2, pill: T.line2 },
];
const tintOf = (key: string): WidgetTint => WIDGET_TINTS.find((t) => t.key === key) ?? WIDGET_TINTS[0];
const WidgetTintCtx = createContext<string>("");

/* --- ÉCRITURE DE SA PROPRE cfg PAR LE WIDGET -----------------------------------
   `WidgetOptionsCtx` sert le PANNEAU d'options ; celui-ci sert le CONTENU. Un
   widget dont l'état EST son contenu — un pense-bête, une liste à cocher — doit
   pouvoir enregistrer sans passer par un formulaire caché derrière un ⋮.

   Fourni EN PERMANENCE depuis la suppression du mode « Personnaliser » (2026-08-07) :
   il n'existe plus de régime où le corps serait inerte, donc plus de raison de couper
   ce canal. Il reste un seul écrivain par instance — le layout appliqué — donc pas
   d'écrasement silencieux possible.

   L'écriture est SILENCIEUSE en cas de succès (pas de toast à chaque frappe) mais un
   échec reste annoncé, cf. `runSave`. Ce canal servira aussi au tri par clic sur les
   en-têtes de colonnes. --- */
type WidgetCfgWriter = { save: (cfg: unknown) => void };
const WidgetCfgCtx = createContext<WidgetCfgWriter | null>(null);

/* --- PRÉHENSION D'UN WIDGET ----------------------------------------------------
   L'EN-TÊTE de chaque carte est saisissable en permanence : c'est la seule façon de
   réordonner à la souris. Au clavier et au doigt, où le DnD HTML5 ne fonctionne pas,
   le chemin est « Monter / Descendre » dans le ⋮ (cf. `WidgetOptions`).

   Pourquoi l'en-tête et pas la carte entière : le corps est INTERACTIF
   (boutons, liens, défilement, sélection de texte). Rendre tout le wrapper
   `draggable` y aurait déclenché un glisser au moindre mouvement — c'est exactement
   le mécanisme qui annulait les clics du menu ⋮ (bug du 2026-08-03) — et aurait
   empêché de sélectionner du texte dans les notes. L'en-tête ne contient qu'un titre
   et le bouton ⋮ : rien à y perdre. C'est aussi la convention (fenêtres, cartes).

   L'image de glissement est forcée sur la CARTE ENTIÈRE (`setDragImage`), sinon le
   navigateur ne montrerait que le bandeau de l'en-tête.

   ⚠️⚠️ 2026-08-18 — POURQUOI `onPointerDownCapture` ET PAS `e.target` DE `dragstart`.
   L'en-tête contient des panneaux flottants : la MODALE de réglages (`WidgetOptionsMenu`,
   `position: fixed`, plein écran) et les panneaux ancrés du ⋮ ou de `QuickCreate`. Comme
   `draggable` est HÉRITÉ par tout le sous-arbre, un glissement amorcé N'IMPORTE OÙ dans
   la modale démarrait un déplacement du widget derrière elle — carte fantôme qui suit le
   curseur, cible de dépôt qui s'allume sous le fond flouté. C'est le bug signalé.
   La garde qui existait déjà lisait `e.target` de `dragstart`, et c'est là qu'elle
   échouait : pour un `dragstart`, la cible est la SOURCE DU GLISSEMENT — l'élément
   `draggable`, donc l'en-tête lui-même — et jamais l'élément profond sous le curseur.
   Un `closest("[role=dialog]")` dessus ne pouvait rien trouver.
   On mémorise donc la vraie origine du geste au `pointerdown` (en phase de CAPTURE, pour
   passer avant tout `stopPropagation` d'un panneau), et `onDragStart` décide sur elle.
   `pointerdown` précède toujours `dragstart`, l'ordre est garanti.
   ⚠️ Ne pas « simplifier » en `draggable={false}` sur la modale : l'attribut n'arrête pas
   la recherche d'ancêtre glissable, le navigateur remonte jusqu'à l'en-tête et glisse
   quand même. Et pas de portail non plus : `react-dom` n'est pas importable dans un bloc
   Softr (cf. ARCHITECTURE.md). --- */
type WidgetGrab = {
  onDragStart: (e: ReactDragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  /** Mémorise l'élément réellement pressé, seule cible fiable pour `onDragStart`. */
  onPointerDownCapture: (e: ReactPointerEvent<HTMLElement>) => void;
};
const WidgetGrabCtx = createContext<WidgetGrab | null>(null);

/* --- FERMETURE D'UN PANNEAU FLOTTANT (clic extérieur + Échap) -----------------
   Hook PARTAGÉ par tous les panneaux flottants du bloc (facettes et tri de la barre
   d'outils des widgets de données). Il l'est devenu en corrigeant le bug du
   2026-08-03 — « le panneau se referme au clic, sans exécuter l'action » — parce
   que le code était dupliqué à l'identique et qu'un correctif appliqué à un seul
   endroit aurait laissé les autres cassés.

   Deux des trois causes du bug se neutralisent ICI (la troisième, le DnD, est
   traitée dans `onDragStart` du Dashboard). Les deux gardes ci-dessous ne sont pas
   défensives « au cas où » : chacune répond à un faux positif observé.

   ⚠️ `setOpen` (setter de useState) est STABLE, contrairement à un
   `() => setOpen(false)` qui serait recréé à chaque render et réattacherait les
   écouteurs en boucle. C'est pourquoi le hook prend le setter, pas une fermeture. */
/** Le point (x, y) tombe-t-il dans le rectangle de cet élément ? La GÉOMÉTRIE ne
 *  mentionne aucun nœud : elle est donc immunisée contre tout ce qui trompe
 *  `contains()` (nœud détaché, portail, liste native rendue par l'OS). */
function hitsRect(el: Element | null | undefined, x: number, y: number): boolean {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function useDismissOnOutside(open: boolean, setOpen: (v: boolean) => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const box = ref.current;
      if (!box) return;
      const t = e.target as Node | null;
      if (!t) return;

      /* GARDE 1 — nœud DÉTACHÉ du DOM. `contains()` répond toujours `false` pour un
         orphelin : le panneau se fermait alors que le clic avait bien eu lieu à
         l'intérieur, simplement le nœud visé venait d'être remplacé par un
         re-render (retirer un filtre, cocher une case…). */
      if (!t.isConnected) return;

      /* GARDE 2 — LISTE DÉROULANTE NATIVE. Les `<option>` d'un `<select>` sont
         rendues par l'OS, hors du document : le mousedown sur l'une d'elles cible
         un nœud « extérieur » au panneau, qui se fermait donc au moment même où on
         choisissait une valeur. `DataOptions` est truffé de `<select>`. */
      const el = t instanceof Element ? t : t.parentElement;
      if (el && (el.tagName === "OPTION" || el.closest("select"))) return;

      /* GARDE 3 — LA GÉOMÉTRIE A LE DERNIER MOT, et c'est la garde qui compte.
         Les deux tests précédents raisonnent sur l'ARBRE ; celui-ci sur l'ÉCRAN. On
         ne ferme que si le clic est extérieur SELON LES DEUX. Pourquoi cette
         ceinture : le panneau est en `position:absolute`, donc HORS DU FLUX — le
         rectangle du conteneur ne le couvre pas, il faut tester le panneau
         séparément. Il est retrouvé par son rôle, ce qui évite de câbler un
         second ref dans les deux menus.
         ⚠️ Un clic à coordonnées (0,0) vient d'un clavier ou d'un clic synthétisé
         (un `<label>` en génère un sur son input) : jamais une intention de fermer. */
      if (e.clientX === 0 && e.clientY === 0) return;
      const panel = box.querySelector('[role="dialog"], [role="menu"]');
      if (hitsRect(box, e.clientX, e.clientY) || hitsRect(panel, e.clientX, e.clientY)) return;

      if (box.contains(t)) return;
      /* Trace VOLONTAIRE (même esprit que les écritures simulées) : elle distingue
         les deux familles de causes quand un panneau se ferme tout seul. Si le
         panneau disparaît SANS cette ligne en console, ce n'est pas une fermeture
         mais un REMONTAGE du composant (l'état `open` reparti à false) — et le
         correctif est alors ailleurs : remonter `open` d'un niveau. */
      console.info("[SunLib] menu fermé — clic extérieur", { x: e.clientX, y: e.clientY, cible: el?.tagName });
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, setOpen]);
  return ref;
}

/* --- MODALE OUVERTE : LE FOND NE DÉFILE PLUS ------------------------------------
   Bug observé le 2026-08-17 sur « Ajouter un widget » : la feuille s'ouvre bien, mais
   la molette fait d'abord défiler la PAGE DERRIÈRE, et la galerie ne bouge qu'ensuite.
   Deux mécanismes se cumulaient, et il faut les deux correctifs :

     1. CHAÎNAGE (`scroll chaining`). La molette sur le voile, l'en-tête ou les
        pastilles ne vise aucun conteneur défilant : le navigateur remonte alors au
        DOCUMENT, et — le bloc vivant dans une IFRAME — poursuit dans la page Softr
        quand le document de l'iframe est au bout. D'où `overflow:hidden` (le document
        du bloc ne défile plus tant que la modale est là) ET `overscroll-behavior:none`
        sur la racine : sans ce second réglage, un document non défilable transmet
        quand même la molette au cadre parent, et on ne peut rien faire depuis
        l'iframe pour arrêter la page Softr elle-même (documents distincts).
     2. Le corps de la galerie était plafonné à 340 px par `.slb-scrolly`
        (`max-height: var(--slb-wh, 340px)`, prévu pour le corps d'un WIDGET) : la
        feuille n'occupait pas ses 86 %, ce qui donnait une petite zone défilante
        entourée de beaucoup de vide « inerte ». Corrigé au point d'appel.

   ⚠️ On restaure les valeurs EXACTES relevées à l'ouverture (chaînes vides comprises),
   pas des valeurs supposées : deux modales peuvent se superposer (fiche ouverte
   au-dessus d'un widget), et écrire « auto » en sortie casserait un style hérité de la
   feuille de l'app.
   ⚠️ Chrome conserve le `scrollTop` quand `overflow` passe à `hidden` : la page ne
   remonte donc pas en haut à l'ouverture de la modale. --- */
function useModalScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    const cibles = [document.documentElement, document.body].filter(Boolean) as HTMLElement[];
    const avant = cibles.map((el) => ({
      el,
      overflow: el.style.getPropertyValue("overflow"),
      chain: el.style.getPropertyValue("overscroll-behavior"),
    }));
    for (const el of cibles) {
      el.style.setProperty("overflow", "hidden");
      el.style.setProperty("overscroll-behavior", "none");
    }
    return () => {
      for (const { el, overflow, chain } of avant) {
        if (overflow) el.style.setProperty("overflow", overflow); else el.style.removeProperty("overflow");
        if (chain) el.style.setProperty("overscroll-behavior", chain); else el.style.removeProperty("overscroll-behavior");
      }
    };
  }, [active]);
}

/** Corps défilant d'une modale. `overscroll-behavior: contain` : arrivé en bas de la
 *  liste, la molette S'ARRÊTE là au lieu de repartir sur le fond — c'est le second
 *  symptôme du même bug, celui qu'on ne voit qu'après avoir tout déroulé.
 *  `minHeight: 0` : sans lui, un item de flex refuse de rétrécir sous la hauteur de son
 *  contenu et débordait de la feuille au lieu de défiler. */
const MODAL_BODY: CSSProperties = { overflowY: "auto", minHeight: 0, overscrollBehavior: "contain", scrollbarWidth: "thin" };

/* --- Menu ⋮ d'un widget : ouvre le formulaire d'options. Édition LOCALE (brouillon)
      jusqu'à « Enregistrer » — on n'écrit jamais en base à chaque frappe. Fermeture
      Échap / clic sur le voile. --- */
/* --- Réglages d'un widget : une MODALE, plus un panneau de 292 px ---------------
   Avant le 2026-08-06, ces réglages vivaient dans un panneau flottant de 292 px
   accroché sous le bouton ⋮. Ça tenait pour un titre et une couleur ; ça ne tient
   plus depuis que le widget générique a une source, une vue, des colonnes, des
   filtres, des actions et une barre d'outils à régler — tout arrivait en une seule
   colonne étroite avec un ascenseur, et on perdait de vue ce qu'on modifiait.

   Désormais : une modale centrée, en DEUX COLONNES sur écran large.
   · « Apparence » (titre, couleur, encombrement) — commun à TOUS les types, y compris
     ceux qui n'ont pas de formulaire ;
   · « Contenu » — le formulaire du type (`opts.Form`), qui a enfin la largeur de
     ses `<select>` et de ses lignes de filtres.
   Sur écran étroit, les deux colonnes se replient l'une sous l'autre (`flexWrap`),
   sans média query — il n'y en a pas dans ce bloc (cf. la contrainte §1).

   Ce qui NE change pas, et ne doit pas changer : les RÉGLAGES restent un BROUILLON.
   Rien n'est appliqué avant « Enregistrer », et « Annuler » jette tout. C'est ce qui
   rend l'exploration des réglages sans risque.
   ⚠️ UNE EXCEPTION, et elle est assumée : « Retirer » agit EN DIRECT. Un retrait doit
   être franc — d'où sa confirmation en deux temps juste avant.

   ⚠️ Fermeture par clic sur le VOILE (`e.target === e.currentTarget`) et par Échap,
   et non par `useDismissOnOutside` : ce formulaire est plein de `<select>`, dont la
   liste déroulante est rendue par l'OS HORS du document. Le hook a des gardes pour
   ça, mais le voile n'a même pas le problème — un clic sur une option ne l'atteint
   jamais. Moins de code, et un piège en moins.
   ⚠️ En-tête et pied NE DÉFILENT PAS (`flex: none`) : le bouton « Enregistrer » doit
   rester atteignable quel que soit le nombre de réglages du type. --- */
function WidgetOptionsMenu({ opts, title, defaultTitle }: { opts: WidgetOptions; title: string; defaultTitle: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<any>(opts.cfg);
  const [draftTitle, setDraftTitle] = useState(opts.title);
  const [draftTint, setDraftTint] = useState(opts.tint);
  /* Confirmation du RETRAIT, en deux temps. Contrairement au reste de cette modale, la
     suppression n'est pas un brouillon : elle écrit tout de suite. Un « Supprimer » à un
     seul clic, juste à côté de « Enregistrer », finirait par partir tout seul. */
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [draftWide, setDraftWide] = useState(opts.wide);
  useModalScrollLock(open);            // modale ouverte → le fond ne défile plus
  // Brouillons toujours frais à l'ouverture (cfg, titre, teinte, largeur ET confirmation
  // remise à zéro).
  const start = () => {
    setDraft(opts.cfg); setDraftTitle(opts.title); setDraftTint(opts.tint);
    setDraftWide(opts.wide); setConfirmRemove(false); setOpen(true);
  };
  const save = () => {
    opts.onSave({ title: draftTitle, tint: draftTint, cfg: draft, wide: draftWide });
    setOpen(false);
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const btn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: T.rSm, fontSize: "12.5px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${T.line}`, background: T.surface, color: T.ink2 };
  const lbl: CSSProperties = { display: "block", fontSize: "10.5px", fontWeight: 700, color: T.ink4, textTransform: "uppercase", letterSpacing: ".05em", margin: "2px 0 5px" };
  const field: CSSProperties = { width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: T.rSm, border: `1px solid ${T.line}`, background: T.surface, color: T.ink, fontFamily: "inherit", fontSize: "12.5px", fontWeight: 500 };
  /* Une SECTION : titre discret + encadré clair. C'est ce qui remplace la pile de
     séparateurs du panneau d'avant — on voit d'un coup d'œil où commence quoi. */
  /* Largeurs VOLONTAIREMENT inégales : « Apparence » a deux réglages courts, « Contenu »
     porte des `<select>`, des lignes de filtres et des listes de colonnes. Les mettre à
     égalité rendrait la colonne de droite aussi étroite que l'ancien panneau — c'est
     précisément ce qu'on corrige ici. */
  const section: CSSProperties = { minWidth: 0, padding: "13px 14px", borderRadius: T.rLg, border: `1px solid ${T.line}`, background: T.surface2 };
  const secApparence: CSSProperties = { ...section, flex: "0 1 250px" };
  const secContenu: CSSProperties = { ...section, flex: "1 1 400px" };
  // Segments (largeur / hauteur) — un bouton par valeur possible.
  const seg = (active: boolean): CSSProperties => ({ flex: 1, padding: "6px 4px", borderRadius: T.rSm, border: `1px solid ${active ? T.brand : T.line}`, background: active ? T.brand050 : T.surface, color: active ? T.brand700 : T.ink2, fontFamily: "inherit", fontSize: "12px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" });
  const secTitle: CSSProperties = { display: "flex", alignItems: "center", gap: "7px", fontSize: "12.5px", fontWeight: 700, color: T.ink, marginBottom: "10px" };
  const Form = opts.Form;

  return (
    <div style={{ flex: "none" }}>
      <button className="slb-nbtn" style={NBTN_SM} aria-haspopup="dialog" aria-expanded={open}
        onClick={() => (open ? setOpen(false) : start())} aria-label={`Réglages — ${title}`} title="Réglages du widget">
        <MoreVertical aria-hidden style={{ width: 15, height: 15 }} />
      </button>
      {open && (
        /* `data-slb-nodrag` : cette modale est un DESCENDANT de l'en-tête glissable du
           widget (pas de portail possible, `react-dom` n'est pas importable), donc sans ce
           marqueur un glissement parti d'ici déplacerait le widget derrière le fond flouté
           — cf. la note de `WidgetGrab`. Il est porté par le FOND, donc il couvre aussi la
           boîte : `closest` remonte. */
        <div role="presentation" data-slb-nodrag
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px", background: "rgba(16,26,40,.30)", backdropFilter: "blur(7px)",
            WebkitBackdropFilter: "blur(7px)", animation: "slb-fade .16s ease both",
          }}>
          <div role="dialog" aria-modal="true" aria-label={`Réglages — ${title}`}
            style={{
              /* La largeur suit le CONTENU : un widget sans formulaire (pense-bête,
                 horloge) n'a qu'un titre et une couleur à régler — l'étaler sur 760 px
                 donnerait une grande boîte vide. */
              width: Form ? "min(780px, 100%)" : "min(430px, 100%)",
              maxHeight: "88%", display: "flex", flexDirection: "column",
              background: T.surface, borderRadius: T.rXl, boxShadow: T.shMd, border: `1px solid ${T.line}`,
              overflow: "hidden", animation: "slb-fade .18s ease both",
            }}>
            {/* En-tête : ce qu'on règle, et sur quel widget. Le nom du widget est répété
                ici parce qu'un accueil peut porter deux widgets du même type. */}
            <div style={{ display: "flex", alignItems: "center", gap: "11px", padding: "15px 18px", borderBottom: `1px solid ${T.line}`, flex: "none" }}>
              <span style={icoPillSm(false)}><SlidersHorizontal aria-hidden style={{ width: 15, height: 15 }} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "-.01em", color: T.ink }}>Réglages du widget</div>
                <div style={{ fontSize: "11.5px", fontWeight: 500, color: T.ink3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
              </div>
              <button className="slb-nbtn" style={NBTN_SM} onClick={() => setOpen(false)} aria-label="Fermer les réglages" title="Fermer">
                <X aria-hidden style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <div style={{ ...MODAL_BODY, padding: "16px 18px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-start" }}>
                {/* ── APPARENCE ───────────────────────────────────────────────── */}
                <div style={secApparence}>
                  <div style={secTitle}><Pencil aria-hidden style={{ width: 14, height: 14, color: T.ink3 }} />Apparence</div>
                  {/* TITRE — présent pour TOUS les types (le seul réglage de ceux qui n'ont
                      pas de formulaire). Le `placeholder` montre le titre par défaut :
                      vider le champ le rétablit, sans bouton « réinitialiser ». */}
                  <label style={lbl} htmlFor="slb-w-title">Titre</label>
                  <input id="slb-w-title" style={field} value={draftTitle} placeholder={defaultTitle}
                    maxLength={WIDGET_TITLE_MAX} aria-describedby="slb-w-title-hint"
                    onChange={(e) => setDraftTitle(e.target.value)} />
                  <div id="slb-w-title-hint" style={{ margin: "5px 0 0", fontSize: "10.5px", fontWeight: 500, color: T.ink4 }}>
                    Laisser vide pour garder « {defaultTitle} ».
                  </div>

                  {/* TEINTE — palette fermée (cf. WIDGET_TINTS). Chaque pastille est un vrai
                      bouton : le choix doit être atteignable au clavier, et son `aria-label`
                      NOMME la couleur — qui ne distingue pas deux pastels doit pouvoir
                      choisir quand même. Le libellé sous la rangée dit lequel est retenu. */}
                  <span style={{ ...lbl, marginTop: "13px" }}>Couleur de l'en-tête</span>
                  <div role="group" aria-label="Couleur du widget" style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                    {WIDGET_TINTS.map((t) => {
                      const actif = draftTint === t.key;
                      return (
                        <button key={t.key || "none"} onClick={() => setDraftTint(t.key)}
                          aria-label={t.label} aria-pressed={actif} title={t.label}
                          style={{
                            width: 30, height: 30, borderRadius: 999, cursor: "pointer", padding: 0,
                            // Le contour teal marque la sélection ; la coche la double, pour
                            // ne pas faire reposer l'information sur la seule couleur.
                            border: actif ? `2px solid ${T.brand}` : `1px solid ${T.line2}`,
                            background: t.head || T.surface,
                            display: "grid", placeItems: "center",
                          }}>
                          {actif
                            ? <Check aria-hidden style={{ width: 14, height: 14, color: t.ink }} />
                            : !t.key ? <span aria-hidden style={{ width: 13, height: 1, background: T.ink4, transform: "rotate(-45deg)" }} /> : null}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ margin: "6px 0 0", fontSize: "10.5px", fontWeight: 600, color: T.ink4 }}>
                    {tintOf(draftTint).label}
                  </div>

                  {/* ── LARGEUR ── deux valeurs, donc deux boutons : les poignées latérales
                      font la même chose à la souris, et ces segments restent le chemin
                      CLAVIER et TACTILE (une poignée de 13 px ne se vise pas sans souris).
                      C'est le SEUL réglage d'encombrement qui subsiste ici. */}
                  <span style={{ ...lbl, marginTop: "13px" }}>Largeur</span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button style={seg(!draftWide)} onClick={() => setDraftWide(false)} aria-pressed={!draftWide}>Moitié</button>
                    <button style={seg(draftWide)} onClick={() => setDraftWide(true)} aria-pressed={draftWide}>Pleine</button>
                  </div>

                  {/* ⚠️ NI HAUTEUR NI POSITION ICI — les deux ont été retirées le 2026-08-07,
                      sur demande, parce que le GESTE suffit : la poignée sous la carte règle
                      la hauteur, et l'en-tête se glisse pour réordonner. Contrepartie
                      assumée et connue : ces deux réglages n'ont donc plus aucun chemin au
                      clavier ni au doigt. Voir la note de `WidgetOptions` (§8) avant de
                      remettre l'un ou l'autre. */}
                </div>

                {/* ── CONTENU (formulaire du type) ────────────────────────────── */}
                {Form && (
                  <div style={secContenu}>
                    <div style={secTitle}><SlidersHorizontal aria-hidden style={{ width: 14, height: 14, color: T.ink3 }} />Contenu</div>
                    <Form cfg={draft} onChange={setDraft} />
                  </div>
                )}
              </div>
            </div>

            {/* Pied fixe : le geste d'engagement reste toujours visible.
                À GAUCHE le retrait, à DROITE l'enregistrement — jamais côte à côte : ce
                sont les deux gestes qu'il ne faut pas confondre du bout de la souris.

                ⚠️ 2026-08-18 — LA CONFIRMATION DE RETRAIT PREND TOUT LE PIED : « Annuler »
                et « Enregistrer » DISPARAISSENT tant qu'elle est posée, et reviennent dès
                qu'on répond « Non ». Deux raisons, la seconde étant la vraie :
                  · la question s'étale au lieu de se comprimer contre trois autres boutons ;
                  · surtout, on ne propose plus DEUX sorties contradictoires à la fois.
                    « Retirer / Non » et « Annuler / Enregistrer » côte à côte, c'était
                    quatre boutons pour deux décisions imbriquées — et « Enregistrer »
                    pendant qu'on demande « retirer ce widget ? » n'a aucun sens.
                Le retrait reste le seul geste NON brouillonné de cette modale (il écrit
                aussitôt), ce qui justifie qu'il capte le pied à lui seul le temps de la
                question. */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", padding: "12px 18px", borderTop: `1px solid ${T.line}`, flex: "none" }}>
              {opts.onRemove && (
                confirmRemove ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", flex: "1 1 auto", minWidth: 0 }}>
                    {/* Le libellé de confirmation dit ce qui est PERDU. « Êtes-vous sûr ? »
                        n'aide personne à décider ; « les réglages sont perdus » si.
                        Son `flex: 1` prend la largeur libérée par « Annuler / Enregistrer »
                        et repousse les deux réponses tout à droite, à la place exacte où se
                        trouvaient ces boutons — la souris n'a pas à revenir en arrière. */}
                    <span style={{ flex: 1, minWidth: 0, fontSize: "11.5px", fontWeight: 600, color: T.dangerInk }}>Retirer ce widget ? Ses réglages seront perdus.</span>
                    <button style={{ ...btn, border: `1px solid ${T.danger}`, background: T.danger, color: "#fff" }}
                      onClick={() => { opts.onRemove?.(); setOpen(false); }}>
                      <Trash2 aria-hidden style={{ width: 14, height: 14 }} />Retirer
                    </button>
                    <button className="slb-btng" style={btn} onClick={() => setConfirmRemove(false)}>Non</button>
                  </span>
                ) : (
                  <button className="slb-btng" style={{ ...btn, color: T.dangerInk, flex: "none" }}
                    onClick={() => setConfirmRemove(true)} aria-label={`Retirer le widget — ${title}`}>
                    <Trash2 aria-hidden style={{ width: 14, height: 14 }} />Retirer
                  </button>
                )
              )}
              {/* ESPACEUR, et rien de plus : il pousse « Annuler » et « Enregistrer » à
                  droite, loin du « Retirer ». La phrase « Rien n'est appliqué avant
                  Enregistrer » a été RETIRÉE le 2026-08-07 (demandé) — la règle vaut
                  toujours, elle n'a simplement pas à être écrite sous chaque widget : deux
                  boutons nommés « Annuler » et « Enregistrer » la disent déjà.
                  ⚠️ Ne pas supprimer ce span en croyant nettoyer du vide : sans lui, le pied
                  se tasse à gauche et « Retirer » touche « Enregistrer ».
                  Inutile pendant la confirmation : le bloc de question porte déjà `flex: 1`
                  et occupe la place que ces deux boutons laissent libre. */}
              {!confirmRemove && (
                <>
                  <span style={{ flex: 1, minWidth: 0 }} />
                  <button className="slb-btng" style={btn} onClick={() => setOpen(false)}>Annuler</button>
                  <button className="slb-btnp" style={{ ...btn, border: "none", background: T.brand, color: "#fff" }} onClick={save}>
                    <Save aria-hidden style={{ width: 14, height: 14 }} />Enregistrer
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* --- Coquille de widget compact : en-tête (icône + titre + actions), corps
      libre, pied optionnel. L'en-tête est la zone de PRÉHENSION (glisser pour
      réordonner) et porte le ⋮ des réglages ; le corps reste toujours interactif.
      chaque widget vit indépendamment. --- */
function Widget({
  icon: Icon,
  title,
  sub,
  solar,
  headActions,
  children,
  footer,
}: {
  icon: LucideIcon;
  title: string;
  sub?: string;
  solar?: boolean;
  headActions?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const opts = useContext(WidgetOptionsCtx);
  const grab = useContext(WidgetGrabCtx);
  /* `null` hors d'un `SourceFeed` — c'est ce qui décide de la présence du bouton. */
  const refreshCtx = useContext(SourceRefreshCtx);
  /* TITRE : celui de l'instance s'il existe, sinon celui que le composant a passé.
     `title` (la prop) reste donc le titre PAR DÉFAUT — c'est lui que le panneau montre
     en `placeholder`, et lui qui revient si l'utilisateur vide le champ. `shown` sert
     partout ailleurs, y compris dans les `aria-label` des menus : un widget renommé
     doit s'annoncer sous son nouveau nom. */
  const custom = useContext(WidgetTitleCtx).trim();
  const shown = custom || title;
  /* TEINTE : elle habille LA CARTE ENTIÈRE — fond, bordure assortie, encre du titre et
     pastille d'icône. L'en-tête, lui, ne porte plus de fond propre : il garde son filet
     de séparation, assombri à la teinte pour rester visible sur le pastel.
     Ce que la teinte ne touche PAS, volontairement : les contenus blancs (tuiles de la
     synthèse SAV, zone de saisie du pense-bête) qui ressortent alors comme des cartes
     posées dessus, et les couleurs de SENS (badges de statut, alertes ambre ou rouges),
     qui doivent garder leur force partout. La pastille `solar` d'un outil solaire
     l'emporte aussi sur la teinte : c'est un marqueur, pas une décoration. */
  const tint = tintOf(useContext(WidgetTintCtx));
  /* `--slb-row-hover` : la nuance que prend une LIGNE au survol dans ce widget. Elle est
     publiée ici, en variable CSS héritée, parce que le survol est posé ailleurs — feuille
     §2 et moteur JS §2-bis — et que ni l'un ni l'autre ne connaît la teinte de l'instance.
     Sans elle, survoler une ligne d'un widget rosé la repeignait en GRIS : la teinte
     s'arrêtait au premier mouvement de souris. Le cast couvre les propriétés
     personnalisées, que `CSSProperties` ne décrit pas. */
  const cardStyle: CSSProperties = tint.head
    ? { ...CARD, backgroundColor: tint.head, border: `1px solid ${tint.pill || T.line}`,
        ...({ "--slb-row-hover": tint.pill || T.surface2 } as CSSProperties) }
    : CARD;
  /* `position: relative` : c'est l'ancre de la barre de chargement posée en bas de l'en-tête
     (voir plus bas). Sans elle, la barre se placerait par rapport à la page. */
  const headStyle: CSSProperties = tint.head
    ? { ...WHEAD, position: "relative", borderBottom: `1px solid ${tint.pill || T.line}` }
    : { ...WHEAD, position: "relative" };
  return (
    <Card style={cardStyle}>
      {/* L'EN-TÊTE est la zone de préhension (cf. WidgetGrabCtx). `cursor: grab` suffit
          comme affordance : pas de `title` ici, il se déclencherait au survol du titre du
          widget. Pas de poignée « mors de déménageur » non plus — elle n'existait qu'en
          mode Personnaliser, et sur chaque carte en usage courant elle serait du bruit. */}
      <div style={grab ? { ...headStyle, cursor: "grab" } : headStyle}
        draggable={!!grab} onDragStart={grab?.onDragStart} onDragEnd={grab?.onDragEnd}
        onPointerDownCapture={grab?.onPointerDownCapture}>
        <span style={!solar && tint.pill ? { ...icoPillSm(false), background: tint.pill, color: tint.ink } : icoPillSm(solar)}>
          <Icon aria-hidden style={{ width: 15, height: 15 }} strokeWidth={1.7} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={tint.head ? { ...WTITLE, color: tint.ink } : WTITLE}>{shown}</div>
          {sub && <div style={WSUB}>{sub}</div>}
        </div>
        {headActions}
        {/* RELIRE LES DONNÉES — présent UNIQUEMENT sous un `SourceFeed`, donc seulement sur
            les widgets qui lisent la base (§6-ter). Un pense-bête ou une horloge n'a rien
            à relire et n'a donc pas ce bouton : la règle tient au contexte, pas à une
            liste de types qu'il faudrait maintenir.
            ⚠️ C'est un <button> DANS la zone de préhension : le DnD HTML5 avalerait son
            clic si `onDragStart` ne refusait pas déjà de démarrer depuis un élément
            interactif (§7-11 d'ARCHITECTURE.md — trois causes, dont celle-là). */}
        {refreshCtx && (
          <button type="button" className="slb-nbtn" style={NBTN_SM}
            onClick={refreshCtx.refresh}
            aria-label={`Relire les données — ${shown}`}
            title={refreshCtx.at ? `Données du ${fmtStamp(refreshCtx.at)} — cliquer pour relire` : "Relire les données"}>
            <RefreshCw aria-hidden className={refreshCtx.busy ? "slb-spin" : undefined}
              style={{ width: 15, height: 15 }} />
          </button>
        )}
        {/* ⋮ affiché pour TOUS les widgets depuis le 2026-08-04 : même un type sans
            réglages propres est RENOMMABLE, donc le bouton a toujours quelque chose
            à offrir — il n'est plus décoratif pour autant. */}
        {opts && <WidgetOptionsMenu opts={opts} title={shown} defaultTitle={title} />}
        {/* INDICATEUR DE CHARGEMENT (2026-08-19, demandé) — une barre fine sur le bord bas de
            l'en-tête, tant que la source de ce widget lit (`busy` = `loading || draining`,
            publié par `useSnapshot`).
            Pourquoi ICI et pas dans chaque carte : le contexte `SourceRefreshCtx` n'existe que
            sous un `SourceFeed`, donc cette seule ligne couvre TOUS les widgets qui lisent la
            base — notifications, tâches, notes, SAV, performance, exceptions, annuaire — et
            aucun de ceux qui n'ont rien à lire (horloge, pense-bête, liste à cocher).
            Pourquoi elle ne remplace pas les squelettes : ceux-ci disent « rien à afficher
            ENCORE » au tout premier chargement ; la barre dit « ce que tu vois n'est pas
            encore tout », ce qui est le cas pendant TOUT le drainage — `loading` est déjà
            retombé à faux dès la première page, et une liste de 50 lignes sur 371 paraît
            complète. C'est exactement le mensonge silencieux que ce bloc traque ailleurs.
            ⚠️ `position: absolute` sur un en-tête passé en `relative` : la barre chevauche le
            filet de séparation au lieu de pousser le contenu, donc rien ne saute à l'écran
            quand elle apparaît ou disparaît.
            ⚠️ Pas de `role="progressbar"` : la progression est INCONNUE (on ne sait pas combien
            de pages restent). `role="status"` annonce l'activité sans promettre un pourcentage
            que personne ne peut donner. */}
        {refreshCtx?.busy && (
          <span role="status" aria-label={`Lecture des données en cours — ${shown}`}
            title="Lecture des données en cours"
            style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: 2, overflow: "hidden", background: tint.pill || T.brand050, pointerEvents: "none" }}>
            <span className="slb-bar" style={{ display: "block", width: "38%", height: "100%", borderRadius: 2, background: T.brand }} />
          </span>
        )}
      </div>
      <div>
        {children}
        {footer && (
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 16px", borderTop: `1px solid ${tint.head ? tint.pill || T.line : T.line}` }}>
            {footer}
          </div>
        )}
      </div>
    </Card>
  );
}

/* --- Navigation par onglets vers les pages de l'espace ---------------------
   Même visuel que la TabBar du gabarit (souligné teal coulissant, icônes),
   mais en liens <a> avec target _top : le bloc vit dans une iframe Softr,
   la navigation doit changer la page parente. Placée sous le héro, elle se
   colle en haut de l'écran au scroll (sticky). --- */
function PageNavBar({ tabs, activeId, onSelect }: { tabs: NavTab[]; activeId: string; onSelect: (id: string) => void }) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [ind, setInd] = useState({ left: 0, width: 0 });
  useEffect(() => {
    const idx = tabs.findIndex((t) => t.id === activeId);
    const el = refs.current[idx];
    if (el) setInd({ left: el.offsetLeft, width: el.offsetWidth });
  }, [activeId, tabs.length]);
  return (
    <nav aria-label="Navigation principale" style={{ position: "sticky", top: 0, zIndex: 20, backgroundColor: T.canvas }}>
      <div className="slb-tabs" role="tablist" style={TABS_ROW}>
        {tabs.map((tab, i) => {
          const Icon = tab.icon;
          const active = tab.id === activeId;
          const style: CSSProperties = { ...TAB, color: active ? T.brand : T.ink3, textDecoration: "none", cursor: active ? "default" : "pointer" };
          const inner = <><Icon aria-hidden style={{ width: 16, height: 16 }} strokeWidth={1.7} />{tab.label}</>;
          // Onglet « page de l'espace » (lien _top) — réservé à un usage futur.
          return tab.href ? (
            <a key={tab.id} ref={(el) => { refs.current[i] = el; }} href={active ? undefined : tab.href}
              target={active ? undefined : "_top"} aria-current={active ? "page" : undefined} className="slb-tab" style={style}>
              {inner}
            </a>
          ) : (
            // Onglet de contenu in-block (Accueil / app embarquée) — bascule le contenu.
            <button key={tab.id} ref={(el) => { refs.current[i] = el; }} role="tab" aria-selected={active}
              onClick={() => onSelect(tab.id)} className="slb-tab" style={style}>
              {inner}
            </button>
          );
        })}
        <div style={{ position: "absolute", bottom: 0, height: "2px", borderRadius: "2px 2px 0 0", backgroundColor: T.brand, left: ind.left, width: ind.width, transition: "left .3s cubic-bezier(.22,.61,.36,1), width .3s cubic-bezier(.22,.61,.36,1)" }} />
      </div>
    </nav>
  );
}

/* --- Héro — dégradé SunLib + logo blanc rond à droite ----------------------
   Reprise du bandeau historique (demande explicite) : dégradé de marque
   #13A3AC → #3CAE68, logo_Blanc_rond.svg à droite. */
/* --- Dégradé de marque ANIMÉ du héro -----------------------------------------
   Le teal glisse vers la droite, le vert revient par la gauche, en boucle très
   lente et sans couture. Trois décisions :
   · On translate une COUCHE de fond au lieu d'animer `background-position` : un
     `transform` est composité par le GPU, une position de fond repeint la surface
     à chaque image (coûteux sur un bandeau aussi large).
   · La couche fait 300 % de large et porte un motif teal→vert PÉRIODIQUE (un
     cycle complet tous les 33,333 %). La translater d'exactement -33,3333 %
     ramène un rendu identique à l'état de départ : la boucle se referme sans
     saut de couleur, et le mouvement garde toujours le même sens.
   · L'animation est déclarée en JS (Web Animations API) et NON en @keyframes :
     le CSS injecté par StyleInjector peut ne pas s'appliquer dans le bloc Softr
     (cf. §2), alors que `element.animate()` ne dépend d'aucune feuille de style.
     Le dégradé fixe reste en repli sous la couche : si l'animation ne démarre
     pas, le héro garde l'apparence d'origine. --- */
const HERO_GRADIENT = "linear-gradient(90deg, #13A3AC 0%, #3CAE68 100%)";
const HERO_LOOP = "linear-gradient(90deg, #13A3AC 0%, #3CAE68 16.6667%, #13A3AC 33.3333%, #3CAE68 50%, #13A3AC 66.6667%, #3CAE68 83.3333%, #13A3AC 100%)";
// Durée d'un cycle complet. Le mouvement doit rester une respiration de fond, pas
// un effet : en dessous de ~30 s il devient perceptible et fatigant à la lecture.
const HERO_CYCLE_MS = 60000;

function useHeroPan() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== "function") return;
    // Respecte le réglage système « réduire les animations » (comme le FLIP, §11).
    const reduce = !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const anim = el.animate(
      [{ transform: "translate3d(0,0,0)" }, { transform: "translate3d(-33.3333%,0,0)" }],
      { duration: HERO_CYCLE_MS, iterations: Infinity, easing: "linear" },
    );
    return () => anim.cancel();
  }, []);
  return ref;
}

/* --- Logo SunLib ANIMÉ — sunburst de 60 rayons -------------------------------
   Le motif est reconstruit en SVG inline plutôt que chargé depuis le dépôt : un
   fichier distant en <img> ne s'animerait pas rayon par rayon. Les rayons sont
   tracés en x=86, soit 14 unités à gauche du centre — c'est ce décalage qui
   donne le vrillage d'hélice, pas une erreur de centrage.

   Deux mouvements se superposent, et c'est leur superposition qui porte l'effet :
   · le moyeu tourne en 240 s dans le sens HORAIRE (le sens du vrillage : les
     pointes penchent de ce côté, l'antihoraire donne une contre-rotation) ;
   · chaque rayon respire en opacité sur 47 s, décalé de −783 ms par rayon.
   La rotation seule serait répétitive : 60 rayons identiques ramènent une image
   identique tous les 240/60 = 4 s. C'est l'onde de 47 s, qui n'est PAS un
   multiple de ces 4 s (47 / 4 = 11,75), qui casse la répétition et donne la
   profondeur. En retouchant l'une des deux durées, garder ce rapport non entier
   — sinon l'onde se cale sur la rotation et l'image se figera par cycles. 47 est
   premier, donc l'onde ne retombera jamais en phase avec une rotation dont la
   période apparente est un nombre entier de secondes : c'est le choix sûr si
   quelqu'un touche au spin plus tard.

   Le décalage NÉGATIF n'est pas cosmétique : positif ou absent, les 60 rayons
   démarrent en phase et la première seconde du chargement montre un fondu
   collectif. Négatif, l'onde est déjà installée à la première image.

   Animations en Web Animations API et NON en @keyframes, pour la raison déjà
   donnée au dégradé du héro : le CSS de StyleInjector peut ne pas s'appliquer
   dans le bloc Softr (§2), et un logo figé ne signalerait rien. Le SVG seul est
   déjà le rendu correct — l'animation ne fait que s'ajouter.

   TAILLE — le trait fait 4 unités sur un viewBox de 200, donc 4 × taille/200 à
   l'écran. Sous ~104 px il passe sous 2 px, les rayons tombent sous le pixel et
   la rotation lente produit un fourmillement de moiré : d'où le plancher du
   clamp côté héro. Pour réutiliser le logo en 48 px (favicon, avatar, sidebar),
   passer `still` — mieux vaut un logo fixe qu'un logo qui scintille. --- */
const SUNBURST_RAYS = 60;
const SUNBURST_SPIN_MS = 240000;
const SUNBURST_WAVE_MS = 47000;

function Sunburst({ height, still = false }: { height: string; still?: boolean }) {
  const hubRef = useRef<SVGGElement | null>(null);
  const rayRefs = useRef<(SVGLineElement | null)[]>([]);
  useEffect(() => {
    const hub = hubRef.current;
    if (still || !hub || typeof hub.animate !== "function") return;
    // Même garde que le pan du héro et le FLIP : `animation:none` du CSS injecté
    // ne coupe PAS une animation Web Animations API, il faut ne pas la démarrer.
    const reduce = !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const anims: Animation[] = [
      hub.animate(
        [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
        { duration: SUNBURST_SPIN_MS, iterations: Infinity, easing: "linear" },
      ),
    ];
    rayRefs.current.forEach((ray, i) => {
      if (!ray) return;
      // L'easing porte sur CHAQUE segment de l'onde (comme le fait une @keyframes),
      // pas sur l'itération entière : le mettre en option lisserait tout le cycle.
      anims.push(ray.animate(
        [{ opacity: 1, easing: "ease-in-out" }, { opacity: 0.86, easing: "ease-in-out" }, { opacity: 1 }],
        { duration: SUNBURST_WAVE_MS, delay: -i * (SUNBURST_WAVE_MS / SUNBURST_RAYS), iterations: Infinity },
      ));
    });
    return () => anims.forEach((a) => a.cancel());
  }, [still]);
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label="SunLib"
      style={{ flex: "none", marginLeft: "auto", height, width: "auto" }}>
      {/* transformBox / transformOrigin sont obligatoires : sans eux, `rotate`
          sur un <g> pivote autour de l'origine du repère, pas du centre du logo. */}
      <g ref={hubRef} style={{ transformBox: "view-box", transformOrigin: "center" }}>
        {Array.from({ length: SUNBURST_RAYS }, (_, i) => (
          <line key={i} ref={(el) => { rayRefs.current[i] = el; }}
            transform={`rotate(${i * 6} 100 100)`}
            x1="86" y1="61.5" x2="86" y2="1.3" stroke="#fff" strokeWidth="4" />
        ))}
      </g>
    </svg>
  );
}

/* ⚠️ `FreshnessChip` (chip « À jour · chiffres d'il y a 4 min » + bouton global) a été
   SUPPRIMÉ le 2026-08-18 : le rafraîchissement est passé du héro à chaque carte qui lit
   la base (cf. `SourceRefreshCtx`, §6-ter). Un seul bouton pour dix sources relisait tout
   pour une intention qui ne portait presque jamais que sur un widget.
   Ce qui portait sa fonction d'information est resté : `AggregateNote` date l'instantané
   des widgets qui agrègent, et le bouton de chaque carte donne la date en `title`. */

function Hero({ firstName }: { firstName: string }) {
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const chip: CSSProperties = { display: "inline-flex", alignItems: "center", gap: "7px", padding: "7px 13px", borderRadius: "999px", fontSize: "12.5px", fontWeight: 600, color: "#fff", backgroundColor: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.38)", backdropFilter: "blur(4px)" };
  const panRef = useHeroPan();
  return (
    <section aria-label="Bienvenue" style={{ position: "relative", isolation: "isolate", borderRadius: T.rXl, overflow: "hidden", border: `1px solid ${T.line}`, boxShadow: T.shSm, background: HERO_GRADIENT }}>
      {/* Couche animée (décorative) : au-dessus du dégradé de repli, sous le contenu. */}
      <div ref={panRef} aria-hidden
        style={{ position: "absolute", top: -1, bottom: -1, left: 0, width: "300%", zIndex: 0, background: HERO_LOOP, willChange: "transform" }} />
      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", flexWrap: "wrap", gap: "20px 28px", padding: "clamp(22px, 3.8vw, 38px) clamp(22px, 4.5vw, 46px)" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.85)" }}>{today}</div>
          <h1 style={{ margin: "8px 0 6px", fontSize: "clamp(26px, 3.6vw, 36px)", fontWeight: 700, letterSpacing: "-.02em", color: "#fff", textShadow: "0 1px 2px rgba(16,26,40,.15)" }}>
            Bienvenue {firstName ? `${firstName} ` : ""}!
          </h1>
          <p style={{ margin: 0, fontSize: "14.5px", fontWeight: 500, color: "rgba(255,255,255,.92)", maxWidth: 480 }}>
            Voici l'essentiel de votre activité SunLib aujourd'hui.
          </p>
          {/* UN SEUL chip : « Notifications », SANS compteur pour l'instant.
              · « N tâches urgentes » a été retiré — la notion n'existe pas dans le CRM,
                et la source des tâches partenaires n'étant pas branchée, elle affichait
                un « 0 » perpétuel qui se lisait comme « rien à faire ».
              · « N dossiers à traiter » comptait en réalité les N derniers dossiers
                créés : un simple plafond de liste, pas une charge de travail.
              ⚠️ Le compteur reste à IMPLÉMENTER (voir la note au-dessus de Hero) : tant
              qu'il ne compte pas quelque chose de vrai, mieux vaut pas de nombre qu'un
              nombre faux — un compteur à côté d'une cloche est cru sur parole. */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "20px" }}>
            <span style={chip}><Bell aria-hidden style={{ width: 14, height: 14 }} />Notifications</span>
          </div>
        </div>
        {/* Les rayons sont tracés en blanc à la source : plus besoin du
            brightness(0) invert(1) qui redressait l'ancien SVG du dépôt.
            Plancher du clamp relevé de 88 à 104 px — en dessous, le trait passe
            sous 2 px et moire (voir la note TAILLE sur <Sunburst>). */}
        <Sunburst height="clamp(104px, 11vw, 140px)" />
      </div>
    </section>
  );
}

/* --- Raccourcis vers les PAGES de l'espace Softr. Les adresses viennent de `PAGES`
      (§0-bis) ; ce composant ne fait que les résoudre au rendu. Une tuile sans adresse
      connue est rendue DÉSACTIVÉE (un `<span>`, pas un `<a>`) : elle reste visible — la
      page existe, on sait juste où elle n'est pas encore — mais elle ne promet plus un
      clic qui ne mène nulle part. Renseigner le slug dans §0-bis l'active, sans toucher
      ici.
      ⚠️ Titre « Raccourcis » et non « Outils » depuis que les outils ont leur onglet :
      deux sections « Outils » aux contenus différents se liraient comme un bug. --- */
function QuickLinks() {
  return (
    <section aria-label="Raccourcis">
      <h2 style={{ ...H2, marginBottom: "14px" }}>Raccourcis</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "13px" }}>
        {QUICK_LINKS_VISIBLES.map(({ label, icon: Icon, page, url, solar }) => {
          /* `page` = page de l'espace (résolue, target _top) ; `url` = outil externe. */
          const href = page !== undefined ? pageUrl(page) : url ?? "";
          const tile: CSSProperties = {
            display: "flex", alignItems: "center", gap: "12px", padding: "13px 15px",
            backgroundColor: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rLg,
            boxShadow: T.shSm, textDecoration: "none",
          };
          const inner = (
            <>
              <span style={icoPill(solar)}><Icon aria-hidden style={{ width: 17, height: 17 }} strokeWidth={1.7} /></span>
              <span style={{ flex: 1, minWidth: 0, fontSize: "13.5px", fontWeight: 600, color: href ? T.ink : T.ink4 }}>{label}</span>
              {href
                ? <ChevronRight aria-hidden className="slb-arrow" style={{ width: 16, height: 16, color: T.ink4, flex: "none" }} />
                : <span style={{ fontSize: "10.5px", fontWeight: 600, color: T.ink4, flex: "none" }}>bientôt</span>}
            </>
          );
          return href ? (
            <a key={label} href={href}
              target={page !== undefined ? "_top" : "_blank"} rel={page !== undefined ? undefined : "noopener noreferrer"}
              className="slb-tile" style={tile}>
              {inner}
            </a>
          ) : (
            <span key={label} aria-disabled="true" title="Adresse pas encore renseignée"
              style={{ ...tile, backgroundColor: T.surface2, boxShadow: "none", cursor: "default" }}>
              {inner}
            </span>
          );
        })}
      </div>
    </section>
  );
}

/* --- Onglet « app externe » : intègre un projet public (sans login) DIRECTEMENT
      dans la page via une iframe (Formulaire de contact, Simulateur Grille).
      ⚠️ Nécessite que l'app cible autorise l'iframing (pas de X-Frame-Options
      DENY/SAMEORIGIN ni CSP frame-ancestors restrictive) ET que la CSP de
      l'iframe Softr autorise `frame-src https://*.vercel.app`. --- */
/* --- HAUTEUR D'UN OUTIL EMBARQUÉ — pourquoi elle ne peut pas être devinée ----------
   LE SYMPTÔME : deux barres de défilement imbriquées, celle de l'outil et celle de la
   page. Elle vient de ce que le cadre est plus COURT que le contenu de l'app.

   LA CONTRAINTE : l'iframe est CROSS-ORIGIN. Le bloc ne peut ni lire `contentDocument`,
   ni mesurer la hauteur du document distant, ni styliser sa barre. Il n'existe donc
   qu'une seule façon exacte de dimensionner le cadre : que l'app l'ANNONCE elle-même.

   LE PROTOCOLE, six lignes à coller dans chaque app embarquée (recette complète dans le
   README §3) : `parent.postMessage({ type: "sunlib:embed-height", height: N }, "*")`,
   réémis à chaque changement de taille.

   TANT QU'UNE APP N'ENVOIE RIEN, le cadre garde EXACTEMENT la hauteur qu'il avait avant
   (`EMBED_H_FALLBACK`) : la bascule se fait app par app, sans coordination et sans
   régression pour celles qu'on n'a pas encore touchées. --- */
const EMBED_MSG = "sunlib:embed-height";
const EMBED_H_FALLBACK = "min(1200px, 82vh)";
const EMBED_H_MIN = 560;
/* Garde-fou : une hauteur vient d'un message, donc de l'extérieur. Un contenu qui
   grandirait en boucle (une app qui se dimensionne sur son propre cadre) ne doit pas
   pouvoir étirer la page indéfiniment. 20 000 px ≈ 20 écrans : au-delà, c'est un défaut
   de l'app, pas une page longue. */
const EMBED_H_MAX = 20000;

/** Origine d'une adresse d'outil, "" si elle est illisible. Une adresse relative ou
 *  vide ne donne AUCUNE origine — et sans origine on n'accepte aucun message, plutôt que
 *  d'en accepter n'importe lequel. */
const originOf = (src: string): string => { try { return new URL(src).origin; } catch { return ""; } };

/** Hauteur portée par un message, ou `null` si le message n'est pas à prendre.
 *  PURE — c'est ici que se prennent les décisions de sécurité et de bornage, donc c'est
 *  ici qu'on peut les éprouver sans navigateur.
 *  ⚠️ On n'accepte QUE l'origine de l'outil affiché : `message` est reçu de n'importe qui
 *  — une autre iframe de la page, une extension du navigateur, la page Softr elle-même.
 *  Sans ce test, un tiers pourrait redimensionner le cadre à volonté. */
function embedHeightOf(msg: { origin?: string; data?: unknown }, origine: string): number | null {
  if (!origine || msg.origin !== origine) return null;
  const d = msg.data as { type?: unknown; height?: unknown } | null;
  if (!d || typeof d !== "object" || d.type !== EMBED_MSG) return null;
  const v = Math.round(Number(d.height));
  if (!(v > 0)) return null;              // NaN, 0, négatif : ignoré — jamais de repli à 0
  return Math.min(EMBED_H_MAX, Math.max(EMBED_H_MIN, v));
}

function useEmbedHeight(src: string): number | null {
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    /* Changer d'outil REMET À NULL : garder la hauteur du précédent afficherait le
       nouveau dans un cadre à la mauvaise taille jusqu'à son premier message. */
    setH(null);
    const origine = originOf(src);
    const onMsg = (e: MessageEvent) => {
      const v = embedHeightOf(e, origine);
      if (v !== null) setH(v);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [src]);
  return h;
}

function EmbedTab({ src, title }: { src: string; title: string }) {
  const h = useEmbedHeight(src);
  return (
    <section aria-label={title} style={{ borderRadius: T.rXl, overflow: "hidden", border: `1px solid ${T.line}`, boxShadow: T.shSm, backgroundColor: T.surface }}>
      {/* ⚠️ `scrolling="no"` SEULEMENT quand la hauteur est annoncée. L'attribut supprime
          la barre ET la possibilité de défiler : posé sur une hauteur devinée, il rendrait
          le bas du contenu inatteignable. Il est déprécié en HTML5, et c'est pourtant le
          seul levier disponible — `overflow: hidden` devrait être appliqué au document
          DISTANT, que l'on ne peut pas styliser. Il garantit qu'un écart d'un pixel entre
          la hauteur annoncée et la hauteur réelle ne fasse pas réapparaître la barre. */}
      <iframe src={src} title={title} loading="lazy" scrolling={h ? "no" : undefined}
        style={{ display: "block", width: "100%", height: h ? `${h}px` : EMBED_H_FALLBACK, minHeight: EMBED_H_MIN, border: "none" }} />
    </section>
  );
}

/* --- ONGLET « OUTILS ». Une grille de boutons ; un clic ouvre l'outil IN PAGE, juste
      en dessous, sans quitter le CRM. La grille reste visible : on passe d'un outil à
      l'autre en un clic, et l'outil ouvert est marqué (bordure + fond teintés, plus
      `aria-pressed`) — la couleur ne porte donc jamais l'information seule.

      Tous les outils sont embarquables aujourd'hui. Le chemin NOUVEL ONGLET reste en
      place pour une entrée `url` (app à login qui refuse l'iframing, cf. `OUTILS`) :
      son bouton l'annoncerait par une icône différente et un `title`, pour que le
      départ hors du CRM ne surprenne pas.

      ⚠️ Un refus d'iframe est INDÉTECTABLE depuis ici (l'iframe est cross-origin, son
      contenu est illisible) : si une app se met à refuser l'iframing, son cadre
      restera blanc sans erreur. D'où le lien « Nouvel onglet » présent dans l'en-tête
      de CHAQUE outil ouvert — c'est la porte de sortie, pas un ornement. --- */
function OutilsTab() {
  const [openId, setOpenId] = useState<string | null>(null);
  // L'outil ouvert doit être embarquable ET avoir une adresse : un `openId` devenu
  // invalide (registre modifié) retombe donc proprement sur « rien d'ouvert ».
  const open = OUTILS_VISIBLES.find((o) => o.id === openId && o.embed) ?? null;

  return (
    <section aria-label="Outils" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div>
        <h2 style={{ ...H2, marginBottom: "14px" }}>Outils</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "13px" }}>
          {OUTILS_VISIBLES.map((o) => {
            const { id, label, icon: Icon, desc, embed, url, solar } = o;
            const href = embed ?? url ?? "";       // "" = adresse pas encore renseignée
            const actif = open?.id === id;
            const btn: CSSProperties = {
              display: "flex", alignItems: "center", gap: "12px", padding: "13px 15px",
              textAlign: "left", width: "100%", font: "inherit", cursor: "pointer",
              backgroundColor: actif ? T.brand050 : T.surface,
              border: `1px solid ${actif ? T.brand100 : T.line}`,
              borderRadius: T.rLg, boxShadow: actif ? "none" : T.shSm, textDecoration: "none",
            };
            const inner = (
              <>
                <span style={icoPill(solar)}><Icon aria-hidden style={{ width: 17, height: 17 }} strokeWidth={1.7} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: "13.5px", fontWeight: 600, color: href ? (actif ? T.brand700 : T.ink) : T.ink4 }}>{label}</span>
                  <span style={{ display: "block", fontSize: "12px", fontWeight: 500, color: T.ink3, marginTop: "1px" }}>{desc}</span>
                </span>
                {!href
                  ? <span style={{ fontSize: "10.5px", fontWeight: 600, color: T.ink4, flex: "none" }}>bientôt</span>
                  : embed
                    ? <ChevronRight aria-hidden className="slb-arrow" style={{ width: 16, height: 16, color: actif ? T.brand600 : T.ink4, flex: "none" }} />
                    : <ExternalLink aria-hidden style={{ width: 15, height: 15, color: T.ink4, flex: "none" }} />}
              </>
            );

            // Pas d'adresse : ni bouton ni lien — un élément inerte qui reste lisible.
            if (!href) return (
              <span key={id} aria-disabled="true" title="Adresse pas encore renseignée"
                style={{ ...btn, backgroundColor: T.surface2, boxShadow: "none", cursor: "default" }}>
                {inner}
              </span>
            );

            // Outil externe (entrée `url`) : nouvel onglet, jamais dans l'iframe du bloc.
            if (!embed) return (
              <a key={id} href={href} target="_blank" rel="noopener noreferrer"
                title={`${label} — s'ouvre dans un nouvel onglet`}
                className="slb-tile" style={btn}>
                {inner}
              </a>
            );

            // Outil embarquable : bascule d'affichage. Recliquer l'outil ouvert le ferme.
            return (
              <button key={id} type="button" aria-pressed={actif}
                onClick={() => setOpenId(actif ? null : id)}
                className="slb-tile" style={btn}>
                {inner}
              </button>
            );
          })}
        </div>
      </div>

      {open?.embed && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* En-tête de l'outil ouvert : ce qu'on regarde, la porte de sortie, la fermeture. */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: "13.5px", fontWeight: 600, color: T.ink }}>{open.label}</span>
            <a href={open.embed} target="_blank" rel="noopener noreferrer"
              className="slb-btng"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 11px", fontSize: "12.5px", fontWeight: 600, color: T.ink2, backgroundColor: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rMd, textDecoration: "none" }}>
              <ExternalLink aria-hidden style={{ width: 14, height: 14 }} strokeWidth={1.8} />
              Nouvel onglet
            </a>
            <button type="button" onClick={() => setOpenId(null)}
              className="slb-btng"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 11px", fontSize: "12.5px", fontWeight: 600, color: T.ink2, backgroundColor: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rMd, cursor: "pointer", font: "inherit" }}>
              <X aria-hidden style={{ width: 14, height: 14 }} strokeWidth={1.8} />
              Fermer
            </button>
          </div>
          <EmbedTab src={open.embed} title={open.label} />
        </div>
      )}
    </section>
  );
}

/* --- SunLib sur LinkedIn — les embeds Elfsight sont désormais des WIDGETS du
      tableau de bord (voir LinkedinCard / LinkedinBannerCard au §10), chargés
      par le composant partagé `ElfsightWidget`. Plus de section fixe : ils
      s'affichent, se réordonnent et se suppriment comme les autres widgets. --- */

/* ============================================================================
   9. Tableau de bord — widgets indépendants et compacts
   ============================================================================ */

/* --- Widget « Nouveaux dossiers abonnés » -------------------------------------
   ⚠️⚠️ REFONTE DU 2026-08-06 — UNE SEULE TABLE, « NOTIFICATION CENTER ».
   Avant, ce widget lisait « Abonnés » pour la liste et venait chercher ici, par une
   JOINTURE sur le record id, l'état lu / non lu. Deux tables pour une liste, et un
   deuxième widget « Derniers dossiers Abonné » posable depuis la galerie (le preset
   générique de la source `abonnes`) affichait exactement la même chose sans l'état de
   lecture : deux widgets jumeaux sur l'accueil. Le preset a été retiré (§6-bis) et
   celui-ci lit la table des notifications, et rien d'autre.

   Ce que ça change, et pourquoi c'est mieux :
   · plus de jointure, donc plus de « État incomplet » — l'état de lecture est porté
     par la ligne affichée elle-même, il ne peut plus manquer ;
   · une notification EST l'événement (« Nouveau abonné créé pour : … », « Nouveau
     contrat signé pour l'abonné : … »), là où « Abonnés » ne donnait qu'un dossier ;
   · le titre suit : « Nouveaux dossiers abonnés » et non plus « Derniers dossiers ».

   TROIS PASSES de sélection (`selectNotifs`, pure et testée), dont deux corrigent des
   défauts qui sont côté base (cf. SELECT_NOTIF_C) et deviendraient visibles dès qu'on
   liste la table :
   · PROPRIÉTAIRE RENSEIGNÉ — une ligne dont `Proprietaire (from Installateur )` est
     vide n'est pas affichée. Cela écarte les ~380 lignes orphelines (aucun lien vers un
     abonné → tous les lookups vides, texte compris : « Nouveau abonné créé pour :  »).
   · MES DOSSIERS (2026-08-06, `cfg.mesDossiers`, ACTIF par défaut) — le propriétaire
     doit désigner l'UTILISATEUR CONNECTÉ. Le rapprochement se fait sur les mots du nom
     et non sur l'e-mail, parce que la table ne porte aucun e-mail : voir `ownerIsUser`
     (§5) pour la règle et ce qu'elle refuse délibérément.
   · DÉDOUBLONNAGE — chaque événement crée DEUX lignes (une « Lue », une « Non lue »).
     Sans regroupement, la liste montrerait tout en double. On garde, par dossier et
     par texte, la ligne encore « à lire » en priorité : c'est celle sur laquelle
     « Vu » a un effet.

   `cfg` : quelles informations montrer, combien de lignes, bouton « Détail » ou non.
   Le registre ci-dessous est la seule chose à toucher pour en proposer une de plus. */

type NotifsCfg = { champs: string[]; limite: number; detail: boolean; marquage: boolean; mesDossiers: boolean;
  /** PÉRIMÈTRE CLIENTÈLE (2026-08-20) — tous · Pro · Particuliers · Solo · Duo, cf.
   *  `CLIENTELES`. À « tous » par défaut, comme partout : c'est une question ponctuelle
   *  (« les nouveaux dossiers PRO à traiter »), pas le réglage de tous les jours. */
  clientele: Clientele };

/** Clé de regroupement des lignes jumelles : le dossier lié et le texte de
 *  l'événement. Pas la date — les deux jumelles naissent à quelques secondes d'écart,
 *  et rien ne garantit qu'elles portent la même. Une ligne orpheline (`abonneId` vide)
 *  ne serait pas distinguée d'une autre orpheline ; ce n'est pas un problème, le filtre
 *  du propriétaire les a déjà toutes écartées. */
const notifKey = (n: Notif): string => `${n.abonneId}|${n.texte}`;

/** Ce que le widget garde, et ce qu'il a écarté FAUTE DE PROPRIÉTAIRE ou parce que le
 *  propriétaire est quelqu'un d'autre. Ces deux compteurs servent l'état vide : quand la
 *  liste est vide, il faut pouvoir dire sur combien de notifications le nom a été
 *  cherché — sinon un widget vide ne se distingue pas d'une source en panne.
 *  ⚠️ Les jumelles regroupées ne sont PAS comptées : le décompte affiché en pied a été
 *  retiré le 2026-08-06 (il n'aidait pas à travailler), donc un compteur de doublons ne
 *  serait plus lu par personne. Le regroupement lui-même, lui, reste indispensable. */
type NotifTri = {
  items: Notif[]; sansProprio: number; autres: number;
  /** Écartées par le PÉRIMÈTRE CLIENTÈLE (2026-08-20). Sert l'état vide : « aucun dossier
   *  pro à traiter » et « aucun dossier du tout » demandent deux messages différents, et
   *  le second enverrait chercher une panne là où il n'y a qu'un réglage. */
  horsClientele: number;
  /** Écartées parce que DÉJÀ TRAITÉES (marquées « Vu »). Sert l'état vide : « tout est
   *  traité » et « aucune notification » demandent deux messages différents. */
  lues: number;
};

/** Sélection des lignes affichables, en quatre passes dans cet ordre :
 *    1. propriétaire RENSEIGNÉ (écarte les ~380 lignes orphelines) ;
 *    2. propriétaire = UTILISATEUR CONNECTÉ, si `mesDossiers` (cf. `ownerIsUser`) ;
 *    3. PÉRIMÈTRE CLIENTÈLE (2026-08-20), si autre que « tous » ;
 *    4. une seule ligne par événement, la jumelle « à lire » d'abord.
 *  PURE — l'ordre d'entrée (le plus récent d'abord, tri serveur) est conservé.
 *  ⚠️ La passe 2 est SAUTÉE quand la session n'est pas identifiable (`ident.known`
 *  faux) : sans nom ni e-mail, elle écarterait TOUT et le widget serait vide sans que
 *  personne puisse comprendre pourquoi. Le widget annonce alors que le filtre est
 *  inactif — un filtre silencieusement désactivé serait pire que pas de filtre.
 *  ⚠️ La passe 3 est SAUTÉE de la même façon quand AUCUNE ligne n'est classable : le
 *  champ n'est alors pas exposé par la datasource (à cocher dans l'onglet Sources), et
 *  filtrer viderait la file sans que rien ne l'explique. Elle passe AVANT le regroupement
 *  parce que les deux jumelles d'un événement portent le même dossier, donc le même type
 *  de client : l'ordre n'y change rien, et filtrer d'abord évite de regrouper pour rien. */
function selectNotifs(rows: Notif[], ident: UserIdent, mesDossiers: boolean, nonLuesSeulement: boolean,
                      clientele: Clientele = "tous"): NotifTri {
  const parEvenement = new Map<string, Notif>();
  let sansProprio = 0, autres = 0, horsClientele = 0;
  const filtreActif = mesDossiers && ident.known;
  // Périmètre demandé ET applicable — même arbitrage que `clienteleRows`, ici sur le
  // modèle de vue (`Notif.client`) plutôt que sur la ligne brute.
  const clienteleActive = clientele !== "tous" && rows.some((n) => clientKind(n.client));
  for (const n of rows) {
    if (!n.proprio.trim()) { sansProprio++; continue; }
    if (filtreActif && !ownerIsUser(n.proprio, ident)) { autres++; continue; }
    if (clienteleActive && !clientMatch(clientKind(n.client), clientele)) { horsClientele++; continue; }
    const k = notifKey(n);
    const deja = parEvenement.get(k);
    // Première rencontrée, ou remplacée par sa jumelle encore « à lire » : c'est sur
    // celle-là que « Vu » écrit quelque chose.
    if (!deja || (!deja.nonLu && n.nonLu)) parEvenement.set(k, n);
  }
  const groupees = [...parEvenement.values()];
  /* PASSE 4 — la FILE D'ATTENTE. Ne restent que les notifications pas encore traitées.
     ⚠️ Le filtre est posé APRÈS le regroupement, et l'ordre compte : le regroupement a
     déjà choisi, entre deux jumelles, celle qui est encore « à lire ». Filtrer avant
     aurait donné le même résultat ici, mais l'aurait fait dépendre de l'ordre de lecture
     — un événement dont la jumelle lue arrive en premier serait passé à la trappe.
     ⚠️ RAPPEL de l'inversion de la table : `nonLu` vient de « Statut de lecture »
     COCHÉE. Ce qui reste affiché est donc ce qui est COCHÉ en base, et le geste « Vu »
     DÉCOCHE — voir SELECT_NOTIF_C avant de toucher à cette ligne. */
  const items = nonLuesSeulement ? groupees.filter((n) => n.nonLu) : groupees;
  return { items, sansProprio, autres, horsClientele, lues: groupees.length - items.length };
}

const NOTIF_FIELDS: { key: string; label: string }[] = [
  { key: "texte", label: "Texte de la notification" },
  { key: "statut", label: "Statut du dossier" },
  /* Affichable AUTANT que filtrable (2026-08-20) : un widget réglé sur « tous les clients »
     gagne à montrer le type sur chaque ligne — c'est ce qui permet de trier à l'œil sans
     rien restreindre. Décoché par défaut (cf. NOTIF_SHOW_DEFAULT) : les lignes portent déjà
     un statut, et deux pastilles côte à côte se disputeraient le regard. */
  { key: "client", label: "Type de client (Pro / Solo / Duo)" },
  { key: "partenaire", label: "Installateur" },
  { key: "proprio", label: "Propriétaire (SunLib)" },
  { key: "creeLe", label: "Date de création" },
];
const NOTIF_LIMITS = [5, 10, 20, 50];
/* Palier du bouton « Voir plus » : combien de lignes DE PLUS un clic déroule. Dix, parce
   qu'une dizaine se parcourt d'un coup d'œil sans repousser le bouton hors de portée du
   pouce — et parce que le corps du widget étant scrollable, le geste est « je descends,
   j'en veux encore », pas « je change de page ». Plafonné par `cfg.limite` à l'usage :
   celui qui a réglé 5 lignes en veut 5 de plus, pas 10. */
const NOTIF_PAGE = 10;
/* ⚠️ « offre » (Type d'installation) a disparu avec la refonte : « Notification Center »
   ne porte pas ce champ. Une cfg déjà enregistrée qui le contient perd simplement cette
   clé à la lecture (`coerceNotifsCfg` écarte les clés inconnues) — aucune migration. */
const NOTIF_SHOW_DEFAULT = ["texte", "statut", "partenaire", "creeLe"];

const coerceNotifsCfg = (raw: unknown): NotifsCfg => {
  const o = asObj(raw);
  const known = new Set(NOTIF_FIELDS.map((f) => f.key));
  const champs = Array.isArray(o.champs)
    ? Array.from(new Set(o.champs.filter((x: unknown): x is string => typeof x === "string" && known.has(x))))
    : [...NOTIF_SHOW_DEFAULT];
  const n = Number(o.limite);
  return {
    champs,
    limite: NOTIF_LIMITS.includes(n) ? n : RECENT,
    detail: o.detail !== false,        // présent par défaut : c'est l'action utile
    marquage: o.marquage !== false,    // pastille « Non lu » + bouton « Vu »
    /* ⚠️ ACTIF PAR DÉFAUT (2026-08-06, demandé) : chacun ne voit que les dossiers dont
       il est propriétaire. `!== false` et non `=== true` : une cfg enregistrée AVANT
       cette option n'a pas la clé, et elle doit hériter du nouveau défaut plutôt que de
       rester sur l'ancien comportement — sinon le filtre n'arriverait jamais chez les
       utilisateurs qui ont déjà personnalisé leur accueil. */
    mesDossiers: o.mesDossiers !== false,
    /* À « tous » quand la clé est absente ou illisible (`clienteleOf`) : un périmètre
       hérité par accident cacherait des dossiers à traiter sans que personne l'ait
       demandé — l'inverse exact du défaut retenu pour `mesDossiers`. */
    clientele: clienteleOf(raw),
  };
};

function NotifsOptions({ cfg, onChange }: { cfg: NotifsCfg; onChange: (next: NotifsCfg) => void }) {
  const on = new Set(cfg.champs);
  const toggle = (key: string) => {
    const next = new Set(on);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange({ ...cfg, champs: NOTIF_FIELDS.filter((f) => next.has(f.key)).map((f) => f.key) });
  };
  const lbl: CSSProperties = { display: "block", fontSize: "10.5px", fontWeight: 700, color: T.ink4, textTransform: "uppercase", letterSpacing: ".05em", margin: "10px 0 4px" };
  const line: CSSProperties = { display: "flex", alignItems: "center", gap: "9px", padding: "6px 4px", cursor: "pointer", fontSize: "12.5px", fontWeight: 500, color: T.ink2 };
  const box: CSSProperties = { width: 15, height: 15, accentColor: T.brand, flex: "none", cursor: "pointer" };
  const seg = (active: boolean): CSSProperties => ({ flex: 1, padding: "6px 4px", borderRadius: T.rSm, border: `1px solid ${active ? T.brand : T.line}`, background: active ? T.brand050 : T.surface, color: active ? T.brand700 : T.ink2, fontFamily: "inherit", fontSize: "12px", fontWeight: 700, cursor: "pointer" });
  return (
    <div>
      <span style={{ ...lbl, marginTop: 2 }}>Informations affichées</span>
      {NOTIF_FIELDS.map((f) => (
        <label key={f.key} style={line}>
          <input type="checkbox" style={box} checked={on.has(f.key)} onChange={() => toggle(f.key)} />
          <span>{f.label}</span>
        </label>
      ))}
      <label style={line}>
        <input type="checkbox" style={box} checked={cfg.detail} onChange={(e) => onChange({ ...cfg, detail: e.target.checked })} />
        <span>Bouton « Détail » vers la fiche</span>
      </label>
      {/* Cette case commande DEUX choses, et c'est voulu : l'état « Non lu » + le bouton
          « Vu », et le fait que la liste soit une FILE (seulement ce qui reste à traiter,
          cf. `selectNotifs`). Décochée, le widget redevient un historique complet. */}
      <label style={line}>
        <input type="checkbox" style={box} checked={cfg.marquage} onChange={(e) => onChange({ ...cfg, marquage: e.target.checked })} />
        <span>File à traiter : masquer ce qui est marqué « Vu »</span>
      </label>
      {/* Le filtre par propriétaire est RÉGLABLE, et il doit l'être : le rapprochement
          nom ↔ session est approximatif par nature (cf. `ownerIsUser`), donc il faut
          pouvoir l'ouvrir quand on ne se retrouve pas dedans — un manager qui suit
          plusieurs portefeuilles, ou un propriétaire écrit autrement dans la base. */}
      <label style={line}>
        <input type="checkbox" style={box} checked={cfg.mesDossiers} onChange={(e) => onChange({ ...cfg, mesDossiers: e.target.checked })} />
        <span>Seulement les dossiers dont je suis propriétaire</span>
      </label>
      {/* CLIENTÈLE — un `<select>` et non des cases, comme partout ailleurs : les cinq
          périmètres sont exclusifs. Il se combine avec « mes dossiers » par un ET (« mes
          nouveaux dossiers pro »), et le sous-titre annonce les deux. */}
      <span style={lbl}>Clientèle</span>
      <select value={cfg.clientele} aria-label="Périmètre de clientèle"
        style={{ width: "100%", boxSizing: "border-box", padding: "7px 9px", borderRadius: T.rSm, border: `1px solid ${T.line}`, background: T.surface, color: T.ink, fontFamily: "inherit", fontSize: "12.5px", fontWeight: 500 }}
        onChange={(e) => onChange({ ...cfg, clientele: e.target.value as Clientele })}>
        {CLIENTELES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
      </select>
      <p style={{ margin: "4px 0 0", fontSize: "11.5px", fontWeight: 500, color: T.ink4 }}>
        « Pro » = dossier sans civilité (entreprise, collectivité) ; « Solo » = un titulaire ;
        « Duo » = deux titulaires. « Particuliers » regroupe Solo et Duo.
      </p>
      <span style={lbl}>Nombre de lignes</span>
      <div style={{ display: "flex", gap: "6px" }}>
        {NOTIF_LIMITS.map((n) => (
          <button key={n} style={seg(cfg.limite === n)} onClick={() => onChange({ ...cfg, limite: n })} aria-pressed={cfg.limite === n}>{n}</button>
        ))}
      </div>
    </div>
  );
}

function NotifRow({ n, cfg, onVu, onOpen }: { n: Notif; cfg: NotifsCfg; onVu?: () => void; onOpen?: () => void }) {
  // Teinte de l'instance : elle décide du fond des lignes non vues (voir plus bas).
  const tint = tintOf(useContext(WidgetTintCtx));
  /* Titre : le nom de l'abonné ; à défaut le texte de l'événement, qui le contient
     souvent (« Nouveau abonné créé pour : Prénom Nom »). Les deux peuvent manquer sur
     une ligne mal rattachée — d'où le tiret cadratin plutôt qu'un vide. */
  const title = n.nom || n.texte || DASH;
  const nonLu = n.nonLu;
  const on = (k: string) => cfg.champs.includes(k);
  // Même geste que dans les widgets génériques (`GenericRow`) : la ligne ouvre la fiche.
  const clicProps = onOpen
    ? {
        role: "button" as const, tabIndex: 0,
        "aria-label": `Détail — ${title}`,
        onClick: onOpen,
        onKeyDown: (e: ReactKeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); }
        },
      }
    : {};
  return (
    <div className="slb-row" {...clicProps}
      style={{ display: "flex", alignItems: "center", gap: "11px", padding: "11px 16px",
      cursor: onOpen ? "pointer" : undefined,
      /* Fond très légèrement teinté pour un dossier non vu — la pastille porte le sens,
         ceci n'est qu'un repère de balayage (la couleur ne dit jamais seule, charte).
         ⚠️ 2026-08-18 — IL SUIT LA TEINTE DU WIDGET. C'était `T.brand050` en dur, donc un
         teal pâle qui restait teal quand la carte passait au rosé ou à la lavande : comme
         cette liste ne contient QUE des lignes non vues, c'étaient TOUTES les lignes qui
         ignoraient la couleur choisie. On prend la nuance soutenue de la teinte
         (`tint.pill`, un cran au-dessus du fond de carte `tint.head`), et le teal d'origine
         seulement en l'absence de teinte.
         `backgroundColor` et non `background` : le moteur de survol (§2-bis) mémorise des
         LONGHANDS, et un raccourci lui ferait effacer ce fond en sortant de la ligne. */
      backgroundColor: cfg.marquage && nonLu ? (tint.head ? tint.pill || T.brand050 : T.brand050) : undefined }}>
      <Monogram name={title} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0 }}>
          <span style={{ flex: "0 1 auto", minWidth: 0, fontSize: "13px", fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
          {cfg.marquage && nonLu && <Badge variant="warn" dot>Non lu</Badge>}
        </div>
        {/* Les badges d'abord (ils portent l'état), le texte gris ensuite. Chaque
            information ne s'affiche que si elle est retenue dans la cfg. */}
        {/* Le TEXTE de l'événement, sur deux lignes au plus : c'est lui qui dit ce qui
            vient de se passer (création de dossier ou contrat signé). Il n'est pas
            répété quand il sert déjà de titre, faute de nom d'abonné. */}
        {on("texte") && n.texte && n.texte !== title && (
          <div style={{ ...CLAMP2, marginTop: "3px", fontSize: "12px", fontWeight: 500, color: T.ink2 }}>{n.texte}</div>
        )}
        {/* Statut et type de client sur la MÊME rangée : deux pastilles côte à côte, qui
            passent à la ligne si la carte est étroite (`flexWrap`). La seconde n'apparaît
            que si elle est cochée ET renseignée — un « Type de client » vide sur une ligne
            mal rattachée n'apprendrait rien. */}
        {(on("statut") || (on("client") && !!n.client)) && (
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px", marginTop: "5px" }}>
            {on("statut") && <StatusBadge value={n.statut} />}
            {/* `variantOf` et non une table locale : la couleur du type de client est
                déclarée dans le catalogue (§6-bis), et une seconde table finirait par en
                diverger — un « Duo » ambre ici, bleu dans la fiche de détail. */}
            {on("client") && !!n.client && (
              <Badge variant={variantOf(CATALOG.notifC, "client", n.client)}>{n.client}</Badge>
            )}
          </div>
        )}
        {(on("partenaire") || on("creeLe") || on("proprio")) && (
          <div style={{ marginTop: "5px", fontSize: "11.5px", fontWeight: 500, color: T.ink4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            title={on("creeLe") ? `Créé le ${fmtDate(n.creeLe)}` : undefined}>
            {[on("creeLe") ? fmtRel(n.creeLe) : "",
              on("partenaire") && n.partenaire ? `via ${n.partenaire}` : "",
              on("proprio") && n.proprio ? n.proprio : ""]
              .filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
      {/* « Vu » n'apparaît QUE s'il peut réellement agir : marquage activé, dossier non
          lu, ET une notification appariée avec une écriture possible. Un bouton présent
          mais inopérant vaut moins qu'un bouton absent. */}
      {/* ⚠️ `stopPropagation` : la ligne entière ouvre la fiche, donc marquer « Vu » ne
          doit pas l'ouvrir par-dessus le geste qu'on vient de faire. */}
      {cfg.marquage && nonLu && onVu && (
        <button className="slb-nbtn slb-nbtn-ok" style={NBTN_SM}
          onClick={(e) => { e.stopPropagation(); onVu(); }}
          aria-label={`Marquer comme vu — ${title}`} title="Marquer comme vu">
          <Check aria-hidden style={{ width: 15, height: 15 }} />
        </button>
      )}
      {/* ⚠️ `abonneId` et NON `n.id` : depuis la refonte, `n.id` est l'id de la ligne de
          notification, qui n'ouvrirait aucune fiche. Le bouton disparaît quand le lien
          est absent (ligne orpheline) ou quand ce n'est pas un record id — un « Détail »
          qui mène à une fiche vide vaut moins qu'un « Détail » absent. */}
      {cfg.detail && /^rec[A-Za-z0-9]{14}$/.test(n.abonneId) && (
        /* Lien et NON bouton : c'est une navigation. `target="_top"` parce que le bloc
           vit dans une iframe — sans lui, la fiche s'ouvrirait DANS le widget. */
        <a href={pageUrl(PAGES.abonne, { [PAGE_RECORD_PARAM]: n.abonneId })} target="_top"
          onClick={(e) => e.stopPropagation()}
          className="slb-btng" aria-label={`Fiche complète — ${title}`} title="Ouvrir la fiche abonné"
          style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 10px", borderRadius: T.rSm, border: `1px solid ${T.line}`, background: T.surface, color: T.ink2, fontSize: "12px", fontWeight: 600, textDecoration: "none" }}>
          Détail<ChevronRight aria-hidden style={{ width: 13, height: 13 }} />
        </a>
      )}
    </div>
  );
}

function NotifWidget({ tri, cfg, notifs, ident, clientLu, onVoirTout, onTousClients }: {
  tri: NotifTri; cfg: NotifsCfg; notifs: SourceApi; ident: UserIdent;
  /** Le champ « type de client » est-il LU par la datasource ? Faux ⇒ le réglage
   *  « Clientèle » est inopérant, et le widget doit le DIRE plutôt que de laisser croire
   *  qu'il filtre (cf. `clientLisible`, et le champ à cocher dans l'onglet Sources). */
  clientLu: boolean;
  /** Bascule « voir toutes les notifications » proposée dans l'état vide. Absente si
   *  le widget ne peut pas écrire sa propre cfg. */
  onVoirTout?: () => void;
  /** Même canal, pour ROUVRIR la clientèle quand c'est elle qui a tout écarté : sinon il
   *  faudrait retrouver le réglage dans le ⋮ pour comprendre un widget vide. */
  onTousClients?: () => void;
}) {
  /* Marquer comme vu = ÉCRIRE false sur « Statut de lecture ». Oui, false : dans cette
     table la case cochée signifie « à lire » (voir SELECT_NOTIF_C). C'est le seul
     endroit du fichier où cette inversion se traduit en écriture.

     DISPARITION IMMÉDIATE (2026-08-06). La ligne quitte la liste dès le clic, sans
     attendre que la source soit relue : `vus` masque localement ce qui vient d'être
     traité.
     ⚠️ CE N'EST PAS le masquage local retiré le 2026-08-03. Celui-là n'écrivait RIEN et
     la ligne revenait au rechargement — il faisait croire à un travail fait. Ici
     l'écriture est réelle ; le masquage ne fait qu'anticiper le rafraîchissement, et il
     est ANNULÉ si l'écriture échoue, avec un message. Ne jamais retirer ce rollback :
     sans lui, un échec réseau ferait disparaître une notification jamais traitée. */
  const [vus, setVus] = useState<string[]>([]);
  const [echec, setEchec] = useState<string | null>(null);
  const marquerVu = async (notifId: string) => {
    if (!notifs.write) return;
    setVus((v) => [...v, notifId]);
    setEchec(null);
    try {
      await notifs.write.update(notifId, { aLire: false });
    } catch {
      setVus((v) => v.filter((x) => x !== notifId));
      setEchec("Cette notification n'a pas pu être marquée comme vue. Réessayez.");
    }
  };
  /* « Voir plus » — DÉROULEMENT EN PLACE, pas une pagination. Chaque clic ajoute un
     palier de lignes SOUS les précédentes, dans le même corps scrollable : on ne remplace
     jamais ce qui est déjà affiché, et il n'y a pas de « page 2 » où l'on pourrait se
     perdre. État LOCAL et non `cfg` : c'est de l'affichage éphémère, ça n'a rien à faire
     dans les préférences enregistrées de l'utilisateur.
     ⚠️ Rien n'est « téléchargé » au clic, et c'est voulu : la source est déjà drainée en
     entier (cf. le plafond de pages, §6) et `selectNotifs` a déjà trié TOUTES les lignes.
     Le bouton ne fait donc que lever la troncature d'affichage — donc aucune attente, et
     aucun risque de doublon ou de trou entre deux paliers, ce qu'une vraie pagination
     serveur aurait apporté avec elle. */
  const [enPlus, setEnPlus] = useState(0);
  // Palier : dix, ou le réglage « Nombre de lignes » s'il est plus court (cf. NOTIF_PAGE).
  const palier = Math.min(cfg.limite, NOTIF_PAGE);
  // `vus` retire les lignes traitées à l'instant, avant que la source ne soit relue.
  const restantes = tri.items.filter((n) => !vus.includes(n.id));
  const items = restantes.slice(0, cfg.limite + enPlus);
  const reste = restantes.length - items.length;
  // Ce que le PROCHAIN clic apportera : le palier, ou tout ce qu'il reste s'il en reste moins.
  const aVenir = Math.min(reste, palier);
  /* Le filtre est-il RÉELLEMENT appliqué ? Demandé (`cfg`) ne suffit pas : sans session
     identifiable il est sauté (cf. `selectNotifs`), et le sous-titre ne doit pas
     annoncer « mes dossiers » quand ce sont ceux de tout le monde. */
  const filtreActif = cfg.mesDossiers && ident.known;
  /* Le périmètre clientèle, lui, est actif s'il est demandé ET si la source lit le champ —
     même règle que `mesDossiers` face à une session anonyme. */
  const clienteleActive = cfg.clientele !== "tous" && clientLu;
  const nom = ident.name.length ? asText(ident.name.join(" ")) : ident.mail.join(" ");
  /* Fiche détaillée de la notification cliquée. Le descripteur `notifC` porte les 9
     alias lus, donc la fiche se construit toute seule (`RecordDialog`) — pas de fiche
     sur-mesure à maintenir ici. */
  const [fiche, setFiche] = useState<Notif | null>(null);
  return (
    <>
    {/* Sous-titre : la liste ne contient QUE des notifications à traiter (cf. `cfg.marquage`
        et `selectNotifs`), donc « N non lus sur M » n'aurait plus de sens — tout est non lu.
        On annonce ce qui reste à faire, et sur quel périmètre.
        ⚠️ « Chargement… » EN PREMIER, comme sur le journal des tâches : le corps montre un
        squelette pendant la lecture (correctif du 2026-08-19), mais le sous-titre continuait
        d'annoncer « Rien à traiter » juste au-dessus — soit la réponse fausse et rassurante
        que ce correctif visait, laissée à l'endroit le plus lisible de la carte. Complété le
        2026-08-20. */}
    <Widget icon={Bell} title="Nouveaux dossiers abonnés"
      sub={notifs.loading ? "Chargement…"
        : !restantes.length ? (filtreActif ? "Rien à votre nom" : "Rien à traiter")
        : `${restantes.length} à traiter${filtreActif ? " · mes dossiers" : ""}${clienteleActive ? ` · ${clienteleCourt(cfg.clientele)}` : ""}`}>
      {/* ⚠️ FILTRE DEMANDÉ MAIS INAPPLICABLE : on le DIT, au lieu de servir en silence
          la liste de tout le monde sous un titre qui laisserait croire le contraire. */}
      {cfg.mesDossiers && !ident.known && (
        <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "10px 16px", borderBottom: `1px solid ${T.line}` }}>
          <Badge variant="warn" dot>Filtre inactif</Badge>
          <span style={{ fontSize: "11.5px", fontWeight: 500, color: T.ink3 }}>
            Session non identifiée : toutes les notifications sont affichées.
          </span>
        </div>
      )}
      {/* ⚠️ MÊME BANDEAU pour la clientèle demandée mais NON LUE : le champ « Champs IA
          Config client (from Liens BDD) » n'est pas coché dans la connexion de la
          datasource `notifC` (onglet Sources du bloc). Sans ce message, le réglage
          paraîtrait ne rien faire et on chercherait le défaut dans le code.
          ⚠️⚠️ `!notifs.loading && !notifs.error` EST INDISPENSABLE, et ce n'est pas une
          précaution de principe : `clientLu` se déduit des LIGNES LUES, donc il est faux
          tant qu'il n'y en a aucune. Sans ces deux gardes, le bandeau s'affichait à CHAQUE
          chargement de la page chez quiconque a réglé une clientèle — un avertissement
          faux, et le plus visible de tous puisqu'il occupe le haut de la carte. Même
          raison de l'exclure en erreur : la source n'a pas répondu, on ne sait rien du
          champ. Ne pas retirer ces gardes en croyant simplifier la condition. */}
      {cfg.clientele !== "tous" && !clientLu && !notifs.loading && !notifs.error && (
        <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "10px 16px", borderBottom: `1px solid ${T.line}` }}>
          <Badge variant="warn" dot>Filtre inactif</Badge>
          <span style={{ fontSize: "11.5px", fontWeight: 500, color: T.ink3 }}>
            Type de client non lu par la source : toutes les notifications sont affichées.
          </span>
        </div>
      )}
      {/* Un échec d'écriture se DIT. La ligne est déjà revenue dans la liste (rollback de
          `marquerVu`) : sans ce message, elle réapparaîtrait sans explication et on
          croirait à un bug d'affichage. */}
      {echec && (
        <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "10px 16px", borderBottom: `1px solid ${T.line}` }}>
          <Badge variant="danger" dot>Échec</Badge>
          <span style={{ fontSize: "11.5px", fontWeight: 500, color: T.ink3 }}>{echec}</span>
        </div>
      )}
      {/* ⚠️ LE CHARGEMENT PASSE AVANT LES ÉTATS VIDES (2026-08-19). Cette table est drainée
          (2 142 lignes) : pendant plusieurs secondes, `items` est vide sans que cela veuille
          dire quoi que ce soit, et le widget annonçait pourtant « Tout est traité » — la
          plus trompeuse des trois réponses possibles, puisqu'elle est rassurante. */}
      {notifs.loading ? (
        <ListSkeleton rows={4} />
      ) : items.length === 0 ? (
        /* TROIS états vides distincts, parce qu'ils demandent trois gestes différents :
           « tout est traité » (bonne nouvelle — la file est vide, rien à faire),
           « rien à mon nom » (le filtre propriétaire a tout écarté → proposer de
           l'ouvrir), « rien du tout » (la table n'a rien à montrer). Le deuxième NOMME
           l'identité cherchée : c'est la seule façon de comprendre un rapprochement qui a
           échoué parce que la base écrit le propriétaire autrement. */
        /* QUATRIÈME état vide (2026-08-20), placé EN PREMIER : c'est le périmètre clientèle
           qui a tout écarté. Il passe avant « tout est traité » parce que c'est le réglage
           qu'on vient de poser, et parce que le message inverse — « tout est traité » sous
           un widget réglé sur « Pro » — ferait croire la file vide alors qu'elle contient
           des particuliers. Comme pour « mes dossiers », on propose de ROUVRIR. */
        clienteleActive && tri.horsClientele > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "26px 16px 30px", textAlign: "center" }}>
            <EmptyState dense icon={Inbox} title={`Aucun dossier « ${CLIENTELES.find((c) => c.key === cfg.clientele)?.label ?? ""} » à traiter`}
              hint={`${tri.horsClientele} notification${tri.horsClientele > 1 ? "s" : ""} écartée${tri.horsClientele > 1 ? "s" : ""} par le périmètre de clientèle.`} />
            {onTousClients && (
              <button className="slb-btng" onClick={onTousClients}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: T.rSm, border: `1px solid ${T.line}`, background: T.surface, color: T.ink2, fontFamily: "inherit", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" }}>
                <Eye aria-hidden style={{ width: 14, height: 14 }} />Voir toutes les clientèles
              </button>
            )}
          </div>
        ) : tri.lues > 0 ? (
          <EmptyState dense icon={CheckCircle} title="Tout est traité"
            hint={`${tri.lues} notification${tri.lues > 1 ? "s" : ""} déjà vue${tri.lues > 1 ? "s" : ""}. Les nouveaux dossiers apparaîtront ici.`} />
        ) : filtreActif ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "26px 16px 30px", textAlign: "center" }}>
            <EmptyState dense icon={Inbox} title="Aucune notification à votre nom"
              hint={`Recherché : « ${nom} » parmi ${tri.autres + tri.sansProprio + tri.items.length} notifications. Si la base écrit votre nom autrement, ouvrez la liste.`} />
            {onVoirTout && (
              <button className="slb-btng" onClick={onVoirTout}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: T.rSm, border: `1px solid ${T.line}`, background: T.surface, color: T.ink2, fontFamily: "inherit", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" }}>
                <Eye aria-hidden style={{ width: 14, height: 14 }} />Voir toutes les notifications
              </button>
            )}
          </div>
        ) : (
          <EmptyState dense icon={Inbox} title="Aucune notification récente" hint="Les dossiers abonnés créés par vos partenaires apparaîtront ici." />
        )
      ) : (
        <ScrollBody>
          {items.map((n) => (
            <NotifRow key={n.id} n={n} cfg={cfg} onOpen={() => setFiche(n)}
              onVu={notifs.write ? () => void marquerVu(n.id) : undefined} />
          ))}
          {/* À LA PLACE de l'ancien pied de widget (2026-08-06). Deux choses ont été
              retirées d'ici, et volontairement :
              · le décompte des lignes écartées (« N sans propriétaire · N doublons ») —
                l'information n'aide pas à travailler, la liste juste suffit ;
              · l'avertissement « Lecture incomplète » sur `notifs.partial`. Sans risque
                aujourd'hui : le plafond de drainage (`COM_MAX_PAGES`, ≈ 4 000 lignes)
                est très au-dessus des 2 154 lignes de la table, donc `partial` ne peut
                pas se produire. ⚠️ Si la table franchissait ce plafond, la liste
                deviendrait silencieusement partielle : c'est `COM_MAX_PAGES` qu'il
                faudrait relever, pas cet avertissement qu'il faudrait remettre.
              Reste UN seul élément de pied : le déroulement de la suite. */}
          {/* Le libellé DIT COMBIEN arrive au prochain clic, et combien il reste derrière.
              « Lire plus » ne disait ni l'un ni l'autre : on ne savait pas si l'on
              s'engageait dans trois lignes ou dans trois cents. Quand le reste tient dans
              un palier, le bouton l'annonce comme le DERNIER — c'est ce qui permet de
              savoir qu'on a fait le tour de sa file. */}
          {reste > 0 && (
            <button className="slb-row" onClick={() => setEnPlus((n) => n + palier)}
              aria-label={`Afficher ${aVenir} notification${aVenir > 1 ? "s" : ""} de plus (${reste} restante${reste > 1 ? "s" : ""})`}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", width: "100%", padding: "11px 16px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "12.5px", fontWeight: 700, color: T.brand700 }}>
              <ChevronDown aria-hidden style={{ width: 15, height: 15 }} strokeWidth={2} />
              {aVenir === reste
                ? `Voir ${reste === 1 ? "la dernière" : `les ${reste} dernières`}`
                : `Voir ${aVenir} de plus`}
              {aVenir !== reste && (
                <span style={{ fontWeight: 500, color: T.ink4 }}>· {reste} restantes</span>
              )}
            </button>
          )}
        </ScrollBody>
      )}
    </Widget>
    {/* Frère du widget, jamais dans son corps — même raison que pour les widgets
        génériques : `position: fixed` s'accrocherait à un ancêtre transformé par le
        FLIP. Voir `DataView`.
        ⚠️ `ficheHref` est passé explicitement : le record id d'une ligne de
        « Notification Center » n'est PAS celui de l'abonné — le lien se construit depuis
        `abonneId`, et seulement s'il a bien la forme d'un record id. */}
    {fiche && (
      <RecordDialog row={fiche.raw} desc={CATALOG.notifC} map={CATALOG.notifC.defaultMap ?? {}}
        ficheHref={/^rec[A-Za-z0-9]{14}$/.test(fiche.abonneId)
          ? pageUrl(PAGES.abonne, { [PAGE_RECORD_PARAM]: fiche.abonneId })
          : ""}
        onClose={() => setFiche(null)} />
    )}
    </>
  );
}

/* --- Widget « Journal des tâches » (colonne droite), onglets internes --- */
/* Une tâche du journal. `onFait` absent = pas de geste possible (source non écrivable,
   ou session absente) : le bouton disparaît alors plutôt que de rester inopérant —
   même règle que le « Vu » des notifications (§9). */
function TaskRow({ t, onFait }: { t: Task; onFait?: () => void }) {
  return (
    <div className="slb-row" style={{ display: "flex", alignItems: "center", gap: "11px", padding: "10px 16px", flexWrap: "wrap" }}>
      <span style={{ ...LIST_ICO, width: 28, height: 28, borderRadius: "8px" }}>
        <CalendarClock aria-hidden style={{ width: 14, height: 14 }} strokeWidth={1.7} />
      </span>
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: T.ink, wordBreak: "break-word" }}>{t.desc}</div>
        <div style={{ ...LIST_K, fontSize: "10.5px", marginTop: "3px" }}>{t.associe}</div>
      </div>
      <span title={fmtDate(t.fin)} style={{ flex: "none" }}>
        <Badge variant={dueVariant(t.fin)} icon={Clock}>{fmtDue(t.fin)}</Badge>
      </span>
      {/* MARQUER FAIT — c'est le geste qui manquait : le journal listait ce qu'il y a
          à faire sans permettre de le clore, donc il fallait rouvrir /taches pour
          cocher une case. L'écriture est bornée par `SELECT_TACHE_*_W` (le seul champ
          écrivable est « Fait »). */}
      {onFait && (
        <button className="slb-nbtn slb-nbtn-ok" style={{ ...NBTN_SM, flex: "none" }}
          onClick={onFait} aria-label={`Marquer comme faite — ${t.desc}`} title="Marquer comme faite">
          <Check aria-hidden style={{ width: 15, height: 15 }} />
        </button>
      )}
    </div>
  );
}

/* ⚠️ `totalProspects` / `totalPartenaires` sont SÉPARÉS des listes, et ce n'est pas une
   redondance : les listes sont tronquées aux `RECENT` échéances les plus proches, alors
   que les pastilles des onglets annoncent un NOMBRE DE TÂCHES OUVERTES. Jusqu'au
   2026-08-05 elles comptaient `prospects.length`, donc au plus RECENT — un onglet
   affichait « 12 » là où la table en portait quarante. Une pastille compteur est lue
   comme un total ; elle doit en être un. */
function TasksWidget({ prospects, partenaires, totalProspects, totalPartenaires, partial,
  onFait, faisable, mineAsked, identifiee, loading }: {
  prospects: Task[]; partenaires: Task[];
  totalProspects: number; totalPartenaires: number; partial?: boolean;
  /** Une des deux sources lit encore. ⚠️ SANS CETTE PROP, le widget affichait « Aucune
   *  tâche prospect en cours » pendant tout le chargement (les deux tables sont DRAINÉES,
   *  donc plusieurs secondes) : un état vide affirmatif, montré à la place d'un état
   *  d'attente, se lit comme une réponse — et comme une réponse fausse. C'est exactement
   *  ce que l'indicateur de chargement doit empêcher. */
  loading?: boolean;
  /** Clôt une tâche. `onFait` reçoit l'onglet courant : les deux tables sont
   *  différentes, donc l'écriture ne part pas au même endroit. */
  onFait?: (scope: "prospects" | "partenaires", id: string) => Promise<boolean>;
  /** L'écriture est-elle possible, ONGLET PAR ONGLET (source connectée, session
   *  présente) ? Le bouton « Fait » n'apparaît que là où il peut vraiment agir. */
  faisable?: { prospects: boolean; partenaires: boolean };
  /** Le filtre « mes tâches » est-il demandé, et la session est-elle identifiable ?
   *  Les deux servent au bandeau : un filtre inapplicable doit se DIRE (cf. §9). */
  mineAsked: boolean;
  identifiee: boolean;
}) {
  const [tab, setTab] = useState("prospects");
  /* Disparition IMMÉDIATE de la ligne cochée, avant que la source ne soit relue, et
     ROLLBACK annoncé si l'écriture échoue. Copié sur le « Vu » des notifications, pour
     la même raison : une tâche qui disparaît sans écriture réelle ferait croire à un
     travail fait. Ne jamais retirer le rollback. */
  const [faites, setFaites] = useState<string[]>([]);
  const [echec, setEchec] = useState<string | null>(null);
  const clore = async (scope: "prospects" | "partenaires", id: string) => {
    if (!onFait) return;
    setFaites((v) => [...v, id]);
    setEchec(null);
    if (!(await onFait(scope, id))) {
      setFaites((v) => v.filter((x) => x !== id));
      setEchec("Cette tâche n'a pas pu être marquée comme faite. Réessayez.");
    }
  };
  const scope: "prospects" | "partenaires" = tab === "prospects" ? "prospects" : "partenaires";
  const peutClore = !!onFait && (faisable ? faisable[scope] : false);
  const vivantes = (list: Task[]) => list.filter((t) => !faites.includes(t.id));
  const rows = vivantes(tab === "prospects" ? prospects : partenaires);
  /* Les pastilles suivent la même soustraction que la liste : un compteur ne doit pas
     continuer d'annoncer une tâche qu'on vient de clore sous ses yeux.
     ⚠️ On retire les lignes closes du TOTAL, pas de la liste affichée seulement : le total
     vient du drainage complet (cf. `TachesCard`), la liste n'en montre que les RECENT
     premières — les deux doivent baisser ensemble. */
  const clos = (list: Task[]) => list.filter((t) => faites.includes(t.id)).length;
  const tabs: Tab[] = [
    { id: "prospects", label: "Prospects", icon: ClipboardList, count: totalProspects - clos(prospects) },
    { id: "partenaires", label: "Partenaires", icon: Building2, count: totalPartenaires - clos(partenaires) },
  ];
  const total = tab === "prospects" ? totalProspects - clos(prospects) : totalPartenaires - clos(partenaires);
  return (
    /* ⚠️ PAS DE BOUTON « + » DANS L'EN-TÊTE (retiré le 2026-08-18, demandé). C'était un
       `headActions` porteur d'un TODO : un bouton « Nouvelle tâche » qui n'ouvrait rien et
       n'écrivait rien. Un geste inerte dans un en-tête coûte plus qu'il n'annonce — on le
       clique, il ne se passe rien, et le widget passe pour cassé.
       Le jour où la création de tâche est branchée, le chemin existe déjà et il est
       générique : `create` sur le descripteur de source (§6-bis) fait apparaître le `+` de
       `QuickCreate` tout seul, avec son formulaire — voir « Dossiers SAV ». Ne pas recoller
       un bouton en dur ici. */
    <Widget icon={CalendarClock} title="Journal des tâches"
      sub={loading ? "Chargement…"
        : mineAsked && identifiee ? "Mes tâches · prospects & partenaires" : "Prospects & partenaires"}>
      {/* ⚠️ FILTRE DEMANDÉ MAIS INAPPLICABLE : on le dit, au lieu de servir en silence
          les tâches de toute l'équipe sous un titre qui annonce les siennes. */}
      {mineAsked && !identifiee && (
        <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "10px 16px", borderBottom: `1px solid ${T.line}` }}>
          <Badge variant="warn" dot>Filtre inactif</Badge>
          <span style={{ fontSize: "11.5px", fontWeight: 500, color: T.ink3 }}>
            Session non identifiée : toutes les tâches sont affichées.
          </span>
        </div>
      )}
      {echec && (
        <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "10px 16px", borderBottom: `1px solid ${T.line}` }}>
          <Badge variant="danger" dot>Échec</Badge>
          <span style={{ fontSize: "11.5px", fontWeight: 500, color: T.ink3 }}>{echec}</span>
        </div>
      )}
      <div style={{ padding: "2px 16px 0" }}>
        <TabBar dense tabs={tabs} activeTab={tab} onSelect={setTab} />
      </div>
      <div key={tab} role="tabpanel" style={{ animation: "slb-panel-fwd .3s cubic-bezier(.22,.61,.36,1) both" }}>
        {/* Le squelette PASSE DEVANT l'état vide, jamais l'inverse : tant qu'une des deux
            sources lit, on ne sait pas encore s'il y a des tâches. */}
        {loading ? (
          <ListSkeleton rows={4} />
        ) : rows.length === 0 ? (
          <EmptyState dense icon={Inbox}
            title={tab === "prospects" ? "Aucune tâche prospect en cours" : "Aucune tâche partenaire en cours"}
            hint={tab === "prospects" ? "Les tâches liées à vos prospects apparaîtront ici." : "Les tâches liées à vos partenaires apparaîtront ici."} />
        ) : (
          <ScrollBody>
            {rows.map((t) => (
              <TaskRow key={t.id} t={t}
                onFait={peutClore ? () => void clore(scope, t.id) : undefined} />
            ))}
            {/* La liste est tronquée mais la pastille dit le total : sans cette ligne,
                l'écart entre les deux se lirait comme une incohérence. On nomme ce qui
                est montré ET sur quel critère — le tri par échéance garde les plus
                urgentes, ce qui rend la troncature acceptable. */}
            {total > rows.length && (
              <div style={{ padding: "9px 16px 12px", fontSize: "11.5px", fontWeight: 500, color: T.ink4 }}>
                {rows.length} des {total} tâches ouvertes — les échéances les plus proches.
                {partial && " La table dépasse ce que ce widget lit d'un coup : le total lui-même est un minimum."}
              </div>
            )}
          </ScrollBody>
        )}
      </div>
    </Widget>
  );
}

/* NB : les widgets « Dernières notes » n'ont plus de présentiel dédié — leur ligne
   (pastille d'initiales + titre + date + détail clampé) est devenue le gabarit du
   présentiel GÉNÉRIQUE `GenericRow` (§9-bis), partagé par tous les widgets liste. */

/* ============================================================================
   9-bis. LE WIDGET GÉNÉRIQUE « data » — une grammaire, trois vues
   ----------------------------------------------------------------------------
   UN SEUL type de widget sait afficher n'importe quelle source du catalogue
   (§6-bis), sous trois formes : liste, tableau, indicateur. Ce qui change d'un
   widget à l'autre n'est pas du code mais sa `cfg`, stockée dans le layout :

     cfg = { source, query: { filter[], sort, limit }, view: { kind, … },
             actions: { use[] }, create, title, unit }

   Pourquoi UN type et non trois : la clé de type est un CONTRAT DE PERSISTANCE
   (jamais renommée), alors que la vue doit rester librement modifiable. En
   mettant la vue dans la cfg, un widget passe de liste à tableau à KPI depuis le
   panneau Options — sans changer de type, donc sans migration.

   COMPATIBILITÉ : les clés `list` et `kpi` ont été livrées avec des cfg PLATES
   (map/filter unique/limit, dateField/compareDays). `coerceCfg` les traduit vers
   cette grammaire à la lecture (§ `fromLegacyCfg`) : aucune instance déjà posée
   ne part dans `parked`, et le document n'est réécrit qu'au prochain
   « Enregistrer ». Les deux clés restent donc valides, mais dépréciées.
   ============================================================================ */

type FilterOp = "eq" | "neq" | "contains" | "gt" | "lt" | "lastDays" | "isEmpty" | "notEmpty";

const FILTER_OPS: { op: FilterOp; label: string; needsValue: boolean; numeric?: boolean }[] = [
  { op: "eq", label: "est", needsValue: true },
  { op: "neq", label: "n'est pas", needsValue: true },
  { op: "contains", label: "contient", needsValue: true },
  { op: "gt", label: "supérieur à", needsValue: true, numeric: true },
  { op: "lt", label: "inférieur à", needsValue: true, numeric: true },
  { op: "lastDays", label: "dans les N derniers jours", needsValue: true, numeric: true },
  { op: "isEmpty", label: "est vide", needsValue: false },
  { op: "notEmpty", label: "n'est pas vide", needsValue: false },
];

type Filter = { field: string; op: FilterOp; value?: string };

/* Les trois vues. `list` et `table` affichent des lignes, `kpi` agrège. */
type ViewCfg =
  | { kind: "list"; map: FieldRoleMap }
  | { kind: "table"; columns: string[] }                     // alias de champs, dans l'ordre
  | { kind: "kpi"; agg: "count" | "sum" | "avg"; field?: string;
      dateField?: string; compareDays?: number };

type InstanceCfg = {
  title: string;                                  // vide → libellé du descripteur
  unit: string;                                   // « note » → sous-titre « 7 notes »
  source: SourceKey;
  query: { filter: Filter[]; sort: { by: string; dir: "asc" | "desc" }; limit: number };
  view: ViewCfg;
  actions?: { use: string[] };                    // ids d'actions du descripteur, activées ici
  create?: boolean;                               // bouton « + » (formulaire du descripteur)
  /* --- BARRE D'OUTILS de consultation (2026-08-06) ------------------------------
     `search` : champ de recherche plein-texte au-dessus de la liste.
     `facets` : ALIAS des champs dont les valeurs deviennent un filtre à cases, en
                multi-sélection (les installateurs, par exemple). Liste VIDE = pas de filtre.
                Jusqu'à `FACETS_MAX` — trois, comme la page Softr des contacts (entreprise,
                service, type de contact) ; au-delà, la barre passe à la ligne et ne se lit
                plus. La clé `facet` (singulier, string) des documents d'avant le 2026-08-19
                est toujours LUE par `coerceCfg`.
     ⚠️ Ce que l'utilisateur TAPE ou COCHE n'est PAS stocké ici : ces deux clés disent
     seulement si l'outil est OFFERT. Le terme et les cases vivent en état local
     (`LocalRefine`) — une recherche enregistrée se rappellerait au chargement suivant
     et donnerait un widget qui paraît vide sans raison visible. */
  search?: boolean;
  facets?: string[];
  /* « Seulement les fiches dont je suis propriétaire » (2026-08-07). N'a de sens que si
     le descripteur de la source déclare un `ownerField` ; ailleurs la clé est absente.
     ACTIF par défaut là où il existe : une liste de suivi client sert d'abord à voir SON
     portefeuille, et un filtre qu'il faut penser à activer ne l'est jamais.
     ⚠️ Réglable, et il doit l'être : le rapprochement nom ↔ session est approximatif par
     nature (cf. `ownerIsUser`) — un manager qui suit plusieurs portefeuilles, ou un nom
     écrit autrement en base, doit pouvoir ouvrir la liste. */
  mine?: boolean;
  /* PÉRIMÈTRE CLIENTÈLE (2026-08-18, porté à cinq états le 2026-08-20) : tous · Pro ·
     Particuliers (Solo + Duo) · Solo · Duo. N'a de sens que si le descripteur de la
     source déclare un `clientField` ; ailleurs la clé est absente.
     À "tous" par défaut, contrairement à `mine` : un accueil montre d'abord TOUT le
     périmètre, et restreindre la clientèle répond à une question ponctuelle (« combien
     de particuliers attendent leur solvabilité ? ») plutôt qu'à un besoin permanent. */
  clientele?: Clientele;
};

/* CINQ états depuis le 2026-08-20 (demandé). La base ne connaît que trois valeurs — « Pro »,
   « Solo », « Duo » (formule `Champs IA Config client`, relevée sur Airtable : civilité vide
   → Pro · Monsieur/Madame → Solo · sinon → Duo) — mais on en tire cinq PÉRIMÈTRES, parce que
   « particulier » est une lecture et non une valeur :
     · `particulier` = Solo ∪ Duo — la question la plus courante (« combien de particuliers
       attendent leur solvabilité ? ») et celle qui existait seule avant ce jour ;
     · `solo` et `duo` — le détail du foyer, demandé pour distinguer un dossier à une seule
       signature d'un dossier à deux (le circuit de signature et les relances diffèrent).
   `court` est le mot du SOUS-TITRE (« 12 dossiers · particuliers ») : il vit ici et non dans
   une condition au fil du code, sans quoi chaque widget écrirait le sien. */
type Clientele = "tous" | "pro" | "particulier" | "solo" | "duo";
const CLIENTELES: { key: Clientele; label: string; court: string }[] = [
  { key: "tous", label: "Tous les clients", court: "" },
  { key: "pro", label: "Professionnels seulement (Pro)", court: "pros" },
  { key: "particulier", label: "Particuliers seulement (Solo + Duo)", court: "particuliers" },
  { key: "solo", label: "Particuliers — Solo seulement", court: "solo" },
  { key: "duo", label: "Particuliers — Duo seulement", court: "duo" },
];
/** Le mot à écrire dans un sous-titre pour annoncer le périmètre, "" si aucun. PURE. */
const clienteleCourt = (c: Clientele | undefined): string =>
  CLIENTELES.find((x) => x.key === c)?.court ?? "";

/** Le périmètre clientèle d'une cfg BRUTE, quel que soit le type de widget qui la porte
 *  (widget `data`, file d'attente, widgets commerciaux, notifications). Validé contre
 *  `CLIENTELES` : une valeur inconnue — cfg d'une version future, ou clé absente d'une cfg
 *  enregistrée avant ce réglage — retombe sur « tous », jamais sur une restriction. Un
 *  périmètre hérité par accident cacherait des dossiers sans que personne l'ait demandé.
 *  PURE. Un seul lecteur pour tous les types : sinon chacun aurait son défaut. */
const clienteleOf = (raw: unknown): Clientele => {
  const c = asText(asObj(raw).clientele);
  return CLIENTELES.some((x) => x.key === c) ? (c as Clientele) : "tous";
};

const LIST_LIMIT_MAX = 50;
const KPI_DAYS_MAX = 365;
const TABLE_COLS_MAX = 6;
/* Trois filtres à cases au maximum. Ce n'est pas une limite technique mais de LECTURE : la
   barre d'outils tient la recherche, les filtres et le tri sur une ligne de carte en
   demi-largeur ; au quatrième bouton elle passe à la ligne et le widget perd 30 px de corps. */
const FACETS_MAX = 3;

/* ---------------------------------------------------------------------------
   Coercition : cfg stockée (BRUTE, éventuellement d'une version antérieure)
   → cfg utilisable. Ne throw JAMAIS, valide tout contre le catalogue.
   --------------------------------------------------------------------------- */

const asObj = (x: unknown): Record<string, any> => (x && typeof x === "object" ? (x as any) : {});

/** Une cfg de la rév. 1 (type `list` ou `kpi`) : plate, sans `query` ni `view`. */
const isLegacyCfg = (o: Record<string, any>): boolean =>
  !o.query && !o.view && ("map" in o || "limit" in o || "compareDays" in o || "dateField" in o || "unit" in o);

/** Traduit une cfg plate rév. 1 vers la grammaire. PURE. */
function fromLegacyCfg(o: Record<string, any>): Record<string, any> {
  const isKpi = "compareDays" in o || "dateField" in o;
  return {
    title: o.title,
    unit: o.unit,
    source: o.source,
    query: {
      filter: o.filter ? [o.filter] : [],          // le filtre UNIQUE devient une liste
      sort: o.sort,
      limit: o.limit,
    },
    view: isKpi
      ? { kind: "kpi", agg: "count", dateField: o.dateField, compareDays: o.compareDays }
      : { kind: "list", map: o.map ?? {} },
  };
}

function coerceCfg(raw: unknown, base: InstanceCfg): InstanceCfg {
  const input = asObj(raw);
  const o = isLegacyCfg(input) ? fromLegacyCfg(input) : input;

  const source: SourceKey = o.source in CATALOG ? o.source : base.source;
  const desc = CATALOG[source];
  const changedSource = source !== base.source;
  const known = (alias: unknown): string | undefined =>
    typeof alias === "string" && alias in desc.fields ? alias : undefined;
  const kindOf = (alias: string | undefined): FieldKind | undefined =>
    alias ? desc.fields[alias]?.kind : undefined;

  /* --- query.filter : liste, combinée en ET. Un filtre invalide est écarté (pas
     de repli : mieux vaut un filtre en moins qu'un filtre faux). --- */
  const rawFilters: unknown[] = Array.isArray(o.query?.filter) ? o.query.filter
    : o.query?.filter ? [o.query.filter] : [];
  const filter: Filter[] = [];
  for (const rf of rawFilters) {
    const f = asObj(rf);
    const field = known(f.field);
    const op = FILTER_OPS.find((x) => x.op === f.op)?.op;
    if (field && op) filter.push({ field, op, value: asText(f.value) });
  }

  /* --- query.sort : voir le commentaire de `defaultSort` (§6-bis). --- */
  const dflt = desc.defaultSort;
  const baseSort = base.query.sort;
  const explicitBy = known(o.query?.sort?.by);
  const dirRaw = o.query?.sort?.dir === "asc" || o.query?.sort?.dir === "desc" ? o.query.sort.dir : undefined;
  const sortBy = explicitBy || (changedSource ? known(dflt.by) : known(baseSort.by) || known(dflt.by)) || "";
  const sortDir: "asc" | "desc" = explicitBy
    ? dirRaw ?? (changedSource ? dflt.dir : baseSort.dir)
    : changedSource ? dflt.dir : dirRaw ?? baseSort.dir;

  const limit = Math.max(1, Math.min(LIST_LIMIT_MAX,
    Number(o.query?.limit) > 0 ? Math.floor(Number(o.query.limit)) : base.query.limit));

  /* --- view : la forme dépend du `kind`, chaque partie validée contre le catalogue. --- */
  const rawView = asObj(o.view);
  const kind: ViewCfg["kind"] = rawView.kind === "table" || rawView.kind === "kpi" ? rawView.kind
    : rawView.kind === "list" ? "list" : base.view.kind;
  let view: ViewCfg;

  if (kind === "table") {
    const cols = (Array.isArray(rawView.columns) ? rawView.columns : [])
      .map(known).filter((a): a is string => !!a);
    const fallbackCols = base.view.kind === "table" && !changedSource ? base.view.columns : [];
    const picked = (cols.length ? cols : fallbackCols.length ? fallbackCols : Object.keys(desc.fields))
      .filter((a, i, arr) => arr.indexOf(a) === i)          // dédoublonnage, ordre préservé
      .slice(0, TABLE_COLS_MAX);
    view = { kind: "table", columns: picked };
  } else if (kind === "kpi") {
    const prev = base.view.kind === "kpi" && !changedSource ? base.view : undefined;
    const agg = rawView.agg === "sum" || rawView.agg === "avg" ? rawView.agg : prev?.agg ?? "count";
    // sum/avg exigent un champ NUMÉRIQUE ; sans champ valide, on retombe sur count.
    const numField = known(rawView.field ?? prev?.field);
    const field = numField && kindOf(numField) === "number" ? numField : undefined;
    const dateAlias = known("dateField" in rawView ? rawView.dateField : prev?.dateField);
    const dateField = dateAlias && kindOf(dateAlias) === "date" ? dateAlias : undefined;
    const daysRaw = Number("compareDays" in rawView ? rawView.compareDays : prev?.compareDays);
    view = {
      kind: "kpi",
      agg: agg !== "count" && !field ? "count" : agg,
      field: agg === "count" ? undefined : field,
      dateField,
      compareDays: daysRaw > 0 ? Math.min(KPI_DAYS_MAX, Math.floor(daysRaw)) : 0,
    };
  } else {
    /* Mappage : rôle absent → défaut ; rôle vide ("") → choix explicite « aucun »
       respecté ; rôle invalide → repli. Le « aucun » est stocké en chaîne vide, et
       non en `undefined` que `JSON.stringify` supprimerait. */
    const rawMap = asObj(rawView.map);
    const fallbackMap: FieldRoleMap = changedSource ? desc.defaultMap ?? {}
      : base.view.kind === "list" ? base.view.map : desc.defaultMap ?? {};
    const roleOf = (role: keyof FieldRoleMap): string => {
      if (!(role in rawMap)) return known(fallbackMap[role]) ?? "";
      const v = rawMap[role];
      if (v === "" || v == null) return "";
      return known(v) ?? known(fallbackMap[role]) ?? "";
    };
    view = { kind: "list", map: { title: roleOf("title"), sub: roleOf("sub"), date: roleOf("date"), badge: roleOf("badge") } };
  }

  /* --- actions : ids existant réellement dans le descripteur. --- */
  const declared = new Set((desc.actions ?? []).map((a) => a.id));
  const use = (Array.isArray(o.actions?.use) ? o.actions.use : [])
    .filter((id: unknown): id is string => typeof id === "string" && declared.has(id));

  /* --- barre d'outils : offerte par DÉFAUT en liste et en tableau (jamais en KPI, qui
     n'affiche aucune ligne). `search !== false` et non `=== true` : les cfg déjà
     enregistrées n'ont pas la clé et doivent hériter du nouveau défaut, sinon la
     recherche n'arriverait jamais chez ceux qui ont personnalisé leur accueil.
     Les filtres retombent sur `defaultFacet` du descripteur ; un alias inconnu (source
     changée, champ retiré) est écarté plutôt que gardé — un filtre sur un champ absent ne
     renverrait jamais rien, sans rien dire.
     TROIS FORMES SONT LUES, parce que trois existent réellement : `facets` (liste, depuis le
     2026-08-19), `facet` (chaîne, dans les layouts déjà enregistrés et dans trois presets), et
     rien du tout (on prend le défaut du descripteur, lui aussi chaîne ou liste). Une seule est
     ÉCRITE — `facets` — donc un document se normalise au premier « Enregistrer ». */
  /* ⚠️ `facet` (singulier) N'EXPRIME PAS UN CHOIX D'EXCLUSION, et ce détail décide de ce que
     voit un widget DÉJÀ POSÉ : à l'époque où cette clé a été écrite, un seul filtre était
     possible. Une cfg qui la porte est donc COMPLÉTÉE par le défaut du descripteur quand
     celui-ci en propose plusieurs — sans quoi l'annuaire des contacts posé le matin du
     2026-08-19 aurait gardé pour toujours son unique filtre « entreprise », et les deux autres
     n'auraient jamais paru arriver. La valeur enregistrée reste EN TÊTE : si elle exprimait
     vraiment un choix, il est conservé, simplement plus seul.
     Cas particulier PRÉSERVÉ : `facet: ""` veut dire « aucun filtre » (les deux files d'attente,
     §10) et doit le rester — d'où le test sur la chaîne vide, qui rend une liste vide. */
  const facetsBruts: unknown[] = Array.isArray(o.facets) ? o.facets
    : typeof o.facets === "string" ? [o.facets]
    : "facet" in o
      ? (o.facet === "" || o.facet == null ? []
         : [o.facet, ...(Array.isArray(desc.defaultFacet) ? desc.defaultFacet : [])])
    : Array.isArray(desc.defaultFacet) ? desc.defaultFacet
    : [desc.defaultFacet];
  const facets = kind === "kpi" ? []
    : [...new Set(facetsBruts.map((a) => known(a)).filter((a): a is string => !!a))].slice(0, FACETS_MAX);

  /* --- « mes fiches » : offert seulement si la source a un propriétaire déclaré, ACTIF
     par défaut (`!== false`, comme `search` : une cfg enregistrée avant ce réglage n'a
     pas la clé et doit hériter du nouveau défaut). La clé est ÉCRITE même à `false`,
     sinon un utilisateur qui ouvre volontairement la liste retrouverait le filtre au
     rechargement suivant. Une source sans propriétaire n'a pas la clé du tout. --- */
  const mine = desc.ownerField ? o.mine !== false : false;

  /* --- Clientèle : offerte seulement si la source déclare un `clientField`. Toute valeur
     inconnue retombe sur "tous" — un réglage illisible ne doit jamais restreindre en
     silence. La clé est écrite même à "tous", pour la même raison que `mine`. --- */
  const clientele: Clientele = desc.clientField ? clienteleOf(o) : "tous";

  return {
    title: asText(o.title ?? base.title),
    unit: asText(o.unit || base.unit) || "élément",
    source,
    query: { filter, sort: { by: sortBy, dir: sortDir }, limit },
    view,
    search: kind === "kpi" ? false : o.search !== false,
    ...(desc.ownerField ? { mine } : {}),
    ...(desc.clientField ? { clientele } : {}),
    ...(facets.length ? { facets } : {}),
    ...(use.length ? { actions: { use } } : {}),
    ...(o.create && desc.create ? { create: true } : {}),
  };
}

/* ---------------------------------------------------------------------------
   Vue : filtres (ET) → tri typé → limite. Fonctions PURES, identiques en mock
   et en live.
   --------------------------------------------------------------------------- */

function matchFilter(v: unknown, f: Filter): boolean {
  const text = asText(v);
  const target = asText(f.value);
  switch (f.op) {
    case "eq": return text.toLowerCase() === target.toLowerCase();
    case "neq": return text.toLowerCase() !== target.toLowerCase();
    case "contains": return target === "" ? true : text.toLowerCase().includes(target.toLowerCase());
    case "gt": return Number(text) > Number(target);
    case "lt": return Number(text) < Number(target);
    case "lastDays": {
      const days = Number(target);
      if (!(days > 0) || Number.isNaN(new Date(text).getTime())) return false;
      const d = relDays(text);            // ≤ 0 pour une date passée
      return d <= 0 && -d <= days;
    }
    case "isEmpty": return text.trim() === "";
    case "notEmpty": return text.trim() !== "";
    default: return true;
  }
}

// Tri TYPÉ par la nature du champ (dates en temps, nombres en nombres).
function compareRows(a: Row, b: Row, alias: string, kind: FieldKind | undefined, dir: "asc" | "desc"): number {
  const sign = dir === "desc" ? -1 : 1;
  const av = a[alias], bv = b[alias];
  if (kind === "date") {
    const at = new Date(asText(av)).getTime() || 0;
    const bt = new Date(asText(bv)).getTime() || 0;
    return (at - bt) * sign;
  }
  if (kind === "number") return (Number(av) - Number(bv) || 0) * sign;
  if (kind === "bool") return ((av === true ? 1 : 0) - (bv === true ? 1 : 0)) * sign;
  return asText(av).localeCompare(asText(bv), "fr", { numeric: true }) * sign;
}

/** Le filtre « mes fiches » est-il RÉELLEMENT applicable ? Demandé dans la cfg ne suffit
 *  pas : il faut que la source déclare un propriétaire ET que la session soit
 *  identifiable. Sans nom ni e-mail, l'appliquer viderait la liste sans que personne
 *  puisse comprendre pourquoi — même arbitrage que `selectNotifs` (§9). */
const ownerFilterActive = (cfg: InstanceCfg, ident?: UserIdent): boolean =>
  !!cfg.mine && !!CATALOG[cfg.source].ownerField && !!ident?.known;

/** Périmètre PROPRIÉTAIRE seul, sans les filtres de consultation de la cfg. Sert là où
 *  l'on a besoin du périmètre mais pas des filtres : les valeurs proposées par le filtre
 *  à cases, par exemple — proposer d'y cocher un installateur qui n'est pas à soi
 *  donnerait une case qui ne ramène jamais rien. PURE. */
const ownerScope = (rows: Row[], cfg: InstanceCfg, ident?: UserIdent): Row[] => {
  if (!ownerFilterActive(cfg, ident)) return rows;
  const alias = CATALOG[cfg.source].ownerField!;
  return rows.filter((r) => ownerIsUser(asText(r[alias]), ident!));
};

/** Le TYPE DE CLIENT à partir de la valeur brute du champ (« Pro », « Solo », « Duo »).
 *  Rend "" pour une valeur vide — non classable, et c'est une information, pas un défaut :
 *  le champ peut ne pas être exposé côté Softr. PURE.
 *  ⚠️ GRANULARITÉ (2026-08-20) : `solo` et `duo` sont désormais distingués, pour que le
 *  réglage puisse porter sur l'un ou l'autre. Une valeur inconnue tombe sur `particulier`
 *  et NON sur "" : tout ce qui n'est pas « Pro » est un foyer, ce qui restera vrai d'une
 *  éventuelle troisième forme — là où une liste blanche `["solo","duo"]` la classerait
 *  « inconnue » sans un mot, et la ferait disparaître du périmètre « Particuliers ». */
const clientKind = (v: unknown): "pro" | "solo" | "duo" | "particulier" | "" => {
  /* ⚠️ LA PREMIÈRE VALEUR, pas la chaîne entière. Sur `notifC` ce champ est un LOOKUP, et
     `asText` joint un lookup multi-valeurs par « , » : une ligne liée à deux dossiers
     arriverait en « Pro, Pro » et, comparée telle quelle, tomberait dans le fourre-tout
     `particulier` — un dossier pro classé particulier. Aucune des trois valeurs réelles ne
     contient de virgule, la découpe est donc sans risque. */
  const t = foldText(v).split(",")[0].trim();
  if (!t) return "";
  return t === "pro" ? "pro" : t === "solo" ? "solo" : t === "duo" ? "duo" : "particulier";
};

/** Une ligne classée par `clientKind` entre-t-elle dans le périmètre demandé ? PURE.
 *  ⚠️ `particulier` est un REGROUPEMENT (Solo ∪ Duo, plus toute forme non « Pro ») ;
 *  `solo` et `duo` sont des égalités strictes. Une ligne non classable ("") n'entre dans
 *  AUCUN périmètre : c'est `clientScope` qui décide s'il faut alors filtrer du tout. */
const clientMatch = (kind: ReturnType<typeof clientKind>, veut: Clientele): boolean =>
  veut === "tous" ? true
  : veut === "particulier" ? kind !== "" && kind !== "pro"
  : kind === veut;

/** Périmètre clientèle appliqué à des lignes BRUTES, hors grammaire `InstanceCfg` : c'est
 *  ce que consomment les widgets sur-mesure (commerciaux, notifications), qui portent
 *  leur propre cfg. Même arbitrage que `clientScope` — aucune ligne classable ⇒ aucun
 *  filtre, parce que le champ n'est alors pas exposé par la datasource. PURE. */
const clienteleRows = <R extends Record<string, unknown>>(rows: R[], veut: Clientele, alias = "client"): R[] => {
  if (veut === "tous") return rows;
  if (!rows.some((r) => clientKind(r[alias]))) return rows;
  return rows.filter((r) => clientMatch(clientKind(r[alias]), veut));
};

/** Le champ « type de client » est-il LU sur ces lignes ? Faux = non coché dans l'onglet
 *  Sources du bloc, donc tout réglage de clientèle est inopérant et doit se DIRE. PURE. */
const clientLisible = (rows: Record<string, unknown>[], alias = "client"): boolean =>
  rows.some((r) => clientKind(r[alias]) !== "");

/** Périmètre CLIENTÈLE, appliqué comme `ownerScope` : avant les filtres, donc aussi aux
 *  agrégats. Une ligne non classable est écartée quand un périmètre est demandé — sinon
 *  « Professionnels seulement » afficherait des lignes dont rien ne dit qu'elles le sont.
 *  ⚠️ SAUF si AUCUNE ligne n'est classable : le champ n'est alors pas exposé côté Softr
 *  (il n'a pas été coché dans l'onglet Sources), et filtrer viderait le widget sans que
 *  personne puisse comprendre pourquoi. On rend tout, et `DataView` affiche « Filtre
 *  inactif » — même arbitrage que pour « mes fiches » sans session identifiable. */
const clientScope = (rows: Row[], cfg: InstanceCfg): Row[] => {
  const alias = CATALOG[cfg.source].clientField;
  // Le filtrage lui-même vit dans `clienteleRows` : ici, on ne fait que résoudre l'alias
  // depuis le catalogue. Deux implémentations du même arbitrage finiraient par diverger.
  return alias ? clienteleRows(rows, cfg.clientele ?? "tous", alias) : rows;
};

/** Le périmètre clientèle est-il RÉELLEMENT applicable ? Demandé dans la cfg ne suffit
 *  pas : il faut que les lignes portent le champ (voir `clientScope`). */
const clientFilterActive = (cfg: InstanceCfg, rows: Row[]): boolean => {
  const alias = CATALOG[cfg.source].clientField;
  return !!alias && !!cfg.clientele && cfg.clientele !== "tous" && clientLisible(rows, alias);
};

/** Lignes retenues par les filtres (ET), sans tri ni limite — base des agrégats.
 *  ⚠️ Le filtre PROPRIÉTAIRE passe en premier et hors de la grammaire des `Filter` : ce
 *  n'est pas un critère de consultation mais un PÉRIMÈTRE. Il s'applique donc aussi aux
 *  agrégats (`kpiCompute`), sinon un KPI compterait le portefeuille de tout le monde
 *  au-dessus d'une liste qui n'en montre qu'une part. */
function selectRows(rows: Row[], cfg: InstanceCfg, ident?: UserIdent): Row[] {
  const out = clientScope(ownerScope(rows, cfg, ident), cfg);
  const fs = cfg.query.filter;
  return fs.length ? out.filter((r) => fs.every((f) => matchFilter(r[f.field], f))) : out;
}

/** Minuscules sans accents — la forme sous laquelle on compare du texte saisi à la
 *  main. Personne ne tape « à signer » avec l'accent dans un champ de recherche, et un
 *  filtre qui échoue sur un accent ne se voit pas. */
const foldText = (s: unknown): string =>
  asText(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Tout le texte lisible d'une ligne, pour la recherche plein-texte. On balaie les
 *  champs DÉCLARÉS par le descripteur et pas `Object.values(row)` : ainsi on ne cherche
 *  jamais dans un record id ni dans un champ technique qu'on n'affiche pas. */
const rowText = (row: Row, desc: SourceDesc): string =>
  foldText(Object.keys(desc.fields).map((a) => asText(row[a])).join(" "));

/** Réglages LOCAUX d'une vue : ils ne sont pas persistés dans la cfg (ce sont des
 *  gestes de consultation, pas des préférences), mais ils doivent s'appliquer AVANT la
 *  limite — sinon on chercherait, filtrerait et trierait dans les 12 premières lignes
 *  au lieu de la table. C'est toute la raison de ce paramètre. */
type LocalRefine = {
  q?: string;                                  // recherche plein-texte
  /** Cases cochées PAR FILTRE : alias → valeurs ([] ou absent = aucune restriction).
   *  Un objet et non les deux clés `facetField`/`facetValues` d'avant le 2026-08-19 : avec
   *  elles, ouvrir un second filtre ÉCRASAIT le premier — trois boutons pour un seul filtre
   *  effectif, et sans le dire. */
  facetSel?: Record<string, string[]>;
  sort?: { by: string; dir: "asc" | "desc" };  // tri par clic (surcharge celui de la cfg)
};

/** Filtres + recherche + facette + tri + limite : ce qu'une vue liste ou tableau
 *  affiche. PURE. L'ordre des passes n'est pas négociable — la limite EN DERNIER. */
function applyQuery(rows: Row[], cfg: InstanceCfg, local?: LocalRefine, ident?: UserIdent): Row[] {
  const desc = CATALOG[cfg.source];
  let out = selectRows(rows, cfg, ident);

  // Recherche : chaque MOT saisi doit être présent (ET), dans n'importe quel champ.
  // « mc ener » trouve donc « MC ENERGY », et l'ordre des mots n'a pas d'importance.
  const mots = foldText(local?.q).trim().split(/\s+/).filter(Boolean);
  if (mots.length) out = out.filter((r) => { const t = rowText(r, desc); return mots.every((m) => t.includes(m)); });

  /* Filtres à cases : OU entre les valeurs d'un même filtre, ET entre les filtres — l'ordre
     des deux n'est pas un détail, c'est ce qui fait qu'on peut demander « les commerciaux OU
     les admins, chez MC ENERGY ». Aucune coche = aucune restriction (et non « rien » : un
     filtre vide qui viderait la liste serait un piège à clics).
     Un alias inconnu du descripteur est ignoré : la sélection locale survit à un changement de
     source, et filtrer sur un champ absent ne renverrait jamais rien. */
  for (const [alias, vals] of Object.entries(local?.facetSel ?? {})) {
    if (!vals.length || !(alias in desc.fields)) continue;
    const coche = new Set(vals.map(foldText));
    const multi = desc.fields[alias].multi;
    out = out.filter((r) => matchFacet(r[alias], coche, multi));
  }

  const tri = local?.sort ?? cfg.query.sort;
  if (tri.by) {
    const kind = desc.fields[tri.by]?.kind;
    out = [...out].sort((a, b) => compareRows(a, b, tri.by, kind, tri.dir));
  }
  return out.slice(0, Math.max(1, Math.min(LIST_LIMIT_MAX, cfg.query.limit)));
}

/** La ligne porte-t-elle l'une des valeurs cochées ? OU entre les valeurs d'un même filtre.
 *  Sur un champ multi-valeurs, la comparaison porte sur CHAQUE valeur de la cellule : un
 *  contact « Commercial, Admin » répond donc au filtre « Commercial », ce qu'une égalité sur la
 *  chaîne entière ratait. PURE. */
const matchFacet = (cell: unknown, coche: Set<string>, multi?: boolean): boolean => {
  const brut = asText(cell).trim();
  if (!brut) return false;
  if (!multi) return coche.has(foldText(brut));
  return brut.split(",").some((v) => coche.has(foldText(v.trim())));
};

/** Valeurs distinctes d'un champ dans les lignes lues, les plus fréquentes d'abord.
 *  PURE. Alimente le filtre à cases : les valeurs viennent des DONNÉES et non d'une
 *  liste écrite à la main, donc un nouvel installateur apparaît tout seul.
 *  ⚠️ LE PLAFOND `max` COUPE EN SILENCE, et c'est ASSUMÉ. Le panneau a porté quelques heures
 *  le 2026-08-19 une ligne qui annonçait la troncature (« les 60 valeurs les plus fréquentes
 *  sur 371 ») : RETIRÉE le jour même, à la demande — sur un annuaire de 371 entreprises, elle
 *  expliquait à chaque ouverture du filtre un plafond dont on n'a rien à faire quand on cherche
 *  un nom, et la recherche plein-texte (qui, elle, ne tronque rien) est juste au-dessus.
 *  Ne pas la remettre sans qu'on la redemande. */
function facetValues(rows: Row[], alias: string, multi?: boolean, max = 60): { value: string; count: number }[] {
  const compte = new Map<string, { value: string; count: number }>();
  for (const r of rows) {
    const brut = asText(r[alias]).trim();
    if (!brut) continue;
    /* Champ multi-valeurs : on compte CHAQUE valeur de la cellule. Conséquence à connaître —
       la somme des compteurs dépasse alors le nombre de lignes, puisqu'un contact « Commercial,
       Admin » est compté dans les deux. C'est le comportement attendu d'un filtre à facettes,
       pas une double comptabilisation à corriger. */
    for (const v of multi ? brut.split(",").map((x) => x.trim()).filter(Boolean) : [brut]) {
      const k = foldText(v);
      const e = compte.get(k);
      if (e) e.count++; else compte.set(k, { value: v, count: 1 });
    }
  }
  return [...compte.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "fr")).slice(0, max);
}

/** Agrégat d'un KPI + écart avec la fenêtre précédente (`null` si non calculable).
 *  ⚠️ Porte sur les lignes CHARGÉES par la source, pas sur le total serveur. PURE. */
function kpiCompute(rows: Row[], cfg: InstanceCfg, ident?: UserIdent): { value: number; delta: number | null } {
  if (cfg.view.kind !== "kpi") return { value: 0, delta: null };
  const v = cfg.view;
  const base = selectRows(rows, cfg, ident);
  const agg = (list: Row[]): number => {
    if (v.agg === "count" || !v.field) return list.length;
    const nums = list.map((r) => Number(r[v.field!])).filter((n) => !Number.isNaN(n));
    if (!nums.length) return 0;
    const sum = nums.reduce((a, b) => a + b, 0);
    return v.agg === "avg" ? Math.round((sum / nums.length) * 100) / 100 : sum;
  };
  const days = v.compareDays ?? 0;
  const alias = v.dateField;
  if (!alias || !(days > 0)) return { value: agg(base), delta: null };
  // relDays ≤ 0 dans le passé : fenêtre courante ]-days ; 0], précédente ]-2j ; -days].
  const inWindow = (r: Row, from: number, to: number) => {
    const raw = asText(r[alias]);
    if (Number.isNaN(new Date(raw).getTime())) return false;
    const d = relDays(raw);
    return d <= from && d > to;
  };
  const current = agg(base.filter((r) => inWindow(r, 0, -days)));
  const previous = agg(base.filter((r) => inWindow(r, -days, -2 * days)));
  return { value: current, delta: Math.round((current - previous) * 100) / 100 };
}

/* ---------------------------------------------------------------------------
   Présentiels génériques. ⚠️ Toute la mise en page est en style INLINE : la
   feuille injectée peut ne pas s'appliquer dans le bloc Softr (§1).
   --------------------------------------------------------------------------- */

/* --- ÉTAT DE COMPLÉTUDE D'UN AGRÉGAT — une seule implémentation ------------------
   Six widgets d'agrégat portaient le même bandeau, recopié six fois avec des textes
   presque identiques. Ils disent maintenant la même chose au même endroit, et il y a
   DEUX états à distinguer — c'est tout l'intérêt :
     · « Calcul en cours » (neutre) — il reste des pages à lire, le total finira JUSTE.
       Le chiffre affiché monte encore : le dire évite de lire un CAPEX à mi-chemin.
     · « Calcul partiel » (ambre) — le plafond de pages est atteint (`COM_MAX_PAGES`),
       le total ne sera PAS complet. C'est une alerte, pas une attente.
   Rien à afficher quand la lecture est finie : un widget sain ne se commente pas. --- */
function AggregateNote({ api, style }: { api: SourceState; style?: CSSProperties }) {
  if (!api.stale && !api.draining && !api.partial) return null;
  const enCours = !!api.draining;
  /* TROISIÈME ÉTAT (2026-08-18) — « Instantané ». Le chiffre affiché est COMPLET et
     JUSTE, mais il date de la dernière visite : le cache d'instantanés (§6-ter) le sert
     pendant que la relecture tourne. Il passe donc AVANT les deux autres, qui décrivent
     une lecture en cours dont rien n'est encore affiché. Sans lui, un total d'hier
     s'afficherait comme un total de maintenant — le même défaut qu'un total partiel
     présenté comme un total. */
  if (api.stale) {
    /* DEUX PHRASES, et il a fallu les séparer le 2026-08-19 : « mise à jour en cours » devient
       FAUX quand la source est servie SANS lecture (`cached`, §6-quater). Promettre une
       actualisation qui n'arrivera pas avant demain serait pire que de ne rien dire — on
       attendrait un chiffre qui ne vient pas. */
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "12px 16px 14px", ...style }}>
        <Badge variant="neutral" dot>Instantané</Badge>
        <span style={{ fontSize: "12px", fontWeight: 500, color: T.ink3 }}>
          Chiffres {snapAge(api.at)}
          {api.cached ? " — relire avec le ⟳ de la carte." : " — mise à jour en cours."}
        </span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "12px 16px 14px", ...style }}>
      <Badge variant={enCours ? "neutral" : "warn"} dot>{enCours ? "Calcul en cours" : "Calcul partiel"}</Badge>
      <span style={{ fontSize: "12px", fontWeight: 500, color: T.ink3 }}>
        {enCours
          ? "Lecture du parc en cours — le calcul se complète à mesure."
          : "Le parc dépasse ce que ce widget lit d'un coup : le calcul porte sur les dossiers les plus récents."}
      </span>
    </div>
  );
}

/** Valeur d'un champ formatée selon son `kind` (partagée liste / tableau). */
function FieldValue({ row, alias, desc }: { row: Row; alias: string; desc: SourceDesc }) {
  const f = desc.fields[alias];
  const raw = row[alias];
  const text = asText(raw);
  if (!f) return <>{text || DASH}</>;
  if (f.kind === "bool") {
    /* ⚠️ `hasFile` en plus des deux formes booléennes : plusieurs champs déclarés `bool`
       sont en réalité des PIÈCES JOINTES (« Contrat abonnement signe »). Sur un tableau
       d'objets, `asText` rend le nom de fichier — donc le test textuel seul répondait
       « non » alors qu'un contrat était bien joint. Faux négatif silencieux. */
    const on = raw === true || text.toLowerCase() === "true" || hasFile(raw);
    return on
      ? <Check aria-label="oui" style={{ width: 15, height: 15, color: T.okInk }} />
      : <span style={{ color: T.ink4 }}>{DASH}</span>;
  }
  if (!text) return <span style={{ color: T.ink4 }}>{DASH}</span>;
  if (f.kind === "badge") {
    /* MULTI-SÉLECTION (2026-08-19) : « Commercial, Admin » sont DEUX valeurs, pas une. En une
       seule pastille, elles perdaient leur couleur — aucune entrée de `variants` ne porte la
       paire, donc le repli `statusVariant` les grisait toutes — et la ligne devenait illisible
       dès trois services. La page Softr, elle, affiche bien une pastille par valeur.
       ⚠️ Le découpage n'a lieu que si le descripteur DÉCLARE le champ multi-valeurs (`multi`,
       §6-bis) : découper tout badge sur la virgule aurait coupé en deux le premier statut ou
       la première raison sociale qui en contient une. */
    const vals = f.multi ? text.split(",").map((v) => v.trim()).filter(Boolean) : [text];
    if (vals.length > 1) {
      return (
        <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "4px", verticalAlign: "middle" }}>
          {vals.map((v) => <Badge key={v} variant={variantOf(desc, alias, v)}>{v}</Badge>)}
        </span>
      );
    }
    return <Badge variant={variantOf(desc, alias, text)}>{text}</Badge>;
  }
  if (f.kind === "date") return <span title={fmtDate(text)}>{fmtSmart(text)}</span>;
  if (f.kind === "url") return <a href={text} target="_blank" rel="noopener noreferrer" style={{ color: T.brand700, fontWeight: 600 }}>Ouvrir</a>;
  /* COORDONNÉES — le texte reste VISIBLE, à l'inverse d'`url` qui affiche « Ouvrir » : dans
     un annuaire, lire l'adresse est aussi utile que cliquer dessus, et une colonne de
     « Ouvrir » identiques ne se parcourt pas des yeux.
     `mailto:` / `tel:` ne naviguent pas la page, donc pas de `target` : les mettre en
     `_blank` laisserait un onglet vide derrière chaque clic. Le numéro n'est nettoyé que
     dans l'attribut — « +33 6 24 51 56 16 » reste lisible à l'écran et composable.
     `stopPropagation` : ces liens vivent dans une ligne cliquable (`onOpen`), et sans lui
     écrire un mail ouvrirait aussi la fiche par-dessus. */
  if (f.kind === "email" || f.kind === "phone") {
    const href = f.kind === "email" ? `mailto:${text}` : `tel:${text.replace(/[^+\d]/g, "")}`;
    return (
      <a href={href} onClick={(e) => e.stopPropagation()}
        style={{ color: T.brand700, fontWeight: 600, textDecoration: "none", overflowWrap: "anywhere" }}
        title={f.kind === "email" ? `Écrire à ${text}` : `Appeler ${text}`}>{text}</a>
    );
  }
  if (f.kind === "number") {
    // Séparateurs de milliers : « 153 000 » plutôt que « 153000 ». Un CAPEX brut se
    // relit mal, et l'ordre de grandeur est justement ce qu'on cherche d'un coup d'œil.
    const n = Number(text);
    return <>{Number.isFinite(n) ? n.toLocaleString("fr-FR") : text}</>;
  }
  return <>{text}</>;
}

/* ---------------------------------------------------------------------------
   FICHE DÉTAILLÉE D'UNE LIGNE (pop-up) — générique, pilotée par le descripteur
   ---------------------------------------------------------------------------
   Cliquer une ligne d'un widget liste ou tableau ouvre CETTE modale, qui affiche
   TOUS les champs que le descripteur déclare (§6-bis) — pas seulement les trois
   ou quatre que la ligne avait la place de montrer. Aucun code par source : le
   catalogue donne le libellé, la nature (donc le rendu, via `FieldValue`) et
   l'ordre ; ajouter un alias au descripteur l'ajoute à la fiche.

   Les champs VIDES sont affichés, avec un tiret : sur un dossier abonné,
   « Date de signature — » est une information (le dossier n'est pas signé), et
   masquer les creux ferait croire à une fiche complète. C'est le même principe
   que les tuiles de couverture du registre des exceptions.

   ⚠️ `position: fixed` dans l'iframe du bloc : la modale se centre sur le
   viewport de l'IFRAME, pas sur celui du navigateur. C'est exactement ce que
   fait déjà la galerie d'ajout de widgets (§11), donc le comportement est celui
   qui a été validé à l'écran — ne pas « corriger » vers `absolute`, la modale
   suivrait alors le défilement de la page.
   ⚠️ Tout est en style INLINE (la feuille de §2 peut ne pas s'appliquer) : seul
   `slb-fade` est cosmétique, et son absence ne fait perdre que le fondu. --- */
function RecordDialog({ row, desc, map, onClose, ficheHref }: {
  row: Row; desc: SourceDesc; map: FieldRoleMap; onClose: () => void;
  /** URL de fiche IMPOSÉE, quand le record id de la ligne n'est pas celui de la fiche.
   *  Cas réel : une ligne de « Notification Center » porte l'id de la NOTIFICATION,
   *  alors que la fiche attend celui de l'ABONNÉ (`Liens BDD`). Le descripteur ne peut
   *  pas décrire ce détour, l'appelant le sait — d'où cette porte de sortie. */
  ficheHref?: string;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useModalScrollLock();                             // la fiche est montée = elle est ouverte
  useEffect(() => {
    closeRef.current?.focus();                      // le clavier entre DANS la modale
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* Ce que la fiche montre, et ce qu'elle tait :
     · `detail !== false` — un champ CALCULÉ qui ne serait qu'un doublon des colonnes dont
       il est tiré n'a rien à y faire (cf. `clientNom`) ;
     · valeur VIDE → champ masqué (2026-08-18, demandé). Le code affichait auparavant un
       tiret, délibérément : « Signé le — » disait que le dossier n'était pas signé. À
       l'usage c'est l'inverse qui gêne — sur un dossier en attente de solvabilité, contrat
       et facturation n'existent pas ENCORE, et cinq lignes de tirets noient les trois
       informations utiles. Le prix, assumé : on ne distingue plus « champ vide » de
       « champ absent du descripteur », et une fiche change de longueur d'un dossier à
       l'autre.
     ⚠️ « Vide » se mesure sur `asText`, donc un `0` ou un `false` RESTENT affichés : un
     CAPEX à 0 € est une information, pas une absence. Ne disparaissent que les chaînes
     vides et les listes vides — dont les pièces jointes non déposées. */
  const aliases = Object.keys(desc.fields)
    .filter((x) => desc.fields[x].detail !== false && asText(row[x]).trim() !== "");
  /* Titre : le champ de rôle `title` s'il existe, sinon le premier champ texte non vide.
     Une fiche sans titre lisible serait une fiche qu'on ne sait pas rattacher. */
  const titre = asText(map.title ? row[map.title] : "")
    || asText(row[aliases.find((a) => desc.fields[a].kind === "text" && asText(row[a])) ?? ""])
    || DASH;
  const badge = map.badge ? asText(row[map.badge]) : "";
  /* Lien vers la FICHE COMPLÈTE de l'espace Softr, si le descripteur en déclare une.
     `target="_top"` : le bloc vit dans une iframe, sans lui la page s'ouvrirait dedans.
     ⚠️ Le record id de la ligne n'est un id de fiche que si la source EST la table de
     cette fiche — d'où `detailPage` porté par le descripteur et non déduit ici. */
  const fiche = ficheHref ?? (desc.detailPage ? pageUrl(desc.detailPage, { [PAGE_RECORD_PARAM]: row.id }) : "");
  /* À DÉFAUT DE FICHE : la page qui CONTIENT cette ligne (`listPage`), avec un libellé qui le
     dit — « Ouvrir la page … » et non « Ouvrir la fiche complète ». Nuance signalée le
     2026-08-19 sur l'annuaire des contacts, et elle est juste : un bouton qui promet la fiche
     d'une personne et rend un tableau de 371 lignes est un bouton qui ment, même s'il ouvre la
     bonne page. Aucun record id n'est passé ici : la page n'en ferait rien. */
  const lien = fiche || (desc.listPage ? pageUrl(desc.listPage) : "");
  const libelleLien = fiche ? "Ouvrir la fiche complète"
    : desc.pageLabel ? `Ouvrir ${desc.pageLabel}`
    : "Ouvrir dans le CRM";

  const lbl: CSSProperties = { fontSize: "11px", fontWeight: 700, color: T.ink4, textTransform: "uppercase", letterSpacing: ".04em" };
  const val: CSSProperties = { fontSize: "13px", fontWeight: 500, color: T.ink, minWidth: 0, overflowWrap: "anywhere" };

  return (
    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px", background: "rgba(16,26,40,.30)", backdropFilter: "blur(7px)",
        WebkitBackdropFilter: "blur(7px)", animation: "slb-fade .16s ease both",
      }}>
      <div role="dialog" aria-modal="true" aria-label={`Détail — ${titre}`}
        style={{
          width: "min(680px, 100%)", maxHeight: "86%", display: "flex", flexDirection: "column",
          background: T.surface, borderRadius: T.rXl, boxShadow: T.shMd, border: `1px solid ${T.line}`,
          overflow: "hidden", animation: "slb-fade .18s ease both",
        }}>
        {/* En-tête fixe : qui, quel statut, d'où ça vient, et la sortie. */}
        <div style={{ display: "flex", alignItems: "center", gap: "11px", padding: "15px 18px", borderBottom: `1px solid ${T.line}`, flex: "none" }}>
          <Monogram name={titre} size={38} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "-.01em", color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titre}</div>
            <div style={{ fontSize: "11.5px", fontWeight: 500, color: T.ink3 }}>{desc.label}</div>
          </div>
          {badge && <span style={{ flex: "none" }}><StatusBadge value={badge} variant={variantOf(desc, map.badge, badge)} /></span>}
          <button ref={closeRef} className="slb-nbtn" style={NBTN_SM} onClick={onClose} aria-label="Fermer la fiche" title="Fermer">
            <X aria-hidden style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Corps : tous les champs du descripteur. Les `longtext` passent en pleine
            largeur (une note de trois lignes dans une colonne de 34 % est illisible). */}
        <div style={{ ...MODAL_BODY, padding: "6px 18px 16px" }}>
          {aliases.map((a) => {
            const f = desc.fields[a];
            const long = f.kind === "longtext";
            return (
              <div key={a}
                style={long
                  ? { padding: "11px 0", borderTop: `1px solid ${T.line}` }
                  : { display: "grid", gridTemplateColumns: "minmax(110px, 34%) 1fr", gap: "12px", alignItems: "baseline", padding: "11px 0", borderTop: `1px solid ${T.line}` }}>
                <span style={lbl}>{f.label}</span>
                <span style={long ? { ...val, display: "block", marginTop: "5px", lineHeight: 1.5 } : val}>
                  <FieldValue row={row} alias={a} desc={desc} />
                </span>
              </div>
            );
          })}
        </div>

        {lien && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 18px", borderTop: `1px solid ${T.line}`, flex: "none" }}>
            <a href={lien} target="_top" className="slb-btng"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 13px", borderRadius: T.rSm, border: `1px solid ${T.line}`, background: T.surface, color: T.ink2, fontSize: "12.5px", fontWeight: 600, textDecoration: "none" }}>
              {libelleLien}<ChevronRight aria-hidden style={{ width: 14, height: 14 }} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   BARRE D'OUTILS DE CONSULTATION — recherche, filtres à cases, tri
   ---------------------------------------------------------------------------
   Trois outils au-dessus de la liste, tous LOCAUX (rien n'est enregistré, cf.
   `LocalRefine`) et tous génériques : ils ne connaissent que le descripteur de
   la source, donc ils marchent pour les notes comme pour les dossiers SAV.

   · RECHERCHE — plein-texte sur les champs déclarés, mot par mot (ET).
   · FILTRES À CASES — les valeurs DISTINCTES d'un champ, par fréquence
     décroissante, en multi-sélection. JUSQU'À TROIS depuis le 2026-08-19
     (`cfg.facets`, plafond `FACETS_MAX`), demandés pour l'annuaire des contacts :
     entreprise, service, type de contact — les trois de la page Softr. Les
     valeurs viennent des données : un nouvel installateur apparaît sans toucher
     au code. OU entre les valeurs d'un filtre, ET entre les filtres.
   · TRI — proposé ici pour la vue LISTE, qui n'a pas d'en-têtes de colonnes où
     cliquer. En vue tableau, c'est l'en-tête qui trie (cf. `GenericTable`), et
     ce bouton n'est donc pas rendu.

   ⚠️ La barre est HORS du corps scrollable : elle doit rester visible pendant
   qu'on défile la liste, sinon on perd le champ de recherche dès la 5e ligne.
   Elle rend le widget un peu plus haut que sa taille nominale — le tassement de
   la grille mesure la hauteur réelle (§11), donc rien à corriger.
   --------------------------------------------------------------------------- */

/* Styles PARTAGÉS par la barre et par chacun de ses filtres. Sortis en constantes de module le
   2026-08-19 : les filtres sont devenus un composant à part (`FacetFilter`), et redéfinir
   quatre objets de style dans chacun les aurait fait diverger au premier ajustement. */
const TBTN: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "5px", flex: "none",
  padding: "6px 10px", borderRadius: T.rSm, border: `1px solid ${T.line}`,
  background: T.surface, color: T.ink2, fontFamily: "inherit", fontSize: "12px",
  fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
};
const TBTN_ON: CSSProperties = { ...TBTN, border: `1px solid ${T.brand100}`, background: T.brand050, color: T.brand700 };
const TITEM: CSSProperties = { display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "6px 8px", borderRadius: T.rSm, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "12.5px", fontWeight: 500, color: T.ink2, textAlign: "left" };
const TPANEL: CSSProperties = { position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 30, width: 252, maxHeight: 300, overflowY: "auto", padding: "6px", background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rMd, boxShadow: T.shMd, animation: "slb-fade .12s ease both" };

/* UN filtre à cases : son bouton et son panneau.
   COMPOSANT À PART, et ce n'est pas un raffinement de style : chaque filtre a son état
   d'ouverture et son `useDismissOnOutside`. Appelés dans une boucle au sein de `ListToolbar`,
   ces hooks changeraient d'ordre dès qu'un filtre apparaît ou disparaît (source changée, champ
   devenu uniforme) — ce que React interdit. Un composant par filtre rend l'ordre stable par
   construction. */
function FacetFilter({ alias, desc, rows, cochees, onChange }: {
  alias: string; desc: SourceDesc; rows: Row[];
  /** Valeurs cochées de CE filtre ([] = aucune restriction). */
  cochees: string[];
  onChange: (valeurs: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismissOnOutside(open, setOpen);
  const champ = desc.fields[alias];
  /* Les valeurs proposées ignorent VOLONTAIREMENT les autres filtres cochés. Un filtre qui se
     réduirait à ce que les autres laissent passer devient impossible à défaire : les cases
     disparaissent avec leurs valeurs, et on ne peut plus décocher ce qu'on ne voit plus.
     Chaque filtre décrit donc la même population — celle du périmètre. */
  const valeurs = facetValues(rows, alias, champ?.multi);
  const libelle = champ?.label ?? alias;
  /* Un filtre à une seule valeur ne filtre rien : il n'a pas sa place dans la barre. Le test
     est APRÈS les hooks — les règles de React ne laissent pas le choix — ce qui a l'avantage de
     faire réapparaître le bouton tout seul dès que les données s'étoffent. */
  if (valeurs.length < 2) return null;
  const toggle = (v: string) => {
    const set = new Set(cochees);
    if (set.has(v)) set.delete(v); else set.add(v);
    onChange([...set]);
  };
  return (
    <div ref={ref} style={{ position: "relative", flex: "none" }}>
      <button style={cochees.length ? TBTN_ON : TBTN} onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog" aria-expanded={open} title={`Filtrer par ${libelle}`}>
        <FilterIcon aria-hidden style={{ width: 13, height: 13 }} />
        {libelle}
        {cochees.length > 0 && ` · ${cochees.length}`}
        <ChevronDown aria-hidden style={{ width: 13, height: 13 }} />
      </button>
      {open && (
        <div role="dialog" aria-label={`Filtrer par ${libelle}`} style={TPANEL}>
          {/* « Tout effacer » plutôt qu'un « Tout cocher » : aucune coche signifie déjà
              « toutes les valeurs » (cf. `applyQuery`), donc cocher tout serait un synonyme
              inutile — et laisserait croire à un filtre là où il n'y en a pas. */}
          <button onClick={() => onChange([])}
            style={{ ...TITEM, fontWeight: 700, color: cochees.length ? T.brand700 : T.ink4, cursor: cochees.length ? "pointer" : "default" }}
            disabled={!cochees.length}>
            <RotateCcw aria-hidden style={{ width: 13, height: 13 }} />Tout effacer
          </button>
          <div style={{ height: 1, background: T.line, margin: "4px 6px" }} />
          {valeurs.map(({ value, count }) => {
            const on = cochees.includes(value);
            return (
              <label key={value} style={{ ...TITEM, cursor: "pointer" }}>
                <input type="checkbox" checked={on} onChange={() => toggle(value)}
                  style={{ width: 14, height: 14, accentColor: T.brand, flex: "none", cursor: "pointer" }} />
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
                <span style={{ flex: "none", fontSize: "11px", fontWeight: 600, color: T.ink4 }}>{count}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ListToolbar({ rows, cfg, desc, local, setLocal, triable, ident }: {
  rows: Row[]; cfg: InstanceCfg; desc: SourceDesc;
  local: LocalRefine; setLocal: (next: LocalRefine) => void;
  /** Identité de la session — seulement pour borner les valeurs proposées par les filtres
   *  à cases au périmètre du filtre « mes fiches » (cf. ownerScope). */
  ident?: UserIdent;
  /** Vue LISTE : le bouton de tri est offert. Vue tableau : il ne l'est pas (les
   *  en-têtes de colonnes s'en chargent, et deux commandes de tri concurrentes
   *  finiraient par se contredire à l'écran). */
  triable: boolean;
}) {
  const [openSort, setOpenSort] = useState(false);
  const refSort = useDismissOnOutside(openSort, setOpenSort);

  /* Les valeurs des filtres suivent le PÉRIMÈTRE : cocher un nom qui n'est pas dans son
     portefeuille ne ramènerait jamais rien (cf. ownerScope). */
  const perimetre = ownerScope(rows, cfg, ident);
  const facets = cfg.facets ?? [];
  const sel = local.facetSel ?? {};
  const setFacet = (alias: string, valeurs: string[]) =>
    setLocal({ ...local, facetSel: { ...sel, [alias]: valeurs } });

  /* Champs TRIABLES : tout sauf les textes longs (trier des notes de trois lignes par
     ordre alphabétique n'a aucun sens). */
  const triables = Object.keys(desc.fields).filter((a) => desc.fields[a].kind !== "longtext");
  const triCourant = local.sort ?? cfg.query.sort;
  const nomTri = triCourant.by ? desc.fields[triCourant.by]?.label ?? triCourant.by : "";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap", padding: "10px 16px", borderBottom: `1px solid ${T.line}` }}>
      {cfg.search !== false && (
        <label style={{ flex: "1 1 150px", minWidth: 0, display: "flex", alignItems: "center", gap: "7px", padding: "6px 10px", borderRadius: T.rSm, border: `1px solid ${T.line}`, background: T.surface2 }}>
          <Search aria-hidden style={{ width: 14, height: 14, color: T.ink4, flex: "none" }} />
          <input value={local.q ?? ""} onChange={(e) => setLocal({ ...local, q: e.target.value })}
            placeholder="Rechercher…" aria-label={`Rechercher dans ${cfg.title || desc.label}`}
            style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: "12.5px", fontWeight: 500, color: T.ink }} />
          {/* Effacer d'un geste : sans ce bouton, un terme oublié dans le champ donne un
              widget qui paraît vide et personne ne pense à regarder la recherche. */}
          {(local.q ?? "") !== "" && (
            <button onClick={() => setLocal({ ...local, q: "" })} aria-label="Effacer la recherche"
              style={{ display: "grid", placeItems: "center", flex: "none", width: 18, height: 18, borderRadius: 999, border: "none", background: "none", cursor: "pointer", color: T.ink4 }}>
              <X aria-hidden style={{ width: 13, height: 13 }} />
            </button>
          )}
        </label>
      )}

      {/* Un bouton par filtre déclaré, dans l'ordre du descripteur — cet ordre est celui de la
          page Softr pour les contacts (entreprise, service, type), et il se lit comme la
          question qu'on se pose : chez qui, à quel service, pour quel motif. */}
      {facets.map((a) => (
        <FacetFilter key={a} alias={a} desc={desc} rows={perimetre}
          cochees={sel[a] ?? []} onChange={(v) => setFacet(a, v)} />
      ))}

      {triable && triables.length > 0 && (
        <div ref={refSort} style={{ position: "relative", flex: "none" }}>
          <button style={local.sort ? TBTN_ON : TBTN} onClick={() => setOpenSort((o) => !o)}
            aria-haspopup="menu" aria-expanded={openSort} title={nomTri ? `Trié par ${nomTri}` : "Trier"}>
            {triCourant.dir === "asc"
              ? <ChevronUp aria-hidden style={{ width: 13, height: 13 }} />
              : <ChevronDown aria-hidden style={{ width: 13, height: 13 }} />}
            Trier
          </button>
          {openSort && (
            <div role="menu" style={TPANEL}>
              {triables.map((a) => {
                const actif = triCourant.by === a;
                return (
                  <button key={a} role="menuitem" className="slb-menu-item" style={{ ...TITEM, color: actif ? T.brand700 : T.ink2, fontWeight: actif ? 700 : 500 }}
                    onClick={() => {
                      // Recliquer le champ actif INVERSE le sens : un seul geste pour
                      // « de A à Z » puis « de Z à A », comme un en-tête de tableau.
                      const dir: "asc" | "desc" = actif && triCourant.dir === "asc" ? "desc" : "asc";
                      setLocal({ ...local, sort: { by: a, dir } });
                      setOpenSort(false);
                    }}>
                    <span style={{ flex: 1, minWidth: 0 }}>{desc.fields[a].label}</span>
                    {actif && (triCourant.dir === "asc"
                      ? <ChevronUp aria-hidden style={{ width: 13, height: 13 }} />
                      : <ChevronDown aria-hidden style={{ width: 13, height: 13 }} />)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* Ligne de liste — gabarit historique `NoteRow` : pastille d'initiales, titre et
   date alignés, détail clampé sur 2 lignes, badge coloré par le descripteur. */
function GenericRow({ row, map, desc, actions, api, onOpen }: {
  row: Row; map: FieldRoleMap; desc: SourceDesc; actions: ActionDesc[]; api: SourceApi;
  /** Ouvre la fiche détaillée. Absent = ligne non cliquable (aucune régression pour un
   *  usage qui n'en voudrait pas). */
  onOpen?: () => void;
}) {
  const title = map.title ? asText(row[map.title]) : "";
  const sub = map.sub ? asText(row[map.sub]) : "";
  const dateVal = map.date ? asText(row[map.date]) : "";
  const badge = map.badge ? asText(row[map.badge]) : "";
  const dateIsDate = map.date ? desc.fields[map.date]?.kind === "date" : false;
  const label = title || DASH;
  /* LIGNE CLIQUABLE = fiche détaillée. `role="button"` + `tabIndex` + Entrée/Espace :
     c'est un `<div>` et non un `<button>`, parce qu'un bouton ne peut pas contenir les
     boutons d'action de la ligne (HTML l'interdit, et le rendu casse). On reproduit donc
     à la main ce qu'un bouton donnerait gratuitement — sans quoi la fiche serait
     inaccessible au clavier.
     ⚠️ `stopPropagation` sur le conteneur des actions : cocher « Fait » ou cliquer
     « Détail » ne doit PAS ouvrir la fiche par-dessus. */
  const clic: CSSProperties | undefined = onOpen ? { cursor: "pointer" } : undefined;
  const clicProps = onOpen
    ? {
        role: "button" as const, tabIndex: 0,
        "aria-label": `Détail — ${label}`,
        onClick: onOpen,
        onKeyDown: (e: ReactKeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); }
        },
      }
    : {};
  return (
    <div className="slb-row" {...clicProps}
      style={{ display: "flex", alignItems: "flex-start", gap: "11px", padding: "10px 16px", ...clic }}>
      <Monogram name={label} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: "12.5px", fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
          {dateVal && (
            <span style={{ flex: "none", fontSize: "11px", fontWeight: 500, color: T.ink4 }} title={dateIsDate ? fmtDate(dateVal) : undefined}>
              {dateIsDate ? fmtSmart(dateVal) : dateVal}
            </span>
          )}
        </div>
        {(sub || badge) && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "3px", minWidth: 0 }}>
            {badge && <Badge variant={variantOf(desc, map.badge, badge)}>{badge}</Badge>}
            {sub && <span className="slb-clamp2" style={{ ...CLAMP2, flex: 1, minWidth: 0, fontSize: "12px", fontWeight: 500, lineHeight: 1.45, color: T.ink2 }}>{sub}</span>}
          </div>
        )}
      </div>
      {/* Les actions vivent DANS une ligne cliquable : leur clic ne doit pas remonter,
          sinon cocher « Fait » ouvrirait la fiche par-dessus. Le `<span>` intercepte au
          niveau du groupe, une fois, plutôt que dans chaque bouton de `RowActions`. */}
      {actions.length > 0 && (
        <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} style={{ flex: "none", display: "inline-flex" }}>
          <RowActions actions={actions} row={row} api={api} />
        </span>
      )}
    </div>
  );
}

/* Squelette de lignes (mêmes métriques que le gabarit) — pas de saut visuel quand les
   vraies lignes arrivent. `rows` : de quoi remplir un widget haut, où trois lignes
   flottantes au-dessus du vide font plus « cassé » que « en cours ». */
function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Chargement des lignes" style={{ padding: "4px 0" }}>
      {Array.from({ length: Math.max(1, rows) }, (_, k) => k).map((k) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: "11px", padding: "10px 16px" }}>
          <span className="slb-skel" style={{ width: 30, height: 30, borderRadius: 8, background: T.neutral050, flex: "none" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="slb-skel" style={{ height: 10, width: "62%", borderRadius: 6, background: T.neutral050 }} />
            <div className="slb-skel" style={{ height: 9, width: "38%", borderRadius: 6, background: T.neutral050, marginTop: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const ViewError = () => <EmptyState dense icon={XCircle} title="Données indisponibles" hint="La source n'a pas répondu. Réessayez plus tard." />;

/* Les trois vues partagent la MÊME signature (`DataView` les choisit dans une
   variable) : `onOpen` est donc déclaré sur les trois, même si l'indicateur l'ignore —
   une signature divergente casserait ce choix dynamique. */
type ViewProps = {
  rows: Row[]; cfg: InstanceCfg; desc: SourceDesc; api: SourceApi;
  onOpen?: (row: Row) => void;
  /** Identité de la session. Seule la vue KPI en a besoin : elle agrège les lignes
   *  BRUTES et doit donc appliquer elle-même le périmètre propriétaire. */
  ident?: UserIdent;
  /** Tri courant (cfg ou surcharge locale) + demande de tri depuis un en-tête de
   *  colonne. `onSort` absent = en-têtes non cliquables. */
  tri?: { by: string; dir: "asc" | "desc" };
  onSort?: (s: { by: string; dir: "asc" | "desc" }) => void;
};

function GenericList({ rows, cfg, desc, api, onOpen }: ViewProps) {
  if (api.error) return <ViewError />;
  if (api.loading) return <ListSkeleton />;
  if (!rows.length) return <EmptyState dense icon={Inbox} title={`Aucun ${cfg.unit}`} hint="Aucune ligne ne correspond à ce réglage." />;
  const map = cfg.view.kind === "list" ? cfg.view.map : {};
  const actions = activeActions(cfg, desc);
  return (
    <ScrollBody>
      {rows.map((r) => (
        <GenericRow key={r.id} row={r} map={map} desc={desc} actions={actions} api={api}
          onOpen={onOpen ? () => onOpen(r) : undefined} />
      ))}
    </ScrollBody>
  );
}

/* Tableau — colonnes déclarées dans la cfg. Mise en page en `table` HTML avec
   styles inline ; l'en-tête reste visible (`position: sticky`). */
function GenericTable({ rows, cfg, desc, api, onOpen, tri = cfg.query.sort, onSort }: ViewProps) {
  const maxHeight = useContext(WidgetHeightCtx);   // AVANT tout return : règles des hooks
  if (api.error) return <ViewError />;
  if (api.loading) return <ListSkeleton />;
  if (!rows.length) return <EmptyState dense icon={Inbox} title={`Aucun ${cfg.unit}`} hint="Aucune ligne ne correspond à ce réglage." />;
  const cols = cfg.view.kind === "table" ? cfg.view.columns : [];
  const actions = activeActions(cfg, desc);
  const th: CSSProperties = { position: "sticky", top: 0, zIndex: 1, background: T.surface2, textAlign: "left", padding: "8px 12px", fontSize: "11px", fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".04em", whiteSpace: "nowrap", borderBottom: `1px solid ${T.line}` };
  const td: CSSProperties = { padding: "9px 12px", fontSize: "12.5px", fontWeight: 500, color: T.ink2, borderBottom: `1px solid ${T.line}`, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
  return (
    <div className="slb-scrolly" style={{ overflow: "auto", maxHeight, scrollbarWidth: "thin" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          {/* EN-TÊTES CLIQUABLES = TRI (2026-08-06). Un clic trie de A à Z (ou du plus
              ancien au plus récent) ; recliquer la même colonne inverse le sens. Le tri
              est TYPÉ par la nature du champ (`compareRows`) : les dates se comparent en
              temps et les nombres en nombres, pas en chaînes — « 9 » ne passe donc pas
              après « 10 », et 02/2026 pas avant 12/2025.
              ⚠️ Le tri s'applique AVANT la limite (`applyQuery`), donc il porte sur toute
              la table lue et non sur les lignes déjà affichées. Trier après la limite
              n'aurait réordonné qu'un échantillon, en donnant l'illusion du contraire.
              `aria-sort` est posé : sans lui, un lecteur d'écran annonce une colonne
              cliquable sans jamais dire dans quel sens elle est triée. */}
          <tr>
            {cols.map((a) => {
              const actif = tri.by === a;
              const dirSuivante: "asc" | "desc" = actif && tri.dir === "asc" ? "desc" : "asc";
              return (
                <th key={a} style={onSort ? { ...th, cursor: "pointer", color: actif ? T.brand700 : T.ink3 } : th}
                  aria-sort={actif ? (tri.dir === "asc" ? "ascending" : "descending") : "none"}
                  {...(onSort ? {
                    role: "button" as const, tabIndex: 0,
                    title: `Trier par ${desc.fields[a]?.label ?? a}`,
                    onClick: () => onSort({ by: a, dir: dirSuivante }),
                    onKeyDown: (e: ReactKeyboardEvent) => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSort({ by: a, dir: dirSuivante }); }
                    },
                  } : {})}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    {desc.fields[a]?.label ?? a}
                    {actif && (tri.dir === "asc"
                      ? <ChevronUp aria-hidden style={{ width: 12, height: 12 }} />
                      : <ChevronDown aria-hidden style={{ width: 12, height: 12 }} />)}
                  </span>
                </th>
              );
            })}
            {actions.length > 0 && <th style={{ ...th, textAlign: "right" }} aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {/* Même geste qu'en vue liste : la LIGNE ouvre la fiche détaillée. Un `<tr>`
              ne peut pas être un `<button>` (le tableau ne se rendrait plus), d'où le
              `role="button"` et la gestion clavier à la main. La cellule d'actions
              arrête la propagation, sinon cocher une case ouvrirait la fiche. */}
          {rows.map((r) => (
            <tr key={r.id} className="slb-row"
              {...(onOpen ? {
                role: "button" as const, tabIndex: 0,
                onClick: () => onOpen(r),
                onKeyDown: (e: ReactKeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(r); }
                },
                style: { cursor: "pointer" },
              } : {})}>
              {cols.map((a) => <td key={a} style={td}><FieldValue row={r} alias={a} desc={desc} /></td>)}
              {actions.length > 0 && (
                <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}
                  onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  <RowActions actions={actions} row={r} api={api} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Indicateur — gros chiffre, écart avec la période précédente, jauge d'objectif. */
/* ⚠️ `onOpen` est ignoré ici, et volontairement : un indicateur n'affiche AUCUNE ligne
   (il agrège), donc il n'y a rien à ouvrir. Il est dans la signature commune pour que
   `DataView` puisse choisir la vue dans une variable. */
function GenericKpi({ rows, cfg, desc, api, ident }: ViewProps) {
  const v = cfg.view.kind === "kpi" ? cfg.view : null;
  const { value, delta } = kpiCompute(rows, cfg, ident);
  const legend = v?.agg === "sum" ? `Somme · ${desc.fields[v.field ?? ""]?.label ?? ""}`
    : v?.agg === "avg" ? `Moyenne · ${desc.fields[v.field ?? ""]?.label ?? ""}`
    : `${cfg.unit}${value > 1 ? "s" : ""}`;
  return (
    <div style={{ padding: "14px 16px 18px", display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
      {api.error ? (
        <span style={{ fontSize: "13px", fontWeight: 600, color: T.ink3 }}>Donnée indisponible</span>
      ) : api.loading ? (
        <span className="slb-skel" style={{ width: 84, height: 34, borderRadius: 8, background: T.neutral050 }} />
      ) : (
        <>
          <span style={{ fontSize: "34px", lineHeight: 1, fontWeight: 800, letterSpacing: "-.02em", color: T.ink }}>{value}</span>
          <span style={{ fontSize: "12.5px", fontWeight: 600, color: T.ink3 }}>{legend}</span>
          {delta !== null && (
            <>
              <Badge variant={delta > 0 ? "ok" : delta < 0 ? "danger" : "neutral"}
                icon={delta > 0 ? ChevronUp : delta < 0 ? ChevronDown : undefined}>
                {delta > 0 ? `+${delta}` : `${delta}`}
              </Badge>
              <span style={{ fontSize: "11.5px", fontWeight: 500, color: T.ink4 }}>vs période précédente</span>
            </>
          )}
          {/* Un indicateur EST une promesse de total : tant qu'il n'a pas tout lu, ou si
              sa lecture est tronquée, il doit le dire. Sans ça, le seul symptôme serait un
              chiffre trop bas — indétectable à l'œil. */}
          {(api.draining || api.partial) && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}>
              <Badge variant={api.draining ? "neutral" : "warn"} dot>
                {api.draining ? "Calcul en cours" : "Calcul partiel"}
              </Badge>
              <span style={{ fontSize: "11.5px", fontWeight: 500, color: T.ink4 }}>
                {api.draining ? "lecture du parc" : "lecture tronquée"}
              </span>
            </span>
          )}
        </>
      )}
    </div>
  );
}

/* --- Le widget complet. `key={cfg.source}` : changer de source REMONTE l'arbre,
   donc l'adapter (et ses hooks) est remplacé proprement. L'icône vient du
   descripteur de la source. --- */
/* --- PIED « OUVRIR DANS LE CRM » (2026-08-19) -------------------------------------------
   Posé sur tout widget `data` dont la source déclare une `listPage` (§6-bis). Ce n'est pas un
   ornement : une carte d'accueil montre au mieux 50 lignes d'une table qui peut en compter
   1 266, avec un seul filtre à cases. Sans ce lien, celui qui ne trouve pas sa ligne n'a aucun
   chemin vers l'écran complet — sinon deviner le menu du CRM.
   `target="_top"` : le bloc vit dans une iframe ; sans lui, le CRM s'ouvrirait DEDANS, dans un
   cadre de la taille du widget. Même règle que les Raccourcis (§7) et que la fiche détaillée.
   Un slug vide rend `pageUrl` = "" (§0-bis) : on n'affiche alors RIEN, plutôt qu'un bouton qui
   n'ouvre rien — la même règle que les tuiles Outils et que le pied du SAV. */
function ListPageFooter({ desc }: { desc: SourceDesc }) {
  const href = desc.listPage ? pageUrl(desc.listPage) : "";
  if (!href) return null;
  return (
    <a href={href} target="_top" className="slb-btng"
      style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: T.rSm, border: `1px solid ${T.line}`, background: T.surface, color: T.ink2, fontSize: "12.5px", fontWeight: 600, textDecoration: "none" }}>
      {/* Le même libellé que le bouton de la fiche : deux chemins vers la même page ne
          doivent pas la nommer autrement. Repli sur « dans le CRM » pour une source qui
          déclarerait une `listPage` sans `pageLabel`. */}
      {desc.pageLabel ? `Ouvrir ${desc.pageLabel}` : "Ouvrir dans le CRM"}
      <ChevronRight aria-hidden style={{ width: 14, height: 14 }} />
    </a>
  );
}

function DataView({ cfg }: { cfg: InstanceCfg }) {
  const desc = CATALOG[cfg.source];
  const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;
  /* Identité de la session — elle ne sert QU'au filtre « mes fiches » (`ownerField`).
     Lue ici et non dans les fonctions pures : celles-ci restent testables, et c'est le
     composant qui connaît la session (même découpage que `NotifsCard`, §9). */
  const ident = identOf(useCurrentUser());
  const mineAsked = !!cfg.mine && !!desc.ownerField;   // demandé dans la cfg
  const mineOn = mineAsked && ident.known;             // … et réellement applicable
  /* Ligne ouverte dans la pop-up de détail. L'état vit ICI et non dans les vues : une
     seule modale rendue, et elle survit au re-rendu de la liste (un rafraîchissement de
     la source ne referme donc pas la fiche qu'on est en train de lire).
     ⚠️ On garde la LIGNE et pas seulement son id : les lignes viennent d'une lecture
     déjà en mémoire, et rechercher l'id après coup ferait disparaître la fiche dès que
     la ligne sort du filtre (marquer « Fait » la retire de la liste, par exemple). */
  const [fiche, setFiche] = useState<Row | null>(null);
  /* Recherche, cases cochées et tri : ÉTAT LOCAL, jamais persisté (cf. `LocalRefine`).
     Une recherche enregistrée reviendrait au chargement suivant et donnerait un widget
     qui paraît vide sans raison visible — c'est le piège classique des filtres
     « collants ». Ici, recharger la page remet la liste à plat. */
  const [local, setLocal] = useState<LocalRefine>({});
  /* `drain` UNIQUEMENT en vue KPI. Une vue `list` ou `table` applique `applyQuery` puis
     une limite : elle décrit ce qu'elle montre, donc une page suffit. Une vue `kpi`
     compte / somme / moyenne sur TOUTES les lignes lues (cf. `rows` ci-dessous) : sans
     drainage elle annoncerait le total de la première page comme le total de la table. */
  const isKpiView = cfg.view.kind === "kpi";
  /* ⚠️⚠️ DRAINER DÈS QUE LA SÉLECTION RESTREINT (2026-08-18), et pas seulement en vue KPI.
     Une liste sans filtre décrit ce qu'elle montre — « les 12 derniers dossiers » — donc
     une page suffit. Dès qu'un filtre, un périmètre ou une clientèle entre en jeu, elle
     prétend montrer « les dossiers QUI remplissent un critère » : sur une seule page,
     elle ne cherche que parmi les plus récents et rate tout le reste, sans rien dire.
     C'est ce qui a motivé la règle : les deux files d'attente ajoutées ce jour-là portent
     des dossiers qui remontent à décembre, très loin au-delà de la première page — le
     widget en aurait affiché une poignée, l'air complet.
     Le « N sur M » du sous-titre a le même besoin : M doit compter la table, pas la page.
     Le coût (des dizaines de requêtes) est réel ; c'est le cache d'instantanés (§6-ter)
     qui le rend invisible au retour sur la page. */
  const restreint = cfg.query.filter.length > 0
    || (!!cfg.mine && !!desc.ownerField)
    || (!!cfg.clientele && cfg.clientele !== "tous");
  /* Et le cas où c'est la SOURCE qui l'exige, quel que soit le réglage du widget (`drain` du
     descripteur, §6-bis) : un annuaire de 1 266 lignes dont la recherche ne verrait que la
     première page répondrait « aucun contact » sans jamais dire qu'elle a cherché dans 2 % de
     la table. C'est le mensonge silencieux d'un total partiel, transposé à la RECHERCHE. */
  const litTout = !!desc.drain;
  return (
    <SourceFeed source={cfg.source} key={cfg.source} drain={isKpiView || restreint || litTout}>
      {(api) => {
        const isKpi = cfg.view.kind === "kpi";
        /* Les réglages locaux (recherche, cases, tri) passent DANS `applyQuery`, donc
           avant la limite : on cherche et on trie sur toute la table lue. */
        const rows = isKpi ? api.rows : applyQuery(api.rows, cfg, local, ident);
        /* Sous-titre : quand un outil restreint la liste, on annonce « N sur M ». Sans
           ce « sur M », une recherche qui ne rend rien ressemble à une source vide.
           ⚠️ `total` porte le MÊME périmètre propriétaire que `rows` : « 3 sur 12 » doit
           comparer ce qui est cherché à ce qui est visible, pas au fichier entier. */
        /* ⚠️ `selectRows` et non `applyQuery` : `applyQuery` applique la LIMITE, donc son
           compte était lui-même plafonné — « 3 sur 12 » comparait à la fenêtre et non à ce
           qui existe. `selectRows` rend tout ce qui passe les filtres et le périmètre. */
        const total = isKpi ? 0 : selectRows(api.rows, cfg, ident).length;
        /* On annonce « N sur M » aussi quand c'est la LIMITE qui coupe, et pas seulement
           une recherche : sinon une liste plafonnée à 20 sur 25 dossiers écrit « 20
           dossiers » et cache les cinq autres sans un mot. C'est exactement ce qui est
           arrivé aux deux files d'attente le 2026-08-18. */
        const filtreCoche = Object.values(local.facetSel ?? {}).some((v) => v.length > 0);
        const restreint = !isKpi && ((local.q ?? "") !== "" || filtreCoche || rows.length < total);
        /* Le sous-titre DIT que la liste est réduite à son portefeuille : sans ça, un
           widget qui montre 4 notes sur 300 se lit comme une source presque vide. */
        /* Le périmètre CLIENTÈLE s'annonce au même endroit et pour la même raison : « 4
           dossiers » sous un titre neutre ne dit pas qu'on n'en montre qu'une part. */
        const clienteleOn = clientFilterActive(cfg, api.rows);
        /* Le mot vient de `CLIENTELES` (`court`) et non d'un ternaire : à cinq périmètres,
           une condition écrite ici aurait dit « particuliers » d'un widget réglé sur Duo. */
        const perimetre = (mineOn ? " · mes fiches" : "")
          + (clienteleOn ? ` · ${clienteleCourt(cfg.clientele)}` : "");
        /* La barre de l'en-tête MONTRE qu'on lit ; ce suffixe le NOMME, et distingue les deux
           cas qui se ressemblent à l'écran : `draining` = il reste des pages, le compte va
           monter ; `partial` = la lecture s'est arrêtée au plafond, le compte est DÉFINITIVEMENT
           incomplet. Sans lui, « 50 sur 371 contacts » se lit comme un total dans les deux cas.
           Rien en vue KPI : elle porte déjà ses propres badges « Calcul en cours / partiel ». */
        /* `cached` passe DEVANT : une liste servie sans lecture doit dater ses lignes, sinon des
           contacts d'hier se lisent comme ceux de maintenant. C'est la contrepartie assumée du
           cache journalier (§6-quater) — on économise les requêtes, on n'économise pas l'aveu. */
        const etatLecture = isKpi ? ""
          : api.cached ? ` · données ${snapAge(api.at)}`
          : api.draining ? " · lecture en cours"
          : api.partial ? " · lecture tronquée" : "";
        const sub = api.loading ? "Chargement…"
          : isKpi ? (cfg.view.kind === "kpi" && cfg.view.compareDays ? `sur ${cfg.view.compareDays} j` : desc.label)
          : restreint ? `${rows.length} sur ${total} ${cfg.unit}${total > 1 ? "s" : ""}${perimetre}${etatLecture}`
          : plural(rows.length, cfg.unit) + perimetre + etatLecture;
        const V = cfg.view.kind === "table" ? GenericTable : isKpi ? GenericKpi : GenericList;
        /* Le mappage des rôles sert le TITRE et le badge de la fiche. En vue tableau il
           n'y en a pas (les colonnes sont libres) : on prend celui du descripteur. */
        const map: FieldRoleMap = cfg.view.kind === "list" ? cfg.view.map : desc.defaultMap ?? {};
        // La barre n'a de sens que sur une liste de lignes, et seulement si un outil est
        // offert. En KPI (aucune ligne affichée), jamais.
        const outils = !isKpi && (cfg.search !== false || (cfg.facets ?? []).length > 0);
        return (
          <>
            <Widget icon={iconOf(desc.icon)} title={cfg.title || desc.label} sub={sub}
              headActions={cfg.create && desc.create ? <QuickCreate desc={desc} api={api} /> : undefined}
              footer={desc.listPage ? <ListPageFooter desc={desc} /> : undefined}>
              {/* ⚠️ FILTRE DEMANDÉ MAIS INAPPLICABLE : on le DIT, au lieu de servir en
                  silence la liste de tout le monde sous un titre qui laisserait croire le
                  contraire. Même bandeau, même raison que dans le widget des notifications
                  (§9) — sans session identifiable, `ownerIsUser` écarterait TOUT. */}
              {mineAsked && !ident.known && (
                <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "10px 16px", borderBottom: `1px solid ${T.line}` }}>
                  <Badge variant="warn" dot>Filtre inactif</Badge>
                  <span style={{ fontSize: "11.5px", fontWeight: 500, color: T.ink3 }}>
                    Session non identifiée : toutes les fiches sont affichées.
                  </span>
                </div>
              )}
              {/* ⚠️ Clientèle demandée mais AUCUNE ligne classable : le champ « Champs IA
                  Config client » n'est pas exposé par la datasource (à cocher dans
                  l'onglet Sources du bloc). On le DIT — sans ce bandeau, le réglage
                  paraîtrait simplement ne rien faire, et on chercherait le défaut dans le
                  code plutôt que dans la configuration Softr. */}
              {/* ⚠️ `!api.loading && !api.error` : même piège que dans le widget des
                  notifications (§9) — `clientFilterActive` se déduit des lignes lues, donc
                  il est faux tant qu'il n'y en a aucune, et le bandeau s'affichait pendant
                  tout le chargement. Défaut présent depuis l'introduction du réglage le
                  2026-08-18, corrigé le 2026-08-20. */}
              {!!cfg.clientele && cfg.clientele !== "tous" && !api.loading && !api.error
                && !clientFilterActive(cfg, api.rows) && (
                <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "10px 16px", borderBottom: `1px solid ${T.line}` }}>
                  <Badge variant="warn" dot>Filtre inactif</Badge>
                  <span style={{ fontSize: "11.5px", fontWeight: 500, color: T.ink3 }}>
                    Type de client non lu par la source : tous les dossiers sont affichés.
                  </span>
                </div>
              )}
              {outils && !api.loading && !api.error && (
                <ListToolbar rows={api.rows} cfg={cfg} desc={desc} local={local} setLocal={setLocal}
                  triable={cfg.view.kind !== "table"} ident={ident} />
              )}
              <V rows={rows} cfg={cfg} desc={desc} api={api} onOpen={setFiche} ident={ident}
                tri={local.sort ?? cfg.query.sort}
                onSort={(s) => setLocal({ ...local, sort: s })} />
            </Widget>
            {/* ⚠️ LA MODALE EST FRÈRE DU WIDGET, PAS DANS SON CORPS. La raison a déjà
                mordu ailleurs dans ce fichier :
                · `position: fixed` se rattache au premier ancêtre TRANSFORMÉ. Le corps
                  reçoit un `transform` pendant les animations FLIP et les
                  redimensionnements (§11), donc la modale s'y accrocherait.
                ⚠️ On ne peut PAS faire mieux (un portail vers `document.body`) : seuls
                `react`, `lucide-react` et les trois modules Softr sont importables — pas
                `react-dom`. Rester frère du widget est donc le meilleur emplacement
                atteignable ; ne pas le « remonter » dans le corps. */}
            {fiche && <RecordDialog row={fiche} desc={desc} map={map} onClose={() => setFiche(null)} />}
          </>
        );
      }}
    </SourceFeed>
  );
}

/* ============================================================================
   9-ter. ACTIONS — écrire en base depuis un widget, déclarativement
   ----------------------------------------------------------------------------
   Une action est une DONNÉE du descripteur (`ActionDesc`) ; l'exécuteur est du
   code générique, écrit une fois. Trois formes : `set` (écrit des valeurs fixes),
   `toggle` (inverse un booléen), `link` (ouvre une URL interpolée depuis la ligne).

   ⚠️ SÉCURITÉ — à graver. Tout JSON côté client est falsifiable : le descripteur
   est de l'UX, JAMAIS un garde-fou. Les vraies barrières sont, dans l'ordre :
     1. la whitelist `SELECT_*_W` de l'adapter — un champ absent est physiquement
        inécrivable (Softr répond 400) ;
     2. la session obligatoire — `email` vide (aperçu « œil ») → aucune tentative ;
     3. les permissions de la datasource côté Softr ;
     4. `confirm` pour les gestes destructeurs.
   ============================================================================ */

/** Actions réellement activées sur cette instance (ids validés par `coerceCfg`). */
function activeActions(cfg: InstanceCfg, desc: SourceDesc): ActionDesc[] {
  const use = cfg.actions?.use ?? [];
  return (desc.actions ?? []).filter((a) => use.includes(a.id));
}

/** Interpole `{alias}` dans un gabarit d'URL depuis la ligne (`{id}` = recordId). */
const interpolate = (tpl: string, row: Row): string =>
  tpl.replace(/\{(\w+)\}/g, (_, k: string) => encodeURIComponent(k === "id" ? row.id : asText(row[k])));

/** Résout la valeur par défaut d'un champ de formulaire (`"@me.email"` → session). */
const resolveDefault = (v: unknown, email: string): unknown => (v === "@me.email" ? email : v);

/* --- Boutons d'action d'une ligne. L'exécution est OPTIMISTE localement : la
   ligne disparaît/le bouton se désactive le temps de l'écriture, puis la BDD
   redevient la source de vérité au prochain rafraîchissement. Un échec remonte
   un message court à côté du bouton (pas de toast global depuis une ligne). --- */
function RowActions({ actions, row, api }: { actions: ActionDesc[]; row: Row; api: SourceApi }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const run = async (a: ActionDesc) => {
    if (a.kind === "set" && a.confirm && confirming !== a.id) { setConfirming(a.id); return; }
    setConfirming(null);
    if (!api.write) { setFailed("Écriture indisponible"); return; }
    setBusy(a.id); setFailed(null);
    try {
      if (a.kind === "set") await api.write.update(row.id, a.set);
      else if (a.kind === "toggle") await api.write.update(row.id, { [a.field]: !isTruthy(row[a.field]) });
    } catch (e) {
      console.error("[SunLib] Action échouée :", e);
      setFailed(msgOf(e).slice(0, 60));
    } finally {
      setBusy(null);
    }
  };

  const btn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 9px", borderRadius: T.rSm, border: `1px solid ${T.line}`, background: T.surface, color: T.ink2, fontFamily: "inherit", fontSize: "11.5px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
  // `opacity:0` EN LIGNE et non dans la feuille (§2) : sinon, feuille absente dans le
  // bloc Softr, les actions de ligne resteraient visibles en permanence. C'est HoverFX
  // (§2-bis) qui les révèle au survol et à la tabulation.
  return (
    <span className="slb-hact" style={{ display: "inline-flex", alignItems: "center", gap: "6px", flex: "none", opacity: 0 }}>
      {failed && <span style={{ fontSize: "11px", fontWeight: 600, color: T.dangerInk }} title={failed}>Échec</span>}
      {actions.map((a) => {
        if (a.kind === "link") {
          return (
            <a key={a.id} href={interpolate(a.href, row)} target={a.target ?? "_blank"}
              rel={a.target === "_top" ? undefined : "noopener noreferrer"}
              className="slb-btng" style={{ ...btn, textDecoration: "none" }} aria-label={a.label}>
              {a.label}<ChevronRight aria-hidden style={{ width: 13, height: 13 }} />
            </a>
          );
        }
        const isConfirming = confirming === a.id;
        return (
          <button key={a.id} className="slb-btng" onClick={() => void run(a)} disabled={busy === a.id}
            aria-label={isConfirming ? `Confirmer — ${a.label}` : a.label}
            style={{ ...btn, ...(isConfirming ? { borderColor: T.danger, color: T.dangerInk, background: T.danger050 } : {}), opacity: busy === a.id ? 0.5 : 1 }}>
            {isConfirming ? "Confirmer ?" : a.label}
          </button>
        );
      })}
    </span>
  );
}

/* --- Création rapide : le « + » de l'en-tête ouvre le formulaire décrit par
   `desc.create`. Aucun champ n'est deviné : seuls ceux du descripteur sont
   proposés, et seuls ceux du `SELECT_*_W` de l'adapter partiront en base. --- */
function QuickCreate({ desc, api }: { desc: SourceDesc; api: SourceApi }) {
  const form = desc.create;
  const user = useCurrentUser();
  const email = asText(user?.email).trim().toLowerCase();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  if (!form) return null;

  const start = () => {
    const init: Record<string, unknown> = {};
    for (const f of form.fields) if (f.default !== undefined) init[f.field] = resolveDefault(f.default, email);
    setValues(init); setError(null); setOpen(true);
  };
  const missing = form.fields.filter((f) => f.required && !asText(values[f.field]).trim());
  const submit = async () => {
    if (missing.length || !api.write?.create) return;
    setBusy(true); setError(null);
    try { await api.write.create(values); setOpen(false); }
    catch (e) { console.error("[SunLib] Création échouée :", e); setError(msgOf(e)); }
    finally { setBusy(false); }
  };

  const field: CSSProperties = { width: "100%", boxSizing: "border-box", padding: "7px 9px", borderRadius: T.rSm, border: `1px solid ${T.line}`, background: T.surface, color: T.ink, fontFamily: "inherit", fontSize: "12.5px", fontWeight: 500 };
  const btn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: T.rSm, fontSize: "12.5px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${T.line}`, background: T.surface, color: T.ink2 };
  return (
    <div ref={ref} style={{ position: "relative", flex: "none" }}>
      <button className="slb-nbtn" style={NBTN_SM} onClick={() => (open ? setOpen(false) : start())}
        aria-haspopup="dialog" aria-expanded={open} aria-label={form.label} title={form.label}>
        <Plus aria-hidden style={{ width: 16, height: 16 }} />
      </button>
      {open && (
        <div role="dialog" aria-label={form.label}
          style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 30, width: 268, padding: "12px", backgroundColor: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rMd, boxShadow: T.shMd, animation: "slb-fade .12s ease both" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: T.ink, marginBottom: "8px" }}>{form.label}</div>
          {!api.write?.create && (
            <p style={{ margin: "0 0 8px", fontSize: "11.5px", fontWeight: 500, color: T.ink4 }}>
              Création indisponible : source non connectée, ou session absente (testez sur la page publiée).
            </p>
          )}
          {form.fields.map((f) => {
            const d = desc.fields[f.field];
            if (!d) return null;
            const val = asText(values[f.field]);
            return (
              <label key={f.field} style={{ display: "block", marginBottom: "8px" }}>
                <span style={{ display: "block", fontSize: "11px", fontWeight: 700, color: T.ink4, marginBottom: 3 }}>
                  {d.label}{f.required ? " *" : ""}
                </span>
                {d.options?.length ? (
                  <select style={field} value={val} onChange={(e) => setValues((v) => ({ ...v, [f.field]: e.target.value }))}>
                    <option value="">— choisir —</option>
                    {d.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input style={field} value={val} onChange={(e) => setValues((v) => ({ ...v, [f.field]: e.target.value }))} />
                )}
              </label>
            );
          })}
          {error && <p style={{ margin: "0 0 8px", fontSize: "11.5px", fontWeight: 500, color: T.dangerInk, wordBreak: "break-word" }}>{error}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
            <button className="slb-btng" style={btn} onClick={() => setOpen(false)}>Annuler</button>
            <button className="slb-btnp" style={{ ...btn, border: "none", background: T.brand, color: "#fff", opacity: missing.length || busy || !api.write?.create ? 0.5 : 1 }}
              disabled={!!missing.length || busy || !api.write?.create} onClick={() => void submit()}>
              <Plus aria-hidden style={{ width: 14, height: 14 }} />Créer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   9-quater. Le formulaire d'OPTIONS unique — généré par la grammaire
   ----------------------------------------------------------------------------
   Un seul formulaire pour toutes les instances `data`, entièrement alimenté par
   le descripteur : aucune connaissance d'un champ métier en dur.
   ============================================================================ */

/* Valeur d'un filtre : menu déroulant si le descripteur liste les valeurs
   possibles, saisie libre sinon (et numérique pour les opérateurs numériques). */
function FilterValueInput({ desc, field, op, value, onChange, style }: {
  desc: SourceDesc; field: string; op: FilterOp; value: string;
  onChange: (v: string) => void; style: CSSProperties;
}) {
  const options = desc.fields[field]?.options;
  const numeric = FILTER_OPS.find((o) => o.op === op)?.numeric;
  if (numeric || !options?.length) {
    return <input style={style} value={value} aria-label="Valeur du filtre" inputMode={numeric ? "numeric" : undefined}
      placeholder={op === "lastDays" ? "30" : numeric ? "0" : "valeur"} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <select style={style} value={value} aria-label="Valeur du filtre" onChange={(e) => onChange(e.target.value)}>
      <option value="">— choisir —</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function DataOptions({ cfg, onChange }: { cfg: InstanceCfg; onChange: (next: InstanceCfg) => void }) {
  const desc = CATALOG[cfg.source];
  const aliases = Object.keys(desc.fields);
  const dateAliases = aliases.filter((a) => desc.fields[a].kind === "date");
  const numAliases = aliases.filter((a) => desc.fields[a].kind === "number");
  const set = (patch: Partial<InstanceCfg>) => onChange(coerceCfg({ ...cfg, ...patch }, cfg));
  const setQuery = (patch: Partial<InstanceCfg["query"]>) => set({ query: { ...cfg.query, ...patch } });
  const setView = (patch: Record<string, unknown>) => set({ view: { ...cfg.view, ...patch } as ViewCfg });

  const lbl: CSSProperties = { display: "block", fontSize: "10.5px", fontWeight: 700, color: T.ink4, textTransform: "uppercase", letterSpacing: ".05em", margin: "10px 0 4px" };
  const field: CSSProperties = { width: "100%", boxSizing: "border-box", padding: "7px 9px", borderRadius: T.rSm, border: `1px solid ${T.line}`, background: T.surface, color: T.ink, fontFamily: "inherit", fontSize: "12.5px", fontWeight: 500 };
  const seg = (active: boolean): CSSProperties => ({ flex: 1, padding: "6px 4px", borderRadius: T.rSm, border: `1px solid ${active ? T.brand : T.line}`, background: active ? T.brand050 : T.surface, color: active ? T.brand700 : T.ink2, fontFamily: "inherit", fontSize: "12px", fontWeight: 700, cursor: "pointer" });
  const fieldSelect = (value: string, onPick: (v: string) => void, label: string, allowNone = true, list = aliases) => (
    <select style={{ ...field, flex: 1 }} value={value} aria-label={label} onChange={(e) => onPick(e.target.value)}>
      {allowNone && <option value="">— aucun —</option>}
      {list.map((a) => <option key={a} value={a}>{desc.fields[a].label}</option>)}
    </select>
  );
  const roleRow = (role: keyof FieldRoleMap, label: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
      <span style={{ flex: "none", width: 62, fontSize: "12px", fontWeight: 600, color: T.ink3 }}>{label}</span>
      {fieldSelect(cfg.view.kind === "list" ? cfg.view.map[role] ?? "" : "",
        (v) => setView({ map: { ...(cfg.view.kind === "list" ? cfg.view.map : {}), [role]: v } }), `Champ affiché — ${label}`)}
    </div>
  );

  return (
    <div>
      {/* PAS de champ « Titre » ici depuis le 2026-08-04 : il est monté d'un étage, dans
          l'en-tête du panneau ⋮, où il vaut pour TOUS les types de widget. En laisser un
          second ici aurait donné deux saisies pour un même affichage, dont une seule
          gagne — la pire des ambiguïtés. `cfg.title` existe toujours : c'est le titre
          que POSE un preset (« SAV — priorité élevée »), donc le titre par défaut, et
          celui que montre le placeholder du champ commun. */}
      <label style={lbl} htmlFor="slb-opt-src">Source de données</label>
      <select id="slb-opt-src" style={field} value={cfg.source}
        onChange={(e) => set({ source: e.target.value as SourceKey })}>
        {(Object.keys(CATALOG) as SourceKey[]).map((k) => (
          <option key={k} value={k}>{CATALOG[k].label}{CATALOG[k].connected ? "" : " (non connectée)"}</option>
        ))}
      </select>
      {!desc.connected && (
        <p style={{ margin: "6px 0 0", fontSize: "11.5px", fontWeight: 500, color: T.ink4 }}>
          Source pas encore branchée : données d'exemple en aperçu, vide en production.
        </p>
      )}

      {/* ⚠️ PLUS DE CHOIX « Liste / Tableau / Indicateur » (retiré le 2026-08-06, demandé).
          La FORME d'un widget est décidée à la POSE, par le modèle choisi dans la galerie
          (« Tableau des dossiers », « Dossiers incomplets »…), et elle ne bouge
          plus ensuite : un indicateur reste un indicateur, une liste reste une liste.
          Raison de fond : la vue n'est pas un réglage de confort, c'est ce QU'EST le
          widget. La basculer changeait tout son sens — un indicateur devenu liste perdait
          son agrégat et son écart de période, une liste devenue indicateur affichait un
          chiffre que personne n'avait demandé. Pour une autre forme, on pose un autre
          widget depuis la galerie ; c'est un geste, et il est réversible.
          ⚠️ `coerceCfg` continue de LIRE `view.kind` depuis la cfg enregistrée : c'est
          indispensable pour les instances déjà posées. Seule l'entrée par l'UI disparaît.
          Le bloc ci-dessous ne montre donc plus que les réglages de la vue COURANTE. */}
      {cfg.view.kind === "list" && (
        <>
          <div style={lbl}>Champs affichés</div>
          {roleRow("title", "Titre")}
          {roleRow("sub", "Détail")}
          {roleRow("date", "Date")}
          {roleRow("badge", "Statut")}
        </>
      )}

      {cfg.view.kind === "table" && (
        <>
          <div style={lbl}>Colonnes (max {TABLE_COLS_MAX})</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {aliases.map((a) => {
              const cols = cfg.view.kind === "table" ? cfg.view.columns : [];
              const on = cols.includes(a);
              const full = cols.length >= TABLE_COLS_MAX && !on;
              return (
                <button key={a} aria-pressed={on} disabled={full}
                  onClick={() => setView({ columns: on ? cols.filter((c) => c !== a) : [...cols, a] })}
                  style={{ ...seg(on), flex: "none", padding: "5px 9px", fontSize: "11.5px", opacity: full ? 0.45 : 1, cursor: full ? "not-allowed" : "pointer" }}>
                  {desc.fields[a].label}
                </button>
              );
            })}
          </div>
          <p style={{ margin: "6px 0 0", fontSize: "11.5px", fontWeight: 500, color: T.ink4 }}>
            L'ordre de sélection est l'ordre des colonnes.
          </p>
        </>
      )}

      {cfg.view.kind === "kpi" && (
        <>
          <div style={lbl}>Calcul</div>
          <div style={{ display: "flex", gap: "6px" }}>
            {(["count", "sum", "avg"] as const).map((a) => (
              <button key={a} style={seg(cfg.view.kind === "kpi" && cfg.view.agg === a)} onClick={() => setView({ agg: a })}
                aria-pressed={cfg.view.kind === "kpi" && cfg.view.agg === a}
                disabled={a !== "count" && numAliases.length === 0}>
                {a === "count" ? "Nombre" : a === "sum" ? "Somme" : "Moyenne"}
              </button>
            ))}
          </div>
          {cfg.view.kind === "kpi" && cfg.view.agg !== "count" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
              <span style={{ flex: "none", width: 62, fontSize: "12px", fontWeight: 600, color: T.ink3 }}>Champ</span>
              {fieldSelect(cfg.view.field ?? "", (v) => setView({ field: v }), "Champ agrégé", true, numAliases)}
            </div>
          )}
          <div style={lbl}>Comparaison dans le temps</div>
          {dateAliases.length === 0 ? (
            <p style={{ margin: 0, fontSize: "11.5px", fontWeight: 500, color: T.ink4 }}>Cette source n'a aucun champ date : écart indisponible.</p>
          ) : (
            <div style={{ display: "flex", gap: "8px" }}>
              {fieldSelect(cfg.view.kind === "kpi" ? cfg.view.dateField ?? "" : "", (v) => setView({ dateField: v }), "Champ date de comparaison", true, dateAliases)}
              <input type="number" min={0} max={KPI_DAYS_MAX} style={{ ...field, width: 92 }} aria-label="Fenêtre en jours"
                value={cfg.view.kind === "kpi" ? cfg.view.compareDays ?? 0 : 0}
                disabled={cfg.view.kind === "kpi" && !cfg.view.dateField}
                onChange={(e) => setView({ compareDays: Number(e.target.value) })} />
            </div>
          )}
          <p style={{ margin: "6px 0 0", fontSize: "11.5px", fontWeight: 500, color: T.ink4 }}>
            Avec une fenêtre, le chiffre porte sur les N derniers jours et l'écart compare à la période précédente. Le calcul porte sur les lignes chargées.
          </p>
        </>
      )}

      {/* PÉRIMÈTRE — au-dessus des filtres, et séparé d'eux : ce n'est pas un critère de
          consultation mais la réponse à « de qui parle ce widget ». Proposé seulement si
          la source déclare qui est propriétaire (`ownerField`, §6-bis) ; ailleurs, la
          case n'aurait rien sur quoi mordre. */}
      {desc.ownerField && (
        <>
          <div style={lbl}>Périmètre</div>
          <label style={{ display: "flex", alignItems: "center", gap: "9px", padding: "6px 4px", cursor: "pointer", fontSize: "12.5px", fontWeight: 500, color: T.ink2 }}>
            <input type="checkbox" style={{ width: 15, height: 15, accentColor: T.brand, flex: "none", cursor: "pointer" }}
              checked={cfg.mine !== false} onChange={(e) => set({ mine: e.target.checked })} />
            <span>Seulement les fiches dont je suis {desc.fields[desc.ownerField]?.label ?? "propriétaire"}</span>
          </label>
          <p style={{ margin: "2px 0 0", fontSize: "11.5px", fontWeight: 500, color: T.ink4 }}>
            Le rapprochement se fait sur le NOM (ces champs ne portent pas d'e-mail) :
            décochez si votre nom est écrit autrement en base, ou si vous suivez le
            portefeuille de plusieurs personnes.
          </p>
        </>
      )}

      {/* CLIENTÈLE — même famille que « mes fiches » : un PÉRIMÈTRE, pas un critère de
          consultation. Sous le même intertitre quand les deux existent. Un `<select>` et
          non des cases : les cinq états sont EXCLUSIFS, et des cases laisseraient poser
          « ni pro ni particulier », qui ne veut rien dire. */}
      {desc.clientField && (
        <>
          {!desc.ownerField && <div style={lbl}>Périmètre</div>}
          <select value={cfg.clientele ?? "tous"} onChange={(e) => set({ clientele: e.target.value as Clientele })}
            style={{ ...field, marginTop: desc.ownerField ? 8 : 0 }}>
            {CLIENTELES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <p style={{ margin: "2px 0 0", fontSize: "11.5px", fontWeight: 500, color: T.ink4 }}>
            La base classe chaque dossier en « Pro » (pas de civilité), « Solo » (Monsieur ou
            Madame) ou « Duo » (deux titulaires). « Particuliers » regroupe Solo et Duo ; les
            deux dernières entrées permettent de n'en garder qu'une des deux.
          </p>
        </>
      )}

      <div style={lbl}>Filtres (tous doivent être vrais)</div>
      {cfg.query.filter.map((f, i) => {
        const opDef = FILTER_OPS.find((o) => o.op === f.op);
        const replace = (next: Partial<Filter>) =>
          setQuery({ filter: cfg.query.filter.map((x, j) => (j === i ? { ...x, ...next } : x)) });
        return (
          <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "6px" }}>
            {fieldSelect(f.field, (v) => replace({ field: v }), "Champ filtré", false)}
            <select style={{ ...field, flex: 1 }} value={f.op} aria-label="Opérateur"
              onChange={(e) => replace({ op: e.target.value as FilterOp })}>
              {FILTER_OPS.map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
            </select>
            {opDef?.needsValue && (
              <FilterValueInput desc={desc} field={f.field} op={f.op} value={f.value ?? ""}
                onChange={(v) => replace({ value: v })} style={{ ...field, width: 116 }} />
            )}
            <button className="slb-nbtn" style={{ ...NBTN_SM, width: 28, height: 28 }} aria-label="Retirer ce filtre"
              onClick={() => setQuery({ filter: cfg.query.filter.filter((_, j) => j !== i) })}>
              <X aria-hidden style={{ width: 14, height: 14 }} />
            </button>
          </div>
        );
      })}
      <button className="slb-btng" onClick={() => setQuery({ filter: [...cfg.query.filter, { field: aliases[0], op: "eq", value: "" }] })}
        style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 10px", borderRadius: T.rSm, border: `1px solid ${T.line}`, background: T.surface, color: T.ink2, fontFamily: "inherit", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
        <Plus aria-hidden style={{ width: 14, height: 14 }} />Ajouter un filtre
      </button>

      {cfg.view.kind !== "kpi" && (
        <>
          <label style={lbl} htmlFor="slb-opt-sort">Tri</label>
          <div style={{ display: "flex", gap: "8px" }}>
            {fieldSelect(cfg.query.sort.by, (v) => setQuery({ sort: { ...cfg.query.sort, by: v } }), "Champ de tri", false)}
            <select style={{ ...field, width: 116 }} value={cfg.query.sort.dir} aria-label="Sens du tri"
              onChange={(e) => setQuery({ sort: { ...cfg.query.sort, dir: e.target.value as "asc" | "desc" } })}>
              <option value="desc">Décroissant</option>
              <option value="asc">Croissant</option>
            </select>
          </div>

          <label style={lbl} htmlFor="slb-opt-limit">Nombre de lignes (1 – {LIST_LIMIT_MAX})</label>
          <input id="slb-opt-limit" type="number" min={1} max={LIST_LIMIT_MAX} style={field} value={cfg.query.limit}
            onChange={(e) => setQuery({ limit: Number(e.target.value) })} />
        </>
      )}

      {/* --- Barre d'outils de consultation. Absente en vue KPI : un indicateur
          n'affiche aucune ligne, donc il n'y a rien à chercher ni à filtrer. --- */}
      {cfg.view.kind !== "kpi" && (
        <>
          <div style={lbl}>Consultation</div>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "5px", fontSize: "12.5px", fontWeight: 500, color: T.ink2 }}>
            <input type="checkbox" checked={cfg.search !== false} onChange={(e) => set({ search: e.target.checked })} />
            Barre de recherche
          </label>
          <span style={lbl}>Filtres rapides (cases à cocher)</span>
          {/* Les VALEURS d'un filtre viennent des DONNÉES, pas d'ici : on ne choisit que les
              CHAMPS. Un menu déroulant jusqu'au 2026-08-19, donc UN seul filtre possible ; ce
              sont des cases depuis qu'on peut en poser trois. Les longs textes sont exclus —
              filtrer par note entière n'a aucun sens.
              Au-delà de `FACETS_MAX`, les cases non cochées se DÉSACTIVENT au lieu de refuser
              le clic en silence, et la limite est écrite juste en dessous. */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 14px", marginTop: "5px" }}>
            {Object.keys(desc.fields)
              .filter((a) => desc.fields[a].kind !== "longtext")
              .map((a) => {
                const on = (cfg.facets ?? []).includes(a);
                const plein = !on && (cfg.facets ?? []).length >= FACETS_MAX;
                return (
                  <label key={a} style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "12.5px", fontWeight: 500, color: plein ? T.ink4 : T.ink2 }}>
                    <input type="checkbox" checked={on} disabled={plein}
                      onChange={(e) => {
                        const reste = (cfg.facets ?? []).filter((x) => x !== a);
                        set({ facets: e.target.checked ? [...reste, a].slice(0, FACETS_MAX) : reste });
                      }} />
                    {desc.fields[a].label}
                  </label>
                );
              })}
          </div>
          <p style={{ margin: "6px 0 0", fontSize: "11.5px", fontWeight: 500, color: T.ink4 }}>
            {FACETS_MAX} filtres au maximum. Un champ dont toutes les lignes portent la même
            valeur n'affiche pas de bouton : il ne filtrerait rien.
          </p>
        </>
      )}

      {(desc.actions?.length || desc.create) && <div style={lbl}>Actions</div>}
      {(desc.actions ?? []).map((a) => {
        const on = (cfg.actions?.use ?? []).includes(a.id);
        const writes = a.kind !== "link";
        return (
          <label key={a.id} style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "5px", fontSize: "12.5px", fontWeight: 500, color: T.ink2 }}>
            <input type="checkbox" checked={on} onChange={(e) => {
              const use = new Set(cfg.actions?.use ?? []);
              if (e.target.checked) use.add(a.id); else use.delete(a.id);
              set({ actions: { use: [...use] } });
            }} />
            {a.label}
            {writes && <span style={{ fontSize: "11px", fontWeight: 600, color: T.ink4 }}>écrit en base</span>}
          </label>
        );
      })}
      {desc.create && (
        <label style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "5px", fontSize: "12.5px", fontWeight: 500, color: T.ink2 }}>
          <input type="checkbox" checked={!!cfg.create} onChange={(e) => set({ create: e.target.checked })} />
          Bouton « + » : {desc.create.label}
        </label>
      )}
    </div>
  );
}

/* ============================================================================
   10. ARCHITECTURE DES WIDGETS — autonomie, registre des TYPES
   ----------------------------------------------------------------------------
   Chaque widget est AUTONOME : il embarque sa source et ses états (chargement /
   vide / erreur, scroll interne). La grille ne connaît que des INSTANCES
   ordonnées (§10-bis) — elle rend `WIDGET_REGISTRY[instance.type].Render` en lui
   passant l'id et la cfg de l'instance.

   Deux familles de types cohabitent, et c'est volontaire :
   · les types SUR-MESURE (« …Card » ci-dessous) — interactions propres (marquer
     comme lu, onglets, embeds) ; ils ignorent la cfg ;
   · les types LISTE, qui n'ont aucun code dédié : ce sont des `ListView` (§9-bis)
     configurés par leur cfg, et ce sont eux qui ont un ⋮ « Options ».
   Ajouter un widget liste = 1 entrée de registre (`listType(...)`), zéro composant.
   ============================================================================ */

// Nb de lignes récentes affichées par widget liste (« Abonnés » ~1700 lignes).
const RECENT = 12;

/* --- Enveloppes autonomes (une par widget) ------------------------------------
   Elles ne lisent plus une table : elles consomment une SOURCE via `<SourceFeed>`
   (§6-bis), qui se charge du dispatch statique mock ↔ live. Une source non
   connectée sert son mock (aperçu) ou une liste vide (live) — l'état vide guidant
   du présentiel s'affiche alors. Les mappers sont les mêmes dans les deux cas,
   puisque les lignes ont la même forme (alias du SELECT_*). --- */
/* UNE SEULE SOURCE depuis la refonte du 2026-08-06 : « Notification Center ». Tant
   qu'une source n'est pas connectée, `SourceFeed` sert son mock (§6-bis) : le marquage
   reste testable en aperçu — l'écriture y est simulée et tracée en console.

   `notifC` EST drainée, et ce n'est pas pour agréger : le FILTRE (propriétaire non
   vide) et le REGROUPEMENT des jumelles doivent porter sur toute la table, pas sur sa
   première page. Sur 2 142 lignes dont ~385 sans lien vers un abonné, une seule page
   pourrait ne contenir presque que des lignes écartées — le widget paraîtrait vide
   alors que la table est pleine. `partial` dit ce qui manque si la pagination casse.
   ⚠️ Les filtres restent CÔTÉ CODE et non côté requête : l'API ne sait filtrer ni sur
   « lookup non vide » ni sur « ce lookup ressemble au nom de la session ». Un filtre
   serveur approximatif serait pire qu'un filtre explicite ici, où l'on peut aussi
   COMPTER ce qu'il écarte et le dire à l'écran.

   ⚠️ `useCurrentUser()` est appelé ICI et non dans `NotifWidget` : le hook doit vivre
   au-dessus du `SourceFeed`, dont l'enfant est une FONCTION de rendu — un hook appelé
   dedans dépendrait de l'adapter monté (mock ou live), donc de l'ordre des hooks.
   C'est la même précaution que celle prise dans les adapters écrivables (§6-bis). */
function NotifsCard({ cfg }: { cfg: NotifsCfg }) {
  const ident = identOf(useCurrentUser());
  /* Le widget écrit sa PROPRE cfg pour la bascule « voir toutes les notifications » —
     canal prévu pour ça (`WidgetCfgCtx`, §8). D'où l'`onVoirTout` optionnel plutôt
     qu'un état local :
     le choix est PERSISTÉ, sinon le filtre reviendrait au rechargement et l'utilisateur
     rejouerait le même geste chaque matin. */
  const writer = useContext(WidgetCfgCtx);
  return (
    <SourceFeed source="notifC" drain>
      {(nc) => {
        /* 4e argument : « seulement ce qui n'est pas encore traité ». Il suit `marquage` —
           l'option qui active l'état « Non lu » et le bouton « Vu ». Cohérent dans les
           deux sens : qui gère une file veut voir ce qui reste à faire ; qui décoche
           l'option ne gère plus de file, et revoit alors tout l'historique. */
        /* 5e argument : le PÉRIMÈTRE CLIENTÈLE (2026-08-20). Il se combine par un ET avec
           « mes dossiers » — « mes nouveaux dossiers pro » est la lecture visée. */
        const tri = selectNotifs(nc.rows.map(mapNotifC), ident, cfg.mesDossiers, cfg.marquage, cfg.clientele);
        return (
          <NotifWidget cfg={cfg} notifs={nc} tri={tri} ident={ident}
            clientLu={clientLisible(nc.rows)}
            onVoirTout={writer ? () => writer.save({ ...cfg, mesDossiers: false }) : undefined}
            onTousClients={writer ? () => writer.save({ ...cfg, clientele: "tous" }) : undefined} />
        );
      }}
    </SourceFeed>
  );
}

/* Tâches — widget à DEUX sources : il monte simplement deux adapters côte à côte
   (imbriqués), ce que le dispatch statique autorise sans rien assouplir. */
/* `drain` sur les DEUX sources : les pastilles des onglets sont des compteurs, donc des
   agrégats — sans drainage elles décriraient la première page. Le tri `fin` asc reste
   utile pour autre chose : il garantit que les lignes AFFICHÉES (tronquées à RECENT)
   sont les plus urgentes, et non un échantillon arbitraire du total. */
function TachesCard() {
  /* ⚠️ `useCurrentUser()` est appelé ICI, au-dessus des `SourceFeed` : leurs enfants
     sont des FONCTIONS de rendu, et un hook appelé dedans dépendrait de l'adapter
     monté (mock ou live). Même précaution que dans `NotifsCard`. */
  const ident = identOf(useCurrentUser());
  /* DEUX PASSES, dans cet ordre :
       1. « Fait » décoché — un journal liste ce qui reste à faire ;
       2. ASSIGNÉ À MOI (2026-08-07, demandé) — le rapprochement passe par
          `ownerIsUser` (§5), donc par les MOTS DU NOM : ces champs « Assignee » sont
          du texte libre et ne portent aucun e-mail.
     ⚠️ La passe 2 est SAUTÉE si la session n'est pas identifiable, et le widget le DIT
     (bandeau « Filtre inactif ») : sans nom ni e-mail, elle viderait le journal sans
     que personne puisse comprendre pourquoi. */
  const mienne = (r: Row) => !ident.known || ownerIsUser(asText(r.assignee), ident);
  const openRows = (rows: Row[]) => rows.filter((r) => !isDone(r) && mienne(r));
  /* Clôture d'une tâche : `true` si l'écriture est passée, `false` sinon — le
     présentiel s'en sert pour annuler sa disparition optimiste. Le champ écrit est le
     seul que la whitelist autorise (`SELECT_TACHE_*_W` = « Fait »). */
  const clore = (api: SourceApi) => async (id: string): Promise<boolean> => {
    if (!api.write) return false;
    try { await api.write.update(id, { fait: true }); return true; } catch { return false; }
  };
  return (
    <SourceFeed source="tachesPa" drain>
      {(pa) => (
        <SourceFeed source="tachesPr" drain>
          {(pr) => {
            const oPr = openRows(pr.rows);
            const oPa = openRows(pa.rows);
            const closPr = clore(pr), closPa = clore(pa);
            return (
              <TasksWidget
                prospects={oPr.slice(0, RECENT).map(mapTask)}
                partenaires={oPa.slice(0, RECENT).map(mapTask)}
                totalProspects={oPr.length}
                totalPartenaires={oPa.length}
                mineAsked identifiee={ident.known}
                /* Les DEUX sources comptent : un onglet peut être prêt quand l'autre lit
                   encore, et les pastilles des deux onglets sont visibles en même temps. */
                loading={pa.loading || pr.loading}
                /* ⚠️ `faisable` est déclaré PAR ONGLET, et ce n'est pas du zèle : les deux
                   onglets lisent deux tables différentes, dont une seule peut être
                   écrivable (source non connectée, session absente). Un seul booléen
                   global aurait affiché le bouton sur l'onglet muet — clic, disparition,
                   puis message d'échec. */
                onFait={(scope, id) => (scope === "prospects" ? closPr(id) : closPa(id))}
                faisable={{ prospects: !!pr.write, partenaires: !!pa.write }}
                partial={!!pr.partial || !!pa.partial} />
            );
          }}
        </SourceFeed>
      )}
    </SourceFeed>
  );
}

/* ============================================================================
   SAV — SYNTHÈSE DU BLOC « PILOTAGE SAV »
   ----------------------------------------------------------------------------
   Ce widget est un RÉSUMÉ, pas un second tableau de bord. Le bloc SUNLIB/SAV
   affiche six KPI, trois onglets, deux modales et les classements complets
   (fabricants, installateurs, qualité par installateur, tiers mandatés). Tout
   remonter ici produirait un widget illisible de 340 px et deux écrans à tenir
   synchronisés. On garde donc ce qui APPELLE UNE ACTION depuis l'accueil :

     · les dossiers OUVERTS — la « métrique reine » du bloc SAV (son README §2) ;
     · ce qui déborde : priorité élevée, dossiers ouverts trop vieux ;
     · trois mesures de fond : taux de résolution, ancienneté moyenne, coût tiers ;
     · les trois premières CAUSES (l'onglet « Problématiques » en montre douze) ;
     · le compte des dossiers à corriger, qui renvoie au bloc SAV pour la saisie.

   Restent délibérément dans le bloc SAV : le registre, le détail par dossier, les
   12 catégories complètes, les classements partenaires, les KPI du parc.

   ⚠️ LES SEUILS ET LES FORMULES SONT RECOPIÉS DU BLOC SAV (`useKpis`), pas
   réinventés : mêmes statuts « clos », même définition de l'ancienneté. Deux écrans qui
   comptent différemment le même chiffre sont pires qu'un écran en moins. Si `useKpis`
   change là-bas, ces constantes changent ici.

   ÉCART ASSUMÉ, parce que l'accueil parle d'ACTION : la qualité des données compte les
   DOSSIERS à corriger, là où le bloc SAV compte les anomalies — un dossier peut en
   porter trois. D'où le libellé « dossiers », pour que l'écart se lise au lieu de
   surprendre.

   NB : l'alerte « priorité élevée » a été retirée du registre le 2026-08-04. Le calcul
   `prioHaute` reste ci-dessous, sur les dossiers OUVERTS (un dossier clos en priorité 9
   n'appelle plus rien) : il ne coûte rien, et il est prêt si la métrique revient. Le
   preset de galerie « Dossiers SAV prioritaires », lui, filtre toujours sur la priorité.
   ============================================================================ */

/* Les 12 catégories d'intervention, dans l'ordre FIGÉ du classeur partenaire.
   ⚠️ Les lignes sont PLATES ici (clés = alias, §6-bis) alors que le bloc SAV les
   structure sous un sous-objet `cat` : d'où `r[c.key]` et non `r.cat[c.key]`. */
const SAV_CATS: { key: string; label: string }[] = [
  { key: "panneaux", label: "Panneaux" },
  { key: "onduleurs", label: "Onduleurs / MO" },
  { key: "protection", label: "Protection électrique" },
  { key: "cablage", label: "Câblage" },
  { key: "supervision", label: "Supervision" },
  { key: "raccordement", label: "Raccordement" },
  { key: "consuel", label: "Consuel" },
  { key: "batterie", label: "Batterie virtuelle" },
  { key: "alerte", label: "Alerte" },
  { key: "fuite", label: "Fuite" },
  { key: "calepinage", label: "Calepinage" },
  { key: "autre", label: "Autre" },
];
const SAV_CLOSED = ["Résolu", "Clos"];   // = CLOSED du bloc SAV
const SAV_PRIO_HAUTE = 8;                // = priority(), p >= 8 → « Élevée »
const SAV_VIEUX_J = 60;                  // = seuil du badge d'ancienneté du bloc SAV
const SAV_CAUSES_TOP = 3;                // « lecture des trois premières causes »
// La page « Pilotage SAV » de l'espace : son slug vit en §0-bis, comme toutes les
// adresses. Résolu au rendu (cf. `pageUrl`), pas ici.

const savNum = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const savTotal = (r: Row): number => SAV_CATS.reduce((s, c) => s + savNum(r[c.key]), 0);
/** Horodatage d'une valeur de date, ou NaN si elle est illisible.
 *  ⚠️ LE `instanceof Date` N'EST PAS DÉFENSIF, il est nécessaire : `asText` passe
 *  par `labelOf`, qui traite tout objet en cherchant .name/.label/.value/… — un
 *  `Date` n'en a aucun, donc `asText(new Date())` vaut la CHAÎNE VIDE. Sans ce
 *  premier test, comparer une date à « maintenant » donnait NaN, `savDays`
 *  renvoyait null pour tous les dossiers, et les deux indicateurs d'ancienneté
 *  affichaient 0 sans jamais signaler d'erreur. Le passage par `asText` reste
 *  indispensable pour l'autre cas : Softr peut renvoyer un select sous forme
 *  d'objet `{ id, name }`. */
const savTime = (v: unknown): number => {
  if (v instanceof Date) return v.getTime();
  const s = asText(v);
  return s ? new Date(s).getTime() : NaN;
};
/** Écart en jours, ou `null` si l'une des deux dates est illisible — le registre
 *  repris du classeur en porte (§ anomalies). Jamais de NaN à l'écran. */
const savDays = (from: unknown, to: unknown): number | null => {
  const a = savTime(from), b = savTime(to);
  return isNaN(a) || isNaN(b) ? null : Math.round((b - a) / 86400000);
};
const savAvg = (a: number[]): number => (a.length ? a.reduce((s, n) => s + n, 0) / a.length : 0);
const fmtEur = (n: number): string => `${Math.round(n).toLocaleString("fr-FR")} €`;

/** PURE, et volontairement PAS un hook : `rows` est un tableau neuf à chaque
 *  render (flattenRows), donc un useMemo se recalculerait à chaque fois tout en
 *  donnant l'illusion du contraire — la remarque est la même que dans le bloc SAV
 *  (`useParcKpis`). Ce qui reste est du comptage O(n) sur quelques dizaines de
 *  lignes. Bénéfice secondaire : une fonction pure se relit et se teste seule. */
function savKpis(rows: Row[]) {
  const now = new Date();
  const open = rows.filter((r) => !SAV_CLOSED.includes(asText(r.statut)));
  const resolus = rows.filter((r) => asText(r.statut) === "Résolu");
  const ages = open
    .map((r) => savDays(r.debut, now))
    .filter((n): n is number => n != null && n >= 0);

  const causes = SAV_CATS
    .map((c) => ({ ...c, value: rows.reduce((s, r) => s + savNum(r[c.key]), 0) }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  /* Contrôles de cohérence — les cinq du bloc SAV, comptés par DOSSIER. */
  const aCorriger = rows.filter((r) => {
    const d = savDays(r.debut, r.fin);
    return (!!asText(r.fin) && (d == null || d < 0))     // fin antérieure au début
      || !asText(r.installateur)                        // installateur non renseigné
      || !asText(r.fabricant)                           // fabricant non renseigné
      || (!!asText(r.tiers) && !savNum(r.cout))         // tiers mandaté sans coût
      || savTotal(r) === 0;                             // aucune intervention saisie
  }).length;

  /* Détails de second plan — ils ne valent QUE comme sous-texte d'une valeur
     principale (« 76 % · 6 dossiers sans fabricant »), jamais seuls. C'est ce qui
     distingue une tuile d'un chiffre nu : le sous-texte dit d'où sort le pourcentage,
     donc ce qu'il faut corriger pour le faire monter. */
  const fabricantConnu = rows.filter((r) => !!asText(r.fabricant)).length;
  const clientConnu = rows.filter((r) => !!asText(r.client)).length;
  const avecTiers = rows.filter((r) => !!asText(r.tiers)).length;
  const tiersSansCout = rows.filter((r) => !!asText(r.tiers) && !savNum(r.cout)).length;

  return {
    dossiers: rows.length,
    ouverts: open.length,
    clos: rows.length - open.length,
    resolus: resolus.length,
    interventions: rows.reduce((s, r) => s + savTotal(r), 0),
    taux: rows.length ? resolus.length / rows.length : 0,
    prioHaute: open.filter((r) => savNum(r.priorite) >= SAV_PRIO_HAUTE).length,
    vieux: ages.filter((n) => n > SAV_VIEUX_J).length,
    ancienneteMoy: savAvg(ages),
    /* Le PLUS ancien des ouverts. `0` quand il n'y a aucun ouvert : `Math.max()` sans
       argument renvoie -Infinity, qui s'afficherait tel quel. */
    ancienneteMax: ages.length ? Math.max(...ages) : 0,
    coutTiers: rows.reduce((s, r) => s + savNum(r.cout), 0),
    causes: causes.slice(0, SAV_CAUSES_TOP),
    causeMax: causes[0]?.value ?? 0,
    aCorriger,
    fabricantConnu,
    partFabricant: rows.length ? fabricantConnu / rows.length : 0,
    clientConnu,
    partClient: rows.length ? clientConnu / rows.length : 0,
    avecTiers,
    tiersSansCout,
  };
}

/* ── REGISTRE DES MÉTRIQUES — ce que l'utilisateur peut cocher ────────────────
   Même principe que `CATALOG` pour les sources et `PRESETS` pour la galerie : de la
   DONNÉE, pas du code de rendu. Ajouter une valeur au widget = ajouter UNE entrée
   ici, et elle apparaît aussitôt dans le panneau « Options » de tout le monde.
   `savKpis` calcule déjà tout : une métrique ne fait que choisir et formater.

   `kind` décide de la FORME, et donc de la section où la métrique atterrit :
     · hero  → le grand chiffre, en tête (une seule attendue)
     · stat  → une ligne « libellé … valeur », valeur alignée à droite (charte)
     · alert → un badge, affiché SEULEMENT si `count` > 0 (le rouge ne s'affiche
               jamais sur une valeur saine) ; `text` en donne le libellé
     · block → une section à forme propre, rendue en dur par sa clé (les barres de
               causes, la ligne de qualité). C'est la seule famille non générique :
               un bloc a une mise en page que trois champs ne décrivent pas.

   ⚠️ Les CLÉS sont un contrat de persistance au même titre que les clés de type :
   elles sont stockées dans `cfg.show` du layout de chaque utilisateur. On peut
   renommer un `label` librement, jamais une `key`.

   L'ORDRE d'affichage est celui de ce tableau, pas celui de `cfg.show` — un
   utilisateur choisit QUOI voir, la charte décide de l'ordre. Si un jour tu veux
   aussi laisser réordonner, `cfg.show` est déjà une liste ordonnée : il suffira de
   l'itérer au lieu du registre, et d'ajouter deux flèches au panneau. */
type SavKpis = ReturnType<typeof savKpis>;

/** Les champs utiles dépendent du `kind` (cf. ci-dessus) : `value` pour hero/stat,
 *  `count` + `text` pour alert, aucun pour block. */
type SavMetric = {
  key: string;
  label: string;                       // libellé du panneau ET de la ligne
  kind: "hero" | "stat" | "alert" | "block";
  value?: (k: SavKpis) => string;
  count?: (k: SavKpis) => number;
  text?: (n: number) => string;
  icon?: LucideIcon;
  /** Détail sous la valeur, en vue TUILES seulement — la vue en lignes n'a pas la
   *  place, et l'y répéter ferait du bruit. Chaîne vide = pas de détail affiché.
   *  C'est ce sous-texte qui fait la différence entre un chiffre nu et une mesure :
   *  il dit d'où sort la valeur, donc ce qu'il faudrait corriger pour la faire bouger. */
  sub?: (k: SavKpis) => string;
  /** Part de 0 à 1 → barre de progression sous la valeur. Réservée aux métriques qui
   *  SONT une proportion : une barre sur un montant ou un nombre de jours ne voudrait
   *  rien dire, rien ne disant de quoi ce serait la fraction. */
  bar?: (k: SavKpis) => number;
  /** Le sous-texte énonce-t-il un MANQUE ? Il passe alors en ambre — une saisie à
   *  compléter, jamais en rouge, qui est réservé aux pannes (charte). La couleur ne
   *  porte rien seule : le texte dit déjà ce qui manque. */
  warnSub?: (k: SavKpis) => boolean;
};

const SAV_METRICS: SavMetric[] = [
  { key: "ouverts", label: "Dossiers ouverts", kind: "hero", icon: Ticket,
    value: (k) => `${k.ouverts}`,
    sub: (k) => `sur ${k.dossiers} dossier${k.dossiers > 1 ? "s" : ""} suivi${k.dossiers > 1 ? "s" : ""}` },
  /* ⚠️ Plus d'alerte « priorité élevée » — RETIRÉE du registre le 2026-08-04, sur
     demande. Elle ne peut donc plus être cochée, et `coerceSavCfg` écarte sa clé des
     `cfg.show` déjà enregistrées : elle disparaît aussi des widgets qui l'affichaient.
     La remettre = ré-ajouter cette entrée ici (le seuil vit dans le bloc SAV,
     `priority()`, p >= 8) ; les utilisateurs qui l'avaient cochée la retrouveraient,
     puisque le stockage n'a jamais été « réparé ». */
  /* ⚠️ Plus d'alerte « ouverts > 60 j » non plus — RETIRÉE le 2026-08-07, sur demande :
     un bandeau en tête de widget qui annonce « 3 ouverts > 60 j » n'appelle aucun geste
     depuis l'accueil (le dossier se traite dans le bloc SAV), et il occupait la première
     ligne, juste sous le grand chiffre. Même sort que « priorité élevée » ci-dessus, et
     par le même chemin : l'entrée quitte le registre, `coerceSavCfg` écarte alors sa clé
     des `cfg.show` déjà enregistrées, et elle disparaît des widgets qui l'affichaient.
     Le CALCUL reste (`savKpis().vieux`, seuil `SAV_VIEUX_J`) : remettre l'alerte ne
     demande que de ré-ajouter les deux lignes supprimées ici, et ceux qui l'avaient
     cochée la retrouveraient — le document n'est jamais « réparé ».
     ⚠️ Il n'y a donc PLUS AUCUNE métrique `kind: "alert"` déclarée. Son rendu (§ `picked`)
     est conservé : c'est une famille du registre, pas du code sur-mesure, et la prochaine
     alerte n'aura qu'à se déclarer. */
  { key: "dossiers", label: "Dossiers au total", kind: "stat", icon: ClipboardList,
    value: (k) => `${k.dossiers}`,
    sub: (k) => `${k.ouverts} ouvert${k.ouverts > 1 ? "s" : ""} · ${k.clos} clos ou résolu${k.clos > 1 ? "s" : ""}` },
  { key: "taux", label: "Taux de résolution", kind: "stat", icon: CheckCircle,
    value: (k) => `${Math.round(k.taux * 100)} %`,
    sub: (k) => `${k.resolus} dossier${k.resolus > 1 ? "s" : ""} au statut « Résolu »`,
    bar: (k) => k.taux },
  { key: "ancienneteMoy", label: "Ancienneté moyenne des ouverts", kind: "stat", icon: Clock,
    value: (k) => (k.ouverts ? `${Math.round(k.ancienneteMoy)} j` : DASH),
    sub: (k) => (k.ouverts ? `le plus ancien : ${Math.round(k.ancienneteMax)} j` : "aucun dossier ouvert") },
  { key: "interventions", label: "Interventions cumulées", kind: "stat", icon: HardHat,
    value: (k) => `${k.interventions}`,
    sub: (k) => (k.dossiers ? `${(k.interventions / k.dossiers).toFixed(1).replace(".", ",")} par dossier en moyenne` : "") },
  { key: "coutTiers", label: "Coût tiers SAV", kind: "stat", icon: Building2,
    value: (k) => fmtEur(k.coutTiers),
    /* Le sous-texte NOMME le trou de saisie quand il existe : un coût cumulé est
       sous-évalué de tout ce qui n'a pas été rapproché, et l'afficher sans le dire
       laisserait croire à un total. */
    sub: (k) => (k.tiersSansCout
      ? `${k.avecTiers} avec tiers · ${k.tiersSansCout} sans coût rapproché`
      : `${k.avecTiers} dossier${k.avecTiers > 1 ? "s" : ""} avec tiers mandaté`),
    warnSub: (k) => k.tiersSansCout > 0 },
  /* Les deux métriques de QUALITÉ DE LA DONNÉE, ajoutées le 2026-08-04 sur le modèle
     du tableau de bord du bloc SAV (« matériel documenté », « dossiers rapprochés »).
     ⚠️ Elles mesurent ce que CE bloc peut voir — le remplissage des champs de la table
     « Tickets » — et NON le parc de centrales : le taux de matériel identifié du bloc
     SAV, lui, vient du parsing des descriptifs d'installation, hors de portée ici (voir
     la note d'en-tête de SavWidget). Les libellés le disent, pour qu'on ne lise pas un
     chiffre pour un autre. */
  { key: "fabricantConnu", label: "Fabricant identifié", kind: "stat", icon: Building2,
    value: (k) => `${Math.round(k.partFabricant * 100)} %`,
    sub: (k) => {
      const manque = k.dossiers - k.fabricantConnu;
      return manque ? `${manque} dossier${manque > 1 ? "s" : ""} sans fabricant renseigné` : "tous les dossiers renseignés";
    },
    bar: (k) => k.partFabricant,
    warnSub: (k) => k.fabricantConnu < k.dossiers },
  { key: "clientConnu", label: "Client rattaché", kind: "stat", icon: Users,
    value: (k) => `${k.clientConnu}`,
    sub: (k) => `sur ${k.dossiers} dossier${k.dossiers > 1 ? "s" : ""} — ${Math.round(k.partClient * 100)} % nommés`,
    bar: (k) => k.partClient,
    warnSub: (k) => k.clientConnu < k.dossiers },
  { key: "causes", label: `Principales causes (${SAV_CAUSES_TOP})`, kind: "block" },
  { key: "qualite", label: "Qualité des données", kind: "block" },
];

/* Sélection livrée par défaut = exactement ce que le widget affichait avant d'être
   configurable. Une instance déjà posée (cfg `{}`) ne change donc pas d'apparence.
   ⚠️ Les deux métriques de qualité n'y sont PAS : elles s'ajoutent d'un clic, mais
   les ajouter d'office changerait ce que voient les utilisateurs qui ont déjà réglé
   leur widget. */
const SAV_SHOW_DEFAULT = ["ouverts", "taux", "ancienneteMoy", "interventions", "coutTiers", "causes", "qualite"];

/** `layout` : deux présentations des MÊMES valeurs. Les LIGNES sont denses, lisibles
 *  dans une colonne étroite ; les TUILES reprennent la lecture d'un coup d'œil du
 *  tableau de bord du bloc SAV (grande valeur, détail dessous, barre pour les taux).
 *  Le choix vit dans la cfg, donc PAR INSTANCE : deux synthèses SAV peuvent coexister
 *  avec deux présentations, et le réglage voyage avec la disposition. */
type SavCfg = { show: string[]; layout: "tuiles" | "lignes" };

/** cfg stockée (BRUTE) → cfg utilisable. Ne throw JAMAIS, comme `coerceCfg`.
 *  Deux cas volontairement distincts, sur le modèle du mappage des widgets `data` :
 *  · `show` ABSENT → sélection par défaut (cas d'une instance posée avant que ce
 *    widget devienne configurable, dont la cfg vaut `{}`) ;
 *  · `show` PRÉSENT même vide → choix EXPLICITE respecté, y compris « rien ».
 *  Les clés inconnues du registre sont écartées à la lecture mais restent dans le
 *  stockage (on ne « répare » jamais le document) : retirer une métrique puis la
 *  remettre plus tard rend son affichage aux utilisateurs qui l'avaient cochée. */
function coerceSavCfg(raw: unknown): SavCfg {
  const o = asObj(raw);
  const known = new Set(SAV_METRICS.map((m) => m.key));
  /* TUILES par défaut (2026-08-04) : c'est la présentation demandée, et « lignes »
     reste à un clic dans les Options. Conséquence assumée — une instance déjà posée,
     dont la cfg ne porte pas `layout`, CHANGE d'apparence au prochain affichage ;
     ses valeurs, elles, sont exactement les mêmes. */
  const layout: SavCfg["layout"] = o.layout === "lignes" ? "lignes" : "tuiles";
  if (!Array.isArray(o.show)) return { show: [...SAV_SHOW_DEFAULT], layout };
  const show = o.show.filter((x: unknown): x is string => typeof x === "string" && known.has(x));
  return { show: Array.from(new Set(show)), layout };
}

/* Panneau « Options » du widget — une case par métrique du registre. Aucun champ
   n'est écrit en dur : ajouter une entrée au registre suffit à la voir ici. */
function SavOptions({ cfg, onChange }: { cfg: SavCfg; onChange: (next: SavCfg) => void }) {
  const on = new Set(cfg.show);
  const toggle = (key: string) => {
    const next = new Set(on);
    if (next.has(key)) next.delete(key); else next.add(key);
    // Réordonné selon le registre : `show` reste lisible et l'ordre d'affichage
    // ne dépend jamais de l'ordre des clics.
    onChange({ ...cfg, show: SAV_METRICS.filter((m) => next.has(m.key)).map((m) => m.key) });
  };
  const lbl: CSSProperties = { display: "block", fontSize: "10.5px", fontWeight: 700, color: T.ink4, textTransform: "uppercase", letterSpacing: ".05em", margin: "2px 0 6px" };
  const line: CSSProperties = { display: "flex", alignItems: "center", gap: "9px", padding: "6px 4px", cursor: "pointer", fontSize: "12.5px", fontWeight: 500, color: T.ink2 };
  const seg = (active: boolean): CSSProperties => ({ flex: 1, padding: "6px 4px", borderRadius: T.rSm, border: `1px solid ${active ? T.brand : T.line}`, background: active ? T.brand050 : T.surface, color: active ? T.brand700 : T.ink2, fontFamily: "inherit", fontSize: "12px", fontWeight: 700, cursor: "pointer" });
  return (
    <div>
      <span style={lbl}>Présentation</span>
      <div style={{ display: "flex", gap: "6px", marginBottom: "4px" }}>
        <button style={seg(cfg.layout === "tuiles")} onClick={() => onChange({ ...cfg, layout: "tuiles" })}
          aria-pressed={cfg.layout === "tuiles"}>Tuiles</button>
        <button style={seg(cfg.layout === "lignes")} onClick={() => onChange({ ...cfg, layout: "lignes" })}
          aria-pressed={cfg.layout === "lignes"}>Lignes</button>
      </div>
      <span style={{ ...lbl, marginTop: "10px" }}>Valeurs affichées</span>
      {SAV_METRICS.map((m) => (
        <label key={m.key} style={line}>
          <input type="checkbox" checked={on.has(m.key)} onChange={() => toggle(m.key)}
            style={{ width: 15, height: 15, accentColor: T.brand, flex: "none", cursor: "pointer" }} />
          <span>{m.label}</span>
        </label>
      ))}
      {!cfg.show.length && (
        <p style={{ margin: "8px 0 0", fontSize: "12px", fontWeight: 500, color: T.ink4 }}>
          Aucune valeur cochée : le widget restera vide.
        </p>
      )}
    </div>
  );
}

/* ============================================================================
   TUILES D'INDICATEURS — un rendu, plusieurs widgets
   ----------------------------------------------------------------------------
   Le dessin des cartes du tableau de bord SAV : carte blanche à coins arrondis et
   ombre douce posée sur un fond teinté, libellé en petites capitales, grande valeur,
   barre pour les proportions, détail dessous. Extrait de `SavWidget` le 2026-08-04
   quand un second widget en a eu besoin — deux copies auraient dérivé dès la première
   retouche de charte.

   Le composant reçoit des VALEURS DÉJÀ CALCULÉES (`Tile`), jamais des fonctions ni un
   objet de KPI : c'est ce qui le rend indifférent à la source. Chaque widget garde donc
   son propre registre de métriques et ne partage que la mise en page.
   ============================================================================ */
type Tile = {
  key: string;
  label: string;
  icon?: LucideIcon;
  value: string;
  /** Détail sous la valeur. Il dit d'où sort le chiffre, donc ce qui le ferait bouger. */
  sub?: string;
  /** Le détail énonce-t-il un MANQUE ? Il passe alors en ambre — jamais en rouge, qui
   *  reste aux pannes, et le texte nomme déjà ce qui manque (la couleur ne porte rien
   *  seule). */
  warn?: boolean;
  /** Part de 0 à 1 → barre de progression. Réservée à ce qui EST une proportion. */
  bar?: number;
};

function KpiTiles({ tiles, zone }: { tiles: Tile[]; zone: string }) {
  return (
    /* `auto-fill` + `minmax` : le nombre de colonnes suit la largeur RÉELLE du widget,
       sans media query ni mesure JS — une tuile par ligne en demi-largeur, quatre ou
       cinq de front en pleine largeur. */
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(182px, 1fr))", gap: "14px", padding: "14px 16px 16px", background: zone }}>
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          /* `slb-unit` : frontière de rabattement du corps scrollable (cf. `snapHeight`,
             §8). Les tuiles d'une même rangée ont la même hauteur — la grille étire ses
             items —, donc la frontière d'une tuile est celle de toute sa rangée. */
          <div key={t.key} className="slb-unit" style={{ padding: "15px 17px 16px", borderRadius: T.rLg, background: T.surface, border: `1px solid ${T.line}`, boxShadow: T.shSm }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0 }}>
              {Icon && <Icon aria-hidden style={{ width: 14, height: 14, color: T.ink4, flex: "none" }} strokeWidth={1.7} />}
              {/* Libellé tronqué sur UNE ligne : deux lignes de titre désaligneraient les
                  valeurs d'une tuile à l'autre. */}
              <span style={{ minWidth: 0, fontSize: "11px", fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".055em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.label}
              </span>
            </div>
            <div style={{ marginTop: 10, fontSize: "clamp(26px, 3.4vw, 34px)", lineHeight: 1.02, fontWeight: 800, letterSpacing: "-.025em", color: T.ink, fontVariantNumeric: "tabular-nums" }}>
              {t.value}
            </div>
            {t.bar != null && (
              <span aria-hidden style={{ display: "block", height: 7, marginTop: 11, borderRadius: 999, background: T.neutral050, overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${Math.round(Math.max(0, Math.min(1, t.bar)) * 100)}%`, background: T.ok, borderRadius: 999 }} />
              </span>
            )}
            {t.sub && (
              <div style={{ marginTop: t.bar != null ? 8 : 9, fontSize: "12px", fontWeight: 500, color: t.warn ? T.warnInk : T.ink3, lineHeight: 1.4 }}>
                {t.sub}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* Présentiel pur : reçoit un SourceApi et la cfg de l'instance. Ne connaît ni Softr
   ni le catalogue. Le rendu est PILOTÉ PAR LA CFG — plus une section en dur. */
function SavWidget({ api, cfg }: { api: SourceApi; cfg: SavCfg }) {
  const k = savKpis(api.rows);
  /* Fond de la zone de tuiles : gris quand la carte est blanche, TEINTE quand elle est
     colorée. Poser le gris par-dessus un pastel y ferait une bande morte au milieu de
     la carte ; les tuiles, elles, restent blanches et ressortent des deux façons. */
  const zone = tintOf(useContext(WidgetTintCtx)).head || T.surface2;
  const on = new Set(cfg.show);
  const picked = (kind: SavMetric["kind"]) => SAV_METRICS.filter((m) => m.kind === kind && on.has(m.key));
  const hero = picked("hero");
  /* En TUILES, la métrique reine rejoint la rangée et n'y est PAS distinguée : sur le
     tableau de bord SAV, les cartes sont toutes dessinées pareil et c'est l'ordre qui
     donne le rang. En LIGNES elle garde son grand chiffre au-dessus, sans quoi la vue
     perdrait sa tête. */
  const tiles = cfg.layout === "tuiles" ? [...hero, ...picked("stat")] : picked("stat");
  const stats = tiles;
  // Une alerte n'occupe la place que si elle a quelque chose à dire (count > 0).
  const alerts = picked("alert").filter((m) => (m.count?.(k) ?? 0) > 0);
  const row: CSSProperties = { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", padding: "9px 16px" };
  const lbl: CSSProperties = { fontSize: "12.5px", fontWeight: 500, color: T.ink3 };
  // Charte : les valeurs chiffrées s'alignent à DROITE, les libellés à gauche.
  const val: CSSProperties = { fontSize: "13px", fontWeight: 700, color: T.ink, fontVariantNumeric: "tabular-nums" };
  const secLbl: CSSProperties = { padding: "11px 16px 4px", fontSize: "10.5px", fontWeight: 700, color: T.ink4, textTransform: "uppercase", letterSpacing: ".05em" };

  /* Le pied ne s'affiche que si l'adresse existe : un bouton « Ouvrir » qui n'ouvre
     rien vaut moins que pas de bouton (même règle que les tuiles Outils). */
  const savHref = pageUrl(PAGES.sav);
  const footer = savHref ? (
    <a href={savHref} target="_top" className="slb-btng"
      style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 13px", borderRadius: T.rSm, border: `1px solid ${T.line}`, background: T.surface, color: T.ink2, fontSize: "12.5px", fontWeight: 600, textDecoration: "none" }}>
      Ouvrir le pilotage SAV<ChevronRight aria-hidden style={{ width: 14, height: 14 }} />
    </a>
  ) : undefined;

  return (
    <Widget icon={Ticket} title="Pilotage SAV" sub={api.loading ? "Chargement…" : "Synthèse des dossiers"} footer={footer}>
      {api.error ? (
        <EmptyState icon={Ticket} dense title="Donnée indisponible" hint="La source « Tickets » n'a pas répondu. Le pilotage SAV reste accessible dans sa page." />
      ) : api.loading ? (
        <div style={{ padding: "16px" }}>
          <span className="slb-skel" style={{ display: "block", width: 96, height: 34, borderRadius: 8, background: T.neutral050 }} />
        </div>
      ) : !k.dossiers ? (
        /* Cas RÉEL en production tant que « Tickets » n'est pas connectée à CE bloc
           (cf. la note sur SavSource) : mieux vaut le dire que montrer six zéros,
           qui se liraient comme « aucun dossier SAV ». */
        <EmptyState icon={Ticket} dense title="Aucun dossier SAV lu"
          hint="Source « Tickets » non connectée à ce bloc, ou table vide." />
      ) : !cfg.show.length ? (
        /* Tout décoché : c'est un choix explicite (cf. `coerceSavCfg`), on le
           respecte au lieu de réimposer les défauts — mais on dit où revenir. */
        <EmptyState icon={Ticket} dense title="Aucune valeur affichée"
          hint="Choisissez ce que ce widget doit montrer dans son menu ⋮ « Options »." />
      ) : (
        <ScrollBody>
          {/* 1 — la métrique reine, et ce qui déborde. Le bloc n'existe que si l'une
              des deux familles est retenue. Les alertes sont déjà filtrées sur
              count > 0 : le rouge ne s'affiche jamais sur une valeur saine (charte),
              et le libellé dit le sens — la couleur ne le porte pas seule. */}
          {((cfg.layout === "lignes" && hero.length > 0) || alerts.length > 0) && (
            <div style={{ padding: "14px 16px 12px", display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
              {cfg.layout === "lignes" && hero.map((m) => (
                <Fragment key={m.key}>
                  <span style={{ fontSize: "34px", lineHeight: 1, fontWeight: 800, letterSpacing: "-.02em", color: T.ink }}>{m.value?.(k)}</span>
                  <span style={{ fontSize: "12.5px", fontWeight: 600, color: T.ink3 }}>
                    dossier{k.ouverts > 1 ? "s" : ""} ouvert{k.ouverts > 1 ? "s" : ""}
                  </span>
                </Fragment>
              ))}
              {alerts.map((m) => {
                const n = m.count?.(k) ?? 0;
                return <Badge key={m.key} variant="danger" dot={!m.icon} icon={m.icon}>{m.text?.(n)}</Badge>;
              })}
            </div>
          )}

          {/* 2 — mesures de fond, entièrement générées depuis le registre. DEUX
              présentations pour les mêmes valeurs (cf. `SavCfg.layout`) : des tuiles
              qui se lisent d'un coup d'œil, ou des lignes denses. */}
          {stats.length > 0 && (cfg.layout === "tuiles" ? (
            /* Le registre porte des FONCTIONS, `KpiTiles` attend des VALEURS : la
               conversion tient ici, une ligne par champ. C'est ce qui permet au même
               rendu de servir deux widgets dont les sources n'ont rien en commun. */
            <KpiTiles zone={zone} tiles={stats.map((m) => ({
              key: m.key, label: m.label, icon: m.icon,
              value: m.value?.(k) ?? "",
              sub: m.sub?.(k),
              warn: !!m.warnSub?.(k),
              bar: m.bar?.(k),
            }))} />
          ) : (
            <div>
              {stats.map((m) => (
                <div key={m.key} className="slb-unit" style={row}>
                  <span style={lbl}>{m.label}</span>
                  <span style={val}>{m.value?.(k)}</span>
                </div>
              ))}
            </div>
          ))}

          {/* 3 — les premières causes. Barres en <div> : aucune librairie de graphes
              n'est autorisée dans le bloc (même contrainte que le bloc SAV). */}
          {on.has("causes") && (
            <div className="slb-unit" style={{ paddingBottom: "8px" }}>
              <div style={secLbl}>Principales causes</div>
              {k.causes.length ? k.causes.map((c) => (
                <div key={c.key} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "5px 16px" }}>
                  <span style={{ flex: "1 1 96px", minWidth: 0, fontSize: "12.5px", fontWeight: 500, color: T.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</span>
                  <span aria-hidden style={{ flex: "1 1 60px", height: 6, borderRadius: 999, background: T.neutral050, overflow: "hidden" }}>
                    <span style={{ display: "block", height: "100%", width: `${k.causeMax ? Math.round((c.value / k.causeMax) * 100) : 0}%`, background: T.brand, borderRadius: 999 }} />
                  </span>
                  <span style={{ ...val, flex: "none", minWidth: 22, textAlign: "right" }}>{c.value}</span>
                </div>
              )) : (
                <div style={{ padding: "2px 16px 6px", fontSize: "12.5px", fontWeight: 500, color: T.ink4 }}>Aucune intervention saisie.</div>
              )}
            </div>
          )}

          {/* 4 — qualité des données. Ambre et non rouge : c'est une saisie à
              compléter, pas une panne. Section muette quand tout est propre. */}
          {on.has("qualite") && k.aCorriger > 0 && (
            <div className="slb-unit" style={{ display: "flex", alignItems: "center", gap: "9px", padding: "11px 16px" }}>
              <Badge variant="warn" dot>{k.aCorriger}</Badge>
              <span style={{ fontSize: "12.5px", fontWeight: 500, color: T.ink2 }}>
                dossier{k.aCorriger > 1 ? "s" : ""} à corriger — dates, installateur, fabricant ou coût tiers
              </span>
            </div>
          )}

          {/* 5 — LECTURE INCOMPLÈTE : jamais silencieuse, même règle que les widgets de
              Performance. Un « dossiers ouverts » calculé sur une partie de la table n'a
              pas l'air faux — c'est exactement pour ça qu'il faut le dire. */}
          <AggregateNote api={api} style={{ padding: "11px 16px 14px" }} />
        </ScrollBody>
      )}
    </Widget>
  );
}

/* Enveloppe : même forme que NotifsCard / TachesCard — elle ne fait que brancher
   la source. Tant que « Tickets » n'est pas connectée à CE bloc, SourceFeed sert
   automatiquement le mock (§6-bis, OfflineSource) : le widget est donc testable
   en aperçu et n'attend rien pour vivre. */
function SavCard({ cfg }: { cfg: SavCfg }) {
  return <SourceFeed source="sav">{(s) => <SavWidget api={s} cfg={cfg} />}</SourceFeed>;
}

/* --- Configurations de DÉPART des types génériques, en grammaire §9-bis. Elles ne
   servent que de base à `coerceCfg` : ce qui manque est comblé par le descripteur
   de la source (mappage, tri). Les deux widgets « notes » n'ont plus d'enveloppe
   dédiée — ce sont des instances `data` à cfg figée, dont la CLÉ de type ne change
   pas (contrat de persistance). --- */
const cfgOfSource = (source: SourceKey, over: Partial<InstanceCfg> = {}): InstanceCfg => ({
  title: "",
  unit: "élément",
  source,
  query: { filter: [], sort: { ...CATALOG[source].defaultSort }, limit: RECENT },
  view: { kind: "list", map: { ...(CATALOG[source].defaultMap ?? {}) } },
  ...over,
});

const NOTES_INS_CFG: InstanceCfg = cfgOfSource("notesIns", { title: "Dernières notes — Installateurs", unit: "note" });
const NOTES_PRO_CFG: InstanceCfg = cfgOfSource("notesPro", { title: "Dernières notes — Prospects", unit: "note" });

// Widget « data » créé de zéro depuis la galerie : liste des dossiers Abonné.
const DATA_CFG: InstanceCfg = cfgOfSource("abonnes");

/* --- LES DEUX FILES D'ATTENTE — cfg FIGÉES (2026-08-18) ----------------------------
   Elles ont d'abord été des modèles du widget générique. Le générique donnait avec elles
   tout son formulaire : source, mappage, colonnes, filtres, tri, limite, périmètre,
   clientèle, recherche… soit une dizaine de réglages pour un widget dont la raison d'être
   tient en une phrase — « les dossiers en attente de solvabilité, point ». On pouvait même
   lui changer sa source, donc lui faire afficher tout autre chose sous le même titre.
   Ces deux-là sont donc devenues des TYPES à part entière, dont le formulaire ne propose
   que deux réglages (§10, `FileOptions`) : l'ORDRE, et la CLIENTÈLE rétablie le 2026-08-20.
   Le reste du contenu — source, statut suivi, colonnes — ne bouge pas.

   `limit: LIST_LIMIT_MAX` — une file d'attente se montre ENTIÈRE : c'est une charge de
   travail, pas un aperçu des derniers arrivés. 25 dossiers étaient en attente de
   solvabilité au 2026-08-18, et le plafond du générique (20) en cachait cinq sans le dire.
   Si la file dépasse un jour ce maximum, `DataView` l'annonce (« 50 sur 62 »).
   `search: false` et `facets: []` — pas de barre d'outils : moins il y a à régler, mieux la
   carte dit ce qu'elle est. --- */
const fileCfg = (title: string, filtre: Filter): InstanceCfg => coerceCfg({
  title, unit: "dossier",
  source: "abonnes",
  /* Tri ASCENDANT, à l'inverse du reste du bloc : une file se lit par le haut, le dossier
     qui traîne depuis décembre doit passer devant celui d'hier. */
  query: { filter: [filtre], sort: { by: "creeLe", dir: "asc" }, limit: LIST_LIMIT_MAX },
  /* `title: "clientNom"` — la raison sociale pour un pro, le nom pour un particulier
     (§6-bis). Mappé sur `nom`, ce widget affichait des lignes SANS TITRE pour les deux
     tiers de la file : sur un dossier pro, « Nom » est vide dans la base. */
  view: { kind: "list", map: { title: "clientNom", sub: "partenaire", date: "creeLe", badge: "statut" } },
  search: false,
  facets: [],
}, cfgOfSource("abonnes"));

/* --- LE SEUL RÉGLAGE DE CES WIDGETS : L'ORDRE ---------------------------------------
   Une file d'attente se lit de deux façons — par l'ancienneté (qui attend depuis le plus
   longtemps ?) et par l'enjeu (quels dossiers pèsent le plus ?). C'est le seul choix qui
   change la façon de travailler ; tout le reste — source, filtre, colonnes — resterait
   une invitation à détourner le widget de ce que son titre promet.
   Quatre entrées et pas un formulaire : le ⋮ n'offre donc que le nom, la couleur, et ceci. */
const FILE_TRIS = [
  { key: "ancien", label: "Le plus ancien d'abord", by: "creeLe", dir: "asc" },
  { key: "recent", label: "Le plus récent d'abord", by: "creeLe", dir: "desc" },
  { key: "capexHaut", label: "CAPEX le plus élevé d'abord", by: "capex", dir: "desc" },
  { key: "capexBas", label: "CAPEX le plus faible d'abord", by: "capex", dir: "asc" },
] as const;
type FileTri = (typeof FILE_TRIS)[number]["key"];
/* Par défaut l'ancienneté : c'est une FILE, et ce qui traîne doit se voir en premier. */
const fileTriOf = (raw: unknown): (typeof FILE_TRIS)[number] =>
  FILE_TRIS.find((t) => t.key === asText(asObj(raw).tri)) ?? FILE_TRIS[0];


/* ⚠️ `eq` et non `contains` : « contient solvabilité » ramasserait CINQ statuts, dont
   « Refusé : solvabilité » et « Demande d'infos : solvabilité » — des dossiers morts et
   une autre file, sous un titre qui promet une seule chose. */
const ATT_SOLVA_CFG: InstanceCfg = fileCfg("En attente de solvabilité",
  { field: "statut", op: "eq", value: "En attente de solvabilité" });
/* `contains` ici, au contraire : le pipeline compte TROIS « Demande d'infos » (technique ·
   solvabilité · les deux), et les énumérer figerait le widget au jour du quatrième. */
const DEM_INFOS_CFG: InstanceCfg = fileCfg("Demandes d'infos",
  { field: "statut", op: "contains", value: "Demande d'infos" });

/* --- EMBEDS ELFSIGHT — ISOLÉS DANS UNE IFRAME `srcDoc` ------------------------
   ⚠️⚠️ POURQUOI UNE IFRAME, ET NON LE SNIPPET DANS CE DOCUMENT : parce que le montage
   direct NE FONCTIONNE PAS ICI, quelle qu'ait été l'implémentation. Trois versions s'y
   sont succédé — script chargé une fois, seconde chance avec re-scan, réinjection à
   chaque montage — et le conteneur restait vide dans l'app publiée.

   CE QUE LE TEST DU 2026-08-07 A PROUVÉ, en production, dans un bloc Softr séparé : le
   MÊME identifiant de widget, servi par le MÊME CDN, s'affiche dès qu'il vit dans une
   iframe `srcdoc`. ✅ CONFIRMÉ LE MÊME JOUR DANS CE BLOC : les embeds s'affichent. Ne pas
   revenir au montage direct — c'est un chemin déjà parcouru trois fois, en vain. Ce résultat innocente trois suspects d'un coup :
     · le widget et le compte Elfsight — c'est le même identifiant qui monte ;
     · l'URL du runtime — c'est la même (`elfsightcdn.com/platform.js`) ;
     · la CSP — un document `srcdoc` HÉRITE de la politique de la page parente, donc si
       le script est servi là, il l'était aussi avant. La piste CSP relevée le 2026-08-05
       est définitivement close.
   Reste la seule différence : LE DOCUMENT. Le conteneur rendu par React dans le bloc
   n'est pas vu par `platform.js` — shadow DOM du bloc `vibe code` selon toute
   vraisemblance (le runtime scanne `document`, qui ne traverse pas une racine d'ombre),
   ou remontages React qui défont le montage. On ne corrige donc PAS la cause : on
   l'ISOLE. Le snippet reçoit un document neuf, à lui, où il retrouve les conditions
   exactes du bloc « Custom Code » qui fonctionne.

   ⚠️ LA HAUTEUR NE PEUT PAS SUIVRE LE CONTENU : une iframe ne se dimensionne pas sur son
   document (documents distincts, et `postMessage` supposerait une page complice — ce que la
   page Elfsight n'est pas). Trop bas, le contenu est COUPÉ ; trop haut, la carte porte une
   bande vide.
   ⚠️ C'EST DONC LE RÉGLAGE DE HAUTEUR DE LA CARTE QUI COMMANDE (2026-08-07, demandé) :
   l'iframe prend la hauteur servie par `WidgetHeightCtx`, celle que règlent les segments du
   ⋮ et la poignée du bas. Avant, elle valait 420 px en dur — et régler la carte ne faisait
   RIEN sur ces trois widgets, ce qui n'avait aucune logique à l'écran. Un fil LinkedIn
   demande le cran « XL » (860 px, ajouté le même jour) ; une barre d'annonces se contente de
   « Petit ». La prop `height` reste, pour forcer une valeur hors grille.
   Le tassement de la grille (§11) suit tout seul, il mesure la hauteur réelle. --- */

/* --- MASQUER UN TEXTE VENU D'ELFSIGHT (2026-08-07) ------------------------------
   La bannière affiche un en-tête « SunLib sur LinkedIn » qui vient des RÉGLAGES DU WIDGET
   côté Elfsight, pas de ce fichier. Depuis que l'embed vit dans une iframe `srcDoc`, ce
   document est le NÔTRE : on peut donc y intervenir, ce qui était impossible avant.

   ⚠️ LE CIBLAGE SE FAIT SUR LE TEXTE EXACT, jamais sur un sélecteur : la structure DOM
   d'Elfsight n'est pas un contrat (classes générées, susceptibles de changer à chaque mise
   à jour de leur runtime), et une règle du genre `[class*="title"] { display: none }`
   masquerait aussi bien le titre du webinaire — c'est-à-dire le contenu qu'on veut voir.
   ⚠️ Seul le nœud le PLUS PROFOND qui porte ce texte est masqué. Sans ce tri, on masquerait
   un ancêtre — au pire la racine du widget, qui « contient » elle aussi ce texte : la
   bannière disparaîtrait entièrement.
   ⚠️ Un `MutationObserver` est nécessaire : le runtime monte son contenu bien après le
   chargement du document, et il le remonte parfois (redimensionnement, rafraîchissement).

   LA VOIE PROPRE RESTE CÔTÉ ELFSIGHT : décocher l'affichage du titre dans l'éditeur du
   widget rend tout ce mécanisme inutile — et le jour où c'est fait, retirer la prop
   `hideLabel` de l'appelant suffit à le désactiver. --- */
const elfsightHideScript = (label: string): string =>
  "<script>(function(){var T=" + JSON.stringify(label) + ";"
  + "function scrub(){var m=[].filter.call(document.querySelectorAll('*'),function(n){"
  + "return n.textContent&&n.textContent.trim()===T;});"
  + "m.forEach(function(n){if(!m.some(function(o){return o!==n&&n.contains(o);}))"
  + "n.style.display='none';});}"
  + "scrub();new MutationObserver(scrub).observe(document.documentElement,"
  + "{childList:true,subtree:true,characterData:true});})();<\/script>";

/** Document autonome servi à l'iframe : le snippet officiel, et rien d'autre — plus, si
 *  `hideLabel` est fourni, le script de masquage ci-dessus.
 *  ⚠️ `<\/script>` avec le SLASH ÉCHAPPÉ, obligatoire : écrite `</script>` en clair, cette
 *  chaîne fermerait prématurément le script qui l'entoure dès que le bundle est servi
 *  inline (c'est le cas du bloc collé dans Softr). Le `\/` ne change rien à la valeur
 *  produite, seulement au texte du source. */
const elfsightDoc = (widgetId: string, hideLabel?: string): string =>
  '<!doctype html><html><body style="margin:0">'
  + '<script src="https://elfsightcdn.com/platform.js" async><\/script>'
  + `<div class="elfsight-app-${widgetId}"></div>`
  + (hideLabel ? elfsightHideScript(hideLabel) : "")
  + "</body></html>";

/** Un embed Elfsight. `widgetId` est l'identifiant NU (sans le préfixe `elfsight-app-`),
 *  pour qu'un appelant ne puisse pas se tromper de forme de classe.
 *  `loading="lazy"` : la grille en porte jusqu'à trois, inutile de charger trois runtimes
 *  pour des cartes hors écran. Contrairement à `data-elfsight-app-lazy` — retiré en son
 *  temps pour cette raison même — le différé est ici porté par le NAVIGATEUR, qui charge
 *  le document dès que l'iframe approche du viewport, sans dépendre du runtime. */
function ElfsightWidget({ widgetId, height, title = "Contenu SunLib", hideLabel }: {
  widgetId: string;
  /** Force une hauteur en pixels. Omise — le cas normal — la hauteur est celle RÉGLÉE sur
   *  la carte (⋮ « Hauteur », ou la poignée du bas). */
  height?: number;
  title?: string;
  /** Texte à masquer DANS le contenu Elfsight (cf. `elfsightHideScript`). À n'utiliser que
   *  pour un en-tête réglé côté Elfsight qu'on ne peut pas décocher là-bas. */
  hideLabel?: string;
}) {
  /* Même canal que le corps scrollable des autres widgets : ce que l'utilisateur règle sur
     la carte arrive ici. Hors grille (aucun fournisseur au-dessus), le contexte rend son
     défaut — la hauteur du cran « Moyen ». */
  const reglee = useContext(WidgetHeightCtx);
  const h = height ?? reglee;
  return (
    <div style={{ padding: "10px 16px 16px" }}>
      <iframe title={title} loading="lazy" srcDoc={elfsightDoc(widgetId, hideLabel)}
        style={{ display: "block", width: "100%", height: h, border: 0 }} />
    </div>
  );
}

/* ⚠️ TITRE EN DOUBLE : ne pas le chercher ici. Signalé le 2026-08-04 — « SunLib sur
   LinkedIn » apparaît deux fois, dans l'en-tête de la carte ET en gros dans le corps.
   Le second N'EST PAS RENDU PAR CE FICHIER : c'est l'en-tête du widget Elfsight, monté
   par `platform.js` d'après les réglages du compte. Le seul titre que ce bloc écrit est
   le `title` ci-dessous, qui porte aussi le ⋮ et la préhension — le retirer viderait
   l'en-tête de la carte, ce qui n'est pas ce qu'on veut.
   → Il se masque DANS L'ÉDITEUR DU WIDGET côté Elfsight (réglages de mise en page /
   apparence, affichage de l'en-tête ou du titre). Rien à changer dans le code. */
function LinkedinCard() {
  return (
    <Widget icon={Newspaper} title="SunLib sur LinkedIn" sub="Dernières publications">
      {/* ▼ EMBED Elfsight — feed LinkedIn ▼ */}
      <ElfsightWidget widgetId="2df6db63-fd6e-498a-8a61-a97803d9d96f" />
    </Widget>
  );
}

/* Titre volontairement NEUTRE : côté Elfsight, cette bannière change de contenu
   (aujourd'hui « Webinaire l'abonnement pour l'ACC »), et ce n'est pas un embed
   LinkedIn. La CLÉ de type reste `linkedinBanner` — c'est un contrat de
   persistance, les layouts sauvegardés y font référence. */
function LinkedinBannerCard() {
  return (
    <Widget icon={Megaphone} title="À la une SunLib" sub="Webinaires et annonces">
      {/* ▼ EMBED Elfsight — bannière (contenu piloté depuis Elfsight) ▼
          `hideLabel` : la bannière porte un en-tête « SunLib sur LinkedIn » réglé côté
          Elfsight, qui n'a rien à faire sous un titre de carte « À la une SunLib » — et qui
          était en plus le doublon signalé le 2026-08-04. Le retirer dans l'éditeur du
          widget Elfsight rendrait cette prop inutile. */}
      <ElfsightWidget widgetId="488a28ed-f4b6-4f5b-af44-c16613885c98" hideLabel="SunLib sur LinkedIn" />
    </Widget>
  );
}

/* Barre d'annonces Elfsight — troisième embed. Non livré par défaut (absent de
   DEFAULT_INSTANCES) : il s'ajoute depuis la galerie « Ajouter un widget ». */
function AnnoncesCard() {
  return (
    <Widget icon={Sparkles} title="Annonces SunLib" sub="Informations internes">
      {/* ▼ EMBED Elfsight — barre d'annonces ▼ */}
      <ElfsightWidget widgetId="8f372b94-937a-4aa2-8762-0e56f6515ac7" />
    </Widget>
  );
}

/* ============================================================================
   9-septies. PODIUM CAPEX — les trois premiers commerciaux
   ----------------------------------------------------------------------------
   Reprise du podium de l'onglet Commercial du bloc `dashboard-KPI` : même critères,
   même dessin. Les deux écrans doivent donner le MÊME classement, sans quoi la
   question « lequel a raison ? » se posera un jour, en réunion.

   Les critères sont recopiés, pas réinventés (cf. SELECT_COM) :
     · PORTEFEUILLE = dossiers dont le contrat signé est JOINT (pièce jointe), annulés
       compris — ils ont bien été signés un jour ;
     · les CONTRATS comptés et le CAPEX excluent les dossiers « Annulé » ;
     · « Non assigné » (commercial vide) est EXCLU du podium : ce n'est pas une
       personne, et il finirait régulièrement sur la première marche.

   ⚠️ CE WIDGET AGRÈGE SUR TOUT LE PARC, donc il est le seul à exiger une lecture
   paginée (ComKpiSource). Sur un échantillon, il afficherait un classement faux avec
   des montants crédibles : quand la lecture est incomplète, il le DIT à l'écran.
   ============================================================================ */
const PODIUM_NON_ASSIGNE = "Non assigné";
const PODIUM_PERIODES = [
  { key: "tout", label: "Tout" },
  { key: "annee", label: "Année" },
  { key: "mois", label: "Mois" },
] as const;
type PodiumPeriode = (typeof PODIUM_PERIODES)[number]["key"];
type PodiumCfg = { periode: PodiumPeriode; clientele: Clientele };

const coercePodiumCfg = (raw: unknown): PodiumCfg => {
  const p = asText(asObj(raw).periode);
  return {
    periode: PODIUM_PERIODES.some((x) => x.key === p) ? (p as PodiumPeriode) : "annee",
    clientele: clienteleOf(raw),
  };
};

/* ── PÉRIMÈTRE CLIENTÈLE DES WIDGETS COMMERCIAUX (2026-08-20, demandé) ─────────
   Les quatre widgets de ce § agrègent, ils ne listent pas : le périmètre doit donc être
   appliqué AVANT le calcul, sur les lignes brutes, exactement comme `clientScope` le fait
   pour les widgets `data`. Un filtre posé après coup aurait laissé les CAPEX, les taux de
   pose et les délais se calculer sur tout le parc, sous un titre annonçant les pros.
   `SEG_CLIENTELE` est le formulaire, partagé par les quatre : un `<select>` et non des
   segments, parce qu'à cinq entrées des boutons côte à côte deviendraient illisibles dans
   un panneau de 292 px. Le mot du sous-titre vient de `clienteleCourt`.
   ⚠️ Si le champ n'est pas lu (datasource sans « Champs IA Config client »),
   `clienteleRows` ne filtre RIEN plutôt que de vider le classement, et le sous-titre
   n'annonce alors aucun périmètre : c'est `clientLisible` qui fait la différence. */
function ClienteleSelect({ value, onChange, note }: {
  value: Clientele; onChange: (c: Clientele) => void; note?: string;
}) {
  const lbl: CSSProperties = { display: "block", fontSize: "10.5px", fontWeight: 700, color: T.ink4, textTransform: "uppercase", letterSpacing: ".05em", margin: "10px 0 4px" };
  const field: CSSProperties = { width: "100%", boxSizing: "border-box", padding: "7px 9px", borderRadius: T.rSm, border: `1px solid ${T.line}`, background: T.surface, color: T.ink, fontFamily: "inherit", fontSize: "12.5px", fontWeight: 500 };
  return (
    <>
      <span style={lbl}>Clientèle</span>
      <select style={field} value={value} aria-label="Périmètre de clientèle"
        onChange={(e) => onChange(e.target.value as Clientele)}>
        {CLIENTELES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
      </select>
      <p style={{ margin: "4px 0 0", fontSize: "11.5px", fontWeight: 500, color: T.ink4 }}>
        {note ?? "« Particuliers » regroupe les dossiers Solo et Duo ; « Pro » désigne les dossiers sans civilité (entreprises, collectivités)."}
      </p>
    </>
  );
}

/** Le mot de périmètre à accrocher au sous-titre d'un widget commercial : "" quand rien
 *  n'est demandé, mais aussi quand la source ne lit pas le champ — annoncer « pros » sur
 *  un classement qui porte tout le parc serait un mensonge. PURE. */
const perimetreCom = (rows: Row[], c: Clientele): string =>
  c === "tous" || !clientLisible(rows) ? "" : ` · ${clienteleCourt(c)}`;

/* ── INDICATEURS GLOBAUX — la rangée de tuiles du bloc KPI ─────────────────────
   Les mêmes chiffres que `comStats`, mais TOUS COMMERCIAUX CONFONDUS, plus deux que le
   classement n'a pas : la puissance installée et le pipeline à signer.

   ⚠️ Le PIPELINE ne se lit pas dans le portefeuille : par définition, un dossier « à
   signer » n'a pas de contrat signé. Critère du bloc KPI (`buildPipeItems`) : une pièce
   jointe « Contrat d abonnement non signe » ET une date d'édition dans les 30 derniers
   jours. La fenêtre est GLISSANTE et volontairement indépendante de la période choisie
   — « à signer » parle de ce qui est sur le bureau maintenant, pas d'un historique. --- */
const PIPE_JOURS = 30;

function comGlobal(rows: Row[], periode: PodiumPeriode, now: Date) {
  const mCourant = moisCourant(now);
  const annee = `${now.getFullYear()}`;
  const dansPeriode = (r: Row) => {
    const m = asText(r.moisSignature);
    if (periode === "mois") return m === mCourant;
    if (periode === "annee") return m.startsWith(annee);
    return true;
  };
  const estAnnule = (r: Row) => asText(r.statutAbonne) === "Annulé";

  const dansP = rows.filter((r) => hasFile(r.contratSigne) && dansPeriode(r));
  const signes = dansP.filter((r) => !estAnnule(r));
  const annules = dansP.filter(estAnnule);

  // Pipeline : hors portefeuille, fenêtre glissante de 30 jours sur la date d'édition.
  const plancher = now.getTime() - PIPE_JOURS * 864e5;
  const aSigner = rows.filter((r) => {
    if (!hasFile(r.contratNonSigne) || hasFile(r.contratSigne)) return false;
    const t = savTime(r.dateEdition);
    return Number.isFinite(t) && t >= plancher;
  });

  return {
    contrats: signes.length,
    annules: annules.length,
    tauxAnnulation: pct(annules.length, dansP.length),
    capex: signes.reduce((s, r) => s + savNum(r.capex), 0),
    kwc: signes.reduce((s, r) => s + savNum(r.kwc), 0),
    /* Installateurs et commerciaux ACTIFS = ceux qui ont au moins un contrat signé sur
       la période. Les compter sur toute la table gonflerait les deux chiffres avec des
       partenaires dormants. */
    installateurs: new Set(signes.map((r) => asText(r.installateur)).filter(Boolean)).size,
    commerciaux: new Set(signes.map((r) => asText(r.commercial).trim()).filter((n) => n && n !== PODIUM_NON_ASSIGNE)).size,
    aSigner: aSigner.length,
    capexASigner: aSigner.reduce((s, r) => s + savNum(r.capex), 0),
  };
}
type ComGlobal = ReturnType<typeof comGlobal>;

/** Nombre avec séparateur de milliers fin et une décimale — la forme du bloc KPI pour
 *  les kWc (« 12 458,1 kWc »). */
const fmtKwc = (n: number): string =>
  `${n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWc`;

/* Registre des indicateurs globaux — même principe que SAV_METRICS : ajouter une valeur
   affichable = une entrée ici, et elle apparaît dans le panneau de tout le monde.
   Les CLÉS sont un contrat de persistance (stockées dans `cfg.show`). */
type ComMetric = {
  key: string; label: string; icon?: LucideIcon;
  value: (g: ComGlobal) => string;
  sub?: (g: ComGlobal) => string;
  warnSub?: (g: ComGlobal) => boolean;
  bar?: (g: ComGlobal) => number;
};
const COM_METRICS: ComMetric[] = [
  { key: "contrats", label: "Contrats signés", icon: CheckCircle,
    value: (g) => `${g.contrats}`,
    sub: () => "" },   // le sous-texte dépend de la période : rempli dans le widget
  { key: "annules", label: "Annulés", icon: XCircle,
    value: (g) => `${g.annules}`,
    sub: (g) => `Taux d'annulation ${g.tauxAnnulation} %`,
    warnSub: (g) => g.annules > 0 },
  { key: "capex", label: "CAPEX signé HT", icon: BarChart3,
    value: (g) => fmtMEur(g.capex),
    sub: (g) => `${fmtKwc(g.kwc)} installés` },
  { key: "installateurs", label: "Installateurs actifs", icon: HardHat,
    value: (g) => `${g.installateurs}`,
    sub: (g) => `${g.commerciaux} commercial${g.commerciaux > 1 ? "aux" : ""} au portefeuille` },
  { key: "aSigner", label: `À signer (${PIPE_JOURS} j)`, icon: FileSignature,
    value: (g) => `${g.aSigner}`,
    sub: (g) => `${fmtMEur(g.capexASigner)} de CAPEX restant`,
    warnSub: (g) => g.aSigner > 0 },
];
const COM_SHOW_DEFAULT = COM_METRICS.map((m) => m.key);

type ComIndicsCfg = { periode: PodiumPeriode; show: string[]; clientele: Clientele };
const coerceComIndicsCfg = (raw: unknown): ComIndicsCfg => {
  const o = asObj(raw);
  const p = asText(o.periode);
  const known = new Set(COM_METRICS.map((m) => m.key));
  const periode: PodiumPeriode = PODIUM_PERIODES.some((x) => x.key === p) ? (p as PodiumPeriode) : "tout";
  const clientele = clienteleOf(raw);
  /* `show` ABSENT → tout ; PRÉSENT même vide → choix explicite respecté. Même règle que
     `coerceSavCfg`, pour que les deux panneaux se comportent pareil. */
  if (!Array.isArray(o.show)) return { periode, clientele, show: [...COM_SHOW_DEFAULT] };
  return { periode, clientele, show: Array.from(new Set(o.show.filter((x: unknown): x is string => typeof x === "string" && known.has(x)))) };
};

function ComIndicsOptions({ cfg, onChange }: { cfg: ComIndicsCfg; onChange: (next: ComIndicsCfg) => void }) {
  const on = new Set(cfg.show);
  const toggle = (key: string) => {
    const next = new Set(on);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange({ ...cfg, show: COM_METRICS.filter((m) => next.has(m.key)).map((m) => m.key) });
  };
  const lbl: CSSProperties = { display: "block", fontSize: "10.5px", fontWeight: 700, color: T.ink4, textTransform: "uppercase", letterSpacing: ".05em", margin: "2px 0 4px" };
  const line: CSSProperties = { display: "flex", alignItems: "center", gap: "9px", padding: "6px 4px", cursor: "pointer", fontSize: "12.5px", fontWeight: 500, color: T.ink2 };
  const seg = (active: boolean): CSSProperties => ({ flex: 1, padding: "6px 4px", borderRadius: T.rSm, border: `1px solid ${active ? T.brand : T.line}`, background: active ? T.brand050 : T.surface, color: active ? T.brand700 : T.ink2, fontFamily: "inherit", fontSize: "12px", fontWeight: 700, cursor: "pointer" });
  return (
    <div>
      <span style={lbl}>Période</span>
      <div style={{ display: "flex", gap: "6px" }}>
        {PODIUM_PERIODES.map((p) => (
          <button key={p.key} style={seg(cfg.periode === p.key)} onClick={() => onChange({ ...cfg, periode: p.key })}
            aria-pressed={cfg.periode === p.key}>{p.label}</button>
        ))}
      </div>
      <ClienteleSelect value={cfg.clientele} onChange={(c) => onChange({ ...cfg, clientele: c })} />
      <span style={{ ...lbl, marginTop: "10px" }}>Indicateurs affichés</span>
      {COM_METRICS.map((m) => (
        <label key={m.key} style={line}>
          <input type="checkbox" checked={on.has(m.key)} onChange={() => toggle(m.key)}
            style={{ width: 15, height: 15, accentColor: T.brand, flex: "none", cursor: "pointer" }} />
          <span>{m.label}</span>
        </label>
      ))}
      <p style={{ margin: "8px 0 0", fontSize: "11.5px", fontWeight: 500, color: T.ink4 }}>
        « À signer » reste sur une fenêtre glissante de {PIPE_JOURS} jours, quelle que soit la période.
      </p>
    </div>
  );
}

function ComIndicsWidget({ api, cfg }: { api: SourceApi; cfg: ComIndicsCfg }) {
  /* Périmètre AVANT le calcul : les tuiles sont des agrégats (§9-septies, `perimetreCom`). */
  const g = comGlobal(clienteleRows(api.rows, cfg.clientele), cfg.periode, new Date());
  const zone = tintOf(useContext(WidgetTintCtx)).head || T.surface2;
  const periodeLabel = cfg.periode === "mois" ? "sur le mois en cours"
    : cfg.periode === "annee" ? "sur l'année en cours" : "toutes périodes";
  const on = new Set(cfg.show);
  const tiles: Tile[] = COM_METRICS.filter((m) => on.has(m.key)).map((m) => ({
    key: m.key, label: m.label, icon: m.icon,
    value: m.value(g),
    // Le sous-texte des contrats signés est le seul qui dépende de la période : il la
    // NOMME, sinon « 782 » ne dirait pas de quoi il est le total.
    sub: m.key === "contrats" ? periodeLabel : m.sub?.(g),
    warn: !!m.warnSub?.(g),
    bar: m.bar?.(g),
  }));

  return (
    <Widget icon={BarChart3} title="Indicateurs commerciaux"
      sub={api.loading ? "Chargement…" : `Contrats et pipeline — ${periodeLabel}${perimetreCom(api.rows, cfg.clientele)}`}>
      {api.error ? (
        <EmptyState icon={BarChart3} dense title="Donnée indisponible"
          hint="La source « Abonnés » n'a pas répondu. Les indicateurs complets restent dans le tableau de bord KPI." />
      ) : api.loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(182px, 1fr))", gap: "14px", padding: "14px 16px 16px" }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="slb-skel" style={{ display: "block", height: 104, borderRadius: T.rLg, background: T.neutral050 }} />
          ))}
        </div>
      ) : !tiles.length ? (
        <EmptyState icon={BarChart3} dense title="Aucun indicateur affiché"
          hint="Choisissez ce que ce widget doit montrer dans son menu ⋮ « Options »." />
      ) : (
        <>
          <KpiTiles tiles={tiles} zone={zone} />
          <AggregateNote api={api} style={{ padding: "0 16px 14px" }} />
        </>
      )}
    </Widget>
  );
}

function ComIndicsCard({ cfg }: { cfg: ComIndicsCfg }) {
  return <SourceFeed source="comKpi">{(s) => <ComIndicsWidget api={s} cfg={cfg} />}</SourceFeed>;
}

/** Une ligne du classement. `monthly` = signés par mois, dans l'ordre de `mois`. */
type ComStat = {
  nom: string; capex: number; contrats: number; annules: number; tauxAnnulation: number;
  poses: number; tauxPose: number; delaiMoy: number; aboMoyen: number;
  installateurs: number; tendance: number; monthly: number[];
  /** Puissance installée (kWc) des dossiers signés du groupe. Ajoutée le 2026-08-06 pour
   *  le classement des installateurs, où c'est une colonne attendue. */
  kwc: number;
};

/* Ce par quoi on REGROUPE. Le calcul est le même — seule la clé change, et c'est tout
   l'intérêt : le classement des installateurs n'est pas un second calcul à maintenir en
   parallèle du classement commercial, sous peine de voir les deux diverger. */
type ComGroupBy = "commercial" | "installateur";

/** Clé « AAAA-MM » du mois courant, et « AAAA » de l'année — mêmes formes que le champ
 *  « Mois de signature contrat », donc comparables par simple préfixe. */
const moisCourant = (now: Date) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

const moyenne = (a: number[]): number => (a.length ? a.reduce((s, n) => s + n, 0) / a.length : 0);
const pct = (n: number, total: number): number => (total ? Math.round((n / total) * 100) : 0);

/** Écart en jours entre deux dates. `null` = incalculable — c'est une SENTINELLE, jamais
 *  un délai : tout ce qui moyenne des délais doit l'écarter, sinon une date manquante
 *  compterait pour zéro jour et tirerait la moyenne vers le bas. */
function joursEntre(a: unknown, b: unknown): number | null {
  const ta = savTime(a), tb = savTime(b);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return null;
  return Math.round((tb - ta) / 86400000);
}

/* ── LE CALCUL, une fois pour les deux widgets (podium ET classement) ───────────
   Critères recopiés du bloc `dashboard-KPI` (`statsDe`), sans quoi les écrans
   divergeraient :
     · PORTEFEUILLE = contrat signé JOINT (annulés compris) ;
     · `contrats`/`capex` comptent les NON annulés de la période ;
     · `tauxAnnulation` se calcule sur le total de la période (annulés inclus) ;
     · `tauxPose` = posés / signés, « posé » = « Etat facture 2 » à « Validée » ;
     · `delaiMoy` = jours entre création du dossier et signature, bornés à [0, 365[ —
       au-delà c'est une saisie douteuse, pas un délai commercial ;
     · `installateurs` = nombre d'installateurs DISTINCTS (c'est la colonne
       « Installs. » du bloc KPI : des partenaires, pas des installations) ;
     · `tendance` = signés du mois courant moins ceux du mois précédent PRÉSENT DANS
       LES DONNÉES — un mois sans aucune signature ferait sinon afficher −100 % à tout
       le monde. Elle ignore la période choisie, exprès : c'est une dynamique.
   PURE, donc identique en mock et en live. --- */
function comStats(rows: Row[], periode: PodiumPeriode, now: Date, groupBy: ComGroupBy = "commercial"): { stats: ComStat[]; mois: string[] } {
  const portefeuille = rows.filter((r) => hasFile(r.contratSigne));
  const mCourant = moisCourant(now);
  const annee = `${now.getFullYear()}`;
  const dansPeriode = (r: Row) => {
    const m = asText(r.moisSignature);
    if (periode === "mois") return m === mCourant;
    if (periode === "annee") return m.startsWith(annee);
    return true;
  };
  const estAnnule = (r: Row) => asText(r.statutAbonne) === "Annulé";

  // Mois réellement présents, les 12 derniers → l'échelle de la sparkline.
  const tousMois = [...new Set(portefeuille.map((r) => asText(r.moisSignature)).filter(Boolean))].sort();
  const mois = tousMois.slice(-12);
  const iCourant = tousMois.indexOf(mCourant);
  const mPrecedent = (iCourant > 0 ? tousMois[iCourant - 1] : tousMois[tousMois.length - 2]) || "";

  const par = new Map<string, Row[]>();
  portefeuille.forEach((r) => {
    const nom = asText(groupBy === "installateur" ? r.installateur : r.commercial).trim();
    /* ⚠️ La garde « Non assigné » ne vaut que pour un COMMERCIAL : c'est le libellé que
       porte un dossier sans propriétaire, et ce n'est pas une personne à classer. Un
       installateur, lui, n'a pas de valeur équivalente — un nom vide suffit à écarter. */
    if (!nom || (groupBy === "commercial" && nom === PODIUM_NON_ASSIGNE)) return;
    (par.get(nom) ?? par.set(nom, []).get(nom)!).push(r);
  });

  const stats = [...par.entries()].map(([nom, recs]) => {
    const dansP = recs.filter(dansPeriode);
    const signes = dansP.filter((r) => !estAnnule(r));
    const annules = dansP.filter(estAnnule);
    const poses = signes.filter((r) => asText(r.etatFacture2) === "Validée");
    const delais = signes
      .map((r) => joursEntre(r.dateCreation, r.dateSignature))
      .filter((d): d is number => d != null && d >= 0 && d < 365);
    const abos = signes.map((r) => savNum(r.aboMoyen)).filter((v) => v > 0);
    const parMois = (m: string) => recs.filter((r) => asText(r.moisSignature) === m && !estAnnule(r)).length;
    return {
      nom,
      capex: signes.reduce((s, r) => s + savNum(r.capex), 0),
      kwc: signes.reduce((s, r) => s + savNum(r.kwc), 0),
      contrats: signes.length,
      annules: annules.length,
      tauxAnnulation: pct(annules.length, dansP.length),
      poses: poses.length,
      tauxPose: pct(poses.length, signes.length),
      delaiMoy: delais.length ? Math.round(moyenne(delais)) : 0,
      aboMoyen: moyenne(abos),
      installateurs: new Set(recs.map((r) => asText(r.installateur)).filter(Boolean)).size,
      tendance: parMois(mCourant) - (mPrecedent ? parMois(mPrecedent) : 0),
      monthly: mois.map(parMois),
    };
  });
  return { stats, mois };
}

/** Montant en M€ à trois décimales — la forme du bloc KPI (« 3,990 M€ »), qui garde
 *  les classements lisibles quand deux commerciaux se tiennent à quelques milliers
 *  d'euros. `fmtEur` arrondirait au millier et les afficherait à égalité. */
const fmtMEur = (n: number): string => `${(n / 1_000_000).toFixed(3).replace(".", ",")} M€`;

function PodiumOptions({ cfg, onChange }: { cfg: PodiumCfg; onChange: (next: PodiumCfg) => void }) {
  const lbl: CSSProperties = { display: "block", fontSize: "10.5px", fontWeight: 700, color: T.ink4, textTransform: "uppercase", letterSpacing: ".05em", margin: "2px 0 4px" };
  const seg = (active: boolean): CSSProperties => ({ flex: 1, padding: "6px 4px", borderRadius: T.rSm, border: `1px solid ${active ? T.brand : T.line}`, background: active ? T.brand050 : T.surface, color: active ? T.brand700 : T.ink2, fontFamily: "inherit", fontSize: "12px", fontWeight: 700, cursor: "pointer" });
  return (
    <div>
      <span style={lbl}>Période</span>
      <div style={{ display: "flex", gap: "6px" }}>
        {PODIUM_PERIODES.map((p) => (
          <button key={p.key} style={seg(cfg.periode === p.key)} onClick={() => onChange({ ...cfg, periode: p.key })}
            aria-pressed={cfg.periode === p.key}>{p.label}</button>
        ))}
      </div>
      <ClienteleSelect value={cfg.clientele} onChange={(c) => onChange({ ...cfg, clientele: c })} />
      <p style={{ margin: "8px 0 0", fontSize: "11.5px", fontWeight: 500, color: T.ink4 }}>
        Contrats signés (PDF joint), hors dossiers annulés et hors « Non assigné ».
      </p>
    </div>
  );
}

function PodiumWidget({ api, cfg }: { api: SourceApi; cfg: PodiumCfg }) {
  /* Périmètre clientèle AVANT `comStats` : un podium filtré après coup aurait classé les
     commerciaux sur tout le parc puis affiché le mot « pros » (cf. `perimetreCom`). */
  const top3 = comStats(clienteleRows(api.rows, cfg.clientele), cfg.periode, new Date()).stats
    .sort((a, b) => b.capex - a.capex).slice(0, 3);
  /* ORDRE VISUEL 2 · 1 · 3 — le premier au centre, comme sur un vrai podium. Le
     tableau peut contenir des trous (moins de trois commerciaux sur la période) : les
     cases vides sont filtrées au rendu, pas ici, pour que les positions restent
     stables. */
  const marches: (ComStat | undefined)[] = [top3[1], top3[0], top3[2]];
  const hauteurs = [58, 82, 44];
  const rangs = [2, 1, 3];
  const periodeLabel = cfg.periode === "mois" ? "sur le mois en cours"
    : cfg.periode === "annee" ? "sur l'année en cours" : "sur tout l'historique";

  return (
    <Widget icon={Trophy} title="Podium CAPEX HT"
      sub={api.loading ? "Chargement…" : `Les trois premiers ${periodeLabel}${perimetreCom(api.rows, cfg.clientele)}`}>
      {api.error ? (
        <EmptyState icon={Trophy} dense title="Donnée indisponible"
          hint="La source « Abonnés » n'a pas répondu. Le classement complet reste dans le tableau de bord KPI." />
      ) : api.loading ? (
        /* L'attente est LONGUE ici (le parc entier, page par page) : un squelette de
           podium vaut mieux qu'un vide, il annonce ce qui arrive. */
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "26px", padding: "18px 16px 20px" }}>
          {[58, 82, 44].map((h, i) => (
            <span key={i} className="slb-skel" style={{ display: "block", width: i === 1 ? 92 : 74, height: h + 60, borderRadius: T.rMd, background: T.neutral050 }} />
          ))}
        </div>
      ) : top3.length < 2 ? (
        /* Moins de deux commerciaux : ce n'est pas un podium, et deux marches vides se
           liraient comme un bug. On dit ce qui manque. */
        <EmptyState icon={Trophy} dense title="Pas assez de contrats sur la période"
          hint="Le podium demande au moins deux commerciaux avec un contrat signé. Élargissez la période dans le menu ⋮." />
      ) : (
        <div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "26px", flexWrap: "wrap", padding: "16px 16px 0" }}>
            {marches.map((c, i) => c ? (
              <div key={c.nom} className="slb-pod" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                {/* Monogramme : même paire de couleurs stable par nom que les listes du
                    bloc (`monogramOf`), donc la même personne garde sa couleur partout.
                    ⚠️ La classe `slb-pod-av` est CONSERVÉE : c'est elle que le survol du
                    podium fait grossir (HoverFX, §2-bis). La perdre en passant au
                    composant aurait supprimé l'animation sans rien signaler. */}
                <Monogram name={c.nom} size={i === 1 ? 56 : 42} className="slb-pod-av" />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: i === 1 ? "13.5px" : "12.5px", fontWeight: 600, color: T.ink2 }}>{c.nom}</div>
                  <div style={{ fontSize: i === 1 ? "26px" : "19px", fontWeight: 700, color: T.ink, letterSpacing: "-.03em", fontVariantNumeric: "tabular-nums" }}>
                    {fmtMEur(c.capex)}
                  </div>
                  <div style={{ fontSize: "12px", fontWeight: 500, color: T.ink3 }}>
                    {c.contrats} contrat{c.contrats > 1 ? "s" : ""}
                  </div>
                </div>
                {/* La MARCHE. Or solaire pour la première, gris pour les autres — et le
                    numéro est écrit dessus : la couleur ne dit jamais le rang seule. */}
                <div style={{
                  width: i === 1 ? 92 : 74, height: hauteurs[i], borderRadius: `${T.rMd} ${T.rMd} 0 0`,
                  background: i === 1 ? T.solar050 : T.neutral050,
                  boxShadow: `inset 0 0 0 1px ${i === 1 ? T.solar100 : T.line2}`,
                  display: "grid", placeItems: "center",
                }}>
                  <span className="slb-pod-rk" style={{
                    display: "inline-grid", placeItems: "center", width: 24, height: 24, borderRadius: 999,
                    fontSize: "11.5px", fontWeight: 700, fontVariantNumeric: "tabular-nums",
                    background: rangs[i] === 1 ? T.solar050 : rangs[i] === 2 ? T.neutral050 : T.warn050,
                    color: rangs[i] === 1 ? T.solar600 : rangs[i] === 2 ? T.ink2 : T.warnInk,
                    boxShadow: `inset 0 0 0 1px ${rangs[i] === 2 ? T.line2 : T.solar100}`,
                  }}>{rangs[i]}</span>
                </div>
              </div>
            ) : null)}
          </div>
          {/* LECTURE INCOMPLÈTE : jamais silencieuse. Un classement calculé sur une
              partie du parc n'a pas l'air faux — c'est bien pour ça qu'il faut le dire. */}
          <AggregateNote api={api} style={{ padding: "12px 16px 14px" }} />
        </div>
      )}
    </Widget>
  );
}

function PodiumCard({ cfg }: { cfg: PodiumCfg }) {
  return <SourceFeed source="comKpi">{(s) => <PodiumWidget api={s} cfg={cfg} />}</SourceFeed>;
}

/* ── LE CLASSEMENT COMPLET — le tableau du bloc KPI, colonne pour colonne ───────
   Dix colonnes, dont quatre triables. Le tri vit dans la cfg (donc persisté par
   utilisateur) et non dans un état local : on retrouve son classement au rechargement.

   ⚠️ « INSTALLS. » = nombre d'INSTALLATEURS distincts, pas d'installations. Le libellé
   est celui du bloc KPI, et il est trompeur — la note ci-dessous existe pour qu'on ne
   le « corrige » pas en croyant compter des poses.

   Mise en page en style INLINE, jamais par classes : rien ne garantit qu'une règle
   injectée atteigne le bloc (§1). L'en-tête est collant (`position: sticky`) pour que
   les colonnes restent lisibles pendant le défilement du corps. --- */
const COM_COLS = [
  { key: "capex", label: "CAPEX HT" },
  { key: "contrats", label: "Signés" },
  { key: "annules", label: "Annulés" },
  { key: "tauxPose", label: "Taux pose" },
  { key: "delaiMoy", label: "Délai sig." },
] as const;
type ComCol = (typeof COM_COLS)[number]["key"];
type ClassementCfg = { periode: PodiumPeriode; tri: ComCol; dir: "asc" | "desc"; clientele: Clientele };

const coerceClassementCfg = (raw: unknown): ClassementCfg => {
  const o = asObj(raw);
  const p = asText(o.periode);
  const t = asText(o.tri);
  return {
    periode: PODIUM_PERIODES.some((x) => x.key === p) ? (p as PodiumPeriode) : "annee",
    tri: COM_COLS.some((c) => c.key === t) ? (t as ComCol) : "capex",
    dir: o.dir === "asc" ? "asc" : "desc",
    clientele: clienteleOf(raw),
  };
};

/* Panneau d'options PARTAGÉ par les deux classements (commerciaux, installateurs) : même
   période, même tri, même sens — seule la liste des colonnes triables change. Les deux
   `Options` du registre en sont des habillages d'une ligne. */
function RankOptions<C extends string>({ cfg, onChange, cols }: {
  cfg: { periode: PodiumPeriode; tri: C; dir: "asc" | "desc"; clientele: Clientele };
  onChange: (next: { periode: PodiumPeriode; tri: C; dir: "asc" | "desc"; clientele: Clientele }) => void;
  cols: readonly { key: C; label: string }[];
}) {
  const lbl: CSSProperties = { display: "block", fontSize: "10.5px", fontWeight: 700, color: T.ink4, textTransform: "uppercase", letterSpacing: ".05em", margin: "2px 0 4px" };
  const seg = (active: boolean): CSSProperties => ({ flex: 1, padding: "6px 4px", borderRadius: T.rSm, border: `1px solid ${active ? T.brand : T.line}`, background: active ? T.brand050 : T.surface, color: active ? T.brand700 : T.ink2, fontFamily: "inherit", fontSize: "12px", fontWeight: 700, cursor: "pointer" });
  const field: CSSProperties = { width: "100%", boxSizing: "border-box", padding: "7px 9px", borderRadius: T.rSm, border: `1px solid ${T.line}`, background: T.surface, color: T.ink, fontFamily: "inherit", fontSize: "12.5px", fontWeight: 500 };
  return (
    <div>
      <span style={lbl}>Période</span>
      <div style={{ display: "flex", gap: "6px" }}>
        {PODIUM_PERIODES.map((p) => (
          <button key={p.key} style={seg(cfg.periode === p.key)} onClick={() => onChange({ ...cfg, periode: p.key })}
            aria-pressed={cfg.periode === p.key}>{p.label}</button>
        ))}
      </div>
      <span style={{ ...lbl, marginTop: "10px" }}>Trier par</span>
      <select style={field} value={cfg.tri} aria-label="Colonne de tri"
        onChange={(e) => onChange({ ...cfg, tri: e.target.value as C })}>
        {cols.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
      </select>
      <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
        <button style={seg(cfg.dir === "desc")} onClick={() => onChange({ ...cfg, dir: "desc" })}
          aria-pressed={cfg.dir === "desc"}>Décroissant</button>
        <button style={seg(cfg.dir === "asc")} onClick={() => onChange({ ...cfg, dir: "asc" })}
          aria-pressed={cfg.dir === "asc"}>Croissant</button>
      </div>
      {/* CLIENTÈLE — commune aux deux classements : « qui vend aux pros ? » et « quels
          installateurs travaillent avec des particuliers ? » sont deux lectures du même
          tableau, et c'est le même réglage qui les sépare. */}
      <ClienteleSelect value={cfg.clientele} onChange={(c) => onChange({ ...cfg, clientele: c })} />
      <p style={{ margin: "8px 0 0", fontSize: "11.5px", fontWeight: 500, color: T.ink4 }}>
        Les en-têtes du tableau trient aussi, d'un clic.
      </p>
    </div>
  );
}

const ClassementOptions = (p: { cfg: ClassementCfg; onChange: (n: ClassementCfg) => void }) =>
  <RankOptions cfg={p.cfg} onChange={p.onChange} cols={COM_COLS} />;

/** Courbe des 12 derniers mois. Le point final est vert si le dernier mois se tient au
 *  niveau du précédent, rouge s'il décroche — jamais la couleur seule : le nombre de
 *  signés est déjà dans la colonne voisine. */
function Sparkline({ data }: { data: number[] }) {
  if (!data.length || data.every((d) => d === 0)) {
    return <span style={{ fontSize: "12px", color: T.ink4 }}>{DASH}</span>;
  }
  const W = 76, H = 26, top = Math.max(...data, 1);
  const x = (i: number) => (data.length < 2 ? W / 2 : (i / (data.length - 1)) * W);
  const y = (v: number) => H - (v / top) * (H - 5) - 2.5;
  const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = data[data.length - 1], prev = data.length > 1 ? data[data.length - 2] : last;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" style={{ display: "block", overflow: "visible" }}>
      <polyline fill="none" stroke={T.brand} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" points={pts} opacity="0.45" />
      <circle cx={x(data.length - 1)} cy={y(last)} r="2.6" fill={last >= prev ? T.ok : T.danger} />
    </svg>
  );
}

function ClassementWidget({ api, cfg, onSort }: { api: SourceApi; cfg: ClassementCfg; onSort: (col: ComCol) => void }) {
  // Périmètre clientèle appliqué aux lignes, donc au calcul (cf. `perimetreCom`).
  const { stats } = comStats(clienteleRows(api.rows, cfg.clientele), cfg.periode, new Date());
  const signe = cfg.dir === "asc" ? 1 : -1;
  const tries = [...stats].sort((a, b) => (a[cfg.tri] - b[cfg.tri]) * signe);
  const maxCapex = Math.max(1, ...stats.map((c) => c.capex));

  /* ⚠️ L'en-tête collant DOIT avoir un fond OPAQUE, sinon les lignes défilent en
     transparence dessous. D'où la teinte de la carte plutôt que `transparent` quand une
     couleur est choisie — un gris posé sur un pastel couperait la carte en deux. */
  const zone = tintOf(useContext(WidgetTintCtx)).head || T.surface2;
  const TH: CSSProperties = { position: "sticky", top: 0, zIndex: 1, background: zone, padding: "9px 10px", textAlign: "left", fontSize: "10.5px", fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap", borderBottom: `1px solid ${T.line}` };
  const THN: CSSProperties = { ...TH, textAlign: "right" };
  const TD: CSSProperties = { padding: "10px", borderBottom: `1px solid ${T.line}`, fontSize: "12.5px", fontWeight: 500, color: T.ink2, verticalAlign: "middle" };
  const TDN: CSSProperties = { ...TD, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  /* En-tête TRIABLE : un bouton, pas un `<th>` cliquable — le tri doit être atteignable
     au clavier, et un `th` ne l'est pas. La flèche dit le sens ; elle ne se déduit pas
     de la seule couleur. */
  const thTri = (col: ComCol, label: string) => {
    const actif = cfg.tri === col;
    return (
      <th key={col} style={THN} aria-sort={actif ? (cfg.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button onClick={() => onSort(col)} title={`Trier par ${label}`}
          style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: "10.5px", fontWeight: 700, color: actif ? T.brand700 : T.ink3, textTransform: "uppercase", letterSpacing: ".05em" }}>
          {label}
          {actif
            ? (cfg.dir === "asc" ? <ChevronUp aria-hidden style={{ width: 12, height: 12 }} /> : <ChevronDown aria-hidden style={{ width: 12, height: 12 }} />)
            : <ChevronDown aria-hidden style={{ width: 12, height: 12, opacity: 0.35 }} />}
        </button>
      </th>
    );
  };

  return (
    <Widget icon={Users} title="Classement des commerciaux"
      sub={api.loading ? "Chargement…"
        : `${stats.length} commercial${stats.length > 1 ? "aux" : ""} — trié par ${COM_COLS.find((c) => c.key === cfg.tri)?.label}${perimetreCom(api.rows, cfg.clientele)}`}>
      {api.error ? (
        <EmptyState icon={Users} dense title="Donnée indisponible"
          hint="La source « Abonnés » n'a pas répondu. Le classement complet reste dans le tableau de bord KPI." />
      ) : api.loading ? (
        <div style={{ padding: "14px 16px" }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="slb-skel" style={{ display: "block", height: 34, marginBottom: 8, borderRadius: T.rSm, background: T.neutral050 }} />
          ))}
        </div>
      ) : !stats.length ? (
        <EmptyState icon={Users} dense title="Aucun contrat signé sur la période"
          hint="Élargissez la période dans le menu ⋮ « Options »." />
      ) : (
        <>
          <ScrollBody>
            {/* `overflowX` sur le conteneur du tableau : dix colonnes ne tiennent pas
                dans un widget en demi-largeur, et un tableau qui déborde du bloc serait
                pire qu'un tableau qui défile. */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
                <thead>
                  <tr>
                    <th style={TH}>#</th>
                    <th style={TH}>Commercial</th>
                    {thTri("capex", "CAPEX HT")}
                    <th style={THN}>Tendance</th>
                    {thTri("contrats", "Signés")}
                    {thTri("annules", "Annulés")}
                    {thTri("tauxPose", "Taux pose")}
                    {thTri("delaiMoy", "Délai sig.")}
                    <th style={TH}>12 mois</th>
                    <th style={THN}>Installs.</th>
                  </tr>
                </thead>
                <tbody>
                  {tries.map((c, i) => {
                    /* Le liseré or ne s'applique qu'au tri par CAPEX décroissant : sur un
                       autre tri, les trois premières lignes ne sont pas « le podium », et
                       les dorer raconterait un classement qui n'est pas affiché. */
                    const podium = i < 3 && cfg.tri === "capex" && cfg.dir === "desc";
                    return (
                      <tr key={c.nom}>
                        <td style={TD}>
                          <span style={{
                            display: "inline-grid", placeItems: "center", width: 24, height: 24, borderRadius: 999,
                            fontSize: "11.5px", fontWeight: 700, fontVariantNumeric: "tabular-nums",
                            background: !podium ? "transparent" : i === 0 ? T.solar050 : i === 1 ? T.neutral050 : T.warn050,
                            color: !podium ? T.ink4 : i === 0 ? T.solar600 : i === 1 ? T.ink2 : T.warnInk,
                            boxShadow: podium ? `inset 0 0 0 1px ${i === 1 ? T.line2 : T.solar100}` : "none",
                          }}>{i + 1}</span>
                        </td>
                        <td style={TD}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <Monogram name={c.nom} size={32} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: "13px", fontWeight: 600, color: T.ink, whiteSpace: "nowrap" }}>{c.nom}</div>
                              <div style={{ fontSize: "11.5px", fontWeight: 500, color: T.ink3, whiteSpace: "nowrap" }}>
                                {c.aboMoyen > 0 ? `Abonnement moyen ${Math.round(c.aboMoyen)} €/mois` : DASH}
                              </div>
                            </div>
                          </div>
                        </td>
                        {/* CAPEX : montant PUIS barre relative au meilleur — c'est la
                            comparaison qui se lit d'abord dans ce tableau. */}
                        <td style={TD}>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: T.ink, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtMEur(c.capex)}</div>
                          <span aria-hidden style={{ display: "block", width: 150, height: 5, marginTop: 5, borderRadius: 999, background: T.neutral050, overflow: "hidden" }}>
                            <span style={{ display: "block", height: "100%", width: `${Math.round((c.capex / maxCapex) * 100)}%`, background: podium ? T.solar : T.brand, borderRadius: 999 }} />
                          </span>
                        </td>
                        {/* TENDANCE : icône ET signe, jamais la couleur seule. */}
                        <td style={TDN}>
                          {c.tendance === 0 ? (
                            <span style={{ color: T.ink4 }}>{DASH}</span>
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontWeight: 700, color: c.tendance > 0 ? T.okInk : T.dangerInk }}>
                              {c.tendance > 0 ? <ChevronUp aria-hidden style={{ width: 13, height: 13 }} /> : <ChevronDown aria-hidden style={{ width: 13, height: 13 }} />}
                              {c.tendance > 0 ? `+${c.tendance}` : c.tendance}
                            </span>
                          )}
                        </td>
                        <td style={TDN}>{c.contrats}</td>
                        <td style={TDN}>
                          {c.annules > 0 ? (
                            <span style={{ color: T.dangerInk, fontWeight: 700 }}>
                              {c.annules}<span style={{ fontSize: "11.5px", fontWeight: 600, color: T.ink3 }}> ({c.tauxAnnulation} %)</span>
                            </span>
                          ) : <span style={{ color: T.ink4 }}>{DASH}</span>}
                        </td>
                        {/* Taux de pose : vert au-delà de 70 %, ambre en dessous — et le
                            chiffre est écrit, la couleur ne fait que le doubler. */}
                        <td style={TDN}>
                          <span style={{ fontWeight: 700, color: c.tauxPose >= 70 ? T.okInk : c.tauxPose >= 40 ? T.warnInk : T.ink3 }}>
                            {c.tauxPose} %
                          </span>
                        </td>
                        <td style={TDN}>{c.delaiMoy ? `${c.delaiMoy} j` : DASH}</td>
                        <td style={TD}><Sparkline data={c.monthly} /></td>
                        <td style={TDN}>{c.installateurs || DASH}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ScrollBody>
          <AggregateNote api={api} style={{ padding: "10px 16px 12px", borderTop: `1px solid ${T.line}` }} />
        </>
      )}
    </Widget>
  );
}

function ClassementCard({ id, cfg }: { id: string; cfg: ClassementCfg }) {
  /* Le tri par en-tête écrit la cfg — donc il est PERSISTÉ : on retrouve son classement
     au rechargement. Cliquer la colonne déjà triée inverse le sens, comme partout. */
  const writer = useCfgWriter();
  const onSort = (col: ComCol) => {
    if (!writer) return;                       // widget rendu hors du tableau de bord
    writer.save(col === cfg.tri ? { ...cfg, dir: cfg.dir === "desc" ? "asc" : "desc" } : { ...cfg, tri: col, dir: "desc" });
  };
  void id;
  return <SourceFeed source="comKpi">{(s) => <ClassementWidget api={s} cfg={cfg} onSort={onSort} />}</SourceFeed>;
}

/* ── TOUS LES INSTALLATEURS — le classement du bloc KPI, en version RESSERRÉE ────
   Repris de la capture du bloc `dashboard-KPI` (2026-08-06), mais volontairement PLUS
   SIMPLE : là-bas neuf colonnes de chiffres, ici QUATRE, et les deux graphiques gardés
   — la barre de volume sous les signés, la courbe sur 12 mois. Le reste (annulés, taux
   d'annulation, poses, délai) reste dans le bloc KPI, qui est fait pour l'analyse ; un
   widget d'accueil doit se lire d'un coup d'œil.

   ⚠️ AUCUN CALCUL PROPRE : `comStats(…, "installateur")` réutilise exactement le calcul
   du classement commercial. C'était la condition pour que ce widget existe — deux
   agrégats concurrents sur les mêmes dossiers finiraient par se contredire, et on ne
   saurait pas lequel croire. Mêmes critères, donc : portefeuille = contrat signé JOINT,
   annulés exclus des totaux, « posé » = « Etat facture 2 » à « Validée ».

   La RECHERCHE n'est pas un ornement : le parc compte ~112 installateurs, un classement
   sans filtre n'y est pas exploitable. Elle est locale et non persistée (même règle que
   la barre d'outils des widgets liste, §9-bis). --- */
const INST_COLS = [
  { key: "contrats", label: "Signés" },
  { key: "capex", label: "CAPEX HT" },
  { key: "kwc", label: "Puissance" },
  { key: "tauxPose", label: "Taux pose" },
] as const;
type InstCol = (typeof INST_COLS)[number]["key"];
type InstCfg = { periode: PodiumPeriode; tri: InstCol; dir: "asc" | "desc"; clientele: Clientele };

const coerceInstCfg = (raw: unknown): InstCfg => {
  const o = asObj(raw);
  const p = asText(o.periode);
  const t = asText(o.tri);
  return {
    periode: PODIUM_PERIODES.some((x) => x.key === p) ? (p as PodiumPeriode) : "annee",
    tri: INST_COLS.some((c) => c.key === t) ? (t as InstCol) : "contrats",
    dir: o.dir === "asc" ? "asc" : "desc",
    clientele: clienteleOf(raw),
  };
};

const InstOptions = (p: { cfg: InstCfg; onChange: (n: InstCfg) => void }) =>
  <RankOptions cfg={p.cfg} onChange={p.onChange} cols={INST_COLS} />;

/* La puissance se formate avec `fmtKwc` (§9-septies), déjà écrit pour les indicateurs
   globaux : deux fonctions pour « 2 121,5 kWc » finiraient par diverger d'une décimale. */
/** CAPEX : en k€ sous le million, en M€ au-delà — c'est la forme de la capture, et elle
 *  évite « 0,291 M€ » pour un installateur à 291 k€. */
const fmtCapexCourt = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(3).replace(".", ",")} M€` : `${Math.round(n / 1000).toLocaleString("fr-FR")} k€`;

function InstWidget({ api, cfg, onSort }: { api: SourceApi; cfg: InstCfg; onSort: (col: InstCol) => void }) {
  const [q, setQ] = useState("");
  const { stats } = comStats(clienteleRows(api.rows, cfg.clientele), cfg.periode, new Date(), "installateur");
  const signe = cfg.dir === "asc" ? 1 : -1;
  const tries = [...stats].sort((a, b) => (a[cfg.tri] - b[cfg.tri]) * signe);
  // Le RANG est celui du classement complet : filtrer ne renumérote pas (chercher un
  // installateur pour le voir « 1er » alors qu'il est 37e serait un mensonge).
  const avecRang = tries.map((c, i) => ({ c, rang: i + 1 }));
  const terme = foldText(q).trim();
  const vus = terme ? avecRang.filter(({ c }) => foldText(c.nom).includes(terme)) : avecRang;
  const maxContrats = Math.max(1, ...stats.map((c) => c.contrats));

  const TH: CSSProperties = { position: "sticky", top: 0, zIndex: 1, background: T.surface2, textAlign: "right", padding: "8px 10px", fontSize: "10.5px", fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".04em", whiteSpace: "nowrap", borderBottom: `1px solid ${T.line}`, cursor: "pointer" };
  const TD: CSSProperties = { padding: "9px 10px", fontSize: "12.5px", fontWeight: 600, color: T.ink2, textAlign: "right", whiteSpace: "nowrap", borderBottom: `1px solid ${T.line}`, fontVariantNumeric: "tabular-nums" };
  const flecheTri = (col: InstCol) => cfg.tri !== col ? null
    : cfg.dir === "asc" ? <ChevronUp aria-hidden style={{ width: 11, height: 11 }} /> : <ChevronDown aria-hidden style={{ width: 11, height: 11 }} />;

  return (
    <Widget icon={HardHat} title="Tous les installateurs"
      sub={api.loading ? "Chargement…" : `${stats.length} installateur${stats.length > 1 ? "s" : ""} · ${PODIUM_PERIODES.find((p) => p.key === cfg.periode)?.label ?? ""}${perimetreCom(api.rows, cfg.clientele)}`}>
      {api.error ? (
        <EmptyState dense icon={XCircle} title="Classement indisponible"
          hint="La source « Abonnés » n'a pas répondu. Le classement complet reste dans le tableau de bord KPI." />
      ) : api.loading ? (
        <ListSkeleton />
      ) : !stats.length ? (
        <EmptyState dense icon={Inbox} title="Aucun installateur sur la période"
          hint="Seuls les dossiers dont le contrat signé est joint sont comptés." />
      ) : (
        <>
          <div style={{ padding: "10px 16px", borderBottom: `1px solid ${T.line}` }}>
            <label style={{ display: "flex", alignItems: "center", gap: "7px", padding: "6px 10px", borderRadius: T.rSm, border: `1px solid ${T.line}`, background: T.surface2 }}>
              <Search aria-hidden style={{ width: 14, height: 14, color: T.ink4, flex: "none" }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un installateur…"
                aria-label="Rechercher un installateur"
                style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: "12.5px", fontWeight: 500, color: T.ink }} />
              {q !== "" && (
                <button onClick={() => setQ("")} aria-label="Effacer la recherche"
                  style={{ display: "grid", placeItems: "center", flex: "none", width: 18, height: 18, borderRadius: 999, border: "none", background: "none", cursor: "pointer", color: T.ink4 }}>
                  <X aria-hidden style={{ width: 13, height: 13 }} />
                </button>
              )}
            </label>
          </div>
          <ScrollBody>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, textAlign: "left", cursor: "default", width: 28 }}>#</th>
                    <th style={{ ...TH, textAlign: "left", cursor: "default" }}>Installateur</th>
                    {INST_COLS.map((c) => (
                      <th key={c.key} style={TH} onClick={() => onSort(c.key)} title={`Trier par ${c.label}`}
                        aria-sort={cfg.tri === c.key ? (cfg.dir === "asc" ? "ascending" : "descending") : "none"}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", color: cfg.tri === c.key ? T.brand700 : undefined }}>
                          {c.label}{flecheTri(c.key)}
                        </span>
                      </th>
                    ))}
                    <th style={{ ...TH, cursor: "default" }}>12 mois</th>
                  </tr>
                </thead>
                <tbody>
                  {vus.map(({ c, rang }) => (
                    <tr key={c.nom} className="slb-row">
                      <td style={{ ...TD, textAlign: "left", color: T.ink4, fontWeight: 700 }}>{rang}</td>
                      <td style={{ ...TD, textAlign: "left", fontWeight: 700, color: T.ink, maxWidth: 210, overflow: "hidden", textOverflow: "ellipsis" }}
                        title={c.nom}>{c.nom}</td>
                      {/* SIGNÉS + barre de volume : le nombre seul ne dit pas l'écart entre
                          le premier et le dixième, la barre le montre sans un mot. */}
                      <td style={TD}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                          <span style={{ fontWeight: 700, color: T.ink }}>{c.contrats}</span>
                          <span aria-hidden style={{ width: 68, height: 4, borderRadius: 999, background: T.neutral050, overflow: "hidden" }}>
                            <span style={{ display: "block", height: "100%", width: `${pct(c.contrats, maxContrats)}%`, background: T.brand, borderRadius: 999 }} />
                          </span>
                        </div>
                      </td>
                      <td style={TD}>{fmtCapexCourt(c.capex)}</td>
                      <td style={TD}>{c.kwc > 0 ? fmtKwc(c.kwc) : DASH}</td>
                      {/* Taux de pose : vert au-delà de 80 %, ambre sous 50 % — et le chiffre
                          reste écrit, la couleur ne porte jamais l'information seule. */}
                      <td style={{ ...TD, color: c.tauxPose >= 80 ? T.okInk : c.tauxPose < 50 ? T.warnInk : T.ink2 }}>
                        {c.contrats ? `${c.tauxPose} %` : DASH}
                      </td>
                      <td style={{ ...TD, padding: "6px 10px" }}><Sparkline data={c.monthly} /></td>
                    </tr>
                  ))}
                  {!vus.length && (
                    <tr><td colSpan={INST_COLS.length + 3} style={{ ...TD, textAlign: "center", color: T.ink4, fontWeight: 500 }}>
                      Aucun installateur ne correspond à « {q} ».
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </ScrollBody>
          <AggregateNote api={api} style={{ padding: "10px 16px 12px", borderTop: `1px solid ${T.line}` }} />
        </>
      )}
    </Widget>
  );
}

function InstCard({ id, cfg }: { id: string; cfg: InstCfg }) {
  const writer = useCfgWriter();
  const onSort = (col: InstCol) => {
    if (!writer) return;                       // widget rendu hors du tableau de bord
    writer.save(col === cfg.tri ? { ...cfg, dir: cfg.dir === "desc" ? "asc" : "desc" } : { ...cfg, tri: col, dir: "desc" });
  };
  void id;
  return <SourceFeed source="comKpi">{(s) => <InstWidget api={s} cfg={cfg} onSort={onSort} />}</SourceFeed>;
}

/* ============================================================================
   9-octies. EXCEPTIONS — les tuiles de couverture et le registre
   ----------------------------------------------------------------------------
   Reprise de l'onglet Exceptions du bloc `dashboard-KPI`. Une exception est une règle
   dérogatoire accordée soit à UN DOSSIER (périmètre « abonné », table « Projet
   solaire »), soit à UN PARTENAIRE (périmètre « partenaire », table « Partenaire »).
   Les deux tables sont lues séparément puis UNIES en une seule forme de ligne, le
   périmètre venant de la source qui l'a lue (cf. SELECT_EXC_*).

   ⚠️ CES CHIFFRES SONT DES TAUX DE COUVERTURE, donc ils ont des DÉNOMINATEURS : le parc
   de dossiers et le parc de partenaires, lus eux aussi (jamais figés — le parc grossit
   chaque semaine). Quand un parc n'est pas lisible, le pourcentage n'est PAS affiché
   plutôt que calculé sur un compte partiel : c'est très exactement l'erreur qui faisait
   dire « 2 % du parc (100 dossiers) » pour 1 759 dossiers dans le bloc KPI.
   ============================================================================ */
type ExcLigne = {
  id: string; perimetre: "abonne" | "partenaire";
  titre: string; description: string;
  categorie: string; sousCategorie: string; service: string;
  partenaire: string; valideur: string; statut: string;
  justifie: boolean; creeLe: string;
};

/** Union des deux périmètres en UNE forme de ligne. PURE. Le titre d'une exception
 *  abonné est son dossier, celui d'une exception partenaire est son nom : c'est la seule
 *  vraie divergence des deux tables, et elle est résolue ici, une fois. */
function excLignes(abo: Row[], part: Row[]): ExcLigne[] {
  const commun = (r: Row) => ({
    description: asText(r.description),
    categorie: asText(r.categorie),
    sousCategorie: asText(r.sousCategorie),
    service: asText(r.service),
    partenaire: asText(r.installateur),
    valideur: asText(r.valideur),
    justifie: hasFile(r.justificatif),
    creeLe: asText(r.creeLe),
  });
  return [
    ...abo.map((r) => ({ id: r.id, perimetre: "abonne" as const, titre: asText(r.dossier), statut: "", ...commun(r) })),
    ...part.map((r) => ({ id: r.id, perimetre: "partenaire" as const, titre: asText(r.nom), statut: asText(r.statut), ...commun(r) })),
  ].sort((a, b) => b.creeLe.localeCompare(a.creeLe));
}

const EXC_FENETRE_J = 30;

function excKpis(lignes: ExcLigne[], parcDossiers: number | null, parcPartenaires: number | null, now: Date) {
  const t = now.getTime();
  const dans = (l: ExcLigne, depuis: number, jusqu: number) => {
    const d = savTime(l.creeLe);
    return Number.isFinite(d) && d >= t - depuis * 864e5 && d < t - jusqu * 864e5;
  };
  const abonne = lignes.filter((l) => l.perimetre === "abonne");
  const partenaire = lignes.filter((l) => l.perimetre === "partenaire");
  const recentes = lignes.filter((l) => dans(l, EXC_FENETRE_J, 0));
  const precedentes = lignes.filter((l) => dans(l, EXC_FENETRE_J * 2, EXC_FENETRE_J));
  const validees = partenaire.filter((l) => l.statut === "Validée");
  const sansJustif = lignes.filter((l) => !l.justifie);
  /* Les DOSSIERS et PARTENAIRES concernés se comptent en distinct : dix exceptions sur
     un même dossier ne font toujours qu'un dossier couvert. C'est ce qui distingue la
     COUVERTURE (combien sont touchés) de l'INTENSITÉ (combien par touché). */
  const dossiers = new Set(abonne.map((l) => l.titre).filter(Boolean)).size;
  const partenaires = new Set(lignes.map((l) => l.partenaire).filter(Boolean)).size;
  return {
    total: lignes.length,
    abonne: abonne.length,
    partenaire: partenaire.length,
    recentes: recentes.length,
    precedentes: precedentes.length,
    validees: validees.length,
    partValidees: partenaire.length ? validees.length / partenaire.length : 0,
    sansJustif: sansJustif.length,
    partSansJustif: lignes.length ? sansJustif.length / lignes.length : 0,
    dossiers,
    parcDossiers,
    partDossiers: parcDossiers ? dossiers / parcDossiers : null,
    parDossier: dossiers ? abonne.length / dossiers : 0,
    partenaires,
    parcPartenaires,
    partPartenaires: parcPartenaires ? partenaires / parcPartenaires : null,
    parPartenaire: partenaires ? lignes.length / partenaires : 0,
  };
}
type ExcKpis = ReturnType<typeof excKpis>;

/** Nombre à une décimale, virgule française — « 2,5 exceptions par installateur ». */
const fmtDec = (n: number): string => n.toFixed(1).replace(".", ",");
/** Pourcentage lisible même très petit : « 0,3 % » plutôt que « 0 % », qui se lirait
 *  comme « aucun » alors que six dossiers sont concernés. */
const fmtPct = (p: number): string => (p > 0 && p < 0.01 ? fmtDec(p * 100) : `${Math.round(p * 100)}`) + " %";

type ExcMetric = {
  key: string; label: string; icon?: LucideIcon; groupe: "volume" | "couverture";
  value: (k: ExcKpis) => string;
  sub?: (k: ExcKpis) => string;
  warnSub?: (k: ExcKpis) => boolean;
  bar?: (k: ExcKpis) => number | undefined;
};
const EXC_METRICS: ExcMetric[] = [
  { key: "total", label: "Exceptions", icon: ClipboardList, groupe: "volume",
    value: (k) => `${k.total}`,
    sub: (k) => `${k.abonne} abonné · ${k.partenaire} partenaire` },
  { key: "recentes", label: `${EXC_FENETRE_J} derniers jours`, icon: CalendarClock, groupe: "volume",
    value: (k) => `${k.recentes}`,
    /* La comparaison NOMME la période précédente au lieu d'afficher un pourcentage :
       passer de 0 à 21 ne fait pas « +2 100 % », ça fait « aucune avant ». */
    sub: (k) => (k.precedentes
      ? `${k.precedentes} sur les ${EXC_FENETRE_J} j précédents`
      : `aucune sur les ${EXC_FENETRE_J} j précédents`) },
  { key: "validees", label: "Validées (partenaire)", icon: CheckCircle, groupe: "volume",
    value: (k) => `${k.validees}`,
    sub: (k) => `${fmtPct(k.partValidees)} du périmètre partenaire`,
    bar: (k) => k.partValidees },
  { key: "sansJustif", label: "Sans justificatif", icon: FileSignature, groupe: "volume",
    value: (k) => `${k.sansJustif}`,
    sub: (k) => `${fmtPct(k.partSansJustif)} des exceptions`,
    warnSub: (k) => k.sansJustif > 0 },
  { key: "dossiers", label: "Dossiers avec exceptions", icon: Users, groupe: "couverture",
    value: (k) => `${k.dossiers}`,
    /* Sans dénominateur SÛR, on dit le compte lu et on TAIT le pourcentage : un taux sur
       un parc partiel serait surévalué sans que rien ne le signale. */
    sub: (k) => (k.partDossiers != null
      ? `${fmtPct(k.partDossiers)} du parc (${k.parcDossiers} dossiers)`
      : "parc non lu : pas de taux"),
    bar: (k) => k.partDossiers ?? undefined },
  { key: "parDossier", label: "Exceptions / dossier", icon: BarChart3, groupe: "couverture",
    value: (k) => fmtDec(k.parDossier),
    sub: (k) => (k.dossiers ? `moyenne sur les ${k.dossiers} dossiers concernés` : "aucun dossier concerné") },
  { key: "partenaires", label: "Installateurs avec exceptions", icon: HardHat, groupe: "couverture",
    value: (k) => `${k.partenaires}`,
    sub: (k) => (k.partPartenaires != null
      ? `${fmtPct(k.partPartenaires)} du parc (${k.parcPartenaires} partenaires)`
      : "parc non lu : pas de taux"),
    bar: (k) => k.partPartenaires ?? undefined },
  { key: "parPartenaire", label: "Exceptions / installateur", icon: BarChart3, groupe: "couverture",
    value: (k) => fmtDec(k.parPartenaire),
    sub: (k) => (k.partenaires ? `moyenne sur les ${k.partenaires} installateurs concernés` : "aucun installateur concerné") },
];
const EXC_SHOW_DEFAULT = EXC_METRICS.map((m) => m.key);

type ExcIndicsCfg = { show: string[] };
const coerceExcIndicsCfg = (raw: unknown): ExcIndicsCfg => {
  const o = asObj(raw);
  const known = new Set(EXC_METRICS.map((m) => m.key));
  if (!Array.isArray(o.show)) return { show: [...EXC_SHOW_DEFAULT] };
  return { show: Array.from(new Set(o.show.filter((x: unknown): x is string => typeof x === "string" && known.has(x)))) };
};

function ExcIndicsOptions({ cfg, onChange }: { cfg: ExcIndicsCfg; onChange: (next: ExcIndicsCfg) => void }) {
  const on = new Set(cfg.show);
  const toggle = (key: string) => {
    const next = new Set(on);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange({ show: EXC_METRICS.filter((m) => next.has(m.key)).map((m) => m.key) });
  };
  const lbl: CSSProperties = { display: "block", fontSize: "10.5px", fontWeight: 700, color: T.ink4, textTransform: "uppercase", letterSpacing: ".05em", margin: "8px 0 4px" };
  const line: CSSProperties = { display: "flex", alignItems: "center", gap: "9px", padding: "6px 4px", cursor: "pointer", fontSize: "12.5px", fontWeight: 500, color: T.ink2 };
  const bloc = (g: ExcMetric["groupe"], titre: string) => (
    <>
      <span style={lbl}>{titre}</span>
      {EXC_METRICS.filter((m) => m.groupe === g).map((m) => (
        <label key={m.key} style={line}>
          <input type="checkbox" checked={on.has(m.key)} onChange={() => toggle(m.key)}
            style={{ width: 15, height: 15, accentColor: T.brand, flex: "none", cursor: "pointer" }} />
          <span>{m.label}</span>
        </label>
      ))}
    </>
  );
  return <div>{bloc("volume", "Volume")}{bloc("couverture", "Couverture du parc & intensité")}</div>;
}

function ExcIndicsWidget({ cfg, abo, part, parcA, parcP }: {
  cfg: ExcIndicsCfg; abo: SourceApi; part: SourceApi; parcA: SourceApi; parcP: SourceApi;
}) {
  const zone = tintOf(useContext(WidgetTintCtx)).head || T.surface2;
  const lignes = excLignes(abo.rows, part.rows);
  /* Un parc n'est un dénominateur QUE s'il est complet : `partial` ou vide → `null`, et
     les tuiles concernées taisent leur pourcentage. */
  const parcDossiers = parcA.partial || !parcA.rows.length ? null : parcA.rows.length;
  const parcPartenaires = parcP.partial || !parcP.rows.length ? null : parcP.rows.length;
  const k = excKpis(lignes, parcDossiers, parcPartenaires, new Date());
  const on = new Set(cfg.show);
  const tuiles = (g: ExcMetric["groupe"]): Tile[] => EXC_METRICS.filter((m) => m.groupe === g && on.has(m.key)).map((m) => ({
    key: m.key, label: m.label, icon: m.icon,
    value: m.value(k), sub: m.sub?.(k), warn: !!m.warnSub?.(k), bar: m.bar?.(k),
  }));
  const volume = tuiles("volume");
  const couverture = tuiles("couverture");
  const chargement = abo.loading || part.loading;
  const enErreur = abo.error || part.error;
  /* Sources non connectées : `rows` est vide en production, et un écran de zéros se
     lirait comme « aucune exception ». On dit ce qui manque. */
  const muet = !CATALOG.excAbo.connected && !CATALOG.excPart.connected && !lignes.length;

  return (
    <Widget icon={ClipboardList} title="Exceptions"
      sub={chargement ? "Chargement…" : "Volume, couverture du parc et intensité"}>
      {enErreur ? (
        <EmptyState icon={ClipboardList} dense title="Donnée indisponible"
          hint="Les tables d'exceptions n'ont pas répondu. Le détail complet reste dans le tableau de bord KPI." />
      ) : chargement ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(182px, 1fr))", gap: "14px", padding: "14px 16px 16px" }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="slb-skel" style={{ display: "block", height: 104, borderRadius: T.rLg, background: T.neutral050 }} />
          ))}
        </div>
      ) : muet ? (
        <EmptyState icon={ClipboardList} dense title="Sources d'exceptions non connectées"
          hint="Les tables « Projet solaire » et « Partenaire » doivent être connectées à ce bloc pour que ces chiffres existent." />
      ) : !volume.length && !couverture.length ? (
        <EmptyState icon={ClipboardList} dense title="Aucun indicateur affiché"
          hint="Choisissez ce que ce widget doit montrer dans son menu ⋮ « Options »." />
      ) : (
        <div style={{ background: zone }}>
          {volume.length > 0 && <KpiTiles tiles={volume} zone={zone} />}
          {/* L'INTERTITRE sépare le volume de la couverture, comme sur le tableau de bord
              KPI : « 21 exceptions » et « 0,3 % du parc » ne répondent pas à la même
              question, et les aligner sans rien dire les ferait lire comme une suite. */}
          {couverture.length > 0 && (
            <>
              <div style={{ padding: volume.length ? "2px 16px 0" : "12px 16px 0", fontSize: "10.5px", fontWeight: 700, color: T.ink4, textTransform: "uppercase", letterSpacing: ".05em" }}>
                Couverture du parc &amp; intensité
              </div>
              <KpiTiles tiles={couverture} zone={zone} />
            </>
          )}
          {/* DEUX sources ici (les deux périmètres d'exception) : la note porte sur la plus
              en retard des deux — un total est incomplet dès qu'UNE de ses sources l'est. */}
          <AggregateNote style={{ padding: "0 16px 14px" }}
            api={{ rows: [], loading: false, error: false,
              draining: !!abo.draining || !!part.draining,
              partial: !!abo.partial || !!part.partial,
              /* Même règle pour l'instantané que pour les deux autres états : le total est
                 daté dès qu'UNE de ses sources l'est, et à la date de la PLUS ANCIENNE —
                 dater un total de son composant le plus frais serait le flatter. */
              stale: !!abo.stale || !!part.stale,
              at: [abo.at, part.at].filter((d): d is number => !!d).sort((a, b) => a - b)[0] }} />
        </div>
      )}
    </Widget>
  );
}

/* Quatre sources imbriquées — deux périmètres et deux parcs. Le dispatch statique les
   monte une par une ; celles qui ne sont pas connectées servent leur mock en aperçu et
   une liste vide en production (§6-bis), donc le widget vit avant leur branchement. */
function ExcIndicsCard({ cfg }: { cfg: ExcIndicsCfg }) {
  return (
    <SourceFeed source="excAbo">{(abo) => (
      <SourceFeed source="excPart">{(part) => (
        <SourceFeed source="parcAbo">{(parcA) => (
          <SourceFeed source="parcPart">{(parcP) => (
            <ExcIndicsWidget cfg={cfg} abo={abo} part={part} parcA={parcA} parcP={parcP} />
          )}</SourceFeed>
        )}</SourceFeed>
      )}</SourceFeed>
    )}</SourceFeed>
  );
}

/* ── LE REGISTRE — le tableau des exceptions, ligne par ligne ───────────────────
   Neuf colonnes, dont le périmètre en badge et la description sous le titre. Le tri par
   date vit dans la cfg (donc persisté), comme celui du classement des commerciaux. --- */
type ExcRegistreCfg = { perimetre: "tous" | "abonne" | "partenaire"; dir: "asc" | "desc"; limite: number };
const EXC_LIMITES = [10, 25, 50, 100];
const coerceExcRegistreCfg = (raw: unknown): ExcRegistreCfg => {
  const o = asObj(raw);
  const p = asText(o.perimetre);
  const n = Number(o.limite);
  return {
    perimetre: p === "abonne" || p === "partenaire" ? p : "tous",
    dir: o.dir === "asc" ? "asc" : "desc",
    limite: EXC_LIMITES.includes(n) ? n : 25,
  };
};

function ExcRegistreOptions({ cfg, onChange }: { cfg: ExcRegistreCfg; onChange: (next: ExcRegistreCfg) => void }) {
  const lbl: CSSProperties = { display: "block", fontSize: "10.5px", fontWeight: 700, color: T.ink4, textTransform: "uppercase", letterSpacing: ".05em", margin: "8px 0 4px" };
  const seg = (active: boolean): CSSProperties => ({ flex: 1, padding: "6px 4px", borderRadius: T.rSm, border: `1px solid ${active ? T.brand : T.line}`, background: active ? T.brand050 : T.surface, color: active ? T.brand700 : T.ink2, fontFamily: "inherit", fontSize: "12px", fontWeight: 700, cursor: "pointer" });
  return (
    <div>
      <span style={{ ...lbl, marginTop: "2px" }}>Périmètre</span>
      <div style={{ display: "flex", gap: "6px" }}>
        {([["tous", "Tous"], ["abonne", "Abonné"], ["partenaire", "Partenaire"]] as const).map(([k, l]) => (
          <button key={k} style={seg(cfg.perimetre === k)} onClick={() => onChange({ ...cfg, perimetre: k })}
            aria-pressed={cfg.perimetre === k}>{l}</button>
        ))}
      </div>
      <span style={lbl}>Les plus</span>
      <div style={{ display: "flex", gap: "6px" }}>
        <button style={seg(cfg.dir === "desc")} onClick={() => onChange({ ...cfg, dir: "desc" })} aria-pressed={cfg.dir === "desc"}>Récentes</button>
        <button style={seg(cfg.dir === "asc")} onClick={() => onChange({ ...cfg, dir: "asc" })} aria-pressed={cfg.dir === "asc"}>Anciennes</button>
      </div>
      <span style={lbl}>Nombre de lignes</span>
      <div style={{ display: "flex", gap: "6px" }}>
        {EXC_LIMITES.map((n) => (
          <button key={n} style={seg(cfg.limite === n)} onClick={() => onChange({ ...cfg, limite: n })} aria-pressed={cfg.limite === n}>{n}</button>
        ))}
      </div>
    </div>
  );
}

function ExcRegistreWidget({ cfg, abo, part }: { cfg: ExcRegistreCfg; abo: SourceApi; part: SourceApi }) {
  const toutes = excLignes(abo.rows, part.rows);
  const filtrees = cfg.perimetre === "tous" ? toutes : toutes.filter((l) => l.perimetre === cfg.perimetre);
  const lignes = (cfg.dir === "asc" ? [...filtrees].reverse() : filtrees).slice(0, cfg.limite);
  const zone = tintOf(useContext(WidgetTintCtx)).head || T.surface2;

  const TH: CSSProperties = { position: "sticky", top: 0, zIndex: 1, background: zone, padding: "9px 10px", textAlign: "left", fontSize: "10.5px", fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap", borderBottom: `1px solid ${T.line}` };
  const TD: CSSProperties = { padding: "10px", borderBottom: `1px solid ${T.line}`, fontSize: "12.5px", fontWeight: 500, color: T.ink2, verticalAlign: "top" };
  const muet = !CATALOG.excAbo.connected && !CATALOG.excPart.connected && !toutes.length;
  /* Une valeur absente s'écrit avec le tiret cadratin du bloc, jamais une case vide :
     « — » dit « rien à cet endroit », le vide dit « colonne cassée ». */
  const ou = (v: string) => v || DASH;

  return (
    <Widget icon={ClipboardList} title="Registre des exceptions"
      sub={abo.loading || part.loading ? "Chargement…"
        : `${filtrees.length} exception${filtrees.length > 1 ? "s" : ""}${cfg.perimetre === "tous" ? "" : ` — périmètre ${cfg.perimetre === "abonne" ? "abonné" : "partenaire"}`}`}>
      {abo.error || part.error ? (
        <EmptyState icon={ClipboardList} dense title="Donnée indisponible"
          hint="Les tables d'exceptions n'ont pas répondu." />
      ) : abo.loading || part.loading ? (
        <div style={{ padding: "14px 16px" }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="slb-skel" style={{ display: "block", height: 34, marginBottom: 8, borderRadius: T.rSm, background: T.neutral050 }} />
          ))}
        </div>
      ) : muet ? (
        <EmptyState icon={ClipboardList} dense title="Sources d'exceptions non connectées"
          hint="Les tables « Projet solaire » et « Partenaire » doivent être connectées à ce bloc." />
      ) : !lignes.length ? (
        <EmptyState icon={ClipboardList} dense title="Aucune exception sur ce périmètre"
          hint="Changez de périmètre dans le menu ⋮ « Options »." />
      ) : (
        <ScrollBody>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
              <thead>
                <tr>
                  <th style={TH}>Périmètre</th>
                  <th style={TH}>Exception</th>
                  <th style={TH}>Catégorie</th>
                  <th style={TH}>Sous-catégorie</th>
                  <th style={TH}>Service</th>
                  <th style={TH}>Partenaire</th>
                  <th style={TH}>Valideur</th>
                  <th style={TH}>Statut</th>
                  <th style={{ ...TH, textAlign: "right" }}>Créée le</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={`${l.perimetre}:${l.id}`}>
                    <td style={TD}>
                      {/* Le périmètre est une CATÉGORIE, pas un état : badge neutre côté
                          abonné, « info » côté partenaire — jamais vert ni rouge, qui
                          feraient croire à une validation. */}
                      <Badge variant={l.perimetre === "partenaire" ? "info" : "neutral"} icon={l.perimetre === "partenaire" ? Handshake : Users}>
                        {l.perimetre === "partenaire" ? "Partenaire" : "Abonné"}
                      </Badge>
                    </td>
                    <td style={{ ...TD, minWidth: 240, maxWidth: 320 }}>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: T.ink }}>{ou(l.titre)}</div>
                      {/* Description CLAMPÉE à deux lignes : ces textes font parfois un
                          paragraphe, et une ligne de tableau haute de 8 lignes rendrait
                          le registre illisible. Le texte entier reste dans le `title`. */}
                      {l.description && (
                        <div title={l.description} style={{ marginTop: 2, fontSize: "11.5px", fontWeight: 500, color: T.ink3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {l.description}
                        </div>
                      )}
                    </td>
                    <td style={TD}>{l.categorie ? <Badge variant="neutral">{l.categorie}</Badge> : DASH}</td>
                    <td style={TD}>{l.sousCategorie ? <Badge variant="neutral">{l.sousCategorie}</Badge> : DASH}</td>
                    <td style={TD}>{l.service ? <Badge variant="brand">{l.service}</Badge> : DASH}</td>
                    <td style={{ ...TD, whiteSpace: "nowrap" }}>{ou(l.partenaire)}</td>
                    <td style={{ ...TD, whiteSpace: "nowrap" }}>{ou(l.valideur)}</td>
                    {/* Statut : variante dédiée — « Inactif » ne doit pas passer en vert. */}
                    <td style={TD}>{l.statut ? <StatusBadge value={l.statut} variant={excStatutVariant(l.statut)} /> : DASH}</td>
                    <td style={{ ...TD, textAlign: "right", whiteSpace: "nowrap" }} title={fmtDate(l.creeLe)}>{fmtDate(l.creeLe)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ScrollBody>
      )}
    </Widget>
  );
}

function ExcRegistreCard({ cfg }: { cfg: ExcRegistreCfg }) {
  return (
    <SourceFeed source="excAbo">{(abo) => (
      <SourceFeed source="excPart">{(part) => <ExcRegistreWidget cfg={cfg} abo={abo} part={part} />}</SourceFeed>
    )}</SourceFeed>
  );
}

/* ============================================================================
   9-sexies. WIDGETS UTILITAIRES — sans source de données
   ----------------------------------------------------------------------------
   Trois widgets qui ne lisent AUCUNE table : leur contenu est leur cfg, donc il
   voyage dans `layout_json` avec le reste de la disposition. Conséquences utiles :
   ils fonctionnent sans qu'aucune source soit branchée, ils sont propres à chaque
   utilisateur, et ils suivent la personne d'un poste à l'autre (la BDD est la source
   de vérité, cf. §11).

   ⚠️ Ce ne sont PAS des notes d'équipe. Un pense-bête écrit ici n'est visible que de
   son auteur et n'a aucun lien avec les tables « Suivi client » / « Suivi propect ».
   Pour une note partagée, c'est un widget `data` sur la source qui convient.
   ⚠️ Le document de disposition n'est pas une base de données : garder ces contenus
   COURTS (les bornes ci-dessous ne sont pas décoratives — un `layout_json` obèse est
   rechargé à chaque affichage de la page).
   ============================================================================ */
const MEMO_MAX = 2000;        // caractères d'un pense-bête
const CHECK_MAX = 40;         // lignes d'une liste à cocher
/* Caractères d'une ligne — du texte BALISÉ depuis le 2026-08-24, donc les marqueurs
   comptent : « **urgent** » pèse 10 pour 6 affichés. Relevé de 160 à 240 à cette
   occasion, pour que la mise en forme ne coûte pas la moitié de la ligne. Au pire
   40 × 240 ≈ 9,4 ko dans `layout_json`, qui est rechargé à chaque affichage. */
const CHECK_TEXT_MAX = 240;

/** Accès en écriture à sa propre cfg. `null` seulement si le widget est rendu hors du
 *  tableau de bord (aucun `WidgetCfgCtx` au-dessus) — la grille, elle, le fournit
 *  toujours. */
const useCfgWriter = () => useContext(WidgetCfgCtx);

/* --- HORLOGE ------------------------------------------------------------------
   Le seul widget dont l'état vient du temps et non d'une donnée. Deux réglages, et
   le pas de rafraîchissement en découle : afficher les secondes impose un rendu par
   seconde, s'en passer permet de ne se réveiller que toutes les 20 s. Un tableau de
   bord ouvert toute la journée n'a pas à repeindre 86 400 fois pour rien. */
type HorlogeCfg = { secondes: boolean; date: boolean };
const coerceHorlogeCfg = (raw: unknown): HorlogeCfg => {
  const o = asObj(raw);
  return { secondes: o.secondes === true, date: o.date !== false };
};

function HorlogeCard({ cfg }: { cfg: HorlogeCfg }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const period = cfg.secondes ? 1000 : 20000;
    const t = window.setInterval(() => setNow(new Date()), period);
    return () => window.clearInterval(t);
  }, [cfg.secondes]);
  const heure = now.toLocaleTimeString("fr-FR", {
    hour: "2-digit", minute: "2-digit", ...(cfg.secondes ? { second: "2-digit" } : {}),
  });
  const jour = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return (
    <Widget icon={Clock} title="Heure" sub={cfg.date ? undefined : "Heure locale"}>
      <div style={{ padding: "18px 16px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "clamp(30px, 7vw, 44px)", lineHeight: 1, fontWeight: 800, letterSpacing: "-.02em", color: T.ink, fontVariantNumeric: "tabular-nums" }}>
          {heure}
        </div>
        {cfg.date && (
          <div style={{ marginTop: 8, fontSize: "12.5px", fontWeight: 600, color: T.ink3, textTransform: "capitalize" }}>{jour}</div>
        )}
      </div>
    </Widget>
  );
}

function HorlogeOptions({ cfg, onChange }: { cfg: HorlogeCfg; onChange: (next: HorlogeCfg) => void }) {
  const line: CSSProperties = { display: "flex", alignItems: "center", gap: "9px", padding: "6px 4px", cursor: "pointer", fontSize: "12.5px", fontWeight: 500, color: T.ink2 };
  const box: CSSProperties = { width: 15, height: 15, accentColor: T.brand, flex: "none", cursor: "pointer" };
  return (
    <div>
      <label style={line}>
        <input type="checkbox" style={box} checked={cfg.secondes} onChange={(e) => onChange({ ...cfg, secondes: e.target.checked })} />
        <span>Afficher les secondes</span>
      </label>
      <label style={line}>
        <input type="checkbox" style={box} checked={cfg.date} onChange={(e) => onChange({ ...cfg, date: e.target.checked })} />
        <span>Afficher la date du jour</span>
      </label>
    </div>
  );
}

/* --- PENSE-BÊTE, mis en forme À L'ÉCRAN --------------------------------------
   Deux modes : LECTURE (le texte mis en forme) et ÉDITION (la même mise en forme,
   modifiable). Le contenu reste `cfg.text`, une simple CHAÎNE de TEXTE BALISÉ — donc
   les notes déjà écrites restent valides, sans migration.

   ⚠️ CE QUI A CHANGÉ LE 2026-08-24 — L'ÉDITION MONTRE LE RÉSULTAT, PLUS LE BALISAGE.
   La saisie se faisait dans un `<textarea>` : la barre d'outils écrivait « **gras** »
   ou « {rouge}…{/} » et l'auteur relisait ses marqueurs au lieu de son texte. Ces
   marqueurs ne sont plus jamais affichés — ils restent le FORMAT DE STOCKAGE, rien de
   plus. La zone de saisie est un `contentEditable` dont le contenu est CONSTRUIT PAR
   NOUS, nœud par nœud.

   ⚠️ POURQUOI CE N'EST PAS « UN ÉDITEUR HTML » (la crainte, justifiée, de l'ancienne
   version). Trois invariants tiennent la sécurité par CONSTRUCTION, pas par vigilance :
     1. La source de vérité reste le texte balisé. Aucun HTML ne part vers la base, donc
        aucun HTML n'en revient : il n'y a rien à assainir.
     2. Le DOM d'édition est bâti avec `createElement` + `textContent`. Ni `innerHTML`,
        ni `dangerouslySetInnerHTML`, ni `execCommand` (déprécié) nulle part : une
        chaîne n'est JAMAIS interprétée comme du balisage.
     3. La lecture du DOM (`memoDomLines`) ne reconnaît qu'une liste FERMÉE de balises
        et d'attributs ; tout le reste est aplati en texte. Un collage riche est donc
        neutralisé sans qu'on ait à le filtrer — d'ailleurs le collage est intercepté et
        réinséré en texte brut.

   L'ARCHITECTURE, en une phrase : le texte balisé est le modèle, le DOM n'est qu'une
   surface de frappe, et les deux sont réconciliés par SÉRIALISATION.
     · frappe ordinaire → on relit le DOM, on le sérialise, on range le résultat dans
       l'état. Le DOM produit par le navigateur est CONSERVÉ TEL QUEL (il sérialise vers
       le même texte), donc le curseur ne bouge pas : c'est ce qui rend la frappe fluide.
     · mise en forme, puces, collage → on transforme le MODÈLE, on rebâtit le DOM, et on
       replace la sélection par son décalage en caractères (`memoOffsets` / `memoSelect`).

   Le balisage (jamais montré, la barre d'outils l'écrit) :
     **gras**   *italique*   ~~barré~~   {rouge}coloré{/}   « - » en début de ligne
   `\` échappe le caractère suivant : depuis le 2026-08-24 l'écriture échappe tout
   `* ~ { } \` du texte, sinon une note contenant « 3 * 4 * 5 » se relirait en italique.
   La grammaire est LIGNE À LIGNE (une paire de marqueurs ne franchit pas un saut de
   ligne) : les notes d'avant qui ouvraient un gras sur deux lignes perdent la seconde,
   cas assez rare pour ne pas mériter de migration.

   L'enregistrement se fait à la PERTE DE FOCUS et non à chaque frappe : `persistCfg`
   réécrit tout le document `layout_json`, une écriture par caractère saturerait la
   base. Un état « modifié » l'indique entre-temps ; Ctrl/⌘+Entrée enregistre sans
   quitter le champ. */
type MemoCfg = { text: string };
const coerceMemoCfg = (raw: unknown): MemoCfg => ({ text: asText(asObj(raw).text).slice(0, MEMO_MAX) });

/* Palette de la charte, pas de roue chromatique libre : quatre couleurs qui ont déjà
   un sens dans le bloc (danger, attention, ok, marque). */
const MEMO_COLORS: { key: string; label: string; color: string }[] = [
  { key: "rouge", label: "Rouge", color: T.danger },
  { key: "ambre", label: "Ambre", color: T.warn },
  { key: "vert", label: "Vert", color: T.ok },
  { key: "teal", label: "Teal", color: T.brand },
];
const MEMO_COLOR_OF: Record<string, string> = Object.fromEntries(MEMO_COLORS.map((c) => [c.key, c.color]));
/* Index INVERSE (valeur CSS → clé de la palette), sous les deux écritures qu'un
   navigateur peut rendre dans `style.color`. Il ne sert qu'en secours : un fragment
   dupliqué par le navigateur garde normalement son `data-c`. */
const MEMO_KEY_OF_CSS: Record<string, string> = Object.fromEntries(
  MEMO_COLORS.flatMap((c) => {
    const n = parseInt(c.color.slice(1), 16);
    return [[c.color.toLowerCase(), c.key], [`rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`, c.key]];
  }),
);

/* ---- LE MODÈLE --------------------------------------------------------------
   Une note est une LISTE DE LIGNES, chaque ligne portant son statut de puce et une
   suite de fragments homogènes (mêmes attributs). Toutes les opérations d'édition
   travaillent là-dessus, jamais sur la chaîne balisée : le balisage n'est qu'une
   sérialisation d'entrée/sortie. */
type MemoAttrs = { b?: 1; i?: 1; s?: 1; c?: string };
type MemoSpan = MemoAttrs & { t: string };
type MemoLine = { puce: boolean; spans: MemoSpan[] };

const memoSame = (x: MemoAttrs, y: MemoAttrs) => x.b === y.b && x.i === y.i && x.s === y.s && x.c === y.c;
const memoAttrs = (a: MemoAttrs): MemoAttrs => ({ b: a.b, i: a.i, s: a.s, c: a.c });
/** Recolle les fragments voisins de mêmes attributs et jette les vides. Appelé à
 *  chaque construction : sans lui le balisage produit se couvrirait de marqueurs
 *  redondants (« **a****b** ») au fil des retouches. */
function memoFuse(spans: MemoSpan[]): MemoSpan[] {
  const out: MemoSpan[] = [];
  for (const sp of spans) {
    if (!sp.t) continue;
    const last = out.length ? out[out.length - 1] : null;
    if (last && memoSame(last, sp)) last.t += sp.t;
    else out.push({ ...sp });
  }
  return out;
}

/** Texte balisé → modèle. Scanner à pile : chaque marqueur de style BASCULE son attribut
 *  jusqu'à la fin de la ligne, et `\x` rend `x` littéral. Un marqueur orphelin laisse donc
 *  son attribut ouvert jusqu'au saut de ligne — comportement volontaire : c'est ce qui rend
 *  le tour de piste « lire → réécrire » stable.
 *
 *  ⚠️ LES COULEURS, elles, s'EMPILENT : « {rouge}a {vert}b{/} c{/} » rend « c » en ROUGE,
 *  pas en noir. Sans cette pile, le premier `{/}` refermerait toute couleur et le second
 *  s'afficherait tel quel, marqueur visible au milieu du texte. Le cas n'a rien d'exotique :
 *  il suffit de recolorer une portion d'un passage déjà coloré, ce que la barre d'outils
 *  invite à faire — c'est le défaut relevé le 2026-08-21 sur le bloc partenaire. L'éditeur
 *  n'écrit plus jamais de couleurs imbriquées (le modèle est plat), mais les notes déjà
 *  écrites en contiennent, et elles doivent se relire à l'identique. */
function memoScanLine(src: string): MemoSpan[] {
  const out: MemoSpan[] = [];
  let a: MemoAttrs = {}, buf = "", i = 0;
  const pileC: (string | undefined)[] = [];
  const vider = () => { if (buf) { out.push({ ...a, t: buf }); buf = ""; } };
  const bascule = (k: "b" | "i" | "s") => { vider(); a = { ...a }; if (a[k]) delete a[k]; else a[k] = 1; };
  while (i < src.length) {
    const c = src[i];
    if (c === "\\" && i + 1 < src.length) { buf += src[i + 1]; i += 2; continue; }
    if (c === "*" && src[i + 1] === "*") { bascule("b"); i += 2; continue; }
    if (c === "~" && src[i + 1] === "~") { bascule("s"); i += 2; continue; }
    if (c === "*") { bascule("i"); i += 1; continue; }
    if (c === "{") {
      const j = src.indexOf("}", i + 1);
      const nom = j === -1 ? "" : src.slice(i + 1, j);
      if (nom === "/" && pileC.length) { vider(); a = { ...a, c: pileC.pop() }; i = j + 1; continue; }
      if (MEMO_COLOR_OF[nom]) { vider(); pileC.push(a.c); a = { ...a, c: nom }; i = j + 1; continue; }
    }
    buf += c; i += 1;
  }
  vider();
  return memoFuse(out);
}
const memoParse = (text: string): MemoLine[] =>
  text.split("\n").map((ln) => ({ puce: ln.startsWith("- "), spans: memoScanLine(ln.startsWith("- ") ? ln.slice(2) : ln) }));

/** Modèle → texte balisé. Ordre d'imbrication FIXE (couleur, gras, barré, italique) :
 *  un contenu donné n'a qu'une écriture possible, donc « Modifications non
 *  enregistrées » ne s'allume pas sur du bruit de balisage. */
const memoEsc = (t: string) => t.replace(/[\\*~{}]/g, "\\$&");
const memoWrite = (lines: MemoLine[]): string =>
  lines.map((l) => (l.puce ? "- " : "") + memoFuse(l.spans).map((sp) => {
    let t = memoEsc(sp.t);
    if (sp.i) t = `*${t}*`;
    if (sp.s) t = `~~${t}~~`;
    if (sp.b) t = `**${t}**`;
    if (sp.c) t = `{${sp.c}}${t}{/}`;
    return t;
  }).join("")).join("\n");

/* ---- DÉCALAGES ET RETOUCHES -------------------------------------------------
   Un DÉCALAGE (« offset ») compte les caractères VISIBLES, saut de ligne compris et
   « - » de puce exclu : c'est l'unité commune au modèle et à la sélection du navigateur,
   celle qui permet de replacer un curseur après avoir rebâti le DOM. Les retouches
   passent toutes par un aplatissement caractère par caractère : à ce prix (une note
   fait 2 000 signes au plus) l'index d'un caractère EST son décalage, et il ne reste
   aucune arithmétique de bornes où se tromper. */
type MemoCar = MemoAttrs & { ch: string; puce: boolean };
const memoNu = (lines: MemoLine[]) => lines.map((l) => l.spans.map((s) => s.t).join("")).join("\n");
function memoCars(lines: MemoLine[]): MemoCar[] {
  const out: MemoCar[] = [];
  lines.forEach((l, i) => {
    if (i > 0) out.push({ ch: "\n", puce: false });
    for (const sp of l.spans) for (let k = 0; k < sp.t.length; k++) out.push({ ...memoAttrs(sp), ch: sp.t[k], puce: l.puce });
  });
  return out;
}
/** L'inverse. Une ligne prend la puce de son premier caractère : une ligne à puce VIDE
 *  la perd donc en repassant par ici — sans conséquence, elle n'affiche rien. */
const memoLignes = (cars: MemoCar[]): MemoLine[] => {
  const bloc: MemoCar[][] = [[]];
  for (const c of cars) { if (c.ch === "\n") bloc.push([]); else bloc[bloc.length - 1].push(c); }
  return bloc.map((cs) => ({ puce: cs.length > 0 && cs[0].puce, spans: memoFuse(cs.map((c) => ({ ...memoAttrs(c), t: c.ch }))) }));
};
/** Réécrit les attributs des caractères de [a,b). Les sauts de ligne sont épargnés. */
function memoMapAttrs(lines: MemoLine[], a: number, b: number, fn: (at: MemoAttrs) => MemoAttrs): MemoLine[] {
  const cars = memoCars(lines);
  for (let i = Math.max(0, a); i < Math.min(cars.length, b); i++) {
    if (cars[i].ch === "\n") continue;
    cars[i] = { ...fn(memoAttrs(cars[i])), ch: cars[i].ch, puce: cars[i].puce };
  }
  return memoLignes(cars);
}
/** Vrai si TOUS les caractères de [a,b) vérifient `pred` — c'est ce qui fait des
 *  boutons des BASCULES : une sélection déjà toute en gras se dégrasse. */
function memoTous(lines: MemoLine[], a: number, b: number, pred: (at: MemoAttrs) => boolean): boolean {
  const cars = memoCars(lines);
  let vu = false;
  for (let i = Math.max(0, a); i < Math.min(cars.length, b); i++) {
    if (cars[i].ch === "\n") continue;
    vu = true;
    if (!pred(cars[i])) return false;
  }
  return vu;
}
/** Le caractère « du point d'insertion » : celui de gauche (comme tout traitement de
 *  texte), à défaut celui de droite. */
const memoCarAt = (lines: MemoLine[], off: number): MemoCar | null => {
  const cars = memoCars(lines);
  const c = (off > 0 ? cars[off - 1] : undefined) ?? cars[off];
  return c && c.ch !== "\n" ? c : null;
};
const memoAt = (lines: MemoLine[], off: number): MemoAttrs => memoAttrs(memoCarAt(lines, off) ?? {});
/** Remplace [a,b) par du texte brut (sauts de ligne compris), aux attributs donnés. */
function memoRemplace(lines: MemoLine[], a: number, b: number, ins: string, at: MemoAttrs, puce: boolean): MemoLine[] {
  const cars = memoCars(lines);
  const ajout: MemoCar[] = [];
  for (const ch of ins.replace(/\r\n?/g, "\n")) ajout.push(ch === "\n" ? { ch, puce: false } : { ...at, ch, puce });
  cars.splice(a, b - a, ...ajout);
  return memoLignes(cars);
}
/** Bascule la puce sur toutes les lignes touchées par [a,b). */
function memoBasculePuces(lines: MemoLine[], a: number, b: number): MemoLine[] {
  const bornes: { d: number; f: number }[] = [];
  let p = 0;
  lines.forEach((l, i) => {
    if (i > 0) p += 1;
    const len = l.spans.reduce((n, s) => n + s.t.length, 0);
    bornes.push({ d: p, f: p + len });
    p += len;
  });
  const cibles = lines.map((_, i) => i).filter((i) => bornes[i].d <= b && bornes[i].f >= a);
  const toutes = cibles.length > 0 && cibles.every((i) => lines[i].puce);
  return lines.map((l, i) => (cibles.indexOf(i) === -1 ? l : { ...l, puce: !toutes }));
}

/* ---- RENDU (la lecture et l'édition partagent ces styles) ------------------- */
const memoStyle = (a: MemoAttrs): CSSProperties => ({
  fontWeight: a.b ? 700 : undefined,
  fontStyle: a.i ? "italic" : undefined,
  textDecoration: a.s ? "line-through" : undefined,
  color: a.c ? MEMO_COLOR_OF[a.c] : a.b ? T.ink : undefined,
});
const MEMO_UL: CSSProperties = { margin: "2px 0 6px", paddingLeft: 18 };
const MEMO_LI: CSSProperties = { margin: "2px 0" };
const MEMO_TEXTE: CSSProperties = { fontSize: "13px", fontWeight: 500, color: T.ink2, lineHeight: 1.55, overflowWrap: "anywhere" };
const memoSpansUI = (l: MemoLine, k: string) =>
  l.spans.map((sp, i) => <span key={`${k}-${i}`} style={memoStyle(sp)}>{sp.t}</span>);

/** Rendu en lecture : les lignes « - » deviennent des puces, regroupées en une seule
 *  liste tant qu'elles se suivent. Le reste garde ses espaces et ses sauts de ligne. */
function MemoRead({ text }: { text: string }) {
  const blocs: ReactNode[] = [];
  let puces: { i: number; l: MemoLine }[] = [];
  const viderPuces = () => {
    if (!puces.length) return;
    blocs.push(<ul key={`u${blocs.length}`} style={MEMO_UL}>{puces.map(({ i, l }) => <li key={i} style={MEMO_LI}>{memoSpansUI(l, `u${i}`)}</li>)}</ul>);
    puces = [];
  };
  memoParse(text).forEach((l, i) => {
    if (l.puce) { puces.push({ i, l }); return; }
    viderPuces();
    blocs.push(
      <div key={`l${i}`} style={{ whiteSpace: "pre-wrap", minHeight: l.spans.length ? undefined : "1em" }}>
        {memoSpansUI(l, `l${i}`)}
      </div>,
    );
  });
  viderPuces();
  return <div style={MEMO_TEXTE}>{blocs}</div>;
}

/* ---- LE DOM D'ÉDITION : construction, puis relecture ------------------------
   ⚠️ `textContent`, jamais `innerHTML` : aucune chaîne n'est interprétée comme du
   balisage, dans un sens comme dans l'autre. Les `data-*` portent l'attribut de façon
   explicite ; les styles ne sont là que pour l'œil (la relecture sait les lire aussi,
   au cas où le navigateur duplique un fragment). */
function memoSpanEl(doc: Document, sp: MemoSpan): HTMLElement {
  const el = doc.createElement("span");
  el.textContent = sp.t;
  if (sp.b) { el.dataset.b = "1"; el.style.fontWeight = "700"; el.style.color = T.ink; }
  if (sp.i) { el.dataset.i = "1"; el.style.fontStyle = "italic"; }
  if (sp.s) { el.dataset.s = "1"; el.style.textDecoration = "line-through"; }
  if (sp.c) { el.dataset.c = sp.c; el.style.color = MEMO_COLOR_OF[sp.c]; }
  return el;
}
function memoBuild(root: HTMLElement, lines: MemoLine[]) {
  const doc = root.ownerDocument;
  while (root.firstChild) root.removeChild(root.firstChild);
  let ul: HTMLElement | null = null;
  for (const l of lines) {
    let hote: HTMLElement;
    if (l.puce) {
      if (!ul) {
        ul = doc.createElement("ul");
        ul.style.margin = String(MEMO_UL.margin);
        ul.style.paddingLeft = "18px";
        root.appendChild(ul);
      }
      hote = doc.createElement("li");
      hote.style.margin = String(MEMO_LI.margin);
      ul.appendChild(hote);
    } else {
      ul = null;
      hote = doc.createElement("div");
      root.appendChild(hote);
    }
    const spans = memoFuse(l.spans);
    /* Une ligne vide a besoin d'un <br> : sans lui le navigateur ne sait pas y poser un
       curseur, et la ligne n'occupe aucune hauteur. */
    if (!spans.length) hote.appendChild(doc.createElement("br"));
    else for (const sp of spans) hote.appendChild(memoSpanEl(doc, sp));
  }
}

const MEMO_BLOC = /^(DIV|P|LI|UL|OL|H[1-6]|BLOCKQUOTE|PRE|SECTION|ARTICLE|TABLE|TBODY|THEAD|TR|TD|TH|FIGURE|FIGCAPTION|HEADER|FOOTER|MAIN|ASIDE|NAV|HR)$/;
const memoEstBloc = (n: Node): boolean => n.nodeType === 1 && MEMO_BLOC.test((n as HTMLElement).tagName);
/** Attributs portés par un élément. LISTE FERMÉE : tout ce qui n'est pas ici (fond,
 *  police, taille, lien…) est ignoré, donc aplati en texte. C'est là que le collage
 *  riche est neutralisé — par construction, pas par filtrage. */
function memoAttrsDe(el: HTMLElement, a: MemoAttrs): MemoAttrs {
  const n: MemoAttrs = { ...a }, st = el.style, tag = el.tagName, d = el.dataset;
  const fw = st.fontWeight;
  if (tag === "STRONG" || tag === "B" || d.b === "1" || fw === "bold" || fw === "bolder" || (/^\d+$/.test(fw) && Number(fw) >= 600)) n.b = 1;
  if (tag === "EM" || tag === "I" || d.i === "1" || st.fontStyle === "italic") n.i = 1;
  if (tag === "S" || tag === "STRIKE" || tag === "DEL" || d.s === "1" || `${st.textDecoration} ${st.textDecorationLine}`.indexOf("line-through") !== -1) n.s = 1;
  const c = d.c && MEMO_COLOR_OF[d.c] ? d.c : MEMO_KEY_OF_CSS[st.color.trim().toLowerCase()];
  if (c) n.c = c;
  return n;
}
/** DOM → modèle. Le seul point de vérité sur « ce que contient la zone de saisie » :
 *  c'est lui qui décide si la frappe du navigateur a produit quelque chose de nouveau. */
function memoDomLines(root: Node): MemoLine[] {
  const out: MemoLine[] = [];
  let cur: MemoLine | null = null;
  const ouvre = (puce: boolean) => { cur = { puce, spans: [] }; out.push(cur); };
  const pose = (t: string, a: MemoAttrs) => {
    if (!t) return;
    if (!cur) ouvre(false);
    out[out.length - 1].spans.push({ ...a, t });
  };
  const enligne = (nodes: Node[], a: MemoAttrs, puce: boolean) => {
    nodes.forEach((n, i) => {
      /* L'insécable que les navigateurs sèment pour tenir les espaces de fin redevient
         une espace ordinaire : le modèle n'a pas à connaître ce détail de rendu. */
      if (n.nodeType === 3) return pose((n.nodeValue ?? "").replace(/\u00A0/g, " "), a);
      if (n.nodeType !== 1) return;
      const el = n as HTMLElement;
      if (el.tagName === "BR") {
        /* Le <br> de remplissage que les navigateurs posent dans un bloc vide ne compte
           PAS pour un saut de ligne : sinon chaque ligne vide en vaudrait deux. */
        const suite = nodes.slice(i + 1).some((x) => x.nodeType === 1 || (x.nodeValue ?? "").length > 0);
        if (suite || !cur) ouvre(puce);
        return;
      }
      if (memoEstBloc(el)) return bloc(el, a);
      enligne(Array.from(el.childNodes), memoAttrsDe(el, a), puce);
    });
  };
  const bloc = (el: HTMLElement, a: MemoAttrs) => {
    const tag = el.tagName;
    if (tag === "HR") return;
    const at = memoAttrsDe(el, a);
    const kids = Array.from(el.childNodes);
    if (tag === "UL" || tag === "OL" || kids.some(memoEstBloc)) {
      kids.forEach((k) => (memoEstBloc(k) ? bloc(k as HTMLElement, at) : enligne([k], at, tag === "LI")));
      return;
    }
    ouvre(tag === "LI");
    enligne(kids, at, tag === "LI");
  };
  const kids = Array.from(root.childNodes);
  if (kids.some(memoEstBloc)) kids.forEach((k) => (memoEstBloc(k) ? bloc(k as HTMLElement, {}) : enligne([k], {}, false)));
  else enligne(kids, {}, false);
  return out.map((l) => ({ puce: l.puce, spans: memoFuse(l.spans) }));
}

/* ---- SÉLECTION : DOM ↔ décalages --------------------------------------------
   Le décalage d'un point du DOM s'obtient en CLONANT tout ce qui le précède et en le
   passant au même sérialiseur — de cette façon les deux comptages ne peuvent pas
   divergier sur une convention (le <br> de remplissage, l'espace insécable, la puce…). */
/** Un point de sélection peut être exprimé « entre deux enfants » d'un élément
 *  (`(root, 1)` = juste avant le 2ᵉ bloc). Tel quel, le clonage laisserait tomber le
 *  saut de ligne qui précède : on descend donc jusqu'au nœud le plus profond. */
function memoNorm(node: Node, off: number): [Node, number] {
  while (node.nodeType === 1) {
    const kids = node.childNodes;
    if (!kids.length) break;
    if (off <= 0) { node = kids[0]; off = 0; continue; }
    if (off >= kids.length) {
      const last = kids[kids.length - 1];
      node = last;
      off = last.nodeType === 3 ? (last.nodeValue ?? "").length : last.childNodes.length;
      continue;
    }
    node = kids[off];
    off = 0;
  }
  return [node, off];
}
function memoOffset(root: HTMLElement, node: Node, off: number): number {
  const doc = root.ownerDocument;
  const r = doc.createRange();
  r.setStart(root, 0);
  const [n2, o2] = memoNorm(node, off);
  try { r.setEnd(n2, o2); } catch { return 0; }
  const box = doc.createElement("div");
  box.appendChild(r.cloneContents());
  return memoNu(memoDomLines(box)).length;
}
/* ---- LA SÉLECTION SOUS SOFTR — corrigé le 2026-08-24 -------------------------
   ⚠️ LE BLOC VIBE CODE EST RENDU DANS UN SHADOW DOM. C'est l'hypothèse déjà retenue
   ailleurs dans ce projet (le `platform.js` d'Elfsight scanne `document` et ne voit pas
   le conteneur rendu par React), et elle a une conséquence directe ici :
   `document.getSelection()` ne renvoie PAS les nœuds d'un arbre d'ombre — il donne le
   conteneur hôte, ou rien. `memoOffsets` retournait donc `null` dans Softr, et TOUTE la
   barre d'outils (gras, couleurs, puces) devenait inerte, alors que la frappe, elle,
   continuait de marcher. En local, hors shadow DOM, le même code fonctionne : d'où un
   défaut invisible au développement et systématique en production.

   ⚠️ NE JAMAIS APPELER `document.getSelection()` DIRECTEMENT ICI. Trois chemins, un par
   moteur, tous branchés sur l'arbre qui héberge réellement le champ (`getRootNode()`) :
     · Chrome/Edge : `shadowRoot.getSelection()` — hors standard, mais présent ;
     · Safari et Chrome récents : `getComposedRanges({ shadowRoots })`, la voie standard,
       dont deux signatures coexistent encore ;
     · Firefox et hors shadow DOM : `document.getSelection()` suffit, il ne bride pas.
   Hors shadow DOM, `getRootNode()` renvoie le document : le comportement local est donc
   exactement celui d'avant. */
type MemoRootNode = (Document | ShadowRoot) & { getSelection?: () => Selection | null };
/** L'objet `Selection` de l'arbre où vit le champ — c'est lui qui sert aussi à POSER la
 *  sélection (`memoSelect`). */
function memoSelection(root: HTMLElement): Selection | null {
  const arbre = root.getRootNode() as MemoRootNode;
  const via = typeof arbre.getSelection === "function" ? arbre.getSelection() : null;
  return via ?? root.ownerDocument.getSelection();
}
/** Le point de départ et d'arrivée de la sélection, s'ils sont bien DANS le champ. */
function memoRange(root: HTMLElement): { sc: Node; so: number; ec: Node; eo: number } | null {
  const sel = memoSelection(root);
  if (!sel) return null;
  const dans = (sc: Node, ec: Node) => root.contains(sc) && root.contains(ec);
  if (sel.rangeCount > 0) {
    const r = sel.getRangeAt(0);
    if (dans(r.startContainer, r.endContainer)) {
      return { sc: r.startContainer, so: r.startOffset, ec: r.endContainer, eo: r.endOffset };
    }
  }
  /* Le range rendu ci-dessus s'arrête à la frontière de l'arbre d'ombre : on redemande
     la sélection COMPOSÉE, seule voie standard pour la voir en entier. */
  const arbre = root.getRootNode();
  const gcr = (sel as unknown as { getComposedRanges?: (...a: unknown[]) => StaticRange[] }).getComposedRanges;
  if (typeof gcr !== "function" || arbre === root.ownerDocument) return null;
  for (const args of [[{ shadowRoots: [arbre] }], [arbre]]) {
    let sr: StaticRange | undefined;
    try { sr = gcr.apply(sel, args)[0]; } catch { continue; }
    if (sr && dans(sr.startContainer, sr.endContainer)) {
      return { sc: sr.startContainer, so: sr.startOffset, ec: sr.endContainer, eo: sr.endOffset };
    }
  }
  return null;
}
function memoOffsets(root: HTMLElement): { a: number; b: number } | null {
  const r = memoRange(root);
  return r ? { a: memoOffset(root, r.sc, r.so), b: memoOffset(root, r.ec, r.eo) } : null;
}
/** Plage des caractères AJOUTÉS entre deux textes, par préfixe et suffixe communs.
 *  Filet de sécurité : si un moteur ne nous laisse voir aucune sélection, c'est ce qui
 *  permet à la mise en forme en attente (« je clique Gras, puis j'écris ») de savoir où
 *  s'appliquer. Rend `null` s'il n'y a pas eu d'ajout. */
function memoAjout(av: string, ap: string): { a: number; b: number } | null {
  if (ap.length <= av.length) return null;
  let i = 0;
  while (i < av.length && av[i] === ap[i]) i++;
  let j = 0;
  while (j < av.length - i && av[av.length - 1 - j] === ap[ap.length - 1 - j]) j++;
  return { a: i, b: ap.length - j };
}
/** Décalage → point du DOM. Balayage des nœuds texte ET des lignes vides (qui n'en
 *  contiennent aucun, mais peuvent parfaitement accueillir le curseur) : quelques
 *  dizaines de nœuds au plus, et seulement quand on vient de rebâtir le DOM. */
function memoPoint(root: HTMLElement, want: number): [Node, number] {
  const w = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n: Node | null, dernier: [Node, number] = [root, 0];
  while ((n = w.nextNode())) {
    if (n.nodeType === 3) {
      const d = memoOffset(root, n, 0), len = (n.nodeValue ?? "").length;
      if (want <= d + len) return [n, Math.max(0, want - d)];
      dernier = [n, len];
      continue;
    }
    const tag = (n as HTMLElement).tagName;
    if ((tag !== "DIV" && tag !== "LI") || (n.textContent ?? "").length > 0) continue;
    const d = memoOffset(root, n, 0);
    if (want <= d) return [n, 0];
    dernier = [n, 0];
  }
  return dernier;
}
/** Les seules balises que `memoBuild` écrit. Tout ce qui n'est pas là dedans vient du
 *  navigateur ou d'un dépôt, et signale un DOM à rebâtir. */
const MEMO_SALE = "*:not(div):not(ul):not(li):not(span):not(br)";
function memoSelect(root: HTMLElement, a: number, b: number) {
  const sel = memoSelection(root);
  if (!sel) return;
  const [na, oa] = memoPoint(root, a), [nb, ob] = memoPoint(root, b);
  try { sel.setBaseAndExtent(na, oa, nb, ob); } catch { /* nœud parti entre-temps : tant pis */ }
}

/* ---- CHAMP DE TEXTE MIS EN FORME — le composant partagé ---------------------
   Extrait de `MemoCard` le 2026-08-24, quand la LISTE À COCHER a demandé la même
   mise en forme que le pense-bête. Tout ce qui touche au DOM d'édition, à la sélection
   et à la barre d'outils vit ICI ; les deux widgets ne gardent que leur propre logique
   (ce qu'ils enregistrent, et quand).

   Le contrat est celui d'un champ CONTRÔLÉ : `value` est du texte balisé, `onChange`
   rend le texte balisé suivant. Rien d'autre ne sort — pas de HTML, jamais.

   Deux régimes :
   · MULTILIGNE (pense-bête) — Entrée saute une ligne, les puces sont proposées,
     Ctrl/⌘+Entrée appelle `onValider`.
   · MONOLIGNE (une ligne de liste à cocher) — Entrée VALIDE, Échap annule, et un
     collage multi-ligne est aplati en espaces : une ligne de liste reste une ligne. */
type RichOutil = "b" | "i" | "s" | "puces" | "couleurs";

function RichText({
  value, onChange, outils, max, aria,
  multiligne = false, placeholder, minHeight = 34, maxHeight, autoFocus,
  outilsAuFocus = false, onValider, onAnnuler, onBlur,
}: {
  value: string;
  onChange: (t: string) => void;
  outils: RichOutil[];
  max: number;
  aria: string;
  multiligne?: boolean;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  autoFocus?: boolean;
  /** Barre d'outils repliée tant que le champ est vide ET sans focus — pour une zone
   *  d'ajout qui doit rester discrète au repos. */
  outilsAuFocus?: boolean;
  onValider?: () => void;
  onAnnuler?: () => void;
  onBlur?: () => void;
}) {
  const [foc, setFoc] = useState(false);
  /** Attributs mis en évidence sur la barre d'outils (état de la sélection). */
  const [actifs, setActifs] = useState<MemoAttrs>({});
  const edRef = useRef<HTMLDivElement | null>(null);
  /** Le texte que le DOM représente ACTUELLEMENT. Égal à `value` ⇒ rien à rebâtir, donc
   *  curseur intact : c'est toute l'astuce de la frappe fluide. `null` force la
   *  reconstruction (montage, mise en forme, collage). */
  const domRef = useRef<string | null>(null);
  /** Sélection à replacer APRÈS reconstruction. */
  const posRef = useRef<{ a: number; b: number } | null>(null);
  /** Dernière sélection connue — sert à distinguer un vrai déplacement du curseur de
   *  notre propre repositionnement, et à survivre au clic sur la barre d'outils. */
  const selRef = useRef<{ a: number; b: number } | null>(null);
  /** Mise en forme EN ATTENTE : cliquer « Gras » sans rien sélectionner ne peut pas
   *  transformer du texte, alors on retient l'intention et on l'applique aux caractères
   *  de la frappe suivante. Sans ça, le geste le plus naturel (« je clique gras, puis
   *  j'écris ») ne produirait rien de visible. */
  const pendRef = useRef<MemoAttrs | null>(null);

  /* Réconciliation modèle → DOM. En `useLayoutEffect` : le curseur est reposé avant que
     l'écran ne soit peint, donc aucun saut visible. */
  useLayoutEffect(() => {
    const ed = edRef.current;
    if (!ed || domRef.current === value) return;
    memoBuild(ed, memoParse(value));
    domRef.current = value;
    const p = posRef.current;
    posRef.current = null;
    if (p) { memoSelect(ed, p.a, p.b); selRef.current = p; }
  }, [value]);

  /* Prise de focus au montage (édition d'une ligne existante) : curseur EN FIN, comme
     tout champ qu'on rouvre pour corriger. */
  useLayoutEffect(() => {
    const ed = edRef.current;
    if (!ed || !autoFocus) return;
    const fin = memoNu(memoParse(value)).length;
    ed.focus();
    memoSelect(ed, fin, fin);
    selRef.current = { a: fin, b: fin };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Suivi de la sélection : met à jour l'état des boutons, et ANNULE la mise en forme en
     attente dès que le curseur bouge pour de bon (notre propre repositionnement, lui,
     réaligne `selRef` et ne compte donc pas comme un déplacement). */
  useEffect(() => {
    const doc = edRef.current?.ownerDocument;
    if (!doc) return;
    /* `selectionchange` part du document, mais les moteurs le redispatchent aussi sur
       l'arbre d'ombre qui contient le champ : on écoute LES DEUX, sinon la barre d'outils
       ne se met plus à jour sous Softr (même cause que `memoSelection`). */
    const arbre = edRef.current?.getRootNode();
    const cibles: EventTarget[] = arbre && arbre !== doc ? [doc, arbre] : [doc];
    const onSel = () => {
      const ed = edRef.current;
      if (!ed) return;
      const s = memoOffsets(ed);
      if (!s) return;
      const p = selRef.current;
      if (!p || p.a !== s.a || p.b !== s.b) pendRef.current = null;
      selRef.current = s;
      const lines = memoParse(value);
      const a = Math.min(s.a, s.b), b = Math.max(s.a, s.b);
      setActifs(pendRef.current ?? (a === b ? memoAt(lines, a) : {
        b: memoTous(lines, a, b, (x) => !!x.b) ? 1 : undefined,
        i: memoTous(lines, a, b, (x) => !!x.i) ? 1 : undefined,
        s: memoTous(lines, a, b, (x) => !!x.s) ? 1 : undefined,
        c: MEMO_COLORS.map((k) => k.key).find((k) => memoTous(lines, a, b, (x) => x.c === k)),
      }));
    };
    cibles.forEach((c) => c.addEventListener("selectionchange", onSel));
    return () => cibles.forEach((c) => c.removeEventListener("selectionchange", onSel));
  }, [value]);

  /** Applique une transformation au MODÈLE, puis demande la reconstruction du DOM avec la
   *  sélection replacée. Les transformations passées ici ne changent JAMAIS le nombre de
   *  caractères visibles : les décalages restent donc valables. */
  const retouche = (fn: (lines: MemoLine[], a: number, b: number) => MemoLine[]) => {
    const ed = edRef.current;
    if (!ed) return;
    const s = memoOffsets(ed) ?? selRef.current;
    if (!s) return;
    const a = Math.min(s.a, s.b), b = Math.max(s.a, s.b);
    const t = memoWrite(fn(memoParse(value), a, b));
    if (t.length > max) return;
    domRef.current = null;
    posRef.current = { a, b };
    onChange(t);
    ed.focus();
  };
  /** Bascule un attribut sur la sélection — ou le met en attente si le curseur est seul.
   *  `k = "c"` traite la couleur, dont la valeur remplace au lieu de s'ajouter. */
  const bascule = (k: "b" | "i" | "s" | "c", val?: string) => {
    const ed = edRef.current;
    if (!ed) return;
    /* Dernier repli : le bout du texte. Un moteur qui ne nous laisse voir aucune sélection
       ne doit pas rendre la barre d'outils muette — le clic devient alors une mise en forme
       EN ATTENTE, qui s'appliquera à ce qui sera tapé (cf. `memoAjout`). */
    const fin = memoNu(memoParse(value)).length;
    const s = memoOffsets(ed) ?? selRef.current ?? { a: fin, b: fin };
    const pose = (at: MemoAttrs, off: boolean): MemoAttrs => {
      const n: MemoAttrs = { ...at };
      if (off) delete n[k];
      else if (k === "c") n.c = val;
      else n[k] = 1;
      return n;
    };
    if (s.a === s.b) {
      const base = pendRef.current ?? memoAt(memoParse(value), s.a);
      const n = pose(base, k === "c" ? base.c === val : !!base[k]);
      pendRef.current = n;
      setActifs(n);
      ed.focus();
      return;
    }
    retouche((lines, a, b) => {
      const off = memoTous(lines, a, b, (x) => (k === "c" ? x.c === val : !!x[k]));
      return memoMapAttrs(lines, a, b, (at) => pose(at, off));
    });
  };

  /* Frappe. Le DOM est déjà à l'écran : on ne fait que le LIRE. Il n'est rebâti que si
     une mise en forme en attente doit s'appliquer, si le champ monoligne a reçu un saut
     de ligne, ou si la note dépasse sa borne. */
  const onInput = () => {
    const ed = edRef.current;
    if (!ed) return;
    let dl = memoDomLines(ed);
    /* Un champ MONOLIGNE ne garde qu'une ligne : ce qui a été introduit par un chemin
       détourné (glisser, saisie vocale, autocomplétion) est recollé avec une espace. */
    const aplati = !multiligne && dl.length > 1;
    if (aplati) dl = [{ puce: false, spans: memoFuse(dl.flatMap((l, i) => (i ? [{ t: " " }, ...l.spans] : l.spans))) }];
    const nuAv = memoNu(memoParse(value)), nuAp = memoNu(dl);
    const avant = nuAv.length, apres = nuAp.length;
    let t = memoWrite(dl);
    if (t.length > max) {
      /* Borne dure : la frappe est REFUSÉE et le DOM revient au dernier état accepté (un
         `layout_json` obèse est rechargé à chaque affichage de la page, cf. §9-sexies). */
      const s = memoOffsets(ed);
      const recul = Math.max(1, apres - avant);
      memoBuild(ed, memoParse(value));
      domRef.current = value;
      if (s) memoSelect(ed, Math.max(0, s.a - recul), Math.max(0, s.b - recul));
      return;
    }
    const pend = pendRef.current;
    const s = memoOffsets(ed);
    /* Où viennent d'atterrir les caractères tapés : le curseur le dit, et à défaut la
       comparaison des deux textes (moteur qui ne nous montre aucune sélection). */
    const ins = s && s.a === s.b && apres > avant ? { a: Math.max(0, s.b - (apres - avant)), b: s.b } : memoAjout(nuAv, nuAp);
    if (pend && ins) {
      t = memoWrite(memoMapAttrs(dl, ins.a, ins.b, () => pend));
      domRef.current = null;
      posRef.current = { a: ins.b, b: ins.b };
    } else if (aplati || ed.querySelector(MEMO_SALE)) {
      /* Le DOM contient une balise que nous n'écrivons jamais (un <a>, un <font>, une
         image…), ou une ligne de trop : la sérialisation l'a bien aplatie, mais l'ÉCRAN
         montrerait encore l'original. On rebâtit, pour que ce qui s'affiche soit ce qui
         est stocké. */
      domRef.current = null;
      posRef.current = s;
    } else {
      if (apres <= avant) pendRef.current = null;
      domRef.current = t;   // le DOM du navigateur sérialise déjà vers `t` : on le garde
    }
    onChange(t);
  };

  /** Insère du TEXTE BRUT à la place de [a,b), aux attributs du point d'insertion. C'est
   *  la seule insertion que nous faisons nous-mêmes (collage, dépôt), et elle passe par le
   *  MODÈLE : rien de ce qui vient du presse-papiers n'entre jamais dans le DOM. */
  const insere = (brut: string, s: { a: number; b: number }) => {
    const propre = multiligne ? brut : brut.replace(/[\r\n]+/g, " ");
    const a = Math.min(s.a, s.b), b = Math.max(s.a, s.b);
    const lines = memoParse(value);
    const car = memoCarAt(lines, a);
    const t = memoWrite(memoRemplace(lines, a, b, propre, pendRef.current ?? memoAttrs(car ?? {}), !!car && car.puce));
    if (t.length > max) return;
    const fin = a + propre.replace(/\r\n?/g, "\n").length;
    domRef.current = null;
    posRef.current = { a: fin, b: fin };
    onChange(t);
  };
  const onPaste = (e: ReactClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const ed = edRef.current;
    if (!ed) return;
    const brut = e.clipboardData.getData("text/plain");
    const s = memoOffsets(ed) ?? selRef.current;
    if (brut && s) insere(brut, s);
  };
  /* Le DÉPÔT est intercepté comme le collage — sans quoi le navigateur laisserait tomber
     du HTML complet dans la zone. Sa position n'est pas la sélection : on la demande au
     navigateur (deux API selon les moteurs), avec un repli sur la fin du texte. */
  const onDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const ed = edRef.current;
    if (!ed) return;
    const brut = e.dataTransfer.getData("text/plain");
    if (!brut) return;
    /* Deux API pour « quel point du texte est sous ce pixel », et aucune n'est partout :
       `caretPositionFromPoint` est la standard, `caretRangeFromPoint` (dépréciée) reste la
       seule de WebKit. Sous shadow DOM elles peuvent aussi ne répondre que l'hôte — d'où le
       repli sur la FIN du texte, qui vaut toujours mieux qu'un dépôt perdu. */
    const doc = ed.ownerDocument as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };
    let off = memoNu(memoParse(value)).length;
    const p = doc.caretPositionFromPoint ? doc.caretPositionFromPoint(e.clientX, e.clientY) : null;
    const r = p ? null : doc.caretRangeFromPoint ? doc.caretRangeFromPoint(e.clientX, e.clientY) : null;
    if (p && ed.contains(p.offsetNode)) off = memoOffset(ed, p.offsetNode, p.offset);
    else if (r && ed.contains(r.startContainer)) off = memoOffset(ed, r.startContainer, r.startOffset);
    insere(brut, { a: off, b: off });
  };

  /* Raccourcis. Ctrl/⌘+B/I/U sont INTERCEPTÉS : laissés au navigateur, ils appelleraient
     son `execCommand` interne et sèmeraient des balises que nous n'avons pas écrites. */
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const meta = e.ctrlKey || e.metaKey;
    if (e.key === "Escape" && onAnnuler) { e.preventDefault(); onAnnuler(); return; }
    if (e.key === "Enter" && (meta || !multiligne)) { e.preventDefault(); onValider?.(); return; }
    if (!meta) return;
    const k = e.key.toLowerCase();
    if (k === "b" && outils.indexOf("b") !== -1) { e.preventDefault(); bascule("b"); }
    else if (k === "i" && outils.indexOf("i") !== -1) { e.preventDefault(); bascule("i"); }
    else if (k === "u") e.preventDefault();   // pas de souligné dans la grammaire
  };

  const tool = (on?: boolean): CSSProperties => ({
    display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: T.rSm,
    border: `1px solid ${on ? T.brand100 : T.line}`, background: on ? T.brand050 : T.surface, color: on ? T.brand600 : T.ink2,
    cursor: "pointer", fontFamily: "inherit", flex: "none",
  });
  /* `onMouseDown` neutralisé sur toute la barre : un bouton qui prend le focus effacerait
     la sélection du texte, et le clic n'aurait plus rien sur quoi s'appliquer. */
  const garde = (e: { preventDefault: () => void }) => e.preventDefault();
  const ico = { width: 13, height: 13 };
  const montrerOutils = !outilsAuFocus || foc || value.length > 0;

  return (
    <div>
      {montrerOutils && (
        <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap", marginBottom: 6 }} onMouseDown={garde}>
          {outils.indexOf("b") !== -1 && (
            <button style={tool(!!actifs.b)} aria-pressed={!!actifs.b} onClick={() => bascule("b")} aria-label="Gras" title="Gras (Ctrl+B)"><Bold aria-hidden style={ico} /></button>
          )}
          {outils.indexOf("i") !== -1 && (
            <button style={tool(!!actifs.i)} aria-pressed={!!actifs.i} onClick={() => bascule("i")} aria-label="Italique" title="Italique (Ctrl+I)"><Italic aria-hidden style={ico} /></button>
          )}
          {outils.indexOf("s") !== -1 && (
            <button style={tool(!!actifs.s)} aria-pressed={!!actifs.s} onClick={() => bascule("s")} aria-label="Barré" title="Barré"><Strikethrough aria-hidden style={ico} /></button>
          )}
          {outils.indexOf("puces") !== -1 && (
            <button style={tool()} onClick={() => retouche(memoBasculePuces)} aria-label="Liste à puces" title="Liste à puces"><List aria-hidden style={ico} /></button>
          )}
          {outils.indexOf("couleurs") !== -1 && (
            <>
              <span aria-hidden style={{ width: 1, height: 18, background: T.line, margin: "0 2px" }} />
              {MEMO_COLORS.map((c) => (
                <button key={c.key} onClick={() => bascule("c", c.key)} aria-label={`Couleur ${c.label}`} title={c.label} aria-pressed={actifs.c === c.key}
                  style={{ ...tool(actifs.c === c.key), width: 22, height: 22 }}>
                  <span aria-hidden style={{ width: 11, height: 11, borderRadius: 999, background: c.color,
                    boxShadow: actifs.c === c.key ? `0 0 0 1.5px ${T.surface}, 0 0 0 3px ${c.color}` : undefined }} />
                </button>
              ))}
            </>
          )}
        </div>
      )}
      <div style={{ position: "relative" }}>
        <div
          ref={edRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline={multiligne}
          aria-label={aria}
          onInput={onInput}
          onPaste={onPaste}
          onDrop={onDrop}
          onKeyDown={onKeyDown}
          onFocus={() => setFoc(true)}
          onBlur={() => { setFoc(false); onBlur?.(); }}
          style={{ boxSizing: "border-box", minHeight, maxHeight, overflowY: maxHeight ? "auto" : undefined,
            padding: multiligne ? "10px 11px" : "7px 10px", borderRadius: T.rSm, border: `1px solid ${foc ? T.brand100 : T.line}`,
            background: T.surface, outline: "none", cursor: "text", whiteSpace: "pre-wrap", ...MEMO_TEXTE }}
        />
        {!value && placeholder && (
          <div aria-hidden style={{ position: "absolute", top: multiligne ? 11 : 8, left: 12, right: 12, pointerEvents: "none",
            ...MEMO_TEXTE, color: T.ink4, whiteSpace: "pre-wrap" }}>
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}

function MemoCard({ cfg }: { cfg: MemoCfg }) {
  const writer = useCfgWriter();
  const [text, setText] = useState(cfg.text);
  const [dirty, setDirty] = useState(false);
  // On ouvre en LECTURE quand il y a déjà quelque chose à lire, en édition sinon.
  const [edit, setEdit] = useState(!cfg.text);

  /* La cfg peut changer sous nos pieds (autre onglet, rechargement depuis la BDD). On ne
     l'écrase que si l'utilisateur n'a pas de saisie en cours — sinon on lui volerait ce
     qu'il tape. */
  useEffect(() => { if (!dirty && cfg.text !== text) setText(cfg.text); }, [cfg.text, dirty, text]);
  const commit = () => {
    if (!dirty || !writer) return;
    writer.save({ text: text.slice(0, MEMO_MAX) });
    setDirty(false);
  };

  const maxHeight = useContext(WidgetHeightCtx);
  const reste = MEMO_MAX - text.length;

  return (
    <Widget icon={FileSignature} title="Pense-bête"
      sub={!writer ? "Lecture seule" : dirty ? "Modifications non enregistrées" : "Enregistré"}
      headActions={writer ? (
        <button className="slb-nbtn" style={NBTN_SM} onClick={() => { if (edit) commit(); setEdit(!edit); }}
          aria-label={edit ? "Aperçu" : "Modifier"} title={edit ? "Aperçu" : "Modifier"}>
          {edit ? <Eye aria-hidden style={{ width: 15, height: 15 }} /> : <Pencil aria-hidden style={{ width: 15, height: 15 }} />}
        </button>
      ) : null}>
      <div style={{ padding: "12px 16px 16px" }}>
        {edit && writer ? (
          <>
            <RichText
              value={text}
              onChange={(t) => { setText(t); setDirty(true); }}
              onValider={commit}
              onBlur={commit}
              outils={["b", "i", "s", "puces", "couleurs"]}
              max={MEMO_MAX}
              aria="Pense-bête"
              multiligne
              minHeight={90}
              maxHeight={Math.max(90, maxHeight - 110)}
              placeholder={"Notes personnelles — visibles de vous seul.\nLa barre d'outils met en forme la sélection."}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", marginTop: 8 }}>
              {reste <= 200 && (
                <span style={{ fontSize: "11.5px", fontWeight: 600, color: reste <= 0 ? T.danger : T.ink4 }}>
                  {reste <= 0 ? "Limite atteinte" : `${reste} caractères restants`}
                </span>
              )}
              {dirty && (
                <button className="slb-btnp" onClick={commit}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: T.rSm, border: "none", background: T.brand, color: "#fff", fontFamily: "inherit", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" }}>
                  <Save aria-hidden style={{ width: 14, height: 14 }} />Enregistrer
                </button>
              )}
            </div>
          </>
        ) : text ? (
          <MemoRead text={text} />
        ) : (
          <EmptyState dense icon={FileSignature} title="Pense-bête vide"
            hint={writer ? "Cliquez sur le crayon pour écrire." : "Ce pense-bête est en lecture seule."} />
        )}
      </div>
    </Widget>
  );
}

/* --- LISTE À COCHER -----------------------------------------------------------
   Volontairement DISTINCTE du « Journal des tâches » : celui-ci lit les tâches Airtable
   de l'équipe, celle-ci est un pense-bête à cases, PRIVÉ et sans assignation. Ne pas les
   fusionner — ce sont deux objets métier différents.

   ⚠️ ENRICHIE LE 2026-08-24 (« beaucoup de gens vont l'utiliser »). Trois apports, et
   pour chacun la raison de la forme retenue :

   1. LE TEXTE D'UNE LIGNE EST MIS EN FORME, avec la grammaire et le champ du pense-bête
      (`RichText`) : gras, italique et couleurs, applicables à UN MOT. Le « barré » est
      volontairement absent de la barre — la case cochée le pose déjà, et deux barrés de
      sens différents sur la même ligne ne se distingueraient pas.
      ⚠️ CONSÉQUENCE DE COMPATIBILITÉ : les lignes écrites avant sont du texte brut, et
      sont désormais relues comme du texte BALISÉ. Une ancienne ligne contenant « 3 * 4 * 5 »
      s'affichera donc en italique. C'est le même arbitrage que pour le pense-bête, assumé
      pour n'avoir qu'UNE grammaire dans le bloc ; tout ce qui est saisi depuis le
      2026-08-24 part échappé et ne peut plus être réinterprété.

   2. UNE ÉCHÉANCE FACULTATIVE (`due`, une date ISO « AAAA-MM-JJ »). Elle AFFICHE et
      ALERTE, elle ne trie pas : l'ordre des lignes reste celui que son auteur a choisi,
      parce qu'une liste de rappels se lit dans l'ordre où on compte les faire. Le retard
      remonte dans le sous-titre du widget, là où il se voit sans ouvrir la carte.
      ⚠️ Le jour courant vient de `useJour` et se recalcule tout seul : un tableau de bord
      reste ouvert la nuit, et « Aujourd'hui » ne doit pas mentir au matin.

   3. TROIS GESTES DE PLUS : modifier une ligne (impossible avant — il fallait la
      supprimer et la retaper, ce qui n'était plus tenable dès qu'elle porte une mise en
      forme et une date), replier les lignes faites, et monter/descendre une ligne.
      ⚠️ Le réordonnancement se fait aux FLÈCHES, pas au glisser : le glisser-déposer sert
      déjà à déplacer le widget dans la grille (§11), les deux se marcheraient dessus.
      ⚠️ Quand les lignes faites sont repliées, les flèches déplacent d'un VOISIN VISIBLE
      à l'autre — échanger avec une ligne masquée donnerait l'impression que rien ne bouge.

   Chaque geste (cocher, ajouter, retirer, réordonner, valider une modification) écrit :
   ce sont des actes discrets et rares, contrairement à la frappe au clavier du
   pense-bête, qui n'enregistre qu'à la perte de focus. */
type CheckItem = { id: string; texte: string; fait: boolean; due?: string };
type ChecklistCfg = { items: CheckItem[]; masquerFaites: boolean };

/** Une date d'échéance est une chaîne « AAAA-MM-JJ » — jamais un `Date`, qui ne survit
 *  pas au JSON, et jamais un horodatage : une échéance est un JOUR, pas un instant. */
const CHECK_ISO = /^\d{4}-\d{2}-\d{2}$/;
const coerceChecklistCfg = (raw: unknown): ChecklistCfg => {
  const o = asObj(raw);
  const list = Array.isArray(o.items) ? (o.items as unknown[]) : [];
  const seen = new Set<string>();
  const items: CheckItem[] = [];
  for (const it of list) {
    if (items.length >= CHECK_MAX) break;
    const x = asObj(it);
    const id = asText(x.id);
    const texte = asText(x.texte).slice(0, CHECK_TEXT_MAX);
    if (!id || !texte || seen.has(id)) continue;   // ligne sans texte = ligne perdue, on l'écarte
    seen.add(id);
    const due = asText(x.due);
    const bonne = CHECK_ISO.test(due) && !Number.isNaN(Date.parse(`${due}T12:00:00`));
    items.push({ id, texte, fait: x.fait === true, ...(bonne ? { due } : {}) });
  }
  return { items, masquerFaites: o.masquerFaites === true };
};

/** Le jour local au format ISO. ⚠️ PAS `toISOString()`, qui rend le jour UTC : passé
 *  22 h en France, il renvoie DEMAIN, et toute échéance du jour basculerait « en retard ». */
const checkJour = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Le jour courant, qui se recalcule de lui-même (cf. §3 de l'en-tête). `setState` avec la
 *  même chaîne ne redessine rien : ce réveil ne coûte donc qu'une comparaison par minute. */
function useJour() {
  const [jour, setJour] = useState(() => checkJour(new Date()));
  useEffect(() => {
    const t = window.setInterval(() => setJour(checkJour(new Date())), 60000);
    return () => window.clearInterval(t);
  }, []);
  return jour;
}
/** ⚠️ Les dates ISO se comparent comme des CHAÎNES — même longueur, champs alignés du plus
 *  significatif au moins : pas de `Date` à construire, donc pas de fuseau à se tromper. */
type CheckUrgence = "retard" | "aujourdhui" | "demain" | "avenir";
const checkUrgence = (due: string, jour: string, demain: string): CheckUrgence =>
  due < jour ? "retard" : due === jour ? "aujourdhui" : due === demain ? "demain" : "avenir";
/** « 22 août », et l'année seulement si ce n'est pas celle en cours (une échéance lointaine
 *  sans millésime se lit de travers). Midi local : à minuit UTC, un fuseau négatif reculerait
 *  la date d'un jour. */
const checkDateCourte = (due: string, jour: string) => {
  const d = new Date(`${due}T12:00:00`);
  return d.toLocaleDateString("fr-FR", {
    day: "numeric", month: "short",
    ...(due.slice(0, 4) !== jour.slice(0, 4) ? { year: "numeric" } : {}),
  });
};

/** La pastille d'échéance. Une ligne FAITE ne crie plus au retard : sa date redevient une
 *  simple mention neutre. */
function CheckDue({ due, jour, demain, fait }: { due: string; jour: string; demain: string; fait: boolean }) {
  const urg = checkUrgence(due, jour, demain);
  const court = checkDateCourte(due, jour);
  if (fait) return <Badge variant="neutral" icon={CalendarClock}>{court}</Badge>;
  if (urg === "retard") return <Badge variant="danger" icon={CalendarClock}>{`Retard · ${court}`}</Badge>;
  if (urg === "aujourdhui") return <Badge variant="warn" icon={CalendarClock}>Aujourd&rsquo;hui</Badge>;
  if (urg === "demain") return <Badge variant="warn" icon={CalendarClock}>Demain</Badge>;
  return <Badge variant="neutral" icon={CalendarClock}>{court}</Badge>;
}

/** Le texte d'une ligne, mis en forme. Une ligne de liste est MONOLIGNE par construction :
 *  on ne rend donc que la première (une ancienne cfg trafiquée à la main pourrait en
 *  contenir plusieurs — elles seraient simplement ignorées, jamais interprétées). */
function CheckTexte({ texte, fait }: { texte: string; fait: boolean }) {
  const l = memoParse(texte)[0] ?? { puce: false, spans: [] };
  return (
    <span style={{ flex: 1, minWidth: 0, fontSize: "12.5px", fontWeight: 500, color: T.ink2, overflowWrap: "anywhere",
      /* Le texte barré ne suffit pas à porter le sens (charte) : la case cochée le dit
         déjà, l'atténuation n'est qu'un renfort — et l'opacité préserve les couleurs. */
      textDecoration: fait ? "line-through" : undefined, opacity: fait ? 0.5 : 1 }}>
      {l.spans.map((sp, i) => <span key={i} style={memoStyle(sp)}>{sp.t}</span>)}
    </span>
  );
}

/** Le choix d'une échéance : le sélecteur natif (donc le calendrier du système, et la
 *  saisie clavier qui va avec), plus un bouton pour l'enlever. */
function CheckDatePick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", flex: "none" }}>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Échéance"
        style={{ boxSizing: "border-box", padding: "5px 7px", borderRadius: T.rSm, border: `1px solid ${T.line}`,
          background: T.surface, color: value ? T.ink : T.ink4, fontFamily: "inherit", fontSize: "12px", fontWeight: 500 }} />
      {value && (
        <button className="slb-nbtn" style={{ ...NBTN_SM, width: 22, height: 22 }} onClick={() => onChange("")}
          aria-label="Retirer l'échéance" title="Retirer l'échéance">
          <X aria-hidden style={{ width: 12, height: 12 }} />
        </button>
      )}
    </span>
  );
}

function ChecklistCard({ cfg }: { cfg: ChecklistCfg }) {
  const writer = useCfgWriter();
  const jour = useJour();
  const demain = checkJour(new Date(new Date(`${jour}T12:00:00`).getTime() + 86400000));
  /** Saisie d'ajout (texte BALISÉ, cf. `RichText`) et son échéance. */
  const [saisie, setSaisie] = useState("");
  const [saisieDue, setSaisieDue] = useState("");
  /** Ligne en cours de modification, et son brouillon — l'original n'est touché qu'à la
   *  validation, pour qu'Échap puisse tout rendre. */
  const [editId, setEditId] = useState<string | null>(null);
  const [brTexte, setBrTexte] = useState("");
  const [brDue, setBrDue] = useState("");

  const write = (items: CheckItem[], masquer = cfg.masquerFaites) =>
    writer?.save({ items: items.slice(0, CHECK_MAX), masquerFaites: masquer });

  const ajouter = () => {
    const texte = saisie.trim().slice(0, CHECK_TEXT_MAX);
    if (!texte || !writer || cfg.items.length >= CHECK_MAX) return;
    // Id local : un compteur suffirait mais deux onglets le referaient à l'identique.
    write([...cfg.items, { id: `c_${Math.random().toString(36).slice(2, 8)}`, texte, fait: false, ...(saisieDue ? { due: saisieDue } : {}) }]);
    setSaisie("");
    setSaisieDue("");
  };
  const ouvrirEdition = (it: CheckItem) => { setEditId(it.id); setBrTexte(it.texte); setBrDue(it.due ?? ""); };
  const fermerEdition = () => { setEditId(null); setBrTexte(""); setBrDue(""); };
  const validerEdition = () => {
    const texte = brTexte.trim().slice(0, CHECK_TEXT_MAX);
    if (!texte) return;   // une ligne vidée serait perdue au rechargement (cf. `coerce`)
    write(cfg.items.map((x) => (x.id === editId ? { id: x.id, texte, fait: x.fait, ...(brDue ? { due: brDue } : {}) } : x)));
    fermerEdition();
  };

  const visibles = cfg.masquerFaites ? cfg.items.filter((i) => !i.fait) : cfg.items;
  /** Déplacement d'un cran, exprimé sur les lignes VISIBLES puis reporté sur la liste
   *  entière : masquer les lignes faites ne doit pas rendre les flèches erratiques. */
  const deplacer = (id: string, delta: number) => {
    const rang = visibles.findIndex((x) => x.id === id);
    const voisin = visibles[rang + delta];
    if (!voisin) return;
    const next = cfg.items.slice();
    const i = next.findIndex((x) => x.id === id);
    const j = next.findIndex((x) => x.id === voisin.id);
    next.splice(j, 0, next.splice(i, 1)[0]);
    write(next);
  };

  const faites = cfg.items.filter((i) => i.fait).length;
  const restants = cfg.items.length - faites;
  const retards = cfg.items.filter((i) => !i.fait && i.due && i.due < jour).length;
  const sub = !cfg.items.length ? "Vos rappels personnels"
    : retards ? `${retards} en retard · ${restants} à faire`
    : `${restants} sur ${cfg.items.length} à faire`;
  const plein = cfg.items.length >= CHECK_MAX;

  return (
    <Widget icon={ClipboardList} title="Liste à cocher" sub={sub}
      headActions={writer && faites > 0 ? (
        <button className="slb-nbtn" style={NBTN_SM} onClick={() => write(cfg.items, !cfg.masquerFaites)}
          aria-pressed={cfg.masquerFaites}
          aria-label={cfg.masquerFaites ? `Afficher les ${faites} lignes faites` : `Masquer les ${faites} lignes faites`}
          title={cfg.masquerFaites ? `Afficher les ${faites} faites` : `Masquer les ${faites} faites`}>
          {cfg.masquerFaites ? <EyeOff aria-hidden style={{ width: 15, height: 15 }} /> : <Eye aria-hidden style={{ width: 15, height: 15 }} />}
        </button>
      ) : null}>
      {writer && (
        <div style={{ padding: "12px 16px 10px", borderBottom: `1px solid ${T.line}` }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <RichText
                value={saisie}
                onChange={setSaisie}
                onValider={ajouter}
                outils={["b", "i", "couleurs"]}
                max={CHECK_TEXT_MAX}
                aria="Nouvelle ligne"
                placeholder={plein ? "Liste pleine" : "Ajouter une ligne…"}
                outilsAuFocus
              />
            </div>
            <button className="slb-btng" onClick={ajouter} aria-label="Ajouter" title="Ajouter" disabled={plein || !saisie.trim()}
              style={{ flex: "none", display: "inline-flex", alignItems: "center", padding: "7px 10px", borderRadius: T.rSm, border: `1px solid ${T.line}`,
                background: T.surface, color: plein || !saisie.trim() ? T.ink4 : T.ink2, cursor: plein || !saisie.trim() ? "default" : "pointer" }}>
              <Plus aria-hidden style={{ width: 15, height: 15 }} />
            </button>
          </div>
          {(saisie.length > 0 || saisieDue) && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: 8 }}>
              <CheckDatePick value={saisieDue} onChange={setSaisieDue} />
              <span style={{ fontSize: "11.5px", fontWeight: 500, color: T.ink4 }}>Échéance (facultative)</span>
            </div>
          )}
        </div>
      )}
      {!cfg.items.length ? (
        <EmptyState dense icon={ClipboardList} title="Rien à faire"
          hint={writer ? "Ajoutez une ligne ci-dessus." : "Cette liste est en lecture seule."} />
      ) : !visibles.length ? (
        <EmptyState dense icon={Check} title="Tout est fait"
          hint={`Les ${faites} lignes cochées sont repliées.`} />
      ) : (
        <ScrollBody>
          {visibles.map((it, rang) => (
            editId === it.id ? (
              <div key={it.id} style={{ padding: "10px 16px", background: T.surface2, borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` }}>
                <RichText
                  value={brTexte}
                  onChange={setBrTexte}
                  onValider={validerEdition}
                  onAnnuler={fermerEdition}
                  outils={["b", "i", "couleurs"]}
                  max={CHECK_TEXT_MAX}
                  aria={`Modifier la ligne — ${memoNu(memoParse(it.texte))}`}
                  autoFocus
                />
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: 8, flexWrap: "wrap" }}>
                  <CheckDatePick value={brDue} onChange={setBrDue} />
                  <span style={{ flex: 1 }} />
                  <button className="slb-btng" onClick={fermerEdition}
                    style={{ padding: "6px 10px", borderRadius: T.rSm, border: `1px solid ${T.line}`, background: T.surface, color: T.ink2, fontFamily: "inherit", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                    Annuler
                  </button>
                  <button className="slb-btnp" onClick={validerEdition} disabled={!brTexte.trim()}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 11px", borderRadius: T.rSm, border: "none",
                      background: brTexte.trim() ? T.brand : T.neutral050, color: brTexte.trim() ? "#fff" : T.ink4,
                      fontFamily: "inherit", fontSize: "12px", fontWeight: 600, cursor: brTexte.trim() ? "pointer" : "default" }}>
                    <Check aria-hidden style={{ width: 13, height: 13 }} />Valider
                  </button>
                </div>
              </div>
            ) : (
              <div key={it.id} className="slb-row" style={{ display: "flex", alignItems: "center", gap: "9px", padding: "9px 16px" }}>
                <input type="checkbox" checked={it.fait} disabled={!writer} aria-label={memoNu(memoParse(it.texte))}
                  onChange={() => write(cfg.items.map((x) => (x.id === it.id ? { ...x, fait: !x.fait } : x)))}
                  style={{ width: 15, height: 15, accentColor: T.brand, flex: "none", cursor: writer ? "pointer" : "default" }} />
                <CheckTexte texte={it.texte} fait={it.fait} />
                {it.due && <CheckDue due={it.due} jour={jour} demain={demain} fait={it.fait} />}
                {/* `opacity:0` en ligne — cf. RowActions : la feuille de §2 ne peut pas en
                    répondre dans le bloc Softr, HoverFX (§2-bis) le révèle. */}
                {writer && (
                  <span className="slb-hact" style={{ display: "inline-flex", alignItems: "center", gap: "2px", flex: "none", opacity: 0 }}>
                    <button className="slb-nbtn" style={{ ...NBTN_SM, width: 22, height: 22, color: rang === 0 ? T.ink4 : undefined }}
                      onClick={() => deplacer(it.id, -1)} disabled={rang === 0} aria-label="Monter" title="Monter">
                      <ChevronUp aria-hidden style={{ width: 13, height: 13 }} />
                    </button>
                    <button className="slb-nbtn" style={{ ...NBTN_SM, width: 22, height: 22, color: rang === visibles.length - 1 ? T.ink4 : undefined }}
                      onClick={() => deplacer(it.id, 1)} disabled={rang === visibles.length - 1} aria-label="Descendre" title="Descendre">
                      <ChevronDown aria-hidden style={{ width: 13, height: 13 }} />
                    </button>
                    <button className="slb-nbtn" style={{ ...NBTN_SM, width: 22, height: 22 }} onClick={() => ouvrirEdition(it)}
                      aria-label="Modifier la ligne" title="Modifier">
                      <Pencil aria-hidden style={{ width: 13, height: 13 }} />
                    </button>
                    <button className="slb-nbtn" style={{ ...NBTN_SM, width: 22, height: 22 }}
                      aria-label={`Retirer — ${memoNu(memoParse(it.texte))}`} title="Retirer"
                      onClick={() => write(cfg.items.filter((x) => x.id !== it.id))}>
                      <X aria-hidden style={{ width: 13, height: 13 }} />
                    </button>
                  </span>
                )}
              </div>
            )
          ))}
        </ScrollBody>
      )}
    </Widget>
  );
}

/* --- Registre des TYPES de widget. Les CLÉS SONT UN CONTRAT DE PERSISTANCE :
      une fois livrées, ne JAMAIS les renommer (les layouts sauvegardés y font
      référence). `title` = libellé porté par la galerie (le titre affiché
      dans l'en-tête du widget vit dans le composant présentiel).
      Les 6 premières clés « legacy » reprennent à l'identique les WidgetId de la
      v1 : un layout v1 se migre donc sans perte (§10-bis, migrateV1).
      L'IMPLÉMENTATION d'un type peut changer librement ; seule sa clé est figée
      (`notesInstallateurs` en est l'exemple : même clé, rendu désormais générique).

      Un type déclare : son `Render` (qui reçoit l'id et la cfg de l'INSTANCE),
      et — s'il est configurable — `defaults`/`coerce`/`Options`. Un type sans
      `Options` a un ⋮ inerte ; un type sans `coerce` ignore simplement sa cfg. --- */
type WidgetTypeKey =
  | "notifs" | "taches" | "notesInstallateurs" | "notesProspects"
  | "linkedin" | "linkedinBanner"
  | "annonces" // ← 3ᵉ embed Elfsight (barre d'annonces), ajoutable via la galerie
  /* ← Synthèse SAV. Type SUR-MESURE et non instance `data`, parce que son rendu
     n'est aucune des trois vues génériques : il croise plusieurs agrégats (dont
     une somme des 12 compteurs) et un classement de causes. Une vue `kpi` ne
     porte qu'UN chiffre.
     Il EST configurable (⋮ « Options ») : sa cfg est la liste des valeurs à
     afficher, choisies dans le registre `SAV_METRICS`. Pour un chiffre simple sur
     un seul champ SAV (somme, moyenne, comptage filtré), préférer un widget `data`
     posé depuis les presets `sav` du catalogue (§6-bis) — aucun code requis. */
  | "sav"
  /* ← Performance commerciale (§9-septies) : les seuls widgets qui agrègent sur tout le parc. */
  | "podium" | "classementCom" | "classementInst" | "comIndics"
  /* ← Exceptions (§9-octies) : les tuiles de couverture et le registre. */
  | "excIndics" | "excRegistre"
  /* ← Les deux FILES D'ATTENTE du pipeline dossier (2026-08-18). Types sur-mesure et non
     instances `data`, alors que leur RENDU est celui d'une liste générique : c'est leur
     cfg qui est le sujet. Figée, elle ne peut pas dériver — on ne peut ni changer leur
     source, ni leur filtre, ni leur tri. Un widget dont la raison d'être tient en une
     phrase ne doit pas offrir dix réglages qui la contredisent. */
  | "attSolva" | "demInfos"
  /* ← Utilitaires SANS source (§9-sexies) : leur contenu est leur cfg. */
  | "horloge" | "memo" | "checklist"
  | "data"     // ← LE type générique piloté par cfg : liste / tableau / KPI (§9-bis)
  | "list" | "kpi";   // ← DÉPRÉCIÉS : livrés en rév. 1, rendent comme `data` (cfg traduite)

type WidgetTypeDef = {
  title: string;                                  // libellé dans la galerie
  icon: LucideIcon;
  Render: FC<{ id: string; cfg: any }>;
  defaults?: () => any;                           // cfg d'une instance neuve
  coerce?: (raw: unknown) => any;                 // cfg stockée (brute) → cfg utilisable ; ne throw JAMAIS
  Options?: FC<{ cfg: any; onChange: (next: any) => void }>;
};

/* Fabriques de types génériques. `icon` ne sert plus qu'aux LIBELLÉS (galerie) : à
   l'écran, le widget prend l'icône du descripteur de sa source, donc elle suit un
   changement de source. */
/* Fabrique d'un type « data ». UNE seule implémentation : le rendu, la coercition
   et le formulaire sont toujours les mêmes ; seuls le libellé, l'icône de galerie
   et la cfg de départ changent. `icon` ne sert qu'aux LIBELLÉS (menu, galerie) :
   à l'écran, le widget prend l'icône du descripteur de sa source. */
const dataType = (title: string, icon: LucideIcon, base: InstanceCfg): WidgetTypeDef => ({
  title,
  icon,
  Render: ({ cfg }) => <DataView cfg={cfg} />,
  defaults: () => coerceCfg(base, base),
  coerce: (raw) => coerceCfg(raw, base),
  Options: DataOptions,
});

/* Fabrique d'une FILE D'ATTENTE. La cfg enregistrée n'est PAS la cfg du widget : `coerce`
   n'y lit que DEUX choses — l'ordre et le périmètre clientèle — et reconstruit tout le
   reste depuis la constante figée. Deux conséquences voulues :
     · rien de ce que porte le document de disposition ne peut détourner ces widgets —
       ni leur source, ni leur filtre de statut, ni leurs colonnes ;
     · une instance posée hier suit automatiquement une correction de filtre faite ici.
   `Options` n'offre donc que ces deux réglages (`FileOptions`), et le ⋮ le nom et la
   couleur.
   ⚠️ LA CLIENTÈLE EST REVENUE le 2026-08-20 (demandée). Elle avait disparu le 08-18 avec
   tout le formulaire générique, et c'est le seul de ses réglages à être rétabli : « qui
   attend sa solvabilité ? » et « quels PARTICULIERS attendent leur solvabilité ? » sont
   deux charges de travail différentes, traitées par des personnes différentes. Elle ne
   rouvre pas la porte pour autant — c'est un PÉRIMÈTRE validé contre `CLIENTELES`, pas un
   filtre libre : la source, le statut et les colonnes restent hors d'atteinte. */
const fileType = (title: string, icon: LucideIcon, base: InstanceCfg): WidgetTypeDef => ({
  title,
  icon,
  Render: ({ cfg }) => <DataView cfg={cfg} />,
  coerce: (raw) => {
    const t = fileTriOf(raw);
    return { ...base, tri: t.key, clientele: clienteleOf(raw),
             query: { ...base.query, sort: { by: t.by, dir: t.dir } } };
  },
  Options: FileOptions,
});

/** Le formulaire d'une file : DEUX sélecteurs. Il rend `{ tri, clientele }` et RIEN
 *  d'autre — la cfg stockée dans le layout tient donc en deux clés, et `coerce`
 *  reconstruit le reste. */
function FileOptions({ cfg, onChange }: { cfg: any; onChange: (next: any) => void }) {
  const lbl: CSSProperties = { display: "block", fontSize: "10.5px", fontWeight: 700, color: T.ink4, textTransform: "uppercase", letterSpacing: ".05em", margin: "2px 0 5px" };
  const field: CSSProperties = { width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: T.rSm, border: `1px solid ${T.line}`, background: T.surface, color: T.ink, fontFamily: "inherit", fontSize: "12.5px", fontWeight: 500 };
  const tri = fileTriOf(cfg).key;
  const clientele = clienteleOf(cfg);
  return (
    <>
      <div style={lbl}>Ordre d'affichage</div>
      <select value={tri} style={field}
        onChange={(e) => onChange({ tri: e.target.value as FileTri, clientele })}>
        {FILE_TRIS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
      </select>
      {/* CLIENTÈLE — le second et dernier réglage. Même liste que le widget générique
          (`CLIENTELES`), pour que le même mot désigne partout le même périmètre. */}
      <div style={{ ...lbl, marginTop: "10px" }}>Clientèle</div>
      <select value={clientele} style={field}
        onChange={(e) => onChange({ tri, clientele: e.target.value as Clientele })}>
        {CLIENTELES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
      </select>
      <p style={{ margin: "6px 0 0", fontSize: "11.5px", fontWeight: 500, color: T.ink4 }}>
        Ce sont les deux seuls réglages de ce widget : le statut qu'il suit, sa source et ses
        colonnes ne se changent pas. « Particuliers » regroupe les dossiers Solo et Duo.
      </p>
    </>
  );
}

const WIDGET_REGISTRY: Record<WidgetTypeKey, WidgetTypeDef> = {
  /* ⚠️ La CLÉ reste `notifs` : c'est un contrat de persistance (les layouts déjà
     enregistrés la portent). Seul le titre change — « Nouveaux dossiers abonnés »
     depuis la refonte du 2026-08-06 (§9). */
  notifs: { title: "Nouveaux dossiers abonnés", icon: Bell, Render: NotifsCard,
            defaults: () => coerceNotifsCfg({}), coerce: coerceNotifsCfg, Options: NotifsOptions },
  taches: { title: "Journal des tâches", icon: CalendarClock, Render: TachesCard },
  notesInstallateurs: dataType("Dernières notes — Installateurs", HardHat, NOTES_INS_CFG),
  notesProspects: dataType("Dernières notes — Prospects", Target, NOTES_PRO_CFG),
  /* Les deux FILES D'ATTENTE : `fileType` et non `dataType`, donc AUCUN réglage de
     contenu (§10). Voir `ATT_SOLVA_CFG` / `DEM_INFOS_CFG` pour ce qu'elles montrent. */
  attSolva: fileType("En attente de solvabilité", Clock, ATT_SOLVA_CFG),
  demInfos: fileType("Demandes d'infos", Inbox, DEM_INFOS_CFG),
  // Titres modifiables librement (les CLÉS, elles, sont figées : contrat de persistance).
  linkedin: { title: "SunLib sur LinkedIn", icon: Newspaper, Render: LinkedinCard },
  linkedinBanner: { title: "À la une SunLib", icon: Megaphone, Render: LinkedinBannerCard },
  annonces: { title: "Annonces SunLib", icon: Sparkles, Render: AnnoncesCard },
  /* Configurable depuis la rév. 2.1 : `Options` = les valeurs à afficher (registre
     SAV_METRICS). `coerce` tolère une cfg vide — les instances posées avant sont
     donc inchangées, sans migration. */
  sav: { title: "Pilotage SAV — synthèse", icon: Ticket, Render: SavCard,
         defaults: () => coerceSavCfg({}), coerce: coerceSavCfg, Options: SavOptions },
  /* Podium (§9-septies) — vient du tableau de bord KPI, mêmes critères et même dessin. */
  podium: { title: "Podium CAPEX HT", icon: Trophy, Render: PodiumCard,
            defaults: () => coercePodiumCfg({}), coerce: coercePodiumCfg, Options: PodiumOptions },
  classementCom: { title: "Classement des commerciaux", icon: Users, Render: ClassementCard,
                   defaults: () => coerceClassementCfg({}), coerce: coerceClassementCfg, Options: ClassementOptions },
  classementInst: { title: "Tous les installateurs", icon: HardHat, Render: InstCard,
                    defaults: () => coerceInstCfg({}), coerce: coerceInstCfg, Options: InstOptions },
  comIndics: { title: "Indicateurs commerciaux", icon: BarChart3, Render: ComIndicsCard,
               defaults: () => coerceComIndicsCfg({}), coerce: coerceComIndicsCfg, Options: ComIndicsOptions },
  /* Exceptions (§9-octies). */
  excIndics: { title: "Exceptions", icon: ClipboardList, Render: ExcIndicsCard,
               defaults: () => coerceExcIndicsCfg({}), coerce: coerceExcIndicsCfg, Options: ExcIndicsOptions },
  excRegistre: { title: "Registre des exceptions", icon: ClipboardList, Render: ExcRegistreCard,
                 defaults: () => coerceExcRegistreCfg({}), coerce: coerceExcRegistreCfg, Options: ExcRegistreOptions },
  /* Utilitaires (§9-sexies). `memo` et `checklist` n'ont PAS d'`Options` : leur seul
     réglage serait leur contenu, et il s'édite dans le widget — pas derrière un ⋮. */
  horloge: { title: "Heure", icon: Clock, Render: HorlogeCard,
             defaults: () => coerceHorlogeCfg({}), coerce: coerceHorlogeCfg, Options: HorlogeOptions },
  memo: { title: "Pense-bête", icon: FileSignature, Render: MemoCard,
          defaults: () => coerceMemoCfg({}), coerce: coerceMemoCfg },
  checklist: { title: "Liste à cocher", icon: ClipboardList, Render: ChecklistCard,
               defaults: () => coerceChecklistCfg({}), coerce: coerceChecklistCfg },
  data: dataType("Widget de données", LayoutGrid, DATA_CFG),
  /* --- Clés DÉPRÉCIÉES, conservées par contrat de persistance : elles ont été
     livrées, donc des instances peuvent exister chez des utilisateurs. Elles
     rendent exactement comme `data` — `coerceCfg` traduit leur ancienne cfg plate
     (§9-bis, `fromLegacyCfg`). Ne pas les supprimer : sans elles, ces instances
     partiraient dans `parked` et disparaîtraient de l'écran. --- */
  list: dataType("Liste configurable (ancien)", LayoutGrid, DATA_CFG),
  kpi: dataType("Indicateur (ancien)", BarChart3, cfgOfSource("abonnes", {
    view: { kind: "kpi", agg: "count", dateField: "creeLe", compareDays: 30 },
  })),
};

/** cfg utilisable d'une instance : `coerce` de son type appliqué à la cfg stockée
 *  (brute), ou `defaults()`, ou `{}` pour un type non configurable. PURE. */
const cfgOf = (def: WidgetTypeDef, raw: unknown): any =>
  def.coerce ? def.coerce(raw) : def.defaults ? def.defaults() : {};

const TYPE_KEYS = Object.keys(WIDGET_REGISTRY) as WidgetTypeKey[];

/** Définition d'un type de widget, ou `undefined` si la clé est inconnue du code
 *  courant (instance « garée », cf. `parked`). Indexation sûre : jamais de crash
 *  au rendu sur un layout écrit par une version plus récente. */
const typeDefOf = (type: string): WidgetTypeDef | undefined =>
  (WIDGET_REGISTRY as Record<string, WidgetTypeDef | undefined>)[type];

/* ============================================================================
   10-bis. MODÈLE DE DISPOSITION v2 — instances, seeding, migration
   ----------------------------------------------------------------------------
   Trois concepts SÉPARÉS (cf. ARCHITECTURE.md §8.2) :
     · le TYPE   → ce qu'on affiche          → WIDGET_REGISTRY[type]
     · l'INSTANCE→ ce que CET utilisateur a posé sur SON accueil → Layout.items[]
     · la SOURCE → d'où viennent les données (phase 1, pas encore introduite)
   Une instance porte son `id` (clé de persistance), son `type`, sa `cfg` (réservée
   aux options par widget — phase 2), sa largeur `w` et sa hauteur `h`. Plus de
   tableaux parallèles order/wide/sizes à garder cohérents.

   Toute la logique de layout vit dans les fonctions PURES ci-dessous (aucune
   logique dans les handlers d'événements du §11).
   ============================================================================ */

type WidgetWidth = "half" | "full";

/** `id`  : CONTRAT DE PERSISTANCE — jamais renommé (migrés v1 = l'ancien WidgetId).
 *  `type`: volontairement `string` (et non WidgetTypeKey) pour pouvoir CONSERVER
 *          sans perte une instance dont le type est inconnu du code courant.
 *  `cfg` : laissée BRUTE en stockage ; c'est le type qui l'interprète au rendu. */
/*  `preset` : clé du MODÈLE de galerie dont l'instance est issue. Elle sert à
 *  n'autoriser qu'un exemplaire de chaque modèle (décision du 2026-08-03).
 *  Facultative, et c'est voulu : les instances écrites avant son introduction n'en
 *  ont pas. Le repli est `type`, ce qui tombe juste pour tous les types sur-mesure
 *  — leur clé de modèle EST leur clé de type (cf. `CUSTOM_TYPES`). Un ancien widget
 *  `data` sans `preset` ne bloque donc rien : on tolère l'existant plutôt que de
 *  réécrire des documents déjà en base. */
/*  `title` : titre choisi par l'utilisateur, valable pour N'IMPORTE QUEL type
 *  (2026-08-04). Facultatif et ABSENT par défaut — absent ou vide signifie « garder le
 *  titre du widget », ce qui garde le geste réversible et laisse le titre par défaut
 *  continuer d'évoluer (celui d'un widget `data` suit sa source). Il vit sur
 *  l'instance et non dans la `cfg` parce qu'il ne dépend pas du type : les widgets sans
 *  formulaire d'options (pense-bête, embeds, journal des tâches) sont donc renommables
 *  comme les autres, sans une ligne de code par type. */
/*  `tint` : CLÉ de teinte (`WIDGET_TINTS`), jamais une couleur — le document ne stocke
 *  aucune valeur de style, donc la charte peut évoluer sans migration, et une clé
 *  inconnue retombe simplement sur « aucune ». Facultative, comme `title`. */
type Instance = { id: string; type: string; cfg: unknown; w: WidgetWidth; h: WidgetHeight; preset?: string; title?: string; tint?: string };

/** Longueur maximale d'un titre personnalisé. L'en-tête d'une carte est étroit : au-delà
 *  le texte serait tronqué à l'écran, autant le borner à la saisie. */
const WIDGET_TITLE_MAX = 48;

/** `items` : visibles — l'ordre du tableau EST l'ordre d'affichage.
 *  `parked`: types inconnus du code courant — ni rendus, ni perdus (compat descendante).
 *  `seeded`: ids d'instances par défaut DÉJÀ injectées → un widget par défaut
 *            supprimé ne ressuscite pas à chaque chargement.
 *
 *  ⚠️ IL N'Y A PLUS DE `hidden`, ET C'EST UNE DÉCISION, pas un oubli. Masquer
 *  faisait doublon avec supprimer : le seul écart réel était la cfg conservée, et
 *  deux gestes pour un résultat presque identique coûtent plus en confusion qu'ils
 *  ne font gagner en clics. Un widget qu'on ne veut plus se SUPPRIME ; s'il faut le
 *  revoir, on le repose depuis la galerie et on le règle à nouveau — perte de cfg
 *  ASSUMÉE (arbitrage explicite du 2026-08-03).
 *  Le champ reste LU par `normalizeLayout` pour les documents déjà écrits (voir la
 *  note de migration là-bas), mais il n'est plus jamais écrit. */
type Layout = { v: 2; items: Instance[]; parked: Instance[]; seeded: string[] };

/** Version du document de disposition. Portée par le JSON (`v`) ET recopiée dans
 *  le champ `schema_version` de la table (diagnostic du parc sans parser le JSON). */
const LAYOUT_VERSION = 2;

/* Instances livrées par défaut. Ajouter une entrée = le widget apparaît UNE fois chez
   tout le monde (puis reste supprimable définitivement, cf. `seed()`).

   ⚠️ VIDE DEPUIS LE 2026-08-24, ET C'EST UNE DÉCISION. Un nouvel arrivant n'hérite plus
   d'aucune disposition : il ouvre la page sur un tableau VIERGE et le compose lui-même.
   Le bloc partenaire avait pris ce chemin le 2026-08-21 ; les deux blocs s'accordent.
   Trois raisons, dans l'ordre où elles pèsent :
     · sept widgets posés d'office, c'est SEPT LECTURES de la base à la première visite,
       pour quelqu'un dont on ignore encore ce qu'il regarde ;
     · une disposition imposée se subit — celui qui ne s'en sert pas ne la retire pas,
       il la laisse là et la page ment sur ce qu'il utilise vraiment ;
     · l'état vide devient l'écran d'accueil, donc il doit ENSEIGNER la galerie. C'est
       plus efficace qu'un tableau pré-rempli que personne n'apprend à modifier.

   ⚠️ CE QUI NE CHANGE PAS : les utilisateurs qui ont DÉJÀ une disposition la gardent —
   elle vit dans `layout_json`, et rien ici ne la relit. Le vidage ne concerne que ceux
   dont la table de préférences ne connaît pas encore l'adresse.
   ⚠️ AVANT DE VIDER, IL A FALLU VÉRIFIER que chacun de ces widgets reste POSABLE : les
   sept le sont, `notesInstallateurs` et `notesProspects` par les presets déclarés de
   leurs sources (§6-bis), les cinq autres par `CUSTOM_TYPES`. Une entrée qui ne serait
   posable QUE d'ici deviendrait inatteignable en la retirant.

   Les réglages ci-dessous sont gardés EN COMMENTAIRE, et non effacés : ce sont des
   valeurs vérifiées à l'écran — les hauteurs des embeds, surtout, sont calibrées sur leur
   contenu réel, une iframe ne défilant pas.

   { id: "notifs", type: "notifs", cfg: {}, w: "half", h: 340 },
   { id: "taches", type: "taches", cfg: {}, w: "half", h: 340 },
   { id: "notesInstallateurs", type: "notesInstallateurs", cfg: {}, w: "half", h: 340 },
   { id: "notesProspects", type: "notesProspects", cfg: {}, w: "half", h: 340 },
   ⚠️ Les embeds Elfsight sont posés HAUT (2026-08-07) : ils ne défilent pas — une iframe
   coupe ce qui dépasse au lieu de le rendre atteignable. Le fil LinkedIn a besoin du cran
   « XL » pour montrer plus d'une publication ; la bannière tient en « Grand ».
   { id: "linkedin", type: "linkedin", cfg: {}, w: "half", h: 860 },
   { id: "linkedinBanner", type: "linkedinBanner", cfg: {}, w: "half", h: 560 },
   { id: "sav", type: "sav", cfg: {}, w: "half", h: 560 },                              */
const DEFAULT_INSTANCES: Instance[] = [];

/* --- GALERIE « Ajouter un widget » : les modèles qu'on peut poser sur la grille.
   Entièrement GÉNÉRÉE, de deux origines :
     · les types SUR-MESURE (pour ré-ajouter un widget supprimé) ;
     · les `presets` DÉCLARÉS DANS LE CATALOGUE de chaque source (§6-bis) — c'est
       là que « SAV en cours » ou « Dossiers incomplets » se définissent, en pur JSON.
       Un preset `hidden` y reste déclaré mais n'apparaît PAS ici (cf. `PresetDesc`).
       Une source sans preset déclaré en reçoit un par défaut (liste sur son
       mappage), pour qu'elle soit toujours posable.
   Brancher une source la fait donc apparaître ici sans une ligne de code de plus.
   La cfg d'un preset est COPIÉE dans l'instance à la pose : l'instance est
   autoportante et ne bougera plus si le preset évolue. --- */
type Preset = { key: string; label: string; hint?: string; icon: LucideIcon; type: WidgetTypeKey; cfg: () => unknown; h?: WidgetHeight; group: string; shape: ShapeKind; desc: string };

/* ── MINIATURES DE LA GALERIE ─────────────────────────────────────────────────
   Une maquette DESSINÉE par archétype de rendu, et non le widget réel en réduction.
   Deux raisons, la seconde étant décisive :
     · un vrai widget en miniature reste illisible sous 120 px de haut ;
     · surtout, il MONTERAIT SA SOURCE. Ouvrir la galerie déclencherait alors toutes
       les lectures du bloc à la fois — dont le parc entier pour les widgets de
       Performance. Une galerie ne doit rien coûter.
   Les maquettes sont donc de simples `div` : zéro requête, zéro dépendance, et elles
   disent ce qui compte — la FORME du widget qu'on s'apprête à poser. --- */
type ShapeKind = "list" | "table" | "kpi" | "tiles" | "podium" | "text" | "check" | "clock" | "embed";

function PresetShape({ kind }: { kind: ShapeKind }) {
  const bar = (w: string, c = T.line2): CSSProperties => ({ height: 6, width: w, borderRadius: 3, background: c });
  const box: CSSProperties = { height: 74, borderRadius: T.rSm, background: T.surface, border: `1px solid ${T.line}`, padding: "9px 10px", display: "flex", flexDirection: "column", gap: "7px", overflow: "hidden" };
  const rowOf = (i: number) => (
    <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <span style={{ width: 12, height: 12, borderRadius: 4, background: T.brand100, flex: "none" }} />
      <span style={bar(`${64 - i * 12}%`)} />
      <span style={{ ...bar("14px", T.brand100), marginLeft: "auto" }} />
    </div>
  );
  switch (kind) {
    case "table":
      return (
        <div style={box}>
          <div style={{ display: "flex", gap: "5px" }}>
            {[26, 20, 14, 18].map((w, i) => <span key={i} style={bar(`${w}%`, T.line)} />)}
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: "flex", gap: "5px" }}>
              {[26, 20, 14, 18].map((w, j) => <span key={j} style={bar(`${w}%`, j === 0 ? T.line2 : T.line)} />)}
            </div>
          ))}
        </div>
      );
    case "kpi":
      return (
        <div style={{ ...box, justifyContent: "center", gap: "9px" }}>
          <span style={{ width: 54, height: 20, borderRadius: 5, background: T.brand100 }} />
          <span style={bar("46%")} />
        </div>
      );
    case "tiles":
      return (
        <div style={{ ...box, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} style={{ borderRadius: 5, background: i < 3 ? T.brand050 : T.neutral050, border: `1px solid ${T.line}` }} />
          ))}
        </div>
      );
    case "podium":
      return (
        <div style={{ ...box, flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: "7px" }}>
          {[22, 38, 15].map((h, i) => (
            <span key={i} style={{ width: 16, height: h, borderRadius: "4px 4px 0 0", background: i === 1 ? T.solar050 : T.neutral050, border: `1px solid ${i === 1 ? T.solar100 : T.line2}` }} />
          ))}
        </div>
      );
    case "text":
      return (
        <div style={box}>
          {["78%", "92%", "60%", "84%"].map((w, i) => <span key={i} style={bar(w, i === 0 ? T.line2 : T.line)} />)}
        </div>
      );
    case "check":
      return (
        <div style={box}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, border: `1px solid ${T.line2}`, background: i === 0 ? T.brand100 : T.surface, flex: "none" }} />
              <span style={bar(`${70 - i * 14}%`)} />
            </div>
          ))}
        </div>
      );
    case "clock":
      return (
        <div style={{ ...box, alignItems: "center", justifyContent: "center" }}>
          <span style={{ width: 34, height: 34, borderRadius: 999, border: `2px solid ${T.line2}`, display: "grid", placeItems: "center" }}>
            <span style={{ width: 2, height: 12, background: T.ink4, borderRadius: 2, transform: "translateY(-2px)" }} />
          </span>
        </div>
      );
    case "embed":
      return (
        <div style={{ ...box, alignItems: "center", justifyContent: "center", background: T.surface2 }}>
          <span style={{ width: "72%", height: 30, borderRadius: 5, background: T.surface, border: `1px dashed ${T.line2}` }} />
        </div>
      );
    default:
      return <div style={box}>{[0, 1, 2].map(rowOf)}</div>;
  }
}

/* ── GROUPES DE LA GALERIE ────────────────────────────────────────────────────
   La galerie était une liste PLATE : dix-huit boutons alignés, où « Dossiers SAV
   récents » voisinait « Annonces SunLib » sans qu'on voie les familles. Elle est
   désormais un DÉPLIANT par domaine métier — un groupe par famille, replié, qui
   s'ouvre sur ses modèles.

   Le regroupement suit le DOMAINE, pas le mécanisme technique : la synthèse SAV
   (type sur-mesure) et les quatre vues `data` sur les tickets vivent dans le même
   groupe « Dossiers SAV », parce que c'est ainsi que quelqu'un les cherche.

   L'ordre des groupes ci-dessous EST l'ordre d'affichage : pour remonter une
   famille, il suffit de déplacer sa ligne. */
const GALLERY_GROUPS: { key: string; label: string; icon: string }[] = [
  { key: "abonnes", label: "Abonnés", icon: "Bell" },
  { key: "taches", label: "Tâches", icon: "CalendarClock" },
  { key: "notes", label: "Notes", icon: "HardHat" },
  /* Ajouté le 2026-08-19 avec l'annuaire des contacts. Placé après « Notes » parce que
     c'est le voisinage métier : on cherche un contact juste après avoir lu la note qui le
     mentionne. Déplacer cette ligne suffit à déplacer le groupe. */
  { key: "partenaires", label: "Partenaires", icon: "BookUser" },
  { key: "sav", label: "Dossiers SAV", icon: "Ticket" },
  { key: "comm", label: "Communication", icon: "Newspaper" },
  { key: "perf", label: "Performance", icon: "Trophy" },
  { key: "exceptions", label: "Exceptions", icon: "ClipboardList" },
  { key: "outils", label: "Utilitaires", icon: "Clock" },
  // Repli OBLIGATOIRE : voir groupOfSource ci-dessous. Ne pas retirer cette ligne.
  { key: "autres", label: "Autres", icon: "LayoutGrid" },
];

/* Groupe d'une SOURCE. ⚠️ Une source ABSENTE de cette table tombe dans « Autres »
   au lieu de disparaître : c'est ce repli qui préserve la promesse du catalogue —
   brancher une source la fait apparaître dans la galerie sans toucher au mapping.
   La ranger ici n'est qu'un raffinement de présentation. */
const SOURCE_GROUP: Partial<Record<SourceKey, string>> = {
  abonnes: "abonnes",
  tachesPa: "taches", tachesPr: "taches",
  notesIns: "notes", notesPro: "notes",
  contactsIns: "partenaires",
  sav: "sav",
};
const groupOfSource = (s: SourceKey): string => SOURCE_GROUP[s] ?? "autres";

/* Types sur-mesure proposés dans la galerie, avec leur hauteur de départ (une barre
   d'annonces n'a pas besoin d'un widget de 340 px) et leur groupe de galerie. */
const CUSTOM_TYPES: { type: WidgetTypeKey; h?: WidgetHeight; group: string; shape: ShapeKind; desc: string }[] = [
  { type: "notifs", group: "abonnes", shape: "list", desc: "Les nouveaux dossiers abonnés notifiés, leur statut, l'état lu / non lu et un accès à la fiche." },
  /* Les deux files d'attente. Leur description dit ce qu'elles montrent ET qu'elles ne se
     règlent pas : c'est ce qui les distingue d'une liste posée depuis les modèles. */
  { type: "attSolva", group: "abonnes", shape: "list", desc: "Tous les dossiers au statut « En attente de solvabilité », le plus ancien en tête. Rien à régler." },
  { type: "demInfos", group: "abonnes", shape: "list", desc: "Tous les dossiers en « Demande d'infos » (technique, solvabilité ou les deux), le plus ancien en tête. Rien à régler." },
  { type: "taches", group: "taches", shape: "list", desc: "Vos tâches prospects et partenaires, avec leur échéance et la case « Fait »." },
  /* Hauteurs de pose accordées au contenu réel de chaque embed : il ne défile pas, donc
     ce qui dépasse est perdu jusqu'à ce qu'on agrandisse la carte à la main. */
  { type: "linkedin", h: 860, group: "comm", shape: "embed", desc: "Le fil des publications LinkedIn de SunLib." },
  { type: "linkedinBanner", h: 560, group: "comm", shape: "embed", desc: "La bannière « À la une » : webinaires et annonces." },
  { type: "annonces", h: 168, group: "comm", shape: "embed", desc: "La barre d'annonces internes." },
  // Posé en "lg" : la synthèse SAV a quatre sections, elle scrolle en "md".
  { type: "sav", h: 560, group: "sav", shape: "tiles", desc: "Les chiffres clés du SAV, en tuiles ou en lignes, à choisir." },
  // Le podium a besoin de hauteur : avatars, montants et marches s'empilent.
  { type: "podium", h: 560, group: "perf", shape: "podium", desc: "Les trois premiers commerciaux par CAPEX signé." },
  // Le classement est un TABLEAU de dix colonnes : à poser en pleine largeur et haut.
  { type: "classementCom", h: 560, group: "perf", shape: "table", desc: "Le tableau complet : CAPEX, tendance, taux de pose, délai, courbe sur 12 mois." },
  // À poser en pleine largeur comme le classement commercial : six colonnes et deux
  // graphiques ne tiennent pas dans une demi-carte.
  { type: "classementInst", h: 560, group: "perf", shape: "table", desc: "Le classement des partenaires : signés, CAPEX, puissance, taux de pose et courbe sur 12 mois." },
  // Une rangée de tuiles : basse, mais large — cinq tuiles ne tiennent pas en demi-largeur.
  { type: "comIndics", h: 168, group: "perf", shape: "tiles", desc: "Contrats, CAPEX, installateurs actifs et pipeline à signer." },
  // Utilitaires : l'horloge n'a aucune raison d'être haute.
  // Exceptions : les tuiles sont basses et larges, le registre est un tableau.
  { type: "excIndics", h: 340, group: "exceptions", shape: "tiles", desc: "Volume des exceptions, couverture du parc et intensité par dossier." },
  { type: "excRegistre", h: 560, group: "exceptions", shape: "table", desc: "Le registre ligne par ligne : périmètre, catégorie, service, valideur, statut." },
  { type: "horloge", h: 168, group: "outils", shape: "clock", desc: "L'heure et la date du jour. Ne lit aucune donnée." },
  { type: "memo", group: "outils", shape: "text", desc: "Un pense-bête personnel : gras, italique, barré, puces et couleurs." },
  { type: "checklist", group: "outils", shape: "check", desc: "Une liste à cocher, visible de vous seul : mise en forme, couleurs et échéances." },
];

/** Presets d'une source : ceux du descripteur, ou un modèle liste par défaut. */
function presetsOf(s: SourceKey): Preset[] {
  const desc = CATALOG[s];
  if (desc.technical) return [];        // source technique : absente de la galerie
  const hint = desc.connected ? undefined : "source non connectée";
  const declared = desc.presets ?? [];
  const list: PresetDesc[] = declared.length ? declared
    : [{ label: `Liste — ${desc.label}`, cfg: { source: s } }];
  /* `flatMap` et pas `filter().map()` : l'index `i` doit rester celui de la DÉCLARATION,
     puisque c'est lui qui forme la clé du preset. Un modèle masqué rend donc un tableau
     vide sans décaler ceux qui le suivent. */
  return list.flatMap((p, i) => {
    if (p.hidden) return [];
    /* La FORME se déduit de la vue déclarée par le preset : aucun archétype à saisir à
       la main, et un preset qui passe en tableau change de miniature tout seul. */
    const vue = (p.cfg as { view?: { kind?: string } }).view?.kind;
    const shape: ShapeKind = vue === "table" ? "table" : vue === "kpi" ? "kpi" : "list";
    const quoi = vue === "table" ? "Tableau" : vue === "kpi" ? "Indicateur" : "Liste";
    return [{
      key: `${s}:${i}`,
      label: p.label,
      hint,
      icon: iconOf(p.icon ?? desc.icon),
      type: "data" as WidgetTypeKey,
      // `coerceCfg` complète le preset avec les défauts du descripteur (mappage, tri).
      cfg: () => coerceCfg({ ...p.cfg, source: s }, cfgOfSource(s)),
      h: p.h,
      group: groupOfSource(s),
      shape,
      /* Description GÉNÉRÉE : « Tableau — Dossiers SAV ». Un texte par preset serait à
         écrire pour chaque source branchée, donc oublié une fois sur deux ; celle-ci dit
         déjà l'essentiel (quelle forme, quelle table) et reste juste automatiquement. */
      desc: `${quoi} sur « ${desc.label} ». Filtres, tri et champs réglables ensuite.`,
    }];
  });
}

const PRESETS: Preset[] = [
  ...CUSTOM_TYPES.map(({ type: t, h, group, shape, desc }) => ({
    key: t,
    label: WIDGET_REGISTRY[t].title,
    icon: WIDGET_REGISTRY[t].icon,
    type: t,
    cfg: () => ({}),
    h,
    group,
    shape,
    desc,
  })),
  ...(Object.keys(CATALOG) as SourceKey[]).flatMap(presetsOf),
];

/** Groupes de la galerie RÉELLEMENT peuplés, dans l'ordre de `GALLERY_GROUPS`.
 *  Un groupe vide n'est pas affiché (une famille dont aucune source n'est encore
 *  déclarée ne doit pas laisser un dépliant vide).
 *  ⚠️ Le `?? "autres"` est un FILET : un preset dont le groupe n'existe pas dans
 *  `GALLERY_GROUPS` (faute de frappe, groupe supprimé) atterrit dans « Autres » au
 *  lieu de disparaître de la galerie sans un mot. */
const GROUP_KEYS = new Set(GALLERY_GROUPS.map((g) => g.key));
const PRESET_GROUPS = GALLERY_GROUPS
  .map((g) => ({
    ...g,
    items: PRESETS.filter((p) => (GROUP_KEYS.has(p.group) ? p.group : "autres") === g.key),
  }))
  .filter((g) => g.items.length > 0);

/* ============================================================================
   LA GALERIE — feuille modale, recherche, miniatures
   ----------------------------------------------------------------------------
   Elle remplace le dépliant par famille (2026-08-04). Ce qui n'allait pas, et que
   chaque point ci-dessous corrige :
     · elle n'était atteignable qu'en mode Personnaliser — il fallait entrer dans un
       mode pour ajouter une carte (ce mode n'existe plus du tout, cf. §11) ;
     · il fallait DEVINER dans quel dépliant chercher, sans recherche ;
     · un libellé et une icône ne disent pas à quoi ressemblera le widget.

   ⚠️ `position: fixed` DANS UNE IFRAME se réfère au viewport de l'iframe, pas à celui
   de la page Softr : la feuille couvre donc le bloc, jamais l'app autour. C'est le
   comportement voulu, et c'est déjà celui du toast (§11). En revanche, si le bloc est
   plus haut que la fenêtre, le centrage se fait sur le bloc — d'où `maxHeight: 86%` et
   un corps qui défile, pour qu'aucune carte ne finisse hors de portée.
   ============================================================================ */
function WidgetGallery({ posed, onAdd, onClose }: {
  posed: Set<string>;
  onAdd: (p: Preset) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [groupe, setGroupe] = useState("");     // "" = tous
  const champRef = useRef<HTMLInputElement | null>(null);
  useModalScrollLock();                         // la galerie est montée = elle est ouverte

  /* Le champ prend le focus à l'ouverture : la galerie s'utilise au clavier, on tape
     trois lettres et on valide. Échap ferme — c'est le réflexe attendu d'une feuille. */
  useEffect(() => {
    champRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* Recherche sur le libellé ET la description : « pipeline » doit trouver les
     indicateurs commerciaux, même si le mot n'est pas dans leur titre. Insensible aux
     accents — personne ne tape « à signer » avec l'accent dans un champ de recherche. */
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const terme = norm(q.trim());
  const visibles = PRESETS.filter((p) => {
    if (groupe && (GROUP_KEYS.has(p.group) ? p.group : "autres") !== groupe) return false;
    if (!terme) return true;
    return norm(`${p.label} ${p.desc}`).includes(terme);
  });

  /* Les pastilles ne listent que les groupes RÉELLEMENT peuplés : un onglet vide serait
     un cul-de-sac. Le compte de résultats est affiché — sans lui, une recherche sans
     réponse ressemble à un écran cassé. */
  const pills = [{ key: "", label: "Tous" }, ...PRESET_GROUPS.map((g) => ({ key: g.key, label: g.label }))];
  const pill = (actif: boolean): CSSProperties => ({
    padding: "6px 13px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
    fontSize: "12.5px", fontWeight: 600, whiteSpace: "nowrap",
    border: `1px solid ${actif ? T.brand : T.line}`,
    background: actif ? T.brand : T.surface,
    color: actif ? "#fff" : T.ink2,
  });

  return (
    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
        // Voile + flou : la grille reste devinée derrière, ce qui situe la feuille au
        // lieu de la faire surgir de nulle part.
        background: "rgba(16,26,40,.30)", backdropFilter: "blur(7px)", WebkitBackdropFilter: "blur(7px)",
        animation: "slb-fade .16s ease both",
      }}>
      <div role="dialog" aria-modal="true" aria-label="Ajouter un widget"
        style={{
          width: "min(880px, 100%)", maxHeight: "86%", display: "flex", flexDirection: "column",
          background: T.surface, borderRadius: T.rXl, boxShadow: T.shMd, border: `1px solid ${T.line}`,
          overflow: "hidden", animation: "slb-fade .18s ease both",
        }}>
        {/* En-tête : titre, fermeture, recherche, familles. Il ne défile pas. */}
        <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${T.line}`, flex: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={icoPillSm(false)}><Plus aria-hidden style={{ width: 15, height: 15 }} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: T.ink }}>Ajouter un widget</div>
              <div style={{ fontSize: "11.5px", fontWeight: 500, color: T.ink3 }}>
                {visibles.length} modèle{visibles.length > 1 ? "s" : ""} disponible{visibles.length > 1 ? "s" : ""}
              </div>
            </div>
            <button className="slb-nbtn" style={NBTN_SM} onClick={onClose} aria-label="Fermer la galerie" title="Fermer">
              <X aria-hidden style={{ width: 16, height: 16 }} />
            </button>
          </div>

          <div style={{ position: "relative", marginTop: "12px" }}>
            <SlidersHorizontal aria-hidden style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: T.ink4 }} />
            <input ref={champRef} value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un widget…" aria-label="Rechercher un widget"
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 34px", borderRadius: T.rMd, border: `1px solid ${T.line}`, background: T.surface2, color: T.ink, fontFamily: "inherit", fontSize: "13px", fontWeight: 500 }} />
          </div>

          <div style={{ display: "flex", gap: "6px", marginTop: "10px", overflowX: "auto", paddingBottom: "2px" }}>
            {pills.map((p) => (
              <button key={p.key || "tous"} style={pill(groupe === p.key)} onClick={() => setGroupe(p.key)}
                aria-pressed={groupe === p.key}>{p.label}</button>
            ))}
          </div>
        </div>

        {/* Corps : la grille de cartes, seule zone qui défile. `maxHeight: none` ANNULE le
            plafond de 340 px de `.slb-scrolly` (fait pour le corps d'un widget, pas pour
            une feuille) — sans lui la galerie ne défilait que sur 340 px, le reste de la
            feuille restant vide. La classe n'est gardée que pour l'ascenseur fin. */}
        <div className="slb-scrolly" style={{ ...MODAL_BODY, maxHeight: "none", padding: "16px 18px 20px", background: T.surface2 }}>
          {!visibles.length ? (
            <EmptyState icon={LayoutGrid} title="Aucun widget ne correspond"
              hint={terme ? `Rien pour « ${q.trim()} ». Essayez un autre mot, ou changez de famille.` : "Cette famille est vide."} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(214px, 1fr))", gap: "14px" }}>
              {visibles.map((p) => {
                /* Modèle déjà posé : la carte reste VISIBLE et lisible, simplement inerte
                   et marquée « Ajouté ». La masquer ferait croire qu'il n'existe plus. */
                const deja = posed.has(p.key);
                const Icon = p.icon;
                return (
                  <div key={p.key}
                    style={{ display: "flex", flexDirection: "column", gap: "9px", padding: "12px", borderRadius: T.rLg, background: T.surface, border: `1px solid ${T.line}`, boxShadow: T.shSm, opacity: deja ? 0.72 : 1 }}>
                    <PresetShape kind={p.shape} />
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0 }}>
                      <Icon aria-hidden style={{ width: 14, height: 14, color: T.ink4, flex: "none" }} strokeWidth={1.7} />
                      <span style={{ minWidth: 0, fontSize: "13px", fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.label}</span>
                    </div>
                    <div style={{ flex: 1, fontSize: "11.5px", fontWeight: 500, color: T.ink3, lineHeight: 1.4 }}>{p.desc}</div>
                    {/* Le `hint` du preset (« source non connectée ») est une réserve sur
                        la donnée, pas une description : il garde sa place à part, en ambre. */}
                    {p.hint && (
                      <div style={{ fontSize: "11px", fontWeight: 600, color: T.warnInk }}>{p.hint}</div>
                    )}
                    <button className={deja ? undefined : "slb-btnp"} onClick={() => onAdd(p)} disabled={deja}
                      aria-label={deja ? `${p.label} — déjà sur votre tableau de bord` : `Ajouter ${p.label}`}
                      title={deja ? "Déjà sur votre tableau de bord" : undefined}
                      style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px",
                        padding: "8px 12px", borderRadius: T.rSm, fontFamily: "inherit", fontSize: "12.5px", fontWeight: 700,
                        cursor: deja ? "default" : "pointer",
                        border: deja ? `1px solid ${T.line}` : "none",
                        background: deja ? T.surface2 : T.brand, color: deja ? T.ink4 : "#fff",
                      }}>
                      {deja
                        ? <><Check aria-hidden style={{ width: 14, height: 14 }} />Ajouté</>
                        : <><Plus aria-hidden style={{ width: 14, height: 14 }} />Ajouter</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* Copie défensive d'une instance. La cfg est clonée EN PROFONDEUR (elle contient
   des objets imbriqués : `map`, `sort`) : deux instances issues d'un même modèle,
   ou une duplication, ne doivent jamais partager de référence. Le passage par JSON
   est légitime ici — une cfg est par construction sérialisable (elle vit dans
   `layout_json`) — et retombe sur `{}` si elle ne l'est pas. */
const cloneCfg = (cfg: unknown): unknown => {
  if (cfg === undefined || cfg === null) return {};
  try { return JSON.parse(JSON.stringify(cfg)); } catch { return {}; }
};
const cloneInstance = (i: Instance): Instance => ({ ...i, cfg: cloneCfg(i.cfg) });

const emptyLayout = (): Layout => ({ v: 2, items: [], parked: [], seeded: [] });

// Layout par défaut = les instances par défaut, semées. Copie défensive garantie.
const cloneDefault = (): Layout => seed(emptyLayout());

const idxOf = (list: Instance[], id: string): number => list.findIndex((i) => i.id === id);

/** Injecte les instances par défaut JAMAIS VUES par cet utilisateur (en fin
 *  d'`items`, visibles) et les marque `seeded`. PURE. Vue une fois = plus jamais
 *  imposée : supprimer un widget par défaut est définitif.
 *  ⚠️ SANS EFFET depuis le 2026-08-24 : `DEFAULT_INSTANCES` est vide, donc `missing`
 *  l'est toujours et cette fonction rend son argument tel quel. Le mécanisme est
 *  CONSERVÉ, pas mort — il reste la seule façon de pousser un widget chez tout le
 *  monde (une annonce, un widget de campagne) sans le réimposer à qui l'a retiré. */
function seed(l: Layout): Layout {
  const known = new Set<string>([
    ...l.items.map((i) => i.id), ...l.parked.map((i) => i.id), ...l.seeded,
  ]);
  const missing = DEFAULT_INSTANCES.filter((d) => !known.has(d.id));
  if (!missing.length) return l;
  return {
    ...l,
    items: [...l.items, ...missing.map(cloneInstance)],
    seeded: [...l.seeded, ...missing.map((d) => d.id)],
  };
}

/** Assainit une instance issue du stockage. `seen` déduplique les ids entre
 *  items/hidden/parked (priorité à l'ordre d'appel). PURE ; ne throw jamais. */
function coerceInstance(raw: unknown, seen: Set<string>): Instance | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  const type = typeof o.type === "string" ? o.type : "";
  if (!id || !type || seen.has(id)) return null;
  seen.add(id);
  return {
    id, type,
    cfg: o.cfg ?? {},                                            // BRUTE : jamais « réparée » en stockage
    w: o.w === "full" ? "full" : "half",                         // clamp
    h: coerceHeight(o.h),                     // pixels ; une ancienne clé est traduite
    ...(typeof o.preset === "string" && o.preset ? { preset: o.preset } : {}),
    /* Titre personnalisé : borné et débarrassé de ses espaces, et OMIS s'il ne reste
       rien — un `title: ""` stocké ne dirait pas autre chose que son absence, autant
       ne pas alourdir le document. */
    ...(typeof o.title === "string" && o.title.trim()
      ? { title: o.title.trim().slice(0, WIDGET_TITLE_MAX) }
      : {}),
    /* Teinte : conservée SEULEMENT si la clé existe dans la palette. Une clé inconnue
       (palette réduite depuis, document édité à la main) est écartée à la lecture — le
       widget reprend l'en-tête blanc au lieu de perdre sa couleur de titre. */
    ...(typeof o.tint === "string" && WIDGET_TINTS.some((t) => t.key === o.tint && t.key)
      ? { tint: o.tint }
      : {}),
  };
}

// Liste de chaînes uniques et non vides (pour `seeded`).
const uniqueStrings = (list: unknown): string[] =>
  Array.isArray(list) ? Array.from(new Set(list.filter((x): x is string => typeof x === "string" && !!x))) : [];

/**
 * Réconcilie un layout sauvegardé (BDD **ou** cache local) avec le code courant.
 * Fonction PURE, ne throw JAMAIS.
 * · JSON invalide / non-objet / version ∉ {1,2} → défaut semé
 * · v1 → migration mécanique (migrateV1), sans perte
 * · v2 → assainissement : instance sans id/type ou en doublon écartée, w/h clampés,
 *        `type` inconnu → déplacé vers `parked` (JAMAIS supprimé), `cfg` laissée brute
 * · puis seed() : les instances par défaut jamais vues sont ajoutées, visibles.
 */
function normalizeLayout(saved: unknown, knownTypes: readonly string[] = TYPE_KEYS): Layout {
  let obj: any = saved;
  if (typeof saved === "string") {
    try { obj = JSON.parse(saved); } catch { return cloneDefault(); }
  }
  if (!obj || typeof obj !== "object") return cloneDefault();
  if (obj.v === 1) return migrateV1(obj, knownTypes);
  if (obj.v !== 2) return cloneDefault();

  const valid = new Set<string>(knownTypes);
  const seen = new Set<string>();
  const items: Instance[] = [], parked: Instance[] = [];
  const take = (list: unknown, dest: Instance[], forceHalf = false) => {
    if (!Array.isArray(list)) return;
    for (const raw of list) {
      const inst = coerceInstance(raw, seen);
      if (!inst) continue;
      if (!valid.has(inst.type)) parked.push(inst);           // type inconnu : gardé au frigo
      else dest.push(forceHalf ? { ...inst, w: "half" } : inst);
    }
  };
  take(obj.items, items);
  /* MIGRATION « plus de masqués » — les documents écrits avant la suppression de
     `hidden` en contiennent : leurs instances sont REMONTÉES EN VISIBLE, à la suite.
     On ne les jette pas. Perdre la cfg d'un widget qu'on supprime soi-même est un
     arbitrage assumé ; voir disparaître sans un mot un widget qu'on avait seulement
     mis de côté serait un bug — et l'utilisateur seul décide de le supprimer.
     `forceHalf` : ces instances avaient été passées en demi-largeur au masquage, on
     ne leur rend pas une pleine largeur qu'elles n'avaient plus.
     Le champ n'est plus JAMAIS écrit : il disparaît du document au prochain
     « Enregistrer », et cette lecture devient alors inutile. */
  take(obj.hidden, items, true);
  take(obj.parked, parked);
  return seed({ v: 2, items, parked, seeded: uniqueStrings(obj.seeded) });
}

/**
 * Migration v1 → v2. Mécanique, sans perte : les WidgetId v1 SONT les clés de
 * type legacy, `wide`/`sizes` deviennent `w`/`h` de l'instance. PURE.
 * `seeded` = les ids RÉELLEMENT PRÉSENTS dans le layout v1 (et non tous les
 * défauts) : un widget par défaut livré après la dernière sauvegarde v1 de cet
 * utilisateur continue donc d'apparaître, exactement comme le faisait le
 * normalize v1. Écrit en base seulement au prochain « Enregistrer ».
 */
function migrateV1(v1: any, knownTypes: readonly string[] = TYPE_KEYS): Layout {
  const valid = new Set<string>(knownTypes);
  const seen = new Set<string>();
  const items: Instance[] = [], parked: Instance[] = [];
  const conv = (list: unknown, dest: Instance[], forceHalf = false) => {
    if (!Array.isArray(list)) return;
    for (const id of list) {
      if (typeof id !== "string" || !id || seen.has(id)) continue;
      seen.add(id);
      const size = v1?.sizes?.[id];
      const inst: Instance = {
        id, type: id, cfg: {},
        w: !forceHalf && Array.isArray(v1?.wide) && v1.wide.includes(id) ? "full" : "half",
        h: coerceHeight(size),
      };
      if (!valid.has(id)) parked.push(inst); else dest.push(inst);
    }
  };
  conv(v1?.order, items);
  // Un layout v1 avait aussi ses masqués : même règle qu'en v2, ils remontent en
  // visible plutôt que de disparaître (cf. la note de normalizeLayout).
  conv(v1?.hidden, items, true);
  return seed({ v: 2, items, parked, seeded: Array.from(seen) });
}

/** Déplace l'élément d'index `from` vers l'index `to`. Fonction PURE (copie).
 *  Indices hors bornes ou identiques → renvoie une copie inchangée (no-op). */
function reorder<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return next;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Monte (dir -1) ou descend (dir +1) une instance visible. PURE. Bord → no-op. */
/* `moveWidget` (déplacement d'UN cran, par id) a été SUPPRIMÉE le 2026-08-07 avec les
   boutons « Monter / Descendre » du ⋮ : le réordonnancement ne passe plus que par le
   glisser-déposer, qui travaille sur des INDEX (`reorder`, juste au-dessus) et n'a jamais
   eu besoin de cette fonction. Elle est facile à réécrire (trois lignes autour de
   `reorder`) si un chemin clavier revient un jour. */

/* `hideWidget` / `showWidget` ont été SUPPRIMÉES (2026-08-03) : il n'y a plus de
   masquage, seulement `removeInstance`. Ne pas les réintroduire sans revenir sur
   l'arbitrage documenté au type `Layout`. */

/** Bascule la largeur d'une instance VISIBLE (pleine largeur ↔ moitié). PURE. */
function setWidgetWide(layout: Layout, id: string, value: boolean): Layout {
  const w: WidgetWidth = value ? "full" : "half";
  const i = idxOf(layout.items, id);
  if (i < 0 || layout.items[i].w === w) return layout;
  return { ...layout, items: layout.items.map((it) => (it.id === id ? { ...it, w } : it)) };
}

/** Règle la HAUTEUR d'une instance visible. PURE. ("md" est désormais stocké
 *  explicitement — plus de valeur implicite à reconstituer.) */
function setWidgetHeight(layout: Layout, id: string, raw: WidgetHeight): Layout {
  const i = idxOf(layout.items, id);
  /* ⚠️ LA BORNE EST ICI, au point d'écriture, et non chez les appelants : ils sont trois
     (le champ du ⋮, la poignée du bas, la pose depuis la galerie) et l'un d'eux finirait par
     l'oublier. Une hauteur hors bornes se verrait tout de suite ; une hauteur de 0 px, en
     revanche, se lirait comme un widget disparu. */
  const h = coerceHeight(raw);
  if (i < 0 || layout.items[i].h === h) return layout;
  return { ...layout, items: layout.items.map((it) => (it.id === id ? { ...it, h } : it)) };
}

/* --- MULTI-INSTANCES (phase 3) : ajouter, dupliquer, supprimer. Ces trois
   fonctions sont ce qui rend le découplage id ≠ type réellement utile — deux
   widgets du même type, réglés différemment, cohabitent sans rien de spécial. --- */

/** Tous les ids déjà « pris » par cet utilisateur, y compris `seeded` et `parked` :
 *  un id neuf ne doit jamais entrer en collision avec un id retiré mais mémorisé. */
const takenIds = (l: Layout): Set<string> =>
  new Set([...l.items, ...l.parked].map((i) => i.id).concat(l.seeded));

/** Id d'instance neuf. Les ids par défaut sont des clés de type (« notifs ») ;
 *  ceux créés à la main portent le préfixe `w_` — aucun risque de confusion. */
function newInstanceId(taken: Set<string>): string {
  let id = "";
  do { id = `w_${Math.random().toString(36).slice(2, 8)}`; } while (!id || taken.has(id));
  return id;
}

/** Clé de modèle d'une instance : `preset` s'il est là, sinon son `type` (cf. la note
 *  sur `Instance`). PURE. */
const presetKeyOf = (i: Instance): string => i.preset ?? i.type;

/** Modèles DÉJÀ posés sur la grille. Sert à n'en autoriser qu'un exemplaire. PURE. */
const usedPresets = (layout: Layout): Set<string> =>
  new Set(layout.items.map(presetKeyOf));

/** Ajoute une instance visible en fin de grille (galerie « Ajouter un widget »). PURE.
 *  UN SEUL EXEMPLAIRE PAR MODÈLE : si la clé est déjà posée, no-op. Le garde est ICI
 *  et pas seulement dans la galerie — un bouton grisé est un confort, pas une règle,
 *  et la règle doit tenir même si l'UI change. */
function addInstance(layout: Layout, type: string, cfg: unknown, h: WidgetHeight = H_DEFAULT, preset?: string): Layout {
  const key = preset ?? type;
  if (usedPresets(layout).has(key)) return layout;
  const inst: Instance = { id: newInstanceId(takenIds(layout)), type, cfg, w: "half", h, ...(preset ? { preset } : {}) };
  return { ...layout, items: [...layout.items, inst] };
}

/* `duplicateInstance` a été SUPPRIMÉE (2026-08-03), comme le masquage avant elle :
   poser deux fois la même famille de widget passe par la galerie, puis par les
   Options de chacun. Le multi-instances reste entier — c'est seulement le raccourci
   « copier celui-ci » qui disparaît. Ne pas la réintroduire sans motif. */

/** Supprime définitivement une instance. C'est le SEUL geste de retrait (plus de
 *  masquage, cf. le type `Layout`) : la cfg est perdue, et la reposer depuis la
 *  galerie donne une instance neuve avec la cfg du preset. PURE.
 *  `seeded` n'est PAS touché : un widget par défaut supprimé ne réapparaîtra pas
 *  au prochain chargement (il reste re-ajoutable via la galerie). */
function removeInstance(layout: Layout, id: string): Layout {
  if (idxOf(layout.items, id) < 0) return layout;
  return { ...layout, items: layout.items.filter((x) => x.id !== id) };
}

/** Renomme et teinte une instance — ou lui rend ses valeurs par défaut si `title` /
 *  `tint` sont vides. PURE. Les champs sont alors RETIRÉS de l'instance plutôt que mis à
 *  "" : le document ne garde pas trace d'un réglage annulé, et « aucun » n'a qu'une
 *  seule écriture possible. Les deux vont ensemble parce que le panneau les édite
 *  ensemble — deux fonctions séparées inviteraient à deux écritures, dont la seconde
 *  écraserait la première (cf. `persistOptions`). */
function setInstanceLook(layout: Layout, id: string, title: string, tint: string): Layout {
  if (idxOf(layout.items, id) < 0) return layout;
  const clean = title.trim().slice(0, WIDGET_TITLE_MAX);
  const teinte = WIDGET_TINTS.some((t) => t.key === tint && t.key) ? tint : "";
  return {
    ...layout,
    items: layout.items.map((it) => {
      if (it.id !== id) return it;
      const { title: _t, tint: _c, ...rest } = it;
      return { ...rest, ...(clean ? { title: clean } : {}), ...(teinte ? { tint: teinte } : {}) };
    }),
  };
}

/* ============================================================================
   11. Tableau de bord — héro, persistance & grille (réglages en direct)
   ============================================================================ */
/* --- Compteur du héro : À IMPLÉMENTER. Le chip « Notifications » du héro ne porte
   volontairement AUCUN nombre pour l'instant.

   Ce qui a été retiré et pourquoi :
     · « N tâches urgentes » — la notion n'existe pas dans le CRM, et la source des
       tâches partenaires n'étant pas connectée au héro, le chip affichait un « 0 »
       perpétuel, qui se lit comme « rien à faire » et non comme « pas encore branché ».
     · « N dossiers à traiter » — comptait `abonnes.slice(0, RECENT).length`, donc au
       plus RECENT : un plafond de liste, jamais une charge de travail. Le nombre était
       stable quoi qu'il arrive dans le parc.

   Pour le brancher pour de vrai, la source existe désormais : `notifC` est connectée
   (§6) et le widget des dossiers la lit déjà via <SourceFeed source="notifC">. Compter
   les non-lues suppose deux précautions :
     1. le SENS de la case est INVERSÉ dans la table (cochée = non lue, cf.
        SELECT_NOTIF_C) — compter les cochées, pas les décochées ;
     2. 385 des 2142 lignes n'ont AUCUN lien vers un abonné (relevé le 2026-08-05) :
        les compter gonflerait le chip de notifications que personne ne peut ouvrir.
   Le héro n'étant pas un widget, il lira sa source lui-même — `useRecords` avec `from`
   en DIRECT, contrainte Softr — ou deviendra un consommateur de <SourceFeed>. --- */

/* --- PERSISTANCE DES PRÉFÉRENCES (Plan A : create + update par datasource) ----
   · LECTURE au montage : useRecords(prefs) filtré sur l'e-mail courant →
     normalizeLayout. Cache localStorage pour un affichage INSTANTANÉ + secours
     si la BDD est injoignable. La BDD reste la SOURCE DE VÉRITÉ : à réception,
     elle écrase le cache.
   · ÉCRITURE : uniquement à « Enregistrer » (pas à chaque drop). Pas de record
     → création ; sinon mise à jour. Optimiste. Conflits (2 onglets/postes) :
     last-write-wins, assumé (pas de merge). Champs écrits : user_email (création),
     layout_json, updated_at, schema_version.
   · MIGRATION : un document v1 est migré EN MÉMOIRE à la lecture (migrateV1) et
     n'est réécrit en base qu'au prochain « Enregistrer ». ⚠️ Chemin destructif
     connu : revenir à un code v1 après une sauvegarde v2 (le normalize v1 ne
     reconnaîtrait pas `v:2` → défaut, puis écrasement au save suivant).
   · Jamais d'appel direct à l'API Airtable ni de clé côté client.

   ⚠️ Signature Softr réelle à CONFIRMER (onglet Chat du bloc) : ce code suppose
   useRecordCreate({ from, fields }).mutateAsync({ fields }) → { id }, symétrique
   de useRecordUpdate. Si l'API diffère, seul l'intérieur de `persist` change.

   La table de persistance est désormais une table AIRTABLE — base « SunLib CRM —
   Préférences » · table « Home Preferences » (§6) — et non plus une table Softr
   Tables : les alias du SELECT_PREFS pointent donc des NOMS de champs.
   Tant que DS.prefs vaut "TODO-…", PREFS_ENABLED=false → cache local SEUL
   (la page fonctionne, la disposition se souvient par navigateur). La connecter
   (onglet Sources) puis coller son id de datasource dans le define (§6) active
   l'enregistrement en base. --- */
const PREFS_ENABLED = !DS.prefs.startsWith("TODO");
const layoutKey = (email: string) => `slb-home-layout:${email}`;

function readLocalLayout(email: string): Layout | null {
  if (!email) return null;
  try {
    const raw = window.localStorage.getItem(layoutKey(email));
    // Le cache passe par le MÊME normalize que la BDD → migration v1→v2 transparente.
    return raw ? normalizeLayout(raw) : null;
  } catch { return null; }
}
function writeLocalLayout(email: string, layout: Layout): void {
  if (!email) return;
  try { window.localStorage.setItem(layoutKey(email), JSON.stringify(layout)); } catch { /* quota / mode privé : ignoré */ }
}

// Message lisible d'une erreur inconnue (Error / string / objet).
const msgOf = (e: unknown): string =>
  e instanceof Error ? e.message
  : typeof e === "string" ? e
  : (() => { try { return JSON.stringify(e); } catch { return String(e); } })();

function usePersistentLayout() {
  const user = useCurrentUser();
  const email = asText(user?.email).trim().toLowerCase();

  // Hooks TOUJOURS appelés (Rules of Hooks) ; ignorés si PREFS_ENABLED=false.
  const bddRes = useRecords({ from: DS.prefs, select: SELECT_PREFS, where: q.text("email").is(email) });
  const updateM = useRecordUpdate({ from: DS.prefs, fields: SELECT_PREFS });
  const createM = useRecordCreate({ from: DS.prefs, fields: SELECT_PREFS });

  const [layout, setLayout] = useState<Layout | null>(() => readLocalLayout(email));
  const [status, setStatus] = useState<"loading" | "ready">(() => (readLocalLayout(email) ? "ready" : "loading"));
  const recordId = useRef<string | null>(null);

  const bddRec = PREFS_ENABLED ? flatten(bddRes)[0] ?? null : null;
  const bddId = bddRec?.id ?? null;
  const bddLayoutStr = bddRec ? String(bddRec.fields.layout ?? "") : null;

  useEffect(() => {
    if (!PREFS_ENABLED) {                 // table non branchée : cache local seul
      recordId.current = null;
      setLayout((cur) => cur ?? cloneDefault());
      setStatus("ready");
      return;
    }
    if (bddRes.isLoading) return;         // squelettes tant que la BDD répond
    recordId.current = bddId;
    if (bddId) {                          // BDD = SOURCE DE VÉRITÉ → écrase le cache
      const next = normalizeLayout(bddLayoutStr);   // v1 → migré en mémoire (écrit au prochain « Enregistrer »)
      setLayout(next);
      writeLocalLayout(email, next);
    } else {
      setLayout((cur) => cur ?? cloneDefault());
    }
    setStatus("ready");
  }, [email, bddRes.isLoading, bddId, bddLayoutStr]);

  /** Écrit le layout : optimiste (état + cache local), puis BDD Softr.
   *  · CREATE (aucun record) : mutateAsync DIRECT { alias: valeur } — forme Softr create.
   *  · UPDATE (record connu) : mutateAsync ENVELOPPÉ { recordId, fields:{ alias: valeur } }.
   *  Clés = alias de SELECT_PREFS (mappés vers les noms de champs Airtable). Le layout
   *  reste appliqué localement même si la BDD échoue. Conflits : last-write-wins. */
  const persist = async (next: Layout): Promise<{ ok: boolean; error?: string; note?: string }> => {
    setLayout(next);
    writeLocalLayout(email, next);
    if (!PREFS_ENABLED) return { ok: true };
    // Aperçu non connecté → useCurrentUser() vide → pas de session/clé utilisateur :
    // Softr refuse l'insert. On ne tente rien en base sans email (évite le faux « Échec »).
    if (!email) return { ok: true, note: "Aperçu non connecté : sauvegarde en base uniquement une fois connecté (teste sur la page publiée)." };
    const layoutStr = JSON.stringify(next);
    const stamp = new Date().toISOString();
    try {
      if (recordId.current) {
        await updateM.mutateAsync({ recordId: recordId.current, fields: { layout: layoutStr, updatedAt: stamp, schemaVersion: LAYOUT_VERSION } });
      } else {
        const created: any = await createM.mutateAsync({ email, layout: layoutStr, updatedAt: stamp, schemaVersion: LAYOUT_VERSION });
        if (created?.id) recordId.current = created.id;
      }
      return { ok: true };
    } catch (e) {
      console.error("[SunLib] Échec persistance préférences :", e);
      return { ok: false, error: msgOf(e) };
    }
  };

  return { layout, status, persist };
}

/* --- Squelette de carte : affiché pendant le chargement des préférences
      (évite le saut visuel au reflow — on n'affiche pas le layout par défaut). --- */
function SkeletonCard() {
  const bar = (w: string, h: number, mt = 0): CSSProperties => ({ height: h, width: w, borderRadius: 6, background: T.neutral050, marginTop: mt });
  return (
    <Card style={CARD}>
      <div style={WHEAD}>
        <span className="slb-skel" style={{ width: 28, height: 28, borderRadius: 8, background: T.neutral050, flex: "none" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="slb-skel" style={bar("52%", 11)} />
          <div className="slb-skel" style={bar("34%", 9, 6)} />
        </div>
      </div>
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "14px" }}>
        {[0, 1, 2].map((k) => (
          <div key={k} style={{ display: "flex", gap: "11px", alignItems: "center" }}>
            <span className="slb-skel" style={{ width: 32, height: 32, borderRadius: 9, background: T.neutral050, flex: "none" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="slb-skel" style={bar("70%", 10)} />
              <div className="slb-skel" style={bar("45%", 9, 6)} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* --- Grille du tableau de bord — TOUT EN DIRECT --------------------------------
   ⚠️⚠️ 2026-08-07 — LE MODE « PERSONNALISER » A ÉTÉ SUPPRIMÉ, et avec lui le
   brouillon, « Enregistrer », « Annuler » et « Réinitialiser ». Il ne reste qu'un
   bouton : « Ajouter un widget ». Tout le reste s'applique et s'écrit AU GESTE :
     · réordonner — glisser l'en-tête d'une carte (DnD HTML5), ou « Monter/Descendre »
       dans le ⋮ (chemin clavier et tactile) ;
     · largeur / hauteur — poignées de bord et du bas (pointer, souris + doigt), ou les
       segments du ⋮ ;
     · réglages et retrait — la modale du ⋮ (elle seule garde un brouillon local, cf.
       `WidgetOptionsMenu`, sauf position et retrait qui agissent aussitôt).
   POURQUOI. Le mode ne protégeait plus rien : les poignées et les réglages étaient déjà
   sortis de l'édition (2026-08-06), il n'y restait qu'un doublon de gestes derrière deux
   clics et une question — « ai-je pensé à enregistrer ? » — à laquelle une page d'accueil
   n'a pas à faire réfléchir.
   CE QUI PROTÈGE MAINTENANT : l'écriture est OPTIMISTE et silencieuse quand elle
   réussit, mais tout échec s'affiche avec « Réessayer » (`runSave`), et le retrait d'un
   widget demande une confirmation. Il n'y a plus d'annulation globale : c'est le prix
   assumé du direct.
   Grille responsive via la classe .slb-dash ; un widget « pleine largeur » occupe
   gridColumn 1/-1. --- */
function Dashboard() {
  const { layout: applied, status, persist } = usePersistentLayout();
  // Nombre de colonnes selon la largeur RÉELLE DU BLOC (et non de la fenêtre : le
  // bloc vit dans une iframe étroite alors que la fenêtre est large). Mesuré en JS
  // plutôt qu'en container query : le style inline qui en découle fonctionne même
  // si la feuille injectée n'est pas appliquée dans Softr.
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [twoCols, setTwoCols] = useState(true);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => setTwoCols(el.getBoundingClientRect().width >= 720);
    measure();
    if (typeof ResizeObserver !== "function") {           // repli : redimensionnement fenêtre
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  });
  /* Styles FONCTIONNELS de la grille — inline, jamais en CSS injecté.
     `alignItems: start` reste nécessaire : sans lui, un widget s'étirerait sur
     toutes les lignes qu'il occupe et le tassement ne se verrait pas. */
  const dashStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: twoCols ? "repeat(2, minmax(0, 1fr))" : "1fr",
    gridAutoRows: `${DASH_ROW}px`,
    columnGap: `${DASH_GAP}px`,
    rowGap: 0,                     // ⚠️ voir la note sur DASH_GAP : jamais de rowGap ici
    alignItems: "start",
  };

  /* Hauteur mesurée de chaque widget, en NOMBRE DE LIGNES de la grille. C'est ce qui
     permet le tassement : la hauteur d'un widget n'est pas déductible de sa taille
     réglée (`h` borne le corps scrollable par un `max-height` — un widget peu rempli
     est plus court), il faut donc l'observer.
     ⚠️ `offsetHeight` et NON `getBoundingClientRect()` : le FLIP applique des
     `scale()` sur les wrappers pendant ses animations, et un rect inclut les
     transforms des ancêtres — les hauteurs mesurées seraient fausses à chaque
     réordonnancement. `offsetHeight` ignore les transforms. */
  const [spans, setSpans] = useState<Record<string, number>>({});
  const spanOf = (h: WidgetHeight, hasFooter = true): number =>
    // Repli avant la première mesure (et si ResizeObserver manque) : en-tête ~52 px,
    // pied ~49 px. Évite un saut de mise en page au premier rendu.
    Math.ceil((h + 52 + (hasFooter ? 49 : 0) + DASH_GAP) / DASH_ROW);
  // Galerie d'ajout : une feuille modale, seul bouton de la barre du tableau de bord.
  const [gallery, setGallery] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; layout?: Layout; error?: string } | null>(null);

  const loading = status === "loading" && !applied;   // squelettes tant que rien à afficher
  const current = applied ?? cloneDefault();
  /* APERÇU d'un redimensionnement EN COURS. Il n'y a pas de brouillon : le geste a donc
     besoin d'un layout temporaire pour que la carte suive la souris pendant qu'on tire.
     ⚠️ On n'écrit PAS en base à chaque cran : un glissement franchit plusieurs seuils, ce
     qui ferait autant d'écritures concurrentes sur le même document. L'écriture a lieu une
     seule fois, au relâchement (cf. `onResizeUp` / `onSizeUp`). */
  const [livePreview, setLivePreview] = useState<Layout | null>(null);
  const shown = livePreview ?? current;
  const resetDrag = () => { setDragIndex(null); setOverIndex(null); };

  // Toast succès : disparition auto ; échec : reste jusqu'à Réessayer / fermeture.
  useEffect(() => {
    if (!toast?.ok || toast.error) return;   // succès "nu" seulement ; garde le message de diagnostic à l'écran
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Animation FLIP — à chaque changement d'ordre ou de largeur, les cartes GLISSENT
  // de leur ancienne position/taille vers la nouvelle (réordonnancement DnD +
  // élargissement ; le voisin qui descend s'anime aussi). Mesure à chaque rendu
  // (prev toujours frais), animation seulement si la disposition a changé.
  // Contenu contre-scalé (innerRefs) → pas de distorsion. Respecte reduced-motion.
  // Clés = ids d'INSTANCE (une même clé de type peut être posée plusieurs fois).
  const wrapRefs = useRef(new Map<string, HTMLElement>());
  const innerRefs = useRef(new Map<string, HTMLElement>());
  const flipPrev = useRef(new Map<string, DOMRect>());
  const flipSig = useRef("");
  useLayoutEffect(() => {
    const sig = `${shown.items.map((it) => `${it.id}:${it.w}:${it.h}`).join(",")}|${loading}`;
    const changed = sig !== flipSig.current;
    flipSig.current = sig;
    const prev = flipPrev.current;
    const next = new Map<string, DOMRect>();
    wrapRefs.current.forEach((el, id) => next.set(id, el.getBoundingClientRect()));
    const reduce = typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    /* ⚠️ JAMAIS D'ANIMATION PENDANT UN REDIMENSIONNEMENT ACTIF. Le FLIP est fait pour
       un changement DISCRET (on lâche une carte ailleurs, elle glisse). Pendant un
       glissement de poignée, la disposition change à chaque cran : les animations de
       340 ms se déclenchaient en rafale et se chevauchaient, ce qui donnait cette
       impression de tremblement où l'on ne distingue plus ce qu'on règle. Sans
       animation, le changement est instantané et NET — on voit ce qu'on fait. */
    const resizing = !!resizeRef.current || !!sizeRef.current;
    if (changed && !reduce && !resizing) {
      wrapRefs.current.forEach((el, id) => {
        const p = prev.get(id), n = next.get(id);
        if (!p || !n) return;
        const dx = p.left - n.left, dy = p.top - n.top;
        const sx = n.width ? p.width / n.width : 1, sy = n.height ? p.height / n.height : 1;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return;
        const inner = innerRefs.current.get(id);
        el.style.transition = "none"; el.style.transformOrigin = "top left"; el.style.zIndex = "3";
        el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
        if (inner) { inner.style.transition = "none"; inner.style.transformOrigin = "top left"; inner.style.transform = `scale(${1 / sx}, ${1 / sy})`; }
        requestAnimationFrame(() => {
          const ease = "transform 340ms cubic-bezier(.22,.61,.36,1)";
          el.style.transition = ease; el.style.transform = "";
          if (inner) { inner.style.transition = ease; inner.style.transform = ""; }
          const done = () => {
            el.style.transition = ""; el.style.transform = ""; el.style.zIndex = ""; el.style.transformOrigin = "";
            if (inner) { inner.style.transition = ""; inner.style.transform = ""; inner.style.transformOrigin = ""; }
            el.removeEventListener("transitionend", done);
          };
          el.addEventListener("transitionend", done);
        });
      });
    }
    flipPrev.current = next;
  });

  /* Mesure des hauteurs pour le TASSEMENT. Un ResizeObserver par widget, sur le div
     INTERNE (celui qui porte la carte), pas sur le wrapper : le wrapper inclut le
     padding d'espacement et subit les transforms du FLIP.
     · Pas de tableau de dépendances — comme la mesure des colonnes plus haut : le
       ré-observage à chaque rendu prend en charge les widgets ajoutés ou retirés.
     · Le garde `changed` est OBLIGATOIRE : sans lui, chaque mesure déclencherait un
       rendu, qui recréerait l'observateur, qui mesurerait à nouveau — boucle infinie.
     · Repli sans ResizeObserver : les spans restent ceux de `spanOf`, donc la
       disposition reste correcte, simplement sans tassement au pixel. */
  useEffect(() => {
    if (typeof ResizeObserver !== "function") return;
    const measure = () => {
      setSpans((prev) => {
        const next = { ...prev };
        let changed = false;
        innerRefs.current.forEach((el, id) => {
          const n = Math.ceil((el.offsetHeight + DASH_GAP) / DASH_ROW);
          if (n > 0 && next[id] !== n) { next[id] = n; changed = true; }
        });
        return changed ? next : prev;
      });
    };
    const ro = new ResizeObserver(measure);
    innerRefs.current.forEach((el) => ro.observe(el));
    measure();
    return () => ro.disconnect();
  });

  /** `silent` : succès sans toast. Réservé aux gestes DIRECTS et répétés (déplacer ou
   *  redimensionner un widget) — un bandeau de confirmation à chaque glissement serait du
   *  bruit. L'ÉCHEC reste toujours annoncé : une écriture perdue en silence est bien pire
   *  qu'un toast de trop, surtout depuis qu'il n'y a plus de « Enregistrer » où se
   *  rattraper. */
  const runSave = async (next: Layout, silent = false) => {
    const res = await persist(next);                  // optimiste : le layout est déjà appliqué
    if (silent && res.ok && !res.note) return;
    setToast(res.ok ? { ok: true, error: res.note } : { ok: false, layout: next, error: res.error });
  };

  /** Enregistre la cfg d'une instance (écriture du widget lui-même : pense-bête, liste à
   *  cocher, tri d'une colonne…). Optimiste + toast en cas d'échec, écriture d'un seul
   *  document `layout_json`. La cfg est stockée TELLE QUELLE (le rendu la passe par
   *  `coerce`). Un seul écrivain par instance, donc pas de conflit possible. */
  const persistCfg = (id: string, cfg: unknown) =>
    void runSave({ ...current, items: current.items.map((it) => (it.id === id ? { ...it, cfg } : it)) });

  /** Enregistre TITRE, TEINTE et cfg en UNE écriture : le panneau ⋮ les édite ensemble,
   *  et deux `runSave` successifs se marcheraient dessus (le second partirait de
   *  `current`, encore inchangé, et perdrait le premier). */
  const persistOptions = (id: string, title: string, tint: string, cfg: unknown, wide: boolean) => {
    const withCfg = { ...current, items: current.items.map((it) => (it.id === id ? { ...it, cfg } : it)) };
    /* Une SEULE écriture pour les quatre réglages du panneau. Les fonctions pures se
       composent sur le layout intermédiaire : chaîner des `runSave` repartirait chaque
       fois de `current`, encore inchangé, et ne garderait que le dernier.
       ⚠️ La HAUTEUR n'en fait plus partie (2026-08-07) : elle n'a qu'un chemin, la poignée,
       qui écrit par `applyLive` + `commitLive`. */
    const withLook = setInstanceLook(withCfg, id, title, tint);
    void runSave(setWidgetWide(withLook, id, wide));
  };

  /** Retire une instance depuis son ⋮. Écriture immédiate, comme tout le reste.
   *  ⚠️ `true` en 2e argument de `runSave` : le retrait est CONFIRMÉ par un toast, alors
   *  qu'un simple réglage reste silencieux. Un widget qui disparaît sans un mot laisse
   *  penser à un bug d'affichage — et c'est le seul geste de ce panneau qui détruise
   *  quelque chose (la cfg de l'instance est perdue ; le widget se repose depuis la
   *  galerie, mais avec les réglages par défaut). */
  const persistRemove = (id: string) => void runSave(removeInstance(current, id), true);

  /* Ajout depuis la galerie : écrit IMMÉDIATEMENT. Silencieux si tout va bien, toast en
     cas d'échec (`runSave`) — poser un widget est un geste courant, il n'a pas à
     s'annoncer. */
  const onAdd = (p: Preset) => void runSave(addInstance(current, p.type, p.cfg(), p.h ?? H_DEFAULT, p.key), true);
  // Modèles déjà sur la grille — la galerie les grise (un seul exemplaire par modèle).
  const posed = usedPresets(shown);

  /* DnD HTML5 natif. Drop hors cible → no-op (seul onDragEnd nettoie l'état).
     Le déplacement est écrit IMMÉDIATEMENT — sans brouillon, il serait perdu au
     rechargement. En silence si tout va bien (cf. `runSave`), mais un échec s'affiche. */
  const onDrop = (to: number) => {
    if (dragIndex !== null && dragIndex !== to) {
      void runSave({ ...current, items: reorder(current.items, dragIndex, to) }, true);
    }
    resetDrag();
  };

  /* Origine RÉELLE du dernier appui sur un en-tête. `dragstart` ne la donne pas (sa
     cible est la source du glissement, c'est-à-dire l'en-tête `draggable` lui-même), d'où
     cette mémoire remplie au `pointerdown` en capture — cf. la note de `WidgetGrab`.
     Une seule ref pour toute la grille suffit : le dernier appui est forcément celui du
     widget qu'on est en train de glisser. */
  const grabFromRef = useRef<Element | null>(null);

  /** Ce qui INTERDIT de glisser : les éléments interactifs de l'en-tête (le ⋮, dont le
   *  clic serait annulé par `dragstart` — bug du 2026-08-03) et tout panneau flottant qui
   *  y est rendu, modale de réglages comprise (bug du 2026-08-18). `data-slb-nodrag`
   *  couvre ce qu'aucun rôle ARIA ne désigne, en premier lieu le FOND de la modale. */
  const NO_DRAG_FROM = 'button, select, input, textarea, label, a, [role="menu"], [role="dialog"], [data-slb-nodrag]';

  /** Préhension par l'en-tête, fournie à CHAQUE widget.
   *  L'image de glissement est forcée sur la carte entière : sans cela, le navigateur
   *  ne trimballerait que le bandeau de l'en-tête, ce qui rend la cible illisible. */
  const grabOf = (id: string, i: number): WidgetGrab => ({
    onPointerDownCapture: (e) => { grabFromRef.current = e.target as Element | null; },
    onDragStart: (e) => {
      if (resizeRef.current || sizeRef.current) { e.preventDefault(); return; }
      /* On juge sur l'origine mémorisée, et `e.target` reste un second filet : si un
         navigateur nous donnait un jour l'élément profond, la garde marcherait aussi. */
      const from = grabFromRef.current ?? (e.target as Element | null);
      if (from?.closest?.(NO_DRAG_FROM) || (e.target as Element | null)?.closest?.(NO_DRAG_FROM)) {
        e.preventDefault(); return;
      }
      const card = wrapRefs.current.get(id);
      if (card && e.dataTransfer.setDragImage) e.dataTransfer.setDragImage(card, 24, 24);
      setDragIndex(i);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
    },
    onDragEnd: resetDrag,
  });

  /* --- VERROU DE HAUTEUR pendant un glissement de poignée -----------------------
     La grille se tasse : régler un widget change la hauteur totale de la page, donc
     la position de scroll relative — l'écran semblait « monter et descendre » sous
     le curseur pendant qu'on réglait. On fige donc la hauteur du conteneur au début
     du geste : la page ne peut plus RACCOURCIR pendant le réglage. Elle peut encore
     s'allonger, sinon on ne verrait pas un widget grandir. Relâché au pointerup. --- */
  const [lockH, setLockH] = useState<number | null>(null);
  const freezeHeight = () => setLockH(gridRef.current?.offsetHeight ?? null);

  /* Redimensionnement en largeur (poignées de bord) — événements POINTER (souris
     + tactile), PAS de DnD HTML5. On tire vers l'extérieur → pleine largeur, vers
     l'intérieur → normale. side=+1 poignée droite, -1 gauche.
     ⚠️ HYSTÉRÉSIS : après chaque bascule, l'origine du geste est RECALÉE, si bien
     qu'il faut refaire tout le seuil pour rebasculer. Sans ça, une main qui tremble
     autour du seuil faisait osciller le widget entre les deux largeurs. */
  const RESIZE_STEP = 56;
  const resizeRef = useRef<{ id: string; startX: number; side: 1 | -1 } | null>(null);
  const onResizeDown = (id: string, side: 1 | -1) => (e: ReactPointerEvent<HTMLElement>) => {
    e.stopPropagation(); e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    resizeRef.current = { id, startX: e.clientX, side };
    freezeHeight();
  };
  /* `applyLive` : le changement va dans l'APERÇU local (la carte suit la souris cran par
     cran), et il est écrit en base UNE SEULE FOIS, au relâchement.

     ⚠️⚠️ L'APERÇU EST DOUBLÉ D'UNE REF, et ce n'est pas une redondance — c'est la
     correction d'un GEL D'ONGLET (2026-08-06). La première version lisait l'aperçu dans
     l'updater de `setState` et y appelait l'écriture :

         setLivePreview((p) => { if (p) void runSave(p, true); return null; });   // ❌

     Un updater de `useState` doit être PUR. Celui-ci déclenchait d'autres `setState`
     (layout appliqué, toast) PENDANT la phase de rendu, donc un nouveau rendu, donc un
     nouvel updater : boucle infinie. Symptômes exacts rapportés — le curseur reste bloqué
     en « redimensionner », la page ne répond plus, et l'onglet ne peut même plus être
     rechargé (le thread principal ne rend jamais la main).
     La ref porte donc la valeur COURANTE, lisible et écrivable hors de tout updater ;
     `setLivePreview` ne fait plus que déclencher le rendu. Ne jamais revenir en arrière :
     tout ce qui écrit ou persiste doit rester DEHORS des updaters. */
  const liveRef = useRef<Layout | null>(null);
  const applyLive = (fn: (l: Layout) => Layout) => {
    const next = fn(liveRef.current ?? current);
    liveRef.current = next;
    setLivePreview(next);
  };
  /** Fin d'un geste de poignée : UNE écriture, silencieuse si elle réussit. Un
   *  redimensionnement est un geste direct et répété — un toast à chaque poignée
   *  relâchée serait du bruit. L'échec, lui, reste toujours annoncé (`runSave`). */
  const commitLive = () => {
    const p = liveRef.current;
    liveRef.current = null;
    setLivePreview(null);
    if (p) void runSave(p, true);
  };
  const onResizeMove = (e: ReactPointerEvent<HTMLElement>) => {
    const r = resizeRef.current; if (!r) return;
    /* ⚠️ AUCUN BOUTON ENFONCÉ = le geste est fini, même si on n'a jamais reçu le
       `pointerup` (relâchement hors de l'iframe, événement avalé…). C'est LA garde qui
       empêche un widget de suivre la souris indéfiniment : sans elle, un seul événement
       perdu laissait le geste armé jusqu'au rechargement de la page. */
    if (e.buttons === 0) { onResizeUp(e); return; }
    const outward = (e.clientX - r.startX) * r.side; // >0 = tiré vers l'extérieur (élargir)
    if (outward > RESIZE_STEP) {
      r.startX += RESIZE_STEP * r.side;              // recalage → hystérésis
      applyLive((d) => setWidgetWide(d, r.id, true));
    } else if (outward < -RESIZE_STEP) {
      r.startX -= RESIZE_STEP * r.side;
      applyLive((d) => setWidgetWide(d, r.id, false));
    }
  };
  const onResizeUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (!resizeRef.current) return;
    const el = e.currentTarget as HTMLElement;
    // `hasPointerCapture` avant de relâcher : relâcher une capture qu'on n'a pas lève une
    // exception dans certains navigateurs, et elle interromprait la fin du geste — donc
    // `resizeRef` resterait armé et le widget suivrait la souris SANS bouton enfoncé.
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    resizeRef.current = null;
    setLockH(null);
    commitLive();
  };

  /* Redimensionnement en HAUTEUR (poignée du bas) — pointer. La carte SUIT LA SOURIS :
     depuis le 2026-08-07 la hauteur est un nombre de pixels, plus un cran parmi quatre.
     ⚠️ CE QUI DISPARAÎT AVEC LES CRANS, et c'est un soulagement : l'HYSTÉRÉSIS. Le cran se
     calculait en `Math.round(dy / 70)`, si bien qu'à mi-chemin (35 px) le moindre
     frémissement de la main faisait basculer la taille dans un sens puis dans l'autre, en
     boucle — c'était LA source du tremblement rapporté. Il fallait donc recaler l'origine à
     chaque bascule. Un réglage continu n'a pas ce problème par construction : la hauteur est
     une fonction MONOTONE de la position du pointeur (`startH + dy`), donc un tremblement
     de 1 px déplace de 1 px et rien ne peut osciller.
     ⚠️ Le pas visible reste `DASH_ROW` (4 px) : c'est `coerceHeight` qui arrondit, dans
     `setWidgetHeight`. En dessous, on paierait un rendu par pixel parcouru pour un changement
     invisible. */
  const sizeRef = useRef<{ id: string; startY: number; startH: number } | null>(null);
  const onSizeDown = (id: string) => (e: ReactPointerEvent<HTMLElement>) => {
    e.stopPropagation(); e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    /* ⚠️ La hauteur de départ se lit dans le layout AFFICHÉ (`shown`) : c'est le seul qui
       tienne compte d'un aperçu en cours, sans quoi un second geste repartirait de la
       hauteur enregistrée et la carte sauterait sous le curseur. */
    const h = shown.items[idxOf(shown.items, id)]?.h ?? H_DEFAULT;
    sizeRef.current = { id, startY: e.clientY, startH: h };
    freezeHeight();
  };
  const onSizeMove = (e: ReactPointerEvent<HTMLElement>) => {
    const r = sizeRef.current; if (!r) return;
    if (e.buttons === 0) { onSizeUp(e); return; }   // même garde que pour la largeur
    applyLive((d) => setWidgetHeight(d, r.id, r.startH + (e.clientY - r.startY)));
  };
  const onSizeUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (!sizeRef.current) return;
    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    sizeRef.current = null;
    setLockH(null);
    commitLive();
  };

  /* --- FILET DE SÉCURITÉ : aucun geste ne doit pouvoir rester ARMÉ -----------------
     Les deux gestes ci-dessus se terminent sur le `pointerup` de leur poignée. Ça
     suffit… tant que cet événement arrive. Trois cas où il n'arrive pas, et le bloc vit
     dans une IFRAME, ce qui les rend tous plausibles :
       · la souris est relâchée HORS de l'iframe (la capture devrait l'éviter, mais elle
         est perdue si le nœud est démonté entre-temps) ;
       · l'onglet perd le focus pendant le glissement (Alt-Tab, changement de fenêtre) ;
       · le navigateur annule le pointeur sans `pointercancel` (cas tactiles).
     Un geste resté armé, c'est précisément le symptôme rapporté : le widget suit la
     souris alors qu'aucun bouton n'est enfoncé, et le curseur reste en « redimensionner ».
     On écoute donc aussi la FENÊTRE pour clore le geste quoi qu'il arrive.

     ⚠️⚠️ EN PHASE DE PROPAGATION (bubble), JAMAIS EN CAPTURE. En capture, ce filet
     s'exécuterait AVANT le `onPointerUp` de la poignée : il viderait `resizeRef`, donc le
     handler de la poignée sortirait par son `if (!resizeRef.current) return` — et ne
     relâcherait JAMAIS la capture du pointeur. On recréerait exactement le blocage qu'on
     cherche à supprimer. En bubble sur `window`, le filet passe en dernier et ne trouve
     plus rien à faire quand le geste s'est terminé normalement.
     Les écouteurs sont posés à chaque rendu (pas de tableau de dépendances) pour voir un
     `commitLive` frais ; ils ne coûtent rien quand aucun geste n'est en
     cours (`return` immédiat). */
  useEffect(() => {
    const finir = () => {
      if (!resizeRef.current && !sizeRef.current) return;
      resizeRef.current = null;
      sizeRef.current = null;
      setLockH(null);
      commitLive();
    };
    window.addEventListener("pointerup", finir);
    window.addEventListener("pointercancel", finir);
    window.addEventListener("blur", finir);
    return () => {
      window.removeEventListener("pointerup", finir);
      window.removeEventListener("pointercancel", finir);
      window.removeEventListener("blur", finir);
    };
  });

  const btn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 13px", borderRadius: T.rMd, fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${T.line}`, background: T.surface, color: T.ink2 };
  const btnPrimary: CSSProperties = { ...btn, border: "none", background: T.brand, color: "#fff" };

  return (
    <section aria-label="Tableau de bord" className="slb-dash-wrap">
      {/* En-tête de section : titre + LE bouton. Un seul, depuis la suppression du mode
          « Personnaliser » (2026-08-07) : « Réinitialiser », « Annuler » et
          « Enregistrer » n'avaient de sens que face à un brouillon, et il n'y en a plus.
          Tout le reste se règle sur la carte elle-même. */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
        <h2 style={{ ...H2, flex: 1, minWidth: 120 }}>Tableau de bord</h2>
        {loading ? null : (
          <button className="slb-btnp" style={btnPrimary} onClick={() => setGallery(true)}>
            <Plus aria-hidden style={{ width: 16, height: 16 }} />Ajouter un widget
          </button>
        )}
      </div>

      {loading ? (
        /* Les squelettes reprennent la grille MAIS pas le tassement : ils sont tous
           de même hauteur, donc rien à tasser — et sans span calculé, les lignes
           fines de `dashStyle` les écraseraient sur 4 px. D'où `gridAutoRows: auto`
           et le `rowGap` rendu à la grille pour ce cas précis. */
        <div ref={gridRef} className="slb-dash" style={{ ...dashStyle, gridAutoRows: "auto", rowGap: `${DASH_GAP}px` }} aria-busy="true" aria-label="Chargement de votre disposition">
          {[0, 1, 2, 3].map((k) => <SkeletonCard key={k} />)}
        </div>
      ) : shown.items.length === 0 ? (
        /* ── L'ÉTAT VIDE, ET C'EST DÉSORMAIS L'ÉCRAN D'ACCUEIL DE TOUT NOUVEL ARRIVANT
           (2026-08-24) : `DEFAULT_INSTANCES` est vide, personne n'hérite plus d'une
           disposition. Il ne s'affiche donc plus seulement après une suppression — il est
           la PREMIÈRE CHOSE que voit un collègue, et il doit se lire comme une invitation,
           pas comme un manque.
           ⚠️ IL NOMME CE QU'ON PEUT POSER. Un état vide qui dit « c'est vide » et rien
           d'autre laisse la porte fermée : personne n'ouvre une galerie dont il ignore le
           contenu. Cette liste est donc à tenir à jour quand un type est ajouté ou retiré —
           c'est la seule phrase du bloc qui promette un contenu.
           ⚠️ ET IL DÉSIGNE LE BOUTON PAR SON LIBELLÉ EXACT (« Ajouter un widget »), celui
           qui est répété juste dessous ET en tête de section : une consigne qui nomme un
           bouton introuvable est pire que pas de consigne. */
        <Card style={CARD}>
          <EmptyState icon={LayoutGrid} title="Votre tableau de bord est vide"
            hint="Composez-le avec le bouton « + Ajouter un widget » : vos notifications de dossiers abonnés, vos tâches, les files « en attente de solvabilité » et « demandes d'infos », les dernières notes installateurs et prospects, la synthèse SAV, les classements commerciaux, le fil LinkedIn, un pense-bête ou une liste à cocher. Chaque modèle montre à quoi il ressemble avant d'être posé, et tout se déplace ensuite d'un glissement." />
          {/* Un état vide guidant DOIT porter le geste qui en sort (charte) — et ce geste
              est à un clic. Le MÊME bouton qu'en haut de section, volontairement : deux
              libellés pour un seul geste feraient douter qu'il s'agisse du même. */}
          <div style={{ display: "flex", justifyContent: "center", paddingBottom: "22px" }}>
            <button className="slb-btnp" style={btnPrimary} onClick={() => setGallery(true)}>
              <Plus aria-hidden style={{ width: 16, height: 16 }} />Ajouter un widget
            </button>
          </div>
        </Card>
      ) : (
        /* `minHeight` = verrou de hauteur pendant un glissement de poignée : la page
           ne raccourcit pas sous le curseur (voir freezeHeight). */
        <div ref={gridRef} className="slb-dash" style={{ ...dashStyle, minHeight: lockH ?? undefined }}>
          {shown.items.map((inst, i) => {
            // Type inconnu du code courant : ne devrait pas arriver (normalizeLayout
            // les met dans `parked`) — garde-fou pour ne jamais casser le rendu.
            const def = typeDefOf(inst.type);
            if (!def) return null;
            const Render = def.Render;
            // cfg interprétée AU RENDU (le stockage reste brut, cf. §10-bis).
            const cfg = cfgOf(def, inst.cfg);
            const id = inst.id;
            /* Le retour visuel du glissement ne dépend PLUS du mode : on déplace un
               widget dans les deux, il faut voir la source s'estomper et la cible se
               souligner dans les deux. */
            const isSource = dragIndex === i;
            const isTarget = overIndex === i && dragIndex !== null && dragIndex !== i;
            const wide = inst.w === "full";
            const size = inst.h;
            return (
              /* Le WRAPPER est la zone de DÉPÔT (toute la carte) ; la préhension, elle,
                 vit dans l'en-tête via `WidgetGrabCtx` — le wrapper n'est donc plus
                 `draggable`. Deux bénéfices : le contenu reste sélectionnable hors
                 édition, et un glisser ne peut plus partir du corps interactif. */
              <div key={id} className="slb-dragwrap"
                ref={(el) => { if (el) wrapRefs.current.set(id, el); else wrapRefs.current.delete(id); }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (overIndex !== i) setOverIndex(i); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverIndex((p) => (p === i ? null : p)); }}
                onDrop={(e) => { e.preventDefault(); onDrop(i); }}
                /* ⚠️ `position: relative` dans LES DEUX MODES depuis le 2026-08-06 : les
                   poignées de redimensionnement sont en `absolute` et existent aussi hors
                   édition — sans repère de position sur le wrapper, elles se placeraient
                   par rapport au premier ancêtre positionné, donc n'importe où. */
                style={{ ["--slb-wh" as any]: `${size}px`, position: "relative", gridColumn: wide ? "1 / -1" : undefined,
                  /* TASSEMENT : le widget occupe autant de lignes fines que sa hauteur
                     mesurée l'exige (repli `spanOf` avant la première mesure), et son
                     espacement bas est DANS le span — cf. la note sur DASH_GAP. */
                  gridRow: `span ${spans[id] ?? spanOf(size)}`,
                  paddingBottom: DASH_GAP,
                  borderRadius: T.rXl, opacity: isSource ? 0.5 : 1 }}>
                {/* ⚠️ LE LISERÉ DE CIBLE EST POSÉ ICI, sur la carte, et NON sur le wrapper.
                    Il y était avant le tassement, quand le wrapper épousait la carte ; depuis
                    que le wrapper porte `paddingBottom: DASH_GAP`, l'encadrer revenait à
                    encadrer la carte PLUS ses 18 px d'espacement — le liseré descendait donc
                    sous la carte et passait derrière le widget du dessous.
                    `zIndex` pendant le survol : le liseré dépasse de 8 px (offset 3 + halo 5),
                    et sans lui la carte suivante — peinte après dans l'ordre du DOM — le
                    recouvrait par le bas. `position: relative` est nécessaire pour que
                    `zIndex` s'applique. */}
                <div ref={(el) => { if (el) innerRefs.current.set(id, el); else innerRefs.current.delete(id); }}
                  style={{ borderRadius: T.rXl,
                    outline: isTarget ? `2px dashed ${T.brand}` : "2px dashed transparent", outlineOffset: 3,
                    boxShadow: isTarget ? `0 0 0 5px ${T.brand050}` : undefined,
                    position: isTarget ? "relative" : undefined, zIndex: isTarget ? 4 : undefined }}>
                  {/* Options — pour TOUS les types : même sans formulaire propre, un
                      widget est renommable, déplaçable, redimensionnable et retirable
                      (`Form` est alors `undefined` et le panneau n'affiche que
                      « Apparence »). */}
                  <WidgetOptionsCtx.Provider
                    value={{ cfg, Form: def.Options, title: inst.title ?? "", tint: inst.tint ?? "",
                      wide,
                      onSave: ({ title, tint, cfg: c, wide: w }) => persistOptions(id, title, tint, c, w),
                      onRemove: () => persistRemove(id) }}>
                    {/* Écriture de son propre contenu (pense-bête, liste à cocher) :
                        toujours ouverte — il n'y a plus qu'un seul écrivain. */}
                    <WidgetCfgCtx.Provider value={{ save: (c) => persistCfg(id, c) }}>
                      {/* Préhension par l'en-tête (réordonnancement à la souris). */}
                      <WidgetGrabCtx.Provider value={grabOf(id, i)}>
                        <WidgetTitleCtx.Provider value={inst.title ?? ""}>
                          <WidgetTintCtx.Provider value={inst.tint ?? ""}>
                            {/* Hauteur du corps scrollable — posée en ligne par ScrollBody. */}
                            <WidgetHeightCtx.Provider value={size}>
                              <Render id={id} cfg={cfg} />
                            </WidgetHeightCtx.Provider>
                          </WidgetTintCtx.Provider>
                        </WidgetTitleCtx.Provider>
                      </WidgetGrabCtx.Provider>
                    </WidgetCfgCtx.Provider>
                  </WidgetOptionsCtx.Provider>
                </div>
                {/* ── POIGNÉES DE REDIMENSIONNEMENT — toujours présentes, toujours
                    DISCRÈTES : leur trait est à `opacity: 0` et n'apparaît qu'au survol de
                    SON bord (règle HoverFX, §2-bis). La zone de saisie, elle, reste là en
                    permanence — révéler la zone ELLE-MÊME au survol créerait une cible qui
                    se dérobe ; c'est le `cursor` qui annonce le geste avant le trait.
                    ⚠️ `touchAction: "none"` est indispensable : sans lui, le navigateur
                    interprète le glissement vertical comme un défilement de page et la
                    poignée ne reçoit plus rien au doigt. */}
                {/* ⚠️ LES POIGNÉES VIVENT DANS LA GOUTTIÈRE, HORS DE LA CARTE, et ce n'est
                    pas cosmétique : le contenu est INTERACTIF, donc une bande de 14 px
                    posée sur le bord intérieur volerait les clics des lignes (qui ouvrent
                    la fiche) et recouvrirait la barre de défilement du corps, à droite.
                    `DASH_GAP` (18 px d'espace vide entre les cartes) leur laisse la place
                    de ne rien recouvrir du tout. Ne pas les ramener sur le bord. */}
                {([-1, 1] as const).map((side) => (
                  <span key={side} className="slb-rzh" aria-hidden
                    onPointerDown={onResizeDown(id, side)} onPointerMove={onResizeMove} onPointerUp={onResizeUp} onPointerCancel={onResizeUp}
                    title={wide ? "Réduire la largeur" : "Élargir sur toute la largeur"}
                    /* ⚠️ La bande est ENTIÈREMENT hors de la carte (−13 sur 13 px de large,
                       dans une gouttière de 18) : elle ne recouvre donc aucun pixel du
                       contenu. Un décalage plus faible la faisait mordre sur les derniers
                       pixels du corps — donc sur la BARRE DE DÉFILEMENT (6 px, à droite) et
                       sur le bord des lignes cliquables. */
                    style={{ position: "absolute", top: 46, bottom: 10 + DASH_GAP,
                      [side === 1 ? "right" : "left"]: -13, width: 13,
                      display: "grid", placeItems: "center", cursor: "ew-resize", touchAction: "none", zIndex: 5 }}>
                    <span style={{ width: 4, height: 34, borderRadius: 999, background: T.line2, opacity: 0 }} />
                  </span>
                ))}
                <span className="slb-rzv" aria-hidden
                  onPointerDown={onSizeDown(id)} onPointerMove={onSizeMove} onPointerUp={onSizeUp} onPointerCancel={onSizeUp}
                  title="Glisser pour régler la hauteur"
                  /* `bottom: 2` place la poignée ENTIÈREMENT sous la carte, dans la
                     gouttière : à `DASH_GAP - 3` elle empiétait de 11 px sur le bas du corps
                     et interceptait le « Voir plus » des listes. */
                  style={{ position: "absolute", left: 24, right: 24, bottom: 2, height: 14, display: "grid", placeItems: "center", cursor: "ns-resize", touchAction: "none", zIndex: 5 }}>
                  <span style={{ height: 4, width: 34, borderRadius: 999, background: T.line2, opacity: 0 }} />
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Le panneau « Widgets masqués » a été SUPPRIMÉ avec le masquage lui-même :
          la galerie ci-dessous est désormais le seul endroit d'où un widget revient
          sur la grille. */}

      {/* LA GALERIE — feuille modale, ouverte depuis le bouton « Ajouter un widget » de
          la barre, dans LES DEUX MODES. Les modèles y sont toujours GÉNÉRÉS (types
          sur-mesure + presets de chaque source du catalogue) : brancher une source la
          fait apparaître sans une ligne de code. */}
      {gallery && (
        <WidgetGallery posed={posed} onClose={() => setGallery(false)}
          onAdd={(p) => {
            onAdd(p);
            /* La feuille RESTE OUVERTE : on pose souvent deux ou trois widgets d'affilée,
               et la carte passe à « Ajouté » — le retour est immédiat sans fermer. */
          }} />
      )}

      {/* Toast discret : succès (disparition auto) / échec + Réessayer.
          En cas d'échec, le layout reste appliqué localement (spec §Persistance). */}
      {toast && (
        <div role="status" aria-live="polite"
          style={{ position: "fixed", left: "50%", bottom: 22, transform: "translateX(-50%)", zIndex: 60, display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px 10px 14px", borderRadius: T.rMd, boxShadow: T.shMd, backgroundColor: T.ink, color: "#fff", fontSize: "13px", fontWeight: 600, maxWidth: "calc(100% - 40px)" }}>
          {toast.ok
            ? <CheckCircle aria-hidden style={{ width: 16, height: 16, color: "#6EE7B7", flex: "none" }} />
            : <XCircle aria-hidden style={{ width: 16, height: 16, color: "#FCA5A5", flex: "none" }} />}
          <span style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
            {toast.ok ? "Disposition enregistrée" : "Échec de l'enregistrement"}
            {toast.error && (
              <span style={{ fontSize: "11.5px", fontWeight: 500, color: "rgba(255,255,255,.72)", wordBreak: "break-word", maxWidth: 360 }}>{toast.error}</span>
            )}
          </span>
          {!toast.ok && toast.layout && (
            <button onClick={() => { const l = toast.layout!; setToast(null); void runSave(l); }}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 10px", borderRadius: T.rSm, border: "1px solid rgba(255,255,255,.3)", background: "transparent", color: "#fff", fontFamily: "inherit", fontSize: "12.5px", fontWeight: 700, cursor: "pointer" }}>
              <RotateCcw aria-hidden style={{ width: 14, height: 14 }} />Réessayer
            </button>
          )}
          <button onClick={() => setToast(null)} aria-label="Fermer" title="Fermer"
            style={{ display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: T.rSm, border: "none", background: "transparent", color: "rgba(255,255,255,.75)", cursor: "pointer" }}>
            <X aria-hidden style={{ width: 14, height: 14 }} />
          </button>
        </div>
      )}
    </section>
  );
}

/* ============================================================================
   12. Bloc principal
   ============================================================================ */
export default function Block() {
  const user = useCurrentUser(); // iframe Softr — jamais window.logged_in_user
  const firstName = USE_MOCK ? MOCK_USER.firstName : firstNameOf(user);
  const [tab, setTab] = useState<string>("accueil");
  const active = NAV_TABS.find((t) => t.id === tab) ?? NAV_TABS[0];

  /* Survol et focus rendus EN JS sur ce conteneur (§2-bis). On passe par un ref et
     non par `#slb` : dans le bloc Softr, rien ne garantit que l'attribut id survive
     (c'est la même raison qui a fait sortir la mise en page de la feuille de style). */
  const rootRef = useRef<HTMLDivElement>(null);
  useHoverFX(rootRef);
  /* Animations d'attente (§2-ter) : même conteneur, même raison — la feuille peut manquer. */
  useMotionFX(rootRef);

  /* Purge au montage, UNE fois : entrées d'un autre utilisateur (poste partagé),
     d'une version périmée, ou vieilles de plus de sept jours. Ce cache contient des
     données CRM nominatives — le ménage n'est pas de l'hygiène de quota, c'est la
     contrepartie de les avoir écrites sur le disque du poste. */
  /* ⚠️ On ATTEND que l'e-mail soit connu : Softr le rend souvent au second render, et
     purger sans e-mail effacerait le cache de l'utilisateur courant à chaque
     chargement — le cache n'aurait alors jamais servi à rien. Pas d'e-mail (aperçu non
     connecté) = rien n'est écrit non plus, donc rien à purger. */
  const email = asText(user?.email).trim().toLowerCase();
  const purge = useRef("");
  useEffect(() => {
    if (!email || purge.current === email) return;
    purge.current = email;
    purgeSnapshots(email);
  }, [email]);

  return (
    <div id="slb" ref={rootRef} style={{ backgroundColor: T.canvas, minHeight: "100vh", fontFamily: T.font, color: T.ink }}>
      <StyleInjector />
      {/* Conteneur unique de la page : c'est LUI qui décide la largeur utile et donc
          les marges latérales. 1440 (au lieu de 1240) pour rendre de la place aux
          grilles de widgets sur écran large, en gardant une gouttière courte. */}
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 16px 56px", display: "flex", flexDirection: "column", gap: "30px" }}>

        <Hero firstName={firstName} />

        <PageNavBar tabs={NAV_TABS} activeId={active.id} onSelect={setTab} />

        {active.embed ? (
          // Onglet app externe promue en onglet de plein droit — iframe directe.
          <EmbedTab src={active.embed} title={active.label} />
        ) : active.id === "outils" ? (
          // Onglet Outils — la grille de boutons ; l'outil choisi s'ouvre in-page.
          <OutilsTab />
        ) : (
          // Onglet Accueil — outils + tableau de bord à widgets.
          <>
            <QuickLinks />
            {/* Tableau de bord : widgets indépendants (dont les 2 feeds LinkedIn),
                tous réglables en direct sur leur carte */}
            <Dashboard />
          </>
        )}

      </div>
    </div>
  );
}
