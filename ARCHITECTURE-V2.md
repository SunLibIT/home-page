# SunLib CRM — Accueil · Architecture cible v2 du système de widgets

> Complète `ARCHITECTURE.md` (état actuel). Objectif : **n'importe quelle table de
> l'application peut devenir un widget de l'accueil**, avec un coût marginal quasi
> nul, sans jamais retoucher le moteur (layout, persistance, mode Personnaliser).
> Toutes les contraintes dures Softr de l'ARCHITECTURE.md restent en vigueur —
> cette cible est conçue *à l'intérieur* de ces contraintes, pas contre elles.

---

## 0. Le diagnostic en une phrase

Aujourd'hui `WidgetId` fusionne **trois concepts** qui devraient être indépendants :
*d'où viennent les données* (la source), *comment on les affiche* (le type de
widget) et *ce que l'utilisateur a posé sur SON accueil* (l'instance). Résultat :
chaque nouveau widget = 3 couches codées à la main, une seule instance possible
par widget, et `widgets_config_json` qui ne sert à rien. La v2 sépare ces trois
axes.

```
        layout_json (v2) — 1 ligne / utilisateur (table Preferences, inchangée)
        ┌──────────────────────────────────────────────┐
        │ items: [ { id, type, cfg, w, h }, … ]        │   ← INSTANCES
        └──────────────────────┬───────────────────────┘
                               │ pour chaque instance
                               ▼
            WIDGET_TYPES[type]           ← COMMENT afficher
            Render · Options · defaults · coerce
                               │ cfg.source
                               ▼
            <SourceFeed source={…}>      ← D'OÙ viennent les données
            dispatch STATIQUE → 1 adapter useRecords par table
                               │
                               ▼
                    Airtable / Softr Tables
```

La contrainte Softr sur `from` **ne se contourne pas, elle se canalise** : on
n'écrira jamais `<Feed from={x}>`, mais un *dispatch statique* — un composant
adapter par datasource (5 lignes chacun) et un `switch` qui les monte. Ajouter
une source = ajouter un `case`. C'est le seul prix à payer, et il est fixe.

> ⚠️ Nuance importante, souvent sur-lue : **seul `from` est verrouillé**. Les
> paramètres `where`, `orderBy` et les valeurs passées aux filtres PEUVENT être
> dynamiques (la persistance le prouve déjà : `q.text("email").is(email)`).
> Si un jour une table est trop volumineuse pour le filtrage client, on ajoute
> une variante d'adapter paramétrée par props — sans rien changer d'autre.

---

## 1. Couche SOURCES — le registre de données

Un « registre de sources » remplace les enveloppes `*Card` codées à la main.
Trois pièces par source : le littéral dans `define`, le `SELECT_*` (règles
inchangées : noms Airtable **exacts** espaces finaux compris, FIELD IDs pour les
tables Softr natives), et un **adapter** de 5 lignes. Plus une entrée de
**catalogue déclaratif** qui décrit la source aux widgets génériques.

```tsx
const DS = datasource.define({
  abonnes: "8fc957d0-232b-4b24-906e-d0be7c636f30",
  prefs:   "96961120-3d05-4ccc-8a48-3640ee48b060",
  // notesIns: "…",  ← n'ajouter QUE des IDs réellement connectés (règle inchangée)
});

type SourceKey = "abonnes" | "notesIns" | "notesPro" | "tachesPa" | "tachesPr"
               | "savTickets" /* futur : projet Pilotage SAV */;

type Row = { id: string } & Record<string, unknown>;
type SourceState = { rows: Row[]; loading: boolean; error: boolean };
type SourceChildren = (s: SourceState) => React.ReactNode;
```

### 1.1 Le catalogue `SOURCES` — ce que les widgets ont le droit de savoir

```tsx
type FieldKind = "text" | "date" | "badge" | "number" | "bool";

type SourceMeta = {
  label: string;                                       // libellé humain (sélecteur)
  connected: boolean;                                  // false tant que l'ID n'est pas dans DS
  fields: Record<string, { label: string; kind: FieldKind }>;  // clés = ALIAS du SELECT_*
  defaultMap?: Partial<ListMap>;                       // pré-mappage proposé au type "list"
};

const SOURCES: Record<SourceKey, SourceMeta> = {
  abonnes: {
    label: "Abonnés — BDD Abonné",
    connected: true,
    fields: {
      nom:        { label: "Nom",                  kind: "text"  },
      prenom:     { label: "Prénom",               kind: "text"  },
      partenaire: { label: "Installateur",         kind: "text"  },
      statut:     { label: "Statut dossier",       kind: "badge" },
      offre:      { label: "Type d'installation",  kind: "badge" },
      creeLe:     { label: "Créé le",              kind: "date"  },
    },
    defaultMap: { title: "nom", sub: "partenaire", date: "creeLe", badge: "statut" },
  },
  // notesIns, notesPro, tachesPa, tachesPr : connected:false, catalogues déjà connus
};
```

Le catalogue alimente le sélecteur de source, les menus déroulants de mappage de
champs, et le tri typé (dates vs textes vs nombres). **Il ne contient jamais les
noms de champs bruts** — uniquement les alias, ce qui garde la règle « les noms
exacts ne vivent QUE dans les `SELECT_*` ».

### 1.2 Les adapters + le dispatch statique

```tsx
/* Un adapter PAR source : le SEUL endroit du fichier où useRecords lit une
   table métier. `from` reste un membre littéral du define — contrainte Softr. */
function AbonnesSource({ children }: { children: SourceChildren }) {
  const res = useRecords({ from: DS.abonnes, select: SELECT_ABONNE, orderBy: q.desc("creeLe") });
  return <>{children(liveState(res))}</>;
}

const liveState = (res: any): SourceState =>
  ({ rows: flatten(res), loading: res.status === "loading", error: res.status === "error" });

const offlineState = (k: SourceKey): SourceState =>
  ({ rows: USE_MOCK ? (MOCK[k] ?? []) : [], loading: false, error: false });

/* Dispatch STATIQUE — jamais de `from` variable. Ajouter une source = 1 case.
   Aucun hook n'est appelé ici : monter/démonter des composants entiers est
   légal pour React, et chaque adapter porte son propre useRecords. */
function SourceFeed({ source, children }: { source: SourceKey; children: SourceChildren }) {
  if (USE_MOCK || !SOURCES[source].connected) return <>{children(offlineState(source))}</>;
  switch (source) {
    case "abonnes":  return <AbonnesSource>{children}</AbonnesSource>;
    // case "notesIns": return <NotesInsSource>{children}</NotesInsSource>;
    default:         return <>{children(offlineState(source))}</>;
  }
}
```

Conséquences directes :

- **Mock par source, gratuit.** `offlineState` sert automatiquement le mock pour
  toute source non connectée, même quand `USE_MOCK=false` — ce qui règle la
  limite n°8 (granularité du mock) sans interrupteur supplémentaire. Le `MOCK`
  est re-clé par `SourceKey`, avec des lignes **à la forme des alias du
  SELECT** : ainsi les transformations client (§2) sont identiques en mock et
  en live.
- **Deux instances sur la même source = deux `useRecords`.** Acceptable pour
  nos volumes (12 lignes affichées). Si un jour c'est mesuré comme un problème,
  l'optimisation connue est un `SourcesHost` qui monte un adapter par source
  distincte et partage via contexte — à ne faire que si nécessaire.
- **`useHeroCounts` devient un consommateur comme un autre** (ou reste tel quel
  en phase 1 ; à terme, les chips du héro sont des mini-KPI, cf. §3.2).

---

## 2. Couche TYPES — le registre d'affichages

```tsx
type WidgetTypeKey =
  /* Types « legacy » = les Cards actuelles, rebaptisées. Contrat de persistance :
     ces clés reprennent les WidgetId v1 et ne seront JAMAIS renommées. */
  | "notifs" | "taches" | "notesInstallateurs" | "notesProspects"
  | "linkedin" | "linkedinBanner"
  /* Types GÉNÉRIQUES pilotés par cfg — le cœur de la v2. */
  | "list" | "kpi";

type WidgetTypeDef<C> = {
  label: string;                      // libellé galerie / menu Personnaliser
  icon: LucideIcon;
  defaults: () => C;
  coerce: (raw: unknown) => C;        // merge défauts + clamp — ne throw JAMAIS
  Render: FC<{ id: string; cfg: C }>; // libre d'utiliser <SourceFeed> et <Widget>
  Options?: FC<{ cfg: C; onChange: (c: C) => void }>;  // contenu du ⋮ « Options »
};

const WIDGET_TYPES: { [K in WidgetTypeKey]: WidgetTypeDef<any> } = { /* … */ };
```

Deux libertés importantes : un `Render` **peut** être sur-mesure (les deux
LinkedIn, le journal des tâches qui fusionne deux sources avec ses onglets —
il monte simplement deux adapters statiques côte à côte). Le système n'impose
pas la généricité, il la rend *possible*. Et l'implémentation d'un `Render`
peut évoluer librement : seule la **clé** de type est un contrat (comme les
`WidgetId` avant elle). Exemple : `notesInstallateurs` garde sa clé mais son
`Render` deviendra en phase 2 un simple `GenericList` avec une cfg figée.

### 2.1 Le type `list` — le widget générique qui débloque tout

```tsx
type ListMap = { title: string; sub?: string; date?: string; badge?: string };
type ListFilter = {
  field: string;
  op: "eq" | "neq" | "contains" | "lastDays" | "isEmpty" | "notEmpty";
  value?: string | number;
};
type ListCfg = {
  title: string;
  source: SourceKey;
  map: ListMap;                        // alias de champs → rôles d'affichage
  filter?: ListFilter;
  sort: { by: string; dir: "asc" | "desc" };
  limit: number;                       // défaut RECENT (12)
};

/* Transformations CLIENT, fonctions PURES — identiques en mock et en live. */
function applyView(rows: Row[], cfg: ListCfg): Row[] {
  let out = cfg.filter ? rows.filter((r) => matchFilter(r[cfg.filter!.field], cfg.filter!)) : rows;
  out = [...out].sort(compareBy(cfg.sort, SOURCES[cfg.source].fields));  // tri typé par kind
  return out.slice(0, Math.max(1, cfg.limit || RECENT));
}
```

Le `Render` du type `list` :

```tsx
Render: ({ id, cfg }: { id: string; cfg: ListCfg }) => (
  <SourceFeed source={cfg.source}>
    {(s) => (
      <Widget icon={iconOf(cfg)} title={cfg.title || SOURCES[cfg.source].label} /* … */>
        <GenericList rows={applyView(s.rows, cfg)} map={cfg.map}
                     kinds={SOURCES[cfg.source].fields} loading={s.loading} error={s.error} />
      </Widget>
    )}
  </SourceFeed>
),
```

`GenericList` est un présentiel unique (ligne avatar/titre/sous-titre/date/badge,
même gabarit que `NoteRow`), qui rend chaque rôle selon le `kind` du champ mappé
(`date` → `fmtRel` + `title` absolu, `badge` → `Badge`/`statusVariant`, etc.).

### 2.2 Le type `kpi` — le raccord avec le projet Pilotage SAV

```tsx
type KpiCfg = {
  title: string;
  source: SourceKey;
  filter?: ListFilter;      // ex. statut = "En cours", ou lastDays 30
  compareDays?: number;     // delta vs période précédente (optionnel)
};
```

Rendu : gros chiffre + libellé + delta, dans la coquille `Widget` en `h:"sm"`.
**Limite assumée et documentée** : le compte porte sur les lignes *chargées*
(pattern actuel : les N récentes), pas sur le total serveur. Pour un vrai total
sur grosse table, deux voies plus tard : adapter variante sans limite, ou champ
rollup côté Airtable lu en 1 ligne. Pour les volumes actuels (SAV : dizaines de
dossiers), le compte client est exact.

---

## 3. INSTANCES & le JSON v2 — le nouveau `layout_json`

### 3.1 Le schéma

```tsx
type Instance = {
  id: string;            // CONTRAT DE PERSISTANCE — jamais renommé.
                         // Migrés v1 = l'ancien WidgetId ; nouveaux = "w_" + aléa base36.
  type: WidgetTypeKey;   // contrat aussi : une clé de type livrée ne se renomme jamais
  cfg: unknown;          // interprété par WIDGET_TYPES[type].coerce AU RENDU (jamais stocké "réparé")
  w: "half" | "full";    // ex-`wide`
  h: WidgetSize;         // ex-`sizes` — "md" désormais stocké explicitement (plus simple)
};

type Layout = {
  v: 2;
  items:  Instance[];    // visibles — l'ordre du tableau EST l'ordre d'affichage
  hidden: Instance[];    // masqués, cfg CONSERVÉE (réaffichables tels quels)
  parked: Instance[];    // types inconnus du code courant : ni rendus, ni perdus
  seeded: string[];      // ids d'instances par défaut déjà injectées (anti-résurrection)
};
```

Ce que chaque champ règle :

| Champ | Limite v1 qu'il résout |
|---|---|
| `items[].id ≠ type` | n°2 — multi-instances : deux « Notes » avec deux filtres différents, duplication d'un widget |
| `items[].cfg` | n°3 — la personnalisation fine a enfin un domicile (et le ⋮ Options a un contenu) |
| `w`/`h` embarqués dans l'instance | plus de 3 tableaux parallèles (`order`/`wide`/`sizes`) à garder cohérents |
| `parked` | compat **descendante** : un layout écrit par un code plus récent (type inconnu) survit à un retour arrière *au sein de la v2* |
| `seeded` | remplace « tout id du registre absent → réapparaît » : un widget par défaut **supprimé** par l'utilisateur ne ressuscite pas à chaque chargement |

### 3.2 Seeding — livraison de nouveaux widgets par défaut

```tsx
const DEFAULT_INSTANCES: Instance[] = [
  { id: "notifs",             type: "notifs",             cfg: {}, w: "half", h: "md" },
  { id: "taches",             type: "taches",             cfg: {}, w: "half", h: "md" },
  { id: "notesInstallateurs", type: "notesInstallateurs", cfg: {}, w: "half", h: "md" },
  { id: "notesProspects",     type: "notesProspects",     cfg: {}, w: "half", h: "md" },
  { id: "linkedin",           type: "linkedin",           cfg: {}, w: "half", h: "md" },
  { id: "linkedinBanner",     type: "linkedinBanner",     cfg: {}, w: "half", h: "md" },
];

/* Toute instance par défaut jamais vue par cet utilisateur → ajoutée en fin
   d'items, visible, et marquée seeded. Vue une fois = plus jamais imposée. */
function seed(l: Layout): Layout {
  const known = new Set([
    ...l.items.map(i => i.id), ...l.hidden.map(i => i.id),
    ...l.parked.map(i => i.id), ...l.seeded,
  ]);
  const missing = DEFAULT_INSTANCES.filter(d => !known.has(d.id));
  if (!missing.length) return l;
  return { ...l,
    items:  [...l.items, ...missing.map(d => ({ ...d }))],
    seeded: [...l.seeded, ...missing.map(d => d.id)],
  };
}
```

Livrer un nouveau widget par défaut = 1 entrée dans `DEFAULT_INSTANCES` : il
apparaît chez tout le monde une fois, exactement comme aujourd'hui — mais reste
supprimable définitivement.

### 3.3 `normalizeLayout` v2 — mêmes principes, périmètre élargi

Fonction pure, ne throw jamais, appliquée à toute lecture (BDD **et** cache
localStorage — la migration du cache est donc transparente) :

1. JSON invalide / non-objet / `v ∉ {1,2}` → `seed(cloneDefault())`.
2. `v === 1` → `migrateV1` (§3.4).
3. `v === 2` → assainissement : instances sans `id` string ou en doublon
   (priorité `items` > `hidden` > `parked`) écartées ; `w`/`h` clampés ;
   `type` inconnu → déplacé vers `parked` (jamais supprimé) ; `cfg` laissé
   **brut** (c'est `coerce` du type qui l'interprète au rendu — on ne « répare »
   jamais le stockage, on tolère à la lecture). Puis `seed()`.

### 3.4 Migration v1 → v2 — mécanique, sans perte

```tsx
const V1_IDS = ["notifs","taches","notesInstallateurs","notesProspects","linkedin","linkedinBanner"];

function migrateV1(v1: any): Layout {
  const inst = (id: string): Instance => ({
    id,
    type: (V1_IDS.includes(id) ? id : "list") as WidgetTypeKey,  // ids v1 = clés de type legacy
    cfg: {},
    w: Array.isArray(v1.wide) && v1.wide.includes(id) ? "full" : "half",
    h: v1.sizes?.[id] === "sm" || v1.sizes?.[id] === "lg" ? v1.sizes[id] : "md",
  });
  return seed({
    v: 2,
    items:  (Array.isArray(v1.order)  ? v1.order  : []).map(inst),
    hidden: (Array.isArray(v1.hidden) ? v1.hidden : []).map(inst),
    parked: [],
    seeded: DEFAULT_INSTANCES.map(d => d.id),   // l'utilisateur v1 a déjà tout vu
  });
}
```

La migration s'effectue en mémoire à la lecture ; le document v2 n'est écrit
qu'au prochain « Enregistrer » (fidèle à la règle « écriture uniquement à
Enregistrer »). **Seul chemin destructif connu : un retour arrière vers le code
v1 après qu'un utilisateur a sauvegardé en v2** (le normalize v1 verrait
`v!==1` → défaut, puis écraserait au prochain save). Mitigation : valider la
phase 0 sur ta propre ligne `Preferences` (le modèle 1 ligne/utilisateur isole
naturellement les tests) avant d'ouvrir aux autres, et ne pas rollbacker
au-delà.

---

## 4. Persistance — Option A confirmée, et pourquoi

**Le document v2 entier continue de vivre dans le seul champ `layout_json`.**
Rien ne change dans la mécanique : 1 ligne par utilisateur clé sur l'e-mail,
optimiste + toast, cache `slb-home-layout:<email>`, last-write-wins, écriture
seulement à « Enregistrer ».

Arbitrage explicite contre l'éclatement dans les champs en réserve :

- **Atomicité** : un document = un parse, un état, une écriture. (Nuance utile :
  `updateM.mutateAsync({ recordId, fields: {…} })` écrit plusieurs alias en UN
  appel — donc si un jour on veut isoler les `cfg` dans `widgets_config_json`,
  ça resterait atomique. C'est une porte ouverte, pas un besoin : aujourd'hui ça
  doublerait la logique de normalisation pour zéro gain.)
- **Versionnage unique** : le `v` du JSON gouverne tout ; pas de matrice de
  compatibilité entre champs.
- **Taille** : ~20 instances avec cfg ≈ 3–5 Ko. Aucun risque sur un Long text.

Champs écrits : `user_email` (création), `layout_json`, `updated_at` — et
désormais **`schema_version = 2`** (recommandé : coût nul, et permet de
diagnostiquer l'état du parc directement dans l'UI Softr Tables sans parser du
JSON). `widgets_config_json`, `visible_widgets`, `layout_mobile_json` restent
en réserve, volontairement vides.

---

## 5. UI — ce que la v2 débloque à l'écran

**Le ⋮ « Options » du mode normal (TODO ligne 725) est enfin branché** : il
ouvre `WIDGET_TYPES[type].Options` (petit formulaire : sélecteur de source
limité aux `connected`, menus de mappage alimentés par `SOURCES[…].fields`,
filtre, tri, limite). « Enregistrer » du panneau → même pipeline `persist`
(optimiste + toast), en remplaçant la `cfg` de l'instance :

```tsx
const persistCfg = (id: string, cfg: unknown) =>
  persist({ ...applied, items: applied.items.map(it => it.id === id ? { ...it, cfg } : it) });
```

En mode **Personnaliser**, le menu ⋮ gagne deux actions à côté des existantes :
**Dupliquer** (nouvel `id` généré, `cfg` copiée — c'est LE geste multi-instances)
et **Supprimer** (retrait définitif ; les widgets par défaut restent
re-ajoutables via la galerie). Et un panneau **« Ajouter un widget »** apparaît
à côté de « Widgets masqués » : une galerie de *presets* —
`{ label, icon, type, cfg() }` — générée automatiquement : un preset `list` par
source connectée (avec son `defaultMap`), un `kpi` vierge, les embeds.

Le moteur ne bouge presque pas : DnD, FLIP, poignées, container query, toasts
sont inchangés ; seules les clés passent de `WidgetId` à `instance.id`.

---

## 6. LA RECETTE — « j'ai une table, j'en veux un widget »

C'est la section à donner telle quelle à une future session Claude Code.

### Cas A — la table doit s'afficher en liste ou en KPI (zéro rendu sur-mesure)

| # | Où | Quoi | Volume |
|---|---|---|---|
| 1 | Softr Studio | Page `/home-copy` → bloc → onglet **Sources** : connecter la table, récupérer l'ID datasource | 0 ligne |
| 2 | `Block.tsx` §6 | Ajouter le littéral dans `datasource.define` | 1 ligne |
| 3 | `Block.tsx` §6 | Écrire `SELECT_X` — ⚠️ noms Airtable **EXACTS** (espaces finaux compris) ; FIELD IDs si table Softr native | ~6 lignes |
| 4 | Couche Sources | Copier-coller un adapter `XSource` + ajouter le `case` dans `SourceFeed` | ~6 lignes |
| 5 | Couche Sources | Entrée `SOURCES.x` : label, `connected:true`, catalogue `fields`, `defaultMap` | ~10 lignes |
| 6 | (option) | `MOCK.x` : 3–5 lignes fictives à la forme des alias | ~8 lignes |

**≈ 30 lignes, aucun toucher au layout, aux types, à la persistance.** La source
apparaît immédiatement dans le sélecteur des widgets `list`/`kpi` et dans la
galerie (preset auto). Vérifications de fin : `npm run build` passe ; la page
**publiée, connecté** (l'aperçu « œil » n'a pas de session) ; le widget mock
s'affiche à l'identique avant branchement.

### Cas B — la table mérite un rendu spécifique

Cas A (étapes 1–6) **plus** un `WidgetTypeDef` : `Render` (qui consomme
`<SourceFeed>` et la coquille `<Widget>`), `defaults`, `coerce`, `Options` si
configurable, et une entrée `PRESETS` pour la galerie. Toujours zéro toucher au
moteur.

### Prompt-type pour la future session

> Nouvelle source pour l'accueil : table Airtable « Dossiers SAV » (base SAV),
> datasource ID `xxxx-…` (déjà connectée dans l'onglet Sources du bloc
> `/home-copy`). Champs : ident `ID`, client `Client`, statut `Statut`,
> priorite `Priorité`, debut `Date de début`. Applique la **recette §6 Cas A**
> d'`ARCHITECTURE-V2.md` ; `defaultMap` = titre client, badge statut, date
> debut. Puis ajoute un preset KPI « SAV en cours » (filtre statut ≠ « Clos »).

Premier cas d'usage réel visé : la table du projet **Pilotage SAV** (dossiers +
KPI déjà spécifiés dans son README) — bon test de bout en bout de la recette.

---

## 7. Plan de migration — phases courtes, chacune livrable

| Phase | Contenu | Risque | Visible utilisateur |
|---|---|---|---|
| **0** ✅ **livrée le 2026-07-31** | Schéma v2 + `migrateV1` + `normalizeLayout` v2 + `seeded`/`parked`. Le registre v1 est traduit mécaniquement en `DEFAULT_INSTANCES` + types legacy. Écarts assumés : `Instance.type` est un `string` (pour garder un type inconnu sans cast), `migrateV1` ne marque `seeded` que les ids réellement présents (sinon un widget par défaut livré après la dernière sauvegarde v1 n'apparaîtrait jamais), et `schema_version = 2` est écrit. | Faible (fonctions pures, testables en dev sur des JSON v1 réels) | Aucun |
| **1** ✅ **livrée le 2026-07-31** | Couche Sources : `SOURCES`, adapters, `SourceFeed`, `MOCK_ROWS` re-clé par source. Les Cards restent les `Component` du registre de types mais consomment `<SourceFeed>`. Écarts assumés : ligne **aplatie** `{ id, …alias }` via `flattenRows` (mock et live traversent les mêmes mappers), état lu sur `res.isLoading`/`res.error` (l'API Softr n'a pas de `status` textuel), `loading`/`error` exposés mais pas encore affichés (phase 2). | Faible | Aucun |
| **2** ✅ **livrée le 2026-07-31** | Type `list` + `GenericRow`/`GenericList` + `ListView` + `ListOptions`, ⋮ **Options** branché (`WidgetOptionsCtx` → `persistCfg`). `notesInstallateurs`/`notesProspects` deviennent des listes génériques à cfg par défaut figée (clés de type inchangées). Écarts assumés : `unit` ajouté à `ListCfg` (sous-titre « 7 notes ») ; sélecteur de source non limité aux `connected` (une source non branchée reste choisissable, mention « (non connectée) ») — sinon un widget existant ne serait plus éditable sans perdre sa source ; rôle vidé stocké en `""` (et non `undefined`, que `JSON.stringify` supprimerait) ; le pied « Voir toutes les notes » (bouton inerte) disparaît ; les types sur-mesure n'affichent plus de ⋮ décoratif. | Moyen | **Options enfin actif** |
| **3** ✅ **livrée le 2026-07-31** | Multi-instances : `addInstance`/`duplicateInstance`/`removeInstance`, galerie « Ajouter un widget » (`PRESETS` **générés** : 1 par type sur-mesure + 1 liste par source), Dupliquer et Supprimer dans le ⋮ d'édition. `cfg` clonée en profondeur (`cloneCfg`), ids `w_xxxxxx` sans collision avec `seeded`. | Moyen | **La vraie personnalisation** |
| **4** | Type `kpi` + branchement des sources SAV/notes/tâches au fil des connexions Softr. | Faible | Widgets KPI |

Chaque phase se teste sur la page publiée avec ta propre ligne `Preferences`
avant généralisation.

---

## 8. Hors périmètre — assumé et documenté

- **Grille libre (x, y, w, h)** : non. L'ordre linéaire + moitié/pleine +
  3 hauteurs couvre 90 % du besoin pour un coût 10 fois moindre (le DnD grille
  libre sans lib externe, dans une iframe, en container query, est un projet en
  soi). Le schéma reste extensible : des champs **additifs optionnels** sur
  `Instance` (comme `wide`/`sizes` l'ont été en v1) permettront un `v:3` sans
  casse si le besoin devient réel.
- **`layout_mobile_json`** : la container query fait déjà le travail (1 colonne
  sous 720 px de largeur de *bloc*). Le champ reste en réserve.
- **État « lu » persistant des notifications** : orthogonal à cette refonte ;
  les deux pistes connues restent valables (table `Notification Center` avec
  `Statut de lecture` natif, ou champ `Lu` + automation).
- **Pagination serveur** : `flatten().slice(0, N)` reste le pattern. Le jour
  où une table l'exige, la porte est la variante d'adapter paramétrée
  (`where`/`orderBy` dynamiques sont permis — seule `from` est verrouillée).
- **Dédoublonnage des fetches** : `SourcesHost` + contexte, seulement si mesuré
  nécessaire.
