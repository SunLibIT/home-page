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
   LinkedIn) ; « Outils » = une grille de boutons qui ouvre chaque outil IN PAGE, sauf
   You Sign (nouvel onglet, cf. `OUTILS`).

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
  Inbox, CalendarClock, HardHat, Target, MoreVertical, Plus, Eye, Home,
  SlidersHorizontal, GripVertical, ChevronUp, ChevronDown, RotateCcw,
  Save, X, Newspaper, Megaphone, Sparkles, Trophy,
  // ⚠️ `Filter` est renommé : le fichier a déjà un TYPE `Filter` (§9-bis, les filtres
  //    d'une cfg). Importer l'icône sous son nom d'origine masquerait le type.
  Wrench, ExternalLink, Search, Filter as FilterIcon,
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

/** Outils externes (nouvel onglet). Même règle : "" = adresse inconnue → tuile inerte. */
const TOOLS = {
  /* You Sign — signature électronique.
     ⚠️ C'est la RACINE de l'app, et c'est délibéré. L'URL fournie le 2026-08-04 était
     une page de connexion Auth0 portant un JETON DE SESSION
     (`auth.yousign.app/u/login/identifier?state=…&tid=…&cid=…`) : ces paramètres
     expirent, donc figée dans un lien permanent elle aurait envoyé tout le monde sur
     une erreur d'authentification au bout de quelques minutes. La racine redirige
     d'elle-même vers ce même écran de connexion, puis vers le tableau de bord — et
     elle ne périme pas. Règle générale pour ce registre : ne jamais y coller une URL
     copiée depuis une barre d'adresse en cours de session. */
  youSign: "https://yousign.app/",
  /* Calculette d'abonnement (fournie le 2026-08-04). App Vercel PUBLIQUE, donc
     EMBARQUÉE depuis le 2026-08-05 : elle s'ouvre in-page dans l'onglet « Outils ». */
  calculette: "https://sunlib-simulation-economique.vercel.app/",
  /* Plus d'entrée « Sellsy » : la tuile « Services Sellsy » a été RETIRÉE des Outils le
     2026-08-04 (demande explicite). La remettre = une entrée ici + une dans
     QUICK_LINKS (§7) ; l'icône `Briefcase` est toujours importée, elle sert à la map
     ICONS. */
  /* Tik&Lib — le ticketing (fourni le 2026-08-04). App Vercel PUBLIQUE, EMBARQUÉE
     depuis le 2026-08-05 comme la calculette. */
  tikLib: "https://ticketing2-six.vercel.app/",
  /* Les autres apps Vercel PUBLIQUES embarquées en iframe (§7). Toutes les entrées de
     ce registre sauf `youSign` sont désormais des sources d'iframe et non des liens :
     c'est `OUTILS` (§7) qui tranche, via `embed` ou `url`.
     ⚠️ On ne navigue JAMAIS l'iframe DU BLOC lui-même, qui ferait disparaître le CRM
     autour : un outil s'affiche dans SA propre iframe, ou dans un nouvel onglet. */
  formulaireContact: "https://formulairedecontact.vercel.app/",
  simulateurGrille: "https://simulateur-grille-v2.vercel.app/",
  bibliotheque: "https://documentation-interne.vercel.app/",
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
      .slb-row:hover{ background:${T.surface2}; }
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
      @keyframes slb-skel{ 0%{opacity:.55} 50%{opacity:1} 100%{opacity:.55} }
      .slb-skel{ animation:slb-skel 1.3s ease-in-out infinite; }

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
  { sel: ".slb-row", trans: "background-color .15s ease", self: { "background-color": T.surface2 },
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
  abonnes: [
    { id: "n1", prenom: "Nicolas", nom: "Laborderie", partenaire: "Mandat Energie", statut: "Dossier incomplet pour instruction", offre: "PV + Batterie", creeLe: daysAgo(1),
      ref: "SL-002310", statutAbonne: "", capex: 21400, aboMoyen: 189, kwc: 9, etatFacture2: "A traiter",
      dateSignature: "", dateEdition: "", contratSigne: [], contratNonSigne: [] },
    { id: "n2", prenom: "", nom: "Commune de Payssous", partenaire: "FLG SOLAR", statut: "Dossier incomplet pour instruction", offre: "PV seul", creeLe: daysAgo(2),
      ref: "SL-002104", statutAbonne: "", capex: 0, aboMoyen: 0, kwc: 36, etatFacture2: "En attente de document",
      dateSignature: "", dateEdition: daysAgo(1), contratSigne: [], contratNonSigne: [{ url: "#", filename: "contrat-a-signer.pdf" }] },
    { id: "n3", prenom: "", nom: "Toulose Transit", partenaire: "Neosoleil", statut: "Dossier complet pour instruction", offre: "PV seul", creeLe: daysAgo(2),
      ref: "SL-002291", statutAbonne: "", capex: 118500, aboMoyen: 940, kwc: 62, etatFacture2: "Traitement IA en cours",
      dateSignature: "", dateEdition: daysAgo(1), contratSigne: [], contratNonSigne: [{ url: "#", filename: "contrat-a-signer.pdf" }] },
    { id: "n4", prenom: "Salvatore", nom: "Vizzini", partenaire: "MC ENERGY", statut: "Contrat envoyé et en attente signature", offre: "PV + Batterie Virtuelle", creeLe: daysAgo(15),
      ref: "SL-002188", statutAbonne: "", capex: 27300, aboMoyen: 232, kwc: 11.5, etatFacture2: "A traiter",
      dateSignature: "", dateEdition: daysAgo(9), contratSigne: [], contratNonSigne: [{ url: "#", filename: "contrat-a-signer.pdf" }] },
    { id: "n5", prenom: "Jocelyne", nom: "Guintrand", partenaire: "MC ENERGY", statut: "Contrat signé", offre: "Batterie seule (sur une installation SunLib)", creeLe: daysAgo(15),
      ref: "SL-002077", statutAbonne: "Repris", capex: 14900, aboMoyen: 128, kwc: 6, etatFacture2: "Validée",
      dateSignature: daysAgo(6), dateEdition: daysAgo(12), contratSigne: [{ url: "#", filename: "contrat-signe.pdf" }], contratNonSigne: [] },
    { id: "n6", prenom: "Julian", nom: "Maillo Moreno", partenaire: "MC ENERGY", statut: "Contrat signé", offre: "Extension PV", creeLe: daysAgo(15),
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

  /* ← SELECT_NOTIF_C. Depuis la refonte du 2026-08-06, ces lignes sont TOUT ce que lit
     le widget « Nouveaux dossiers abonnés » : plus de jointure avec `abonnes`, donc les
     `liens` ne renvoient plus aux lignes mock ci-dessus mais portent des record ids de
     la FORME réelle (`rec` + 14 caractères) — c'est cette forme que le bouton « Détail »
     exige avant de s'afficher.
     L'échantillon reproduit exprès les deux défauts de la table, pour que le filtre et
     le regroupement soient testés sur ce qu'ils rencontreront : une paire de JUMELLES
     (nc1 / nc1b) et une ligne SANS PROPRIÉTAIRE (nc5).
     ⚠️ RAPPEL : `aLire: true` = NON LUE. */
  notifC: [
    { id: "nc1", liens: [{ id: "recAAAAAAAAAAAAA1", name: "09185962330167" }], aLire: true, etat: "Non lue", creeLe: daysAgo(1),
      texte: "Nouveau contrat signé pour l'abonné : Mathéo et Lionel RAMBEAUX", nom: "RAMBEAUX",
      partenaire: "HDD ENERGIES", statut: "Contrat envoyé et en attente signature", proprio: "Ilan LEVY" },
    // ⚠️ La JUMELLE de nc1 (même dossier, même texte, état inverse) : elle doit être
    // regroupée avec elle, et c'est nc1 — encore « à lire » — qui doit rester.
    { id: "nc1b", liens: [{ id: "recAAAAAAAAAAAAA1", name: "09185962330167" }], aLire: false, etat: "Lue", creeLe: daysAgo(1),
      texte: "Nouveau contrat signé pour l'abonné : Mathéo et Lionel RAMBEAUX", nom: "RAMBEAUX",
      partenaire: "HDD ENERGIES", statut: "Contrat envoyé et en attente signature", proprio: "Ilan LEVY" },
    { id: "nc2", liens: [{ id: "recAAAAAAAAAAAAA2", name: "80000000572270" }], aLire: true, etat: "Non lue", creeLe: daysAgo(2),
      texte: "Nouveau abonné créé pour : Frederic Fouqueteau", nom: "Fouqueteau",
      partenaire: "HORIZON ENERGIE", statut: "En attente de validation technique", proprio: "Fabrice MORVAN" },
    { id: "nc3", liens: [{ id: "recAAAAAAAAAAAAA3", name: "80000000318842" }], aLire: false, etat: "Lue", creeLe: daysAgo(2),
      texte: "Nouveau abonné créé pour : Sandrine Delaunay", nom: "Delaunay",
      partenaire: "MC ENERGY", statut: "Contrat signé", proprio: "Philippe GERY" },
    { id: "nc4", liens: [{ id: "recAAAAAAAAAAAAA4", name: "09185962331004" }], aLire: true, etat: "Non lue", creeLe: daysAgo(15),
      texte: "Nouveau abonné créé pour : Julien Charrier", nom: "Charrier",
      partenaire: "Enertec", statut: "Demande d'infos : solvabilité", proprio: "Audrey QUINTANA" },
    /* ⚠️ AU NOM DE L'UTILISATEUR MOCK (« Frédéric Martin », cf. src/lib/user.tsx) : sans
       elle, le filtre « mes dossiers » écarterait TOUT en aperçu et on ne verrait jamais
       le cas qui fonctionne — seulement l'état vide. Le mock porte donc les deux.
       ⚠️ « Frédéric HUET » est volontairement ABSENT de cet échantillon : c'est le
       faux positif que `ownerIsUser` doit refuser (même prénom, autre personne). Le
       jour où on l'ajoute, il DOIT apparaître dans « à un autre propriétaire ». */
    { id: "nc6", liens: [{ id: "recAAAAAAAAAAAAA6", name: "09185962331188" }], aLire: true, etat: "Non lue", creeLe: daysAgo(4),
      texte: "Nouveau contrat signé pour l'abonné : Claire BONNET", nom: "BONNET",
      partenaire: "Neosoleil", statut: "Contrat signé", proprio: "Frédéric Martin" },
    // ⚠️ SANS PROPRIÉTAIRE : le widget doit l'ÉCARTER et la compter dans « lignes
    // écartées ». C'est le cas des ~380 lignes réelles sans lien vers un abonné.
    { id: "nc5", liens: [], aLire: true, etat: "Non lue", creeLe: daysAgo(15),
      texte: "Nouveau abonné créé pour :  ", nom: "", partenaire: "", statut: "", proprio: "" },
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
          dateEdition: "", contratNonSigne: [],   // signé : donc hors pipeline
        });
      }
    });
    // Les deux lignes qui doivent RESTER INVISIBLES au classement.
    rows.push({ id: "m_nocontrat", commercial: "Philippe GERY", capex: 880_000, contratSigne: [], statutAbonne: "Actif", moisSignature: monthAgo(0), aboMoyen: 200, etatFacture2: "", dateCreation: "", dateSignature: "", installateur: "", kwc: 0, dateEdition: "", contratNonSigne: [] });
    rows.push({ id: "m_nonassigne", commercial: "", capex: 2_400_000, contratSigne: [{ url: "#", filename: "c.pdf" }], statutAbonne: "Actif", moisSignature: monthAgo(0), aboMoyen: 300, etatFacture2: "Validée", dateCreation: "", dateSignature: "", installateur: "Installateur 1", kwc: 12, dateEdition: "", contratNonSigne: [] });
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
        kwc: 8.5, dateEdition: edite.toISOString(),
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
  | "excAbo" | "excPart" | "parcAbo" | "parcPart";

// Nature d'un champ → sert au rendu (badge, date relative…) et au tri typé.
type FieldKind = "text" | "longtext" | "date" | "badge" | "number" | "bool" | "url";
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
type PresetDesc = { label: string; icon?: string; h?: WidgetHeight; cfg: Record<string, unknown> };

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
  /* ALIAS proposé par défaut comme FILTRE À VALEURS (cases à cocher, multi-sélection)
     dans la barre d'outils d'un widget liste ou tableau. À choisir sur le champ par
     lequel on trie mentalement cette table : l'installateur pour des notes, le
     partenaire pour des dossiers. `undefined` = pas de filtre proposé d'office.
     Les VALEURS ne sont pas listées ici : elles sont déduites des lignes lues
     (`facetValues`), donc un nouvel installateur apparaît sans toucher au code. */
  defaultFacet?: string;
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
        // ⚠️ « En attente de solvabilité » existe EN DOUBLE dans le champ Airtable
        // (deux choix homonymes) : listé une fois ici, à nettoyer côté Airtable.
        options: [
          "Dossier annulé", "Dossier incomplet pour instruction", "Dossier complet pour instruction",
          "Dossier incomplet pour édition de contrat", "Contrat à éditer",
          "Contrat envoyé et en attente signature", "Assurance non ok", "Dossier refusé",
          "Contrat signé", "Dossier PRO en cours d'étude du service technique",
          "En attente de solvabilité", "En attente validation",
        ],
        variants: {
          "Dossier annulé": "neutral",
          "Dossier incomplet pour instruction": "danger",
          "Dossier complet pour instruction": "warn",
          "Dossier incomplet pour édition de contrat": "danger",
          "Contrat à éditer": "warn",
          "Contrat envoyé et en attente signature": "warn",
          "Assurance non ok": "danger",
          "Dossier refusé": "danger",
          "Contrat signé": "ok",
          "Dossier PRO en cours d'étude du service technique": "info",
          "En attente de solvabilité": "warn",
          "En attente validation": "warn",
        },
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
    defaultMap: { title: "nom", sub: "partenaire", date: "creeLe", badge: "statut" },
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
      { label: "Dossiers du mois (indicateur)", icon: "BarChart3", h: 168,
        cfg: { title: "Dossiers du mois",
               view: { kind: "kpi", agg: "count", dateField: "creeLe", compareDays: 30 } } },
      { label: "Tableau des dossiers", icon: "LayoutGrid",
        cfg: { view: { kind: "table", columns: ["nom", "partenaire", "statut", "creeLe"] } } },
    ],
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
  notifC: {
    key: "notifC",
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
      creeLe: { label: "Créée le", kind: "date" },
    },
    defaultSort: { by: "creeLe", dir: "desc" },
    defaultMap: { title: "nom", sub: "texte", date: "creeLe", badge: "statut" },
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
    },
    defaultSort: { by: "moisSignature", dir: "desc" },
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
};
const iconOf = (key: string): LucideIcon => ICONS[key] ?? LayoutGrid;

/** Couleur de badge d'une valeur métier : `variants` du descripteur d'abord,
 *  heuristique `statusVariant` (§3) en repli. PURE. */
const variantOf = (desc: SourceDesc, alias: string | undefined, value: string): BadgeVariant =>
  (alias ? desc.fields[alias]?.variants?.[value] : undefined) ?? statusVariant(value);

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
const liveState = (res: { data?: { pages?: { items: any[] }[] }; isLoading?: boolean; error?: unknown }): SourceState =>
  ({ rows: flattenRows(res), loading: !!res.isLoading, error: !!res.error });

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
  return <>{children({ ...liveState(res), partial, draining })}</>;
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

/* POUR CONNECTER une source (recette complète : ARCHITECTURE-V2.md §10) :
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
  useEffect(() => {
    if (!partial || dit.current) return;
    dit.current = true;
    const lignes = (res?.data?.pages ?? []).reduce((n: number, p: any) => n + (p?.items?.length ?? 0), 0);
    console.info(
      `[SunLib] lecture TRONQUÉE au plafond : ${nPages} pages, ${lignes} lignes` +
      ` (~${Math.round(lignes / Math.max(1, nPages))} par page). Relever COM_MAX_PAGES.`,
    );
  }, [partial, nPages]);

  return { partial, draining };
}

/* Performance commerciale : `DS.abonnes` relue en entier, 5 champs (cf. SELECT_COM).
   Lecture seule — l'accueil ne modifie pas un dossier abonné. */
function ComKpiSource({ children }: { children: SourceChildren }) {
  const res = useRecords({ from: DS.abonnes, select: SELECT_COM, orderBy: q.desc("moisSignature") });
  const { partial, draining } = useDrainPages(res, COM_MAX_PAGES);
  return <>{children({ ...liveState(res), partial, draining })}</>;
}

/* Parc DOSSIERS : même datasource qu'`abonnes`, UN champ, pagination complète. C'est un
   COMPTEUR, pas une liste — d'où le select minimal. */
function ParcAboSource({ children }: { children: SourceChildren }) {
  const res = useRecords({ from: DS.abonnes, select: SELECT_PARC_ABO });
  const { partial, draining } = useDrainPages(res, COM_MAX_PAGES);
  return <>{children({ ...liveState(res), partial, draining })}</>;
}

/* Les deux périmètres du registre des exceptions, connectés le 2026-08-05. Paginés comme
   ParcAbo, parce que les deux widgets AGRÈGENT (un registre tronqué mentirait sur ses
   totaux). Leur dénominateur `parcPart` est connecté juste en dessous, donc les « X % du
   parc » d'`excKpis` sont désormais chiffrés au lieu de rester muets. */
function ExcAboSource({ children }: { children: SourceChildren }) {
  const res = useRecords({ from: DS.excAbo, select: SELECT_EXC_ABO, orderBy: q.desc("creeLe") });
  const { partial, draining } = useDrainPages(res, COM_MAX_PAGES);
  return <>{children({ ...liveState(res), partial, draining })}</>;
}
function ExcPartSource({ children }: { children: SourceChildren }) {
  const res = useRecords({ from: DS.excPart, select: SELECT_EXC_PART, orderBy: q.desc("creeLe") });
  const { partial, draining } = useDrainPages(res, COM_MAX_PAGES);
  return <>{children({ ...liveState(res), partial, draining })}</>;
}

/* Parc partenaire ← « BDD Installateur », connectée le 2026-08-05. Paginée : c'est le
   dénominateur des « X % du parc », il doit être JUSTE (~510 lignes au 2026-08-04). */
function ParcPartSource({ children }: { children: SourceChildren }) {
  const res = useRecords({ from: DS.parcPart, select: SELECT_PARC_PART });
  const { partial, draining } = useDrainPages(res, COM_MAX_PAGES);
  return <>{children({ ...liveState(res), partial, draining })}</>;
}

function NotesInsSource({ children, drain }: { children: SourceChildren; drain?: boolean }) {
  const res  = useRecords({ from: DS.notesIns, select: SELECT_NOTE_INS, orderBy: q.desc("date") });
  const { partial, draining } = useDrainPages(res, COM_MAX_PAGES, !!drain);
  const updM = useRecordUpdate({ from: DS.notesIns, fields: SELECT_NOTE_INS_W });
  const email = asText(useCurrentUser()?.email).trim();
  const write = email
    ? { update: (recordId: string, fields: Record<string, unknown>) => updM.mutateAsync({ recordId, fields }) }
    : undefined;                        // pas de session → aucune tentative
  return <>{children({ ...liveState(res), partial, draining, write })}</>;
}

function NotesProSource({ children, drain }: { children: SourceChildren; drain?: boolean }) {
  const res  = useRecords({ from: DS.notesPro, select: SELECT_NOTE_PRO, orderBy: q.desc("date") });
  const { partial, draining } = useDrainPages(res, COM_MAX_PAGES, !!drain);
  const updM = useRecordUpdate({ from: DS.notesPro, fields: SELECT_NOTE_PRO_W });
  const email = asText(useCurrentUser()?.email).trim();
  const write = email
    ? { update: (recordId: string, fields: Record<string, unknown>) => updM.mutateAsync({ recordId, fields }) }
    : undefined;
  return <>{children({ ...liveState(res), partial, draining, write })}</>;
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
  return <>{children({ ...liveState(res), partial, draining, write })}</>;
}

function TachesPrSource({ children, drain }: { children: SourceChildren; drain?: boolean }) {
  const res  = useRecords({ from: DS.tachesPr, select: SELECT_TACHE_PR, orderBy: q.asc("fin") });
  const { partial, draining } = useDrainPages(res, COM_MAX_PAGES, !!drain);
  const updM = useRecordUpdate({ from: DS.tachesPr, fields: SELECT_TACHE_PR_W });
  const email = asText(useCurrentUser()?.email).trim();
  const write = email
    ? { update: (recordId: string, fields: Record<string, unknown>) => updM.mutateAsync({ recordId, fields }) }
    : undefined;
  return <>{children({ ...liveState(res), partial, draining, write })}</>;
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
  return <>{children({ ...liveState(res), partial, draining })}</>;
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
  return <>{children({ ...liveState(res), partial, draining, write })}</>;
}
/* `drain` : à passer par TOUT consommateur qui agrège (compte, somme, moyenne, ou un
   compteur d'onglet). Les six sources « liste » ne tirent qu'une page par défaut, ce qui
   suffit à afficher « les N plus récents » ; avec `drain`, le même adapter vide la
   pagination et remonte `partial`. Les cinq sources d'agrégat (Performance, Exceptions,
   parcs) et le SAV drainent TOUJOURS : elles n'existent que pour être agrégées.
   ⚠️ Oublier `drain` sur un widget qui compte ne provoque aucune erreur — juste un
   chiffre faux, crédible et silencieux. C'est le bug qu'a connu Pilotage SAV. */
function SourceFeed({ source, children, drain }: { source: SourceKey; children: SourceChildren; drain?: boolean }) {
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

   ⚠️ Pourquoi You Sign fait exception et n'est PAS embarqué : c'est une app à LOGIN,
   servie derrière Auth0, et elle refuse l'iframing (X-Frame-Options / CSP
   frame-ancestors). Embarquée, elle ne rendrait qu'un cadre blanc. Les cinq autres
   sont des apps Vercel PUBLIQUES, sans login, donc iframables — c'est la seule
   raison de la différence, pas une préférence d'ergonomie.

   Les adresses viennent de §0-bis : "" signifie « pas encore d'adresse » → le bouton
   reste visible mais inerte, comme les tuiles de `QUICK_LINKS`. */
type Outil = {
  id: string; label: string; icon: LucideIcon; desc: string;
  embed?: string; url?: string; solar?: boolean;
};
const OUTILS: Outil[] = [
  { id: "simulateur", label: "Simulateur Grille", icon: LayoutGrid,
    desc: "Grille tarifaire et scénarios d'abonnement.", embed: TOOLS.simulateurGrille },
  { id: "calculette", label: "Calculette d'abonnement", icon: Calculator,
    desc: "Simulation économique d'un projet.", embed: TOOLS.calculette, solar: true },
  { id: "tiklib", label: "Tik&Lib", icon: Ticket,
    desc: "Le ticketing interne.", embed: TOOLS.tikLib },
  { id: "yousign", label: "You Sign", icon: FileSignature,
    desc: "Signature électronique des contrats.", url: TOOLS.youSign },
  { id: "formulaire", label: "Formulaire de contact", icon: Mail,
    desc: "Déposer une demande de contact.", embed: TOOLS.formulaireContact },
  { id: "bibliotheque", label: "Bibliothèque", icon: Library,
    desc: "Documents et supports internes.", embed: TOOLS.bibliotheque },
];

/* Outils. UNE tuile = soit `page` (page de l'espace, ouverte en _top et résolue par
   `pageUrl`), soit `url` (outil externe, nouvel onglet). Les deux valeurs viennent de
   §0-bis, et une chaîne vide y signifie « pas encore d'adresse » → tuile désactivée.
   ⚠️ `page` et `url` sont exclusifs : c'est `page !== undefined` qui décide de la
   cible, donc une entrée qui porterait les deux ignorerait `url` en silence. */
const QUICK_LINKS: { label: string; icon: LucideIcon; page?: string; url?: string; solar?: boolean }[] = [
  // Pages de l'espace Softr (ex-onglets de nav) restaurées en raccourcis (target _top).
  { label: "Prospects", icon: UserPlus, page: PAGES.prospects },
  { label: "Partenaires", icon: Handshake, page: PAGES.partenaires },
  { label: "Contact Partenaire", icon: BookUser, page: PAGES.contactPartenaire },
  { label: "Abonnés", icon: Users, page: PAGES.abonnes },
  { label: "Pilotage SAV", icon: Ticket, page: PAGES.sav },
  { label: "KPI", icon: BarChart3, page: PAGES.kpi },
  /* ⚠️ PLUS AUCUN OUTIL ICI : You Sign, la Calculette, Tik&Lib, le Simulateur, le
     Formulaire de contact et la Bibliothèque sont regroupés dans l'onglet « Outils »
     (`OUTILS`). Cette section ne garde que les PAGES de l'espace Softr, d'où son
     titre « Raccourcis ». Ne pas redédoubler un outil ici : deux chemins vers la même
     app finissent toujours par divulguer deux adresses différentes. */
];

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

   La teinte habille l'EN-TÊTE et la pastille d'icône, pas le corps : sur un fond
   coloré, une liste de statuts et de badges deviendrait un patchwork, et les couleurs
   de sens (ambre « à compléter », rouge « panne ») perdraient leur force.

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
   navigateur ne montrerait que le bandeau de l'en-tête. --- */
type WidgetGrab = {
  onDragStart: (e: ReactDragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
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
        <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
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

            <div style={{ overflowY: "auto", padding: "16px 18px", scrollbarWidth: "thin" }}>
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
                sont les deux gestes qu'il ne faut pas confondre du bout de la souris. */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", padding: "12px 18px", borderTop: `1px solid ${T.line}`, flex: "none" }}>
              {opts.onRemove && (
                confirmRemove ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", flex: "1 1 auto", minWidth: 0 }}>
                    {/* Le libellé de confirmation dit ce qui est PERDU. « Êtes-vous sûr ? »
                        n'aide personne à décider ; « les réglages sont perdus » si. */}
                    <span style={{ fontSize: "11.5px", fontWeight: 600, color: T.dangerInk }}>Retirer ce widget ? Ses réglages seront perdus.</span>
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
                  se tasse à gauche et « Retirer » touche « Enregistrer ». */}
              {!confirmRemove && <span style={{ flex: 1, minWidth: 0 }} />}
              <button className="slb-btng" style={btn} onClick={() => setOpen(false)}>Annuler</button>
              <button className="slb-btnp" style={{ ...btn, border: "none", background: T.brand, color: "#fff" }} onClick={save}>
                <Save aria-hidden style={{ width: 14, height: 14 }} />Enregistrer
              </button>
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
  const cardStyle: CSSProperties = tint.head
    ? { ...CARD, backgroundColor: tint.head, border: `1px solid ${tint.pill || T.line}` }
    : CARD;
  const headStyle: CSSProperties = tint.head
    ? { ...WHEAD, borderBottom: `1px solid ${tint.pill || T.line}` }
    : WHEAD;
  return (
    <Card style={cardStyle}>
      {/* L'EN-TÊTE est la zone de préhension (cf. WidgetGrabCtx). `cursor: grab` suffit
          comme affordance : pas de `title` ici, il se déclencherait au survol du titre du
          widget. Pas de poignée « mors de déménageur » non plus — elle n'existait qu'en
          mode Personnaliser, et sur chaque carte en usage courant elle serait du bruit. */}
      <div style={grab ? { ...headStyle, cursor: "grab" } : headStyle}
        draggable={!!grab} onDragStart={grab?.onDragStart} onDragEnd={grab?.onDragEnd}>
        <span style={!solar && tint.pill ? { ...icoPillSm(false), background: tint.pill, color: tint.ink } : icoPillSm(solar)}>
          <Icon aria-hidden style={{ width: 15, height: 15 }} strokeWidth={1.7} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={tint.head ? { ...WTITLE, color: tint.ink } : WTITLE}>{shown}</div>
          {sub && <div style={WSUB}>{sub}</div>}
        </div>
        {headActions}
        {/* ⋮ affiché pour TOUS les widgets depuis le 2026-08-04 : même un type sans
            réglages propres est RENOMMABLE, donc le bouton a toujours quelque chose
            à offrir — il n'est plus décoratif pour autant. */}
        {opts && <WidgetOptionsMenu opts={opts} title={shown} defaultTitle={title} />}
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
        {QUICK_LINKS.map(({ label, icon: Icon, page, url, solar }) => {
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
function EmbedTab({ src, title }: { src: string; title: string }) {
  return (
    <section aria-label={title} style={{ borderRadius: T.rXl, overflow: "hidden", border: `1px solid ${T.line}`, boxShadow: T.shSm, backgroundColor: T.surface }}>
      <iframe src={src} title={title} loading="lazy"
        style={{ display: "block", width: "100%", height: "min(1200px, 82vh)", minHeight: 560, border: "none" }} />
    </section>
  );
}

/* --- ONGLET « OUTILS ». Une grille de boutons ; un clic ouvre l'outil IN PAGE, juste
      en dessous, sans quitter le CRM. La grille reste visible : on passe d'un outil à
      l'autre en un clic, et l'outil ouvert est marqué (bordure + fond teintés, plus
      `aria-pressed`) — la couleur ne porte donc jamais l'information seule.

      You Sign est le seul à partir dans un NOUVEL ONGLET : app à login qui refuse
      l'iframing (cf. `OUTILS`). Son bouton l'annonce par une icône différente et un
      `title`, pour que le départ hors du CRM ne surprenne pas.

      ⚠️ Un refus d'iframe est INDÉTECTABLE depuis ici (l'iframe est cross-origin, son
      contenu est illisible) : si une app se met à refuser l'iframing, son cadre
      restera blanc sans erreur. D'où le lien « Nouvel onglet » présent dans l'en-tête
      de CHAQUE outil ouvert — c'est la porte de sortie, pas un ornement. --- */
function OutilsTab() {
  const [openId, setOpenId] = useState<string | null>(null);
  // L'outil ouvert doit être embarquable ET avoir une adresse : un `openId` devenu
  // invalide (registre modifié) retombe donc proprement sur « rien d'ouvert ».
  const open = OUTILS.find((o) => o.id === openId && o.embed) ?? null;

  return (
    <section aria-label="Outils" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div>
        <h2 style={{ ...H2, marginBottom: "14px" }}>Outils</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "13px" }}>
          {OUTILS.map((o) => {
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

            // Outil externe (You Sign) : nouvel onglet, jamais dans l'iframe du bloc.
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

type NotifsCfg = { champs: string[]; limite: number; detail: boolean; marquage: boolean; mesDossiers: boolean };

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
  /** Écartées parce que DÉJÀ TRAITÉES (marquées « Vu »). Sert l'état vide : « tout est
   *  traité » et « aucune notification » demandent deux messages différents. */
  lues: number;
};

/** Sélection des lignes affichables, en trois passes dans cet ordre :
 *    1. propriétaire RENSEIGNÉ (écarte les ~380 lignes orphelines) ;
 *    2. propriétaire = UTILISATEUR CONNECTÉ, si `mesDossiers` (cf. `ownerIsUser`) ;
 *    3. une seule ligne par événement, la jumelle « à lire » d'abord.
 *  PURE — l'ordre d'entrée (le plus récent d'abord, tri serveur) est conservé.
 *  ⚠️ La passe 2 est SAUTÉE quand la session n'est pas identifiable (`ident.known`
 *  faux) : sans nom ni e-mail, elle écarterait TOUT et le widget serait vide sans que
 *  personne puisse comprendre pourquoi. Le widget annonce alors que le filtre est
 *  inactif — un filtre silencieusement désactivé serait pire que pas de filtre. */
function selectNotifs(rows: Notif[], ident: UserIdent, mesDossiers: boolean, nonLuesSeulement: boolean): NotifTri {
  const parEvenement = new Map<string, Notif>();
  let sansProprio = 0, autres = 0;
  const filtreActif = mesDossiers && ident.known;
  for (const n of rows) {
    if (!n.proprio.trim()) { sansProprio++; continue; }
    if (filtreActif && !ownerIsUser(n.proprio, ident)) { autres++; continue; }
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
  return { items, sansProprio, autres, lues: groupees.length - items.length };
}

const NOTIF_FIELDS: { key: string; label: string }[] = [
  { key: "texte", label: "Texte de la notification" },
  { key: "statut", label: "Statut du dossier" },
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
      // Fond très légèrement teinté pour un dossier non vu — la pastille porte le sens,
      // ceci n'est qu'un repère de balayage (la couleur ne dit jamais seule, charte).
      background: cfg.marquage && nonLu ? T.brand050 : undefined }}>
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
        {on("statut") && (
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px", marginTop: "5px" }}>
            <StatusBadge value={n.statut} />
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

function NotifWidget({ tri, cfg, notifs, ident, onVoirTout }: {
  tri: NotifTri; cfg: NotifsCfg; notifs: SourceApi; ident: UserIdent;
  /** Bascule « voir toutes les notifications » proposée dans l'état vide. Absente si
   *  le widget ne peut pas écrire sa propre cfg. */
  onVoirTout?: () => void;
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
  const nom = ident.name.length ? asText(ident.name.join(" ")) : ident.mail.join(" ");
  /* Fiche détaillée de la notification cliquée. Le descripteur `notifC` porte les 9
     alias lus, donc la fiche se construit toute seule (`RecordDialog`) — pas de fiche
     sur-mesure à maintenir ici. */
  const [fiche, setFiche] = useState<Notif | null>(null);
  return (
    <>
    {/* Sous-titre : la liste ne contient QUE des notifications à traiter (cf. `cfg.marquage`
        et `selectNotifs`), donc « N non lus sur M » n'aurait plus de sens — tout est non lu.
        On annonce ce qui reste à faire, et sur quel périmètre. */}
    <Widget icon={Bell} title="Nouveaux dossiers abonnés"
      sub={!restantes.length ? (filtreActif ? "Rien à votre nom" : "Rien à traiter")
        : `${restantes.length} à traiter${filtreActif ? " · mes dossiers" : ""}`}>
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
      {/* Un échec d'écriture se DIT. La ligne est déjà revenue dans la liste (rollback de
          `marquerVu`) : sans ce message, elle réapparaîtrait sans explication et on
          croirait à un bug d'affichage. */}
      {echec && (
        <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "10px 16px", borderBottom: `1px solid ${T.line}` }}>
          <Badge variant="danger" dot>Échec</Badge>
          <span style={{ fontSize: "11.5px", fontWeight: 500, color: T.ink3 }}>{echec}</span>
        </div>
      )}
      {items.length === 0 ? (
        /* TROIS états vides distincts, parce qu'ils demandent trois gestes différents :
           « tout est traité » (bonne nouvelle — la file est vide, rien à faire),
           « rien à mon nom » (le filtre propriétaire a tout écarté → proposer de
           l'ouvrir), « rien du tout » (la table n'a rien à montrer). Le deuxième NOMME
           l'identité cherchée : c'est la seule façon de comprendre un rapprochement qui a
           échoué parce que la base écrit le propriétaire autrement. */
        tri.lues > 0 ? (
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
  onFait, faisable, mineAsked, identifiee }: {
  prospects: Task[]; partenaires: Task[];
  totalProspects: number; totalPartenaires: number; partial?: boolean;
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
    <Widget icon={CalendarClock} title="Journal des tâches"
      sub={mineAsked && identifiee ? "Mes tâches · prospects & partenaires" : "Prospects & partenaires"}
      headActions={
        // TODO : brancher la création de tâche
        <button className="slb-nbtn" style={NBTN_SM} aria-label="Nouvelle tâche" title="Nouvelle tâche">
          <Plus aria-hidden style={{ width: 15, height: 15 }} />
        </button>
      }>
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
        {rows.length === 0 ? (
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
     `facet`  : ALIAS d'un champ dont les valeurs deviennent un filtre à cases, en
                multi-sélection (les installateurs, par exemple). "" = pas de filtre.
     ⚠️ Ce que l'utilisateur TAPE ou COCHE n'est PAS stocké ici : ces deux clés disent
     seulement si l'outil est OFFERT. Le terme et les cases vivent en état local
     (`LocalRefine`) — une recherche enregistrée se rappellerait au chargement suivant
     et donnerait un widget qui paraît vide sans raison visible. */
  search?: boolean;
  facet?: string;
  /* « Seulement les fiches dont je suis propriétaire » (2026-08-07). N'a de sens que si
     le descripteur de la source déclare un `ownerField` ; ailleurs la clé est absente.
     ACTIF par défaut là où il existe : une liste de suivi client sert d'abord à voir SON
     portefeuille, et un filtre qu'il faut penser à activer ne l'est jamais.
     ⚠️ Réglable, et il doit l'être : le rapprochement nom ↔ session est approximatif par
     nature (cf. `ownerIsUser`) — un manager qui suit plusieurs portefeuilles, ou un nom
     écrit autrement en base, doit pouvoir ouvrir la liste. */
  mine?: boolean;
};

const LIST_LIMIT_MAX = 50;
const KPI_DAYS_MAX = 365;
const TABLE_COLS_MAX = 6;

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
     La facette retombe sur `defaultFacet` du descripteur ; un alias inconnu (source
     changée, champ retiré) est écarté plutôt que gardé — un filtre sur un champ absent
     ne renverrait jamais rien, sans rien dire. */
  const facet = kind === "kpi" ? "" : (known("facet" in o ? o.facet : desc.defaultFacet) ?? "");

  /* --- « mes fiches » : offert seulement si la source a un propriétaire déclaré, ACTIF
     par défaut (`!== false`, comme `search` : une cfg enregistrée avant ce réglage n'a
     pas la clé et doit hériter du nouveau défaut). La clé est ÉCRITE même à `false`,
     sinon un utilisateur qui ouvre volontairement la liste retrouverait le filtre au
     rechargement suivant. Une source sans propriétaire n'a pas la clé du tout. --- */
  const mine = desc.ownerField ? o.mine !== false : false;

  return {
    title: asText(o.title ?? base.title),
    unit: asText(o.unit || base.unit) || "élément",
    source,
    query: { filter, sort: { by: sortBy, dir: sortDir }, limit },
    view,
    search: kind === "kpi" ? false : o.search !== false,
    ...(desc.ownerField ? { mine } : {}),
    ...(facet ? { facet } : {}),
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

/** Lignes retenues par les filtres (ET), sans tri ni limite — base des agrégats.
 *  ⚠️ Le filtre PROPRIÉTAIRE passe en premier et hors de la grammaire des `Filter` : ce
 *  n'est pas un critère de consultation mais un PÉRIMÈTRE. Il s'applique donc aussi aux
 *  agrégats (`kpiCompute`), sinon un KPI compterait le portefeuille de tout le monde
 *  au-dessus d'une liste qui n'en montre qu'une part. */
function selectRows(rows: Row[], cfg: InstanceCfg, ident?: UserIdent): Row[] {
  const out = ownerScope(rows, cfg, ident);
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
  facetField?: string;                         // alias du filtre à valeurs
  facetValues?: string[];                      // valeurs cochées ([] = aucune restriction)
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

  // Facette : OU entre les valeurs cochées. Aucune coche = aucune restriction (et non
  // « rien » : un filtre vide qui viderait la liste serait un piège à clics).
  const vals = local?.facetValues ?? [];
  if (local?.facetField && vals.length) {
    const set = new Set(vals.map(foldText));
    out = out.filter((r) => set.has(foldText(r[local.facetField!])));
  }

  const tri = local?.sort ?? cfg.query.sort;
  if (tri.by) {
    const kind = desc.fields[tri.by]?.kind;
    out = [...out].sort((a, b) => compareRows(a, b, tri.by, kind, tri.dir));
  }
  return out.slice(0, Math.max(1, Math.min(LIST_LIMIT_MAX, cfg.query.limit)));
}

/** Valeurs distinctes d'un champ dans les lignes lues, les plus fréquentes d'abord.
 *  PURE. Alimente le filtre à cases : les valeurs viennent des DONNÉES et non d'une
 *  liste écrite à la main, donc un nouvel installateur apparaît tout seul. */
function facetValues(rows: Row[], alias: string, max = 60): { value: string; count: number }[] {
  const compte = new Map<string, { value: string; count: number }>();
  for (const r of rows) {
    const v = asText(r[alias]).trim();
    if (!v) continue;
    const k = foldText(v);
    const e = compte.get(k);
    if (e) e.count++; else compte.set(k, { value: v, count: 1 });
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
  if (!api.draining && !api.partial) return null;
  const enCours = !!api.draining;
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
  if (f.kind === "badge") return <Badge variant={variantOf(desc, alias, text)}>{text}</Badge>;
  if (f.kind === "date") return <span title={fmtDate(text)}>{fmtSmart(text)}</span>;
  if (f.kind === "url") return <a href={text} target="_blank" rel="noopener noreferrer" style={{ color: T.brand700, fontWeight: 600 }}>Ouvrir</a>;
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
  useEffect(() => {
    closeRef.current?.focus();                      // le clavier entre DANS la modale
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const aliases = Object.keys(desc.fields);
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
        <div style={{ overflowY: "auto", padding: "6px 18px 16px", scrollbarWidth: "thin" }}>
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

        {fiche && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 18px", borderTop: `1px solid ${T.line}`, flex: "none" }}>
            <a href={fiche} target="_top" className="slb-btng"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 13px", borderRadius: T.rSm, border: `1px solid ${T.line}`, background: T.surface, color: T.ink2, fontSize: "12.5px", fontWeight: 600, textDecoration: "none" }}>
              Ouvrir la fiche complète<ChevronRight aria-hidden style={{ width: 14, height: 14 }} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   BARRE D'OUTILS DE CONSULTATION — recherche, filtre à cases, tri
   ---------------------------------------------------------------------------
   Trois outils au-dessus de la liste, tous LOCAUX (rien n'est enregistré, cf.
   `LocalRefine`) et tous génériques : ils ne connaissent que le descripteur de
   la source, donc ils marchent pour les notes comme pour les dossiers SAV.

   · RECHERCHE — plein-texte sur les champs déclarés, mot par mot (ET).
   · FILTRE À CASES — les valeurs DISTINCTES d'un champ (`cfg.facet`), listées
     par fréquence décroissante, en multi-sélection. Les valeurs viennent des
     données : un nouvel installateur apparaît sans toucher au code.
   · TRI — proposé ici pour la vue LISTE, qui n'a pas d'en-têtes de colonnes où
     cliquer. En vue tableau, c'est l'en-tête qui trie (cf. `GenericTable`), et
     ce bouton n'est donc pas rendu.

   ⚠️ La barre est HORS du corps scrollable : elle doit rester visible pendant
   qu'on défile la liste, sinon on perd le champ de recherche dès la 5e ligne.
   Elle rend le widget un peu plus haut que sa taille nominale — le tassement de
   la grille mesure la hauteur réelle (§11), donc rien à corriger.
   --------------------------------------------------------------------------- */
function ListToolbar({ rows, cfg, desc, local, setLocal, triable, ident }: {
  rows: Row[]; cfg: InstanceCfg; desc: SourceDesc;
  local: LocalRefine; setLocal: (next: LocalRefine) => void;
  /** Identité de la session — seulement pour borner les valeurs proposées par le filtre
   *  à cases au périmètre du filtre « mes fiches » (cf. ownerScope). */
  ident?: UserIdent;
  /** Vue LISTE : le bouton de tri est offert. Vue tableau : il ne l'est pas (les
   *  en-têtes de colonnes s'en chargent, et deux commandes de tri concurrentes
   *  finiraient par se contredire à l'écran). */
  triable: boolean;
}) {
  const [openFacet, setOpenFacet] = useState(false);
  const [openSort, setOpenSort] = useState(false);
  const refFacet = useDismissOnOutside(openFacet, setOpenFacet);
  const refSort = useDismissOnOutside(openSort, setOpenSort);

  const cochees = local.facetValues ?? [];
  // Les valeurs proposées suivent le PÉRIMÈTRE : cocher un nom qui n'est pas dans son
  // portefeuille ne ramènerait jamais rien (cf. ownerScope).
  const valeurs = cfg.facet ? facetValues(ownerScope(rows, cfg, ident), cfg.facet) : [];
  const toggle = (v: string) => {
    const set = new Set(cochees);
    if (set.has(v)) set.delete(v); else set.add(v);
    setLocal({ ...local, facetField: cfg.facet, facetValues: [...set] });
  };

  /* Champs TRIABLES : tout sauf les textes longs (trier des notes de trois lignes par
     ordre alphabétique n'a aucun sens) et les booléens seuls. */
  const triables = Object.keys(desc.fields).filter((a) => desc.fields[a].kind !== "longtext");
  const triCourant = local.sort ?? cfg.query.sort;
  const nomTri = triCourant.by ? desc.fields[triCourant.by]?.label ?? triCourant.by : "";

  const btn: CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: "5px", flex: "none",
    padding: "6px 10px", borderRadius: T.rSm, border: `1px solid ${T.line}`,
    background: T.surface, color: T.ink2, fontFamily: "inherit", fontSize: "12px",
    fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
  };
  const btnActif: CSSProperties = { ...btn, border: `1px solid ${T.brand100}`, background: T.brand050, color: T.brand700 };
  const item: CSSProperties = { display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "6px 8px", borderRadius: T.rSm, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "12.5px", fontWeight: 500, color: T.ink2, textAlign: "left" };
  const panneau: CSSProperties = { position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 30, width: 252, maxHeight: 300, overflowY: "auto", padding: "6px", background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rMd, boxShadow: T.shMd, animation: "slb-fade .12s ease both" };

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

      {cfg.facet && valeurs.length > 1 && (
        <div ref={refFacet} style={{ position: "relative", flex: "none" }}>
          <button style={cochees.length ? btnActif : btn} onClick={() => setOpenFacet((o) => !o)}
            aria-haspopup="dialog" aria-expanded={openFacet}>
            <FilterIcon aria-hidden style={{ width: 13, height: 13 }} />
            {desc.fields[cfg.facet]?.label ?? cfg.facet}
            {cochees.length > 0 && ` · ${cochees.length}`}
            <ChevronDown aria-hidden style={{ width: 13, height: 13 }} />
          </button>
          {openFacet && (
            <div role="dialog" aria-label={`Filtrer par ${desc.fields[cfg.facet]?.label ?? cfg.facet}`} style={panneau}>
              {/* « Tout effacer » plutôt qu'un « Tout cocher » : aucune coche signifie déjà
                  « toutes les valeurs » (cf. `applyQuery`), donc cocher tout serait un
                  synonyme inutile — et laisserait croire à un filtre là où il n'y en a pas. */}
              <button onClick={() => setLocal({ ...local, facetField: cfg.facet, facetValues: [] })}
                style={{ ...item, fontWeight: 700, color: cochees.length ? T.brand700 : T.ink4, cursor: cochees.length ? "pointer" : "default" }}
                disabled={!cochees.length}>
                <RotateCcw aria-hidden style={{ width: 13, height: 13 }} />Tout effacer
              </button>
              <div style={{ height: 1, background: T.line, margin: "4px 6px" }} />
              {valeurs.map(({ value, count }) => {
                const on = cochees.includes(value);
                return (
                  <label key={value} style={{ ...item, cursor: "pointer" }}>
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
      )}

      {triable && triables.length > 0 && (
        <div ref={refSort} style={{ position: "relative", flex: "none" }}>
          <button style={local.sort ? btnActif : btn} onClick={() => setOpenSort((o) => !o)}
            aria-haspopup="menu" aria-expanded={openSort} title={nomTri ? `Trié par ${nomTri}` : "Trier"}>
            {triCourant.dir === "asc"
              ? <ChevronUp aria-hidden style={{ width: 13, height: 13 }} />
              : <ChevronDown aria-hidden style={{ width: 13, height: 13 }} />}
            Trier
          </button>
          {openSort && (
            <div role="menu" style={panneau}>
              {triables.map((a) => {
                const actif = triCourant.by === a;
                return (
                  <button key={a} role="menuitem" className="slb-menu-item" style={{ ...item, color: actif ? T.brand700 : T.ink2, fontWeight: actif ? 700 : 500 }}
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

// Squelette de lignes (mêmes métriques que le gabarit) — pas de saut visuel.
function ListSkeleton() {
  return (
    <div aria-busy="true" style={{ padding: "4px 0" }}>
      {[0, 1, 2].map((k) => (
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
  return (
    <SourceFeed source={cfg.source} key={cfg.source} drain={isKpiView}>
      {(api) => {
        const isKpi = cfg.view.kind === "kpi";
        /* Les réglages locaux (recherche, cases, tri) passent DANS `applyQuery`, donc
           avant la limite : on cherche et on trie sur toute la table lue. */
        const rows = isKpi ? api.rows : applyQuery(api.rows, cfg, local, ident);
        /* Sous-titre : quand un outil restreint la liste, on annonce « N sur M ». Sans
           ce « sur M », une recherche qui ne rend rien ressemble à une source vide.
           ⚠️ `total` porte le MÊME périmètre propriétaire que `rows` : « 3 sur 12 » doit
           comparer ce qui est cherché à ce qui est visible, pas au fichier entier. */
        const total = isKpi ? 0 : applyQuery(api.rows, cfg, undefined, ident).length;
        const restreint = !isKpi && ((local.q ?? "") !== "" || (local.facetValues ?? []).length > 0);
        /* Le sous-titre DIT que la liste est réduite à son portefeuille : sans ça, un
           widget qui montre 4 notes sur 300 se lit comme une source presque vide. */
        const perimetre = mineOn ? " · mes fiches" : "";
        const sub = api.loading ? "Chargement…"
          : isKpi ? (cfg.view.kind === "kpi" && cfg.view.compareDays ? `sur ${cfg.view.compareDays} j` : desc.label)
          : restreint ? `${rows.length} sur ${total} ${cfg.unit}${total > 1 ? "s" : ""}${perimetre}`
          : plural(rows.length, cfg.unit) + perimetre;
        const V = cfg.view.kind === "table" ? GenericTable : isKpi ? GenericKpi : GenericList;
        /* Le mappage des rôles sert le TITRE et le badge de la fiche. En vue tableau il
           n'y en a pas (les colonnes sont libres) : on prend celui du descripteur. */
        const map: FieldRoleMap = cfg.view.kind === "list" ? cfg.view.map : desc.defaultMap ?? {};
        // La barre n'a de sens que sur une liste de lignes, et seulement si un outil est
        // offert. En KPI (aucune ligne affichée), jamais.
        const outils = !isKpi && (cfg.search !== false || !!cfg.facet);
        return (
          <>
            <Widget icon={iconOf(desc.icon)} title={cfg.title || desc.label} sub={sub}
              headActions={cfg.create && desc.create ? <QuickCreate desc={desc} api={api} /> : undefined}>
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
          (« Tableau des dossiers », « Dossiers du mois (indicateur) »…), et elle ne bouge
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
          <span style={lbl}>Filtre rapide (cases à cocher)</span>
          {/* Les valeurs du filtre viennent des DONNÉES, pas d'ici : on ne choisit que le
              CHAMP. Les longs textes sont exclus — filtrer par note entière n'a aucun sens. */}
          <select style={field} value={cfg.facet ?? ""} onChange={(e) => set({ facet: e.target.value })}>
            <option value="">— aucun —</option>
            {Object.keys(desc.fields)
              .filter((a) => desc.fields[a].kind !== "longtext")
              .map((a) => <option key={a} value={a}>{desc.fields[a].label}</option>)}
          </select>
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
        const tri = selectNotifs(nc.rows.map(mapNotifC), ident, cfg.mesDossiers, cfg.marquage);
        return (
          <NotifWidget cfg={cfg} notifs={nc} tri={tri} ident={ident}
            onVoirTout={writer ? () => writer.save({ ...cfg, mesDossiers: false }) : undefined} />
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
    <Widget icon={Ticket} title="Pilotage SAV" sub="Synthèse des dossiers" footer={footer}>
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
type PodiumCfg = { periode: PodiumPeriode };

const coercePodiumCfg = (raw: unknown): PodiumCfg => {
  const p = asText(asObj(raw).periode);
  return { periode: PODIUM_PERIODES.some((x) => x.key === p) ? (p as PodiumPeriode) : "annee" };
};

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

type ComIndicsCfg = { periode: PodiumPeriode; show: string[] };
const coerceComIndicsCfg = (raw: unknown): ComIndicsCfg => {
  const o = asObj(raw);
  const p = asText(o.periode);
  const known = new Set(COM_METRICS.map((m) => m.key));
  const periode: PodiumPeriode = PODIUM_PERIODES.some((x) => x.key === p) ? (p as PodiumPeriode) : "tout";
  /* `show` ABSENT → tout ; PRÉSENT même vide → choix explicite respecté. Même règle que
     `coerceSavCfg`, pour que les deux panneaux se comportent pareil. */
  if (!Array.isArray(o.show)) return { periode, show: [...COM_SHOW_DEFAULT] };
  return { periode, show: Array.from(new Set(o.show.filter((x: unknown): x is string => typeof x === "string" && known.has(x)))) };
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
  const g = comGlobal(api.rows, cfg.periode, new Date());
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
    <Widget icon={BarChart3} title="Indicateurs commerciaux" sub={`Contrats et pipeline — ${periodeLabel}`}>
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
          <button key={p.key} style={seg(cfg.periode === p.key)} onClick={() => onChange({ periode: p.key })}
            aria-pressed={cfg.periode === p.key}>{p.label}</button>
        ))}
      </div>
      <p style={{ margin: "8px 0 0", fontSize: "11.5px", fontWeight: 500, color: T.ink4 }}>
        Contrats signés (PDF joint), hors dossiers annulés et hors « Non assigné ».
      </p>
    </div>
  );
}

function PodiumWidget({ api, cfg }: { api: SourceApi; cfg: PodiumCfg }) {
  const top3 = comStats(api.rows, cfg.periode, new Date()).stats
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
    <Widget icon={Trophy} title="Podium CAPEX HT" sub={`Les trois premiers ${periodeLabel}`}>
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
type ClassementCfg = { periode: PodiumPeriode; tri: ComCol; dir: "asc" | "desc" };

const coerceClassementCfg = (raw: unknown): ClassementCfg => {
  const o = asObj(raw);
  const p = asText(o.periode);
  const t = asText(o.tri);
  return {
    periode: PODIUM_PERIODES.some((x) => x.key === p) ? (p as PodiumPeriode) : "annee",
    tri: COM_COLS.some((c) => c.key === t) ? (t as ComCol) : "capex",
    dir: o.dir === "asc" ? "asc" : "desc",
  };
};

/* Panneau d'options PARTAGÉ par les deux classements (commerciaux, installateurs) : même
   période, même tri, même sens — seule la liste des colonnes triables change. Les deux
   `Options` du registre en sont des habillages d'une ligne. */
function RankOptions<C extends string>({ cfg, onChange, cols }: {
  cfg: { periode: PodiumPeriode; tri: C; dir: "asc" | "desc" };
  onChange: (next: { periode: PodiumPeriode; tri: C; dir: "asc" | "desc" }) => void;
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
  const { stats } = comStats(api.rows, cfg.periode, new Date());
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
      sub={`${stats.length} commercial${stats.length > 1 ? "aux" : ""} — trié par ${COM_COLS.find((c) => c.key === cfg.tri)?.label}`}>
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
type InstCfg = { periode: PodiumPeriode; tri: InstCol; dir: "asc" | "desc" };

const coerceInstCfg = (raw: unknown): InstCfg => {
  const o = asObj(raw);
  const p = asText(o.periode);
  const t = asText(o.tri);
  return {
    periode: PODIUM_PERIODES.some((x) => x.key === p) ? (p as PodiumPeriode) : "annee",
    tri: INST_COLS.some((c) => c.key === t) ? (t as InstCol) : "contrats",
    dir: o.dir === "asc" ? "asc" : "desc",
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
  const { stats } = comStats(api.rows, cfg.periode, new Date(), "installateur");
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
      sub={api.loading ? "Chargement…" : `${stats.length} installateur${stats.length > 1 ? "s" : ""} · ${PODIUM_PERIODES.find((p) => p.key === cfg.periode)?.label ?? ""}`}>
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
    <Widget icon={ClipboardList} title="Exceptions" sub="Volume, couverture du parc et intensité">
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
              partial: !!abo.partial || !!part.partial }} />
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
      sub={`${filtrees.length} exception${filtrees.length > 1 ? "s" : ""}${cfg.perimetre === "tous" ? "" : ` — périmètre ${cfg.perimetre === "abonne" ? "abonné" : "partenaire"}`}`}>
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
const CHECK_TEXT_MAX = 160;   // caractères par ligne

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

/* --- PENSE-BÊTE, avec mise en forme ------------------------------------------
   Deux modes : LECTURE (le texte mis en forme) et ÉDITION (une zone de saisie + une
   barre d'outils). Le contenu reste `cfg.text`, une simple CHAÎNE — donc les notes
   déjà écrites restent valides, sans migration.

   ⚠️ POURQUOI PAS UN ÉDITEUR HTML (`contentEditable` + `execCommand`). Ce serait plus
   court à écrire, mais il faudrait stocker du HTML et le réafficher via
   `dangerouslySetInnerHTML` — donc écrire un assainisseur maison, c'est-à-dire la
   pièce la plus facile à rater de tout ce fichier, sur un contenu qui fait
   l'aller-retour par la base. `execCommand` est de surcroît déprécié.
   Ici le stockage est du TEXTE BALISÉ et le rendu produit des éléments React : aucune
   chaîne n'est jamais interprétée comme du HTML, l'injection est donc impossible par
   construction, pas par vigilance.

   Le balisage est volontairement minuscule (la barre d'outils l'écrit pour vous) :
     **gras**   *italique*   ~~barré~~   {rouge}coloré{/}   « - » en début de ligne
   ESPACES ET RETOURS À LA LIGNE sont conservés tels quels, en édition comme en
   lecture (`white-space: pre-wrap`) : deux espaces restent deux espaces, une ligne
   vide reste une ligne vide.

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

/* ⚠️ L'ORDRE DES ALTERNATIVES COMPTE : `**` doit être tenté avant `*`, sinon
   « **gras** » se lirait comme un italique vide suivi de « gras ». Les quantificateurs
   sont paresseux et exigent au moins un caractère, ce qui garantit que chaque tour de
   boucle consomme du texte — pas de boucle infinie possible. */
const MEMO_INLINE_RE = /\{(rouge|ambre|vert|teal)\}([\s\S]*?)\{\/\}|\*\*([\s\S]+?)\*\*|~~([\s\S]+?)~~|\*([\s\S]+?)\*/;

/** Texte balisé → éléments React. Récursive (une couleur peut contenir du gras). */
function memoInline(text: string, k: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text, n = 0;
  while (rest) {
    const m = MEMO_INLINE_RE.exec(rest);
    if (!m) { out.push(rest); break; }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const key = `${k}-${n++}`;
    if (m[1] !== undefined) out.push(<span key={key} style={{ color: MEMO_COLOR_OF[m[1]] }}>{memoInline(m[2], key)}</span>);
    else if (m[3] !== undefined) out.push(<strong key={key} style={{ fontWeight: 700, color: T.ink }}>{memoInline(m[3], key)}</strong>);
    else if (m[4] !== undefined) out.push(<s key={key}>{memoInline(m[4], key)}</s>);
    else out.push(<em key={key}>{memoInline(m[5], key)}</em>);
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

/** Rendu en lecture : les lignes « - » deviennent des puces, regroupées en une seule
 *  liste tant qu'elles se suivent. Le reste garde ses espaces et ses sauts de ligne. */
function MemoRead({ text }: { text: string }) {
  const blocs: ReactNode[] = [];
  const lignes = text.split("\n");
  let puces: string[] = [];
  const viderPuces = () => {
    if (!puces.length) return;
    blocs.push(
      <ul key={`u${blocs.length}`} style={{ margin: "2px 0 6px", paddingLeft: 18 }}>
        {puces.map((p, i) => <li key={i} style={{ margin: "2px 0" }}>{memoInline(p, `u${blocs.length}-${i}`)}</li>)}
      </ul>,
    );
    puces = [];
  };
  lignes.forEach((ln, i) => {
    if (ln.startsWith("- ")) { puces.push(ln.slice(2)); return; }
    viderPuces();
    blocs.push(
      <div key={`l${i}`} style={{ whiteSpace: "pre-wrap", minHeight: ln ? undefined : "1em" }}>
        {memoInline(ln, `l${i}`)}
      </div>,
    );
  });
  viderPuces();
  return <div style={{ fontSize: "13px", fontWeight: 500, color: T.ink2, lineHeight: 1.55, overflowWrap: "anywhere" }}>{blocs}</div>;
}

function MemoCard({ cfg }: { cfg: MemoCfg }) {
  const writer = useCfgWriter();
  const [text, setText] = useState(cfg.text);
  const [dirty, setDirty] = useState(false);
  // On ouvre en LECTURE quand il y a déjà quelque chose à lire, en édition sinon.
  const [edit, setEdit] = useState(!cfg.text);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  /* La cfg peut changer sous nos pieds (autre onglet, rechargement depuis la BDD). On
     ne l'écrase que si l'utilisateur n'a pas de saisie en cours — sinon on lui
     volerait ce qu'il tape. */
  useEffect(() => { if (!dirty) setText(cfg.text); }, [cfg.text, dirty]);
  const commit = () => {
    if (!dirty || !writer) return;
    writer.save({ text: text.slice(0, MEMO_MAX) });
    setDirty(false);
  };

  /** Entoure la sélection courante des marqueurs demandés, puis restitue le focus et
   *  la sélection — sans quoi chaque clic de la barre d'outils ferait perdre sa place. */
  const wrapSel = (before: string, after: string) => {
    const ta = taRef.current; if (!ta || !writer) return;
    const s = ta.selectionStart ?? 0, e = ta.selectionEnd ?? 0;
    setText(text.slice(0, s) + before + text.slice(s, e) + after + text.slice(e));
    setDirty(true);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + before.length, e + before.length); });
  };
  /** Préfixe « - » sur toutes les lignes touchées par la sélection (ou la ligne du
   *  curseur), en basculant : re-cliquer retire les puces. */
  const togglePuces = () => {
    const ta = taRef.current; if (!ta || !writer) return;
    const s = ta.selectionStart ?? 0, e = ta.selectionEnd ?? 0;
    const debut = text.lastIndexOf("\n", s - 1) + 1;
    const finRel = text.indexOf("\n", e);
    const fin = finRel === -1 ? text.length : finRel;
    const bloc = text.slice(debut, fin).split("\n");
    const toutesPuces = bloc.every((l) => l.startsWith("- "));
    const next = bloc.map((l) => (toutesPuces ? l.replace(/^- /, "") : l ? `- ${l}` : l)).join("\n");
    setText(text.slice(0, debut) + next + text.slice(fin));
    setDirty(true);
    requestAnimationFrame(() => ta.focus());
  };

  const maxHeight = useContext(WidgetHeightCtx);
  const tool: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: T.rSm, border: `1px solid ${T.line}`, background: T.surface, color: T.ink2, cursor: "pointer", fontFamily: "inherit", flex: "none" };

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
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: 8 }}>
              <button style={tool} onClick={() => wrapSel("**", "**")} aria-label="Gras" title="Gras"><Bold aria-hidden style={{ width: 14, height: 14 }} /></button>
              <button style={tool} onClick={() => wrapSel("*", "*")} aria-label="Italique" title="Italique"><Italic aria-hidden style={{ width: 14, height: 14 }} /></button>
              <button style={tool} onClick={() => wrapSel("~~", "~~")} aria-label="Barré" title="Barré"><Strikethrough aria-hidden style={{ width: 14, height: 14 }} /></button>
              <button style={tool} onClick={togglePuces} aria-label="Liste à puces" title="Liste à puces"><List aria-hidden style={{ width: 14, height: 14 }} /></button>
              <span aria-hidden style={{ width: 1, height: 20, background: T.line, margin: "0 2px" }} />
              {MEMO_COLORS.map((c) => (
                <button key={c.key} onClick={() => wrapSel(`{${c.key}}`, "{/}")} aria-label={`Couleur ${c.label}`} title={c.label}
                  style={{ ...tool, width: 24, height: 24 }}>
                  <span aria-hidden style={{ width: 12, height: 12, borderRadius: 999, background: c.color }} />
                </button>
              ))}
            </div>
            <textarea
              ref={taRef}
              value={text}
              maxLength={MEMO_MAX}
              onChange={(e) => { setText(e.target.value); setDirty(true); }}
              onBlur={commit}
              onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); commit(); } }}
              placeholder={"Notes personnelles — visibles de vous seul.\n\n**gras**  *italique*  ~~barré~~\n- une puce"}
              aria-label="Pense-bête"
              style={{ width: "100%", boxSizing: "border-box", minHeight: 90, maxHeight: Math.max(90, maxHeight - 80), resize: "none",
                padding: "10px 11px", borderRadius: T.rSm, border: `1px solid ${dirty ? T.brand100 : T.line}`,
                background: T.surface, color: T.ink, fontFamily: "inherit", fontSize: "13px", fontWeight: 500, lineHeight: 1.5,
                whiteSpace: "pre-wrap" }}
            />
            {dirty && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button className="slb-btnp" onClick={commit}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: T.rSm, border: "none", background: T.brand, color: "#fff", fontFamily: "inherit", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" }}>
                  <Save aria-hidden style={{ width: 14, height: 14 }} />Enregistrer
                </button>
              </div>
            )}
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
   Volontairement DISTINCTE du « Journal des tâches » : celui-ci lit les tâches
   Airtable de l'équipe, celle-ci est un pense-bête à cases, privé, sans échéance ni
   assignation. Ne pas les fusionner — ce sont deux objets métier différents.
   Chaque geste (cocher, ajouter, retirer) écrit : ce sont des actes discrets et rares,
   contrairement à la frappe au clavier du pense-bête. */
type CheckItem = { id: string; texte: string; fait: boolean };
type ChecklistCfg = { items: CheckItem[] };

const coerceChecklistCfg = (raw: unknown): ChecklistCfg => {
  const list = Array.isArray(asObj(raw).items) ? (asObj(raw).items as unknown[]) : [];
  const seen = new Set<string>();
  const items: CheckItem[] = [];
  for (const it of list) {
    if (items.length >= CHECK_MAX) break;
    const o = asObj(it);
    const id = asText(o.id);
    const texte = asText(o.texte).slice(0, CHECK_TEXT_MAX);
    if (!id || !texte || seen.has(id)) continue;   // ligne sans texte = ligne perdue, on l'écarte
    seen.add(id);
    items.push({ id, texte, fait: o.fait === true });
  }
  return { items };
};

function ChecklistCard({ cfg }: { cfg: ChecklistCfg }) {
  const writer = useCfgWriter();
  const [saisie, setSaisie] = useState("");
  const write = (items: CheckItem[]) => writer?.save({ items: items.slice(0, CHECK_MAX) });
  const ajouter = () => {
    const texte = saisie.trim().slice(0, CHECK_TEXT_MAX);
    if (!texte || !writer || cfg.items.length >= CHECK_MAX) return;
    // Id local : un compteur suffirait mais deux onglets le referaient à l'identique.
    write([...cfg.items, { id: `c_${Math.random().toString(36).slice(2, 8)}`, texte, fait: false }]);
    setSaisie("");
  };
  const restants = cfg.items.filter((i) => !i.fait).length;
  return (
    <Widget icon={ClipboardList} title="Liste à cocher"
      sub={cfg.items.length ? `${restants} sur ${cfg.items.length} à faire` : "Vos rappels personnels"}>
      {writer && (
        <div style={{ display: "flex", gap: "8px", padding: "12px 16px 10px", borderBottom: `1px solid ${T.line}` }}>
          <input value={saisie} maxLength={CHECK_TEXT_MAX} onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouter(); } }}
            placeholder="Ajouter une ligne…" aria-label="Nouvelle ligne"
            style={{ flex: 1, minWidth: 0, boxSizing: "border-box", padding: "7px 10px", borderRadius: T.rSm, border: `1px solid ${T.line}`, background: T.surface, color: T.ink, fontFamily: "inherit", fontSize: "12.5px", fontWeight: 500 }} />
          <button className="slb-btng" onClick={ajouter} aria-label="Ajouter" title="Ajouter"
            style={{ flex: "none", display: "inline-flex", alignItems: "center", padding: "7px 10px", borderRadius: T.rSm, border: `1px solid ${T.line}`, background: T.surface, color: T.ink2, cursor: "pointer" }}>
            <Plus aria-hidden style={{ width: 15, height: 15 }} />
          </button>
        </div>
      )}
      {!cfg.items.length ? (
        <EmptyState dense icon={ClipboardList} title="Rien à faire"
          hint={writer ? "Ajoutez une ligne ci-dessus." : "Cette liste est en lecture seule."} />
      ) : (
        <ScrollBody>
          {cfg.items.map((it) => (
            <div key={it.id} className="slb-row" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 16px" }}>
              <input type="checkbox" checked={it.fait} disabled={!writer} aria-label={it.texte}
                onChange={() => write(cfg.items.map((x) => (x.id === it.id ? { ...x, fait: !x.fait } : x)))}
                style={{ width: 15, height: 15, accentColor: T.brand, flex: "none", cursor: writer ? "pointer" : "default" }} />
              {/* Le texte barré ne suffit pas à porter le sens (charte) : la case
                  cochée le dit déjà, la couleur atténuée n'est qu'un renfort. */}
              <span style={{ flex: 1, minWidth: 0, fontSize: "12.5px", fontWeight: 500, color: it.fait ? T.ink4 : T.ink2, textDecoration: it.fait ? "line-through" : undefined, overflowWrap: "anywhere" }}>
                {it.texte}
              </span>
              {/* `opacity:0` en ligne — cf. RowActions : la feuille de §2 ne peut pas en
                  répondre dans le bloc Softr, HoverFX (§2-bis) le révèle. */}
              {writer && (
                <button className="slb-nbtn slb-hact" style={{ ...NBTN_SM, opacity: 0 }} aria-label={`Retirer — ${it.texte}`} title="Retirer"
                  onClick={() => write(cfg.items.filter((x) => x.id !== it.id))}>
                  <X aria-hidden style={{ width: 14, height: 14 }} />
                </button>
              )}
            </div>
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

const WIDGET_REGISTRY: Record<WidgetTypeKey, WidgetTypeDef> = {
  /* ⚠️ La CLÉ reste `notifs` : c'est un contrat de persistance (les layouts déjà
     enregistrés la portent). Seul le titre change — « Nouveaux dossiers abonnés »
     depuis la refonte du 2026-08-06 (§9). */
  notifs: { title: "Nouveaux dossiers abonnés", icon: Bell, Render: NotifsCard,
            defaults: () => coerceNotifsCfg({}), coerce: coerceNotifsCfg, Options: NotifsOptions },
  taches: { title: "Journal des tâches", icon: CalendarClock, Render: TachesCard },
  notesInstallateurs: dataType("Dernières notes — Installateurs", HardHat, NOTES_INS_CFG),
  notesProspects: dataType("Dernières notes — Prospects", Target, NOTES_PRO_CFG),
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
   Trois concepts SÉPARÉS (cf. ARCHITECTURE-V2.md §0) :
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

/* Instances livrées par défaut. Ajouter une entrée = le widget apparaît UNE fois
   chez tout le monde (puis reste supprimable définitivement, cf. seed()). */
const DEFAULT_INSTANCES: Instance[] = [
  { id: "notifs", type: "notifs", cfg: {}, w: "half", h: 340 },
  { id: "taches", type: "taches", cfg: {}, w: "half", h: 340 },
  { id: "notesInstallateurs", type: "notesInstallateurs", cfg: {}, w: "half", h: 340 },
  { id: "notesProspects", type: "notesProspects", cfg: {}, w: "half", h: 340 },
  /* ⚠️ Les embeds Elfsight sont posés HAUT (2026-08-07) : ils ne défilent pas — une iframe
     coupe ce qui dépasse au lieu de le rendre atteignable. Le fil LinkedIn a besoin du cran
     « XL » pour montrer plus d'une publication ; la bannière tient en « Grand ». */
  { id: "linkedin", type: "linkedin", cfg: {}, w: "half", h: 860 },
  { id: "linkedinBanner", type: "linkedinBanner", cfg: {}, w: "half", h: 560 },
  /* ⚠️ POUR LE TEST — cette ligne fait apparaître la synthèse SAV UNE FOIS chez
     tout le monde (puis elle reste supprimable définitivement, cf. `seed()`).
     La RETIRER si le widget ne doit être qu'un modèle de la galerie : il y est déjà
     par CUSTOM_TYPES, donc chacun le pose s'il en a l'usage. */
  { id: "sav", type: "sav", cfg: {}, w: "half", h: 560 },
];

/* --- GALERIE « Ajouter un widget » : les modèles qu'on peut poser sur la grille.
   Entièrement GÉNÉRÉE, de deux origines :
     · les types SUR-MESURE (pour ré-ajouter un widget supprimé) ;
     · les `presets` DÉCLARÉS DANS LE CATALOGUE de chaque source (§6-bis) — c'est
       là que « SAV en cours » ou « Dossiers du mois » se définissent, en pur JSON.
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
  sav: "sav",
};
const groupOfSource = (s: SourceKey): string => SOURCE_GROUP[s] ?? "autres";

/* Types sur-mesure proposés dans la galerie, avec leur hauteur de départ (une barre
   d'annonces n'a pas besoin d'un widget de 340 px) et leur groupe de galerie. */
const CUSTOM_TYPES: { type: WidgetTypeKey; h?: WidgetHeight; group: string; shape: ShapeKind; desc: string }[] = [
  { type: "notifs", group: "abonnes", shape: "list", desc: "Les nouveaux dossiers abonnés notifiés, leur statut, l'état lu / non lu et un accès à la fiche." },
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
  { type: "memo", group: "outils", shape: "text", desc: "Un pense-bête personnel, avec gras, italique et puces." },
  { type: "checklist", group: "outils", shape: "check", desc: "Une liste à cocher, visible de vous seul." },
];

/** Presets d'une source : ceux du descripteur, ou un modèle liste par défaut. */
function presetsOf(s: SourceKey): Preset[] {
  const desc = CATALOG[s];
  if (desc.technical) return [];        // source technique : absente de la galerie
  const hint = desc.connected ? undefined : "source non connectée";
  const declared = desc.presets ?? [];
  const list: PresetDesc[] = declared.length ? declared
    : [{ label: `Liste — ${desc.label}`, cfg: { source: s } }];
  return list.map((p, i) => {
    /* La FORME se déduit de la vue déclarée par le preset : aucun archétype à saisir à
       la main, et un preset qui passe en tableau change de miniature tout seul. */
    const vue = (p.cfg as { view?: { kind?: string } }).view?.kind;
    const shape: ShapeKind = vue === "table" ? "table" : vue === "kpi" ? "kpi" : "list";
    const quoi = vue === "table" ? "Tableau" : vue === "kpi" ? "Indicateur" : "Liste";
    return {
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
    };
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

        {/* Corps : la grille de cartes, seule zone qui défile. */}
        <div className="slb-scrolly" style={{ overflowY: "auto", padding: "16px 18px 20px", background: T.surface2 }}>
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
 *  imposée : supprimer un widget par défaut est définitif. */
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

  /** Préhension par l'en-tête, fournie à CHAQUE widget.
   *  L'image de glissement est forcée sur la carte entière : sans cela, le navigateur
   *  ne trimballerait que le bandeau de l'en-tête, ce qui rend la cible illisible. */
  const grabOf = (id: string, i: number): WidgetGrab => ({
    onDragStart: (e) => {
      if (resizeRef.current || sizeRef.current) { e.preventDefault(); return; }
      // Un glisser ne part jamais d'un élément interactif de l'en-tête (le ⋮) :
      // `dragstart` annulerait son clic — c'est le bug du 2026-08-03.
      const from = e.target as Element | null;
      if (from?.closest?.('button, select, input, textarea, label, a, [role="menu"], [role="dialog"]')) {
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
        <Card style={CARD}>
          <EmptyState icon={LayoutGrid} title="Aucun widget affiché"
            hint="Ouvrez la galerie pour composer votre tableau de bord : chaque modèle montre à quoi il ressemble avant d'être posé." />
          {/* Un état vide guidant DOIT porter le geste qui en sort (charte) — et ce geste
              est maintenant à un clic, dans les deux modes. */}
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
