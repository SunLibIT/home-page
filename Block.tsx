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
  Children,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FC,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  UserPlus, Handshake, BookUser, Users, Library, BarChart3, Copy, Trash2,
  FileSignature, Calculator, LayoutGrid, Briefcase, Ticket, Mail,
  ChevronRight, Bell,
  CheckCheck, Check, CheckCircle, Clock, XCircle, ClipboardList, Building2,
  Inbox, CalendarClock, HardHat, Target, MoreVertical, Plus, Eye, Home,
  SlidersHorizontal, GripVertical, ChevronUp, ChevronDown, EyeOff, RotateCcw,
  Save, X, Newspaper, Megaphone, Sparkles,
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

      /* Mode Personnaliser : bouton primaire, items de menu ⋮, poignée, wrapper DnD */
      .slb-btnp{ transition:background .15s ease; }
      .slb-btnp:hover{ background:${T.brand600}; }
      .slb-menu-item{ transition:background .12s ease; }
      .slb-menu-item:hover:not(:disabled){ background:${T.surface2}; }
      .slb-menu-item:disabled{ opacity:.45; cursor:not-allowed; }
      .slb-grip{ cursor:grab; }
      .slb-grip:active{ cursor:grabbing; }
      .slb-dragwrap{ transition:opacity .15s ease, outline-color .15s ease; }
      /* ⚠️ La GRILLE du dashboard n'est plus décrite ici : display:grid, gap et le
         nombre de colonnes sont posés EN LIGNE par Dashboard (§11), qui mesure la
         largeur du bloc avec un ResizeObserver. Raison : dans le bloc Softr, cette
         feuille de style peut ne pas s'appliquer (cf. §2) — et sans display:grid,
         les widgets se collent et « pleine largeur » n'a plus aucun effet. Tout ce
         qui est FONCTIONNEL doit donc rester en style inline. */
      /* Poignées (mode Personnaliser) : .slb-rzh = largeur (bords G/D), .slb-rzv = hauteur (bas) */
      .slb-rzh > span{ transition:background .15s ease, height .15s ease; }
      .slb-rzh:hover > span, .slb-rzh:active > span{ background:${T.brand}; height:48px; }
      .slb-rzv > span{ transition:background .15s ease, width .15s ease; }
      .slb-rzv:hover > span, .slb-rzv:active > span{ background:${T.brand}; width:48px; }
      @keyframes slb-skel{ 0%{opacity:.55} 50%{opacity:1} 100%{opacity:.55} }
      .slb-skel{ animation:slb-skel 1.3s ease-in-out infinite; }

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
  // ✅ Persistance du layout (§11) — table AIRTABLE (migrée depuis Softr Tables le
  //    2026-07-31) : base « SunLib CRM — Préférences » (appHZaD5BkDsWxR65) · table
  //    « Home Preferences » (tbl18J0zC47myPJLO).
  prefs: "dcc7928c-3906-4807-8224-0532c3e30fc5",
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
  layout: "layout_json",         // document v2 {v,items,hidden,parked,seeded} sérialisé (Plan A)
  updatedAt: "updated_at",       // DATETIME (chaîne ISO)
  schemaVersion: "schema_version", // Number — recopie de LAYOUT_VERSION (diagnostic du parc)
});

// Modèles de vue — mêmes formes pour le mock et le mapping Airtable.
type Notif = { id: string; nom: string; societe?: string; partenaire: string; statut: string; offre: string; creeLe: string };
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

const mapNotif = (r: Row): Notif => ({
  id: r.id,
  nom: [asText(r.prenom), asText(r.nom)].filter(Boolean).join(" "),
  societe: asText(r.partenaire), // repli d'affichage si nom/prénom absents
  partenaire: asText(r.partenaire),
  statut: asText(r.statut),
  offre: asText(r.offre),
  creeLe: asText(r.creeLe),
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

// Une tâche « Fait » (checkbox Airtable) ne doit pas rester au journal.
const isDone = (r: Row): boolean => isTruthy(r.fait);

/* --- Données mock d'aperçu (identiques au prototype validé) --- */
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };
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
  abonnes: [
    { id: "n1", prenom: "Nicolas", nom: "Laborderie", partenaire: "Mandat Energie", statut: "Dossier incomplet pour instruction", offre: "PV + Batterie", creeLe: daysAgo(1) },
    { id: "n2", prenom: "", nom: "Commune de Payssous", partenaire: "FLG SOLAR", statut: "Dossier incomplet pour instruction", offre: "PV seul", creeLe: daysAgo(2) },
    { id: "n3", prenom: "", nom: "Toulose Transit", partenaire: "Neosoleil", statut: "Dossier complet pour instruction", offre: "PV seul", creeLe: daysAgo(2) },
    { id: "n4", prenom: "Salvatore", nom: "Vizzini", partenaire: "MC ENERGY", statut: "Contrat envoyé et en attente signature", offre: "PV + Batterie Virtuelle", creeLe: daysAgo(15) },
    { id: "n5", prenom: "Jocelyne", nom: "Guintrand", partenaire: "MC ENERGY", statut: "Contrat signé", offre: "Batterie seule (sur une installation SunLib)", creeLe: daysAgo(15) },
    { id: "n6", prenom: "Julian", nom: "Maillo Moreno", partenaire: "MC ENERGY", statut: "Contrat signé", offre: "Extension PV", creeLe: daysAgo(15) },
  ],

  // ← SELECT_TACHE_PR / SELECT_TACHE_PA : desc / associe / fin / fait
  tachesPr: [],
  tachesPa: [
    { id: "t1", desc: "Relancer pour les pièces du dossier RGE", associe: "MC ENERGY", fin: inDays(-2), fait: false },
    { id: "t2", desc: "Envoyer la grille tarifaire 2026", associe: "FLG SOLAR", fin: inDays(1), fait: false },
    { id: "t3", desc: "Point mensuel pipeline", associe: "Neosoleil", fin: inDays(6), fait: false },
    { id: "t4", desc: "Préparer la formation financement", associe: "Mandat Energie", fin: inDays(21), fait: false },
  ],

  // ← SELECT_NOTE_INS / SELECT_NOTE_PRO : nom / note / date
  notesIns: [
    { id: "i1", nom: "WattElse Energies SAS", date: "2025-05-19", note: "Contact via LinkedIn, en attente de retour sur la présentation." },
    { id: "i2", nom: "3J Environnement", date: "2025-11-25", note: "Dossier admin à jour, RGE renouvelé." },
    { id: "i3", nom: "Louiseco", date: "2025-08-26", note: "26/08 → présentation faite, très intéressés par l'offre Duo." },
    { id: "i4", nom: "KE Energies", date: "2024-09-16", note: "Introduit par Hanna, premier échange positif." },
    { id: "i5", nom: "Aura Sun", date: "2025-11-17", note: "Vu Solar and Storage, à recontacter début décembre." },
    { id: "i6", nom: "renov&sun VIP Montpellier", date: "2025-11-24", note: "RGE et décennale reçus, dossier complet." },
    { id: "i7", nom: "Gaïa l'Énergie de Demain", date: "2025-05-16", note: "Nouvel email pour la mise en relation avec le pôle études." },
  ],
  notesPro: [
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
type SourceKey = "abonnes" | "notesIns" | "notesPro" | "tachesPa" | "tachesPr";

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
type PresetDesc = { label: string; icon?: string; h?: WidgetSize; cfg: Record<string, unknown> };

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
    },
    defaultSort: { by: "creeLe", dir: "desc" },
    defaultMap: { title: "nom", sub: "partenaire", date: "creeLe", badge: "statut" },
    /* Modèles prêts à poser — pur JSON. C'est ici qu'on ajoute une vue métier utile
       sans écrire de composant : elle apparaît aussitôt dans la galerie. */
    presets: [
      { label: "Derniers dossiers Abonné", cfg: {} },
      { label: "Dossiers incomplets", icon: "ClipboardList",
        cfg: { title: "Dossiers incomplets",
               query: { filter: [{ field: "statut", op: "contains", value: "incomplet" }] } } },
      { label: "Dossiers du mois (indicateur)", icon: "BarChart3", h: "sm",
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
    connected: false,   // ⚠️ passer à true UNIQUEMENT avec l'id dans DS + un adapter
    fields: {
      nom: { label: "Installateur", kind: "text" },
      note: { label: "Note", kind: "longtext" },
      date: { label: "Date", kind: "date" },
    },
    defaultSort: { by: "date", dir: "desc" },
    defaultMap: { title: "nom", sub: "note", date: "date" },
    presets: [{ label: "Dernières notes — Installateurs", cfg: { title: "Dernières notes — Installateurs", unit: "note" } }],
    create: { label: "Nouvelle note installateur",
              fields: [{ field: "nom", required: true }, { field: "note", required: true }, { field: "date" }] },
  },
  notesPro: {
    key: "notesPro",
    label: "Notes prospects — Suivi propect",
    icon: "Target",
    connected: false,
    fields: {
      nom: { label: "Prospect", kind: "text" },
      note: { label: "Note", kind: "longtext" },
      date: { label: "Date", kind: "date" },
    },
    defaultSort: { by: "date", dir: "desc" },
    defaultMap: { title: "nom", sub: "note", date: "date" },
    presets: [{ label: "Dernières notes — Prospects", cfg: { title: "Dernières notes — Prospects", unit: "note" } }],
    // `date` est un createdTime : absent du formulaire comme du select d'écriture.
    create: { label: "Nouvelle note prospect",
              fields: [{ field: "nom", required: true }, { field: "note", required: true }] },
  },
  tachesPa: {
    key: "tachesPa",
    label: "Tâches partenaires — Taches",
    icon: "CalendarClock",
    connected: false,
    fields: {
      desc: { label: "Description", kind: "text" },
      associe: { label: "Partenaire associé", kind: "text" },
      fin: { label: "Date de fin", kind: "date" },
      fait: { label: "Fait", kind: "bool" },
    },
    defaultSort: { by: "fin", dir: "asc" },
    defaultMap: { title: "desc", sub: "associe", date: "fin" },
    presets: [
      { label: "Tâches partenaires à faire", cfg: { title: "Tâches partenaires", unit: "tâche",
        query: { filter: [{ field: "fait", op: "neq", value: "true" }] },
        actions: { use: ["fait"] } } },
      { label: "Tâches en retard", icon: "CalendarClock", cfg: { title: "Tâches en retard", unit: "tâche",
        query: { filter: [{ field: "fait", op: "neq", value: "true" }] },
        actions: { use: ["fait"] } } },
    ],
    // Première écriture réelle prévue : cocher « Fait » depuis l'accueil (§9-ter).
    actions: [{ id: "fait", label: "Fait", kind: "toggle", field: "fait" }],
    create: { label: "Nouvelle tâche partenaire",
              fields: [{ field: "desc", required: true }, { field: "associe" }, { field: "fin" }] },
  },
  tachesPr: {
    key: "tachesPr",
    label: "Tâches prospects — Taches prospect",
    icon: "ClipboardList",
    connected: false,
    fields: {
      desc: { label: "Description", kind: "text" },
      associe: { label: "Prospect associé", kind: "text" },
      fin: { label: "Date de fin", kind: "date" },
      fait: { label: "Fait", kind: "bool" },
    },
    defaultSort: { by: "fin", dir: "asc" },
    defaultMap: { title: "desc", sub: "associe", date: "fin" },
    presets: [
      { label: "Tâches prospects à faire", cfg: { title: "Tâches prospects", unit: "tâche",
        query: { filter: [{ field: "fait", op: "neq", value: "true" }] },
        actions: { use: ["fait"] } } },
    ],
    actions: [{ id: "fait", label: "Fait", kind: "toggle", field: "fait" }],
    create: { label: "Nouvelle tâche prospect",
              fields: [{ field: "desc", required: true }, { field: "associe" }, { field: "fin" }] },
  },
};

/* Résolution des icônes : le descripteur porte une CLÉ (donnée), la map porte le
   composant (code). Aucun import dynamique n'est possible dans le bloc, d'où cette
   table — c'est l'illustration du principe « clés en JSON, implémentations en code ».
   Une clé inconnue retombe sur une icône neutre plutôt que de casser le rendu. */
const ICONS: Record<string, LucideIcon> = {
  Bell, CalendarClock, ClipboardList, HardHat, Target, Users, Inbox,
  LayoutGrid, BarChart3, Newspaper, Megaphone, Sparkles, Building2, Briefcase, Ticket,
};
const iconOf = (key: string): LucideIcon => ICONS[key] ?? LayoutGrid;

/** Couleur de badge d'une valeur métier : `variants` du descripteur d'abord,
 *  heuristique `statusVariant` (§3) en repli. PURE. */
const variantOf = (desc: SourceDesc, alias: string | undefined, value: string): BadgeVariant =>
  (alias ? desc.fields[alias]?.variants?.[value] : undefined) ?? statusVariant(value);

type SourceState = { rows: Row[]; loading: boolean; error: boolean };

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
function AbonnesSource({ children }: { children: SourceChildren }) {
  const res = useRecords({ from: DS.abonnes, select: SELECT_ABONNE, orderBy: q.desc("creeLe") });
  // Pas de `write` : « Abonnés » n'a pas de select d'écriture (choix, §6).
  return <>{children(liveState(res))}</>;
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
   3) copier AbonnesSource en changeant `from`/`select`/`orderBy` — et, si la source
      est écrivable, y monter update/create avec son `SELECT_*_W` (§6) ;
   4) ajouter son `case` ci-dessous ; 5) passer `connected: true` dans CATALOG.

   Exemple prêt à décommenter le jour du branchement des tâches partenaires :

     function TachesPaSource({ children }: { children: SourceChildren }) {
       const res  = useRecords({ from: DS.tachesPa, select: SELECT_TACHE_PA, orderBy: q.asc("fin") });
       const updM = useRecordUpdate({ from: DS.tachesPa, fields: SELECT_TACHE_PA_W });
       const crtM = useRecordCreate({ from: DS.tachesPa, fields: SELECT_TACHE_PA_W });
       const email = asText(useCurrentUser()?.email).trim();
       const write = email ? {
         update: (recordId: string, fields: Record<string, unknown>) => updM.mutateAsync({ recordId, fields }),
         create: (values: Record<string, unknown>) => crtM.mutateAsync(values),
       } : undefined;                       // pas de session → aucune tentative
       return <>{children({ ...liveState(res), write })}</>;
     } */
function SourceFeed({ source, children }: { source: SourceKey; children: SourceChildren }) {
  if (!isLive(source)) return <OfflineSource source={source}>{children}</OfflineSource>;
  switch (source) {
    case "abonnes": return <AbonnesSource>{children}</AbonnesSource>;
    // case "tachesPa": return <TachesPaSource>{children}</TachesPaSource>;
    default: return <OfflineSource source={source}>{children}</OfflineSource>;
  }
}

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

/* --- Corps scrollable d'un widget. La hauteur max vient du contexte (le Dashboard
   la connaît : c'est `instance.h`), et elle est posée EN LIGNE — l'ancienne
   variable CSS `--slb-wh` lue par une règle injectée ne s'appliquait pas dans le
   bloc Softr, et les widgets s'étiraient alors sans jamais scroller. La classe
   `slb-scrolly` reste, mais seulement pour l'habillage de la scrollbar. --- */
const WidgetHeightCtx = createContext<number>(WIDGET_HEIGHTS.md);

function ScrollBody({ children }: { children?: ReactNode }) {
  const maxHeight = useContext(WidgetHeightCtx);
  return (
    <div className="slb-scrolly" style={{ overflowY: "auto", maxHeight, scrollbarWidth: "thin", scrollbarColor: `${T.line2} transparent` }}>
      {/* Le filet de séparation entre lignes était une règle injectée
          (`.slb-row + .slb-row`) : il est posé ici, en ligne, autour de chaque
          enfant — un seul endroit pour toutes les listes du bloc. */}
      {Children.map(children, (child, i) => (
        <div style={i > 0 ? { borderTop: `1px solid ${T.line}` } : undefined}>{child}</div>
      ))}
    </div>
  );
}

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
  onDuplicate: () => void;
  onRemove: () => void;
};
const WidgetChromeCtx = createContext<WidgetChrome | null>(null);

/* --- Contexte d'OPTIONS (mode normal) : le Dashboard injecte, par instance, sa
      configuration courante, le formulaire du type et le callback de sauvegarde.
      `null` = ce widget n'est pas configurable → le bouton ⋮ reste inerte.
      `any` assumé : chaque type définit SA forme de cfg et son propre formulaire ;
      le contexte est volontairement agnostique. --- */
type WidgetOptions = {
  cfg: any;
  Form: FC<{ cfg: any; onChange: (next: any) => void }>;
  onSave: (next: any) => void;
};
const WidgetOptionsCtx = createContext<WidgetOptions | null>(null);

/* --- Menu ⋮ du mode normal : ouvre le formulaire d'options du widget. Édition
      LOCALE (brouillon) jusqu'à « Enregistrer » — même règle que la grille : on
      n'écrit jamais en base à chaque frappe. Fermeture Échap / clic extérieur. --- */
function WidgetOptionsMenu({ opts, title }: { opts: WidgetOptions; title: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<any>(opts.cfg);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const start = () => { setDraft(opts.cfg); setOpen(true); };   // brouillon toujours frais à l'ouverture
  const save = () => { opts.onSave(draft); setOpen(false); };
  const btn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: T.rSm, fontSize: "12.5px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${T.line}`, background: T.surface, color: T.ink2 };
  const Form = opts.Form;
  return (
    <div ref={ref} style={{ position: "relative", flex: "none" }}>
      <button className="slb-nbtn" style={NBTN_SM} aria-haspopup="dialog" aria-expanded={open}
        onClick={() => (open ? setOpen(false) : start())} aria-label={`Options — ${title}`} title="Options">
        <MoreVertical aria-hidden style={{ width: 15, height: 15 }} />
      </button>
      {open && (
        <div role="dialog" aria-label={`Options — ${title}`}
          style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 30, width: 292, maxHeight: "min(70vh, 460px)", overflowY: "auto", padding: "12px", backgroundColor: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rMd, boxShadow: T.shMd, animation: "slb-fade .12s ease both" }}>
          <Form cfg={draft} onChange={setDraft} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px", paddingTop: "10px", borderTop: `1px solid ${T.line}` }}>
            <button className="slb-btng" style={btn} onClick={() => setOpen(false)}>Annuler</button>
            <button className="slb-btnp" style={{ ...btn, border: "none", background: T.brand, color: "#fff" }} onClick={save}>
              <Save aria-hidden style={{ width: 14, height: 14 }} />Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
          <button role="menuitem" className="slb-menu-item" style={item} onClick={run(chrome.onDuplicate)} aria-label={`Dupliquer — ${title}`}>
            <Copy aria-hidden style={{ width: 16, height: 16 }} />Dupliquer
          </button>
          <button role="menuitem" className="slb-menu-item" style={item} onClick={run(chrome.onHide)} aria-label={`Masquer — ${title}`}>
            <EyeOff aria-hidden style={{ width: 16, height: 16 }} />Masquer
          </button>
          {/* Suppression définitive — réversible tant que « Annuler » n'a pas été
              quitté : rien n'est écrit en base avant « Enregistrer ». */}
          <button role="menuitem" className="slb-menu-item" style={{ ...item, color: T.dangerInk }} onClick={run(chrome.onRemove)} aria-label={`Supprimer — ${title}`}>
            <Trash2 aria-hidden style={{ width: 16, height: 16 }} />Supprimer
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
  const opts = useContext(WidgetOptionsCtx);
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
            {/* ⋮ affiché SEULEMENT si le type expose des options : plus de bouton
                décoratif sans action (c'était le TODO de la v1). */}
            {opts && <WidgetOptionsMenu opts={opts} title={title} />}
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

function Hero({ firstName, unread, urgent }: { firstName: string; unread: number; urgent: number }) {
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
        <ScrollBody>
          {items.map((n) => <NotifRow key={n.id} n={n} onRead={onRead} />)}
        </ScrollBody>
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
          <ScrollBody>
            {rows.map((t) => <TaskRow key={t.id} t={t} />)}
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

  return {
    title: asText(o.title ?? base.title),
    unit: asText(o.unit || base.unit) || "élément",
    source,
    query: { filter, sort: { by: sortBy, dir: sortDir }, limit },
    view,
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

/** Lignes retenues par les filtres (ET), sans tri ni limite — base des agrégats. */
function selectRows(rows: Row[], cfg: InstanceCfg): Row[] {
  const fs = cfg.query.filter;
  return fs.length ? rows.filter((r) => fs.every((f) => matchFilter(r[f.field], f))) : rows;
}

/** Filtres + tri + limite : ce qu'une vue liste ou tableau affiche. PURE. */
function applyQuery(rows: Row[], cfg: InstanceCfg): Row[] {
  let out = selectRows(rows, cfg);
  const alias = cfg.query.sort.by;
  if (alias) {
    const kind = CATALOG[cfg.source].fields[alias]?.kind;
    out = [...out].sort((a, b) => compareRows(a, b, alias, kind, cfg.query.sort.dir));
  }
  return out.slice(0, Math.max(1, Math.min(LIST_LIMIT_MAX, cfg.query.limit)));
}

/** Agrégat d'un KPI + écart avec la fenêtre précédente (`null` si non calculable).
 *  ⚠️ Porte sur les lignes CHARGÉES par la source, pas sur le total serveur. PURE. */
function kpiCompute(rows: Row[], cfg: InstanceCfg): { value: number; delta: number | null } {
  if (cfg.view.kind !== "kpi") return { value: 0, delta: null };
  const v = cfg.view;
  const base = selectRows(rows, cfg);
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

/** Valeur d'un champ formatée selon son `kind` (partagée liste / tableau). */
function FieldValue({ row, alias, desc }: { row: Row; alias: string; desc: SourceDesc }) {
  const f = desc.fields[alias];
  const raw = row[alias];
  const text = asText(raw);
  if (!f) return <>{text || DASH}</>;
  if (f.kind === "bool") {
    const on = raw === true || text.toLowerCase() === "true";
    return on
      ? <Check aria-label="oui" style={{ width: 15, height: 15, color: T.okInk }} />
      : <span style={{ color: T.ink4 }}>{DASH}</span>;
  }
  if (!text) return <span style={{ color: T.ink4 }}>{DASH}</span>;
  if (f.kind === "badge") return <Badge variant={variantOf(desc, alias, text)}>{text}</Badge>;
  if (f.kind === "date") return <span title={fmtDate(text)}>{fmtSmart(text)}</span>;
  if (f.kind === "url") return <a href={text} target="_blank" rel="noopener noreferrer" style={{ color: T.brand700, fontWeight: 600 }}>Ouvrir</a>;
  if (f.kind === "number") return <>{text}</>;
  return <>{text}</>;
}

/* Ligne de liste — gabarit historique `NoteRow` : pastille d'initiales, titre et
   date alignés, détail clampé sur 2 lignes, badge coloré par le descripteur. */
function GenericRow({ row, map, desc, actions, api }: {
  row: Row; map: FieldRoleMap; desc: SourceDesc; actions: ActionDesc[]; api: SourceApi;
}) {
  const title = map.title ? asText(row[map.title]) : "";
  const sub = map.sub ? asText(row[map.sub]) : "";
  const dateVal = map.date ? asText(row[map.date]) : "";
  const badge = map.badge ? asText(row[map.badge]) : "";
  const dateIsDate = map.date ? desc.fields[map.date]?.kind === "date" : false;
  const label = title || DASH;
  return (
    <div className="slb-row" style={{ display: "flex", alignItems: "flex-start", gap: "11px", padding: "10px 16px" }}>
      <span aria-hidden style={{ width: 30, height: 30, borderRadius: "8px", flex: "none", display: "grid", placeItems: "center", color: "#fff", fontSize: "11px", fontWeight: 700, background: avatarBg(label) }}>
        {initials(label)}
      </span>
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
      {actions.length > 0 && <RowActions actions={actions} row={row} api={api} />}
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

function GenericList({ rows, cfg, desc, api }: { rows: Row[]; cfg: InstanceCfg; desc: SourceDesc; api: SourceApi }) {
  if (api.error) return <ViewError />;
  if (api.loading) return <ListSkeleton />;
  if (!rows.length) return <EmptyState dense icon={Inbox} title={`Aucun ${cfg.unit}`} hint="Aucune ligne ne correspond à ce réglage." />;
  const map = cfg.view.kind === "list" ? cfg.view.map : {};
  const actions = activeActions(cfg, desc);
  return (
    <ScrollBody>
      {rows.map((r) => <GenericRow key={r.id} row={r} map={map} desc={desc} actions={actions} api={api} />)}
    </ScrollBody>
  );
}

/* Tableau — colonnes déclarées dans la cfg. Mise en page en `table` HTML avec
   styles inline ; l'en-tête reste visible (`position: sticky`). */
function GenericTable({ rows, cfg, desc, api }: { rows: Row[]; cfg: InstanceCfg; desc: SourceDesc; api: SourceApi }) {
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
          <tr>
            {cols.map((a) => <th key={a} style={th}>{desc.fields[a]?.label ?? a}</th>)}
            {actions.length > 0 && <th style={{ ...th, textAlign: "right" }} aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="slb-row">
              {cols.map((a) => <td key={a} style={td}><FieldValue row={r} alias={a} desc={desc} /></td>)}
              {actions.length > 0 && (
                <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
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
function GenericKpi({ rows, cfg, desc, api }: { rows: Row[]; cfg: InstanceCfg; desc: SourceDesc; api: SourceApi }) {
  const v = cfg.view.kind === "kpi" ? cfg.view : null;
  const { value, delta } = kpiCompute(rows, cfg);
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
  return (
    <SourceFeed source={cfg.source} key={cfg.source}>
      {(api) => {
        const isKpi = cfg.view.kind === "kpi";
        const rows = isKpi ? api.rows : applyQuery(api.rows, cfg);
        const sub = api.loading ? "Chargement…"
          : isKpi ? (cfg.view.kind === "kpi" && cfg.view.compareDays ? `sur ${cfg.view.compareDays} j` : desc.label)
          : plural(rows.length, cfg.unit);
        const V = cfg.view.kind === "table" ? GenericTable : isKpi ? GenericKpi : GenericList;
        return (
          <Widget icon={iconOf(desc.icon)} title={cfg.title || desc.label} sub={sub}
            headActions={cfg.create && desc.create ? <QuickCreate desc={desc} api={api} /> : undefined}>
            <V rows={rows} cfg={cfg} desc={desc} api={api} />
          </Widget>
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
  return (
    <span className="slb-hact" style={{ display: "inline-flex", alignItems: "center", gap: "6px", flex: "none" }}>
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
      <label style={lbl} htmlFor="slb-opt-title">Titre</label>
      <input id="slb-opt-title" style={field} value={cfg.title} placeholder={desc.label}
        onChange={(e) => set({ title: e.target.value })} />

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

      <div style={lbl}>Affichage</div>
      <div style={{ display: "flex", gap: "6px" }}>
        <button style={seg(cfg.view.kind === "list")} onClick={() => setView({ kind: "list" })} aria-pressed={cfg.view.kind === "list"}>Liste</button>
        <button style={seg(cfg.view.kind === "table")} onClick={() => setView({ kind: "table" })} aria-pressed={cfg.view.kind === "table"}>Tableau</button>
        <button style={seg(cfg.view.kind === "kpi")} onClick={() => setView({ kind: "kpi" })} aria-pressed={cfg.view.kind === "kpi"}>Indicateur</button>
      </div>

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
function NotifsCard() {
  // « Marquer comme lue » = masquage LOCAL (la table « Abonnés » n'a pas de champ
  // « Lu », choix validé, README §4-D) → non persistant, réapparaît au rechargement.
  const [readIds, setReadIds] = useState<string[]>([]);
  return (
    <SourceFeed source="abonnes">
      {(s) => {
        const all = s.rows.slice(0, RECENT).map(mapNotif);
        return (
          <NotifWidget
            items={all.filter((n) => !readIds.includes(n.id))}
            onRead={(id) => setReadIds((r) => [...r, id])}
            onReadAll={() => setReadIds(all.map((n) => n.id))}
          />
        );
      }}
    </SourceFeed>
  );
}

/* Tâches — widget à DEUX sources : il monte simplement deux adapters côte à côte
   (imbriqués), ce que le dispatch statique autorise sans rien assouplir. */
function TachesCard() {
  const openTasks = (rows: Row[]) => rows.filter((r) => !isDone(r)).slice(0, RECENT).map(mapTask);
  return (
    <SourceFeed source="tachesPa">
      {(pa) => (
        <SourceFeed source="tachesPr">
          {(pr) => <TasksWidget prospects={openTasks(pr.rows)} partenaires={openTasks(pa.rows)} />}
        </SourceFeed>
      )}
    </SourceFeed>
  );
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

/* --- Widgets LinkedIn (embeds Elfsight). platform.js est chargé UNE seule fois
      (nouveau domaine static.elfsight.com) ; il observe le DOM et monte chaque
      <div class="elfsight-app-…"> automatiquement, y compris après un remount
      (masquer/réafficher, réordonner). Aucune clé ni API exposée côté client.
      NB : un <script> écrit en JSX ne s'exécute pas → on l'ajoute au document. --- */
/* Runtime Elfsight. Elfsight sert le MÊME runtime sous deux URLs — ses codes
   d'intégration donnent tantôt `elfsightcdn.com/platform.js` (le plus récent),
   tantôt `static.elfsight.com/platform/platform.js` : les deux fonctionnent, et
   un seul chargement monte TOUS les `.elfsight-app-…` de la page, quel que soit
   le widget. Inutile donc d'en charger deux si les snippets diffèrent. */
const ELFSIGHT_PLATFORM = "https://elfsightcdn.com/platform.js";

function useElfsightPlatform() {
  useEffect(() => {
    // Un seul platform.js suffit pour TOUS les widgets Elfsight du compte.
    if (document.querySelector('script[src*="elfsightcdn.com/platform"], script[src*="elfsight.com/platform"]')) return;
    const s = document.createElement("script");
    s.src = ELFSIGHT_PLATFORM;
    s.async = true;
    document.body.appendChild(s);
  }, []);
}

/* --- Embed Elfsight avec DIAGNOSTIC. Dans le bloc Softr, l'embed restait vide et
   silencieux ; deux corrections :
   · plus de `data-elfsight-app-lazy` : le montage différé s'appuie sur la
     visibilité, ce qui est fragile dans une iframe — l'embed monte immédiatement ;
   · si rien n'est monté au bout de quelques secondes, on affiche un état guidant
     au lieu d'un cadre vide. Les trois causes à vérifier dans cet ordre sont la
     CSP de l'app Softr (`script-src`/`frame-src` doivent autoriser Elfsight), le
     domaine autorisé côté Elfsight (la page vit sur sunlibcrm2.softr.app), et un
     bloqueur de contenu dans le navigateur. --- */
function ElfsightEmbed({ appClass, label }: { appClass: string; label: string }) {
  useElfsightPlatform();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const host = hostRef.current;
      // platform.js injecte ses propres nœuds dans le conteneur : s'il est encore
      // vide, l'embed n'a pas démarré.
      if (host && host.childElementCount === 0) setStalled(true);
    }, 6000);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div style={{ padding: "10px 16px 16px" }}>
      <div ref={hostRef} className={appClass} />
      {stalled && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px 14px", borderRadius: T.rMd, border: `1px solid ${T.line}`, background: T.surface2 }}>
          <XCircle aria-hidden style={{ width: 16, height: 16, color: T.ink4, flex: "none", marginTop: 1 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: T.ink2 }}>{label} indisponible</div>
            <div style={{ marginTop: 2, fontSize: "12px", fontWeight: 500, color: T.ink4 }}>
              L'embed Elfsight n'a pas démarré : vérifiez que la CSP de l'app autorise <code>elfsightcdn.com</code> et <code>elfsight.com</code>,
              que le domaine <code>sunlibcrm2.softr.app</code> est autorisé côté Elfsight, et l'absence de bloqueur de contenu.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LinkedinCard() {
  return (
    <Widget icon={Newspaper} title="SunLib sur LinkedIn" sub="Dernières publications">
      {/* ▼ EMBED Elfsight — feed LinkedIn ▼ */}
      <ElfsightEmbed appClass="elfsight-app-2df6db63-fd6e-498a-8a61-a97803d9d96f" label="Fil LinkedIn" />
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
      {/* ▼ EMBED Elfsight — bannière (contenu piloté depuis Elfsight) ▼ */}
      <ElfsightEmbed appClass="elfsight-app-488a28ed-f4b6-4f5b-af44-c16613885c98" label="Bannière" />
    </Widget>
  );
}

/* Barre d'annonces Elfsight — troisième embed. Non livré par défaut (absent de
   DEFAULT_INSTANCES) : il s'ajoute depuis la galerie « Ajouter un widget ». */
function AnnoncesCard() {
  return (
    <Widget icon={Sparkles} title="Annonces SunLib" sub="Informations internes">
      {/* ▼ EMBED Elfsight — barre d'annonces ▼ */}
      <ElfsightEmbed appClass="elfsight-app-8f372b94-937a-4aa2-8762-0e56f6515ac7" label="Barre d'annonces" />
    </Widget>
  );
}

/* --- Registre des TYPES de widget. Les CLÉS SONT UN CONTRAT DE PERSISTANCE :
      une fois livrées, ne JAMAIS les renommer (les layouts sauvegardés y font
      référence). `title` = libellé du menu « Personnaliser » (le titre affiché
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
  | "data"     // ← LE type générique piloté par cfg : liste / tableau / KPI (§9-bis)
  | "list" | "kpi";   // ← DÉPRÉCIÉS : livrés en rév. 1, rendent comme `data` (cfg traduite)

type WidgetTypeDef = {
  title: string;                                  // libellé du menu « Personnaliser » / galerie
  icon: LucideIcon;
  Render: FC<{ id: string; cfg: any }>;
  defaults?: () => any;                           // cfg d'une instance neuve
  coerce?: (raw: unknown) => any;                 // cfg stockée (brute) → cfg utilisable ; ne throw JAMAIS
  Options?: FC<{ cfg: any; onChange: (next: any) => void }>;
};

/* Fabriques de types génériques. `icon` ne sert plus qu'aux LIBELLÉS (menu
   « Personnaliser », galerie) : à l'écran, le widget prend l'icône du descripteur
   de sa source, donc elle suit un changement de source. */
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
  notifs: { title: "Nouveaux dossiers Abonné", icon: Bell, Render: NotifsCard },
  taches: { title: "Journal des tâches", icon: CalendarClock, Render: TachesCard },
  notesInstallateurs: dataType("Dernières notes — Installateurs", HardHat, NOTES_INS_CFG),
  notesProspects: dataType("Dernières notes — Prospects", Target, NOTES_PRO_CFG),
  // Titres modifiables librement (les CLÉS, elles, sont figées : contrat de persistance).
  linkedin: { title: "SunLib sur LinkedIn", icon: Newspaper, Render: LinkedinCard },
  linkedinBanner: { title: "À la une SunLib", icon: Megaphone, Render: LinkedinBannerCard },
  annonces: { title: "Annonces SunLib", icon: Sparkles, Render: AnnoncesCard },
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
type Instance = { id: string; type: string; cfg: unknown; w: WidgetWidth; h: WidgetSize };

/** `items` : visibles — l'ordre du tableau EST l'ordre d'affichage.
 *  `hidden`: masqués, cfg CONSERVÉE (réaffichables tels quels).
 *  `parked`: types inconnus du code courant — ni rendus, ni perdus (compat descendante).
 *  `seeded`: ids d'instances par défaut DÉJÀ injectées → un widget par défaut
 *            supprimé/masqué ne ressuscite pas à chaque chargement. */
type Layout = { v: 2; items: Instance[]; hidden: Instance[]; parked: Instance[]; seeded: string[] };

/** Version du document de disposition. Portée par le JSON (`v`) ET recopiée dans
 *  le champ `schema_version` de la table (diagnostic du parc sans parser le JSON). */
const LAYOUT_VERSION = 2;

/* Instances livrées par défaut. Ajouter une entrée = le widget apparaît UNE fois
   chez tout le monde (puis reste supprimable définitivement, cf. seed()). */
const DEFAULT_INSTANCES: Instance[] = [
  { id: "notifs", type: "notifs", cfg: {}, w: "half", h: "md" },
  { id: "taches", type: "taches", cfg: {}, w: "half", h: "md" },
  { id: "notesInstallateurs", type: "notesInstallateurs", cfg: {}, w: "half", h: "md" },
  { id: "notesProspects", type: "notesProspects", cfg: {}, w: "half", h: "md" },
  { id: "linkedin", type: "linkedin", cfg: {}, w: "half", h: "md" },
  { id: "linkedinBanner", type: "linkedinBanner", cfg: {}, w: "half", h: "md" },
];

/* --- GALERIE « Ajouter un widget » : les modèles proposés en mode Personnaliser.
   Entièrement GÉNÉRÉE, de deux origines :
     · les types SUR-MESURE (pour ré-ajouter un widget supprimé) ;
     · les `presets` DÉCLARÉS DANS LE CATALOGUE de chaque source (§6-bis) — c'est
       là que « SAV en cours » ou « Dossiers du mois » se définissent, en pur JSON.
       Une source sans preset déclaré en reçoit un par défaut (liste sur son
       mappage), pour qu'elle soit toujours posable.
   Brancher une source la fait donc apparaître ici sans une ligne de code de plus.
   La cfg d'un preset est COPIÉE dans l'instance à la pose : l'instance est
   autoportante et ne bougera plus si le preset évolue. --- */
type Preset = { key: string; label: string; hint?: string; icon: LucideIcon; type: WidgetTypeKey; cfg: () => unknown; h?: WidgetSize };

/* Types sur-mesure proposés dans la galerie, avec leur hauteur de départ (une barre
   d'annonces n'a pas besoin d'un widget de 340 px). */
const CUSTOM_TYPES: { type: WidgetTypeKey; h?: WidgetSize }[] = [
  { type: "notifs" }, { type: "taches" }, { type: "linkedin" },
  { type: "linkedinBanner", h: "sm" }, { type: "annonces", h: "sm" },
];

/** Presets d'une source : ceux du descripteur, ou un modèle liste par défaut. */
function presetsOf(s: SourceKey): Preset[] {
  const desc = CATALOG[s];
  const hint = desc.connected ? undefined : "source non connectée";
  const declared = desc.presets ?? [];
  const list: PresetDesc[] = declared.length ? declared
    : [{ label: `Liste — ${desc.label}`, cfg: { source: s } }];
  return list.map((p, i) => ({
    key: `${s}:${i}`,
    label: p.label,
    hint,
    icon: iconOf(p.icon ?? desc.icon),
    type: "data" as WidgetTypeKey,
    // `coerceCfg` complète le preset avec les défauts du descripteur (mappage, tri).
    cfg: () => coerceCfg({ ...p.cfg, source: s }, cfgOfSource(s)),
    h: p.h,
  }));
}

const PRESETS: Preset[] = [
  ...CUSTOM_TYPES.map(({ type: t, h }) => ({
    key: t,
    label: WIDGET_REGISTRY[t].title,
    icon: WIDGET_REGISTRY[t].icon,
    type: t,
    cfg: () => ({}),
    h,
  })),
  ...(Object.keys(CATALOG) as SourceKey[]).flatMap(presetsOf),
];

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

const emptyLayout = (): Layout => ({ v: 2, items: [], hidden: [], parked: [], seeded: [] });

// Layout par défaut = les instances par défaut, semées. Copie défensive garantie.
const cloneDefault = (): Layout => seed(emptyLayout());

const idxOf = (list: Instance[], id: string): number => list.findIndex((i) => i.id === id);

/** Injecte les instances par défaut JAMAIS VUES par cet utilisateur (en fin
 *  d'`items`, visibles) et les marque `seeded`. PURE. Vue une fois = plus jamais
 *  imposée : masquer ou supprimer un widget par défaut est définitif. */
function seed(l: Layout): Layout {
  const known = new Set<string>([
    ...l.items.map((i) => i.id), ...l.hidden.map((i) => i.id),
    ...l.parked.map((i) => i.id), ...l.seeded,
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
    h: o.h === "sm" || o.h === "lg" ? o.h : "md",                // clamp ("md" par défaut)
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
  const items: Instance[] = [], hidden: Instance[] = [], parked: Instance[] = [];
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
  take(obj.hidden, hidden, true);   // un widget masqué ne reste pas « pleine largeur »
  take(obj.parked, parked);
  return seed({ v: 2, items, hidden, parked, seeded: uniqueStrings(obj.seeded) });
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
  const items: Instance[] = [], hidden: Instance[] = [], parked: Instance[] = [];
  const conv = (list: unknown, dest: Instance[], forceHalf = false) => {
    if (!Array.isArray(list)) return;
    for (const id of list) {
      if (typeof id !== "string" || !id || seen.has(id)) continue;
      seen.add(id);
      const size = v1?.sizes?.[id];
      const inst: Instance = {
        id, type: id, cfg: {},
        w: !forceHalf && Array.isArray(v1?.wide) && v1.wide.includes(id) ? "full" : "half",
        h: size === "sm" || size === "lg" ? size : "md",
      };
      if (!valid.has(id)) parked.push(inst); else dest.push(inst);
    }
  };
  conv(v1?.order, items);
  conv(v1?.hidden, hidden, true);
  return seed({ v: 2, items, hidden, parked, seeded: Array.from(seen) });
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
function moveWidget(layout: Layout, id: string, dir: -1 | 1): Layout {
  const from = idxOf(layout.items, id);
  if (from < 0) return layout;
  return { ...layout, items: reorder(layout.items, from, from + dir) };
}

/** Masque une instance : d'`items` vers `hidden`, cfg et hauteur CONSERVÉES.
 *  PURE. Repasse en demi-largeur (un widget masqué ne reste pas pleine largeur). */
function hideWidget(layout: Layout, id: string): Layout {
  const i = idxOf(layout.items, id);
  if (i < 0) return layout;
  return {
    ...layout,
    items: layout.items.filter((x) => x.id !== id),
    hidden: [...layout.hidden, { ...layout.items[i], w: "half" }],
  };
}

/** Réaffiche une instance masquée : de `hidden` vers la fin d'`items`. PURE. */
function showWidget(layout: Layout, id: string): Layout {
  const i = idxOf(layout.hidden, id);
  if (i < 0) return layout;
  return {
    ...layout,
    items: [...layout.items, layout.hidden[i]],
    hidden: layout.hidden.filter((x) => x.id !== id),
  };
}

/** Bascule la largeur d'une instance VISIBLE (pleine largeur ↔ moitié). PURE. */
function setWidgetWide(layout: Layout, id: string, value: boolean): Layout {
  const w: WidgetWidth = value ? "full" : "half";
  const i = idxOf(layout.items, id);
  if (i < 0 || layout.items[i].w === w) return layout;
  return { ...layout, items: layout.items.map((it) => (it.id === id ? { ...it, w } : it)) };
}

/** Règle la HAUTEUR d'une instance visible. PURE. ("md" est désormais stocké
 *  explicitement — plus de valeur implicite à reconstituer.) */
function setWidgetSize(layout: Layout, id: string, h: WidgetSize): Layout {
  const i = idxOf(layout.items, id);
  if (i < 0 || layout.items[i].h === h) return layout;
  return { ...layout, items: layout.items.map((it) => (it.id === id ? { ...it, h } : it)) };
}

/* --- MULTI-INSTANCES (phase 3) : ajouter, dupliquer, supprimer. Ces trois
   fonctions sont ce qui rend le découplage id ≠ type réellement utile — deux
   widgets du même type, réglés différemment, cohabitent sans rien de spécial. --- */

/** Tous les ids déjà « pris » par cet utilisateur, y compris `seeded` et `parked` :
 *  un id neuf ne doit jamais entrer en collision avec un id retiré mais mémorisé. */
const takenIds = (l: Layout): Set<string> =>
  new Set([...l.items, ...l.hidden, ...l.parked].map((i) => i.id).concat(l.seeded));

/** Id d'instance neuf. Les ids par défaut sont des clés de type (« notifs ») ;
 *  ceux créés à la main portent le préfixe `w_` — aucun risque de confusion. */
function newInstanceId(taken: Set<string>): string {
  let id = "";
  do { id = `w_${Math.random().toString(36).slice(2, 8)}`; } while (!id || taken.has(id));
  return id;
}

/** Ajoute une instance visible en fin de grille (galerie « Ajouter un widget »). PURE. */
function addInstance(layout: Layout, type: string, cfg: unknown, h: WidgetSize = "md"): Layout {
  const inst: Instance = { id: newInstanceId(takenIds(layout)), type, cfg, w: "half", h };
  return { ...layout, items: [...layout.items, inst] };
}

/** Duplique une instance visible JUSTE APRÈS l'originale, cfg copiée, id neuf. PURE.
 *  C'est LE geste multi-instances : « le même widget, mais filtré autrement ». */
function duplicateInstance(layout: Layout, id: string): Layout {
  const i = idxOf(layout.items, id);
  if (i < 0) return layout;
  const copy: Instance = { ...cloneInstance(layout.items[i]), id: newInstanceId(takenIds(layout)) };
  const items = [...layout.items];
  items.splice(i + 1, 0, copy);
  return { ...layout, items };
}

/** Supprime définitivement une instance (visible ou masquée). PURE.
 *  `seeded` n'est PAS touché : un widget par défaut supprimé ne réapparaîtra pas
 *  au prochain chargement (il reste re-ajoutable via la galerie). */
function removeInstance(layout: Layout, id: string): Layout {
  if (idxOf(layout.items, id) < 0 && idxOf(layout.hidden, id) < 0) return layout;
  return {
    ...layout,
    items: layout.items.filter((x) => x.id !== id),
    hidden: layout.hidden.filter((x) => x.id !== id),
  };
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
  // Le héro n'est pas un widget : il lit ses sources lui-même. Comme un adapter, il
  // appelle useRecords avec `from` en DIRECT (contrainte Softr) et retombe sur
  // offlineState pour ce qui n'est pas connecté. À terme (phase 4), ces deux chips
  // deviendront des mini-KPI, donc de simples consommateurs de <SourceFeed>.
  const abonnesRes = useRecords({ from: DS.abonnes, select: SELECT_ABONNE, orderBy: q.desc("creeLe") });
  const abonnes = isLive("abonnes") ? liveState(abonnesRes).rows : offlineState("abonnes").rows;
  const taches = offlineState("tachesPa").rows;   // source pas encore connectée
  const unread = abonnes.slice(0, RECENT).length;
  const urgent = taches.filter((r) => !isDone(r) && relDays(asText(r.fin)) < 3).length;
  return { unread, urgent };
}

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
  // Styles FONCTIONNELS de la grille — inline, jamais en CSS injecté.
  const dashStyle: CSSProperties = {
    display: "grid", gap: "18px", alignItems: "start",
    gridTemplateColumns: twoCols ? "repeat(2, minmax(0, 1fr))" : "1fr",
  };
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
  // Clés = ids d'INSTANCE (une même clé de type peut être posée plusieurs fois).
  const wrapRefs = useRef(new Map<string, HTMLElement>());
  const innerRefs = useRef(new Map<string, HTMLElement>());
  const flipPrev = useRef(new Map<string, DOMRect>());
  const flipSig = useRef("");
  useLayoutEffect(() => {
    const sig = `${shown.items.map((it) => `${it.id}:${it.w}:${it.h}`).join(",")}|${editing}|${loading}`;
    const changed = sig !== flipSig.current;
    flipSig.current = sig;
    const prev = flipPrev.current;
    const next = new Map<string, DOMRect>();
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

  /** Enregistre la cfg d'une instance depuis son ⋮ « Options » (mode normal).
   *  Même pipeline que « Enregistrer » de la grille : optimiste + toast, écriture
   *  d'un seul document `layout_json`. La cfg est stockée TELLE QUELLE (le rendu la
   *  passe par `coerce`). Édition impossible en mode Personnaliser → pas de conflit
   *  avec le brouillon `draft`. */
  const persistCfg = (id: string, cfg: unknown) =>
    void runSave({ ...current, items: current.items.map((it) => (it.id === id ? { ...it, cfg } : it)) });

  // Menu ⋮ (clavier/tactile) — mêmes fonctions pures que le DnD. `id` = id d'INSTANCE.
  const onMoveUp = (id: string) => setDraft((d) => moveWidget(d, id, -1));
  const onMoveDown = (id: string) => setDraft((d) => moveWidget(d, id, 1));
  const onHide = (id: string) => setDraft((d) => hideWidget(d, id));
  const onShow = (id: string) => setDraft((d) => showWidget(d, id));
  const onSetWide = (id: string, v: boolean) => setDraft((d) => setWidgetWide(d, id, v));
  const onSetSize = (id: string, s: WidgetSize) => setDraft((d) => setWidgetSize(d, id, s));
  // Multi-instances (mode Personnaliser) — tout reste dans le brouillon jusqu'à « Enregistrer ».
  const onDuplicate = (id: string) => setDraft((d) => duplicateInstance(d, id));
  const onRemove = (id: string) => setDraft((d) => removeInstance(d, id));
  const onAdd = (p: Preset) => setDraft((d) => addInstance(d, p.type, p.cfg(), p.h ?? "md"));

  // DnD HTML5 natif. Drop hors cible → no-op (seul onDragEnd nettoie l'état).
  const onDrop = (to: number) => {
    if (dragIndex !== null && dragIndex !== to) setDraft((d) => ({ ...d, items: reorder(d.items, dragIndex, to) }));
    resetDrag();
  };

  // Redimensionnement en largeur (poignées de bord) — événements POINTER (souris
  // + tactile), PAS de DnD HTML5. On tire vers l'extérieur → pleine largeur, vers
  // l'intérieur → normale (snap au seuil). side=+1 poignée droite, -1 gauche.
  const resizeRef = useRef<{ id: string; startX: number; side: 1 | -1 } | null>(null);
  const onResizeDown = (id: string, side: 1 | -1) => (e: ReactPointerEvent<HTMLElement>) => {
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
  const sizeRef = useRef<{ id: string; startY: number; startIdx: number } | null>(null);
  const onSizeDown = (id: string) => (e: ReactPointerEvent<HTMLElement>) => {
    e.stopPropagation(); e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const h = draft.items[idxOf(draft.items, id)]?.h ?? "md";
    sizeRef.current = { id, startY: e.clientY, startIdx: SIZE_STEPS.indexOf(h) };
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
        <div ref={gridRef} className="slb-dash" style={dashStyle} aria-busy="true" aria-label="Chargement de votre disposition">
          {[0, 1, 2, 3].map((k) => <SkeletonCard key={k} />)}
        </div>
      ) : shown.items.length === 0 ? (
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
        <div ref={gridRef} className="slb-dash" style={dashStyle}>
          {shown.items.map((inst, i) => {
            // Type inconnu du code courant : ne devrait pas arriver (normalizeLayout
            // les met dans `parked`) — garde-fou pour ne jamais casser le rendu.
            const def = typeDefOf(inst.type);
            if (!def) return null;
            const Render = def.Render;
            // cfg interprétée AU RENDU (le stockage reste brut, cf. §10-bis).
            const cfg = cfgOf(def, inst.cfg);
            const id = inst.id;
            const isSource = editing && dragIndex === i;
            const isTarget = editing && overIndex === i && dragIndex !== null && dragIndex !== i;
            const wide = inst.w === "full";
            const size = inst.h;
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
                  <WidgetChromeCtx.Provider value={editing ? { index: i, total: shown.items.length, isWide: wide, size, onMoveUp: () => onMoveUp(id), onMoveDown: () => onMoveDown(id), onSetWide: (v) => onSetWide(id, v), onSetSize: (s) => onSetSize(id, s), onHide: () => onHide(id), onDuplicate: () => onDuplicate(id), onRemove: () => onRemove(id) } : null}>
                    {/* Options : mode NORMAL uniquement (en édition, le ⋮ porte les
                        actions de disposition et le corps est inerte). */}
                    <WidgetOptionsCtx.Provider value={!editing && def.Options ? { cfg, Form: def.Options, onSave: (c) => persistCfg(id, c) } : null}>
                      {/* Hauteur du corps scrollable — posée en ligne par ScrollBody. */}
                      <WidgetHeightCtx.Provider value={WIDGET_HEIGHTS[size]}>
                        <Render id={id} cfg={cfg} />
                      </WidgetHeightCtx.Provider>
                    </WidgetOptionsCtx.Provider>
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
              {shown.hidden.map((inst) => {
                const def = typeDefOf(inst.type);
                if (!def) return null;                       // type inconnu : garde-fou (cf. `parked`)
                const { title, icon: Icon } = def;
                return (
                  <div key={inst.id} style={{ display: "inline-flex", alignItems: "center", gap: "10px", padding: "7px 8px 7px 12px", borderRadius: T.rMd, border: `1px solid ${T.line}`, background: T.surface2 }}>
                    <Icon aria-hidden style={{ width: 15, height: 15, color: T.ink3 }} />
                    <span style={{ fontSize: "12.5px", fontWeight: 600, color: T.ink2 }}>{title}</span>
                    <button className="slb-btng" style={{ ...btn, padding: "5px 10px", fontSize: "12px" }} onClick={() => onShow(inst.id)} aria-label={`Afficher — ${title}`}>
                      <Eye aria-hidden style={{ width: 14, height: 14 }} />Afficher
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Panneau « Ajouter un widget » — visible seulement en édition. La liste des
          modèles est générée (types sur-mesure + une liste par source du catalogue) :
          brancher une source la fait apparaître ici automatiquement. */}
      {editing && (
        <Card style={{ ...CARD, marginTop: "12px", padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <Plus aria-hidden style={{ width: 15, height: 15, color: T.ink3 }} />
            <span style={{ fontSize: "13px", fontWeight: 700, color: T.ink }}>Ajouter un widget</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {PRESETS.map((p) => {
              const Icon = p.icon;
              return (
                <button key={p.key} className="slb-btng" onClick={() => onAdd(p)} aria-label={`Ajouter — ${p.label}`}
                  style={{ ...btn, padding: "7px 12px", alignItems: "center" }}>
                  <Icon aria-hidden style={{ width: 15, height: 15, color: T.ink3 }} />
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.25 }}>
                    <span style={{ fontSize: "12.5px", fontWeight: 600 }}>{p.label}</span>
                    {p.hint && <span style={{ fontSize: "10.5px", fontWeight: 500, color: T.ink4 }}>{p.hint}</span>}
                  </span>
                  <Plus aria-hidden style={{ width: 14, height: 14, color: T.ink4 }} />
                </button>
              );
            })}
          </div>
          <p style={{ margin: "12px 0 0", fontSize: "11.5px", fontWeight: 500, color: T.ink4 }}>
            Le widget ajouté arrive en fin de grille. Réglez ensuite son contenu via le menu ⋮ « Options » (hors mode Personnaliser).
          </p>
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
  const firstName = USE_MOCK ? MOCK_USER.firstName : firstNameOf(user);
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
