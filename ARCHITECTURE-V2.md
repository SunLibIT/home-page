# SunLib CRM — Accueil · Architecture cible v2 : widgets pilotés par descripteurs

> **Révision 2** — étend la première version avec la couche **descripteurs**
> (stocker le maximum d'informations en JSON : données véhiculées, affichage,
> actions), la grammaire d'instance `query · view · actions`, et les
> **écritures** déclaratives vers Airtable / Softr Tables.
> Complète `ARCHITECTURE.md` (état actuel). Toutes les contraintes dures Softr
> restent en vigueur — cette cible est conçue *à l'intérieur* de ces
> contraintes, pas contre elles.
>
> ⚠️ **État au 2026-08-04 : les phases 0 à 4 sont livrées, et le bloc lit Airtable
> EN DIRECT** (`USE_MOCK = false`, 6 des 7 sources connectées ; il manque
> `notifC`). La première écriture réelle — la case « Fait » d'une tâche — est
> ouverte. Voir le §12 pour l'état phase par phase, et le §12-bis pour les écarts
> entre le code livré et cette cible.

---

## 0. La question, et la réponse en une phrase

« Comment faire pour que le maximum — les données véhiculées, le type
d'affichage, les actions — soit stocké dans le JSON ? »

**Principe directeur : les moteurs sont du code ; tout ce qu'ils lisent est du
JSON.** Le JSON stocke des *clés* et des *valeurs* ; le code détient les
*implémentations* derrière ces clés (un renderer, un adapter, une icône, un
opérateur de filtre). Le code incompressible par source — imposé par Softr —
tient en ~15 lignes. Tout le reste peut devenir données.

```
   layout_json (v2) — PAR UTILISATEUR         CATALOG — PARTAGÉ (constante JSON)
   items: [{ id, type, cfg, w, h }, …]        descripteurs de sources : champs,
   cfg = { source, query, view, actions }     kinds, badges, presets, actions,
                  │                           formulaire de création
                  ▼                                        │
        WIDGET_TYPES["data"]  ◄────────────────────────────┘
        renderers list / table / kpi · Options générique · runAction
                  │  cfg.source
                  ▼
        <SourceFeed> → dispatch statique → adapters (useRecords + mutations)
                  │                                        ▲
                  ▼ lecture (SELECT_X)                     │ écriture (SELECT_X_W)
              Airtable / Softr Tables ─────────────────────┘
```

Il y a donc **deux JSON, deux portées** — c'est la clarification centrale :

| | Descripteur de source | cfg d'instance |
|---|---|---|
| Décrit | la table : champs, kinds, badges, presets, actions possibles | UN widget posé : quelle source, quels filtres, quelle vue, quelles actions activées |
| Portée | partagé, identique pour tous | par utilisateur |
| Vit dans | constante `CATALOG` de `Block.tsx` (§3, et pourquoi pas en table : §11) | `layout_json` (table `Home Preferences`), comme en rév. 1 |
| Change quand | on branche/décrit une table | l'utilisateur personnalise |

---

## 1. La frontière code ↔ JSON — tracée précisément

| Information | JSON | Code | Pourquoi |
|---|---|---|---|
| ID de datasource | | ✅ `datasource.define`, littéral | contrainte Softr dure |
| `from` des hooks | | ✅ 1 adapter par source | contrainte Softr dure |
| Noms de champs exacts / FIELD IDs | (expérience §9) | ✅ `SELECT_*` | seul endroit toléré ; c'est aussi la whitelist d'écriture |
| Alias, libellés, kinds, options, `writable` | ✅ descripteur | | |
| Couleurs de badge par valeur métier | ✅ descripteur | `statusVariant` en repli | |
| Presets « prêts à poser » | ✅ descripteur | | |
| Actions (écritures, liens, création) | ✅ descripteur + cfg | exécuteur générique `runAction` | |
| Type d'affichage + réglages | ✅ `cfg.view` | renderers génériques | |
| Filtres / tri / limite | ✅ `cfg.query` | `applyView` pure | |
| Disposition (ordre, largeur, hauteur) | ✅ `layout_json` | moteur (inchangé) | |
| Icônes | ✅ clé string | map `ICONS` | pas d'import dynamique possible |

Corollaire pratique : **ajouter un style d'affichage = 1 renderer écrit une
fois, disponible pour toutes les sources pour toujours**. Ajouter une source =
~15 lignes de code contraint + ~35 lignes de pur JSON descriptif (§10).

---

## 2. Couche SOURCES — adapters lecture **et écriture**

### 2.1 Deux selects par source : lecture large, écriture étroite

```tsx
/* Lecture : tout ce que les widgets peuvent AFFICHER. */
const SELECT_SAV = q.select({
  ident: "ID", client: "Client", statut: "Statut",
  priorite: "Priorité", debut: "Date de début", fait: "Fait",
});

/* Écriture : LA WHITELIST. Un alias absent d'ici est physiquement
   inécrivable depuis le bloc (Softr répond 400). Ne jamais y mettre un champ
   que l'utilisateur ne doit pas pouvoir modifier. */
const SELECT_SAV_W = q.select({ statut: "Statut", fait: "Fait" });
```

Règles inchangées : noms Airtable **exacts** (espaces finaux compris) pour les
tables Airtable, **FIELD IDs** pour les tables Softr natives ; CREATE en
payload direct, UPDATE enveloppé `{ recordId, fields }`.

### 2.2 L'adapter enrichi — `SourceApi`

```tsx
type Row = { id: string } & Record<string, unknown>;
type SourceState = { rows: Row[]; loading: boolean; error: boolean };
type SourceApi = SourceState & {
  write?: {
    update: (recordId: string, fields: Record<string, unknown>) => Promise<unknown>;
    create?: (values: Record<string, unknown>) => Promise<unknown>;
  };
};

function SavSource({ children }: { children: (s: SourceApi) => React.ReactNode }) {
  const res  = useRecords({ from: DS.savTickets, select: SELECT_SAV, orderBy: q.desc("debut") });
  const updM = useRecordUpdate({ from: DS.savTickets, fields: SELECT_SAV_W });
  const crtM = useRecordCreate({ from: DS.savTickets, fields: SELECT_SAV_W });
  const email = (useCurrentUser()?.email || "").trim();
  const write = email
    ? {
        update: (recordId: string, fields: Record<string, unknown>) =>
          updM.mutateAsync({ recordId, fields }),              // UPDATE enveloppé
        create: (values: Record<string, unknown>) =>
          crtM.mutateAsync(values),                            // CREATE direct
      }
    : undefined;   // pas de session (aperçu « œil ») → écriture court-circuitée, règle existante
  return <>{children({ ...liveState(res), write })}</>;
}
```

Le dispatch statique `SourceFeed` de la rév. 1 est inchangé (un `case` par
source, jamais de `from` variable) ; il fournit désormais un `SourceApi` au
lieu d'un simple `SourceState`. En mock ou source non connectée : `write`
simule localement (mutation d'un état local + note console) pour développer
les actions sans base.

Rappels qui comptent pour ton usage « beaucoup de projets » :

- **Autant de sources qu'on veut.** `define` n'a pas de limite connue, et
  seules les instances **présentes sur la grille** montent leur adapter : une
  source connectée mais qu'aucun widget n'affiche ne coûte **aucun** fetch.
- **Seul `from` est verrouillé.** `where`, `orderBy` et leurs valeurs peuvent
  être dynamiques (la persistance le prouve : `q.text("email").is(email)`).
  Porte ouverte pour du filtrage serveur par instance si une table devient
  grosse.
- **Changement de source dans Options** → remonter le widget avec
  `key={cfg.source}` : l'arbre de hooks de l'adapter est remplacé proprement
  (aucune violation des règles de hooks).

---

## 3. Le CATALOGUE — le descripteur de source, cœur du « tout-en-JSON »

C'est ici que vit « le maximum d'informations sur les données véhiculées ».
Une entrée par source, **pure donnée** :

```tsx
type BadgeVariant = "success" | "info" | "warning" | "danger" | "neutral";
type FieldKind = "text" | "longtext" | "date" | "badge" | "number" | "bool" | "url";

type FieldDesc = {
  label: string;
  kind: FieldKind;
  options?: string[];                       // valeurs possibles (badge / select de formulaire)
  variants?: Record<string, BadgeVariant>;  // valeur métier → couleur (repli : statusVariant)
  // NB : `writable` n'a PAS été retenu — ce qui est écrivable est déterminé par le SELECT_*_W
  // de l'adapter (la seule barrière réelle), pas par une donnée falsifiable côté client.
};

type ActionDesc =
  | { id: string; label: string; kind: "set";    set: Record<string, unknown>; confirm?: string }
  | { id: string; label: string; kind: "toggle"; field: string }
  | { id: string; label: string; kind: "link";   href: string; target?: "_top" | "_blank" };
    // href : gabarit avec {alias} interpolés depuis la ligne, ex. "…/sav?recordId={id}"

type CreateFormDesc = {
  label: string;                            // ex. "Nouveau dossier"
  fields: { field: string; required?: boolean; default?: unknown }[];
  // default "@me.email" → résolu à l'exécution avec useCurrentUser().email
};
/* ⚠️ SUSPENDU depuis le 2026-08-04 : plus AUCUNE source ne déclare de `create`.
   Deux raisons découvertes en ouvrant le direct — (1) les champs du formulaire
   doivent tous être dans le SELECT_*_W, sinon Softr répond 400 ; (2) rattacher la
   ligne créée passe par un champ LIEN, qui attend un record id et non un nom, si
   bien qu'une note ou une tâche créée depuis l'accueil n'apparaîtrait sur la fiche
   de personne. Le type reste défini et `QuickCreate` reste écrit : ils attendent un
   `kind: "link"` de champ, alimenté par la table parente. */

type PresetDesc = { label: string; icon: string; cfg: InstanceCfg };  // cfg complète (§4)

type SourceDesc = {
  key: SourceKey;
  label: string;
  icon: string;                             // clé de la map ICONS (voir note)
  technical?: boolean;                      // plomberie : décrite, mais absente de la galerie
                                            // (`notifC` : personne ne « pose » un état de lecture)
  fields: Record<string, FieldDesc>;        // clés = ALIAS du SELECT_* — jamais les noms bruts
  defaultSort: { by: string; dir: "asc" | "desc" };
  presets: PresetDesc[];
  actions?: ActionDesc[];                   // actions PAR LIGNE offertes par la source
  create?: CreateFormDesc;                  // formulaire de création rapide (bouton « + »)
};

const CATALOG: Record<SourceKey, SourceDesc> = { /* … une entrée par source … */ };
```

Exemple complet — le futur widget du projet **Pilotage SAV** :

```tsx
savTickets: {
  key: "savTickets",
  label: "Dossiers SAV",
  icon: "Wrench",
  fields: {
    ident:    { label: "N° dossier", kind: "text" },
    client:   { label: "Client",     kind: "text" },
    statut:   { label: "Statut",     kind: "badge",
                options: ["Nouveau", "En cours", "En attente tiers", "Clos"],
                variants: { "Nouveau": "info", "En cours": "warning",
                            "En attente tiers": "neutral", "Clos": "success" } },
    priorite: { label: "Priorité",   kind: "number" },
    debut:    { label: "Début",      kind: "date" },
    fait:     { label: "Fait",       kind: "bool", writable: true },
  },
  defaultSort: { by: "debut", dir: "desc" },
  presets: [
    { label: "SAV en cours", icon: "Wrench",
      cfg: { source: "savTickets",
             query: { filter: [{ field: "statut", op: "neq", value: "Clos" }], limit: 12 },
             view:  { kind: "list", map: { title: "client", sub: "ident", date: "debut", badge: "statut" } },
             actions: { use: ["clore", "detail"] } } },
    { label: "SAV ouverts (KPI)", icon: "Gauge",
      cfg: { source: "savTickets",
             query: { filter: [{ field: "statut", op: "neq", value: "Clos" }] },
             view:  { kind: "kpi", agg: "count", compareDays: 30 } } },
  ],
  actions: [
    { id: "clore",  label: "Clore",  kind: "set", set: { statut: "Clos" },
      confirm: "Clore ce dossier ?" },
    { id: "fait",   label: "Fait",   kind: "toggle", field: "fait" },
    { id: "detail", label: "Détail", kind: "link",
      href: "https://sunlibcrm2.softr.app/sav?recordId={id}", target: "_top" },
  ],
  create: { label: "Nouveau dossier",
            fields: [{ field: "client", required: true },
                     { field: "statut", default: "Nouveau" }] },
},
```

**Note icônes** : un JSON ne peut pas contenir un composant. Le descripteur
stocke une *clé* (`"Wrench"`) résolue par une map de code
`const ICONS: Record<string, LucideIcon> = { Wrench, Bell, Gauge, … }` —
illustration du principe « clés en JSON, implémentations en code ».

**Presets : copie, pas référence.** À la pose d'un preset, sa `cfg` est
**copiée** dans l'instance. L'instance est autoportante : elle survit aux
évolutions du catalogue, et modifier un preset ne réécrit pas les accueils
existants (compromis assumé — c'est aussi l'esprit « maximum d'infos dans le
JSON » de l'utilisateur).

---

## 4. Le type générique `data` — la grammaire d'instance

Un **seul** type générique remplace les `list`/`kpi` séparés de la rév. 1 :

```tsx
type WidgetTypeKey =
  | "notifs" | "taches" | "notesInstallateurs" | "notesProspects"
  | "linkedin" | "linkedinBanner" | "annonces"   // legacy — clés figées (contrat)
  | "sav"                              // synthèse sur-mesure du bloc « Pilotage SAV »
  | "horloge" | "memo" | "checklist"   // utilitaires SANS source : le contenu EST la cfg
  | "data";                            // LE type générique piloté par cfg
```

Pourquoi un seul : le `type` est un **contrat de persistance** (jamais
renommé), alors que la **vue** doit rester librement modifiable. En mettant la
vue dans la cfg, un widget passe de liste à tableau à KPI **dans le panneau
Options, sans changer de type** — donc sans migration.

```tsx
type Filter = { field: string;
                op: "eq" | "neq" | "contains" | "gt" | "lt" | "lastDays" | "isEmpty" | "notEmpty";
                value?: string | number };

type InstanceCfg = {
  title?: string;                       // défaut : label du descripteur
  source: SourceKey;
  query: { filter?: Filter[];           // combinés en ET
           sort?: { by: string; dir: "asc" | "desc" };
           limit?: number };            // défaut RECENT (12)
  view:
    | { kind: "list";  map: { title: string; sub?: string; date?: string; badge?: string };
        density?: "cozy" | "dense" }
    | { kind: "table"; columns: { field: string; width?: number }[] }
    | { kind: "kpi";   agg: "count" | "sum" | "avg"; field?: string;
        compareDays?: number; goal?: number };
  actions?: { use: string[] };          // ids d'ActionDesc du descripteur, activés ici
  create?: boolean;                     // afficher le bouton « + » (quickCreate du descripteur)
};
```

Le `Render` du type `data` est le seul « aiguillage » d'affichage :

```tsx
Render: ({ id, cfg }: { id: string; cfg: InstanceCfg }) => (
  <SourceFeed source={cfg.source} key={cfg.source}>
    {(s) => {
      const rows = applyView(s.rows, cfg, CATALOG[cfg.source]);   // filtres/tri/limite — PURE
      const V = cfg.view.kind === "table" ? GenericTable
              : cfg.view.kind === "kpi"   ? GenericKpi
              : GenericList;
      return (
        <Widget icon={ICONS[CATALOG[cfg.source].icon]}
                title={cfg.title || CATALOG[cfg.source].label} /* … */>
          <V rows={rows} cfg={cfg} desc={CATALOG[cfg.source]} api={s} />
        </Widget>
      );
    }}
  </SourceFeed>
),
```

Les renderers (`GenericList`, `GenericTable`, `GenericKpi`) formatent chaque
champ selon son `kind` (date → `fmtRel` + absolu en `title`, badge →
`variants` du descripteur avec repli `statusVariant`, bool → coche, etc.).
Toutes les transformations (`applyView`, `matchFilter`, `compareBy`,
`aggregate`) sont des **fonctions pures**, identiques en mock et en live.

**Limite KPI assumée** : les agrégats portent sur les lignes *chargées*
(pattern actuel : les N récentes) — exact pour les volumes SAV/notes/tâches.
Pour un vrai total sur grosse table : variante d'adapter sans limite, ou
rollup côté Airtable lu en une ligne.

---

## 5. ACTIONS — écrire en base depuis un widget, déclarativement

L'exécuteur est générique, minuscule, écrit une fois :

```tsx
async function runAction(a: ActionDesc, row: Row, api: SourceApi): Promise<boolean> {
  if (a.kind === "link") { /* interpole {alias} depuis row, rend un <a target> */ return true; }
  if (!api.write) { notify("Écriture indisponible (aperçu non connecté)"); return false; }
  if (a.kind === "set") {
    if (a.confirm && !(await confirmInline(a.confirm))) return false;   // jamais window.confirm
    await api.write.update(row.id, a.set); return true;
  }
  if (a.kind === "toggle") { await api.write.update(row.id, { [a.field]: !row[a.field] }); return true; }
  return false;
}
```

Retour visuel : optimisme **local** le temps du refetch (même pattern que les
`readIds` actuels — la ligne est mise à jour/retirée d'un état local, la BDD
reste source de vérité). Échec → toast avec « Réessayer », comme la
persistance du layout.

**Sécurité — à graver** : tout JSON côté client (descripteur compris) est
falsifiable par un utilisateur outillé. Le descripteur est de l'**UX**, jamais
de la sécurité. Les vrais garde-fous sont : (1) la whitelist `SELECT_*_W` — un
champ absent est inécrivable, point ; (2) la session obligatoire (email vide →
aucune tentative) ; (3) les permissions de la datasource côté Softr ;
(4) `confirm` pour les actions sensibles.

Ce que ça a débloqué, au 2026-08-04 : la case **« Fait »** des tâches est
**réellement écrite** (première écriture métier du bloc, whitelist `fait` seul) ;
**« Marquer comme vu »** est écrit dans « Notification Center » — le code est là,
il attend que la table soit connectée à ce bloc. En revanche l'**ajout rapide**
d'une note ou d'une tâche est **retiré** : le rattachement passe par un champ
LIEN (voir la note du §3). Un dossier SAV, lui, ne se modifie pas d'ici par
choix : l'accueil en est un lecteur, son bloc dédié porte les validations.

---

## 6. INSTANCES & `layout_json` v2 — inchangé, cfg enrichie

Schéma identique à la rév. 1 (seul `"data"` s'ajoute aux types) :

```tsx
type Instance = { id: string; type: string; cfg: unknown; w: "half" | "full"; h: WidgetSize;
                  preset?: string };   // ← modèle de galerie d'origine : un seul exemplaire
type Layout = { v: 2; items: Instance[]; parked: Instance[]; seeded: string[] };
```

> **`preset` (2026-08-03)** — la galerie n'autorise plus qu'un exemplaire de chaque modèle, et le
> garde vit dans `addInstance` (fonction pure), pas seulement dans l'UI. Le champ est **facultatif** :
> les instances déjà en base n'en ont pas, et le repli est `type` — juste pour tous les types
> sur-mesure, dont la clé de modèle *est* la clé de type. On tolère l'existant, on ne réécrit pas.
> `type` est passé à `string` (et non `WidgetTypeKey`) pour pouvoir conserver sans perte une
> instance dont le type est inconnu du code courant (`parked`).

> ⚠️ **`hidden` a été retiré le 2026-08-03** — masquer faisait doublon avec supprimer.
> Un widget dont on ne veut plus se supprime, et se repose depuis la galerie (perte de
> cfg assumée). `normalizeLayout` lit encore `hidden` pour les documents déjà écrits et
> remonte leurs instances en visible ; il ne l'écrit plus. Détail dans `ARCHITECTURE.md`
> § « Multi-instances ».

Rappels des règles (détaillées en rév. 1, toujours valables) :

- `id` et `type` = contrats de persistance, jamais renommés. Migrés v1 →
  `id` = ancien `WidgetId`, `type` du même nom ; nouveaux → `"w_" + aléa`.
- `cfg` stockée **brute**, interprétée au rendu par `coerce` du type (merge
  défauts + clamp, ne throw jamais). On tolère à la lecture, on ne « répare »
  jamais le stockage. Avec la grammaire §4, `coerce` devient encore plus
  central : c'est lui qui absorbe les cfg écrites par d'anciennes versions.
- `parked` (types inconnus, jamais rendus ni perdus), `seeded`
  (anti-résurrection des défauts supprimés), `seed()` et `migrateV1` :
  identiques à la rév. 1.
- Un exemple de ligne réelle en base, pour fixer les idées :

```json
{ "v": 2,
  "items": [
    { "id": "notifs", "type": "notifs", "cfg": {}, "w": "half", "h": "md" },
    { "id": "w_k3f9a2", "type": "data", "w": "half", "h": "sm",
      "cfg": { "source": "savTickets",
               "query": { "filter": [{ "field": "statut", "op": "neq", "value": "Clos" }] },
               "view": { "kind": "kpi", "agg": "count", "compareDays": 30 },
               "title": "SAV ouverts" } }
  ],
  "parked": [], "seeded": ["notifs","taches","notesInstallateurs",
  "notesProspects","linkedin","linkedinBanner"] }
```

---

## 7. Persistance — Option A confirmée, rien ne bouge

Tout le document v2 dans le seul `layout_json` ; champs écrits :
`user_email` (création), `layout_json`, `updated_at`, plus
**`schema_version = 2`** (coût nul, diagnostic direct dans la grille). 1 ligne
par utilisateur, optimiste + toast, cache `slb-home-layout:<email>`,
last-write-wins, écriture uniquement à « Enregistrer ». Le `CATALOG`, lui,
n'est **pas** persisté : il voyage avec le code (§11 pour l'option table).

> Mise à jour 2026-07-31 : la table de persistance est passée de **Softr Tables
> à AIRTABLE** — base `SunLib CRM — Préférences` (`appHZaD5BkDsWxR65`), table
> `Home Preferences`, datasource `dcc7928c-3906-4807-8224-0532c3e30fc5`, 4 champs
> tous écrits, adressés par **noms exacts** (les FIELD IDs étaient une obligation
> propre aux tables Softr natives). Détail : `ARCHITECTURE.md` §4.

---

## 8. UI — Options générées par la grammaire, galerie générée par le catalogue

Le ⋮ **Options** devient **un seul formulaire générique** pour toutes les
instances `data`, entièrement alimenté par le descripteur :

1. **Source** — sélecteur limité aux `connected` ; changer de source propose
   les presets de la nouvelle source (remontage via `key={cfg.source}`).
2. **Vue** — segments Liste / Tableau / KPI, puis les réglages de la vue :
   menus de mappage ou de colonnes nourris par `descripteur.fields`
   (libellés + kinds), agrégat/comparaison pour KPI.
3. **Données** — filtres combinables (champ / opérateur selon le `kind` /
   valeur, avec `options` en menu pour les badges), tri, limite.
4. **Actions** — cases à cocher parmi les `ActionDesc` de la source ; toggle du
   bouton « + » si `create` existe — **aucune source n'en déclare plus** depuis le
   2026-08-04 (§3), la case n'apparaît donc nulle part.

« Enregistrer » du panneau → même pipeline `persist` (optimiste + toast), en
remplaçant la `cfg` de l'instance. En mode **Personnaliser** : Supprimer, et la
galerie **« Ajouter un widget »** rassemble les `presets` de tous les descripteurs
+ les types sur-mesure, **regroupés en dépliants par famille métier**
(`GALLERY_GROUPS`), un seul groupe ouvert à la fois.
Le moteur (DnD, FLIP, poignées, grille) ne bouge pas.

> Deux gestes de la rév. 1 ont été **retirés** le 2026-08-03 : **Masquer** (doublon
> de Supprimer) et **Dupliquer** (raccourci peu utilisé). Détail et raisons dans
> `ARCHITECTURE.md` § « Multi-instances ».

---

## 9. L'expérience « select dynamique » — repousser la dernière frontière

La seule information encore en code qui *pourrait* passer en JSON : les noms
de champs exacts (`SELECT_*`). Rien dans les contraintes documentées
n'interdit `q.select(obj)` avec un objet construit à l'exécution — seul `from`
est explicitement verrouillé. **Mais** l'éditeur Softr fait de l'analyse du
bloc (l'erreur « Remap the fields » le prouve), donc c'est à tester, pas à
supposer.

Protocole (15 min, sur UNE source secondaire) :

1. Dans le descripteur, ajouter `at:` à chaque champ
   (`client: { at: "Client", … }`) et générer
   `q.select(Object.fromEntries(Object.entries(desc.fields).map(([a, f]) => [a, f.at])))`.
2. Coller, **rouvrir l'onglet Sources** (vérifier le comportement du remap),
   publier, tester **lecture ET écriture** connecté.
3. ✅ → v3 : les noms de champs migrent dans le descripteur, la recette perd
   une étape. ❌ (« Remap the fields », 400, lecture vide) → on reste sur
   `SELECT_*` en code : coût 6 lignes/source, chemin éprouvé.

Ne pas généraliser avant ce test : les contraintes Softr ont déjà surpris.

---

## 10. LA RECETTE mise à jour — « nouveau projet → widget »

À donner telle quelle à une future session Claude Code.

| # | Où | Quoi | Volume |
|---|---|---|---|
| 1 | Softr Studio | `/home-copy` → bloc → onglet **Sources** : connecter la/les table(s) du projet, noter les IDs | 0 ligne |
| 2 | `Block.tsx` | Littéral(aux) dans `datasource.define` | 1 ligne |
| 3 | `Block.tsx` | `SELECT_X` lecture (+ `SELECT_X_W` si écriture) — noms exacts / FIELD IDs | 6–10 lignes |
| 4 | Couche Sources | Adapter `XSource` (copier-coller) + `case` dans `SourceFeed` | ~12 lignes |
| 5 | `CATALOG` | **Le descripteur : pur JSON** — champs, kinds, options, variants, defaultSort, presets, actions, create | ~35 lignes |
| 6 | (option) | `MOCK.x` à la forme des alias | ~8 lignes |

**≈ 50 lignes, dont ~35 de pur JSON descriptif. Zéro toucher au moteur, aux
renderers, à la persistance.** La source apparaît dans le sélecteur, ses
presets dans la galerie, ses actions dans Options. Vérifications : `npm run
build` ; page **publiée, connecté** (l'aperçu « œil » n'a pas de session —
indispensable pour tester les écritures) ; parité mock/live.

Cas B (rare désormais) : rendu vraiment spécifique → un `WidgetTypeDef` dédié
en plus, qui consomme le même `SourceFeed`.

### Prompt-type pour la future session

> Nouvelle source pour l'accueil : table Airtable « Dossiers SAV » (base SAV),
> datasource ID `xxxx-…`, déjà connectée dans l'onglet Sources du bloc
> `/home-copy`. Champs : ident `ID`, client `Client`, statut `Statut`
> (valeurs : Nouveau / En cours / En attente tiers / Clos), priorite
> `Priorité`, debut `Date de début`, fait `Fait` (inscriptible). Applique la
> **recette §10** d'`ARCHITECTURE-V2.md` : SELECT lecture + écriture (statut,
> fait), adapter, descripteur `CATALOG` complet avec le preset liste « SAV en
> cours », le preset KPI « SAV ouverts », les actions clore / fait / détail,
> et le formulaire de création rapide. MOCK : 5 dossiers.

---

## 11. Plus tard : le catalogue en table (édition sans recoller le bloc)

Le descripteur vit en constante dans `Block.tsx` — choix délibéré : **ajouter
une source impose de toute façon un collage** (littéral `define` + adapter),
donc le JSON voyage gratuitement avec, versionné par git et vérifié par
TypeScript.

Si un jour le besoin de retoucher *sans repaste* devient réel (libellés,
couleurs, presets, actions), l'extension est prête : une table `Catalog`
(comme `Home Preferences`), lignes `{ key, json }`, lue au boot et
**deep-mergée par-dessus** le `CATALOG` code — repli intégral sur le code si
vide/invalide (un JSON édité à la main ne doit jamais pouvoir casser l'accueil
de tout le monde). À ne faire que si le besoin est mesuré.

---

## 12. Plan de migration — état réel au 2026-08-04

Les phases 0 à 4 ci-dessous ont été livrées **dans leur forme rév. 1**. La
colonne « reste à faire » dit ce que la rév. 2 y ajoute.

| Phase | Contenu | État | Ce que la rév. 2 ajoute |
|---|---|---|---|
| **0** | Schéma v2 + `migrateV1` + `seeded`/`parked` | ✅ **livré** | rien |
| **1** | `SourceFeed` + adapters + catalogue décrivant les sources | ✅ **livré** — descripteur `CATALOG` complet : `SourceDesc`/`FieldDesc`, `options` (vraies valeurs Airtable), `variants` + `variantOf`, `icon` en clé + map `ICONS`, `defaultSort`, **`presets`**, **`actions`**, **`create`** | — |
| **2** | Type générique + Options branché | ✅ **livré** — type **`data`** unique, grammaire `query`/`view`, `DataOptions` (un seul formulaire) ; `list`/`kpi` conservés en types **dépréciés** dont `fromLegacyCfg` traduit la cfg plate | — |
| **3** | Galerie de presets + multi-instances | ✅ **livré** — les presets sont désormais **déclarés dans le catalogue** (`presetsOf`) ; une source sans preset en reçoit un par défaut | — |
| **4** | Vues kpi et table + **actions d'écriture** | ✅ **livré et branché (2026-08-04)** — vues `kpi` **et `table`** ; `SELECT_*_W` (whitelists), `SourceApi.write`, `RowActions` (`set`/`toggle`/`link` + confirmation inline) ; les adapters des 5 tables métier existent, la case « Fait » est la première écriture réelle | ⚠️ **`QuickCreate` est écrit mais plus utilisé** : les 4 formulaires de création ont été retirés, un champ LIEN attendant un record id (voir ci-dessous) |
| **5** | Nouveaux projets via la recette §10 ; expérience §9 (select dynamique) | 🟡 **la recette a servi 5 fois** (les 5 sources branchées le 2026-08-04, sans toucher au moteur) ; l'expérience §9 **reste à tenter** | — |

**Ce que le passage en direct a appris — à savoir avant d'écrire la suite :**

- **Les champs exposés dépendent de la CONNEXION, pas de la table.** La datasource
  Softr de « Taches » n'expose que 3 des 12 champs de la table. Un champ déclaré
  dans un `SELECT_*` mais absent de la datasource désynchronise la source et
  **bloque toute écriture sur la table** (constaté sur le bloc SAV le 2026-08-03).
  Le remède est de remapper la source, pas de corriger le code.
- **Écrire un champ LIEN est hors de portée de la grammaire actuelle** : il attend
  un **record id**, pas un libellé. C'est ce qui a fait retirer les 4 formulaires
  de création — celui des tâches était de surcroît cassé par construction (champs
  hors whitelist → 400, invisible tant que rien n'était connecté). Les rétablir
  demande un `kind: "link"` de champ, dont la valeur serait alimentée par la table
  parente : c'est le prochain vrai morceau de la couche descripteurs.
- **Vérifier les noms de champs contre Airtable avant d'ouvrir une lecture**, et
  non les reprendre du README : les 7 pièges attendus (espaces finaux, casses
  irrégulières) étaient exacts, mais c'est la vérification qui le prouve.

Reste, indépendant de la refonte : connecter **`notifC`** (« Notification
Center ») pour que l'état lu / non lu existe, et renseigner les **URLs** de
`QUICK_LINKS`.

## 12-bis. Écarts entre le code livré et cette cible

À traiter en tête du chantier rév. 2 :

1. ~~**`list` et `kpi` existent déjà comme clés de type livrées**~~ **traité** : conservés comme
   types **dépréciés**, rendus par `DataView`, cfg traduite par `fromLegacyCfg` (filtre unique →
   liste, `map` → `view.map`, `dateField`/`compareDays` → `view` kpi). 11 assertions dédiées.
2. ~~**`SOURCES` → `CATALOG`**~~ **fait (2026-07-31)** : renommé et enrichi —
   `key`, `icon` (clé + map `ICONS`), `options`, `variants` (+ `variantOf`, repli
   sur `statusVariant`), `defaultSort`, `kind` élargi (`longtext`, `url`).
   `writable` est reporté à l'étape des écritures, `presets`/`actions`/`create` à
   celle de la grammaire — pour ne pas déclarer du JSON que rien ne lit encore.
   `defaultMap` reste : il devra devenir le `view.map` des presets.
3. ~~**`ListCfg`/`KpiCfg` → `InstanceCfg`**~~ **fait** : grammaire `query`/`view` en place, filtre
   unique devenu une **liste combinée en ET**, `unit` conservé (sous-titre « 7 notes »).
4. ~~**Presets générés en code → déclarés en JSON**~~ **fait** : `SourceDesc.presets` alimente la
   galerie via `presetsOf` ; les types sur-mesure restent proposés pour être ré-ajoutés.
5. ~~**`connected`**~~ **conservé** dans `SourceDesc`, comme prévu.
6. ~~**Styles**~~ **respecté** : `GenericTable` pose sa mise en page (table, en-tête collant,
   colonnes, filets) **en style inline**, jamais via des classes.
7. ~~**Icônes en clé (`ICONS`)**~~ **fait**.

---

## 13. Hors périmètre — assumé

Identique à la rév. 1 : grille libre (x, y) — le schéma `Instance` reste
extensible par champs additifs ; `layout_mobile_json` — la grille responsive
suffit ; pagination serveur — porte ouverte via `where`/`orderBy` dynamiques ;
dédoublonnage des fetches (`SourcesHost`) — seulement si mesuré nécessaire.
