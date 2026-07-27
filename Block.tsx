/* ============================================================================
   SunLib CRM — PAGE D'ACCUEIL · Bloc in-page vibe code (Softr ↔ Airtable)
   ----------------------------------------------------------------------------
   Conforme à :
   · 🎨 Charte UI/UX & Couleurs — IT (Notion 382b09d7…)
   · 🎨 Bloc In-Page Vibe Code — gabarit refonte CRM (Notion 3a3b09d7…)

   Layout : héro (dégradé SunLib + logo rond) → ONGLETS DE NAVIGATION (pages
   de l'espace, souligné teal, sticky au scroll) → outils → LinkedIn (embed
   existant, inchangé) → TABLEAU DE BORD : widgets indépendants et compacts,
   scrollables individuellement — dossiers | tâches, puis notes | notes.

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
   BRANCHEMENT — 4 zones [À COMPLÉTER], toutes regroupées ci-dessous :
     A) USE_MOCK / datasource.define / SELECT_*  → §6 (IDs + noms de champs)
     B) NAV_TABS.href / QUICK_LINKS.href         → §7 (URLs des pages & outils)
     C) LinkedInSection                          → embed LinkedIn existant
     D) « Marquer comme lue »                    → §9 (champ Airtable "Lu")
   Tant que USE_MOCK=true, l'aperçu tourne sur les données mock du prototype.
   ============================================================================ */

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FC,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  UserPlus, Handshake, BookUser, Users, Library, BarChart3,
  FileSignature, Calculator, LayoutGrid, Briefcase, Ticket, Mail,
  ChevronRight, Bell,
  CheckCheck, Check, CheckCircle, Clock, XCircle, ClipboardList, Building2,
  Inbox, CalendarClock, HardHat, Target, MoreVertical, Plus, Eye, Home,
  SlidersHorizontal, GripVertical, ChevronUp, ChevronDown, EyeOff, RotateCcw,
  Save, X, Newspaper, Megaphone,
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
   Passer à false UNE FOIS les IDs de §6 renseignés (et les tables connectées
   dans l'onglet Sources du bloc). C'est le SEUL interrupteur mock ↔ live.
   ============================================================================ */
const USE_MOCK: boolean = true;

/* Assets officiels — dépôt SunLibIT/Documents-PNG (charte, §Dépôt images) */
const IMG = {
  logoRond: "https://raw.githubusercontent.com/SunLibIT/Documents-PNG/main/logo_Blanc_rond.svg",
};

/* ============================================================================
   1. DESIGN TOKENS `T` + constantes de style — kit visuel de référence
   ============================================================================ */
const T = {
  canvas: "#F3F6F7", surface: "#FFFFFF", surface2: "#F8FAFB",
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
const FOOT_LINK: CSSProperties = { background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: 700, color: T.brand700, padding: "2px 6px" };

/* ============================================================================
   2. StyleInjector — focus, hover, scrollbars, animations (scopé #slb)
   ============================================================================ */
function StyleInjector() {
  useEffect(() => {
    const id = "slb-styles";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
      #slb :focus-visible{ outline:2px solid ${T.brand}; outline-offset:2px; border-radius:6px; }
      #slb .slb-tabs::-webkit-scrollbar{ display:none; }
      #slb .slb-row{ transition:background .15s ease; }
      #slb .slb-row + .slb-row{ border-top:1px solid ${T.line}; }
      #slb .slb-row:hover{ background:${T.surface2}; }
      #slb .slb-tab:hover{ color:${T.ink}; }
      #slb .slb-nbtn{ transition:background .15s ease, color .15s ease; }
      #slb .slb-nbtn:hover{ background:${T.neutral050} !important; color:${T.ink2} !important; }
      @keyframes slb-fade{ from{opacity:0} to{opacity:1} }
      @keyframes slb-panel-fwd{ from{opacity:0; transform:translate3d(22px,0,0)} to{opacity:1; transform:none} }

      /* Boutons + tuiles */
      #slb .slb-btng{ transition:border-color .15s ease, color .15s ease, background .15s ease; }
      #slb .slb-btng:hover{ border-color:${T.brand100}; color:${T.brand700}; background:${T.brand050}; }
      #slb .slb-tile{ transition:border-color .16s ease, box-shadow .16s ease, transform .16s ease; }
      #slb .slb-tile:hover{ border-color:${T.brand100}; box-shadow:${T.shMd}; transform:translateY(-1px); }
      /* Micro-interaction flèche de la charte : glisse ~6px, ~0.5s */
      #slb .slb-arrow{ transition:transform .5s ease, color .16s ease; }
      #slb .slb-tile:hover .slb-arrow{ transform:translateX(6px); color:${T.brand600}; }
      #slb .slb-clamp2{ display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
      /* Widgets : corps scrollable individuellement (scrollbar fine) */
      #slb .slb-scrolly{ overflow-y:auto; max-height:var(--slb-wh, 340px); scrollbar-width:thin; scrollbar-color:${T.line2} transparent; }
      #slb .slb-scrolly::-webkit-scrollbar{ width:6px; }
      #slb .slb-scrolly::-webkit-scrollbar-thumb{ background:${T.line2}; border-radius:999px; }
      #slb .slb-scrolly::-webkit-scrollbar-track{ background:transparent; }
      /* Actions de ligne révélées au survol et au focus clavier */
      #slb .slb-hact{ opacity:0; transition:opacity .15s ease; }
      #slb .slb-row:hover .slb-hact, #slb .slb-row:focus-within .slb-hact{ opacity:1; }
      #slb .slb-nbtn-ok:hover{ background:${T.ok050} !important; color:${T.okInk} !important; }

      /* Mode Personnaliser : bouton primaire, items de menu ⋮, poignée, wrapper DnD */
      #slb .slb-btnp{ transition:background .15s ease; }
      #slb .slb-btnp:hover{ background:${T.brand600}; }
      #slb .slb-menu-item{ transition:background .12s ease; }
      #slb .slb-menu-item:hover:not(:disabled){ background:${T.surface2}; }
      #slb .slb-menu-item:disabled{ opacity:.45; cursor:not-allowed; }
      #slb .slb-grip{ cursor:grab; }
      #slb .slb-grip:active{ cursor:grabbing; }
      #slb .slb-dragwrap{ transition:opacity .15s ease, outline-color .15s ease; }
      /* Grille dashboard : nb de colonnes selon la LARGEUR DU BLOC (container query,
         PAS la fenêtre) → « pleine largeur » = span 2 col dès que le bloc ≥ 720px ;
         1 col si le bloc est étroit. Corrige « agrandir sans effet » en iframe. */
      #slb .slb-dash-wrap{ container-type:inline-size; }
      #slb .slb-dash{ display:grid; gap:18px; align-items:start; grid-template-columns:1fr; }
      @container (min-width:720px){ #slb .slb-dash{ grid-template-columns:repeat(2, minmax(0,1fr)); } }
      /* Poignées (mode Personnaliser) : .slb-rzh = largeur (bords G/D), .slb-rzv = hauteur (bas) */
      #slb .slb-rzh > span{ transition:background .15s ease, height .15s ease; }
      #slb .slb-rzh:hover > span, #slb .slb-rzh:active > span{ background:${T.brand}; height:48px; }
      #slb .slb-rzv > span{ transition:background .15s ease, width .15s ease; }
      #slb .slb-rzv:hover > span, #slb .slb-rzv:active > span{ background:${T.brand}; width:48px; }
      @keyframes slb-skel{ 0%{opacity:.55} 50%{opacity:1} 100%{opacity:.55} }
      #slb .slb-skel{ animation:slb-skel 1.3s ease-in-out infinite; }

      @media (prefers-reduced-motion: reduce){ #slb *{ animation:none !important; transition:none !important; } }
    `;
    document.head.appendChild(el);
  }, []);
  return null;
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
function StatusBadge({ value }: { value: string }) {
  const v = statusVariant(value);
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
// Dégradé d'avatar déterministe depuis le nom (cf. onglet Notes du gabarit)
function avatarBg(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `linear-gradient(150deg, hsl(${h} 52% 50%), hsl(${(h + 26) % 360} 56% 37%))`;
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
     · Nouveaux dossiers Abonné  → base BDD Abonné · table « Abonnés »        ✅ ID fourni
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
  prefs: "96961120-3d05-4ccc-8a48-3640ee48b060",   // ✅ « Preferences » (tablespace Home-preferences) — persistance layout, §11
});

/* Sources PAS ENCORE connectées : notesIns (« Suivi client »), notesPro (« Suivi
   propect »), tachesPa (« Taches »), tachesPr (« Taches prospect »). On NE les
   déclare PAS dans le define ci-dessus (Softr rejette tout id non connecté) et on
   ne les lit PAS. Les widgets correspondants s'affichent vides. Pour en activer
   une : la connecter (onglet Sources), récupérer son id (onglet Chat), l'ajouter
   comme membre ci-dessus, puis brancher sa lecture dans le widget §9-10 (voir la
   marche à suivre en commentaire au-dessus de chaque widget concerné). */

// alias (clé JS) -> nom EXACT du champ Airtable. Filtres/tri par ALIAS.
// ⚠️ Certains noms comportent des espaces exacts (« … Installateur ) », « Date »,
//    « date ») ou une casse précise (« date de fin » vs « Date de fin ») : NE PAS
//    normaliser — Softr résout le champ par ce nom littéral.

// Notifs ← « Abonnés ». Pas de champ « Lu » → « marquer comme lu » = masquage local.
const SELECT_ABONNE = q.select({
  nom: "Nom",
  prenom: "Prenom",
  partenaire: "Nom de l'entreprise (from Installateur )", // lookup installateur (espace avant ")")
  statut: "Statut Dossiers",
  offre: "Type d installation", // pas de Duo/Solo/Pro → « PV seul », « PV + Batterie Virtuelle »…
  creeLe: "date de création",
});

// Notes installateurs ← « Suivi client » (base Installateurs)
const SELECT_NOTE_INS = q.select({
  nom: "Installateur", // champ primaire = nom de l'installateur
  note: "Notes",
  date: "Date ",       // ⚠️ espace final
});
// Notes prospects ← « Suivi propect » (base Propect)
const SELECT_NOTE_PRO = q.select({
  nom: "Nom",
  note: "Notes",
  date: "date ",       // ⚠️ espace final (createdTime)
});

// Tâches partenaires ← « Taches » (base Installateurs)
const SELECT_TACHE_PA = q.select({
  desc: "Description",
  associe: "Partenaire associé",
  fin: "date de fin",  // ⚠️ minuscule
  fait: "Fait",        // pour n'afficher que les tâches en cours
});
// Tâches prospects ← « Taches prospect » (base Installateurs)
const SELECT_TACHE_PR = q.select({
  desc: "Description",
  associe: "Prospect associé",
  fin: "Date de fin",  // ⚠️ majuscule
  fait: "Fait",
});

// Préférences d'accueil ← « Preferences » (tablespace Home-preferences) (persistance du layout par user)
// ⚠️ Les VALEURS sont les FIELD IDs Softr Tables (PAS les noms de champs) — c'est
// obligatoire pour l'écriture, sinon « Failed to add record: 400 ». IDs fournis par
// l'onglet Chat du bloc (2026-07-24). L'appli n'écrit que email/layout/updatedAt
// (Plan A : tout le layout dans layout_json) ; les autres sont mappés pour l'avenir.
const SELECT_PREFS = q.select({
  email: "9M3Kb",           // user_email — clé logique (email de useCurrentUser())
  layout: "lDOLl",          // layout_json — {v,order,hidden,wide} sérialisé (Plan A)
  widgetsConfig: "B2z4P",   // widgets_config_json (réserve)
  visibleWidgets: "erOm1",  // visible_widgets (réserve)
  layoutMobile: "eP2jf",    // layout_mobile_json (réserve)
  updatedAt: "JAUJz",       // updated_at — DATETIME (chaîne ISO)
  schemaVersion: "nNvK1",   // schema_version (réserve)
  isDefault: "1eOtL",       // is_default (réserve)
});

// Modèles de vue — mêmes formes pour le mock et le mapping Airtable.
type Notif = { id: string; nom: string; societe?: string; partenaire: string; statut: string; offre: string; creeLe: string };
type Task = { id: string; desc: string; associe: string; fin: string };
type Note = { id: string; nom: string; date: string; note: string };

const flatten = (res: { data?: { pages?: { items: any[] }[] } } | undefined): Rec[] =>
  (res?.data?.pages ?? []).flatMap((p) => p.items) as Rec[];

const mapNotif = (r: Rec): Notif => ({
  id: r.id,
  nom: [asText(r.fields.prenom), asText(r.fields.nom)].filter(Boolean).join(" "),
  societe: asText(r.fields.partenaire), // repli d'affichage si nom/prénom absents
  partenaire: asText(r.fields.partenaire),
  statut: asText(r.fields.statut),
  offre: asText(r.fields.offre),
  creeLe: asText(r.fields.creeLe),
});
const mapTask = (r: Rec): Task => ({
  id: r.id,
  desc: asText(r.fields.desc),
  associe: asText(r.fields.associe),
  fin: asText(r.fields.fin),
});
const mapNote = (r: Rec): Note => ({
  id: r.id,
  nom: asText(r.fields.nom),
  date: asText(r.fields.date),
  note: asText(r.fields.note),
});

/* --- Données mock d'aperçu (identiques au prototype validé) --- */
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString(); };

const MOCK: {
  user: { firstName: string };
  notifs: Notif[];
  tachesProspects: Task[];
  tachesPartenaires: Task[];
  notesInstallateurs: Note[];
  notesProspects: Note[];
} = {
  user: { firstName: "Frédéric" },

  notifs: [
    { id: "n1", nom: "Nicolas Laborderie", partenaire: "Mandat Energie", statut: "Dossier incomplet pour instruction", offre: "Duo", creeLe: daysAgo(1) },
    { id: "n2", nom: "Commune de Payssous", partenaire: "FLG SOLAR", statut: "Dossier incomplet pour instruction", offre: "Pro", creeLe: daysAgo(2) },
    { id: "n3", nom: "Toulose Transit", partenaire: "Neosoleil", statut: "Dossier incomplet pour instruction", offre: "Pro", creeLe: daysAgo(2) },
    { id: "n4", nom: "Salvatore Vizzini", partenaire: "MC ENERGY", statut: "Contrat envoyé et en attente signature", offre: "Duo", creeLe: daysAgo(15) },
    { id: "n5", nom: "Jocelyne Guintrand", partenaire: "MC ENERGY", statut: "Contrat signé", offre: "Solo", creeLe: daysAgo(15) },
    { id: "n6", nom: "Julian Maillo Moreno", partenaire: "MC ENERGY", statut: "Contrat signé", offre: "Duo", creeLe: daysAgo(15) },
  ],

  tachesProspects: [],
  tachesPartenaires: [
    { id: "t1", desc: "Relancer pour les pièces du dossier RGE", associe: "MC ENERGY", fin: inDays(-2) },
    { id: "t2", desc: "Envoyer la grille tarifaire 2026", associe: "FLG SOLAR", fin: inDays(1) },
    { id: "t3", desc: "Point mensuel pipeline", associe: "Neosoleil", fin: inDays(6) },
    { id: "t4", desc: "Préparer la formation financement", associe: "Mandat Energie", fin: inDays(21) },
  ],

  notesInstallateurs: [
    { id: "i1", nom: "WattElse Energies SAS", date: "2025-05-19", note: "Contact via LinkedIn, en attente de retour sur la présentation." },
    { id: "i2", nom: "3J Environnement", date: "2025-11-25", note: "Dossier admin à jour, RGE renouvelé." },
    { id: "i3", nom: "Louiseco", date: "2025-08-26", note: "26/08 → présentation faite, très intéressés par l'offre Duo." },
    { id: "i4", nom: "KE Energies", date: "2024-09-16", note: "Introduit par Hanna, premier échange positif." },
    { id: "i5", nom: "Aura Sun", date: "2025-11-17", note: "Vu Solar and Storage, à recontacter début décembre." },
    { id: "i6", nom: "renov&sun VIP Montpellier", date: "2025-11-24", note: "RGE et décennale reçus, dossier complet." },
    { id: "i7", nom: "Gaïa l'Énergie de Demain", date: "2025-05-16", note: "Nouvel email pour la mise en relation avec le pôle études." },
  ],
  notesProspects: [
    { id: "p1", nom: "JS Energies", date: "2026-03-25", note: "Tentative d'appel, laissé message, à relancer semaine prochaine." },
    { id: "p2", nom: "Mon Poseur Energie", date: "2025-09-26", note: "Rappel ce jour d'un autre gérant, intéressé par le modèle abonnement." },
    { id: "p3", nom: "Aurora Energie", date: "2025-07-08", note: "laurent@aurora-energie.fr — envoi de la plaquette et de la grille." },
    { id: "p4", nom: "LM Energie — Perpignan", date: "2025-07-08", note: "Damien : présentation faite, relance faite." },
    { id: "p5", nom: "ATEXE Group — Montpellier", date: "2025-06-11", note: "Prise de rdv pour le jeudi 19/06." },
    { id: "p6", nom: "Voltissima", date: "2025-05-21", note: "OK contrat, va m'envoyer au mois de juin ses premières affaires." },
    { id: "p7", nom: "Enecopro — Thuir (66)", date: "2025-05-19", note: "Ancien associé de Mr Chaufrias, connaît déjà l'offre SunLib." },
  ],
};

/* ============================================================================
   7. NAV & OUTILS — [À COMPLÉTER B] URLs réelles
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
  { id: "formulaire", label: "Formulaire de contact", icon: Mail, embed: "https://formulairedecontact.vercel.app/" },
  { id: "simulateur", label: "Simulateur Grille", icon: LayoutGrid, embed: "https://simulateur-grille-v2.vercel.app/" },
  { id: "bibliotheque", label: "Bibliothèque", icon: Library, embed: "https://documentation-interne.vercel.app/" },
];

/* Outils. TODO : renseigner les vraies URLs. Cible par défaut = outil externe
   (nouvel onglet). Mettre `top: true` pour une page de l'espace Softr (target
   _top, comme la navigation) — jamais de navigation DANS l'iframe du bloc. */
const QUICK_LINKS: { label: string; icon: LucideIcon; href: string; solar?: boolean; top?: boolean }[] = [
  // Pages de l'espace Softr (ex-onglets de nav) restaurées en raccourcis (target _top).
  { label: "Prospects", icon: UserPlus, href: "#", top: true },
  { label: "Partenaires", icon: Handshake, href: "#", top: true },
  { label: "Contact Partenaire", icon: BookUser, href: "#", top: true },
  { label: "Abonnés", icon: Users, href: "#", top: true },
  { label: "KPI", icon: BarChart3, href: "#", top: true },
  // (Bibliothèque n'est plus ici : c'est un onglet → documentation-interne.vercel.app)
  // Outils externes.
  { label: "You Sign", icon: FileSignature, href: "#" },
  { label: "Calculette d'abonnement", icon: Calculator, href: "#", solar: true },
  { label: "Services Sellsy", icon: Briefcase, href: "#" },
  { label: "Tik&Lib", icon: Ticket, href: "#" },
  // Simulateur Grille & Formulaire de contact retirés d'ici : ce sont désormais
  // des onglets (embarqués en iframe). Ne pas les redédoubler dans les Outils.
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

/* Taille (hauteur) d'un widget, réglable en mode Personnaliser. Défaut "md". */
type WidgetSize = "sm" | "md" | "lg";
const WIDGET_HEIGHTS: Record<WidgetSize, number> = { sm: 168, md: 340, lg: 560 };

/* --- Contexte d'édition : le mode Personnaliser injecte, PAR widget, sa position
      et ses actions (déplacer, largeur, taille, masquer). `null` = usage normal →
      aucune poignée, aucun menu d'édition, corps interactif. --- */
type WidgetChrome = {
  index: number;
  total: number;
  isWide: boolean;
  size: WidgetSize;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSetWide: (value: boolean) => void;
  onSetSize: (size: WidgetSize) => void;
  onHide: () => void;
};
const WidgetChromeCtx = createContext<WidgetChrome | null>(null);

/* --- Menu ⋮ d'édition — chemin CLAVIER et TACTILE (le DnD HTML5 ne fonctionne
      pas au doigt : ce menu n'est donc pas optionnel). Boutons focusables,
      aria-label explicites, fermeture Échap / clic extérieur. --- */
function WidgetEditMenu({ chrome, title }: { chrome: WidgetChrome; title: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const item: CSSProperties = { display: "flex", alignItems: "center", gap: "9px", width: "100%", padding: "9px 12px", borderRadius: T.rSm, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", fontWeight: 600, color: T.ink2, textAlign: "left", whiteSpace: "nowrap" };
  const run = (fn: () => void) => () => { fn(); setOpen(false); };
  const sep: CSSProperties = { height: 1, background: T.line, margin: "5px 8px" };
  const segLbl: CSSProperties = { padding: "5px 12px 3px", fontSize: "10.5px", fontWeight: 700, color: T.ink4, textTransform: "uppercase", letterSpacing: ".05em" };
  const segRow: CSSProperties = { display: "flex", gap: "6px", padding: "0 8px 5px" };
  const seg = (active: boolean): CSSProperties => ({ flex: 1, padding: "6px 4px", borderRadius: T.rSm, border: `1px solid ${active ? T.brand : T.line}`, background: active ? T.brand050 : T.surface, color: active ? T.brand700 : T.ink2, fontFamily: "inherit", fontSize: "12px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" });
  return (
    <div ref={ref} style={{ position: "relative", flex: "none" }}>
      <button className="slb-nbtn" style={NBTN_SM} aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((o) => !o)} aria-label={`Réorganiser — ${title}`} title="Réorganiser">
        <MoreVertical aria-hidden style={{ width: 15, height: 15 }} />
      </button>
      {open && (
        <div role="menu" style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 30, minWidth: 214, padding: "5px", backgroundColor: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rMd, boxShadow: T.shMd, animation: "slb-fade .12s ease both" }}>
          <button role="menuitem" className="slb-menu-item" style={item} onClick={run(chrome.onMoveUp)} disabled={chrome.index === 0} aria-label={`Monter — ${title}`}>
            <ChevronUp aria-hidden style={{ width: 16, height: 16 }} />Monter
          </button>
          <button role="menuitem" className="slb-menu-item" style={item} onClick={run(chrome.onMoveDown)} disabled={chrome.index === chrome.total - 1} aria-label={`Descendre — ${title}`}>
            <ChevronDown aria-hidden style={{ width: 16, height: 16 }} />Descendre
          </button>
          <div style={sep} />
          <div style={segLbl}>Largeur</div>
          <div style={segRow}>
            <button style={seg(!chrome.isWide)} onClick={() => chrome.onSetWide(false)} aria-pressed={!chrome.isWide} aria-label={`Largeur moitié — ${title}`}>Moitié</button>
            <button style={seg(chrome.isWide)} onClick={() => chrome.onSetWide(true)} aria-pressed={chrome.isWide} aria-label={`Pleine largeur — ${title}`}>Pleine</button>
          </div>
          <div style={segLbl}>Taille</div>
          <div style={segRow}>
            <button style={seg(chrome.size === "sm")} onClick={() => chrome.onSetSize("sm")} aria-pressed={chrome.size === "sm"} aria-label={`Très petit — ${title}`}>Petit</button>
            <button style={seg(chrome.size === "md")} onClick={() => chrome.onSetSize("md")} aria-pressed={chrome.size === "md"} aria-label={`Moyen — ${title}`}>Moyen</button>
            <button style={seg(chrome.size === "lg")} onClick={() => chrome.onSetSize("lg")} aria-pressed={chrome.size === "lg"} aria-label={`Grand — ${title}`}>Grand</button>
          </div>
          <div style={sep} />
          <button role="menuitem" className="slb-menu-item" style={{ ...item, color: T.dangerInk }} onClick={run(chrome.onHide)} aria-label={`Masquer — ${title}`}>
            <EyeOff aria-hidden style={{ width: 16, height: 16 }} />Masquer
          </button>
        </div>
      )}
    </div>
  );
}

/* --- Coquille de widget compact : en-tête (icône + titre + actions), corps
      libre, pied optionnel. En mode Personnaliser (contexte présent) : poignée
      GripVertical + menu ⋮ d'édition dans l'en-tête, et corps rendu INERTE
      (pointer-events:none) pour éviter tout clic accidentel pendant le drag.
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
  const chrome = useContext(WidgetChromeCtx);
  const editing = chrome !== null;
  return (
    <Card style={CARD}>
      <div style={WHEAD}>
        {editing && (
          <span className="slb-grip" title="Glisser pour réordonner" aria-hidden
            style={{ display: "grid", placeItems: "center", width: 22, height: 28, marginLeft: -4, color: T.ink4, flex: "none" }}>
            <GripVertical style={{ width: 17, height: 17 }} />
          </span>
        )}
        <span style={icoPillSm(solar)}><Icon aria-hidden style={{ width: 15, height: 15 }} strokeWidth={1.7} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={WTITLE}>{title}</div>
          {sub && <div style={WSUB}>{sub}</div>}
        </div>
        {editing ? (
          <WidgetEditMenu chrome={chrome} title={title} />
        ) : (
          <>
            {headActions}
            {/* TODO : brancher le menu du widget (options, lien vers la page complète…) */}
            <button className="slb-nbtn" style={NBTN_SM} aria-label={`Options — ${title}`} title="Options">
              <MoreVertical aria-hidden style={{ width: 15, height: 15 }} />
            </button>
          </>
        )}
      </div>
      <div style={editing ? { pointerEvents: "none", userSelect: "none" } : undefined}>
        {children}
        {footer && (
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 16px", borderTop: `1px solid ${T.line}` }}>
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
function Hero({ firstName, unread, urgent }: { firstName: string; unread: number; urgent: number }) {
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const chip: CSSProperties = { display: "inline-flex", alignItems: "center", gap: "7px", padding: "7px 13px", borderRadius: "999px", fontSize: "12.5px", fontWeight: 600, color: "#fff", backgroundColor: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.38)", backdropFilter: "blur(4px)" };
  return (
    <section aria-label="Bienvenue" style={{ borderRadius: T.rXl, overflow: "hidden", border: `1px solid ${T.line}`, boxShadow: T.shSm, background: "linear-gradient(90deg, #13A3AC 0%, #3CAE68 100%)" }}>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "20px 28px", padding: "clamp(22px, 3.8vw, 38px) clamp(22px, 4.5vw, 46px)" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.85)" }}>{today}</div>
          <h1 style={{ margin: "8px 0 6px", fontSize: "clamp(26px, 3.6vw, 36px)", fontWeight: 700, letterSpacing: "-.02em", color: "#fff", textShadow: "0 1px 2px rgba(16,26,40,.15)" }}>
            Bienvenue {firstName ? `${firstName} ` : ""}!
          </h1>
          <p style={{ margin: 0, fontSize: "14.5px", fontWeight: 500, color: "rgba(255,255,255,.92)", maxWidth: 480 }}>
            Voici l'essentiel de votre activité SunLib aujourd'hui.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "20px" }}>
            <span style={chip}><Bell aria-hidden style={{ width: 14, height: 14 }} />{unread} dossier{unread > 1 ? "s" : ""} à traiter</span>
            <span style={chip}><CalendarClock aria-hidden style={{ width: 14, height: 14 }} />{urgent} tâche{urgent > 1 ? "s" : ""} urgente{urgent > 1 ? "s" : ""}</span>
          </div>
        </div>
        {/* Forçé en blanc (le SVG source s'affiche foncé) : brightness(0) → tout noir,
            puis invert(1) → tout blanc. Rend un logo blanc net sur le dégradé. */}
        <img src={IMG.logoRond} alt="SunLib" style={{ flex: "none", marginLeft: "auto", height: "clamp(88px, 11vw, 140px)", filter: "brightness(0) invert(1)" }} />
      </div>
    </section>
  );
}

/* --- Outils --- */
function QuickLinks() {
  return (
    <section aria-label="Outils">
      <h2 style={{ ...H2, marginBottom: "14px" }}>Outils</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "13px" }}>
        {QUICK_LINKS.map(({ label, icon: Icon, href, solar, top }) => (
          <a key={label} href={href}
            target={top ? "_top" : "_blank"} rel={top ? undefined : "noopener noreferrer"}
            className="slb-tile"
            style={{ display: "flex", alignItems: "center", gap: "12px", padding: "13px 15px", backgroundColor: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rLg, boxShadow: T.shSm, textDecoration: "none" }}>
            <span style={icoPill(solar)}><Icon aria-hidden style={{ width: 17, height: 17 }} strokeWidth={1.7} /></span>
            <span style={{ flex: 1, minWidth: 0, fontSize: "13.5px", fontWeight: 600, color: T.ink }}>{label}</span>
            <ChevronRight aria-hidden className="slb-arrow" style={{ width: 16, height: 16, color: T.ink4, flex: "none" }} />
          </a>
        ))}
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

/* --- SunLib sur LinkedIn — les embeds Elfsight sont désormais des WIDGETS du
      tableau de bord (voir LinkedinCard / LinkedinBannerCard au §10), chargés
      par le loader partagé useElfsightPlatform. Plus de section fixe : ils
      s'affichent, se réordonnent et se masquent comme les autres widgets. --- */

/* ============================================================================
   9. Tableau de bord — widgets indépendants et compacts
   ============================================================================ */

/* --- Widget « Nouveaux dossiers Abonné » (colonne gauche) --- */
function NotifRow({ n, onRead }: { n: Notif; onRead: (id: string) => void }) {
  const title = n.nom || n.societe || DASH;
  return (
    <div className="slb-row" style={{ display: "flex", alignItems: "center", gap: "11px", padding: "10px 16px" }}>
      <span aria-hidden style={{ width: 32, height: 32, borderRadius: "9px", flex: "none", display: "grid", placeItems: "center", color: "#fff", fontSize: "11.5px", fontWeight: 700, letterSpacing: ".03em", background: avatarBg(title) }}>
        {initials(title)}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0 }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
          <Badge variant="brand" dot>{n.offre}</Badge>
        </div>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px", marginTop: "5px" }}>
          <StatusBadge value={n.statut} />
          <span style={{ fontSize: "11.5px", fontWeight: 500, color: T.ink4 }} title={fmtDate(n.creeLe)}>{fmtRel(n.creeLe)} · via {n.partenaire}</span>
        </div>
      </div>
      {/* Actions secondaires révélées au survol / focus (charte §4 Listes).
          TODO : « Détail » → lien vers la fiche Abonné via <a target="_top"> (URL §7). */}
      <div className="slb-hact" style={{ display: "flex", gap: "2px", flex: "none" }}>
        <button className="slb-nbtn" style={NBTN_SM} aria-label={`Détail — ${title}`} title="Détail">
          <Eye aria-hidden style={{ width: 15, height: 15 }} />
        </button>
        <button className="slb-nbtn slb-nbtn-ok" style={NBTN_SM} onClick={() => onRead(n.id)} aria-label={`Marquer comme lue — ${title}`} title="Marquer comme lue">
          <Check aria-hidden style={{ width: 15, height: 15 }} />
        </button>
      </div>
    </div>
  );
}

function NotifWidget({ items, onRead, onReadAll }: { items: Notif[]; onRead: (id: string) => void; onReadAll: () => void }) {
  return (
    <Widget icon={Bell} title="Nouveaux dossiers Abonné"
      sub={items.length ? `${items.length} notification${items.length > 1 ? "s" : ""} non lue${items.length > 1 ? "s" : ""}` : "Aucune notification non lue"}
      headActions={items.length > 0 ? (
        <button className="slb-nbtn slb-nbtn-ok" style={NBTN_SM} onClick={onReadAll} aria-label="Tout marquer comme lu" title="Tout marquer comme lu">
          <CheckCheck aria-hidden style={{ width: 15, height: 15 }} />
        </button>
      ) : null}>
      {items.length === 0 ? (
        <EmptyState dense icon={CheckCircle} title="Vous êtes à jour" hint="Les nouveaux dossiers abonnés créés par vos partenaires apparaîtront ici." />
      ) : (
        <div className="slb-scrolly">
          {items.map((n) => <NotifRow key={n.id} n={n} onRead={onRead} />)}
        </div>
      )}
    </Widget>
  );
}

/* --- Widget « Journal des tâches » (colonne droite), onglets internes --- */
function TaskRow({ t }: { t: Task }) {
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
    </div>
  );
}

function TasksWidget({ prospects, partenaires }: { prospects: Task[]; partenaires: Task[] }) {
  const [tab, setTab] = useState("prospects");
  const tabs: Tab[] = [
    { id: "prospects", label: "Prospects", icon: ClipboardList, count: prospects.length },
    { id: "partenaires", label: "Partenaires", icon: Building2, count: partenaires.length },
  ];
  const rows = tab === "prospects" ? prospects : partenaires;
  return (
    <Widget icon={CalendarClock} title="Journal des tâches" sub="Prospects & partenaires"
      headActions={
        // TODO : brancher la création de tâche
        <button className="slb-nbtn" style={NBTN_SM} aria-label="Nouvelle tâche" title="Nouvelle tâche">
          <Plus aria-hidden style={{ width: 15, height: 15 }} />
        </button>
      }>
      <div style={{ padding: "2px 16px 0" }}>
        <TabBar dense tabs={tabs} activeTab={tab} onSelect={setTab} />
      </div>
      <div key={tab} role="tabpanel" style={{ animation: "slb-panel-fwd .3s cubic-bezier(.22,.61,.36,1) both" }}>
        {rows.length === 0 ? (
          <EmptyState dense icon={Inbox}
            title={tab === "prospects" ? "Aucune tâche prospect en cours" : "Aucune tâche partenaire en cours"}
            hint={tab === "prospects" ? "Les tâches liées à vos prospects apparaîtront ici." : "Les tâches liées à vos partenaires apparaîtront ici."} />
        ) : (
          <div className="slb-scrolly">
            {rows.map((t) => <TaskRow key={t.id} t={t} />)}
          </div>
        )}
      </div>
    </Widget>
  );
}

/* --- Widgets « Dernières notes » (Installateurs / Prospects) --- */
function NoteRow({ n }: { n: Note }) {
  return (
    <div className="slb-row" style={{ display: "flex", alignItems: "flex-start", gap: "11px", padding: "10px 16px" }}>
      <span aria-hidden style={{ width: 30, height: 30, borderRadius: "8px", flex: "none", display: "grid", placeItems: "center", color: "#fff", fontSize: "11px", fontWeight: 700, background: avatarBg(n.nom) }}>
        {initials(n.nom)}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: "12.5px", fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.nom}</span>
          <span style={{ flex: "none", fontSize: "11px", fontWeight: 500, color: T.ink4 }} title={fmtDate(n.date)}>{fmtSmart(n.date)}</span>
        </div>
        <div className="slb-clamp2" style={{ marginTop: "3px", fontSize: "12px", fontWeight: 500, lineHeight: 1.45, color: T.ink2 }}>{n.note}</div>
      </div>
    </div>
  );
}

function NotesWidget({ icon, title, items }: { icon: LucideIcon; title: string; items: Note[] }) {
  return (
    <Widget icon={icon} title={title} sub={`${items.length} note${items.length > 1 ? "s" : ""} récente${items.length > 1 ? "s" : ""}`}
      footer={
        // TODO : lien vers la vue complète des notes
        <button style={FOOT_LINK}>Voir toutes les notes</button>
      }>
      {items.length === 0 ? (
        <EmptyState dense icon={Inbox} title="Aucune note récente" hint="Les dernières notes apparaîtront ici." />
      ) : (
        <div className="slb-scrolly">
          {items.map((n) => <NoteRow key={n.id} n={n} />)}
        </div>
      )}
    </Widget>
  );
}

/* ============================================================================
   10. ARCHITECTURE DES WIDGETS — autonomie, registre, layout (fonctions pures)
   ----------------------------------------------------------------------------
   Chaque widget est AUTONOME : il embarque son propre hook de données et ses
   états (chargement / vide / erreur, scroll interne). La grille ne connaît que
   des ids ordonnés — elle instancie WIDGET_REGISTRY[id].Component SANS props.

   Les composants « …Card » ci-dessous sont les enveloppes autonomes : elles
   lisent la datasource (ou le mock) et rendent le composant présentiel du §9,
   INCHANGÉ visuellement. Ajouter un widget = 1 entrée de registre + 1 Card.
   ============================================================================ */

// Nb de lignes récentes affichées par widget liste (« Abonnés » ~1700 lignes).
const RECENT = 12;

/* --- Enveloppes autonomes (une par widget) ------------------------------------
   ⚠️ CONTRAINTE SOFTR : dans `useRecords({ from })`, `from` doit être DIRECTEMENT
   un membre de datasource.define (ex. DS.abonnes) — jamais une prop/variable
   dynamique, jamais un id non connecté (Softr valide statiquement le bloc). On
   appelle donc useRecords EN DIRECT, uniquement pour les sources connectées. Un
   widget dont la source n'est pas encore branchée N'APPELLE PAS useRecords : il
   rend une liste vide (l'état vide guidant). Mock ↔ live à un seul endroit. --- */
function NotifsCard() {
  const res = useRecords({ from: DS.abonnes, select: SELECT_ABONNE, orderBy: q.desc("creeLe") });
  const all = USE_MOCK ? MOCK.notifs : flatten(res).slice(0, RECENT).map(mapNotif);
  // « Marquer comme lue » = masquage LOCAL (la table « Abonnés » n'a pas de champ
  // « Lu », choix validé, README §4-D) → non persistant, réapparaît au rechargement.
  const [readIds, setReadIds] = useState<string[]>([]);
  const items = useMemo(() => all.filter((n) => !readIds.includes(n.id)), [all, readIds]);
  return (
    <NotifWidget
      items={items}
      onRead={(id) => setReadIds((r) => [...r, id])}
      onReadAll={() => setReadIds(all.map((n) => n.id))}
    />
  );
}

/* Tâches — sources « Taches » / « Taches prospect » PAS ENCORE connectées → listes
   vides en live (mock en aperçu). POUR CONNECTER : ajouter tachesPr/tachesPa comme
   membres du define (id réel via l'onglet Chat), puis, dans ce widget, lire chaque
   source par un appel direct au hook de lecture (from = le membre, select =
   SELECT_TACHE_PA / SELECT_TACHE_PR, tri croissant sur « fin »), filtrer les
   enregistrements non « Fait » et mapper via mapTask. */
function TachesCard() {
  const prospects = USE_MOCK ? MOCK.tachesProspects : [];
  const partenaires = USE_MOCK ? MOCK.tachesPartenaires : [];
  return <TasksWidget prospects={prospects} partenaires={partenaires} />;
}

/* Notes installateurs — source « Suivi client » PAS ENCORE connectée → vide en
   live. POUR CONNECTER : ajouter notesIns comme membre du define, puis dans ce
   widget lire la source par un appel direct au hook de lecture (from = le membre,
   select = SELECT_NOTE_INS, tri décroissant sur « date »), garder les RECENT
   premières et mapper via mapNote. */
function NotesInstallateursCard() {
  const items = USE_MOCK ? MOCK.notesInstallateurs : [];
  return <NotesWidget icon={HardHat} title="Dernières notes — Installateurs" items={items} />;
}

/* Notes prospects — source « Suivi propect » PAS ENCORE connectée → vide en live.
   POUR CONNECTER : ajouter notesPro à datasource.define puis lire EN DIRECT (cf.
   NotesInstallateursCard) avec SELECT_NOTE_PRO. */
function NotesProspectsCard() {
  const items = USE_MOCK ? MOCK.notesProspects : [];
  return <NotesWidget icon={Target} title="Dernières notes — Prospects" items={items} />;
}

/* --- Widgets LinkedIn (embeds Elfsight). platform.js est chargé UNE seule fois
      (nouveau domaine static.elfsight.com) ; il observe le DOM et monte chaque
      <div class="elfsight-app-…"> automatiquement, y compris après un remount
      (masquer/réafficher, réordonner). Aucune clé ni API exposée côté client.
      NB : un <script> écrit en JSX ne s'exécute pas → on l'ajoute au document. --- */
function useElfsightPlatform() {
  useEffect(() => {
    if (document.querySelector('script[src*="elfsight.com/platform"], script[src*="elfsightcdn.com/platform"]')) return;
    const s = document.createElement("script");
    s.src = "https://static.elfsight.com/platform/platform.js";
    s.async = true;
    document.body.appendChild(s);
  }, []);
}

function LinkedinCard() {
  useElfsightPlatform();
  return (
    <Widget icon={Newspaper} title="SunLib sur LinkedIn" sub="Dernières publications">
      {/* ▼ EMBED Elfsight — feed LinkedIn (rendu tel quel) ▼ */}
      <div style={{ padding: "10px 16px 16px" }}>
        <div className="elfsight-app-2df6db63-fd6e-498a-8a61-a97803d9d96f" data-elfsight-app-lazy="" />
      </div>
    </Widget>
  );
}

function LinkedinBannerCard() {
  useElfsightPlatform();
  return (
    <Widget icon={Megaphone} title="À la une LinkedIn" sub="Mise en avant SunLib">
      {/* ▼ EMBED Elfsight — bannière SunLib (rendu tel quel) ▼ */}
      <div style={{ padding: "10px 16px 16px" }}>
        <div className="elfsight-app-488a28ed-f4b6-4f5b-af44-c16613885c98" data-elfsight-app-lazy="" />
      </div>
    </Widget>
  );
}

/* --- Registre. Les IDS SONT UN CONTRAT DE PERSISTANCE : une fois livrés, ne
      JAMAIS les renommer (les layouts sauvegardés y font référence). `title` =
      libellé du menu « Personnaliser » (le titre affiché dans l'en-tête du
      widget vit dans le composant présentiel). --- */
type WidgetId =
  | "notifs" | "taches" | "notesInstallateurs" | "notesProspects"
  | "linkedin" | "linkedinBanner";

const WIDGET_REGISTRY: Record<WidgetId, { title: string; icon: LucideIcon; Component: FC }> = {
  notifs: { title: "Nouveaux dossiers Abonné", icon: Bell, Component: NotifsCard },
  taches: { title: "Journal des tâches", icon: CalendarClock, Component: TachesCard },
  notesInstallateurs: { title: "Dernières notes — Installateurs", icon: HardHat, Component: NotesInstallateursCard },
  notesProspects: { title: "Dernières notes — Prospects", icon: Target, Component: NotesProspectsCard },
  // Titres modifiables librement (les IDS, eux, sont figés : contrat de persistance).
  linkedin: { title: "SunLib sur LinkedIn", icon: Newspaper, Component: LinkedinCard },
  linkedinBanner: { title: "À la une LinkedIn", icon: Megaphone, Component: LinkedinBannerCard },
};

const REGISTRY_IDS = Object.keys(WIDGET_REGISTRY) as WidgetId[];

/* --- Modèle de disposition + fonctions PURES : SEULES à porter la logique de
      layout (aucune logique dans les handlers d'événements). --- */
// `wide` = widgets en PLEINE LARGEUR (span 2 col). `sizes` = hauteur par widget
// ("sm"|"md"|"lg" ; absent = "md"). Champs additifs rétro-compatibles : un layout
// sauvegardé sans wide/sizes → wide=[], sizes={} (cf. normalizeLayout).
type Layout = { v: 1; order: WidgetId[]; hidden: WidgetId[]; wide: WidgetId[]; sizes: Partial<Record<WidgetId, WidgetSize>> };

const DEFAULT_LAYOUT: Layout = {
  v: 1,
  order: ["notifs", "taches", "notesInstallateurs", "notesProspects", "linkedin", "linkedinBanner"],
  hidden: [],
  wide: [],
  sizes: {},
};

// Copie défensive : ne jamais renvoyer la constante partagée (mutation accidentelle).
const cloneDefault = (): Layout => ({
  v: 1,
  order: [...DEFAULT_LAYOUT.order],
  hidden: [...DEFAULT_LAYOUT.hidden],
  wide: [...DEFAULT_LAYOUT.wide],
  sizes: { ...DEFAULT_LAYOUT.sizes },
});

// Taille effective d'un widget (défaut "md" si non réglée).
const sizeOf = (layout: Layout, id: WidgetId): WidgetSize => layout.sizes[id] ?? "md";

/** Garde uniquement des WidgetId connus, dédupliqués (via `seen` partagé), en
 *  préservant l'ordre d'apparition. */
function keepKnown(list: unknown, valid: Set<string>, seen: Set<string>): WidgetId[] {
  const out: WidgetId[] = [];
  if (Array.isArray(list)) {
    for (const it of list) {
      if (typeof it === "string" && valid.has(it) && !seen.has(it)) {
        seen.add(it);
        out.push(it as WidgetId);
      }
    }
  }
  return out;
}

/**
 * Réconcilie un layout sauvegardé avec le registre courant. Fonction PURE.
 * · JSON invalide / non-objet / version inconnue → DEFAULT_LAYOUT
 * · ids inconnus → supprimés ; doublons → dédupliqués (`order` prioritaire sur `hidden`)
 * · ids du registre absents du layout → ajoutés en fin d'`order`, VISIBLES
 *   (un nouveau widget livré apparaît pour tout le monde).
 */
function normalizeLayout(saved: unknown, registryIds: WidgetId[]): Layout {
  let obj: any = saved;
  if (typeof saved === "string") {
    try { obj = JSON.parse(saved); } catch { return cloneDefault(); }
  }
  if (!obj || typeof obj !== "object" || obj.v !== 1) return cloneDefault();

  const valid = new Set<string>(registryIds);
  const seen = new Set<string>();
  const order = keepKnown(obj.order, valid, seen);
  const hidden = keepKnown(obj.hidden, valid, seen);
  for (const id of registryIds) {
    if (!seen.has(id)) { seen.add(id); order.push(id); }
  }
  // `wide` : ids valides, dédupliqués, ET visibles (présents dans order).
  const wideSeen = new Set<string>();
  const wide: WidgetId[] = [];
  if (Array.isArray(obj.wide)) {
    for (const it of obj.wide) {
      if (typeof it === "string" && valid.has(it) && order.includes(it as WidgetId) && !wideSeen.has(it)) {
        wideSeen.add(it);
        wide.push(it as WidgetId);
      }
    }
  }
  // `sizes` : ids connus → taille "sm"/"lg" seulement ("md" = défaut, non stocké).
  const sizes: Partial<Record<WidgetId, WidgetSize>> = {};
  if (obj.sizes && typeof obj.sizes === "object") {
    for (const id of [...order, ...hidden]) {
      const s = (obj.sizes as any)[id];
      if (s === "sm" || s === "lg") sizes[id] = s;
    }
  }
  return { v: 1, order, hidden, wide, sizes };
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

/** Monte (dir -1) ou descend (dir +1) un widget dans `order`. PURE. Bord → no-op. */
function moveWidget(layout: Layout, id: WidgetId, dir: -1 | 1): Layout {
  const from = layout.order.indexOf(id);
  if (from < 0) return layout;
  return { ...layout, order: reorder(layout.order, from, from + dir) };
}

/** Masque un widget : le retire d'`order` et de `wide`, l'ajoute à `hidden`. PURE.
 *  Sa taille reste dans `sizes` (réapparaît telle quelle via showWidget). */
function hideWidget(layout: Layout, id: WidgetId): Layout {
  if (!layout.order.includes(id)) return layout;
  return {
    ...layout,
    order: layout.order.filter((x) => x !== id),
    hidden: layout.hidden.includes(id) ? layout.hidden : [...layout.hidden, id],
    wide: layout.wide.filter((x) => x !== id), // un widget masqué ne peut pas rester « pleine largeur »
  };
}

/** Réaffiche un widget masqué : le retire de `hidden`, l'ajoute en fin d'`order`. PURE. */
function showWidget(layout: Layout, id: WidgetId): Layout {
  if (!layout.hidden.includes(id)) return layout;
  return {
    ...layout,
    order: layout.order.includes(id) ? layout.order : [...layout.order, id],
    hidden: layout.hidden.filter((x) => x !== id),
  };
}

/** Bascule la largeur d'un widget (pleine largeur ↔ moitié). PURE.
 *  Seul un widget VISIBLE (présent dans order) peut passer en pleine largeur. */
function setWidgetWide(layout: Layout, id: WidgetId, value: boolean): Layout {
  const isWide = layout.wide.includes(id);
  if (value === isWide) return layout;
  if (value && !layout.order.includes(id)) return layout;
  return { ...layout, wide: value ? [...layout.wide, id] : layout.wide.filter((x) => x !== id) };
}

/** Règle la HAUTEUR d'un widget visible. PURE. "md" = défaut → retiré de `sizes`
 *  pour garder l'objet minimal (rétro-compat). */
function setWidgetSize(layout: Layout, id: WidgetId, size: WidgetSize): Layout {
  if (!layout.order.includes(id)) return layout;
  if (sizeOf(layout, id) === size) return layout;
  const sizes = { ...layout.sizes };
  if (size === "md") delete sizes[id]; else sizes[id] = size;
  return { ...layout, sizes };
}

/* ============================================================================
   11. Tableau de bord — héro, persistance & grille (mode Personnaliser)
   ============================================================================ */
/* --- Compteurs du héro. Le héro n'est PAS un widget : il lit lui-même ce qu'il
   affiche (dossiers récents + tâches partenaires urgentes < 3 j). `abonnes` est
   lu EN DIRECT (source connectée) ; les tâches partenaires ne sont pas encore
   branchées → 0 urgente en live (valeur mock en aperçu). Écart mineur assumé :
   le masquage local « lu » d'un widget n'affecte pas ces compteurs. Quand la
   source des tâches partenaires sera connectée, la lire ici et calculer `urgent`
   à partir de ses enregistrements. --- */
function useHeroCounts() {
  const notifsRes = useRecords({ from: DS.abonnes, select: SELECT_ABONNE, orderBy: q.desc("creeLe") });
  const unread = USE_MOCK ? MOCK.notifs.length : flatten(notifsRes).slice(0, RECENT).length;
  const urgent = USE_MOCK ? MOCK.tachesPartenaires.filter((t) => relDays(t.fin) < 3).length : 0;
  return { unread, urgent };
}

/* --- PERSISTANCE DES PRÉFÉRENCES (Plan A : create + update par datasource) ----
   · LECTURE au montage : useRecords(prefs) filtré sur l'e-mail courant →
     normalizeLayout. Cache localStorage pour un affichage INSTANTANÉ + secours
     si la BDD est injoignable. La BDD reste la SOURCE DE VÉRITÉ : à réception,
     elle écrase le cache.
   · ÉCRITURE : uniquement à « Enregistrer » (pas à chaque drop). Pas de record
     → création ; sinon mise à jour. Optimiste. Conflits (2 onglets/postes) :
     last-write-wins, assumé (pas de merge).
   · Jamais d'appel direct à l'API Airtable ni de clé côté client.

   ⚠️ Signature Softr réelle à CONFIRMER (onglet Chat du bloc) : ce code suppose
   useRecordCreate({ from, fields }).mutateAsync({ fields }) → { id }, symétrique
   de useRecordUpdate. Si l'API diffère, seul l'intérieur de `persist` change.

   Tant que DS.prefs vaut "TODO-…", PREFS_ENABLED=false → cache local SEUL
   (l'aperçu fonctionne, la disposition se souvient par navigateur). Renseigner
   l'id réel de « Preferences » (tablespace Home-preferences) (§6) + connecter la table (onglet
   Sources) active la BDD. --- */
const PREFS_ENABLED = !DS.prefs.startsWith("TODO");
const layoutKey = (email: string) => `slb-home-layout:${email}`;

function readLocalLayout(email: string): Layout | null {
  if (!email) return null;
  try {
    const raw = window.localStorage.getItem(layoutKey(email));
    return raw ? normalizeLayout(raw, REGISTRY_IDS) : null;
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
      const next = normalizeLayout(bddLayoutStr, REGISTRY_IDS);
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
   *  Clés = alias de SELECT_PREFS (mappés vers les field IDs Softr Tables). Le layout
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
        await updateM.mutateAsync({ recordId: recordId.current, fields: { layout: layoutStr, updatedAt: stamp } });
      } else {
        const created: any = await createM.mutateAsync({ email, layout: layoutStr, updatedAt: stamp });
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

/* --- Grille du tableau de bord + mode Personnaliser (opt-in) -----------------
   Détient l'état de layout éditable (via usePersistentLayout). En usage normal,
   RIEN n'est déplaçable ni redimensionnable. « Personnaliser » bascule en
   édition : poignée de drag + DnD HTML5 natif (réordonner), poignées de bord
   (redimensionner en largeur, événements pointer souris+tactile) et menu ⋮
   (Monter / Descendre / Pleine largeur / Masquer — chemin clavier/tactile).
   « Enregistrer » persiste (§11) ; « Annuler » restaure le layout d'entrée ;
   « Réinitialiser » revient au défaut (confirmation inline, jamais
   window.confirm). Grille responsive via la classe .slb-dash ; un widget
   « pleine largeur » occupe gridColumn 1/-1. --- */
function Dashboard() {
  const { layout: applied, status, persist } = usePersistentLayout();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Layout>(() => cloneDefault());
  const [confirmReset, setConfirmReset] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; layout?: Layout; error?: string } | null>(null);

  const loading = status === "loading" && !applied;   // squelettes tant que rien à afficher
  const current = applied ?? cloneDefault();
  const shown = editing ? draft : current;
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
  const wrapRefs = useRef(new Map<WidgetId, HTMLElement>());
  const innerRefs = useRef(new Map<WidgetId, HTMLElement>());
  const flipPrev = useRef(new Map<WidgetId, DOMRect>());
  const flipSig = useRef("");
  useLayoutEffect(() => {
    const sig = `${shown.order.join(",")}|${shown.wide.join(",")}|${JSON.stringify(shown.sizes)}|${editing}|${loading}`;
    const changed = sig !== flipSig.current;
    flipSig.current = sig;
    const prev = flipPrev.current;
    const next = new Map<WidgetId, DOMRect>();
    wrapRefs.current.forEach((el, id) => next.set(id, el.getBoundingClientRect()));
    const reduce = typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (changed && !reduce) {
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

  const enterEdit = () => { setDraft(current); setConfirmReset(false); setEditing(true); };
  const cancel = () => { setEditing(false); setConfirmReset(false); resetDrag(); };
  const runSave = async (next: Layout) => {
    const res = await persist(next);                  // optimiste : le layout est déjà appliqué
    setToast(res.ok ? { ok: true, error: res.note } : { ok: false, layout: next, error: res.error });
  };
  const save = () => {
    const next = draft;
    setEditing(false); setConfirmReset(false); resetDrag();
    void runSave(next);
  };
  const doReset = () => { setDraft(cloneDefault()); setConfirmReset(false); };

  // Menu ⋮ (clavier/tactile) — mêmes fonctions pures que le DnD.
  const onMoveUp = (id: WidgetId) => setDraft((d) => moveWidget(d, id, -1));
  const onMoveDown = (id: WidgetId) => setDraft((d) => moveWidget(d, id, 1));
  const onHide = (id: WidgetId) => setDraft((d) => hideWidget(d, id));
  const onShow = (id: WidgetId) => setDraft((d) => showWidget(d, id));
  const onSetWide = (id: WidgetId, v: boolean) => setDraft((d) => setWidgetWide(d, id, v));
  const onSetSize = (id: WidgetId, s: WidgetSize) => setDraft((d) => setWidgetSize(d, id, s));

  // DnD HTML5 natif. Drop hors cible → no-op (seul onDragEnd nettoie l'état).
  const onDrop = (to: number) => {
    if (dragIndex !== null && dragIndex !== to) setDraft((d) => ({ ...d, order: reorder(d.order, dragIndex, to) }));
    resetDrag();
  };

  // Redimensionnement en largeur (poignées de bord) — événements POINTER (souris
  // + tactile), PAS de DnD HTML5. On tire vers l'extérieur → pleine largeur, vers
  // l'intérieur → normale (snap au seuil). side=+1 poignée droite, -1 gauche.
  const resizeRef = useRef<{ id: WidgetId; startX: number; side: 1 | -1 } | null>(null);
  const onResizeDown = (id: WidgetId, side: 1 | -1) => (e: ReactPointerEvent<HTMLElement>) => {
    e.stopPropagation(); e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    resizeRef.current = { id, startX: e.clientX, side };
  };
  const onResizeMove = (e: ReactPointerEvent<HTMLElement>) => {
    const r = resizeRef.current; if (!r) return;
    const outward = (e.clientX - r.startX) * r.side; // >0 = tiré vers l'extérieur (élargir)
    if (outward > 56) setDraft((d) => setWidgetWide(d, r.id, true));
    else if (outward < -56) setDraft((d) => setWidgetWide(d, r.id, false));
  };
  const onResizeUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (!resizeRef.current) return;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    resizeRef.current = null;
  };

  // Redimensionnement en HAUTEUR (poignée du bas) — pointer. Tirer vers le bas =
  // plus grand, vers le haut = plus petit (snap sm→md→lg ~ tous les 70px).
  const SIZE_STEPS: WidgetSize[] = ["sm", "md", "lg"];
  const sizeRef = useRef<{ id: WidgetId; startY: number; startIdx: number } | null>(null);
  const onSizeDown = (id: WidgetId) => (e: ReactPointerEvent<HTMLElement>) => {
    e.stopPropagation(); e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    sizeRef.current = { id, startY: e.clientY, startIdx: SIZE_STEPS.indexOf(draft.sizes[id] ?? "md") };
  };
  const onSizeMove = (e: ReactPointerEvent<HTMLElement>) => {
    const r = sizeRef.current; if (!r) return;
    const steps = Math.round((e.clientY - r.startY) / 70);
    const idx = Math.max(0, Math.min(SIZE_STEPS.length - 1, r.startIdx + steps));
    setDraft((d) => setWidgetSize(d, r.id, SIZE_STEPS[idx]));
  };
  const onSizeUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (!sizeRef.current) return;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    sizeRef.current = null;
  };

  const btn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 13px", borderRadius: T.rMd, fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${T.line}`, background: T.surface, color: T.ink2 };
  const btnPrimary: CSSProperties = { ...btn, border: "none", background: T.brand, color: "#fff" };

  return (
    <section aria-label="Tableau de bord" className="slb-dash-wrap">
      {/* En-tête de section : titre + bascule Personnaliser / barre d'actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
        <h2 style={{ ...H2, flex: 1, minWidth: 120 }}>Tableau de bord</h2>
        {loading ? null : !editing ? (
          <button className="slb-btng" style={btn} onClick={enterEdit}>
            <SlidersHorizontal aria-hidden style={{ width: 16, height: 16 }} />Personnaliser
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {!confirmReset ? (
              <button className="slb-btng" style={btn} onClick={() => setConfirmReset(true)}>
                <RotateCcw aria-hidden style={{ width: 15, height: 15 }} />Réinitialiser
              </button>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "4px 4px 4px 12px", borderRadius: T.rMd, background: T.danger050, border: `1px solid ${T.line}` }}>
                <span style={{ fontSize: "12.5px", fontWeight: 600, color: T.dangerInk }}>Tout réinitialiser ?</span>
                <button style={{ ...btn, padding: "6px 11px", border: "none", background: T.danger, color: "#fff" }} onClick={doReset}>Confirmer</button>
                <button className="slb-nbtn" style={NBTN_SM} onClick={() => setConfirmReset(false)} aria-label="Annuler la réinitialisation" title="Annuler">
                  <X aria-hidden style={{ width: 15, height: 15 }} />
                </button>
              </span>
            )}
            <button className="slb-btng" style={btn} onClick={cancel}>Annuler</button>
            <button className="slb-btnp" style={btnPrimary} onClick={save}>
              <Save aria-hidden style={{ width: 15, height: 15 }} />Enregistrer
            </button>
          </div>
        )}
      </div>

      {editing && (
        <p style={{ margin: "-4px 0 14px", fontSize: "12.5px", fontWeight: 500, color: T.ink3 }}>
          Glissez les cartes pour réordonner ; poignées latérales = largeur (moitié / pleine), poignée du bas = hauteur ; ou tout régler via le menu ⋮ (Largeur, Taille, Masquer).
        </p>
      )}

      {loading ? (
        <div className="slb-dash" aria-busy="true" aria-label="Chargement de votre disposition">
          {[0, 1, 2, 3].map((k) => <SkeletonCard key={k} />)}
        </div>
      ) : shown.order.length === 0 ? (
        <Card style={CARD}>
          <EmptyState icon={LayoutGrid} title="Aucun widget affiché"
            hint={editing ? "Réaffichez des widgets depuis « Widgets masqués » ci-dessous." : "Tous vos widgets sont masqués. Ouvrez « Personnaliser » pour en réafficher."} />
          {!editing && (
            <div style={{ display: "flex", justifyContent: "center", paddingBottom: "22px" }}>
              <button className="slb-btnp" style={btnPrimary} onClick={enterEdit}>
                <SlidersHorizontal aria-hidden style={{ width: 16, height: 16 }} />Personnaliser
              </button>
            </div>
          )}
        </Card>
      ) : (
        <div className="slb-dash">
          {shown.order.map((id, i) => {
            const { Component } = WIDGET_REGISTRY[id];
            const isSource = editing && dragIndex === i;
            const isTarget = editing && overIndex === i && dragIndex !== null && dragIndex !== i;
            const wide = shown.wide.includes(id);
            const size = sizeOf(shown, id);
            return (
              <div key={id} className="slb-dragwrap"
                ref={(el) => { if (el) wrapRefs.current.set(id, el); else wrapRefs.current.delete(id); }}
                draggable={editing}
                onDragStart={editing ? (e) => { if (resizeRef.current || sizeRef.current) { e.preventDefault(); return; } setDragIndex(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); } : undefined}
                onDragEnd={editing ? resetDrag : undefined}
                onDragOver={editing ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (overIndex !== i) setOverIndex(i); } : undefined}
                onDragLeave={editing ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverIndex((p) => (p === i ? null : p)); } : undefined}
                onDrop={editing ? (e) => { e.preventDefault(); onDrop(i); } : undefined}
                style={{ ["--slb-wh" as any]: `${WIDGET_HEIGHTS[size]}px`, position: editing ? "relative" : undefined, gridColumn: wide ? "1 / -1" : undefined, borderRadius: T.rXl, opacity: isSource ? 0.5 : 1, outline: isTarget ? `2px dashed ${T.brand}` : "2px dashed transparent", outlineOffset: 3, boxShadow: isTarget ? `0 0 0 5px ${T.brand050}` : undefined }}>
                <div ref={(el) => { if (el) innerRefs.current.set(id, el); else innerRefs.current.delete(id); }} style={{ borderRadius: T.rXl }}>
                  <WidgetChromeCtx.Provider value={editing ? { index: i, total: shown.order.length, isWide: wide, size, onMoveUp: () => onMoveUp(id), onMoveDown: () => onMoveDown(id), onSetWide: (v) => onSetWide(id, v), onSetSize: (s) => onSetSize(id, s), onHide: () => onHide(id) } : null}>
                    <Component />
                  </WidgetChromeCtx.Provider>
                </div>
                {editing && ([-1, 1] as const).map((side) => (
                  <span key={side} className="slb-rzh" aria-hidden
                    onPointerDown={onResizeDown(id, side)} onPointerMove={onResizeMove} onPointerUp={onResizeUp} onPointerCancel={onResizeUp}
                    title={wide ? "Réduire la largeur" : "Élargir sur toute la largeur"}
                    style={{ position: "absolute", top: 46, bottom: 10, [side === 1 ? "right" : "left"]: -3, width: 14, display: "grid", placeItems: "center", cursor: "ew-resize", touchAction: "none", zIndex: 5 }}>
                    <span style={{ width: 4, height: 34, borderRadius: 999, background: T.line2 }} />
                  </span>
                ))}
                {editing && (
                  <span className="slb-rzv" aria-hidden
                    onPointerDown={onSizeDown(id)} onPointerMove={onSizeMove} onPointerUp={onSizeUp} onPointerCancel={onSizeUp}
                    title="Glisser pour régler la hauteur (petit / moyen / grand)"
                    style={{ position: "absolute", left: 24, right: 24, bottom: -3, height: 14, display: "grid", placeItems: "center", cursor: "ns-resize", touchAction: "none", zIndex: 5 }}>
                    <span style={{ height: 4, width: 34, borderRadius: 999, background: T.line2 }} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Panneau « Widgets masqués » — visible seulement en édition */}
      {editing && (
        <Card style={{ ...CARD, marginTop: "18px", padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: shown.hidden.length ? "12px" : 0 }}>
            <EyeOff aria-hidden style={{ width: 15, height: 15, color: T.ink3 }} />
            <span style={{ fontSize: "13px", fontWeight: 700, color: T.ink }}>Widgets masqués</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: T.ink4 }}>{shown.hidden.length}</span>
          </div>
          {shown.hidden.length === 0 ? (
            <p style={{ margin: 0, fontSize: "12.5px", fontWeight: 500, color: T.ink4 }}>Aucun widget masqué — tous vos widgets sont affichés.</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {shown.hidden.map((id) => {
                const { title, icon: Icon } = WIDGET_REGISTRY[id];
                return (
                  <div key={id} style={{ display: "inline-flex", alignItems: "center", gap: "10px", padding: "7px 8px 7px 12px", borderRadius: T.rMd, border: `1px solid ${T.line}`, background: T.surface2 }}>
                    <Icon aria-hidden style={{ width: 15, height: 15, color: T.ink3 }} />
                    <span style={{ fontSize: "12.5px", fontWeight: 600, color: T.ink2 }}>{title}</span>
                    <button className="slb-btng" style={{ ...btn, padding: "5px 10px", fontSize: "12px" }} onClick={() => onShow(id)} aria-label={`Afficher — ${title}`}>
                      <Eye aria-hidden style={{ width: 14, height: 14 }} />Afficher
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
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
  const firstName = USE_MOCK ? MOCK.user.firstName : firstNameOf(user);
  const { unread, urgent } = useHeroCounts();
  const [tab, setTab] = useState<string>("accueil");
  const active = NAV_TABS.find((t) => t.id === tab) ?? NAV_TABS[0];

  return (
    <div id="slb" style={{ backgroundColor: T.canvas, minHeight: "100vh", fontFamily: T.font, color: T.ink }}>
      <StyleInjector />
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "24px 20px 56px", display: "flex", flexDirection: "column", gap: "30px" }}>

        <Hero firstName={firstName} unread={unread} urgent={urgent} />

        <PageNavBar tabs={NAV_TABS} activeId={active.id} onSelect={setTab} />

        {active.embed ? (
          // Onglet app externe (Formulaire de contact / Simulateur Grille) — iframe.
          <EmbedTab src={active.embed} title={active.label} />
        ) : (
          // Onglet Accueil — outils + tableau de bord à widgets.
          <>
            <QuickLinks />
            {/* Tableau de bord : widgets indépendants (dont les 2 feeds LinkedIn)
                + mode Personnaliser (opt-in) */}
            <Dashboard />
          </>
        )}

      </div>
    </div>
  );
}
