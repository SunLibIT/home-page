# Architecture — Page d'accueil du CRM SunLib

> État des lieux du fonctionnement **actuel** du bloc : plateforme, anatomie du code,
> mécanique des widgets, et surtout **où et comment la data est persistée**.
> Document de référence destiné à préparer la refonte du système de widgets ;
> la cible et son plan de migration vivent dans `ARCHITECTURE-V2.md`.
> Dernière mise à jour : 2026-07-31 — **la cible v2 est livrée jusqu'à sa RÉVISION 2** :
> disposition par instances (`migrateV1`, `seeded`/`parked`) ; couche SOURCES et **descripteur
> `CATALOG`** ; **type générique unique `data`** (grammaire `query`/`view` → vues liste, tableau,
> indicateur) avec un **formulaire d'options unique** ; multi-instances (galerie de presets
> **déclarés dans le catalogue**, regroupés en dépliants par famille) ; **actions d'écriture déclaratives**
> (`RowActions`, `QuickCreate`) ; persistance passée **sur Airtable**.
> Reste à faire, hors refonte : brancher les **4 sources métier** encore en mock (recette
> `ARCHITECTURE-V2.md` §10) — ce qui activera la première écriture réelle — puis passer
> `USE_MOCK` à `false`.

---

## 1. Nature du projet et contraintes de plateforme

**Livrable unique : `Block.tsx` (3488 lignes).** On copie-colle ce seul fichier dans un bloc
« vibe coding » de Softr (`sunlibcrm2.softr.app`, page `/home-copy`). Le bloc s'exécute
**dans une iframe** au sein de la page Softr. Tout le reste du repo (`src/`, `package.json`,
`vite.config.ts`) est un **scaffold Vite de dev** qui *simule* l'environnement Softr en local
et n'est **jamais livré** :

```
home-page/
├─ Block.tsx                 ← LE LIVRABLE
└─ src/                      ← DEV uniquement (mocks de l'API Softr)
   ├─ App.tsx                barre de dev + rendu de Block
   ├─ dev/seed.ts            données fictives
   ├─ lib/datasource.tsx     MOCK de l'API datasource Softr + store réactif
   ├─ lib/user.tsx           MOCK de useCurrentUser()
   └─ components/ui/card.tsx MOCK du <Card> Softr
```

### Contraintes dures Softr (chèrement acquises — à ne pas transgresser dans la refonte)

| Règle | Détail |
|---|---|
| **Styles : le fonctionnel en INLINE** | Softr style ses blocs avec **Tailwind** ; rien ne garantit qu'une balise `<style>` injectée dans `document.head` atteigne le bloc, ni que l'attribut `id` du conteneur survive. Constaté en collant le bloc : widgets **collés sans gouttière**, « pleine largeur » **sans effet**, corps de widget qui s'étire au lieu de scroller. → **Toute mise en page, dimension ou débordement doit être en style inline** (grille + `gap`, hauteur du corps scrollable, troncature, filets). `StyleInjector` ne garde que du cosmétique (hover, focus, scrollbars, keyframes) et ses sélecteurs de classe ne sont plus préfixés par `#slb`. |
| **Container queries : non** | Le nombre de colonnes se mesure en JS (`ResizeObserver` sur la grille), pour la même raison. |
| **Animations** | Une animation nécessaire doit passer par la **Web Animations API** (`element.animate()`), pas par des `@keyframes` injectés — c'est ainsi qu'est animé le dégradé du héro. Les `@keyframes` restants ne portent que des effets dont l'absence ne casse rien. |
| **Imports autorisés** | UNIQUEMENT `react`, `lucide-react`, `@/components/ui/card`, `@/lib/datasource`, `@/lib/user`. Aucune lib externe, aucune Google Font. |
| **`datasource.define`** | Un seul appel, IDs en **littéraux inline**. Ne doit contenir QUE des IDs réellement connectés dans l'onglet *Sources* du bloc — un ID placeholder fait planter le bloc (« New data source does not match / Remap the fields »). |
| **`from` des hooks** | Doit être **directement** un membre du `define` (`DS.abonnes`) ou un littéral string. **Jamais** une prop, une variable ou un élément de tableau. → *Il est impossible d'écrire un composant générique `<Feed from={x}>`* (approche testée et abandonnée). C'est LA contrainte structurante. |
| **`q.select({ alias: … })`** | Les **valeurs** sont soit les noms de champs Airtable exacts (tables Airtable), soit les **FIELD IDs Softr** (tables Softr natives). Pour les tables Softr natives, utiliser le nom de champ fait échouer l'écriture avec `Failed to add record: 400`. Filtres/tris se font par **alias**. |
| **CREATE ≠ UPDATE** | `createM.mutateAsync({ alias: valeur })` **direct, sans enveloppe** · `updateM.mutateAsync({ recordId, fields: { alias: valeur } })` **enveloppé**. |
| **Lecture paginée** | `res.data.pages.flatMap(p => p.items)` → helper `flatten()`. |
| **Utilisateur** | `useCurrentUser()` (jamais `window.logged_in_user`) → renvoie `{ id, email, name }`, **pas** de `firstName`. Le prénom est dérivé de `name` avec repli sur l'e-mail. |
| **Écriture impossible sans session** | L'aperçu « œil » de Softr n'est pas connecté → `email` vide → l'insert est refusé. Toute écriture est court-circuitée si `email` est vide. Il faut tester sur la page **publiée**, connecté. |
| **Navigation** | Le bloc est en iframe → liens inter-pages en `<a target="_top">`. |
| **Interrupteur global** | `const USE_MOCK: boolean = true` (`Block.tsx:72`). Seul commutateur mock ↔ live. |

Réf. plateforme : <https://docs.softr.io/vibe-coding-developer-guide.md>

---

## 2. Anatomie de `Block.tsx`

| § | Contenu |
|---|---|
| 0 | `USE_MOCK` |
| 1-2 | `IMG`, thème `T` (couleurs/rayons/ombres), styles constants (`CARD`, `WHEAD`, `TABBAR`…), `StyleInjector()` qui injecte une balise `<style>` unique `#slb-styles` |
| 3 | `Badge` / `statusVariant` (statut métier → variante de couleur) |
| 4 | `TabBar` (onglets réutilisables avec pastille compteur) |
| 5 | Helpers de formatage : `fmtDate`, `relDays`, `fmtRel`, `fmtDue`, `dueVariant`, `initials`, `avatarBg`, `firstNameOf` |
| **6** | **Données** : `DS = datasource.define({…})`, tous les `SELECT_*`, types de vue, `flatten`/`flattenRows`, `mapNotif`/`mapTask`/`mapNote`/`isDone`, `MOCK_USER` + `MOCK_ROWS` (indexé par source) |
| **6-bis** | **Couche SOURCES** : `SourceKey`, **descripteur `CATALOG`** (`SourceDesc`/`FieldDesc`), map `ICONS` + `iconOf`, `variantOf`, `isLive`/`liveState`/`offlineState`, adapters (`AbonnesSource`) et dispatch statique **`SourceFeed`** |
| 7 | `NAV_TABS` + `QUICK_LINKS` (URLs, la plupart encore `#`) |
| 8 | Composants de page : `EmptyState`, `WidgetChromeCtx`, `WidgetEditMenu`, **`Widget`** (la coquille), `PageNavBar`, `Hero`, `QuickLinks`, `EmbedTab` |
| 9 | Composants **présentiels** des widgets sur-mesure : `NotifRow`/`NotifWidget`, `TaskRow`/`TasksWidget` |
| **9-quinquies** | **Synthèse SAV** : helpers purs (`savNum`/`savTime`/`savDays`/`savTotal`/`savKpis`), **registre `SAV_METRICS`** (les valeurs cochables), `coerceSavCfg`, `SavOptions`, `SavWidget`, `SavCard` |
| **9-bis** | **Widget GÉNÉRIQUE `data`** : grammaire `InstanceCfg` (`query`/`view`), `coerceCfg` + `fromLegacyCfg` (compat rév. 1), `matchFilter`/`compareRows`/`applyQuery`/`kpiCompute` (purs), présentiels `GenericRow`/`GenericList`/**`GenericTable`**/`GenericKpi`, `FieldValue`, **`DataView`** |
| **9-ter** | **ACTIONS** (écritures déclaratives) : `activeActions`, `interpolate`, `RowActions`, **`QuickCreate`** |
| **9-quater** | **`DataOptions`** — le formulaire d'options UNIQUE, généré par la grammaire + `FilterValueInput` |
| 10 | Enveloppes **data** (une par widget) + **`WIDGET_REGISTRY`** (registre des *types*) + `typeDefOf` |
| **10-bis** | **Modèle de disposition v2** : `Instance`, `Layout`, `DEFAULT_INSTANCES`, **`PRESETS`** (galerie), `seed`, `normalizeLayout`, `migrateV1`, **groupes de galerie** (`GALLERY_GROUPS`/`PRESET_GROUPS`) + fonctions pures (déplacer / largeur / hauteur / **ajouter / supprimer**) |
| 11 | `useHeroCounts`, **`usePersistentLayout`**, `SkeletonCard`, **`Dashboard`** (grille, mode Personnaliser, DnD, FLIP, toast) |
| 12 | `export default function Block()` |

---

## 3. Comment fonctionne un widget — les 3 couches

Chaque widget est composé de **trois couches distinctes** ; c'est le cœur de l'architecture actuelle.
Depuis la phase 1, une **quatrième couche transversale** les alimente : les *sources* (§6-bis,
détaillée en fin de section).

### Couche A — le composant présentiel (§9 / §9-bis)

Pur affichage, reçoit ses données en props. Ex. `NotifWidget({ items, onRead, onReadAll })`,
`TasksWidget({ prospects, partenaires })`. Chacun rend une coquille `<Widget>` dont la liste est
enveloppée dans `<div className="slb-scrolly">` (scroll individuel du widget).

Depuis la phase 2, les widgets « liste » n'ont plus de présentiel dédié : ils partagent
**`GenericRow`/`GenericList`** (§9-bis), qui reprend exactement l'ancien gabarit `NoteRow`
(pastille d'initiales, titre + date alignés, détail clampé sur 2 lignes) et rend chaque rôle selon
le `kind` du champ mappé — `date` → `fmtSmart` + date absolue en `title`, `badge` → `StatusBadge`.
`GenericList` gère aussi les états **chargement** (squelette de lignes) et **erreur**.

### Couche B — l'enveloppe « data », consommatrice d'une SOURCE (§10)

Un composant sans props par widget. Depuis la phase 1 il n'appelle plus `useRecords` lui-même :
il consomme une **source** via `<SourceFeed>` (§6-bis) et mappe les lignes :

```tsx
function NotifsCard() {
  const [readIds, setReadIds] = useState<string[]>([]);           // « lu » = masquage LOCAL
  return (
    <SourceFeed source="abonnes">
      {(s) => {
        const all = s.rows.slice(0, RECENT).map(mapNotif);
        return <NotifWidget items={all.filter(n => !readIds.includes(n.id))} onRead={…} onReadAll={…} />;
      }}
    </SourceFeed>
  );
}
```

Un widget à **deux sources** (`TachesCard`) imbrique simplement deux `<SourceFeed>`.
Un widget dont la source n'est pas connectée reçoit le mock (aperçu) ou une liste vide (live) —
son état vide guidant s'affiche alors, sans qu'aucun `useRecords` ne soit appelé.
**Les trois embeds Elfsight** (`linkedin` = fil LinkedIn, `linkedinBanner` = bannière « À la une »,
`annonces` = barre d'annonces) passent par `ElfsightEmbed` :

- `useElfsightPlatform()` injecte le runtime **une seule fois** — un seul `platform.js` monte tous
  les `.elfsight-app-…` de la page (un `<script>` écrit en JSX ne s'exécuterait pas). Elfsight sert
  le même runtime sous deux URLs (`elfsightcdn.com/platform.js` et
  `static.elfsight.com/platform/platform.js`) : ses codes d'intégration donnent tantôt l'une, tantôt
  l'autre, les deux marchent, inutile d'en charger deux.
- **Pas de `data-elfsight-app-lazy`** : le montage différé dépend de la visibilité, fragile dans une
  iframe.
- Si le conteneur est toujours vide au bout de 6 s, un **état de repli** nomme les trois causes à
  vérifier (CSP de l'app, domaine autorisé côté Elfsight, bloqueur de contenu) au lieu de laisser un
  cadre vide.
- Les titres affichés sont **neutres** (« À la une SunLib », « Annonces SunLib ») : le contenu de ces
  bannières change côté Elfsight, et ce ne sont pas des embeds LinkedIn. Les clés de type, elles,
  restent figées (`linkedinBanner`).

### Couche C — l'entrée de registre (§10)

```tsx
type WidgetTypeKey = "notifs" | "taches" | "notesInstallateurs" | "notesProspects"
                   | "linkedin" | "linkedinBanner" | "annonces"
                   | "sav"            // synthèse du bloc « Pilotage SAV » (§9-quinquies)
                   | "data"           // LE type générique piloté par cfg (§9-bis)
                   | "list" | "kpi";  // dépréciés : rendent comme `data`, cfg traduite

type WidgetTypeDef = {
  title: string; icon: LucideIcon;
  Render: FC<{ id: string; cfg: any }>;          // reçoit l'id et la cfg de l'INSTANCE
  defaults?: () => any;                          // cfg d'une instance neuve
  coerce?: (raw: unknown) => any;                // cfg stockée (brute) → utilisable ; ne throw jamais
  Options?: FC<{ cfg: any; onChange: (next: any) => void }>;   // contenu du ⋮ « Options »
};

const WIDGET_REGISTRY: Record<WidgetTypeKey, WidgetTypeDef> = {
  notifs:             { title: "Nouveaux dossiers Abonné", icon: Bell,          Render: NotifsCard },
  taches:             { title: "Journal des tâches",       icon: CalendarClock, Render: TachesCard },
  notesInstallateurs: listType("Dernières notes — Installateurs", HardHat, NOTES_INS_CFG),
  notesProspects:     listType("Dernières notes — Prospects",     Target,  NOTES_PRO_CFG),
  linkedin:           { title: "SunLib sur LinkedIn",      icon: Newspaper,     Render: LinkedinCard },
  linkedinBanner:     { title: "À la une SunLib",          icon: Megaphone,     Render: LinkedinBannerCard },
  annonces:           { title: "Annonces SunLib",          icon: Sparkles,      Render: AnnoncesCard },
  list:               listType("Liste configurable",       LayoutGrid, LIST_CFG),
};

// `listType` = fabrique : même ListView générique, icône et cfg de départ propres au type.
const cfgOf = (def, raw) => def.coerce ? def.coerce(raw) : def.defaults ? def.defaults() : {};
```

**Les clés de type sont un contrat de persistance : jamais les renommer** (les layouts sauvegardés
en base y font référence via `instance.type`). Les 6 premières reprennent à l'identique les anciens
`WidgetId` de la v1, ce qui rend la migration mécanique. L'*implémentation* d'un type peut changer
librement ; seule sa clé est figée — `notesInstallateurs` en est la démonstration : **même clé,
rendu désormais générique** (`ListView`), donc mêmes layouts sauvegardés, nouveau comportement.
`typeDefOf(type)` indexe le registre sans crasher sur une clé inconnue (cf. `parked`), et `cfgOf`
interprète la cfg **au rendu** (le stockage reste brut).

Deux familles de types cohabitent volontairement :

| | Types **sur-mesure** | Types **liste** |
|---|---|---|
| Exemples | `notifs`, `taches`, `sav`, les 3 embeds Elfsight | `notesInstallateurs`, `notesProspects`, `data` (+ `list`/`kpi` dépréciés) |
| Code dédié | présentiel + enveloppe data | **aucun** — 1 ligne `dataType(...)` |
| Interactions propres | oui (marquer comme lu, onglets, embed) | non |
| ⋮ Options | **au cas par cas** : aucun pour `notifs`/`taches`/les embeds, **oui pour `sav`** (registre `SAV_METRICS`, §9-quinquies) | **oui** — un formulaire unique (§9-quater) |

Le cas `sav` est le patron à suivre pour rendre configurable un widget sur-mesure : le
formulaire n'énumère rien en dur, il est **généré depuis un registre de métriques** (`key`,
`label`, `kind`, fonction de calcul). Ajouter une valeur cochable = une entrée dans ce
registre, et elle apparaît dans le panneau de tout le monde. Les `key` du registre sont
stockées dans `cfg.show` : **ce sont des contrats de persistance**, comme les clés de type.

Ajouter un widget générique = 1 entrée de registre. Ajouter un widget sur-mesure = présentiel +
enveloppe + entrée. Dans les deux cas, + 1 entrée `DEFAULT_INSTANCES` pour le livrer par défaut.

### Couche transversale — les SOURCES (§6-bis)

```tsx
type SourceKey = "abonnes" | "notesIns" | "notesPro" | "tachesPa" | "tachesPr";
type Row = { id: string } & Record<string, unknown>;          // ligne APLATIE : { id, …alias }
type SourceState = { rows: Row[]; loading: boolean; error: boolean };

const CATALOG: Record<SourceKey, SourceDesc> = { … };         // label, connected, fields, defaultMap
const isLive = (k) => !USE_MOCK && CATALOG[k].connected;

function AbonnesSource({ children }) {                        // 1 adapter par source
  const res = useRecords({ from: DS.abonnes, select: SELECT_ABONNE, orderBy: q.desc("creeLe") });
  return <>{children(liveState(res))}</>;                      // `from` reste un membre littéral
}

function SourceFeed({ source, children }) {                   // dispatch STATIQUE
  if (!isLive(source)) return <>{children(offlineState(source))}</>;
  switch (source) { case "abonnes": return <AbonnesSource>{children}</AbonnesSource>;
                    default: return <>{children(offlineState(source))}</>; }
}
```

Ce que cette couche apporte :

- **La contrainte `from` est canalisée, pas contournée** : un adapter par source, un `case` par
  source. Aucun hook n'est appelé dans `SourceFeed` (monter/démonter des composants est légal).
- **Une seule forme de ligne** : `flattenRows()` aplatit `{ id, fields }` en `{ id, …alias }`, donc
  les lignes mock et live sont identiques et traversent les **mêmes** mappers (`mapNotif`,
  `mapTask`, `mapNote`) — plus de double chemin `USE_MOCK ? … : …` dans chaque widget.
- **Granularité mock/live gratuite** : `offlineState` sert le mock de toute source non connectée,
  même avec `USE_MOCK = false`. Le `MOCK_ROWS` est indexé par `SourceKey` (plus par widget).
- Écart au doc cible : l'état de chargement se lit sur `res.isLoading` / `res.error` (l'API Softr
  n'expose pas de `status` textuel).

### Le DESCRIPTEUR de source — `CATALOG` (§6-bis)

C'est le « tout-en-JSON » de la cible rév. 2 : une entrée de **pure donnée** par source, qui décrit
la table aux widgets génériques. Aucun nom de champ brut n'y figure — les noms Airtable exacts ne
vivent que dans les `SELECT_*`.

```tsx
type FieldDesc = {
  label: string;
  kind: "text" | "longtext" | "date" | "badge" | "number" | "bool" | "url";
  options?: string[];                       // valeurs possibles → menus des formulaires
  variants?: Record<string, BadgeVariant>;  // valeur métier → couleur de badge
};

type SourceDesc = {
  key: SourceKey; label: string;
  icon: string;                             // CLÉ de la map ICONS, pas un composant
  connected: boolean;
  fields: Record<string, FieldDesc>;        // clés = ALIAS du SELECT_*
  defaultSort: { by: string; dir: "asc" | "desc" };
  defaultMap?: FieldRoleMap;
};
```

Ce que chaque pièce apporte concrètement :

- **`options`** — les valeurs réelles du champ. Dans le formulaire d'options, la valeur d'un filtre
  devient un **menu déroulant** (`FilterValueInput`) au lieu d'une saisie libre : on ne tape plus un
  statut à la main. Celles d'`abonnes` sont les **vrais choix Airtable**, relevés le 2026-07-31 sur
  « Statut Dossiers » (12 valeurs — un 13ᵉ choix, `En attente de solvabilité`, est un **doublon à
  nettoyer côté Airtable**) et « Type d installation » (5 valeurs).
- **`variants`** — la couleur de badge par valeur métier, via `variantOf(desc, alias, valeur)` ;
  repli sur l'heuristique `statusVariant` (§3) pour toute valeur non listée. C'est ce qui permet à
  « Dossier annulé » d'être *neutre* là où l'heuristique le dirait *danger*.
- **`icon`** — une **clé** (`"Bell"`), résolue par `ICONS` / `iconOf()`. Un JSON ne peut pas porter
  un composant : c'est l'illustration du principe « clés en JSON, implémentations en code ». Le
  widget affiche l'icône de **sa source**, donc elle suit un changement de source dans Options.
- **`defaultSort`** — appliqué **sens compris** quand l'utilisateur change de source (« fin
  croissant » pour des tâches, « créé le décroissant » pour des dossiers) ; un tri explicitement
  choisi est toujours respecté.

⚠️ Les noms de variants sont ceux du **kit visuel** (`ok`, `warn`, `info`, `danger`, `solar`,
`brand`, `neutral`), pas ceux du document cible (`success`, `warning`) : on ne renomme pas le kit.

Un banc d'essai vérifie la cohérence interne du descripteur : tri par défaut et `defaultMap` ne
citent que des champs connus, chaque `variant` correspond à une `option` déclarée, aucune option en
doublon, et **le mock n'utilise que des valeurs déclarées** — c'est ce test qui a révélé que le mock
portait encore les anciennes offres « Duo / Solo / Pro », supprimées d'Airtable.

**Ajouter une source** = 6 gestes, ~30 lignes, sans toucher au moteur : recette `ARCHITECTURE-V2.md`
§6 (connecter dans l'onglet *Sources* → membre du `define` → `SELECT_*` → adapter → `case` →
entrée `CATALOG` avec `connected: true`). Elle est alors immédiatement disponible dans le sélecteur
de source de tout widget liste.

### Le widget générique `data` — la grammaire (§9-bis)

**Un seul type de widget** affiche n'importe quelle source, sous trois formes. Ce qui change d'un
widget à l'autre n'est pas du code, mais sa `cfg` — stockée dans `layout_json` :

```ts
type InstanceCfg = {
  title: string;                 // vide → libellé du descripteur
  unit: string;                  // « note » → sous-titre « 7 notes »
  source: SourceKey;
  query: {
    filter: { field: string; op: FilterOp; value?: string }[];   // combinés en ET
    sort: { by: string; dir: "asc" | "desc" };
    limit: number;                                               // 1 … 50
  };
  view:
    | { kind: "list";  map: FieldRoleMap }                        // titre / détail / date / statut
    | { kind: "table"; columns: string[] }                        // alias, dans l'ordre, max 6
    | { kind: "kpi";   agg: "count" | "sum" | "avg"; field?: string;
        dateField?: string; compareDays?: number };
  actions?: { use: string[] };   // ids d'actions du descripteur, activées ici
  create?: boolean;              // bouton « + » (formulaire du descripteur)
};
```

**Pourquoi un seul type et non trois** : la clé de type est un contrat de persistance (jamais
renommée), alors que la vue doit rester modifiable. En mettant la vue dans la `cfg`, un widget passe
de liste à tableau à indicateur **depuis le panneau Options, sans changer de type** — donc sans
migration.

- `applyQuery` = filtres (ET) → **tri typé** (dates en temps, nombres en nombres, textes en
  `localeCompare` fr) → limite. `kpiCompute` agrège (`count`/`sum`/`avg`) et calcule l'écart avec la
  fenêtre précédente. Toutes ces fonctions sont **pures**, donc identiques en mock et en live.
- `coerceCfg` ne throw jamais et valide tout contre le descripteur : source inconnue → repli,
  filtre invalide → **écarté** (mieux vaut un filtre en moins qu'un filtre faux), colonnes inconnues
  ou en doublon → retirées, `sum`/`avg` sans champ numérique → retombe sur `count`, champ de
  comparaison qui n'est pas une date → refusé, limite clampée. Trois cas distincts pour un rôle
  d'affichage : **absent** → défaut, **vide (`""`)** → « aucun » respecté, **invalide** → repli.

**COMPATIBILITÉ des cfg déjà livrées.** Les clés `list` et `kpi` de la rév. 1 ont été livrées avec
des cfg *plates* (`map`, `filter` unique, `limit`, `dateField`, `compareDays`). Elles restent des
types valides — **dépréciés** — et `fromLegacyCfg` traduit leur cfg vers la grammaire à la lecture :
le filtre unique devient une liste d'un élément, `map` devient `view.map`, `dateField`/`compareDays`
deviennent une `view` de kind `kpi`. Aucune instance déjà posée ne part dans `parked`, et le
document n'est réécrit qu'au prochain « Enregistrer ». Supprimer ces deux clés ferait disparaître
ces widgets de l'écran : ne pas le faire.

⚠️ **Limite assumée du KPI** : l'agrégat porte sur les lignes **chargées** par la source (la première
page renvoyée par Softr), pas sur le total serveur. Exact aux volumes actuels ; pour un vrai total
sur grosse table, deux voies — variante d'adapter sans limite, ou champ rollup Airtable lu en une
ligne. Le panneau d'options le dit à l'utilisateur.

### Les ACTIONS — écrire en base depuis un widget (§9-ter)

Une action est une **donnée** du descripteur ; l'exécuteur est générique.

```ts
type ActionDesc =
  | { id; label; kind: "set";    set: Record<string, unknown>; confirm?: string }
  | { id; label; kind: "toggle"; field: string }
  | { id; label; kind: "link";   href: string; target?: "_top" | "_blank" };  // {alias} interpolés
```

`RowActions` les rend au survol d'une ligne (liste ou tableau) ; une action `set` avec `confirm`
demande une confirmation **inline** (jamais `window.confirm`). `QuickCreate` est le « + » de
l'en-tête, dont le formulaire vient de `desc.create` (`default: "@me.email"` résolu depuis la
session).

L'adapter expose `SourceApi.write` **seulement** si la source a un `SELECT_*_W` et qu'une session
existe. `write` absent = boutons d'écriture inertes, ce qui est le cas en aperçu « œil ».

🔐 **La sécurité ne repose PAS sur le descripteur** — tout JSON côté client est falsifiable. Les
vraies barrières, dans l'ordre : la whitelist **`SELECT_*_W`** (un champ absent est physiquement
inécrivable, Softr répond 400) ; la **session obligatoire** ; les **permissions de la datasource**
côté Softr ; le `confirm` pour les gestes destructeurs.

État du branchement : `SELECT_TACHE_PA_W`/`_PR_W` (champ `Fait`) et `SELECT_NOTE_INS_W`/`_PRO_W`
sont écrits et prêts ; leurs adapters restent à créer le jour où ces tables seront connectées (un
exemple complet est en commentaire au-dessus de `SourceFeed`). « Abonnés » n'a **volontairement pas**
de select d'écriture : le statut d'un dossier se change dans le CRM. En **aperçu** (`USE_MOCK`), une
source hors ligne fournit un `write` **simulé** (mutation d'un état local, trace en console) : les
actions et la création se testent sans base.

### La coquille `Widget`, le contexte d'édition et le ⋮ « Options »

`Widget({ icon, title, sub, solar, headActions, children, footer })` lit **deux** contextes :

| Contexte | Quand | Effet |
|---|---|---|
| `WidgetChromeCtx` non-null | mode Personnaliser | poignée `GripVertical`, `WidgetEditMenu` (Monter/Descendre/Largeur/Taille/**Supprimer**), **corps inerte** (`pointerEvents: "none"`) |
| `WidgetOptionsCtx` non-null | mode normal **et** type configurable | bouton ⋮ → `WidgetOptionsMenu` : le formulaire du type, brouillon local, « Annuler » / « Enregistrer » |

Le chrome injecté est
`{ index, total, isWide, size, onMoveUp, onMoveDown, onSetWide, onSetSize, onDuplicate,
onRemove }` ; les options `{ cfg, Form, onSave }`. Le widget lui-même ne connaît **rien** du layout : c'est le `Dashboard` qui
fournit tout via contexte. Un type sans `Options` n'affiche **aucun** bouton ⋮ en mode normal (plus
de bouton décoratif sans action). « Enregistrer » appelle `persistCfg(id, cfg)` → même pipeline que
la grille (optimiste + toast, un seul document `layout_json`).

### Dimensionnement — 2 axes indépendants

- **Largeur** : `instance.w: "half" | "full"` → moitié (1 colonne) ou pleine (`gridColumn: "1 / -1"`).
  Poignées de bord gauche/droite (événements *pointer*, snap à ±56 px) + segments
  « Moitié / Pleine » du menu ⋮.
- **Hauteur** : `instance.h: "sm" | "md" | "lg"` (stockée explicitement) →
  `WIDGET_HEIGHTS = { sm:168, md:340, lg:560 }`, posé en **CSS var `--slb-wh`** sur
  `.slb-dragwrap`, lue par `.slb-scrolly { max-height: var(--slb-wh, 340px) }`.
  Poignée du bas (pointer, snap ~70 px) + segments « Petit / Moyen / Grand ».
- ⚠️ **La grille est une CONTAINER QUERY, pas une media query** :
  `.slb-dash-wrap { container-type: inline-size }` +
  `@container (min-width:720px) { .slb-dash { grid-template-columns: repeat(2, minmax(0,1fr)) } }`.
  Indispensable : dans l'iframe Softr la fenêtre est large mais le **bloc** est étroit — avec une
  media query, « pleine largeur » n'avait aucun effet visible.
- **Animations FLIP** : à chaque changement d'ordre/largeur/hauteur, `useLayoutEffect` mesure les
  `getBoundingClientRect` avant/après et anime `transform` (translate + scale, 340 ms), avec un div
  interne contre-scalé pour éviter la distorsion. Respecte `prefers-reduced-motion`.
- **DnD** : API HTML5 native (`draggable`, `onDragStart/Over/Drop`) ; le menu ⋮ est le chemin
  **clavier et tactile** obligatoire (le DnD HTML5 ne marche pas au doigt).

### Modèle de layout v2 + fonctions pures (§10-bis)

Le layout porte des **instances**, pas des types : `instance.id` (clé de persistance) est
distinct de `instance.type` (entrée de registre). C'est la phase 0 de `ARCHITECTURE-V2.md`.

```ts
type Instance = {
  id: string;          // contrat de persistance ; migrés v1 = l'ancien WidgetId
  type: string;        // clé de WIDGET_REGISTRY ; `string` pour pouvoir garder un type inconnu
  cfg: unknown;        // options par widget — stockée BRUTE (interprétée au rendu, phase 2)
  w: "half" | "full";
  h: "sm" | "md" | "lg";
};

type Layout = {
  v: 2;
  items:  Instance[];  // visibles — l'ordre du tableau EST l'ordre d'affichage
  parked: Instance[];  // types inconnus du code courant : ni rendus, ni perdus
  seeded: string[];    // ids par défaut déjà injectés → pas de résurrection
};
```

> ⚠️ **Il n'y a plus de `hidden`** (décision du 2026-08-03). Masquer faisait doublon avec
> supprimer : le seul écart réel était la `cfg` conservée, et deux gestes pour un résultat
> presque identique coûtent plus en confusion qu'ils ne font gagner en clics. Un widget dont
> on ne veut plus se **supprime** ; pour le revoir, on le repose depuis la galerie et on le
> règle à nouveau — **perte de cfg assumée**. `hideWidget` / `showWidget` et le panneau
> « Widgets masqués » ont disparu ; `normalizeLayout` continue de **lire** `hidden` pour les
> documents déjà écrits, mais ne l'écrit plus jamais.

Toute la logique vit dans des fonctions **pures** (aucune logique dans les handlers) :
`normalizeLayout(saved, knownTypes?)`, `migrateV1`, `seed`, `coerceInstance`, `cloneInstance`,
`cloneCfg`, `reorder(list, from, to)`, `moveWidget`, `setWidgetWide`,
`setWidgetSize`, **`addInstance`, `removeInstance`**, `newInstanceId`,
`takenIds`, `cloneDefault`, `emptyLayout`, `idxOf`, `uniqueStrings`.

`normalizeLayout` est la brique de compatibilité, appliquée à **toute** lecture (BDD *et* cache
localStorage — la migration du cache est donc transparente) :

- JSON invalide / non-objet / `v ∉ {1,2}` → défaut semé ;
- `v:1` → `migrateV1` : `order`/`hidden` → instances, `wide`→`w`, `sizes`→`h`, `type = id` ;
- `v:2` → assainissement : instance sans `id`/`type` ou en doublon écartée (`items` prioritaire
  sur `hidden` puis `parked`), `w`/`h` clampés, **`type` inconnu → `parked` (jamais supprimé)**,
  `cfg` laissée **brute** (on ne « répare » jamais le stockage, on tolère à la lecture) ;
- **migration « plus de masqués »** : les instances d'un `hidden` déjà écrit sont **remontées en
  visible**, en fin d'`items` et en demi-largeur. Elles ne sont pas jetées : perdre la cfg d'un
  widget qu'on supprime soi-même est un arbitrage, voir disparaître sans un mot un widget
  seulement mis de côté serait un bug ;
- puis `seed()` : **toute instance de `DEFAULT_INSTANCES` jamais vue par cet utilisateur** est
  ajoutée en fin d'`items`, visible, et marquée `seeded` — un widget nouvellement livré apparaît
  donc chez tout le monde **une fois**, mais un widget supprimé ne ressuscite plus.

Comportement volontairement plus fin que le doc cible : `migrateV1` ne marque `seeded` que les ids
**réellement présents** dans le layout v1, pour qu'un widget par défaut livré après la dernière
sauvegarde v1 de l'utilisateur continue d'apparaître (comportement du normalize v1).

Migration **en mémoire à la lecture** ; le document v2 n'est écrit qu'au prochain « Enregistrer ».
⚠️ Seul chemin destructif connu : revenir à un code v1 après une sauvegarde v2.

### Multi-instances (phase 3)

- **`addInstance(layout, type, cfg)`** — ajoute en fin de grille, id neuf `w_xxxxxx` (jamais en
  collision avec un id d'`items`/`parked`/`seeded`, y compris supprimé mais mémorisé).
- **`removeInstance(layout, id)`** — retire d'`items`. **Seul geste de retrait** : la `cfg` est
  perdue, et reposer le widget depuis la galerie donne une instance neuve avec la cfg du preset.
  `seeded` n'est pas touché, donc pas de résurrection.
- **`PRESETS`** — modèles de la galerie, **générés** : un par type sur-mesure (pour ré-ajouter un
  widget supprimé) + les presets déclarés par chaque source du catalogue (à défaut, un modèle liste
  sur son `defaultMap`). Brancher une source la fait apparaître dans la galerie sans une ligne de
  code de plus.
- **`GALLERY_GROUPS` / `SOURCE_GROUP` / `PRESET_GROUPS`** — la galerie est un **dépliant par
  famille métier** (Abonnés, Tâches, Notes, Dossiers SAV, Communication, Autres), un seul groupe
  ouvert à la fois. Le regroupement suit le **domaine**, pas le mécanisme : la synthèse SAV
  (sur-mesure) et les vues `data` sur les tickets sont dans le même groupe. Une source absente de
  `SOURCE_GROUP` tombe dans « Autres » plutôt que de disparaître — c'est ce repli qui préserve la
  promesse « brancher une source suffit ». L'ordre de `GALLERY_GROUPS` est l'ordre d'affichage.

> **`duplicateInstance` a été supprimée (2026-08-03)**, comme le masquage avant elle. Poser deux
> fois la même famille de widget passe par la galerie puis par les Options de chacun : le
> multi-instances reste entier, seul le raccourci « copier celui-ci » disparaît.

Comme le reste du mode Personnaliser, ces trois actions ne touchent que le **brouillon** : rien
n'est écrit avant « Enregistrer », et « Annuler » restaure tout — y compris une suppression.

Validé par un banc d'essai jetable (56 assertions : entrées invalides, migration v1 réelle,
multi-instances, clamps, dédup, `parked`, idempotence de l'aller-retour, no-op des mutations).

### Cycle du mode Personnaliser (dans `Dashboard`)

`applied` (layout persisté) vs `draft` (brouillon d'édition). « Personnaliser » →
`setDraft(current); setEditing(true)`. Toutes les manipulations modifient `draft` seul.
« Annuler » jette le brouillon, « Réinitialiser » (confirmation inline, jamais `window.confirm`)
remet `cloneDefault()`, « Enregistrer » appelle `persist(draft)` puis affiche un toast
(succès auto-disparu à 2,6 s ; échec persistant avec bouton « Réessayer »).
Un panneau n'apparaît qu'en édition : **« Ajouter un widget »** (la galerie de `PRESETS`) — c'est
le seul endroit d'où un widget revient sur la grille. Hors édition, le ⋮ de chaque widget configurable ouvre ses
**Options**, qui persistent la `cfg` immédiatement (`persistCfg`) — c'est le seul chemin d'écriture
en dehors de « Enregistrer », et il est explicite (bouton « Enregistrer » du panneau).

---

## 4. LA PERSISTANCE — où et comment la data est enregistrée

**Deux étages : localStorage (cache) + une table Airtable (source de vérité).**

### La table — **tout est sur Airtable** (décision 2026-07-31)

La persistance vivait dans une table **Softr Tables natives** (`Preferences`, tablespace
`Home-preferences`, datasource `96961120-3d05-4ccc-8a48-3640ee48b060`, champs adressés par
**FIELD IDs**). Elle a été **migrée sur Airtable** pour que l'app n'ait qu'un seul système de
données. L'ancienne table n'est plus lue ni écrite.

**Base `SunLib CRM — Préférences` (`appHZaD5BkDsWxR65`) · table `Home Preferences`
(`tbl18J0zC47myPJLO`)**, workspace `Sunlib`.
**Datasource ID (connectée au bloc) : `dcc7928c-3906-4807-8224-0532c3e30fc5`.**
4 champs, **tous écrits** :

| Champ Airtable | Type | Alias code | Rôle |
|---|---|---|---|
| `user_email` | Single line text (primaire) | `email` | clé logique : 1 ligne par utilisateur |
| `layout_json` | Long text | `layout` | tout le document de disposition sérialisé |
| `updated_at` | Date + heure (ISO, Europe/Paris) | `updatedAt` | dernière sauvegarde |
| `schema_version` | Number (0 décimale) | `schemaVersion` | recopie de `LAYOUT_VERSION` |

```ts
const SELECT_PREFS = q.select({
  email: "user_email", layout: "layout_json",
  updatedAt: "updated_at", schemaVersion: "schema_version",
});
```

⚠️ Table **Airtable** → les valeurs sont les **NOMS EXACTS** des champs (les FIELD IDs étaient une
obligation propre aux tables Softr natives ; c'était la cause du `Failed to add record: 400`).
Ces noms ont été créés **sans piège** — aucun espace final, casse régulière, pas d'accent — à
l'inverse des tables métier historiques (`"Date "`, `"date de fin"`). Ne les renommer ni dans le
code ni dans Airtable. Chaque champ porte une description dans Airtable qui rappelle son rôle.

Plus de champs « en réserve » (les 5 de l'ancienne table sont abandonnés) : sur Airtable, ajouter
un champ prend dix secondes le jour où le besoin existe.

### Décision « Option A » — stockage unique

**Tout le layout est sérialisé dans le seul champ `layout_json`** :
`JSON.stringify({ v:2, items, parked, seeded })`. Le `v` du JSON reste la version qui
gouverne la lecture ; `schema_version` en est une recopie, pour diagnostiquer l'état du parc
directement dans la grille Airtable sans parser le JSON.

### Migration Softr → Airtable : ce qu'elle coûte

Rien à migrer côté données : les layouts sauvegardés dans l'ancienne table sont abandonnés, et
`normalizeLayout` régénère la disposition par défaut. Pour l'utilisateur, la transition est même
invisible : le **cache localStorage** (`slb-home-layout:<email>`) conserve sa disposition et elle
sera réécrite dans Airtable au prochain « Enregistrer ». Un utilisateur qui change de navigateur
avant ce premier enregistrement repart, lui, sur la disposition par défaut.

### Modèle : 1 ligne par utilisateur

```ts
const bddRes  = useRecords({ from: DS.prefs, select: SELECT_PREFS, where: q.text("email").is(email) });
const updateM = useRecordUpdate({ from: DS.prefs, fields: SELECT_PREFS });
const createM = useRecordCreate({ from: DS.prefs, fields: SELECT_PREFS });
```

Lecture au montage filtrée sur `useCurrentUser().email` (trim + lowercase). Pas de ligne →
**create** ; ligne existante → **update** sur son `recordId` (mémorisé dans un `useRef`).

```ts
const persist = async (next: Layout) => {
  setLayout(next); writeLocalLayout(email, next);         // 1. optimiste : état + cache
  if (!PREFS_ENABLED) return { ok: true };
  if (!email) return { ok: true, note: "Aperçu non connecté…" };   // 2. pas de session → on ne tente rien
  const layoutStr = JSON.stringify(next);
  const stamp = new Date().toISOString();
  if (recordId.current) {
    await updateM.mutateAsync({ recordId: recordId.current,
      fields: { layout: layoutStr, updatedAt: stamp, schemaVersion: LAYOUT_VERSION } });
  } else {
    const created = await createM.mutateAsync({ email, layout: layoutStr, updatedAt: stamp,
      schemaVersion: LAYOUT_VERSION });  // DIRECT
    if (created?.id) recordId.current = created.id;
  }
};
```

### Cache localStorage

Clé **`slb-home-layout:<email>`**, écrite à chaque `persist` et à chaque réception BDD. Elle sert
à l'**affichage instantané** (évite le squelette) et de **secours** si la BDD est injoignable.
La **BDD reste la source de vérité** : dès qu'elle répond avec une ligne, elle écrase le cache.

### Règles de comportement

- `PREFS_ENABLED = !DS.prefs.startsWith("TODO")` → **`true`** : la table Airtable est connectée
  (datasource `dcc7928c-…`), l'enregistrement en base est actif. Si un jour la valeur repasse à un
  `"TODO-…"`, le bloc retombe automatiquement sur le **cache local seul** sans rien casser.
- Écriture **uniquement à « Enregistrer »**, jamais à chaque drop.
- **Optimiste** : le layout reste appliqué localement même si la BDD échoue (le toast propose
  « Réessayer »).
- Conflits (2 onglets / 2 postes) : **last-write-wins assumé**, aucun merge.
- Chargement : `status === "loading" && !applied` → 4 `SkeletonCard` (on n'affiche jamais le layout
  par défaut en attendant, pour éviter le saut visuel).
- **Aucun appel direct à l'API Airtable, aucune clé côté client.**

### Inspection et débogage

La table étant sur Airtable, ses lignes sont directement **lisibles et modifiables** — dans la
grille Airtable comme via le MCP Airtable. C'est un gain net sur l'ancienne table Softr Tables, qui
était exposée au MCP `sunlib-crm-2` avec `operations: []` (aucun bloc de page branché dessus) et
donc **inspectable par aucun outil** : diagnostiquer un layout demandait d'ajouter des blocs Liste
et formulaires sur `/home-copy`, puis de publier.

---

## 5. Les données métier des widgets (Airtable) — état du branchement

**Tout est sur Airtable** : le contenu des widgets comme les préférences (§4).

```ts
const DS = datasource.define({
  abonnes: "8fc957d0-232b-4b24-906e-d0be7c636f30", // ✅ connecté
  prefs:   "dcc7928c-3906-4807-8224-0532c3e30fc5", // ✅ connecté (persistance, §4)
});
```

| Alias | Table Airtable | État | Champs (alias → nom exact) |
|---|---|---|---|
| `prefs` | « Home Preferences » (SunLib CRM — Préférences) | ✅ **connecté** | email `user_email` · layout `layout_json` · updatedAt `updated_at` · schemaVersion `schema_version` |
| `abonnes` | « Abonnés » (BDD Abonné) | ✅ **connecté** | nom `Nom` · prenom `Prenom` · partenaire `Nom de l'entreprise (from Installateur )` · statut `Statut Dossiers` · offre `Type d installation` · creeLe `date de création` |
| `notesIns` | « Suivi client » (Installateurs) | ⏳ **non connecté** | nom `Installateur` · note `Notes` · date `Date `*(espace final)* |
| `notesPro` | « Suivi propect » (BDD Propect) | ⏳ **non connecté** | nom `Nom` · note `Notes` · date `date `*(espace final)* |
| `tachesPa` | « Taches » (Installateurs) | ⏳ **non connecté** | desc `Description` · associe `Partenaire associé` · fin `date de fin` · fait `Fait` |
| `tachesPr` | « Taches prospect » (Installateurs) | ⏳ **non connecté** | desc `Description` · associe `Prospect associé` · fin `Date de fin` · fait `Fait` |

⚠️ Les noms de champs comportent des **espaces finaux et des casses irrégulières** (`"Date "`,
`"date "`, `"date de fin"` vs `"Date de fin"`) : ne jamais les normaliser. `RECENT = 12` lignes
affichées par widget liste. Les `SELECT_*` des 4 sources non connectées sont déjà écrits, prêts à
l'emploi ; ces sources sont catalogudées dans `CATALOG` avec `connected: false` → `SourceFeed` leur
sert leur mock (aperçu) ou une liste vide (live), **sans jamais appeler `useRecords`** sur un id
absent du `define`. Les brancher : recette `ARCHITECTURE-V2.md` §6.

Le **héro n'est pas un widget** : `useHeroCounts()` lit `DS.abonnes` de son côté (même contrainte
`from` qu'un adapter) et calcule `unread` / `urgent` (< 3 j, tâches non « Fait ») indépendamment.

---

## 6. Navigation et reste de la page

- **`NAV_TABS`** — barre d'onglets **in-block** (bascule de contenu, plus de `target=_top` pour ces
  onglets) : `Accueil` (dashboard) + 3 apps Vercel publiques **embarquées en iframe** via
  `EmbedTab` — Formulaire de contact `formulairedecontact.vercel.app`, Simulateur Grille
  `simulateur-grille-v2.vercel.app`, Bibliothèque `documentation-interne.vercel.app` (toutes
  vérifiées iframables). ⚠️ la CSP de l'iframe Softr doit autoriser `frame-src https://*.vercel.app`.
- **`QUICK_LINKS`** (section Outils) — raccourcis pages d'espace en `target=_top` (Prospects,
  Partenaires, Contact Partenaire, Abonnés, KPI) + outils externes (You Sign, Calculette, Sellsy,
  Tik&Lib). **Toutes les URLs sont encore `#`** — à compléter.
- **`Hero`** — dégradé de marque `#13A3AC → #3CAE68` (seule exception validée à la charte),
  « Bienvenue {prénom} ! », date, 2 chips, logo forcé blanc via `filter: brightness(0) invert(1)`.
  Le dégradé est **animé en boucle lente** (`HERO_CYCLE_MS`, 60 s par cycle) : une couche de fond large de
  300 %, porteuse d'un motif teal→vert périodique (un cycle tous les 33,333 %), est translatée de
  `-33,3333 %` — la boucle se referme donc sans couture ni changement de sens. L'animation est
  déclarée via `element.animate()` (`useHeroPan`), pas en `@keyframes` : elle ne dépend d'aucune
  feuille de style et respecte `prefers-reduced-motion`. Le dégradé fixe reste sous la couche, en
  repli si l'animation ne démarre pas.

---

## 7. Limites connues de l'architecture actuelle

Les points qui bloquent l'objectif « widgets complètement indépendants et personnalisables » :

1. **Pas encore de widget paramétrable par source — mais la couche est posée.** La contrainte Softr
   sur `from` interdit toujours un composant générique ; depuis la phase 1 elle est *canalisée* par
   les adapters + le dispatch statique `SourceFeed` (§6-bis). Ce qui manque est le **type de widget
   générique** (`list`/`kpi` piloté par `cfg`) et son formulaire d'options : phase 2.
   Coût marginal d'une nouvelle source aujourd'hui : ~30 lignes, zéro toucher au moteur.
2. ~~**Une seule instance par widget**~~ **résolu (phases 0 et 3)** : `instance.id` est distinct de
   `instance.type`, et l'UI suit — « Supprimer », galerie « Ajouter un widget » (en dépliants). Deux
   « Notes » avec deux filtres différents sont possibles.
3. **`widgets_config_json` inutilisé — et il le restera.** Décision Option A : la `cfg` par instance
   vit dans le document `layout_json` (champ `cfg`), désormais **réellement écrite** pour les widgets
   liste **et indicateur** (titre, source, mappage, filtre, tri, limite, fenêtre de comparaison).
   Le champ reste en réserve.
4. **`layout_mobile_json` inutilisé** : pas de layout distinct par breakpoint.
5. **Grille limitée** : ordre linéaire + largeur binaire (moitié/pleine) + 3 hauteurs discrètes.
   Pas de grille libre (x, y, w, h) — alors que le nom du champ `layout_json` documentait à
   l'origine « grille i,x,y,w,h ».
6. **État « lu » des notifications non persistant** : la table `Abonnés` n'a pas de champ `Lu` →
   masquage purement local, réapparaît au rechargement. Deux voies : basculer sur la table
   `Notification Center` (case native `Statut de lecture`), ou ajouter un champ `Lu` coché par une
   automation.
7. ~~**Bouton ⋮ « Options » du mode normal non branché**~~ **résolu (phase 2)** : il ouvre le
   formulaire du type (`WidgetOptionsMenu` + `ListOptions`) et persiste la `cfg` de l'instance.
   Reste ouvert : les types sur-mesure (`notifs`, `taches`, LinkedIn) n'ont pas d'options — c'est
   un choix, pas un oubli (leurs réglages utiles n'existent pas encore).
8. ~~**`USE_MOCK` est global**~~ **résolu (phase 1)** : `USE_MOCK` reste l'interrupteur global, mais
   la granularité vient de `CATALOG[k].connected` — toute source non connectée sert son mock même
   avec `USE_MOCK = false` (`offlineState`), sans interrupteur supplémentaire.
9. **Pas de pagination réelle** : `flatten().slice(0, 12)` côté client, pas de `fetchNextPage`.
10. **`USE_MOCK` est encore à `true`** : rien ne tourne en live aujourd'hui, sauf la persistance
    (qui est branchée et fonctionnelle).
