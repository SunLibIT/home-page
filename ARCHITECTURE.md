# Architecture — Page d'accueil du CRM SunLib

> État des lieux du fonctionnement **actuel** du bloc : plateforme, anatomie du code,
> mécanique des widgets, et surtout **où et comment la data est persistée**.
> **Document unique** : `ARCHITECTURE-V2.md`, qui portait la cible de la refonte et son plan de
> migration, a été **absorbé ici le 2026-08-20** — la migration étant terminée, son plan par phases
> n'avait plus d'objet. Ce qui en valait la peine vit au **§8** : le principe directeur, la
> frontière code ↔ JSON, **la recette « une table de plus → un widget »** et les pistes restées
> ouvertes.
> Dernière mise à jour : 2026-08-20 — **la cible v2 est livrée jusqu'à sa RÉVISION 2** :
> disposition par instances (`migrateV1`, `seeded`/`parked`) ; couche SOURCES et **descripteur
> `CATALOG`** ; **type générique unique `data`** (grammaire `query`/`view` → vues liste, tableau,
> indicateur) avec un **formulaire d'options unique** ; multi-instances (galerie de presets
> **déclarés dans le catalogue**, regroupés en dépliants par famille) ; **actions d'écriture déclaratives**
> (`RowActions`) ; persistance passée **sur Airtable**.
>
> ### ⚠️ CE QUE CE DOCUMENT NE DÉCRIT PAS ENCORE (commit du 2026-08-19)
>
> Le commit `b956fdb` — « L'annuaire des contacts partenaires, et la page qui ne relit plus la base
> à chaque ouverture » — a apporté cinq chantiers que les sections ci-dessous **ignorent
> totalement**. Ils sont documentés dans le **`README.md`** (§3 et §5), et le code fait foi :
>
> | Apport du 2026-08-19 | Où le lire en attendant |
> |---|---|
> | source **`contactsIns`** (« Détails des contacts par installateur », 1 266 lignes) + son modèle de galerie en tableau six colonnes | `README.md`, `CATALOG` |
> | natures de champ **`email`** et **`phone`**, multi-sélections rendues en une pastille par valeur | `FieldValue` |
> | **jusqu'à trois filtres à cases** par widget — `cfg.facet` (singulier) devient **`cfg.facets`**, l'ancienne clé restant lue | `coerceCfg`, `ListToolbar` |
> | **`MotionFX` (§2-ter)** — les animations d'attente passent en **JS** (Web Animations API), la feuille de `StyleInjector` pouvant ne pas s'appliquer dans Softr, exactement comme pour les survols | `useMotionFX` |
> | **les squelettes de chargement** : deux widgets répondaient « Aucune tâche en cours » / « Tout est traité » **pendant** leur lecture — une réponse fausse et rassurante à la place d'une attente | `ListSkeleton` |
>
> Ces sections restent donc à écrire. Le §8, lui, est à jour : les principes qu'il énonce n'ont pas
> bougé, et le commit du 08-19 en est une application (un nouveau `kind` de champ = un renderer
> écrit une fois, disponible pour toutes les sources).

> **Le bloc lit Airtable EN DIRECT depuis le 2026-08-04** : `USE_MOCK = false`, 6 des 7 sources
> du catalogue sont connectées. S'ajoutent ce jour-là : les **widgets utilitaires sans source**
> (heure, pense-bête, liste à cocher), le **marquage lu persistant** des dossiers abonnés, la
> **grille qui se tasse** (masonry) et le **déplacement hors mode Personnaliser**.
>
> **⚠️ 2026-08-07 — LE MODE « PERSONNALISER » N'EXISTE PLUS.** Tout ce document qui parle
> d'« édition », de « brouillon », de « draft », de « WidgetChromeCtx », de « WidgetEditMenu »
> ou de « corps inerte » décrit un état RÉVOLU du fichier : ces éléments ont été supprimés.
> Il ne reste **qu'un régime** — tout geste (déplacer, redimensionner, régler, retirer)
> s'applique et s'écrit **en direct** —, **un seul bouton** dans la barre (« Ajouter un
> widget »), et **aucune annulation globale**. Ce qui protège : écriture optimiste, échec
> toujours annoncé avec « Réessayer », confirmation sur le retrait. Le réordonnancement au
> **clavier et au doigt** n'existe PLUS DU TOUT : les boutons « Monter / Descendre » du ⋮ ont
> été retirés le 2026-08-07 (demandé), le glisser-déposer par l'en-tête étant désormais le seul
> chemin de réordonnancement. Les sections ci-dessous n'ont pas été réécrites une à une : en cas de
> doute, **le code fait foi**.
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
| **Survol (`:hover`) : en JS** | Même cause, même remède (constaté à l'écran le 2026-08-06 : *« les animations de survol ne fonctionnent pas dans Softr »*). La feuille ne s'appliquant pas, **tous** les `:hover` tombaient d'un coup — tuiles Raccourcis et Outils, boutons, lignes de widget, podium, poignées. `useHoverFX` (§2-bis) pose désormais ces états **en style inline via le CSSOM**, depuis un écouteur délégué unique sur le conteneur du bloc : indépendant de toute feuille, et prioritaire sur le Tailwind de Softr. La table `HOVER_RULES` reprend règle pour règle les `:hover` de `StyleInjector`, qui restent en place comme repli. **Deux invariants** : un élément ne matche qu'UNE règle déclenchante, et on n'écrit que des **longhands** (`background-color`, jamais `background` — sur un raccourci, la restauration effacerait la valeur posée par React). |
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
| 2-bis | `HOVER_RULES` + `useHoverFX()` — les états de **survol et de focus** posés en style inline depuis un écouteur délégué, pour ne plus dépendre de la feuille de §2 (cf. la contrainte « Survol : en JS ») |
| 8 | `WidgetOptionsMenu` — les réglages d'un widget sont une **MODALE** depuis le 2026-08-06, plus un panneau flottant de 292 px. Deux colonnes : *Apparence* (titre, couleur — commun à tous les types) et *Contenu* (le formulaire du type, plus large car il porte les `<select>`, filtres et colonnes). En-tête et pied fixes, corps scrollable, largeur adaptée à la présence d'un formulaire. Toujours un **brouillon** : rien n'est appliqué avant « Enregistrer ». Fermeture par le voile ou Échap — pas `useDismissOnOutside`, car un clic sur une option de `<select>` (rendue par l'OS, hors document) n'atteint jamais le voile. |
| 9-bis | `RecordDialog` — **pop-up de détail d'une ligne**, générique : cliquer une ligne (liste, tableau, ou le widget « Nouveaux dossiers abonnés ») ouvre une fiche qui affiche **tous** les champs déclarés par le descripteur, dans leur ordre de déclaration. Aucun code par source. Champs vides montrés avec un tiret (sur un dossier, « Signé le — » est une information). `detailPage` sur `SourceDesc` ajoute « Ouvrir la fiche complète » ; `ficheHref` permet de forcer l'URL quand le record id de la ligne n'est pas celui de la fiche (cas de `notifC`). ⚠️ Rendue **frère du widget** et jamais dans son corps : le corps est inerte en mode Personnaliser et reçoit un `transform` pendant le FLIP, ce qui capturerait le `position: fixed`. Pas de portail possible (`react-dom` n'est pas importable). |
| 5-ter | `MONOGRAMS` / `monogramOf` / `<Monogram>` — les **initiales**, refondues le 2026-08-06 (variante « monogramme teinté »). Fond pastel + encre foncée assortie, au lieu du dégradé `hsl()` saturé à texte blanc : la teinte était libre donc hors charte, et douze pastilles saturées passaient devant le contenu. Palette **fermée** (8 paires reprises de la charte), choisie de façon **déterministe** sur le nom — la même personne garde sa couleur partout. Pas de rouge (couleur d'alerte). Contrastes **mesurés** (≥ 4,5:1) ; l'ambre utilise `warnInk` et non `solar600`, qui ne donnait que 2,95:1. Une seule implémentation pour les 5 emplacements, dont le podium qui garde sa classe `slb-pod-av` (animation de survol). |
| 5-bis | `identWords` / `identOf` / `ownerIsUser` — rapprochement **session ↔ champ « propriétaire »** de la base. Softr identifie par e-mail, la base ne stocke que des noms : le rapprochement se fait sur les mots du nom, et exige **deux mots communs** dès que les deux côtés ont prénom + nom (sinon « Frédéric Martin » verrait les dossiers de « Frédéric HUET »). Pures, 16 cas vérifiés le 2026-08-06. |
| 3 | `Badge` / `statusVariant` (statut métier → variante de couleur) |
| 4 | `TabBar` (onglets réutilisables avec pastille compteur) |
| 5 | Helpers de formatage : `fmtDate`, `relDays`, `fmtRel`, `fmtDue`, `dueVariant`, `initials`, `avatarBg`, `firstNameOf` |
| **6** | **Données** : `DS = datasource.define({…})`, tous les `SELECT_*`, types de vue, `flatten`/`flattenRows`, `mapNotif`/`mapTask`/`mapNote`/`isDone`, `MOCK_USER` + `MOCK_ROWS` (indexé par source) |
| **6-bis** | **Couche SOURCES** : `SourceKey`, **descripteur `CATALOG`** (`SourceDesc`/`FieldDesc`), map `ICONS` + `iconOf`, `variantOf`, `isLive`/`liveState`/`offlineState`, adapters (`AbonnesSource`) et dispatch statique **`SourceFeed`** |
| **6-ter** | **Cache d'INSTANTANÉS** (2026-08-18) : `snapSig`/`snapKey`, `readSnapshot`/`writeSnapshot`/`evictOldest`/`purgeSnapshots`, `snapAge`/`fmtStamp`, **`SourceRefreshCtx`** (le bouton « relire » de chaque carte), et **`useSnapshot`** — la jointure instantané ↔ live appelée par les 12 adapters. Détail complet en §4 |
| 7 | `NAV_TABS` + `QUICK_LINKS` (URLs, la plupart encore `#`) |
| 8 | Composants de page : `EmptyState`, les **4 contextes de widget** (`WidgetChromeCtx`, `WidgetOptionsCtx`, **`WidgetCfgCtx`**, **`WidgetGrabCtx`**) + `WidgetHeightCtx`, `useDismissOnOutside`/`hitsRect`, `WidgetEditMenu`, **`Widget`** (la coquille), `ScrollBody`, `PageNavBar`, `Hero`, **`topOrigin`/`softrPageUrl`**, `QuickLinks`, `EmbedTab` |
| 9 | Composants **présentiels** des widgets sur-mesure : `NotifsOptions`/`NotifRow`/`NotifWidget` (+ `matchNotifC`/`linkIds`, la jointure d'état de lecture), `TaskRow`/`TasksWidget` |
| **9-septies** | **Performance commerciale** : `comStats` et `comGlobal` (pures, les deux calculs partagés), `fmtMEur`/`fmtKwc`, `Sparkline`, les **indicateurs** (`ComIndicsWidget`, registre `COM_METRICS`), le **podium** (`PodiumWidget`) et le **classement** (`ClassementWidget`, 10 colonnes triables) — repris de l'onglet Commercial du bloc `dashboard-KPI` |
| **—** | **`KpiTiles`** + type `Tile` : le rendu des tuiles d'indicateurs, partagé par la synthèse SAV et les indicateurs commerciaux |
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
`annonces` = barre d'annonces) passent par **`ElfsightWidget`** (refonte du 2026-08-07 ;
`ElfsightEmbed`, `useElfsightPlatform` et le diagnostic `elfsightFacts` ont été supprimés) :

⚠️⚠️ **LE MONTAGE DIRECT A ÉTÉ ABANDONNÉ le 2026-08-07** : les embeds vivent désormais dans une
**iframe `srcDoc`** qui contient le snippet officiel, et rien d'autre. ✅ **Vérifié dans le bloc le
2026-08-07 — les embeds s'affichent.** Ne pas retenter le montage direct.

- **Props** : `widgetId` (l'identifiant NU, sans le préfixe `elfsight-app-`), `height` (défaut
  `ELFSIGHT_HEIGHT` = 420) et `title`. L'iframe est en `width: 100%`, `border: 0`,
  `loading="lazy"`.
- **Pourquoi** : trois implémentations du montage direct ont échoué (script chargé une fois, seconde
  chance avec re-scan, réinjection à chaque montage). Le test de production du 2026-08-07 — même
  identifiant, même CDN, dans un bloc séparé — montre que le widget s'affiche **dès qu'il a son
  propre document**.
- **Ce que ce test innocente** : le widget et le compte Elfsight (même id), l'URL du runtime (même
  CDN) et **la CSP** — un document `srcdoc` hérite de la politique du parent, donc le script y était
  déjà autorisé. La piste CSP du 2026-08-05 est **close**.
- **Cause résiduelle, non corrigée mais isolée** : le document de l'app. `platform.js` scanne
  `document` et ne voit pas le conteneur rendu par React dans le bloc — shadow DOM du bloc
  `vibe code` selon toute vraisemblance, ou remontages React. On ne la corrige pas ; l'iframe la
  contourne.
- ⚠️ **Hauteur FIXE** (une iframe ne se dimensionne pas sur son contenu, et `postMessage`
  supposerait une page complice). Si le contenu de la bannière change côté Elfsight, ajuster
  `ELFSIGHT_HEIGHT` ou passer `height` sur l'appel. Ces widgets n'utilisant pas `ScrollBody`, le
  réglage de hauteur de la carte **commande la hauteur de l'iframe** depuis le 2026-08-07 (avant,
  elle valait 420 px en dur et le réglage ne faisait rien) ; le tassement, lui, suit tout seul.
- ⚠️ Dans le template du document, la balise fermante s'écrit `<\/script>` (**slash échappé**) :
  écrite en clair, elle fermerait prématurément le script qui l'entoure quand le bundle est servi
  inline, ce qui est le cas du bloc collé dans Softr.
- **Plus de repli, plus de diagnostic** : les états intermédiaires (runtime chargé / stérile /
  indéterminé) n'existent plus, l'iframe se charge ou non. Ne pas remettre de diagnostic dans
  l'interface.
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
  notifs:             { title: "Nouveaux dossiers abonnés", icon: Bell,         Render: NotifsCard,   // clé inchangée : contrat de persistance
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

⚠️ **`orderBy` n'est pas un choix d'affichage** : pour les adapters NON paginés, il décide **quelles
lignes sont lues** dès qu'une table dépasse la première page. Chaque adapter trie par la colonne
qui garde les lignes utiles à ses widgets (les plus récentes pour des notes, l'échéance la plus
proche pour des tâches).

⚠️ **Corollaire, et il a coûté un bug (corrigé le 2026-08-05)** : un adapter qui alimente un widget
qui **agrège** doit être paginé, sinon ses totaux décrivent la fenêtre et non la table. `SavSource`
ne l'était pas : `savKpis` annonçait **6 dossiers ouverts** contre **18** réels. Le tri `debut` desc
retournait le couteau — en gardant les dossiers récents il écartait les plus anciens, donc l'alerte
« ouverts > 60 j » ne pouvait pas s'allumer, et son silence se lisait comme une bonne nouvelle.
Règle à retenir : **agréger ⇒ paginer, ou dire qu'on ne sait pas.**

### `drain` — la pagination suit le BESOIN, pas la source (2026-08-05)

Paginer toutes les sources coûterait des dizaines de requêtes pour des listes de 12 lignes ; n'en
paginer aucune produit des chiffres faux. `SourceFeed` prend donc un booléen **`drain`**, transmis à
`useDrainPages(res, max, enabled)` : le même adapter sert une liste (une page) ou un agrégat
(pagination vidée + `partial`). `enabled: false` rend `partial: false` — le drapeau qualifie la
**promesse du widget**, pas la lecture.

| Consommateur | `drain` | Pourquoi |
| --- | --- | --- |
| Performance ×3, Exceptions ×2, parcs ×2, Pilotage SAV | **toujours** (dans l'adapter) | ces sources n'existent que pour être agrégées |
| Vue générique **`kpi`** (`count`/`sum`/`avg`) | **oui**, `DataView` le passe | un indicateur EST une promesse de total |
| Vues **`list`** / **`table`** | non | elles décrivent ce qu'elles montrent, après `applyQuery` |
| **Journal des tâches** | **oui**, les deux sources | ses pastilles d'onglet sont des compteurs |
| **Nouveaux dossiers abonnés** → `notifC` | **oui** | pour **filtrer et regrouper** sur toute la table (voir ci-dessous) |

Deux corrections du même jour, de la même famille :
- **Journal des tâches** — les pastilles comptaient `prospects.length`, or les listes sont tronquées
  à `RECENT` : un onglet affichait « 12 » là où la table en portait quarante. Les totaux sont
  désormais calculés avant la troncature et passés séparément, et le widget écrit « 12 des 40 tâches
  ouvertes » sous la liste pour que l'écart ne se lise pas comme une incohérence.
- **Derniers dossiers** — l'état lu/non-lu était une **jointure** (`matchNotifC`) : une notification
  hors fenêtre faisait retomber la ligne sur `nonLu = false`, donc un dossier non traité passait pour
  traité, sans bouton « Vu ». Faux négatif silencieux, corrigé en drainant `notifC`.

> **2026-08-06 — la jointure a disparu, et avec elle ce faux négatif.** Le widget, renommé
> **« Nouveaux dossiers abonnés »**, lit `notifC` **seule** : l'état est porté par la ligne
> affichée. Le drainage reste nécessaire, pour une autre raison — le **filtre** (propriétaire non
> vide) et le **regroupement des jumelles** doivent porter sur toute la table, sinon une page
> presque entièrement écartée donnerait un widget vide sur une table pleine. Le preset de galerie
> « Derniers dossiers Abonné » de la source `abonnes` a été **retiré** : c'était le widget jumeau,
> même liste sans l'état de lecture. `matchNotifC` et `mapNotif` sont supprimés, `mapNotifC` et
> `dedupeNotifs` (pure) les remplacent.

⚠️ **Limite résiduelle assumée** : les filtres des vues `list`/`table` (`applyQuery`) opèrent **côté
client, sur les lignes lues**. Un filtre sur une valeur rare peut donc rendre « aucun résultat »
alors que la table en contient — au-delà de la première page. Poser `drain` dès qu'un filtre est
actif corrigerait le cas, au prix d'une lecture complète à chaque widget filtré : arbitrage non
tranché.

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

C'est le « tout-en-JSON » du principe directeur (§8.1) : une entrée de **pure donnée** par source, qui décrit
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

**Ajouter une source** = 6 gestes, ~30 lignes, sans toucher au moteur : **recette du §8.4**
(connecter dans l'onglet *Sources* → membre du `define` → `SELECT_*` → adapter → `case` →
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
| ~~`WidgetChromeCtx`~~ | **SUPPRIMÉ le 2026-08-07** | avec le mode Personnaliser : plus de poignée `GripVertical`, plus de `WidgetEditMenu`, plus de corps inerte. Monter/Descendre ont disparu avec lui le 2026-08-07 : réordonnancement au glisser-déposer uniquement |
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
  Poignée du bas (pointer, **réglage continu** : la carte suit la souris, arrondi au pas de
  4 px) — et **elle seule** : le champ en pixels du ⋮ a été retiré le 2026-08-07, la hauteur
  n'a donc plus qu'un chemin, à la souris. ⚠️ Depuis le 2026-08-07 la hauteur est un NOMBRE, plus un cran nommé : l'hystérésis
  qui évitait l'oscillation entre deux crans a disparu avec eux — une hauteur continue est
  une fonction monotone de la position du pointeur, rien ne peut osciller. Les anciennes clés
  restent lues (`LEGACY_HEIGHTS`) et ne sont jamais réécrites sous cette forme.
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
distinct de `instance.type` (entrée de registre). C'est la première pièce posée par la refonte.

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
- **`GALLERY_GROUPS` / `SOURCE_GROUP` / `PRESET_GROUPS`** — les familles métier (Abonnés, Tâches,
  Notes, Dossiers SAV, Communication, Performance, Utilitaires, Autres), servies en **pastilles de
  filtre** dans la galerie.

### Exceptions — tuiles de couverture et registre (§9-octies)

Une exception est une règle dérogatoire accordée soit à **un dossier** (périmètre *abonné*, table
« Projet solaire »), soit à **un partenaire** (périmètre *partenaire*, table « Partenaire »). Les deux
tables n'ont pas les mêmes champs — le titre est le dossier d'un côté, `Name` de l'autre, et seule la
seconde porte un statut — donc `excLignes` les **unit en une seule forme de ligne**, le périmètre
venant de la source qui l'a lue. Cette divergence est résolue **une fois**, pas dans chaque widget.

**Deux widgets** : `excIndics` (8 tuiles en deux groupes, séparés par l'intertitre « Couverture du
parc & intensité » — « 21 exceptions » et « 0,3 % du parc » ne répondent pas à la même question) et
`excRegistre` (le tableau, 9 colonnes, périmètre en badge, description clampée à deux lignes avec le
texte entier en `title`).

⚠️ **Ce sont des taux de couverture, donc ils ont des dénominateurs** : `parcAbo` (la table Abonnés
relue en **un** champ, paginée) et `parcPart` (« BDD Installateur »). Un parc **incomplet ou vide vaut
`null`**, et la tuile **tait alors son pourcentage** au lieu de le calculer : c'est exactement
l'erreur qui affichait « 2 % du parc (100 dossiers) » pour 1 759 dossiers dans le bloc KPI. Un seul
champ par parc, aussi : on ne veut que compter, et 1 771 lignes larges se paieraient à chaque
affichage.

Deux détails de lecture qui comptent : la comparaison des 30 jours **nomme** la période précédente
(« aucune sur les 30 j précédents ») au lieu d'un pourcentage — passer de 0 à 21 ne fait pas
« +2 100 % » ; et `fmtPct` écrit « 0,3 % » plutôt que « 0 % », qui se lirait comme *aucun* alors que
six dossiers sont concernés.

~~Non reprises du bloc KPI, faute de sens ici : le bouton « Rafraîchir » (les sources se relisent au
montage) et l'ouverture d'une ligne en fiche détail.~~ **Les deux ont fini par être reprises** :
la fiche détail est devenue `RecordDialog` (générique, §2), et le bouton « relire » existe depuis le
2026-08-18 — sur **chaque carte** qui lit la base, et non en tête de page (§4). Le raisonnement
d'origine (« les sources se relisent au montage ») était juste tant que revenir sur la page
relisait tout ; le cache d'instantanés a précisément supprimé cette relecture systématique, donc il
a fallu rendre le geste explicite.

### La galerie — feuille modale, recherche, miniatures (2026-08-04)

Le dépliant par famille a été remplacé. Ce qui n'allait pas : la galerie n'existait **qu'en mode
Personnaliser** (il fallait entrer dans un mode pour ajouter une carte), il fallait **deviner** dans
quel dépliant chercher, et un libellé plus une icône ne disent pas **à quoi ressemblera** le widget.

- **Feuille modale** (`WidgetGallery`) : voile + `backdropFilter: blur`, panneau centré à coins
  arrondis, en-tête fixe (recherche + pastilles de familles), corps qui défile.
  ⚠️ `position: fixed` **dans une iframe** se réfère au viewport de l'**iframe** : la feuille couvre
  le bloc, jamais l'app autour — c'est voulu, et c'est déjà le cas du toast. D'où `maxHeight: 86%`
  et un corps défilant, pour qu'aucune carte ne finisse hors de portée si le bloc est très haut.
- **Le fond ne défile plus quand une modale est ouverte** (`useModalScrollLock`, 2026-08-17). Bug
  observé : la molette faisait défiler **la page derrière** avant la galerie. Deux causes cumulées,
  deux correctifs indissociables. (1) `overflow: hidden` **et** `overscroll-behavior: none` sur
  `<html>`/`<body>` : la molette sur le voile ou l'en-tête ne vise aucun conteneur défilant, elle
  remonte au document, et — bloc en **iframe** — poursuit dans la page Softr ; un document non
  défilable transmet quand même la molette au cadre parent sans `overscroll-behavior`, et depuis
  l'iframe on ne peut pas arrêter la page Softr elle-même (documents distincts). Les valeurs exactes
  relevées à l'ouverture sont restaurées à la fermeture (deux modales peuvent se superposer).
  (2) `overscroll-behavior: contain` sur le corps (`MODAL_BODY`) : arrivé en bas de la liste, la
  molette s'arrête là au lieu de repartir sur le fond. Le hook sert aussi à `WidgetOptionsMenu` et
  `RecordDialog`, qui avaient le même défaut. ⚠️ Le corps de la galerie était en plus plafonné à
  340 px par `.slb-scrolly` (`max-height: var(--slb-wh, 340px)`, prévu pour le corps d'un **widget**) :
  d'où `maxHeight: "none"` au point d'appel — sans lui la feuille n'occupait pas ses 86 %.
- **Recherche** sur le libellé **et** la description, insensible aux accents (« a signer » trouve
  « À signer ») : personne ne tape les accents dans un champ de recherche. Le nombre de résultats est
  affiché — sans lui, une recherche vide ressemble à un écran cassé.
- **Miniatures dessinées** (`PresetShape`, 9 archétypes) et **non le widget réel en réduction** :
  un vrai widget est illisible sous 120 px, et surtout **il monterait sa source** — ouvrir la galerie
  déclencherait toutes les lectures du bloc, dont le parc entier pour la Performance. Une galerie ne
  doit rien coûter. Pour les presets `data`, l'archétype se **déduit de `view.kind`** : un preset qui
  passe en tableau change de miniature tout seul.
- **Descriptions** : écrites à la main pour les types sur-mesure (`CUSTOM_TYPES.desc`), **générées**
  pour les presets de source (« Tableau sur « Dossiers SAV » … ») — un texte par preset serait à
  écrire à chaque source branchée, donc oublié une fois sur deux.
- **Accessible dans les deux modes**, depuis un bouton « Ajouter un widget » de la barre. Hors mode
  l'ajout est **écrit immédiatement** (silencieux si tout va bien) ; en mode Personnaliser il va dans
  le brouillon. Entrer ou sortir du mode **ferme la feuille** : le même bouton alimenterait sinon
  deux régimes différents, ce qui finirait par perdre un widget.
- La feuille **reste ouverte** après un ajout (on en pose souvent deux ou trois), et la carte passe à
  « Ajouté » — la règle « un exemplaire par modèle » reste celle d'`addInstance`. Le regroupement suit le **domaine**, pas le mécanisme : la synthèse SAV
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

### ~~Cycle du mode Personnaliser~~ — SUPPRIMÉ le 2026-08-07 (section conservée pour l'historique)

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

### Le CACHE D'INSTANTANÉS — la donnée métier, pas la disposition (2026-08-18)

À ne pas confondre avec le cache ci-dessus : celui-là garde la **disposition** d'un utilisateur,
celui-ci garde les **lignes des tables**. Il vit en `Block.tsx` §6-ter.

**Le problème.** La page d'accueil est la plus visitée du CRM et repartait de zéro à chaque
visite : la navigation Softr recharge l'iframe, donc le cache mémoire de `useRecords` est perdu.
Or onze sources **drainent** leur pagination page par page (`useDrainPages`) — jusqu'à
`COM_MAX_PAGES = 120` allers-retours **en série** sur `abonnes` (1 774 lignes), `notifC` (2 142),
`sav` (~771). Pendant ces secondes-là, la page était vide, puis affichait des chiffres qui montaient.

**Le contrat — « stale-while-revalidate ».** On sert le dernier instantané complet tout de suite,
on relit en fond, on remplace quand la relecture est **terminée**. La base reste la source de
vérité ; l'instantané n'est qu'un point de départ.

| | |
|---|---|
| **Clé** | `slb-home-snap:<email>:<source>:<full\|page>:<sig>` |
| `<full\|page>` | l'adapter draine ou non — deux consommateurs de la même source ne lisent pas la même chose et ne partagent pas d'entrée |
| `<sig>` | hash djb2 des **clés du `SELECT_*`** : un alias ajouté, retiré ou renommé invalide l'entrée |
| **Valeur** | `{ v, at, rows }` — les `Row` déjà aplaties par `flattenRows` |
| **Budget** | `SNAP_MAX_CHARS = 900 000` caractères par entrée ; au-delà, rien n'est écrit (trace console une fois) |
| **Listes** | tronquées à `SNAP_ROWS_LIST = 80` lignes ; les sources drainées sont gardées **entières** |
| **Quota plein** | `evictOldest` supprime l'instantané le plus ancien et réessaie (4 fois) |
| **Purge** | au montage : autre e-mail, autre version, plus de 7 jours |
| **Horodatage** | le `at` de CHAQUE entrée, remonté par `useSnapshot` jusqu'au bouton de sa carte |

**Deux règles qui portent toute la justesse** — les toucher, c'est rouvrir le défaut du bloc SAV :

1. On ne **sert** l'instantané que tant que la lecture est en cours (`loading || draining`). Dès
   qu'elle est finie, le live fait autorité **même s'il rend zéro ligne** — sinon une table vidée
   ou un filtre restrictif afficherait éternellement des lignes qui n'existent plus.
2. On n'**écrit** l'instantané que sur une lecture **complète** (`!loading && !draining`). Écrire à
   mi-drainage figerait un agrégat faux, crédible et silencieux.

**Ce que ça change à l'écran.** `SourceState` gagne `stale` et `at`. Les widgets ne voient plus
`loading: true` quand un instantané est servi (donc plus de squelette), et `AggregateNote` a un
**troisième état**, « Instantané — chiffres d'il y a N min, mise à jour en cours », qui passe avant
« Calcul en cours » et « Calcul partiel ».

### Relire — un bouton par carte, pas un bouton pour tout (2026-08-18)

Il y a d'abord eu un **chip unique dans le héro**. Il a été retiré le jour même : il relisait
**tout** — une dizaine de sources, jusqu'à 120 requêtes pour certaines — alors que l'intention est
presque toujours « CE widget-là a bougé, montre-le moi ». Un bouton dont le coût est sans rapport
avec l'intention est un bouton qu'on n'ose plus cliquer.

`SourceFeed` tient donc un `nonce` **local**, porté en `key` sur un `Fragment` : l'incrémenter
démonte et remonte **son** adapter, donc `useRecords` repart. C'est le seul mécanisme qui ne suppose
rien de l'API Softr. En renfort, `useDrainPages` appelle `res.refetch?.()` au premier montage **qui
suit** un rafraîchissement explicite (`nonce > 0`) — au cas où Softr garderait un cache mémoire
(react-query, `staleTime`) que le remontage ne traverserait pas.

**Le bouton apparaît sans qu'aucun widget soit modifié.** `SourceFeed` publie `{nonce, refresh,
busy, at, publish}` dans **`SourceRefreshCtx`**, que la coquille `Widget` consomme. D'où trois
propriétés obtenues par construction plutôt que par une liste à tenir à jour :

- un widget **sans source** (horloge, pense-bête, liste à cocher, feeds LinkedIn) ne trouve aucun
  contexte : **pas de bouton** ;
- une source **non connectée** (qui sert son mock en production) n'installe pas de provider : pas de
  bouton non plus — même règle que `write`, mieux vaut pas de bouton qu'un bouton qui ment. En
  **aperçu** (`USE_MOCK`) il est au contraire conservé, comme les écritures y sont simulées ;
- un widget à **plusieurs sources** (les exceptions en lisent quatre) a des `SourceFeed` imbriqués,
  et chaque niveau **compose** avec celui du dessus : un seul bouton, qui les relit toutes. Sans
  cette composition il n'aurait rafraîchi que la source la plus interne, et le widget aurait affiché
  un total mis à jour à moitié.

L'information circule **dans les deux sens** : le contexte descend `refresh`, et `useSnapshot`
remonte `{reading, at}` par `publish` — c'est le seul endroit qui connaisse l'état réel de la
lecture. `reading` fait tourner l'icône, `at` remplit le `title` (« Données du 18/08 à 09:14 —
cliquer pour relire »).

**Limite connue, assumée** : l'instantané est écrit **une fois par montage**, à la fin de la
lecture. Une écriture faite ensuite depuis la page (cocher « Fait », marquer une notification vue)
n'y est pas reportée : à la visite suivante, la ligne réapparaît dans son ancien état pendant la
seconde que dure la relecture.

**⚠️ Données nominatives.** Ce cache contient des lignes du CRM sur le disque du poste. D'où la clé
par e-mail et la purge des entrées d'un autre utilisateur au montage. Tout est en `try/catch` :
quota plein, mode privé, iframe au stockage bloqué — la page fonctionne sans cache.

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
| `abonnes` | « Abonnés » (BDD Abonné) | ✅ **connecté** | nom `Nom` · prenom `Prenom` · partenaire `Nom de l'entreprise (from Installateur )` · statut `Statut Dossiers` · offre `Type d installation` · creeLe `date de création` · **client `Champs IA Config client`** *(2026-08-18)* |
| `notesIns` | « Suivi client » (Bdd Installateurs, `tblkP20xivQbSSLUj`) | ✅ **connecté** | nom `Installateur` · note `Notes` · date `Date `*(espace final)* |
| `notesPro` | « Suivi propect » (BDD Propect, `tblaWCbZGGz7IUdNm`) | ✅ **connecté** | nom `Nom` · note `Notes` · date `date `*(espace final, createdTime)* |
| `tachesPa` | « Taches » (Bdd Installateurs, `tblebnLi0r90yuqry`) | ✅ **connecté** | desc `Description` · associe `Partenaire associé` · fin `date de fin` · fait `Fait` |
| `tachesPr` | « Taches prospect » (Bdd Installateurs, `tblYQaq030GsdnIdy`) | ✅ **connecté** | desc `Description` · associe `Prospect associé` · fin `Date de fin` · fait `Fait` |
| `sav` | « Tickets » (SAV, `tblf4KgGHCaZXKnBX`) | ✅ **connecté**, lecture seule | 22 alias (ticket, client, installateur, dates, 12 catégories, fabricant, priorité, statut, tiers, coût) |
| `notifC` | « Notification Center » (BDD Abonné, `tblqF71AO8nFVpWi5`) | ⏳ **non connecté** | liens `Liens BDD` · aLire `Statut de lecture` · etat `Statut de la notification` · creeLe `Created Date` |
| `excAbo` | « Projet solaire » (Bdd Installateurs, `tblDiXeZn207S4hBE`) — exceptions **abonné** | ⏳ **non connecté** | dossier `SL- Dossier` · description · categorie `Catégorie` · sousCategorie `Sous catégorie` · service `Tag` · valideur · justificatif · installateur `BDD Installateur` · creeLe `Date de création` |
| `excPart` | « Partenaire » (`tbl6RsrSjP1FijHzJ`) — exceptions **partenaire** | ⏳ **non connecté** | nom `Name` · idem `excAbo` + statut `Statut` |
| `parcPart` | « BDD Installateur » (`tblQLEpjqyUn54XTb`) — dénominateur | ⏳ **non connecté** | nom `Nom de l'entreprise` |
| `parcAbo` | « Abonnés » **relue en 1 champ**, paginée — dénominateur | ✅ **connecté** (même `8fc957d0-…`) | ref `Contrat abonné` |
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

### Pro / particulier, et les deux files d'attente (2026-08-18)

**Le champ.** `Champs IA Config client` (`fld3SpiGzcJrADLgL`) est une **formule** qui rend trois
valeurs, et trois seulement : civilité vide → **`Pro`** · « Monsieur » ou « Madame » → **`Solo`** ·
sinon → **`Duo`**. La base ne dit donc **jamais « particulier »** : c'est notre regroupement
(Solo ∪ Duo), fait à un seul endroit, `clientKind`. Relevé sur les 39 dossiers en attente le
2026-08-18 : 31 Pro, 7 Solo, 1 Duo, aucune valeur vide.

**Le réglage.** `clientField` sur `SourceDesc` — même patron que `ownerField` : renseigné, tout
widget de la source gagne un `<select>` de clientèle (`cfg.clientele`), à **`tous`** par défaut. Le
filtrage passe par `clientScope`, appliqué dans `selectRows` **avant** les filtres, donc aussi aux
agrégats — un KPI ne doit pas compter tout le monde au-dessus d'une liste qui n'en montre qu'une
part.

#### CINQ périmètres, et non trois (2026-08-20 — demandé)

La base garde ses trois valeurs ; le réglage en propose **cinq**, parce que « particulier » est une
lecture et non une valeur :

| Clé | Libellé | Ce qu'elle retient |
|---|---|---|
| `tous` | Tous les clients | tout, y compris les lignes non classables |
| `pro` | Professionnels seulement (Pro) | `Pro` |
| `particulier` | Particuliers seulement (Solo + Duo) | tout ce qui **n'est pas** `Pro` |
| `solo` | Particuliers — Solo seulement | `Solo` |
| `duo` | Particuliers — Duo seulement | `Duo` |

Le détail Solo / Duo a été demandé parce qu'un dossier à **deux** titulaires n'a ni le même circuit
de signature ni les mêmes relances qu'un dossier à un seul.

Trois fonctions pures, un seul endroit chacune : `clientKind` classe une valeur brute
(`pro` / `solo` / `duo` / `particulier` / `""`), `clientMatch` dit si un genre entre dans un
périmètre, `clienteleRows` applique le périmètre à des lignes. `clientScope` (widgets `data`) ne fait
plus que résoudre l'alias depuis le catalogue puis déléguer — deux implémentations du même arbitrage
finiraient par diverger. `clienteleCourt` porte le mot des sous-titres (« 12 dossiers ·
particuliers »), pour qu'aucun widget n'écrive le sien.

> ⚠️ `clientKind` ne lit que la **première** valeur d'un lookup multi-valeurs (`asText` les joint par
> « , ») : sur `notifC`, une ligne liée à deux dossiers arrivait en « Pro, Pro » et tombait dans le
> fourre-tout `particulier`. Aucune des trois valeurs réelles ne contient de virgule.

> ⚠️ Une valeur **inconnue** non vide est classée `particulier`, pas `""` : tout ce qui n'est pas
> « Pro » est un foyer, ce qui restera vrai d'une éventuelle quatrième forme — là où une liste
> blanche `["solo","duo"]` la ferait disparaître du périmètre « Particuliers » sans un mot.

#### Où le réglage est offert (2026-08-20)

| Widget | Source | Réglage |
|---|---|---|
| Tout widget `data` | `abonnes` | `cfg.clientele`, formulaire générique (`DataOptions`) |
| **Les deux files d'attente** | `abonnes` | `FileOptions` — **second et dernier** réglage, à côté de l'ordre |
| **Nouveaux dossiers abonnés** | `notifC` | `NotifsCfg.clientele` + le type de client **affichable** en pastille sur la ligne (`NOTIF_FIELDS`) |
| **Podium CAPEX · Classement commerciaux · Tous les installateurs · Indicateurs commerciaux** | `comKpi` | `ClienteleSelect`, appliqué **avant** `comStats` / `comGlobal` |

Les quatre widgets commerciaux agrègent : le périmètre est donc appliqué aux **lignes**, jamais aux
résultats — un filtre posé après coup aurait laissé les CAPEX, taux de pose et délais se calculer
sur tout le parc sous un titre annonçant les pros. `perimetreCom` n'ajoute le mot au sous-titre que
si le champ est réellement lu (`clientLisible`) : annoncer « pros » sur un classement qui porte tout
le parc serait un mensonge.

**Deux champs à lire en plus**, pour ces deux familles :

| Source | Nom du champ | À cocher côté Softr ? |
|---|---|---|
| `comKpi` | `Champs IA Config client` | **non** — cette lecture passe par la datasource `abonnes`, où le champ est exposé depuis le 2026-08-18 |
| `notifC` | `Champs IA Config client (from Liens BDD)` (`fldEimoiZuVIvuMP7`) | **OUI** — sinon le bloc entier tombe (« does not match / Remap the fields ») |

> Le lookup de `notifC` **existait déjà** dans la table « Notification Center » : relevé par l'API le
> 2026-08-20, rien à créer côté Airtable. Le widget dit lui-même « Filtre inactif » si le champ
> arrive vide sur toutes les lignes, et son état vide « Aucun dossier « … » à traiter » propose de
> **rouvrir** la clientèle — comme « mes dossiers » le fait déjà pour le propriétaire.

> ⚠️ **Le champ doit être coché dans l'onglet Sources du bloc** pour la datasource `abonnes`, sinon
> Softr refuse la datasource entière (« does not match / Remap the fields »). S'il arrive vide sur
> **toutes** les lignes, `clientScope` **ne filtre rien** et le widget affiche « Filtre inactif » —
> plutôt qu'une liste vide dont personne ne saurait dire si elle est juste.

**Les 17 statuts.** La liste d'`options`/`variants` de `statut` a été **entièrement refaite** le
2026-08-18 : celle du 2026-07-31 n'était plus juste, le pipeline ayant été redécoupé. Six statuts
qu'elle listait n'existent plus (« Dossier incomplet pour instruction », « … pour édition de
contrat », « Dossier complet pour instruction », « Assurance non ok », « Dossier PRO en cours
d'étude du service technique », « En attente validation ») et neuf nouveaux manquaient. Les couleurs
suivent une règle : **warn** = la balle est dans notre camp (demande d'infos, contrat à éditer),
**info** = on attend un tiers (solvabilité, validation, signature).

> ⚠️ **Effet de bord : le modèle « Dossiers incomplets » est mort.** Il filtre sur
> `statut contains "incomplet"` et **plus aucun statut ne contient ce mot** — il rend donc une
> liste vide en permanence. Laissé en l'état : décider ce que « incomplet » désigne aujourd'hui est
> un arbitrage métier, pas une correction technique.

**Les deux files d'attente** — `attSolva` et `demInfos`, des **types** (§10) et non des modèles :

| Widget | Filtre | Pourquoi ce filtre |
|---|---|---|
| Demandes d'infos | `statut contains "Demande d'infos"` | le pipeline en compte **trois** (technique · solvabilité · les deux) ; les énumérer figerait le widget au jour où un quatrième apparaît |
| En attente de solvabilité | `statut eq "En attente de solvabilité"` | `contains "solvabilité"` en ramasserait **cinq**, dont deux « Refusé » — des dossiers morts dans une file d'attente |

Les deux trient par `creeLe` **ascendant**, à l'inverse du reste du bloc : une file d'attente se lit
par le haut, le dossier qui traîne depuis décembre doit passer devant celui d'hier.

> ⚠️ **Elles ont d'abord été des modèles du widget générique, et c'était une erreur** (corrigée le
> jour même). En `data`, elles héritaient de tout le formulaire — source, mappage, colonnes,
> filtres, tri, limite, périmètre, clientèle, recherche : une dizaine de réglages pour un widget
> dont la raison d'être tient en une phrase, et parmi lesquels **le choix de la source**, qui
> permettait de leur faire afficher tout autre chose sous le même titre. Leur `limit: 20` cachait
> par ailleurs 5 des 25 dossiers en attente, sans le dire.
>
> Ce sont donc des `WidgetTypeDef` à cfg **figée en constante** (fabrique `fileType`), dont le
> `coerce` ne lit que deux clés de la cfg enregistrée — `tri` et `clientele` — et **reconstruit tout
> le reste** depuis la constante : une instance posée hier suit automatiquement une correction de
> filtre faite dans le code, et rien de ce que porte le document de disposition ne peut détourner le
> widget. Le ⋮ n'y propose que le **nom**, la **couleur**, l'**ordre** et la **clientèle**. Les deux
> modèles d'origine sont `hidden` — masqués et non supprimés, la clé de galerie étant
> `abonnes:<index>`.
>
> Au passage, `DataView` annonce désormais « **N sur M** » quand c'est la **limite** qui coupe, et
> plus seulement une recherche : une liste plafonnée à 20 sur 25 écrivait « 20 dossiers » et cachait
> les cinq autres. Le compte de référence vient de `selectRows` et non d'`applyQuery`, qui applique
> lui-même la limite — « 3 sur 12 » comparait donc à la fenêtre, pas à ce qui existe.

**Leurs réglages : l'ordre, et la clientèle.** `FileOptions` offre deux `<select>` — l'**ordre**
(plus ancien / plus récent / CAPEX élevé / CAPEX faible), parce qu'une file se lit par l'ancienneté
et par l'enjeu ; et la **clientèle**, rétablie le **2026-08-20** (demandée). La cfg stockée ne porte
que ces deux clés (`tri`, `clientele`) : `coerce` reconstruit tout le reste depuis la constante
figée, si bien que la source, le statut suivi et les colonnes restent hors d'atteinte.

> Pourquoi la clientèle revient, alors que le 08-18 l'avait retirée avec tout le formulaire : « qui
> attend sa solvabilité ? » et « quels **particuliers** attendent leur solvabilité ? » sont deux
> charges de travail différentes, traitées par des personnes différentes. Ce n'est pas la
> réouverture du formulaire générique — c'est un **périmètre** validé contre `CLIENTELES`
> (`clienteleOf`), pas un filtre libre.

### Champs CALCULÉS — `derive` (2026-08-18)

Un `FieldDesc` peut porter un **`derive: (row) => …`** : le champ est alors rempli à partir des
autres alias au lieu d'être lu dans un select. Appliqué par `deriveRows` dans **`feedFor`** — un
seul point de passage, mock compris, et **après** le cache d'instantanés (le cache ne garde que ce
que la base a rendu, donc corriger une règle prend effet sans le vider).

Le cas qui l'a introduit : **sur un dossier PRO, « Nom » est VIDE** — c'est « Nom de l'entreprise »
qui porte le client. Les listes mappées sur `nom` affichaient donc une ligne **sans titre** pour les
deux tiers des dossiers en attente. D'où `clientNom` : la raison sociale pour un pro, le nom de
famille sinon, avec **repli dans les deux sens** (un pro sans raison sociale garde son nom). La
règle vit dans le **descripteur** et non dans un widget : « qui est le client » est une propriété de
la table, et `defaultMap.title` d'`abonnes` pointe désormais dessus.

> Un `FieldDesc` peut aussi porter **`detail: false`** — utilisable comme titre, colonne, tri ou
> filtre, mais absent de la pop-up. C'est le cas de `clientNom`, qui n'y serait qu'un doublon de
> « Nom » et « Nom de l'entreprise ».

### La fiche de détail masque les champs VIDES (2026-08-18)

`RecordDialog` affichait tout champ déclaré, vide compris, avec un tiret — délibérément : « Signé
le — » disait que le dossier n'était pas signé. **Inversé sur demande** : à l'usage, cinq lignes de
tirets (facture, contrat édité, contrat signé…) noyaient les trois informations utiles d'un dossier
en attente de solvabilité, où contrat et facturation n'existent pas *encore*.

Le prix est assumé : on ne distingue plus « champ vide » de « champ absent du descripteur », et une
fiche change de longueur d'un dossier à l'autre. ⚠️ « Vide » se mesure sur `asText` : un `0` ou un
`false` **restent affichés** — un CAPEX à 0 € est une information, pas une absence. Ne disparaissent
que les chaînes et les listes vides, dont les pièces jointes non déposées.

**Et le drainage a changé de règle.** `DataView` ne drainait qu'en vue KPI. Il draine désormais dès
que la sélection **restreint** — filtre, périmètre propriétaire ou clientèle. Sans ça, ces deux
modèles auraient cherché leurs dossiers dans la **première page** seulement : les 39 concernés
s'étalent de décembre à août, le widget en aurait montré une poignée avec l'air d'être complet. Le
« N sur M » du sous-titre a le même besoin — M doit compter la table, pas la page. Le coût est réel
(des dizaines de requêtes) ; c'est le cache d'instantanés (§4) qui le rend invisible au retour.

### Les tuiles d'indicateurs — un rendu, deux widgets

`KpiTiles` porte le dessin des cartes du tableau de bord SAV (carte blanche à ombre douce sur fond
teinté, libellé en petites capitales, grande valeur, barre pour les proportions, détail dessous).
Extrait de `SavWidget` le 2026-08-04 quand les indicateurs commerciaux en ont eu besoin — deux copies
auraient dérivé dès la première retouche de charte.

Le composant reçoit des **valeurs déjà calculées** (`Tile`), jamais des fonctions ni un objet de KPI :
c'est ce qui le rend indifférent à la source. Chaque widget garde donc son propre registre de
métriques (`SAV_METRICS`, `COM_METRICS`) et ne partage que la mise en page.

### Performance commerciale — indicateurs, podium et classement (§9-septies)

Trois widgets, **deux calculs** : `comStats` (par commercial) et `comGlobal` (tous confondus, plus la
puissance installée et le pipeline), tous deux purs.

⚠️ Le **pipeline « à signer »** ne se lit pas dans le portefeuille : par définition, un dossier à
signer n'a pas de contrat signé. Critère du bloc KPI — pièce jointe « Contrat d abonnement non
signe » **et** date d'édition dans les 30 derniers jours (`PIPE_JOURS`). La fenêtre est **glissante
et indépendante de la période choisie** : « à signer » parle de ce qui est sur le bureau maintenant,
pas d'un historique. Le panneau d'options le dit à l'utilisateur.

« Installateurs actifs » et « commerciaux au portefeuille » se comptent sur les **signés de la
période** : les compter sur toute la table gonflerait les deux chiffres de partenaires dormants.

Pour le podium et le classement, **un seul calcul** (`comStats`, pure) : les critères sont recopiés de `statsDe` du
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
dégradation prévue (`matchNotifC`), pas une panne. Le brancher : **recette du §8.4**,
en connectant la table à **ce** bloc (un id de datasource appartient à une connexion d'un bloc).

**Écritures ouvertes** : `fait` sur les deux tables de tâches (whitelists `SELECT_TACHE_*_W`), et
`aLire` sur `notifC` le jour de sa connexion. **Les 4 formulaires de création ont été retirés le
2026-08-04** : celui des tâches était cassé par construction (champs hors whitelist → 400), celui
des notes aurait produit des lignes **non rattachées** — « Suivi client » et « Suivi propect »
relient par un champ LIEN, qui attend un record id et non un nom. Ils reviendront le jour où le
bloc saura résoudre un lien (menu alimenté par la table parente) ; `QuickCreate` reste écrit et
inutilisé, prêt pour ce jour-là.

Le **héro n'est pas un widget** : il lit ses sources lui-même, avec la même contrainte `from` qu'un
adapter. `useHeroCounts()` a été **supprimée le 2026-08-05** avec les deux chips chiffrés qu'elle
alimentait : « N tâches urgentes » (notion inexistante dans le CRM, et source non branchée → un
« 0 » perpétuel lu comme « rien à faire ») et « N dossiers à traiter » (qui comptait
`abonnes.slice(0, RECENT)`, donc un plafond de liste, pas une charge de travail). Le héro ne porte
plus qu'un chip **« Notifications » sans compteur**, à implémenter — la note au-dessus de `Hero`
dans `Block.tsx` détaille les deux précautions à prendre (sens de case inversé, lignes orphelines).

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

  > ⚠️ **Périmé depuis** : les outils ont leur propre onglet (`OUTILS`) et `QUICK_LINKS` ne
  > garde que les pages de l'espace. **You Sign et Tik&Lib ont été retirés le 2026-08-18**,
  > adresses comprises ; **Map** (`sunlib-carte-installateurs.vercel.app`) et **ERP**
  > (`erp-sunlib.vercel.app`) les remplacent, embarqués. Sont **masqués** (champ `hidden`,
  > l'entrée et son adresse restent au registre) : **Simulateur Grille** dans les Outils et
  > **Contact Partenaire** dans les Raccourcis. Le README est la référence à jour.

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

Les points qui bloquent l'objectif « widgets complètement indépendants et personnalisables ».

> ⚠️ À ne pas confondre avec le **§8.6**, qui liste ce qui est **hors périmètre par décision** —
> grille libre (x, y), layout mobile distinct, pagination serveur. Les points 4 et 5 ci-dessous en
> sont la contrepartie vue d'ici : ce sont des limites **assumées**, pas des dettes à rembourser.

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
9. **Pagination : le coût de la page d'accueil, et ce qui reste à faire.** Par défaut,
   `useRecords` ne rend que la **première page** — `orderBy` décide donc **quelles** lignes sont
   lues, et tout agrégat porterait sur cette fenêtre. **Onze sources drainent** désormais
   (`useDrainPages`, plafond `COM_MAX_PAGES = 120`) : plafond atteint → `partial: true`, que le
   widget **affiche** (« Calcul partiel »). Tout futur widget qui totalise doit suivre ce chemin,
   et jamais se contenter d'une page en silence.

   Le prix est un **drainage en série** : jusqu'à 120 allers-retours sur `abonnes` et `notifC`.
   Le **cache d'instantanés** (§4) fait que ce coût ne se voit plus à l'écran — il ne le supprime
   pas. Trois leviers restent, et deux d'entre eux ont été **examinés puis écartés, code en main** :

   - **`count` (taille de page) — à TESTER, c'est le levier le moins cher.** Le mock déclare
     `count?: number` sur `useRecords` mais **rien ne dit que Softr l'honore**. S'il le fait,
     120 requêtes tombent à ~30. L'expérience est câblée et **désactivée** dans `Block.tsx`
     (`SOFTR_PAGE_SIZE` + `TRACE_PAGES`, à côté de `COM_MAX_PAGES`) : le mode d'emploi complet est
     dans le commentaire, elle se mène en deux publications. Résultat négatif → **le noter ici**,
     pour ne pas la refaire dans six mois.
   - **Filtrer `notifC` côté serveur : IMPOSSIBLE en l'état.** Le filtre « mes dossiers » ne compare
     pas des e-mails : `ownerIsUser` rapproche un **nom** (« Frédéric Martin ») de la session par
     mots, accents neutralisés, deux mots communs requis. Un `where` ne peut pas reproduire ça, et
     surtout le filtre est un **réglage par widget** (`mesDossiers`) — la source doit donc servir
     les lignes non filtrées. Débloqué le jour où la table portera **l'e-mail** du propriétaire ;
     c'est déjà noté comme « la vraie solution » au-dessus d'`identWords`.
   - **Fenêtrer `comKpi` sur les 24 derniers mois : NON, ça casserait un total.** `PODIUM_PERIODES`
     contient **« Tout »**, qui agrège l'historique entier ; une fenêtre serveur rendrait ce choix
     silencieusement faux — exactement le défaut que ce fichier passe son temps à prévenir. Idem
     pour `parcAbo` / `parcPart`, qui sont des **compteurs de parc** : rien à y filtrer.
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


---

## 8. Principes de conception, recette et pistes ouvertes

> Cette section est ce qui reste d'`ARCHITECTURE-V2.md`, absorbé ici le **2026-08-20**. Le reste de
> ce document décrit **ce que le bloc fait** ; celle-ci dit **pourquoi il est bâti ainsi** et
> **comment l'étendre**. Ce qui a été jeté au passage : le plan de migration par phases (les six
> phases sont livrées), la liste des écarts code ↔ cible (tous traités), et tous les extraits de
> types et de code qui reproduisaient — avec une ou deux semaines de retard — ce que `Block.tsx` dit
> déjà. **Le code fait foi ; ici on ne garde que ce qu'il ne peut pas dire de lui-même.**

### 8.1 Le principe directeur

La question d'origine était : « comment faire pour que le maximum — les données véhiculées, le type
d'affichage, les actions — soit stocké en JSON ? » La réponse tient en une phrase, et c'est elle qui
explique la forme de tout le fichier :

> **Les moteurs sont du code ; tout ce qu'ils lisent est du JSON.**

Le JSON porte des **clés** et des **valeurs** ; le code détient les **implémentations** derrière ces
clés — un renderer, un adapter, une icône, un opérateur de filtre. Le code incompressible par
source, celui qu'impose Softr, tient en ~15 lignes ; tout le reste peut devenir de la donnée.

Corollaire pratique, et c'est le rendement de l'affaire : **ajouter un style d'affichage = un
renderer écrit une fois, disponible pour toutes les sources pour toujours**. Ajouter une source =
~15 lignes de code contraint + ~35 lignes de JSON descriptif (§8.4).

### 8.2 Deux JSON, deux portées — la distinction centrale

C'est la confusion à ne jamais faire : le bloc manipule **deux** documents JSON, qui ne changent ni
au même moment ni pour les mêmes personnes.

| | **Descripteur de source** (`CATALOG`) | **cfg d'instance** |
|---|---|---|
| Décrit | la **table** : champs, kinds, badges, presets, actions possibles | **UN widget posé** : quelle source, quels filtres, quelle vue, quelles actions activées |
| Portée | **partagé**, identique pour tout le monde | **par utilisateur** |
| Vit dans | une constante de `Block.tsx` (§6-bis) | `layout_json` (table `Home Preferences`) |
| Change quand | on branche ou on décrit une table | l'utilisateur personnalise son accueil |

```
   layout_json — PAR UTILISATEUR              CATALOG — PARTAGÉ (constante JSON)
   items: [{ id, type, cfg, w, h }, …]        descripteurs de sources : champs,
   cfg = { source, query, view, actions }     kinds, badges, presets, actions
                  │                                        │
                  ▼                                        │
        WIDGET_REGISTRY["data"]  ◄─────────────────────────┘
        renderers liste / tableau / indicateur · Options générique · RowActions
                  │  cfg.source
                  ▼
        <SourceFeed> → dispatch statique → adapters (useRecords + mutations)
                  │                                        ▲
                  ▼ lecture (SELECT_X)                     │ écriture (SELECT_X_W)
              Airtable / Softr Tables ─────────────────────┘
```

**Les presets sont COPIÉS, pas référencés.** À la pose d'un modèle de galerie, sa `cfg` est recopiée
dans l'instance. L'instance est donc autoportante : elle survit aux évolutions du catalogue, et
retoucher un preset ne réécrit **pas** les accueils déjà personnalisés. Compromis assumé — c'est le
prix de « le maximum d'informations dans le JSON de l'utilisateur ».

**`writable` sur un champ n'a PAS été retenu**, et ce n'est pas un oubli : ce qui est écrivable est
déterminé par le `SELECT_*_W` de l'adapter — la seule barrière réelle — et non par une donnée
falsifiable côté client. L'ordre complet des garde-fous est au cadenas du §3.

### 8.3 La frontière code ↔ JSON, tracée précisément

Le tableau à consulter avant de se demander « où est-ce que je mets ça ? » :

| Information | JSON | Code | Pourquoi |
|---|---|---|---|
| ID de datasource | | ✅ `datasource.define`, littéral | contrainte Softr **dure** |
| `from` des hooks | | ✅ 1 adapter par source | contrainte Softr **dure** |
| Noms de champs exacts / FIELD IDs | *(piste §8.5)* | ✅ `SELECT_*` | seul endroit toléré ; c'est aussi la whitelist d'écriture |
| Alias, libellés, kinds, options | ✅ descripteur | | |
| Couleurs de badge par valeur métier | ✅ descripteur | `statusVariant` en repli | |
| Presets « prêts à poser » | ✅ descripteur | | |
| Actions (écritures, liens) | ✅ descripteur + cfg | exécuteur générique `RowActions` | |
| Type d'affichage + réglages | ✅ `cfg.view` | renderers génériques | |
| Filtres / tri / limite / périmètres | ✅ `cfg.query`, `cfg.mine`, `cfg.clientele` | `applyQuery` pure | |
| Disposition (ordre, largeur, hauteur) | ✅ `layout_json` | moteur de grille | |
| Icônes | ✅ clé string | map `ICONS` | un JSON ne peut pas porter un composant |

Trois conséquences qui comptent quand on branche « beaucoup de projets » :

- **Autant de sources qu'on veut.** `define` n'a pas de limite connue, et seules les instances
  **présentes sur la grille** montent leur adapter : une source connectée qu'aucun widget n'affiche
  ne coûte **aucun** fetch.
- **Seul `from` est verrouillé.** `where`, `orderBy` et leurs valeurs peuvent être dynamiques — la
  persistance le prouve (`q.text("email").is(email)`). C'est la porte ouverte à du **filtrage
  serveur par instance** le jour où une table deviendra trop grosse pour être filtrée côté bloc.
- **Changer de source dans Options remonte le widget** (`key={cfg.source}`) : l'arbre de hooks de
  l'adapter est remplacé proprement, sans violer les règles de hooks.

### 8.4 LA RECETTE — « une table de plus → un widget »

À donner telle quelle à une future session. C'est le passage le plus utile de l'ancien document :
elle a servi **5 fois le 2026-08-04**, sans toucher au moteur une seule fois.

| # | Où | Quoi | Volume |
|---|---|---|---|
| 1 | Softr Studio | `/home-copy` → bloc → onglet **Sources** : connecter la table, noter l'ID, **cocher tous les champs** dont le `SELECT` aura besoin | 0 ligne |
| 2 | `Block.tsx` | le littéral dans `datasource.define` | 1 ligne |
| 3 | `Block.tsx` | `SELECT_X` lecture (+ `SELECT_X_W` si écriture) — noms Airtable **exacts** / FIELD IDs | 6–10 lignes |
| 4 | Couche Sources | l'adapter `XSource` (copier-coller) + un `case` dans `SourceFeed` | ~12 lignes |
| 5 | `CATALOG` | **le descripteur, pur JSON** — champs, kinds, options, variants, defaultSort, defaultMap, presets, actions | ~35 lignes |
| 6 | (option) | `MOCK_ROWS.x`, à la forme des alias | ~8 lignes |

**≈ 50 lignes, dont ~35 de pur JSON descriptif. Zéro toucher au moteur, aux renderers, à la
persistance.** La source apparaît alors dans le sélecteur, ses presets dans la galerie, ses actions
dans Options.

Vérifications, dans cet ordre : `npm run build` ; puis la page **publiée, connecté** — l'aperçu
« œil » n'a pas de session, donc aucune écriture n'y est testable ; puis la parité mock / live.

Cas rare : un rendu vraiment spécifique → un `WidgetTypeDef` dédié **en plus**, qui consomme le même
`SourceFeed` (c'est ce que sont le podium, les classements et le pilotage SAV).

#### Prompt-type

> Nouvelle source pour l'accueil : table Airtable « … » (base …), datasource ID `xxxx-…`, déjà
> connectée dans l'onglet Sources du bloc `/home-copy`. Champs : `alias` « Nom Airtable exact », …
> (avec les valeurs possibles pour les singleSelect). Applique la **recette du §8.4
> d'`ARCHITECTURE.md`** : SELECT lecture (+ écriture sur …), adapter, `case` dans `SourceFeed`,
> descripteur `CATALOG` complet avec un preset liste et un preset indicateur, les actions …, et un
> mock de 5 lignes. Vérifie les noms de champs contre Airtable **avant** d'ouvrir la lecture.

> ⚠️ **Vérifier les noms contre Airtable, jamais contre un README.** Les 7 pièges attendus (espaces
> finaux, casses irrégulières, « Proprietaire » sans accent) se sont tous révélés exacts — mais
> c'est la vérification qui l'a prouvé, pas la confiance.

### 8.5 Les deux pistes restées ouvertes

**A — Le `select` dynamique** (jamais tenté). La dernière information encore en code qui *pourrait*
passer en JSON : les noms de champs exacts. Rien dans les contraintes documentées n'interdit
`q.select(obj)` avec un objet construit à l'exécution — **seul `from` est explicitement verrouillé**.
Mais l'éditeur Softr analyse le bloc (l'erreur « Remap the fields » le prouve), donc c'est à
**tester**, pas à supposer. Protocole, 15 min, sur **une** source secondaire :

1. ajouter `at:` à chaque champ du descripteur (`client: { at: "Client", … }`) et générer
   `q.select(Object.fromEntries(Object.entries(desc.fields).map(([a, f]) => [a, f.at])))` ;
2. coller, **rouvrir l'onglet Sources** pour observer le remap, publier, tester **lecture ET
   écriture** en étant connecté ;
3. ✅ → les noms de champs migrent dans le descripteur et la recette perd une étape.
   ❌ (« Remap the fields », 400, lecture vide) → on reste sur `SELECT_*` en code : 6 lignes par
   source, chemin éprouvé. **Ne rien généraliser avant ce test** — les contraintes Softr ont déjà
   surpris plus d'une fois.

**B — Le catalogue en table** (pas fait, et c'est délibéré). Le descripteur vit en constante parce
qu'**ajouter une source impose de toute façon un collage** (littéral `define` + adapter) : le JSON
voyage donc gratuitement avec le code, versionné par git et vérifié par TypeScript. Si le besoin de
retoucher **sans recoller** devenait réel — libellés, couleurs, presets — l'extension est prête :
une table `Catalog` lue au démarrage et fusionnée par-dessus la constante, qui resterait le repli.
Tant que personne ne le demande, ce serait une lecture de plus au chargement pour un bénéfice nul.

### 8.6 Hors périmètre — assumé

Décidé une fois, et pas rediscuté à chaque session :

- **grille libre (x, y)** — le schéma `Instance` reste extensible par champs additifs, donc rien
  n'est fermé ; l'ordre linéaire + largeur binaire suffit à ce que cette page doit faire ;
- **`layout_mobile_json`** — la grille responsive suffit ; un second document par breakpoint
  doublerait la surface de bugs de persistance ;
- **pagination serveur** — porte ouverte via `where`/`orderBy` dynamiques (§8.3), à n'ouvrir que sur
  une table qui l'exige vraiment ;
- **dédoublonnage des fetches** entre deux widgets sur la même source — seulement si c'est un jour
  **mesuré** comme un problème, pas par principe.
