# Architecture — Page d'accueil du CRM SunLib

> État des lieux du fonctionnement **actuel** du bloc : plateforme, anatomie du code,
> mécanique des widgets, et surtout **où et comment la data est persistée**.
> Document de référence destiné à préparer la refonte du système de widgets ;
> la cible et son plan de migration vivent dans `ARCHITECTURE-V2.md`.
> Dernière mise à jour : 2026-08-04 — **la cible v2 est livrée jusqu'à sa RÉVISION 2** :
> disposition par instances (`migrateV1`, `seeded`/`parked`) ; couche SOURCES et **descripteur
> `CATALOG`** ; **type générique unique `data`** (grammaire `query`/`view` → vues liste, tableau,
> indicateur) avec un **formulaire d'options unique** ; multi-instances (galerie de presets
> **déclarés dans le catalogue**, regroupés en dépliants par famille) ; **actions d'écriture déclaratives**
> (`RowActions`) ; persistance passée **sur Airtable**.
>
> **Le bloc lit Airtable EN DIRECT depuis le 2026-08-04** : `USE_MOCK = false`, 6 des 7 sources
> du catalogue sont connectées. S'ajoutent ce jour-là : les **widgets utilitaires sans source**
> (heure, pense-bête, liste à cocher), le **marquage lu persistant** des dossiers abonnés, la
> **grille qui se tasse** (masonry) et le **déplacement hors mode Personnaliser**.
>
> Reste à faire : connecter **`notifC`** (« Notification Center ») pour que l'état lu / non lu
> existe ; renseigner les **URLs** de `QUICK_LINKS` (encore `#`) ; **vérifier à l'écran** ce qui
> ne se manifeste qu'à la souris et en session (§7).

---

## 1. Nature du projet et contraintes de plateforme

**Livrable unique : `Block.tsx` (~5 200 lignes).** On copie-colle ce seul fichier dans un bloc
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
| **Interrupteur global** | `const USE_MOCK: boolean = false` depuis le 2026-08-04 (`Block.tsx:83`). Seul commutateur mock ↔ live, mais pas le seul niveau : une source `connected: false` sert son mock même ici en `false` (`offlineState`). Repli en un caractère. |
| **Champs exposés ≠ champs de la table** | Les champs qu'une datasource expose sont choisis **à la connexion**, source par source : la datasource Softr de « Taches » n'en expose que 3 là où la table en compte 12. Un champ déclaré dans un `SELECT_*` mais absent de la datasource désynchronise la source (« you have a field in your source code X which is not present in your datasource ») et **bloque toute écriture sur la table** — constaté sur le bloc SAV le 2026-08-03. Le remède est de remapper la source, pas de corriger le code. |
| **Champs calculés** | Une formule, un rollup ou un lookup déclaré dans un select fait échouer l'écriture du **record entier**. `SELECT_SAV` exclut donc « Total interventions », qui se resomme côté bloc. |

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
| 8 | Composants de page : `EmptyState`, les **4 contextes de widget** (`WidgetChromeCtx`, `WidgetOptionsCtx`, **`WidgetCfgCtx`**, **`WidgetGrabCtx`**) + `WidgetHeightCtx`, `useDismissOnOutside`/`hitsRect`, `WidgetEditMenu`, **`Widget`** (la coquille), `ScrollBody`, `PageNavBar`, `Hero`, **`topOrigin`/`softrPageUrl`**, `QuickLinks`, `EmbedTab` |
| 9 | Composants **présentiels** des widgets sur-mesure : `NotifsOptions`/`NotifRow`/`NotifWidget` (+ `matchNotifC`/`linkIds`, la jointure d'état de lecture), `TaskRow`/`TasksWidget` |
| **9-septies** | **Performance commerciale** : `comStats` (pure, le calcul partagé), `fmtMEur`, `Sparkline`, le **podium** (`PodiumWidget`/`PodiumCard`) et le **classement** (`ClassementWidget`/`ClassementCard`, 10 colonnes triables) — repris de l'onglet Commercial du bloc `dashboard-KPI` |
| **9-sexies** | **Widgets UTILITAIRES sans source** : `HorlogeCard`/`HorlogeOptions`, `MemoCard` (+ `memoInline`/`MemoRead`, le texte balisé), `ChecklistCard` — leur contenu EST leur cfg |
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

Pur affichage, reçoit ses données en props. Ex. `NotifWidget({ items, cfg, notifs })`,
`TasksWidget({ prospects, partenaires })`. Chacun rend une coquille `<Widget>` dont la liste passe
par `<ScrollBody>` (scroll individuel du widget, hauteur max posée **en ligne** depuis
`WidgetHeightCtx`).

Depuis la phase 2, les widgets « liste » n'ont plus de présentiel dédié : ils partagent
**`GenericRow`/`GenericList`** (§9-bis), qui reprend exactement l'ancien gabarit `NoteRow`
(pastille d'initiales, titre + date alignés, détail clampé sur 2 lignes) et rend chaque rôle selon
le `kind` du champ mappé — `date` → `fmtSmart` + date absolue en `title`, `badge` → `StatusBadge`.
`GenericList` gère aussi les états **chargement** (squelette de lignes) et **erreur**.

### Couche B — l'enveloppe « data », consommatrice d'une SOURCE (§10)

Un composant sans props par widget. Depuis la phase 1 il n'appelle plus `useRecords` lui-même :
il consomme une **source** via `<SourceFeed>` (§6-bis) et mappe les lignes :

```tsx
function NotifsCard({ cfg }: { cfg: NotifsCfg }) {
  return (
    <SourceFeed source="abonnes">                    {/* la liste des dossiers */}
      {(ab) => (
        <SourceFeed source="notifC">                 {/* leur état de lecture */}
          {(nc) => <NotifWidget items={ab.rows.slice(0, cfg.limite).map(mapNotif)} cfg={cfg} notifs={nc} />}
        </SourceFeed>
      )}
    </SourceFeed>
  );
}
```

Un widget à **deux sources** (`TachesCard`, `NotifsCard`) imbrique simplement deux `<SourceFeed>`.

> **L'état lu / non lu est persistant depuis le 2026-08-03** — auparavant, cocher une ligne la
> masquait localement et elle revenait au rechargement : un état de lecture qui ne survit pas au
> rechargement fait juste croire qu'on a traité quelque chose. Il vit maintenant dans
> « Notification Center », joint par le **record id de l'abonné** (`linkIds` tolère les trois
> formes qu'un champ lien peut prendre : objets `{id,name}`, chaînes, chaîne unique).
> ⚠️ Deux pièges de cette table, subis et non corrigés côté bloc : chaque événement crée **deux
> lignes** (`matchNotifC` prend en priorité celle encore « à lire », sinon marquer comme vu
> porterait sur le jumeau déjà lu et semblerait ne rien faire), et la case est **inversée** —
> `Statut de lecture` cochée signifie « à lire », d'où l'alias `aLire` et une écriture de `false`
> pour marquer comme vu. On ne touche pas aux formules Airtable : d'autres écrans les consomment.
> ⚠️ L'état est **global, pas par utilisateur** (la table n'a pas de champ destinataire) : cocher
> vaut pour tout le monde — à dire aux utilisateurs.
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
                   | "horloge" | "memo" | "checklist"   // utilitaires SANS source (§9-sexies)
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
  notifs:             { title: "Derniers dossiers Abonné", icon: Bell,          Render: NotifsCard,
                        defaults: () => coerceNotifsCfg({}), coerce: coerceNotifsCfg, Options: NotifsOptions },
  taches:             { title: "Journal des tâches",       icon: CalendarClock, Render: TachesCard },
  horloge:            { title: "Heure",                    icon: Clock,         Render: HorlogeCard, Options: HorlogeOptions },
  memo:               { title: "Pense-bête",               icon: FileSignature, Render: MemoCard },   // pas d'Options : son contenu s'édite dans le widget
  checklist:          { title: "Liste à cocher",           icon: ClipboardList, Render: ChecklistCard },
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

Trois familles de types cohabitent volontairement :

| | Types **sur-mesure** | Types **liste** | Types **utilitaires** |
|---|---|---|---|
| Exemples | `notifs`, `taches`, `sav`, les 3 embeds Elfsight | `notesInstallateurs`, `notesProspects`, `data` (+ `list`/`kpi` dépréciés) | `horloge`, `memo`, `checklist` |
| Source de données | une ou deux, via `SourceFeed` | une, choisie dans les Options | **aucune** — le contenu EST la cfg |
| Code dédié | présentiel + enveloppe data | **aucun** — 1 ligne `dataType(...)` | présentiel seul |
| Interactions propres | oui (marquer comme vu, onglets, embed) | non | oui (saisie, cases) |
| ⋮ Options | **tous** en ont un (au minimum le titre) ; réglages propres pour `notifs` (champs affichés, nombre de lignes, gestes) et `sav` (registre `SAV_METRICS`, §9-quinquies), aucun pour `taches`/les embeds | **oui** — un formulaire unique (§9-quater) | `horloge` a deux réglages ; `memo`/`checklist` n'ont que le titre, leur contenu s'éditant dans le widget |

Le cas `sav` est le patron à suivre pour rendre configurable un widget sur-mesure : le
formulaire n'énumère rien en dur, il est **généré depuis un registre de métriques** (`key`,
`label`, `kind`, fonction de calcul). Ajouter une valeur cochable = une entrée dans ce
registre, et elle apparaît dans le panneau de tout le monde. Les `key` du registre sont
stockées dans `cfg.show` : **ce sont des contrats de persistance**, comme les clés de type.

**Deux présentations (2026-08-04)** — `cfg.layout` vaut `tuiles` (défaut) ou `lignes`, pour les
**mêmes** valeurs : les lignes restent denses pour une colonne étroite, les tuiles **reprennent le
dessin des cartes du tableau de bord du bloc SAV** — carte blanche à coins arrondis et ombre douce
posée sur un **fond gris** (sans ce contraste, du blanc sur blanc ne tiendrait que par son ombre),
libellé en petites capitales tronqué sur une ligne (deux lignes désaligneraient les valeurs d'une
tuile à l'autre), valeur en `clamp(26px … 34px)`, barre **verte** pour les proportions, puis le
détail. Les cartes sont **toutes dessinées pareil**, y compris la métrique `hero` qui rejoint la
rangée : c'est l'ordre qui donne le rang, comme sur l'écran d'origine.

Le registre y gagne trois champs facultatifs : `sub` (le détail, **tuiles seulement** — il dit d'où
sort la valeur, donc ce qu'il faut corriger pour la faire bouger), `bar` (**réservée aux
proportions** : une barre sur un montant ou un nombre de jours ne dirait pas de quoi elle est la
fraction) et `warnSub`, qui passe le détail en **ambre** quand il énonce un manque — jamais en
rouge, réservé aux pannes, et la couleur ne porte rien seule puisque le texte nomme déjà ce qui
manque. Le nombre de colonnes vient d'un `auto-fill`/`minmax` CSS — ni media query ni mesure JS,
donc une tuile par ligne en demi-largeur et quatre de front en pleine largeur.

⚠️ Une instance déjà posée **change d'apparence** (sa cfg ne porte pas `layout`, elle prend donc le
défaut `tuiles`) ; ses valeurs, elles, sont identiques, et « Lignes » est à un clic.

Ajouter un widget générique = 1 entrée de registre. Ajouter un widget sur-mesure = présentiel +
enveloppe + entrée. Dans les deux cas, + 1 entrée `DEFAULT_INSTANCES` pour le livrer par défaut.

### Couche transversale — les SOURCES (§6-bis)

```tsx
type SourceKey = "abonnes" | "notesIns" | "notesPro" | "tachesPa" | "tachesPr" | "sav" | "notifC";
type Row = { id: string } & Record<string, unknown>;          // ligne APLATIE : { id, …alias }
type SourceState = { rows: Row[]; loading: boolean; error: boolean };

const CATALOG: Record<SourceKey, SourceDesc> = { … };         // label, connected, fields, defaultMap
const isLive = (k) => !USE_MOCK && CATALOG[k].connected;

function TachesPaSource({ children }) {                       // 1 adapter par source
  const res  = useRecords({ from: DS.tachesPa, select: SELECT_TACHE_PA, orderBy: q.asc("fin") });
  const updM = useRecordUpdate({ from: DS.tachesPa, fields: SELECT_TACHE_PA_W });   // whitelist
  const email = asText(useCurrentUser()?.email).trim();       // `from` reste un membre littéral
  const write = email ? { update: (recordId, fields) => updM.mutateAsync({ recordId, fields }) } : undefined;
  return <>{children({ ...liveState(res), write })}</>;       // pas de session → pas de write
}

function SourceFeed({ source, children }) {                   // dispatch STATIQUE
  if (!isLive(source)) return <OfflineSource source={source}>{children}</OfflineSource>;
  switch (source) {
    case "abonnes":  return <AbonnesSource>{children}</AbonnesSource>;
    case "tachesPa": return <TachesPaSource>{children}</TachesPaSource>;
    /* … un case par source connectée … */
    default: return <OfflineSource source={source}>{children}</OfflineSource>;
  }
}
```

⚠️ **`orderBy` n'est pas un choix d'affichage** : rien n'est paginé ici, donc il décide **quelles
lignes sont lues** dès qu'une table dépasse la première page. Chaque adapter trie par la colonne
qui garde les lignes utiles à ses widgets (les plus récentes pour des notes, l'échéance la plus
proche pour des tâches, `debut` desc pour le SAV). Corollaire pour le SAV : les indicateurs de
`SavCard` portent sur la **fenêtre lue**, pas sur la table — le bloc « Pilotage SAV » reste la
référence chiffrée, l'accueil est un résumé, et le widget le dit.

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
  technical?: boolean;                      // source de plomberie : absente de la galerie
  fields: Record<string, FieldDesc>;        // clés = ALIAS du SELECT_*
  defaultSort: { by: string; dir: "asc" | "desc" };
  defaultMap?: FieldRoleMap;
  presets?: PresetDesc[]; actions?: ActionDesc[];
};
```

- **`technical`** — `notifC` est décrit comme toutes les autres sources (pour que ses champs soient
  formatés et filtrables) mais **`presetsOf` lui rend une liste vide** : personne n'a besoin de
  poser « une liste de notifications » sur son accueil. Elle existe pour qu'un autre widget sache
  ce qui a été vu, et l'écrive.

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

Un banc d'essai a vérifié la cohérence interne du descripteur : tri par défaut et `defaultMap` ne
citent que des champs connus, chaque `variant` correspond à une `option` déclarée, aucune option en
doublon, et **le mock n'utilise que des valeurs déclarées** — c'est ce test qui a révélé que le mock
portait encore les anciennes offres « Duo / Solo / Pro », supprimées d'Airtable.

> ⚠️ **Ce banc d'essai était jetable, et il n'est PAS dans le dépôt** — comme celui du modèle de
> layout plus bas. Il n'existe aucun script `test` dans `package.json`, aucune assertion dans
> `Block.tsx` : le seul filet automatique est `tsc --noEmit`. Les fonctions pures
> (`normalizeLayout`, `migrateV1`, `coerceInstance`, `applyQuery`, `fromLegacyCfg`…) ne sont donc
> **pas protégées contre les régressions**. C'est l'écart le plus silencieux du projet : les
> vérifications ont été faites, mais elles ne se rejouent pas.

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

`Widget({ icon, title, sub, solar, headActions, children, footer })` lit **cinq** contextes :

| Contexte | Quand | Effet |
|---|---|---|
| `WidgetChromeCtx` non-null | mode Personnaliser | poignée `GripVertical`, `WidgetEditMenu` (Monter/Descendre/Largeur/Taille/**Supprimer**), **corps inerte** (`pointerEvents: "none"`) |
| `WidgetOptionsCtx` non-null | mode normal, **tous les types** | bouton ⋮ → `WidgetOptionsMenu` : champ **Titre** (commun) + le formulaire du type s'il en a un, brouillon local, « Annuler » / « Enregistrer » |
| **`WidgetTitleCtx`** | **les deux modes** | titre personnalisé de l'instance, appliqué **par-dessus** la prop `title` |
| **`WidgetTintCtx`** | **les deux modes** | teinte de l'instance : fond de l'en-tête, encre du titre, pastille d'icône |
| **`WidgetCfgCtx`** non-null | mode normal | le widget écrit **sa propre cfg** sans passer par un formulaire — c'est ce qui rend le pense-bête et la liste à cocher possibles |
| **`WidgetGrabCtx`** non-null | **les deux modes** | l'**en-tête** de la carte devient saisissable (`draggable` + `cursor: grab`), image de glissement forcée sur la carte entière |

Le chrome injecté est
`{ index, total, isWide, size, onMoveUp, onMoveDown, onSetWide, onSetSize, onRemove }` ; les options
`{ cfg, Form?, title, onSave }`. Le widget lui-même ne connaît **rien** du layout : c'est le
`Dashboard` qui fournit tout via contexte. « Enregistrer » appelle
`persistOptions(id, title, cfg)` → même pipeline que la grille (optimiste + toast, un seul document
`layout_json`), et **une seule** écriture pour les deux : deux `runSave` successifs partiraient tous
deux de `current` et le second perdrait le premier.

### Renommer un widget — n'importe lequel (2026-08-04)

Le titre est une propriété de l'**instance** (`Instance.title`), pas du type. Conséquence directe :
**tout** widget est renommable, y compris ceux qui n'ont aucun réglage propre (journal des tâches,
embeds Elfsight, pense-bête, liste à cocher) — sans une ligne de code par type. C'est pourquoi le ⋮
est désormais fourni pour **tous** les types en mode normal : même sans `Options`, il a quelque
chose à offrir, donc il n'est pas redevenu le bouton décoratif que la v1 avait supprimé.

- **Chaîne vide = titre par défaut.** Le champ affiche le titre d'origine en `placeholder` et le
  vider le rétablit : le geste est réversible sans bouton dédié. `setInstanceTitle` **retire** alors
  le champ de l'instance plutôt que d'y écrire `""` — un renommage annulé ne laisse pas de trace.
- **Le titre par défaut n'est jamais recopié dans l'instance.** Le figer priverait le widget de ses
  évolutions : celui d'un widget `data` suit sa source, et un widget renommé automatiquement
  « Dossiers SAV » garderait ce nom après un changement de source.
- `Widget` applique `titreInstance || propTitle`, et `shown` sert **aussi** dans les `aria-label` des
  menus : un widget renommé s'annonce sous son nouveau nom.
- **Le champ « Titre » a quitté `DataOptions`** : en garder un second aurait donné deux saisies pour
  un même affichage, dont une seule gagne. `cfg.title` demeure — c'est le titre que *pose un preset*
  (« SAV — priorité élevée »), donc le titre par défaut de ces widgets, et ce que montre le
  `placeholder`. Aucune migration : les titres déjà saisis dans l'ancien champ continuent de
  s'afficher par ce chemin.
- Borné à `WIDGET_TITLE_MAX` (48) : l'en-tête d'une carte est étroit, autant borner à la saisie
  plutôt que tronquer à l'écran.

### Teinter un widget — palette fermée (2026-08-04)

Même mécanique que le titre : `Instance.tint` porte une **CLÉ** de `WIDGET_TINTS`, jamais une
couleur. Trois raisons qui tiennent dans la durée — un sélecteur libre produirait des accueils
illisibles (texte foncé sur fond saturé) ; les teintes se retouchent en un seul endroit si la charte
bouge ; et le document de disposition ne stocke **aucune valeur de style**, donc rien à migrer. Une
clé inconnue est écartée à la lecture : le widget reprend l'en-tête blanc.

Huit choix : **Aucune** (défaut), les trois couleurs **SunLib** prises dans les tokens (teal, vert,
ambre solaire), quatre **pastels** (ciel, lavande, rosé, ardoise). Ciel et ardoise viennent des
tokens `info`/`neutral` ; lavande et rosé sont définis dans la palette du widget — la charte n'a pas
de teinte purement décorative — assez désaturés pour ne jamais passer pour un état.

- ⚠️ **Aucun rouge ni orange vif** : ce sont les couleurs d'**alerte**. Les proposer comme décor
  apprendrait à l'œil à les ignorer là où elles comptent.
- La teinte habille **la carte entière** — fond, bordure assortie, encre du titre, pastille d'icône
  et filets de séparation. Ce qu'elle ne touche pas, volontairement : les contenus **blancs** (tuiles
  de la synthèse SAV, zone de saisie du pense-bête), qui ressortent alors comme des cartes posées
  dessus, et les couleurs de **sens** (badges de statut, alertes), qui gardent leur force partout.
- ⚠️ **Les fonds opaques posés dans le corps doivent suivre la teinte**, sinon ils coupent la carte
  d'une bande morte. Deux cas traités : la zone de tuiles de `SavWidget`, et l'en-tête **collant** du
  tableau de classement — celui-ci ne peut pas devenir transparent (les lignes défileraient en
  transparence dessous), il prend donc la teinte. Tout nouveau fond opaque dans un corps de widget
  doit lire `WidgetTintCtx`.
- La pastille **`solar`** d'un outil solaire garde la priorité sur la teinte : c'est un marqueur de
  **sens**, pas une décoration.
- Sélection marquée par un contour teal **et une coche** — jamais par la seule couleur ; chaque
  pastille est un bouton dont l'`aria-label` **nomme** la teinte, pour qui ne distingue pas deux
  pastels.
- `setInstanceLook(layout, id, title, tint)` écrit les deux ensemble, parce que le panneau les édite
  ensemble : deux fonctions séparées inviteraient à deux `runSave`, dont le second écraserait le
  premier (il repartirait de `current`, encore inchangé).

**Pourquoi `WidgetCfgCtx` n'existe qu'en mode normal** : pendant l'édition, le brouillon `draft`
fait autorité, et deux chemins d'écriture concurrents sur la même instance produiraient un
écrasement silencieux. Le pense-bête devient donc lecture seule en mode Personnaliser, et il le
dit. Ses écritures sont **silencieuses en cas de succès** (pas de toast à chaque frappe) mais
**tout échec reste annoncé** : une écriture perdue sans un mot est bien pire qu'un toast de trop.

**Pourquoi la préhension est sur l'en-tête et pas sur la carte** : hors édition, le corps est
interactif (boutons, liens, défilement, sélection de texte). Rendre tout le wrapper `draggable` y
déclencherait un glisser au moindre mouvement — c'est **exactement** le mécanisme qui annulait les
clics du menu ⋮ (§7 n°11) — et empêcherait de sélectionner du texte dans une note. L'en-tête ne
contient qu'un titre et le ⋮ : rien à y perdre, et c'est la convention des fenêtres et des cartes.
Le geste reste **doublé** par le mode Personnaliser, seule voie accessible au clavier et au doigt.

### Dimensionnement — 2 axes indépendants

- **Largeur** : `instance.w: "half" | "full"` → moitié (1 colonne) ou pleine (`gridColumn: "1 / -1"`).
  Poignées de bord gauche/droite (événements *pointer*, seuil 56 px) + segments
  « Moitié / Pleine » du menu ⋮.
- **Hauteur** : `instance.h: "sm" | "md" | "lg"` (stockée explicitement) →
  `WIDGET_HEIGHTS = { sm:168, md:340, lg:560 }`, servi par **`WidgetHeightCtx`** et posé **en
  ligne** par `ScrollBody`. L'ancienne variable CSS `--slb-wh`, lue par une règle injectée, **ne
  s'appliquait pas dans le bloc Softr** : les widgets s'étiraient sans jamais scroller. La classe
  `slb-scrolly` ne sert plus qu'à habiller la barre de défilement.
  Poignée du bas (pointer, un cran tous les 70 px) + segments « Petit / Moyen / Grand ».
- ⚠️ **Le nombre de colonnes est mesuré en JS** (`ResizeObserver` sur la grille → `twoCols`), pas
  par une media query ni une container query : dans l'iframe Softr, la fenêtre est large mais le
  **bloc** est étroit, et rien ne garantit qu'une règle injectée atteigne le bloc.

### La grille se TASSE — masonry par lignes fines

Avant, la grille était ordinaire : chaque rangée prenait la hauteur de son plus grand widget, un
petit widget laissait un trou sous lui, et ces trous alignés **donnaient à voir les lignes de la
grille**. Désormais `gridAutoRows: 4px` (`DASH_ROW`) et chaque widget occupe `span n` lignes.

- `n` vient de la hauteur **réellement mesurée** (`ResizeObserver` sur le div interne) : elle n'est
  pas déductible de `instance.h`, qui ne borne que le corps scrollable — un widget peu rempli est
  plus court. `spanOf()` sert de repli avant la première mesure, pour éviter un saut au premier rendu.
- ⚠️ **`offsetHeight`, jamais `getBoundingClientRect()`** : le FLIP applique des `scale()` sur les
  wrappers, et un rect inclut les transforms des ancêtres — les hauteurs seraient fausses à chaque
  réordonnancement.
- ⚠️ **`rowGap` est à ZÉRO** et ce n'est pas un oubli : un gap s'ajouterait à *chaque* ligne fine
  (n − 1 fois). L'espace vertical vient donc d'un `paddingBottom: DASH_GAP` sur le wrapper, compté
  dans le span.
- ⚠️ **Corollaire à retenir : le wrapper n'épouse plus la carte.** Tout ce qui doit s'aligner sur la
  carte doit donc être décalé de `DASH_GAP`, ou posé sur le **div interne** (celui que mesure le
  `ResizeObserver`). Deux cas rencontrés, dans cet ordre : les **poignées** de redimensionnement,
  décalées d'autant ; puis le **liseré de cible de dépôt**, qui était resté sur le wrapper et
  encadrait donc la carte *plus* son espacement — il descendait sous la carte et passait derrière le
  widget du dessous. Il vit maintenant sur le div interne, avec un `zIndex` pendant le survol : il
  dépasse de 8 px (offset 3 + halo 5) et la carte suivante, peinte après dans l'ordre du DOM, le
  recouvrait sinon par le bas.
- Les **squelettes** de chargement gardent `gridAutoRows: auto` et retrouvent leur `rowGap` : tous
  de même hauteur, ils n'ont rien à tasser, et des lignes de 4 px les écraseraient.

### Déplacement, FLIP, et la fin du tremblement

- **DnD** : API HTML5 native. Un widget se glisse par son **en-tête**, dans les deux modes
  (`WidgetGrabCtx`) ; le wrapper n'est plus `draggable`, il ne reste que la **cible de dépôt**. En
  mode Personnaliser le déplacement va dans le brouillon ; **hors** mode Personnaliser il n'y a pas
  de brouillon, donc il est **écrit immédiatement** — en silence si tout va bien, avec toast en cas
  d'échec. Le menu ⋮ reste le chemin **clavier et tactile** (le DnD HTML5 ne marche pas au doigt).
- **Animations FLIP** : à chaque changement d'ordre/largeur/hauteur, `useLayoutEffect` mesure les
  `getBoundingClientRect` avant/après et anime `transform` (translate + scale, 340 ms), avec un div
  interne contre-scalé. Respecte `prefers-reduced-motion`. ⚠️ **Coupé pendant un glissement de
  poignée** : la disposition change à chaque cran, et des animations de 340 ms en rafale se
  chevauchaient — d'où cette impression de tremblement où l'on ne distinguait plus ce qu'on réglait.
- **Hystérésis sur les deux axes** : la taille se calculait en `Math.round(dy / 70)` depuis
  l'origine du geste, donc à mi-chemin d'un cran le moindre frémissement de la main faisait
  osciller le widget en boucle. Maintenant, un cran franchi **recale l'origine** : il faut refaire
  tout le seuil pour rebasculer.
- **Verrou de hauteur** : la hauteur du conteneur est figée au `pointerdown` (`minHeight`), le temps
  du geste. Comme la grille se tasse, régler un widget changeait la hauteur de la page, donc la
  position de scroll — l'écran semblait monter et descendre sous le curseur. Elle peut encore
  s'allonger, sinon on ne verrait pas un widget grandir.
- **Plus de barre de défilement en mode Personnaliser** : elle ne servait à rien (le corps y est
  inerte) et longeait le même bord que les poignées de largeur — on visait l'une, on attrapait
  l'autre. La retirer supprime le conflit à la source plutôt que d'éloigner les poignées du bord.

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
  preset?: string;     // modèle de galerie d'origine → un seul exemplaire par modèle
  title?: string;      // titre choisi par l'utilisateur ; absent = titre par défaut du widget
  tint?: string;       // CLÉ de WIDGET_TINTS ; absent = en-tête blanc
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
`setWidgetSize`, **`addInstance`, `removeInstance`, `setInstanceLook`**, `newInstanceId`,
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

- **`addInstance(layout, type, cfg, h, preset)`** — ajoute en fin de grille, id neuf `w_xxxxxx`
  (jamais en collision avec un id d'`items`/`parked`/`seeded`, y compris supprimé mais mémorisé).
  **Un seul exemplaire par modèle** (2026-08-03) : si `presetKeyOf` est déjà dans `usedPresets`,
  c'est un no-op. Le garde est **dans la fonction pure**, pas seulement dans la galerie — un bouton
  grisé est un confort, la règle doit tenir même si l'UI change. Dans la galerie, un modèle déjà
  posé est **grisé et non masqué** : le retirer laisserait croire qu'il n'existe plus, le griser dit
  « tu l'as déjà », qui est l'information utile.
  `Instance.preset` est **facultative**, et c'est voulu : les instances écrites avant son
  introduction n'en ont pas, et le repli est `type` — ce qui tombe juste pour tous les types
  sur-mesure, dont la clé de modèle *est* la clé de type. On tolère l'existant plutôt que de
  réécrire des documents déjà en base.
- **`removeInstance(layout, id)`** — retire d'`items`. **Seul geste de retrait** : la `cfg` est
  perdue, et reposer le widget depuis la galerie donne une instance neuve avec la cfg du preset.
  `seeded` n'est pas touché, donc pas de résurrection.
- **`PRESETS`** — modèles de la galerie, **générés** : un par type sur-mesure (pour ré-ajouter un
  widget supprimé) + les presets déclarés par chaque source du catalogue (à défaut, un modèle liste
  sur son `defaultMap`). Brancher une source la fait apparaître dans la galerie sans une ligne de
  code de plus.
- **`GALLERY_GROUPS` / `SOURCE_GROUP` / `PRESET_GROUPS`** — la galerie est un **dépliant par
  famille métier** (Abonnés, Tâches, Notes, Dossiers SAV, Communication, **Utilitaires**, Autres),
  un seul groupe ouvert à la fois. Le regroupement suit le **domaine**, pas le mécanisme : la synthèse SAV
  (sur-mesure) et les vues `data` sur les tickets sont dans le même groupe. Une source absente de
  `SOURCE_GROUP` tombe dans « Autres » plutôt que de disparaître — c'est ce repli qui préserve la
  promesse « brancher une source suffit ». L'ordre de `GALLERY_GROUPS` est l'ordre d'affichage.

> **`duplicateInstance` a été supprimée (2026-08-03)**, comme le masquage avant elle. Poser deux
> fois la même famille de widget passe par la galerie puis par les Options de chacun : le
> multi-instances reste entier, seul le raccourci « copier celui-ci » disparaît.

Comme le reste du mode Personnaliser, ces trois actions ne touchent que le **brouillon** : rien
n'est écrit avant « Enregistrer », et « Annuler » restaure tout — y compris une suppression.

Validé par un banc d'essai **jetable** (56 assertions : entrées invalides, migration v1 réelle,
multi-instances, clamps, dédup, `parked`, idempotence de l'aller-retour, no-op des mutations).
⚠️ Jetable au sens littéral : il n'a pas été versionné, et ne se rejoue donc pas — voir
l'avertissement du §3 sur l'absence de tests dans le dépôt.

### Widgets utilitaires — quand le contenu EST la cfg (§9-sexies)

Trois widgets ne lisent **aucune** table : `horloge`, `memo` (pense-bête), `checklist`. Leur contenu
vit dans leur `cfg`, donc dans `layout_json` — ils fonctionnent sans qu'aucune source soit branchée,
sont propres à chaque utilisateur, et le suivent d'un poste à l'autre.

⚠️ **Ce ne sont pas des notes d'équipe** : un pense-bête n'est visible que de son auteur et n'a
aucun lien avec « Suivi client » / « Suivi propect ». Pour une note partagée, c'est un widget `data`
sur la source qui convient.
⚠️ **Le document de disposition n'est pas une base de données** : `MEMO_MAX` (2 000 caractères),
`CHECK_MAX` (40 lignes) et `CHECK_TEXT_MAX` (160) ne sont pas décoratifs — `layout_json` est
rechargé à chaque affichage de la page.

**Le pense-bête n'est pas un éditeur HTML, et c'est un choix de sécurité.** `contentEditable` +
`execCommand` serait plus court à écrire, mais imposerait de stocker du HTML et de le rendre via
`dangerouslySetInnerHTML` — donc d'écrire un assainisseur maison, la pièce la plus facile à rater du
fichier, sur un contenu qui fait l'aller-retour par la base (`execCommand` est de surcroît
déprécié). Ici le stockage est du **texte balisé** (`**gras**`, `*italique*`, `~~barré~~`,
`{rouge}…{/}`, `- ` en début de ligne) et `memoInline` produit des **éléments React** : aucune
chaîne n'est jamais interprétée comme du HTML, l'injection est impossible **par construction, pas
par vigilance**. `cfg.text` reste une simple chaîne, donc les notes déjà écrites restent valides.
L'enregistrement se fait à la **perte de focus** (ou Ctrl/⌘+Entrée), pas à chaque frappe :
`persistCfg` réécrit tout le document, une écriture par caractère saturerait la base.

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
const DS = datasource.define({           // 6 sources connectées au 2026-08-04
  abonnes:  "8fc957d0-…", prefs:    "dcc7928c-…",   // dossiers abonnés · persistance (§4)
  notesIns: "122fbc71-…", notesPro: "dbd7e501-…",   // Suivi client · Suivi propect
  tachesPa: "7198b954-…", tachesPr: "9414183e-…",   // Taches · Taches prospect
  sav:      "3f5f8f6c-…",                            // SAV · Tickets
});
```

| Alias | Table Airtable | État | Champs (alias → nom exact) |
|---|---|---|---|
| `prefs` | « Home Preferences » (SunLib CRM — Préférences) | ✅ **connecté** | email `user_email` · layout `layout_json` · updatedAt `updated_at` · schemaVersion `schema_version` |
| `abonnes` | « Abonnés » (BDD Abonné) | ✅ **connecté** | nom `Nom` · prenom `Prenom` · partenaire `Nom de l'entreprise (from Installateur )` · statut `Statut Dossiers` · offre `Type d installation` · creeLe `date de création` |
| `notesIns` | « Suivi client » (Bdd Installateurs, `tblkP20xivQbSSLUj`) | ✅ **connecté** | nom `Installateur` · note `Notes` · date `Date `*(espace final)* |
| `notesPro` | « Suivi propect » (BDD Propect, `tblaWCbZGGz7IUdNm`) | ✅ **connecté** | nom `Nom` · note `Notes` · date `date `*(espace final, createdTime)* |
| `tachesPa` | « Taches » (Bdd Installateurs, `tblebnLi0r90yuqry`) | ✅ **connecté** | desc `Description` · associe `Partenaire associé` · fin `date de fin` · fait `Fait` |
| `tachesPr` | « Taches prospect » (Bdd Installateurs, `tblYQaq030GsdnIdy`) | ✅ **connecté** | desc `Description` · associe `Prospect associé` · fin `Date de fin` · fait `Fait` |
| `sav` | « Tickets » (SAV, `tblf4KgGHCaZXKnBX`) | ✅ **connecté**, lecture seule | 22 alias (ticket, client, installateur, dates, 12 catégories, fabricant, priorité, statut, tiers, coût) |
| `notifC` | « Notification Center » (BDD Abonné, `tblqF71AO8nFVpWi5`) | ⏳ **non connecté** | liens `Liens BDD` · aLire `Statut de lecture` · etat `Statut de la notification` · creeLe `Created Date` |
| `comKpi` | « Abonnés » **relue** (même datasource que `abonnes`) | ✅ **connecté**, lecture seule **paginée** | commercial `Propio SOFTR` · capex `Prix Installation HT total` · contratSigne `Contrat abonnement signe` *(pièce jointe)* · statutAbonne `Statut de l'abonné` · moisSignature `Mois de signature contrat` |

> **Deux entrées de catalogue pour une même table** (`abonnes` et `comKpi`) : une source
> n'est pas une datasource, c'est une **lecture**. `abonnes` lit large sur les 12 derniers
> dossiers ; `comKpi` lit 10 champs mais sur **tout le parc**, pour le podium et le classement
> des commerciaux. Les fusionner ferait payer au widget « Derniers dossiers » le prix d'un parc
> entier, ou aux deux autres l'inexactitude d'un échantillon.
>
> ⚠️ **Deux lookups d'installateur cohabitent dans cette table**, et les confondre casse la
> lecture : `Nom de l'entreprise (from Installateur )` **avec** espace avant la parenthèse
> (alias `partenaire` de `SELECT_ABONNE`) et `Nom de l'entreprise (from Installateur)`
> **sans** espace (alias `installateur` de `SELECT_COM`). Les deux noms ont été vérifiés sur
> Airtable le 2026-08-04. `Propio SOFTR` est un **singleSelect** : Softr peut le rendre en
> objet `{ id, name }`, d'où le passage systématique par `asText`.

### Performance commerciale — podium et classement (§9-septies)

Deux widgets, **un seul calcul** (`comStats`, pure) : les critères sont recopiés de `statsDe` du
bloc `dashboard-KPI` pour que les deux écrans donnent le **même** classement — portefeuille =
contrat signé **joint** (annulés compris, ils ont bien été signés), `contrats`/`capex` sur les non
annulés de la période, `tauxPose` = posés/signés (« Etat facture 2 » à « Validée »), `delaiMoy` =
jours création → signature bornés à `[0, 365[`, `installateurs` = installateurs **distincts** (la
colonne « Installs. » compte des partenaires, **pas** des installations — le libellé du bloc KPI est
trompeur, la note existe pour qu'on ne le « corrige » pas), `tendance` = signés du mois courant
moins le mois précédent **présent dans les données** (sinon un mois creux afficherait −100 % à tout
le monde) et « Non assigné » **exclu** (ce n'est pas une personne, il finirait premier).

Le **tri du classement vit dans la cfg**, pas dans un état local : il est donc persisté, et on
retrouve son classement au rechargement. Les en-têtes trient d'un clic via `WidgetCfgCtx` — le même
canal que le pense-bête — et inversent le sens au second clic. Le liseré or des trois premières
lignes n'apparaît **que** sur un tri par CAPEX décroissant : ailleurs, ces lignes ne sont pas « le
podium », et les dorer raconterait un classement qui n'est pas affiché. Le tableau défile
horizontalement (`minWidth: 880`) — dix colonnes ne tiennent pas dans un widget en demi-largeur, et
un tableau qui déborderait du bloc serait pire.

⚠️ Les noms de champs comportent des **espaces finaux et des casses irrégulières** (`"Date "`,
`"date "`, `"date de fin"` vs `"Date de fin"`) : ne jamais les normaliser. **Tous ont été
revérifiés contre le schéma Airtable le 2026-08-04**, avant d'ouvrir la lecture en direct — les
sept pièges attendus sont confirmés tels quels, `Fait` compris (présent dans les deux tables de
tâches, bien que la datasource Softr de « Taches » ne l'expose pas à ses blocs de page).
`RECENT = 12` lignes affichées par widget liste.

`notifC` reste catalogué `connected: false` : `SourceFeed` lui sert son mock (aperçu) ou une liste
vide (live), **sans jamais appeler `useRecords`** sur un id absent du `define`. Conséquence
visible : le widget des dossiers abonnés s'affiche **sans état lu / non lu ni bouton « Vu »** —
dégradation prévue (`matchNotifC`), pas une panne. Le brancher : recette `ARCHITECTURE-V2.md` §10,
en connectant la table à **ce** bloc (un id de datasource appartient à une connexion d'un bloc).

**Écritures ouvertes** : `fait` sur les deux tables de tâches (whitelists `SELECT_TACHE_*_W`), et
`aLire` sur `notifC` le jour de sa connexion. **Les 4 formulaires de création ont été retirés le
2026-08-04** : celui des tâches était cassé par construction (champs hors whitelist → 400), celui
des notes aurait produit des lignes **non rattachées** — « Suivi client » et « Suivi propect »
relient par un champ LIEN, qui attend un record id et non un nom. Ils reviendront le jour où le
bloc saura résoudre un lien (menu alimenté par la table parente) ; `QuickCreate` reste écrit et
inutilisé, prêt pour ce jour-là.

Le **héro n'est pas un widget** : `useHeroCounts()` lit `DS.abonnes` de son côté (même contrainte
`from` qu'un adapter) et calcule `unread` / `urgent` (< 3 j, tâches non « Fait ») indépendamment.

---

## 6. Navigation et reste de la page

- **`NAV_TABS`** — barre d'onglets **in-block** (bascule de contenu, plus de `target=_top` pour ces
  onglets) : `Accueil` (dashboard) + 3 apps Vercel publiques **embarquées en iframe** via
  `EmbedTab` — Formulaire de contact `formulairedecontact.vercel.app`, Simulateur Grille
  `simulateur-grille-v2.vercel.app`, Bibliothèque `documentation-interne.vercel.app` (toutes
  vérifiées iframables). ⚠️ la CSP de l'iframe Softr doit autoriser `frame-src https://*.vercel.app`.
- **`QUICK_LINKS`** (section Outils) — raccourcis vers les pages de l'espace en `target=_top`
  (Prospects, Partenaires, Contact Partenaire, Abonnés, Pilotage SAV, KPI) + outils externes
  (Calculette d'abonnement, Tik&Lib, et You Sign dont l'URL manque encore). « Services Sellsy » a
  été **retiré** le 2026-08-04. Les adresses elles-mêmes sont dans le registre ci-dessous.

### Les adresses — un registre unique en tête de fichier (§0-bis)

**Aucune URL n'est écrite ailleurs.** `PAGES` (slugs des pages de l'espace) et `TOOLS` (outils
externes et sources d'iframe) vivent juste après `USE_MOCK` ; `NAV_TABS`, `QUICK_LINKS` et les
widgets ne portent que des **références**. Une adresse qui change se change à un seul endroit.

```ts
const PAGES = { abonne: "abonn-s-details-3", installateur: "installateurs-details",
                sav: "sav", kpi: "dashboard-kpi",
                prospects: "", partenaires: "", contactPartenaire: "", abonnes: "" };
const PAGE_RECORD_PARAM = "recordId";     // paramètre des pages de détail
```

- **Des slugs, pas des URLs** — un lien vers une page de l'espace ne peut pas être **relatif** :
  `href="/sav"` serait résolu contre l'**iframe du bloc**, pas contre l'app. `pageUrl(slug, params)`
  préfixe donc l'origine **parente**, que `topOrigin()` déduit à l'exécution :
  `ancestorOrigins` (exact, mais absent de Firefox) → `document.referrer` (présent en pratique) →
  un repli codé en dur. L'origine est **lue, jamais devinée**, donc les mêmes liens marchent en
  aperçu et en production sans condition, et un domaine personnalisé ne demanderait rien à changer.
- **Résolu AU RENDU**, pas à l'évaluation du module : `topOrigin()` lit le DOM, et une URL figée au
  chargement se tromperait si le bloc était monté autrement.
- **Une entrée vide (`""`) est un choix explicite**, « adresse pas encore connue » : `pageUrl`
  renvoie `""` et l'appelant rend un **lien inerte** — tuile Outils désactivée (un `<span>`, mention
  « bientôt »), pied du widget SAV absent. Un bouton qui n'ouvre rien vaut moins que pas de bouton.
  Renseigner le slug dans §0-bis l'active, sans toucher au reste.
- ⚠️ **Le nom du paramètre reste à confirmer** (`recordId`, convention Softr la plus courante) :
  ouvrir une fiche depuis l'app et lire son URL.
- `PAGES.installateur` est **déclarée mais pas encore utilisée** : les widgets de notes affichent le
  *nom* de l'installateur, pas son record id (le champ lien n'est pas dans `SELECT_NOTE_INS`).
  L'ajouter au select suffirait à offrir un lien « Voir la fiche » sur chaque note.
- Hors registre, et c'est voulu : les images de la charte (`IMG`) et le runtime des embeds
  (`ELFSIGHT_PLATFORM`) — ressources techniques, pas cibles de navigation.
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

1. ~~**Pas encore de widget paramétrable par source**~~ **résolu (phases 1 et 2)** : le type
   générique `data` et son formulaire unique existent ; la contrainte Softr sur `from` reste
   *canalisée* par les adapters + le dispatch statique `SourceFeed` (§6-bis). Coût marginal d'une
   nouvelle source : ~30 lignes, zéro toucher au moteur.
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
6. ~~**État « lu » des notifications non persistant**~~ **mécanisme livré (2026-08-03), en attente
   d'une datasource.** La voie retenue est la table `Notification Center` et sa case native. Le code
   est écrit et testable en aperçu (écriture simulée) ; il attend que la table soit connectée à ce
   bloc. Trois limites restent, **côté base et non côté bloc** : l'état est **global** (aucun champ
   destinataire — cocher vaut pour tout le monde), chaque événement crée **deux lignes**, et ~380
   lignes n'ont **aucun lien** vers un abonné. Le widget ne peut que les subir.
7. ~~**Bouton ⋮ « Options » du mode normal non branché**~~ **résolu (phase 2)** : il ouvre le
   formulaire du type (`WidgetOptionsMenu` + `ListOptions`) et persiste la `cfg` de l'instance.
   Reste ouvert : les types sur-mesure (`notifs`, `taches`, LinkedIn) n'ont pas d'options — c'est
   un choix, pas un oubli (leurs réglages utiles n'existent pas encore).
8. ~~**`USE_MOCK` est global**~~ **résolu (phase 1)** : `USE_MOCK` reste l'interrupteur global, mais
   la granularité vient de `CATALOG[k].connected` — toute source non connectée sert son mock même
   avec `USE_MOCK = false` (`offlineState`), sans interrupteur supplémentaire.
9. **Pagination : une seule source la fait.** Par défaut, `useRecords` ne rend que la **première
   page** — `orderBy` décide donc **quelles** lignes sont lues, et tout agrégat (KPI, indicateurs
   SAV) porte sur cette fenêtre. Seul **`comKpi`** vide la pagination (`useDrainPages`, plafond
   `COM_MAX_PAGES = 40`), parce que le podium **agrège sur le parc** : sur un échantillon il
   afficherait un classement faux avec des montants crédibles. Plafond atteint → `partial: true`,
   que le widget **affiche** (« Calcul partiel »). Tout futur widget qui totalise doit suivre ce
   chemin, et jamais se contenter d'une page en silence.
10. ~~**`USE_MOCK` est encore à `true`**~~ **passé à `false` le 2026-08-04** : 6 des 7 sources
    lisent Airtable en direct. Reste `notifC`.
11. ~~**Les menus ⋮ se referment au clic, sans exécuter l'action**~~ **corrigé le 2026-08-03.**
    Signalé et reproduit plusieurs fois : on ouvrait le ⋮ d'un widget, on cliquait un bouton du
    panneau, et le panneau se fermait sans que l'action parte. Concernait `WidgetOptionsMenu` (⋮
    « Options », mode normal) et `WidgetEditMenu` (⋮ disposition, mode Personnaliser).

    **Trois causes cumulées**, toutes trois neutralisées — elles étaient indépendantes, donc les
    départager n'était pas nécessaire pour corriger :

    - **Le DnD HTML5 annulait le `click`.** En mode Personnaliser, le wrapper de chaque widget porte
      `draggable` : un `mousedown` suivi du moindre déplacement déclenche `dragstart`, et le
      navigateur **jette le `click`** qui aurait suivi. Le code portait déjà la garde
      `if (resizeRef.current || sizeRef.current) { e.preventDefault(); return; }`, ajoutée le jour où
      le même conflit avait été constaté avec les poignées de redimensionnement — **les menus n'en
      avaient jamais eu l'équivalent**. `onDragStart` refuse désormais de démarrer un drag partant
      d'un élément interactif (`button, select, input, textarea, label, a, [role="menu"],
      [role="dialog"]`) : un widget se glisse par sa carte ou sa poignée, pas depuis un bouton.
    - **Le nœud cliqué pouvait être détaché du DOM.** `contains()` répond toujours `false` pour un
      orphelin : quand un re-render venait de remplacer le nœud visé (retirer un filtre, cocher une
      case), le panneau se fermait alors que le clic était bien à l'intérieur. → garde `isConnected`.
    - **Les `<select>` natifs.** Leurs `<option>` sont rendues par l'OS, hors du document : le
      `mousedown` sur une option ciblait un nœud « extérieur » au panneau, qui se fermait au moment
      même où l'on choisissait une valeur. `DataOptions` en est truffé. → les cibles `OPTION` et tout
      ce qui est dans un `select` sont ignorées.

    Au passage, le code de fermeture — dupliqué à l'identique dans les deux menus — a été extrait
    dans **`useDismissOnOutside(open, setOpen)`**, précisément pour qu'un correctif ne puisse plus
    être appliqué à un seul des deux. Le hook prend le **setter** `useState` (stable) et non une
    fermeture `() => setOpen(false)`, qui serait recréée à chaque render et réattacherait les
    écouteurs en boucle.

    **Une TROISIÈME garde a été ajoutée depuis** (`hitsRect`, 2026-08-04) : les deux précédentes
    raisonnent sur l'**arbre**, celle-ci sur l'**écran**. On ne ferme que si le clic est extérieur
    selon les deux, ce qui l'immunise contre tout ce qui trompe `contains()` — nœud détaché,
    portail, liste native rendue par l'OS. Une **trace console volontaire** accompagne chaque
    fermeture par clic extérieur : si un panneau disparaît **sans** cette ligne, ce n'est pas une
    fermeture mais un **remontage** du composant, et le correctif est alors ailleurs (remonter
    l'état `open` d'un niveau). C'est le genre de distinction qu'on ne fait pas de mémoire.

12. **Écrire un champ LIEN est hors de portée du bloc.** Un champ de liaison Airtable attend un
    **record id**, pas un libellé : le bloc ne sait donc pas rattacher une note à son installateur,
    ni une tâche à son partenaire. C'est ce qui a fait **retirer les 4 formulaires de création**
    (§5). Le débloquer demande de lire la table parente pour offrir un menu de record ids — faisable
    dans la grammaire actuelle, non fait.
13. **Aucun test dans le dépôt** : pas de script `test`, pas d'assertion dans `Block.tsx`. Les bancs
    d'essai cités (56 assertions sur le layout, cohérence du descripteur, 11 sur `fromLegacyCfg`)
    ont été écrits **en session et jamais versionnés**. Le seul filet automatique est
    `tsc --noEmit`, qui ne dit rien du comportement des fonctions pures.
14. **Le contenu utilisateur voyage dans `layout_json`** (pense-bête, liste à cocher). Bornes en
    place (`MEMO_MAX`, `CHECK_MAX`), mais le document est relu à chaque affichage de la page : ce
    champ n'est pas un espace de stockage, et il ne faut pas l'y transformer.
15. **Ce qui n'a jamais été vu à l'écran.** Le tassement de la grille, l'hystérésis des poignées, la
    préhension par l'en-tête et la jointure d'état de lecture ne se manifestent qu'à la souris dans
    un vrai navigateur — et, pour la dernière, avec la datasource connectée. Le bloc compile et la
    logique est en place ; **rien de tout cela n'est confirmé visuellement**. À vérifier sur la page
    publiée, connecté : glisser un widget par son en-tête hors mode Personnaliser, régler une
    poignée sans tremblement, dérouler un `<select>` du panneau d'options, cocher « Fait » sur une
    tâche (première écriture réelle du bloc).
