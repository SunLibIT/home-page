# Page d'accueil du CRM — Bloc in-page « vibe code » Softr ↔ Airtable

Bloc de la **page d'accueil** du CRM SunLib, rendu dans le bloc *vibe coding* de Softr
(iframe), connecté à Airtable. Calqué sur les gabarits `abo-detail-inpage` et
`partenaire-detail-inpage`.

> 📐 **[`ARCHITECTURE.md`](ARCHITECTURE.md)** — état des lieux détaillé : contraintes Softr,
> mécanique des widgets (couches + registre des types + descripteur de sources), modèle de
> layout, **persistance** (table Airtable `Home Preferences`) et limites connues.
> 🎯 **[`ARCHITECTURE-V2.md`](ARCHITECTURE-V2.md)** — la cible du système de widgets, son plan
> de migration et la **recette « j'ai une table, j'en veux un widget »** (~50 lignes, dont 35
> de pur JSON descriptif ; elle a servi 5 fois le 2026-08-04).

> **Livrable unique : `Block.tsx`.** On copie-colle **uniquement** le contenu de ce
> fichier dans le bloc vibe coding Softr. Le reste du repo (`src/`, `package.json`,
> configs) est un **scaffold Vite de dev** qui simule Softr en local — il n'est
> **jamais** livré, mais sert au dev et au déploiement autonome (un repo ne contenant
> que `Block.tsx` ne se build pas).

---

## 1. Structure

```
home-page/
├─ Block.tsx                 ← ★ LE LIVRABLE (à coller dans Softr)
├─ index.html                  scaffold Vite (dev)
├─ package.json / vite.config.ts / tsconfig.json
└─ src/                         environnement de DEV (jamais livré)
   ├─ main.tsx, index.css
   ├─ App.tsx                   barre de dev + rendu de Block
   ├─ dev/seed.ts               données fictives (pour tester USE_MOCK=false)
   ├─ lib/datasource.tsx        MOCK de l'API datasource Softr + store réactif
   ├─ lib/user.tsx              MOCK de useCurrentUser()
   └─ components/ui/card.tsx    MOCK du <Card> Softr
```

## 2. Lancer le dev

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc --noEmit + vite build : vérifie la compilation
```

## 3. Layout de la page

1. **Héro** — dégradé de marque `#13A3AC → #3CAE68` (seule exception validée), **animé en boucle
   lente** via la Web Animations API, « Bienvenue {prénom} ! », date du jour, 1 chip
   **« Notifications » sans compteur** (à implémenter), **sunburst SVG animé** à droite (le logo
   rond distant, reconstruit pour pouvoir l'animer rayon par rayon).
2. **PageNavBar** (sticky) — onglets **in-block** : Accueil (le tableau de bord) + **Outils**.
3. **Onglet Outils** — une grille de boutons ; un clic ouvre l'outil **in-page** (iframe, sous la
   grille qui reste visible), sauf **You Sign** qui part dans un nouvel onglet — app à login qui
   refuse l'iframing. Cinq apps Vercel publiques embarquées : Simulateur Grille, Calculette
   d'abonnement, Tik&Lib, Formulaire de contact, Bibliothèque.
4. **Raccourcis** (onglet Accueil) — tuiles vers les pages de l'espace en `target="_top"`. Cette
   section s'appelait « Outils » avant que les outils aient leur onglet.
5. **Tableau de bord** (onglet Accueil) — grille de widgets **indépendants, redimensionnables et
   déplaçables**, qui **se tasse** (un petit widget ne laisse plus de trou sous lui) :
   - **Nouveaux dossiers abonnés** — lit **`Notification Center` et cette table seule** (refonte
     du 2026-08-06 : avant, il lisait `Abonnés` et joignait l'état de lecture, et un preset de
     galerie affichait la même liste — deux widgets jumeaux). Avatar, texte de la notification,
     badge de statut, temps relatif, lien « Détail », pastille « Non lu » et bouton « Vu »,
     et un ⋮ Options pour choisir les informations affichées et le nombre de lignes.
     **C'est une FILE À TRAITER** : seules les notifications pas encore marquées « Vu » sont
     affichées, et cliquer « Vu » fait **disparaître la ligne immédiatement** (masquage local
     optimiste, annulé avec un message si l'écriture échoue — ce n'est donc pas l'ancien
     masquage sans écriture retiré le 2026-08-03). Quand la file est vide : « Tout est traité ».
     Décocher « File à traiter » dans ⋮ redonne l'historique complet.
     Quatre filtres **assumés en code** (`selectNotifs`, pure) : propriétaire **non vide**,
     propriétaire = **utilisateur connecté** (`cfg.mesDossiers`, actif par défaut),
     regroupement des **jumelles** (chaque événement crée 2 lignes), et **non traitées
     seulement**. En pied de liste, un
     **« Lire plus »** déroule le palier suivant (de `cfg.limite` lignes) sous les
     précédentes, dans le même corps scrollable — état local, jamais persisté.
     ⚠️ **Le rapprochement se fait sur le NOM, pas sur l'e-mail** : la table ne porte aucun
     e-mail, seulement des noms (`Ilan LEVY`, `Frédéric HUET`…). La règle exige **deux mots
     communs** dès que les deux côtés ont prénom + nom, pour qu'un homonyme de prénom ne voie
     pas les dossiers de l'autre (« Frédéric Martin » ≠ « Frédéric HUET »). Voir `ownerIsUser`.
     Décocher « Seulement les dossiers dont je suis propriétaire » dans ⋮ ouvre la liste.
   - **Journal des tâches** — onglets denses Prospects | Partenaires (pastilles compteur), badge
     d'échéance par seuil (vert > 14 j, ambre 3–14 j, rouge < 3 j), case **« Fait » qui écrit en base**.
   - **Dernières notes — Installateurs** et **— Prospects** (widgets `data` génériques).
   - **⋮ Réglages du widget** (2026-08-06) — une **modale** en deux colonnes (*Apparence* :
     titre, couleur ; *Contenu* : les réglages du type), et non plus un panneau de 292 px.
     Elle porte aussi le **retrait du widget** (confirmation en deux temps) et son
     **encombrement** (largeur moitié / pleine, hauteur petit / moyen / grand) : plus besoin
     d'entrer dans « Personnaliser » pour redimensionner ou supprimer une carte. Les
     **poignées de bord** font la même chose à la souris et sont désormais actives **dans les
     deux modes** — discrètes au repos, révélées au survol de la carte, et déportées dans la
     gouttière hors édition pour ne pas voler les clics des lignes ni recouvrir la barre de
     défilement. Le geste s'écrit **une seule fois, au relâchement** (pas à chaque cran). ⚠️ Hors mode Personnaliser,
     ce retrait est **écrit immédiatement** (pas de brouillon), d'où la confirmation et le
     toast. Le **choix de la vue** (liste / tableau / indicateur) a été **retiré** : la forme
     est décidée à la pose par le modèle de la galerie et ne change plus — un indicateur
     reste un indicateur. Pour une autre forme, on pose un autre widget.
   - **Barre d'outils de consultation** (2026-08-06), dans tous les widgets liste et tableau :
     **recherche** plein-texte (mot par mot, sans accents, sur les champs déclarés),
     **filtre à cases en multi-sélection** sur un champ (`cfg.facet` — par défaut
     l'installateur pour les notes et les dossiers, le partenaire / prospect pour les tâches,
     l'installateur initial pour le SAV ; les valeurs sont déduites des données, triées par
     fréquence, avec leur compte), et **tri** : par clic sur l'en-tête de colonne en vue
     tableau (recliquer inverse le sens, tri **typé** par la nature du champ), par un bouton
     « Trier » en vue liste, qui n'a pas d'en-têtes. Les trois s'appliquent **avant la limite
     de lignes**, donc sur toute la table lue. Rien n'est persisté : recharger remet à plat
     (un filtre « collant » donnerait un widget vide sans raison visible). Réglable dans ⋮ →
     *Consultation*.
   - **Clic sur une ligne → fiche détaillée** (2026-08-06). Dans **tous** les widgets liste et
     tableau, ainsi que dans « Nouveaux dossiers abonnés », cliquer une ligne ouvre une pop-up
     qui affiche **tous les champs déclarés par le descripteur de la source** — pas seulement
     les trois que la ligne montrait. Générique : ajouter un alias au catalogue l'ajoute à la
     fiche. Accessible au clavier (Entrée / Espace, Échap pour fermer) ; les boutons d'action
     de la ligne n'ouvrent pas la fiche. Pour les dossiers abonné, un bouton « Ouvrir la fiche
     complète » mène à la page de l'espace (`target="_top"`).
     Au passage, `SELECT_ABONNE` a été **élargi de 10 champs** (référence, statut abonné, CAPEX,
     abonnement, kWc, état facture 2, dates de signature et d'édition, contrats signé / en
     attente) — tous déjà lus par `SELECT_COM` sur la même datasource, donc leur exposition est
     prouvée. Ils servent aussi de colonnes et de filtres aux widgets génériques.
   - **Pilotage SAV — synthèse** — les valeurs cochées dans son ⋮, en **tuiles** (grande valeur,
     détail dessous, barre pour les proportions) ou en **lignes** denses.
   - **Indicateurs commerciaux** — rangée de tuiles : contrats signés, annulés (+ taux), CAPEX
     signé HT et kWc, installateurs actifs, et le pipeline **« à signer (30 j) »** avec son CAPEX
     restant. Période réglable, sauf le pipeline qui reste sur sa fenêtre glissante.
   - **Podium CAPEX HT** — les trois premiers commerciaux, marches 2·1·3, période réglable
     (mois / année / tout).
   - **Classement des commerciaux** — le tableau du bloc KPI : rang, avatar et abonnement moyen,
     CAPEX HT avec barre, tendance, signés, annulés, taux de pose, délai de signature, courbe sur
     12 mois, installateurs. **Les en-têtes trient d'un clic**, et le tri est persisté.
     À poser en **pleine largeur** : dix colonnes ne tiennent pas dans une demi-colonne.
   - **Exceptions** — les 8 tuiles de volume et de **couverture du parc** (dossiers et
     installateurs concernés, intensité par dossier), et le **Registre des exceptions** ligne par
     ligne. *Leurs trois tables sont connectées depuis le 2026-08-05, dénominateur inclus.*
   - **Embeds Elfsight** (à la une, annonces) et les **utilitaires sans source** : Heure,
     Pense-bête, Liste à cocher.

   ⚠️ Les widgets qui **agrègent** lisent leur source **page par page**, contrairement à ceux qui
   montrent « les N plus récents » : les trois widgets de **Performance** (≈1 771 dossiers), les
   deux d'**Exceptions** avec leurs dénominateurs, et **Pilotage SAV**. Posés, ils coûtent cette
   lecture ; absents de la grille, ils ne coûtent **rien** — seules les instances affichées montent
   leur adapter. Si la lecture ne va pas au bout, ils affichent **« Calcul partiel »** plutôt qu'un
   chiffre faux.

   > 🐛 **Corrigé le 2026-08-05 — Pilotage SAV comptait faux.** Le widget ne lisait qu'une page :
   > ses compteurs portaient sur la fenêtre lue, pas sur la table. Il annonçait **6 dossiers
   > ouverts** contre **18** dans le bloc « Pilotage SAV ». Le tri `debut` desc aggravait le biais —
   > en gardant les dossiers récents il écartait les plus anciens, donc l'alerte **« ouverts > 60 j »
   > ne pouvait structurellement pas s'allumer** (elle ne s'affiche que si son compte est > 0, et
   > restait donc muette en paraissant saine).

   Chaque widget se règle par son ⋮, et **tous sont renommables et colorables** : champ « Titre du
   widget » puis une palette de 8 teintes qui colorent **toute la carte** — les 3 couleurs SunLib
   (teal, vert, ambre) et 4 pastels, plus « Aucune ». Vider le titre rend celui d'origine ;
   « Aucune » rend la carte blanche. *(Ni rouge ni orange vif dans la palette : ce sont les couleurs d'alerte de la charte, et
   les banaliser en décor les affaiblirait là où elles comptent.)*

   **Ajouter un widget** se fait depuis une **galerie en feuille modale**, ouvrable dans les deux
   modes : recherche, filtres par famille, et une **miniature** par modèle qui montre sa forme avant
   de le poser. « Personnaliser » reste pour réorganiser, redimensionner et supprimer. Toute la
   disposition — titres et couleurs compris — est **persistée par utilisateur**.

## 4. Branchement Airtable — état au 2026-08-05

**`USE_MOCK = false` : le bloc lit Airtable en direct.** **Toutes** les sources du catalogue sont
connectées : `CATALOG` ne porte plus aucun `connected: false`.

### A — Datasources & champs (`Block.tsx` §6) ✅
`datasource.define` unique, IDs en **littéraux**. Les noms de champs ont été **revérifiés
contre le schéma Airtable le 2026-08-04**, avant l'ouverture de la lecture en direct.

| Alias (`DS.`) | Table Airtable (base)                       | Datasource ID | Champs (alias → nom Airtable exact) |
| ------------- | ------------------------------------------- | ------------- | ----------------------------------- |
| `abonnes`  | « Abonnés » (BDD Abonné)                        | ✅ `8fc957d0-…` | nom `Nom` · prenom `Prenom` · partenaire `Nom de l'entreprise (from Installateur )` · statut `Statut Dossiers` · offre `Type d installation` · creeLe `date de création` |
| `notesIns` | « Suivi client » (Bdd Installateurs)           | ✅ `122fbc71-…` | nom `Installateur` · note `Notes` · date `Date ` *(espace final)* |
| `notesPro` | « Suivi propect » (BDD Propect)                | ✅ `dbd7e501-…` | nom `Nom` · note `Notes` · date `date ` *(espace final, createdTime)* |
| `tachesPa` | « Taches » (Bdd Installateurs)                 | ✅ `7198b954-…` | desc `Description` · associe `Partenaire associé` · fin `date de fin` · fait `Fait` |
| `tachesPr` | « Taches prospect »                            | ✅ `9414183e-…` | desc `Description` · associe `Prospect associé` · fin `Date de fin` · fait `Fait` |
| `sav`      | « Tickets » (SAV) — *lecture seule*            | ✅ `3f5f8f6c-…` | 22 alias : ticket, client, installateur, dates, 12 catégories, fabricant, priorité, statut, tiers, coût |
| `comKpi`   | « Abonnés » **relue** — *lecture seule, paginée* | ✅ (même `8fc957d0-…`) | commercial `Propio SOFTR` · capex `Prix Installation HT total` · contratSigne `Contrat abonnement signe` *(pièce jointe)* · statutAbonne `Statut de l'abonné` · moisSignature `Mois de signature contrat` · aboMoyen `Prix En nombre` · etatFacture2 `Etat facture 2` · dateSignature `Date signature contrat` · dateCreation `date de création` · installateur `Nom de l'entreprise (from Installateur)` |
| `parcAbo`  | « Abonnés » **relue en 1 champ**, paginée       | ✅ (même `8fc957d0-…`) | ref `Contrat abonné` — dénominateur « % du parc » |
| `notifC`   | « Notification Center » (BDD Abonné) — *écrivable*, **seule source du widget « Nouveaux dossiers abonnés »** | ✅ `fecd4e37-…` | liens `Liens BDD` · aLire `Statut de lecture` · etat `Statut de la notification` · creeLe `Created Date` · **⚠️ à exposer dans Softr** : texte `Notification` · nom `Nom (from Liens BDD)` · partenaire `Installateur (from Liens BDD)` · statut `Statut Dossiers (from Liens BDD)` · proprio `Proprietaire (from Installateur ) (from Liens BDD)` |
| `excAbo`   | « Projet solaire » (Exception)                  | ✅ `b8340293-…` | exceptions **abonné** : dossier `SL- Dossier` · description · categorie · sousCategorie · service `Tag` · valideur · justificatif · installateur `BDD Installateur` · creeLe |
| `excPart`  | « Partenaire » (Exception)                      | ✅ `9cf1e459-…` | exceptions **partenaire** : nom `Name` + les mêmes champs, plus statut `Statut` |
| `parcPart` | « BDD Installateur » (Exception)                | ✅ `e82df933-…` | nom `Nom de l'entreprise` — dénominateur « % du parc partenaires » |

> ⚠️ **Les datasources `Installateurs` et `Propects` (tables principales) ne sont utilisées par
> AUCUN widget** : les notes/tâches vivent dans les tables enfants ci-dessus.
> ⚠️ **`abonnes` et `comKpi` sont DEUX lectures de la même table**, sur la même datasource : une
> source du catalogue n'est pas une datasource. `abonnes` lit large sur les 12 derniers dossiers,
> `comKpi` lit 10 champs sur **tout le parc** pour le podium et le classement. Les fusionner ferait
> payer au widget « Derniers dossiers » le prix d'un parc entier, ou aux deux autres l'inexactitude
> d'un échantillon.
> ⚠️ **Deux lookups d'installateur cohabitent dans « Abonnés »**, et les confondre casse la lecture :
> `Nom de l'entreprise (from Installateur )` **avec** espace avant la parenthèse (`abonnes`) et
> `Nom de l'entreprise (from Installateur)` **sans** espace (`comKpi`).
> ⚠️ **Un id de datasource appartient à UNE connexion d'UN bloc**, pas à une table : « Notification
> Center » est déjà lue par deux blocs de page, il faut néanmoins la connecter à **celui-ci**
> (onglet *Sources*), puis relever son id (onglet *Chat*).
> ⚠️ **Les champs exposés sont choisis à la connexion** : la datasource de « Taches » n'en expose
> que 3 sur 12 à ses blocs de page. Si l'éditeur signale « you have a field in your source code X
> which is not present in your datasource » au collage, il faut **remapper la source**.

Détails du choix :
- **Nouveaux dossiers abonnés** = table `Notification Center`, par `Created Date`. L'état lu /
  non lu est porté par la ligne affichée (plus de jointure, donc plus d'« état incomplet »).
  ⚠️ **Point de données à trancher** : sur les 400 notifications les plus récentes, les
  propriétaires sont `Ilan LEVY` (91), `Julien RAMON` (80), `Philippe GERY` (53),
  `Frédéric HUET` (37), `Edouard Da Silva` (36), `Guillaume Niggli` (6), `Fabrice MORVAN` (4),
  `Alexandre DUGOIS` (4) — et 89 lignes sans propriétaire. Un utilisateur absent de cette
  liste voit donc un widget **vide**, avec un état vide explicite qui nomme l'identité
  cherchée et propose d'ouvrir la liste. La vraie correction est côté base : un champ
  **e-mail** sur le propriétaire rendrait le rapprochement exact.
  ⚠️ **Reste à faire côté Softr** : la datasource `notifC` doit exposer 5 champs de plus —
  `Notification`, `Nom (from Liens BDD)`, `Installateur (from Liens BDD)`,
  `Statut Dossiers (from Liens BDD)`, `Proprietaire (from Installateur ) (from Liens BDD)`.
  Sans eux, le bloc échoue au chargement (« does not match / Remap the fields »).
- **Tâches** : seules celles non cochées `Fait` sont affichées, et **cocher « Fait » écrit
  réellement en base** — c'est la première écriture métier du bloc.
- **SAV** : lecture seule. Un dossier se saisit dans le bloc « Pilotage SAV », qui porte les
  validations de cohérence. « Total interventions » est un champ **formule**, volontairement hors
  select : le déclarer ferait échouer l'écriture du record entier.
- **Pas de création de note ni de tâche depuis l'accueil** : le rattachement passe par un champ
  **lien** Airtable, qui attend un record id et non un nom — une ligne créée d'ici n'apparaîtrait
  sur la fiche de personne.
- **Performance commerciale** (podium + classement) : critères **recopiés** de l'onglet Commercial
  du bloc `dashboard-KPI`, pour que les deux écrans donnent le **même** classement — portefeuille =
  contrat signé **joint** (une pièce jointe, pas un statut), annulés exclus des contrats et du
  CAPEX, « Non assigné » exclu du classement (ce n'est pas une personne, il finirait premier).
  ⚠️ La colonne **« Installs. » compte des installateurs distincts, pas des installations** : le
  libellé vient du bloc KPI et il est trompeur.

### B — URLs (`Block.tsx` §0-bis) ✅
Tout est dans le registre `PAGES` / `TOOLS` — voir la section **E** ci-dessous. Aucune URL n'est
écrite ailleurs, et une adresse qui change se change là, une fois.

### C — Embed LinkedIn ✅ intégré
Widget **Elfsight** (bannière SunLib) `elfsight-app-488a28ed-…` intégré tel quel dans
`LinkedInSection` : le `<div>` cible est rendu sans restyle et `platform.js` est chargé
une fois via `useEffect` (un `<script>` en JSX ne s'exécute pas). Rien à faire, sinon
vérifier que `elfsightcdn.com` est autorisé par la CSP de l'iframe Softr.

> ⛔ **Le Fil LinkedIn ne monte pas dans le bloc, y compris sur le domaine publié (2026-08-05).**
> Diagnostic en cours. Ce qui est **éliminé**, et par quelle observation :
>
> | Suspect | Écarté par |
> | --- | --- |
> | CSP, bloqueur de contenu | le runtime **se charge** (`onload` appelé) — l'état du loader le dit |
> | Domaine, compte Elfsight | le même runtime sert un autre widget depuis un bloc « Custom Code » sur ce domaine |
> | URL du runtime | le bloc chargeait `elfsightcdn.com/platform.js`, aligné depuis sur le `static.elfsight.com/platform/platform.js` du snippet vérifié |
> | `data-elfsight-app-lazy` manquant | attribut **remis**, pour ne plus différer du snippet vérifié |
>
> ⚠️ La CSP `script-src 'self' 'unsafe-inline'` relevée en aperçu était un **faux indice** : l'erreur
> nommait le beacon Cloudflare de Softr, pas Elfsight. Elle reste vraie, mais n'explique pas ce
> symptôme.
>
> **Deux pistes restantes, et un test qui les sépare.** Le snippet « Custom Code » qui fonctionne
> porte l'id de la **Barre d'annonces** (`8f372b94-…`), alors que le widget en échec est le **Fil
> LinkedIn** (`2df6db63-…`) : deux variables changent à la fois, le contexte d'exécution ET
> l'identifiant. Pour n'en garder qu'une, **poser le widget « Barre d'annonces » dans la grille** (il
> est dans la galerie, avec ce même id) :
> - il **monte** ⇒ le contexte iframe/React est sain, et c'est l'id du Fil LinkedIn qui est en cause
>   (widget supprimé ou désactivé côté Elfsight) ;
> - il **ne monte pas** ⇒ le runtime ne voit pas un conteneur rendu par React dans l'iframe du bloc,
>   et le sujet devient l'intégration elle-même.
>
> Les widgets **fonctionnent sous `npm run dev`** : le code et les ids y sont donc corrects, mais le
> local ne teste ni la CSP ni le contexte iframe.

### D — « Marquer comme vu » ✅ branché le 2026-08-05
Le masquage local a été retiré (il ne survivait pas au rechargement, donc il faisait croire
qu'on avait traité quelque chose). L'état vit dans **`Notification Center`**. C'est la **seule
source écrivable** du bloc hors notes et tâches, et sa whitelist n'ouvre que `Statut de lecture`.

> **2026-08-06 — plus de jointure.** Le widget lit désormais cette table **seule** : l'état de
> lecture est porté par la ligne affichée, il ne peut donc plus manquer (l'avertissement « état
> incomplet » a disparu avec la jointure, `matchNotifC` a été supprimé).

⚠️ Particularités de cette table, **subies et non corrigées** (d'autres écrans consomment ses
formules) :
- **La case est inversée** : `Statut de lecture` **cochée** = « non lue ». D'où l'alias `aLire`,
  et une écriture de `false` pour marquer comme vu. Les deux formules d'état de la table sont
  inversées elles aussi (`IF({Statut de lecture}, "Non lue", "Lue")`) — vérifié par l'API le
  2026-08-05 : **1354 lignes cochées affichent « Non lue »**. Le jour où la base est corrigée,
  **inverser aussi le bloc**, sinon le widget dira l'exact contraire de la vérité.
- **385 lignes sur 2142 n'ont aucun lien vers un abonné** (relevé le 2026-08-05), donc tous leurs
  lookups sont vides, texte compris (« Nouveau abonné créé pour :  »). Le **filtre propriétaire
  non vide** les écarte, et le widget dit combien il en a écarté.
- **Chaque événement crée DEUX lignes** (une « Lue », une « Non lue ») : le widget les **regroupe**
  par dossier + texte et garde celle encore « à lire » — celle sur laquelle « Vu » agit.
- **L'état est global, pas par utilisateur** (aucun champ destinataire) : cocher vaut pour tout
  le monde — à dire aux utilisateurs.
- **La table est drainée** (pagination vidée) : le filtre et le regroupement doivent porter sur
  tout, sinon une page presque entièrement écartée donnerait un widget vide.
  ⚠️ L'avertissement « Lecture incomplète » a été **retiré le 2026-08-06** (demandé). Sans
  risque tant que la table reste sous le plafond de drainage `COM_MAX_PAGES` (≈ 4 000 lignes
  pour 2 154 aujourd'hui) : au-delà, la liste deviendrait silencieusement partielle et c'est
  **le plafond** qu'il faudrait relever.

### E — Les adresses : un seul endroit (`Block.tsx` §0-bis)

Toutes les cibles de navigation vivent dans **`PAGES`** (pages de l'espace) et **`TOOLS`** (outils
externes), juste après `USE_MOCK`. Aucune URL n'est écrite ailleurs : les tuiles et les widgets ne
portent que des références. **Une adresse qui change se change là, une fois.**

Ce sont des **slugs**, pas des URLs : `pageUrl()` y ajoute l'origine de la page **parente**, lue à
l'exécution — c'est ce qui fait marcher les mêmes liens **en aperçu et en production**.

**Les 8 pages de l'espace sont renseignées** (2026-08-04) :

| Clé (métier) | Slug de l'espace | |
| --- | --- | --- |
| `abonne` | `abonn-s-details-3` | fiche d'un abonné (attend un `recordId`) |
| `installateur` | `installateurs-details` | fiche d'un installateur (déclarée, pas encore utilisée) |
| `abonnes` | `abonn-s` | liste des abonnés |
| `partenaires` | `clients-list` | ⚠️ le slug ne suit pas le vocabulaire du CRM |
| `prospects` | `tous-les-prospects` | ⚠️ idem |
| `contactPartenaire` | `contact-partenaire` | |
| `sav` | `sav` | Pilotage SAV |
| `kpi` | `dashboard-kpi` | Tableau de bord KPI |

C'est précisément l'intérêt du registre : **le code parle métier** (`PAGES.partenaires`) là où
l'espace garde ses adresses historiques (`/clients-list`).

**✅ Plus aucune adresse manquante.** Outils externes : You Sign (`yousign.app`), Calculette
d'abonnement (`sunlib-simulation-economique.vercel.app`), Tik&Lib (`ticketing2-six.vercel.app`).
« Services Sellsy » a été **retiré** des Outils le 2026-08-04.

Le mécanisme de repli reste en place pour la suite : une entrée vide est un **choix explicite**, la
tuile s'affiche alors **désactivée** (mention « bientôt ») au lieu de promettre un clic qui ne mène
nulle part.

⚠️ **Ne jamais coller dans ce registre une URL copiée depuis une barre d'adresse en cours de
session.** Celle de You Sign avait été fournie sous la forme d'une page de connexion Auth0 portant
un jeton (`auth.yousign.app/u/login/identifier?state=…`) : ces paramètres expirent, et le lien
aurait mené à une erreur d'authentification. C'est la **racine** de l'app qui est enregistrée —
elle redirige d'elle-même vers le login, et ne périme pas.

**Trois cibles, trois comportements** — et c'est le type de l'entrée qui décide, jamais le
composant : une entrée de `PAGES` ouvre en **`_top`** (page de l'espace, on quitte l'accueil), une
entrée de `TOOLS` utilisée comme `url` ouvre dans un **nouvel onglet** (`_blank` + `noopener`), et
une entrée de `TOOLS` utilisée comme `embed` s'affiche **dans la page** (onglet à iframe). On ne
navigue jamais **dans** l'iframe du bloc : le CRM autour disparaîtrait.

⚠️ **À confirmer** : le nom du paramètre des pages de détail (`PAGE_RECORD_PARAM = "recordId"`, la
convention Softr la plus courante) — ouvrir une fiche depuis l'app et lire son URL.

### F — Reste à faire
- **Vérifier à l'écran**, sur la page publiée et connecté, ce qui ne se manifeste qu'à la souris
  et en session : cocher « Fait », glisser un widget par son en-tête, régler une poignée.
- **Vérifier la pagination des deux widgets de Performance** : ils lisent le parc page par page, et
  l'aperçu local ne peut pas le révéler (le mock rend tout d'un coup). Si « Calcul partiel »
  s'affiche alors que le parc fait moins de 4 000 dossiers, la taille de page est plus petite que
  prévu et il faut relever `COM_MAX_PAGES`.

## 5. Règles Softr respectées

- `from` sur chaque hook data ; **un seul** `datasource.define`, IDs littéraux inline.
- `q.select({...})` littéral ; filtres/tri par **alias**.
- Update **enveloppé** `mutate({ recordId, fields })` ; lecture paginée `data.pages.flatMap(p => p.items)`.
- Iframe : `useCurrentUser()` (jamais `window.logged_in_user`) ; navigation inter-pages en `<a target="_top">`.
- `useCurrentUser()` renvoie `{ id, email, name }` — **pas** `firstName` : le prénom du héro est dérivé de `name`, avec repli sur l'e-mail si `name` est vide (fréquent en prod).
- Aucune dépendance externe, aucune Google Font (`Plus Jakarta Sans` en fallback `system-ui`).
- Accessibilité charte : focus visible teal, `prefers-reduced-motion`, statuts en badge couleur **+** icône, dates relatives avec date absolue en `title`, états vides guidants.
