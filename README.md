# Page d'accueil du CRM — Bloc in-page « vibe code » Softr ↔ Airtable

Bloc de la **page d'accueil** du CRM SunLib, rendu dans le bloc *vibe coding* de Softr
(iframe), connecté à Airtable. Calqué sur les gabarits `abo-detail-inpage` et
`partenaire-detail-inpage`.

> 📐 **[`ARCHITECTURE.md`](ARCHITECTURE.md)** — état des lieux détaillé : contraintes Softr,
> mécanique des widgets (couches + registre des types + descripteur de sources), modèle de
> layout, **persistance** (table Airtable `Home Preferences`) et limites connues.
> 🎯 **La recette « j'ai une table, j'en veux un widget »** (~50 lignes, dont 35 de pur JSON
> descriptif ; elle a servi 5 fois le 2026-08-04) vit au **§8.4 d'[`ARCHITECTURE.md`](ARCHITECTURE.md)**,
> avec le principe directeur et les pistes restées ouvertes. *`ARCHITECTURE-V2.md` a été absorbé
> dans ce document le 2026-08-20 : sa migration étant terminée, son plan par phases n'avait plus
> d'objet.*

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
   *Un chip « Rafraîchir » global y a vécu quelques heures le 2026-08-18 : il relisait les dix
   sources d'un coup. Le geste est passé sur **chaque carte qui lit la base** (voir §5).*
2. **PageNavBar** (sticky) — onglets **in-block** : Accueil (le tableau de bord) + **Outils**.
3. **Onglet Outils** — une grille de boutons ; un clic ouvre l'outil **in-page** (iframe, sous la
   grille qui reste visible). Cinq apps Vercel publiques embarquées : Calculette d'abonnement,
   **Map** (carte des installateurs), **ERP**, Formulaire de contact, Bibliothèque.
   **You Sign et Tik&Lib ont été retirés le 2026-08-18**, adresses comprises ; **Simulateur
   Grille** est **masqué** (`hidden`) — l'entrée et son adresse restent au registre, seul
   l'affichage est suspendu. Le départ en **nouvel onglet** (`url`) n'est plus utilisé par
   aucune entrée mais reste supporté : une app à login refuse l'iframing et n'aurait qu'un
   cadre blanc, elle devra passer par là.

   ### Une seule barre de défilement — le protocole de hauteur (2026-08-18)

   Un outil ouvert affichait **deux barres imbriquées** : la sienne et celle de la page. La
   cause n'est pas un réglage à trouver — l'iframe est **cross-origin**, donc le bloc ne peut
   ni mesurer la hauteur du document distant ni styliser sa barre. Le cadre était simplement
   plus court que le contenu.

   La seule façon exacte de le dimensionner : que **l'app annonce sa hauteur**. Le bloc écoute
   déjà (`useEmbedHeight`, `Block.tsx`) ; il ne reste qu'à coller ceci **dans chaque app
   embarquée** (avant `</body>`, ou dans un `useEffect` de son composant racine) :

   ```html
   <script>
   /* Annonce la hauteur du document au bloc SunLib qui embarque cette page, pour qu'il
      supprime sa barre de défilement. Sans effet hors iframe. */
   (function () {
     if (window.parent === window) return;
     var envoyer = function () {
       var d = document.documentElement, b = document.body;
       var h = Math.max(d.scrollHeight, d.offsetHeight, b ? b.scrollHeight : 0, b ? b.offsetHeight : 0);
       window.parent.postMessage({ type: "sunlib:embed-height", height: h }, "*");
     };
     if (window.ResizeObserver) new ResizeObserver(envoyer).observe(document.documentElement);
     window.addEventListener("load", envoyer);
     setInterval(envoyer, 1000);   // filet : contenu qui grandit sans redimensionner le document
     envoyer();
   })();
   </script>
   ```

   Ce qu'il faut savoir avant de le poser :

   - **App par app, sans coordination.** Une app qui n'envoie rien garde exactement le cadre
     qu'elle avait (`min(1200px, 82vh)`) : aucune régression sur celles qu'on n'a pas touchées.
   - **`"*"` en destination est volontaire** : l'app ne connaît pas l'origine Softr, qui varie.
     Le contrôle de sécurité est **côté bloc**, qui n'accepte un message que s'il vient de
     l'origine de l'outil affiché — une hauteur n'est pas une donnée sensible, mais un cadre
     redimensionnable par n'importe qui en serait une.
   - **Le cadre passe alors en `scrolling="no"`**, et seulement alors : sur une hauteur devinée,
     l'attribut rendrait le bas du contenu inatteignable.
   - **Si l'app se dimensionne en `100vh`**, elle annoncera la hauteur de son propre cadre : la
     hauteur sera stable mais pas plus juste qu'avant. Il faut alors que sa racine se dimensionne
     sur son **contenu**, pas sur la fenêtre.
   - **À vérifier en recette** : le bloc vit lui-même dans une iframe Softr. Un outil de 3 000 px
     rend le bloc très haut — si Softr ne suit pas la hauteur de son bloc, la barre réapparaîtra
     un cran plus haut. C'est le seul point que l'aperçu local ne peut pas révéler.
4. **Raccourcis** (onglet Accueil) — tuiles vers les pages de l'espace en `target="_top"`. Cette
   section s'appelait « Outils » avant que les outils aient leur onglet. **Contact Partenaire est
   masqué depuis le 2026-08-18** (même convention `hidden` : le slug reste au registre).
5. **Tableau de bord** (onglet Accueil) — grille de widgets **indépendants, redimensionnables et
   déplaçables**, qui **se tasse** (un petit widget ne laisse plus de trou sous lui).
   **Un tableau VIERGE à la première visite (choix du 2026-08-24)** : `DEFAULT_INSTANCES` est
   vide, personne n'hérite plus des sept widgets posés d'office. Un nouvel arrivant ouvre la
   page sur l'**état vide**, qui nomme ce qu'il peut poser et désigne le bouton
   « + Ajouter un widget ». Les dispositions **déjà enregistrées ne bougent pas**. Le motif et
   la vérification à refaire avant de retirer une entrée sont au **§10-bis
   d'[`ARCHITECTURE.md`](ARCHITECTURE.md)** (« L'écran d'accueil d'un nouvel arrivant »).
   **Hauteur en PIXELS, rabattue sur le contenu (2026-08-07)** : la hauteur d'un widget est
   un nombre (120 à 1600 px, arrondi au pas de 4 px de la grille) et non plus un cran parmi
   quatre — les anciennes clés `sm` / `md` / `lg` / `xl` sont traduites à la lecture
   (168 / 340 / 560 / 860), donc aucune disposition enregistrée ne change d'apparence. Le
   corps est ramené à la **dernière frontière d'élément qui tient dans la hauteur demandée** —
   une ligne de liste, une rangée de tuiles. Une hauteur ne coupe donc plus une tuile en deux
   (symptôme observé sur « Pilotage SAV » en petit). Au moins un élément est toujours
   montré, même s'il dépasse le cran ; un widget sans élément répétitif (pense-bête, embed)
   garde son cran au pixel. Les unités sont **déclarées** (`.slb-row`, `.slb-unit`), jamais
   devinées :
   - **Nouveaux dossiers abonnés** — lit **`Notification Center` et cette table seule** (refonte
     du 2026-08-06 : avant, il lisait `Abonnés` et joignait l'état de lecture, et un preset de
     galerie affichait la même liste — deux widgets jumeaux). Avatar, texte de la notification,
     badge de statut, temps relatif, lien « Détail », pastille « Non lu » et bouton « Vu »,
     et un ⋮ Options pour choisir les informations affichées, le nombre de lignes et le
     **périmètre de clientèle** (2026-08-20 : tous · Pro · Particuliers · Solo · Duo). Le type de
     client est aussi **affichable en pastille** sur chaque ligne, à côté du statut.
     **C'est une FILE À TRAITER** : seules les notifications pas encore marquées « Vu » sont
     affichées, et cliquer « Vu » fait **disparaître la ligne immédiatement** (masquage local
     optimiste, annulé avec un message si l'écriture échoue — ce n'est donc pas l'ancien
     masquage sans écriture retiré le 2026-08-03). Quand la file est vide : « Tout est traité ».
     Décocher « File à traiter » dans ⋮ redonne l'historique complet.
     Cinq filtres **assumés en code** (`selectNotifs`, pure) : propriétaire **non vide**,
     propriétaire = **utilisateur connecté** (`cfg.mesDossiers`, actif par défaut), **périmètre de
     clientèle** (`cfg.clientele`, à « tous » par défaut), regroupement des **jumelles** (chaque
     événement crée 2 lignes), et **non traitées seulement**. Quand c'est la clientèle qui a tout
     écarté, l'état vide le **dit** et propose de la rouvrir — au lieu d'annoncer « tout est traité »
     sur une file qui contient encore des particuliers. En pied de liste, un
     **« Voir 10 de plus · N restantes »** (2026-08-07) déroule le palier suivant sous les
     précédentes, dans le même corps scrollable — état local, jamais persisté. Le libellé
     dit **combien arrive** et **combien reste** ; quand le reste tient dans un palier, il
     annonce le dernier (« Voir les 3 dernières »), ce qui permet de savoir qu'on a fait le
     tour de sa file. Palier = **10**, ou le réglage « Nombre de lignes » du ⋮ s'il est plus
     court. ⚠️ Rien n'est « téléchargé » au clic : la table est déjà lue en entier
     (drainage), le bouton lève seulement la troncature d'affichage — donc aucune attente,
     et pas de trou possible entre deux paliers.
     ⚠️ **Le rapprochement se fait sur le NOM, pas sur l'e-mail** : la table ne porte aucun
     e-mail, seulement des noms (`Ilan LEVY`, `Frédéric HUET`…). La règle exige **deux mots
     communs** dès que les deux côtés ont prénom + nom, pour qu'un homonyme de prénom ne voie
     pas les dossiers de l'autre (« Frédéric Martin » ≠ « Frédéric HUET »). Voir `ownerIsUser`.
     Décocher « Seulement les dossiers dont je suis propriétaire » dans ⋮ ouvre la liste.
   - **Journal des tâches** — onglets denses Prospects | Partenaires (pastilles compteur), badge
     d'échéance par seuil (vert > 14 j, ambre 3–14 j, rouge < 3 j). **Deux filtres (2026-08-07)** :
     `Fait` décoché **et** `Assignee` = personne connectée (sauté, et annoncé, si la session
     n'est pas identifiable). Chaque ligne porte un bouton **« Marquer comme faite »** qui
     écrit en base : la ligne part aussitôt, revient avec un message si l'écriture échoue,
     et les pastilles suivent. **⚠️ Plus de bouton « + » dans l'en-tête (retiré le
     2026-08-18)** : il portait un TODO et n'ouvrait rien. Quand la création de tâche sera
     branchée, elle passera par `create` sur le descripteur de source — le `+` de
     `QuickCreate` et son formulaire apparaissent alors seuls, comme sur « Dossiers SAV ».
   - **Dernières notes — Installateurs** et **— Prospects** (widgets `data` génériques) —
     filtrées sur **leur propriétaire SunLib** depuis le 2026-08-07 (§4, ⚠️ deux prérequis
     Softr).
   - **Contact partenaire** *(2026-08-19)* — l'**annuaire des contacts par installateur**, calqué
     sur la page Softr du même nom : recherche plein-texte, **trois filtres à cases** —
     entreprise · service · type de contact SunLib, les mêmes que la page — six colonnes
     (contact · entreprise · mail · téléphone · service · type de contact), mail et téléphone
     **cliquables** (`mailto:` / `tel:`), multi-sélections rendues en **une pastille par
     valeur**, et un pied **« Ouvrir la page Contact partenaire »** qui renvoie en
     `target="_top"` vers `/contact-partenaire` (libellé raccourci le 2026-08-19 : « Ouvrir
     Contact partenaire » — dans un pied de carte, « la page » ne dit rien de plus). **Un seul modèle** dans la galerie (groupe **Partenaires**), en
     tableau pleine largeur — demandé tel quel le 2026-08-19 ; une variante en liste a existé
     quelques minutes avant d'être retirée. Sept colonnes Softr deviennent six : `contact`
     fusionne Prénom et Nom (champ **calculé** du descripteur), le moteur en autorisant six au
     maximum.
     ⚠️ **Source connectée le 2026-08-19** (`acc8398e-…`). Il reste **un geste côté Softr** avant
     de recoller le bloc : cocher les **10 champs** de la connexion `contactsIns` dans l'onglet
     *Sources* (§4-A). Tant qu'ils ne le sont pas, ce n'est pas ce widget qui manque — c'est le
     bloc entier qui refuse de charger.
     ⚠️ La table fait **1 266 lignes** là où Softr en rend ~25 par page : la source déclare donc
     `drain: true` (§6-bis). Sans lui, la recherche n'aurait fouillé que **2 %** de l'annuaire en
     répondant « aucun contact » comme s'il n'y en avait pas — le mensonge silencieux d'un total
     partiel, transposé à la recherche. Le prix est d'environ **51 requêtes en série** au premier
     chargement, effacées ensuite par le cache d'instantanés (§6-ter).
     ⚠️ **Pas de filtre « mes fiches »**, à l'inverse des notes : un annuaire se consulte en
     entier — on y cherche justement le contact d'un installateur qu'on ne suit pas. Le
     propriétaire est **lu** et affiché ; pour qu'il filtre, il suffira de déclarer
     `ownerField: "proprio"`.
   - **Indicateur de chargement** *(2026-08-19, demandé)* — une **barre fine** traverse le bas de
     l'en-tête tant que la source du widget lit, et le sous-titre la nomme : « **· lecture en
     cours** » pendant le drainage, « **· lecture tronquée** » si la lecture s'est arrêtée au
     plafond de pages. Posée une seule fois, dans `Widget`, sous condition du contexte
     `SourceRefreshCtx` : elle apparaît donc sur **tous** les widgets qui lisent la base et sur
     **aucun** de ceux qui n'ont rien à lire (horloge, pense-bête, liste à cocher).
     ⚠️ Elle ne remplace pas les **squelettes** : ceux-ci couvrent le **premier** chargement
     (« rien à afficher encore »), la barre couvre tout le reste — `loading` retombe dès la
     première page, et une liste de 50 lignes sur 371 paraît alors complète. Décorative au sens
     du §2 : feuille absente, le segment reste immobile, mais le sous-titre dit toujours l'état.
     ⚠️⚠️ **Les animations d'attente vivent en JS, pas en CSS** — `MotionFX`, `Block.tsx` §2-ter,
     écrit le même jour après le constat « les loaders ne bougent pas sur les widgets ». La cause
     est celle qui a déjà coûté tous les survols du bloc : **la feuille de `StyleInjector` peut ne
     pas s'appliquer dans le bloc Softr**, et avec elle disparaissent toutes les `@keyframes`.
     Squelettes et barre s'affichaient donc **immobiles** — et une forme grise figée ressemble à
     un écran gelé, soit l'inverse exact de ce qu'un indicateur d'attente doit dire. Un
     `MutationObserver` sur le conteneur du bloc donne son `Animation` (Web Animations API) à
     chaque élément porteur de `slb-skel`, `slb-bar` ou `slb-spin`, à l'apparition. Même
     doctrine que `HoverFX` (§2-bis) et que le dégradé du héro : *ce qui doit marcher ne dépend
     pas de la feuille*. `prefers-reduced-motion` est respecté (rien n'est lancé, les formes
     restent). ⚠️ Le reflet d'un squelette ne peut PAS passer par un `::after` — sans feuille, le
     pseudo-élément n'existe pas : le moteur pose un dégradé **en style inline** et déplace sa
     `background-position`. C'est aussi pourquoi la feuille ne porte plus l'animation du
     squelette (elle ne pourrait pas produire le même effet), alors qu'elle garde celles de la
     barre et de la rotation, **identiques des deux côtés** donc sans conflit visible.
     Trois compléments livrés le même jour :
     · **les squelettes ne clignotent plus, ils luisent** — un reflet traverse la forme. Un
       clignotement se lit comme une alerte, un balayage comme un travail en cours ;
     · **deux widgets affichaient un état vide pendant leur chargement**, ce qui est pire qu'un
       écran d'attente parce que ça se lit comme une réponse : le **Journal des tâches**
       annonçait « Aucune tâche en cours » et **Nouveaux dossiers abonnés** « Tout est traité »
       — la plus rassurante des trois réponses possibles — pendant les secondes que dure le
       drainage de leurs tables. Les deux montrent désormais un squelette de quatre lignes, et
       l'état vide ne s'affiche plus qu'une fois la lecture terminée ;
     · **« Chargement… » dans le sous-titre** des widgets qui n'en disaient rien : synthèse SAV,
       indicateurs commerciaux, podium, classement des commerciaux, exceptions et registre.
   - **⋮ Réglages du widget** (2026-08-06) — une **modale** en deux colonnes (*Apparence* :
     titre, couleur ; *Contenu* : les réglages du type), et non plus un panneau de 292 px.
     Elle porte aussi le **retrait du widget** (confirmation en deux temps) et sa **largeur**
     (moitié / pleine) — et c'est tout. ⚠️ **Ni hauteur ni position** : les deux ont été
     retirées du panneau le 2026-08-07 parce que le **geste** suffit — la **poignée sous la
     carte** règle la hauteur en continu (120 à 1600 px), l'**en-tête se glisse** pour
     réordonner. Contrepartie assumée et connue : ces deux réglages n'ont donc plus **aucun
     chemin au clavier ni au doigt**, le glisser-déposer HTML5 ne répondant pas au tactile.
     Les **poignées** sont discrètes au repos, révélées au survol de leur bord, et déportées
     dans la gouttière pour ne pas voler les clics des lignes ni recouvrir la barre de
     défilement. Le geste s'écrit **une seule fois, au relâchement**. ⚠️ Le retrait est
     **écrit immédiatement** (pas de brouillon), d'où sa confirmation et le toast. La mention « Rien n'est appliqué avant
     Enregistrer » a été retirée du pied : deux boutons nommés « Annuler » et
     « Enregistrer » le disent déjà.
     **2026-08-18 — la confirmation de retrait occupe désormais tout le pied** : « Annuler » et
     « Enregistrer » s'effacent tant que la question est posée et reviennent à « Non ». Deux
     sorties contradictoires ne sont plus offertes en même temps, et « Retirer / Non » tombe à
     la place exacte des boutons masqués.
     **⚠️ 2026-08-18 — la modale ne déplace plus son widget.** Elle est un descendant DOM de
     l'en-tête, qui est la zone de préhension `draggable` ; `draggable` étant hérité par tout
     le sous-arbre, un glissement amorcé dans la modale déplaçait la carte derrière le fond
     flouté. La garde qui existait lisait `e.target` de `dragstart`, or cette cible est la
     **source du glissement** — l'en-tête lui-même — jamais l'élément profond : elle ne pouvait
     rien filtrer. L'origine du geste est donc mémorisée au `pointerdown` **en capture**, et
     `onDragStart` décide sur elle. Un `data-slb-nodrag` sur le fond de la modale couvre ce
     qu'aucun rôle ARIA ne désigne. Pas de portail : `react-dom` n'est pas importable ici. Le **choix de la vue** (liste / tableau / indicateur) a été **retiré** : la forme
     est décidée à la pose par le modèle de la galerie et ne change plus — un indicateur
     reste un indicateur. Pour une autre forme, on pose un autre widget.
   - **Tous les installateurs** (2026-08-06) — le classement du bloc KPI, en version resserrée :
     rang, installateur, **signés** (avec barre de volume), CAPEX, puissance kWc, taux de pose
     et **courbe sur 12 mois**. Quatre colonnes de chiffres au lieu de neuf, les deux graphiques
     gardés ; annulés, taux d'annulation, poses et délai restent dans le bloc KPI, fait pour
     l'analyse. Recherche par nom (le parc compte ~112 installateurs), tri par en-tête persisté,
     **clientèle** réglable (2026-08-20) : « quels installateurs travaillent avec des pros ? ».
     ⚠️ **Aucun calcul propre** : `comStats(…, "installateur")` réutilise celui du classement
     commercial — deux agrégats concurrents sur les mêmes dossiers finiraient par se contredire.
     Le rang reste celui du classement complet : filtrer ne renumérote pas.
   - **Barre d'outils de consultation** (2026-08-06), dans tous les widgets liste et tableau :
     **recherche** plein-texte (mot par mot, sans accents, sur les champs déclarés),
     **jusqu'à trois filtres à cases** en multi-sélection (`cfg.facets` — **liste depuis le
     2026-08-19**, un seul filtre avant : entreprise · service · type de contact pour
     l'annuaire des contacts, l'installateur pour les notes et les dossiers, le partenaire /
     prospect pour les tâches, l'installateur initial pour le SAV ; les valeurs sont déduites
     des données, triées par fréquence, avec leur compte). **OU** entre les valeurs d'un même
     filtre, **ET** entre les filtres — de quoi demander « les commerciaux ou les admins, chez
     MC ENERGY ». Un champ déclaré **multi-valeurs** (`multi` sur son `FieldDesc`) est découpé :
     le filtre liste « Commercial » et « Admin » séparément, et cocher l'un trouve les contacts
     qui portent les deux. Un champ dont toutes les lignes ont la même valeur n'affiche aucun
     bouton (il ne filtrerait rien). Puis le **tri** : par clic sur l'en-tête de colonne en vue
     tableau (recliquer inverse le sens, tri **typé** par la nature du champ), par un bouton
     « Trier » en vue liste, qui n'a pas d'en-têtes. Les trois s'appliquent **avant la limite
     de lignes**, donc sur toute la table lue. Rien n'est persisté : recharger remet à plat
     (un filtre « collant » donnerait un widget vide sans raison visible). Réglable dans ⋮ →
     *Consultation*.
   - **Le bouton de sortie d'une fiche nomme sa destination** *(2026-08-19, signalé)*. La pop-up
     d'une ligne affichait « **Ouvrir la fiche complète** » dès que la source déclarait une page.
     Or la page `contact-partenaire` est une **liste** : elle ignore le `recordId` qu'on lui
     passe, et le bouton promettait donc la fiche d'une personne pour rendre un tableau de
     371 lignes — juste dans sa destination, faux dans son libellé. Désormais le descripteur
     distingue les deux : `detailPage` (une fiche par `recordId`) garde « Ouvrir la fiche
     complète » ; `listPage` + `pageLabel` donnent « **Ouvrir <nom>** », le même libellé
     que le pied du widget — deux chemins vers la même page ne doivent pas la nommer autrement.
     Le jour où l'espace gagne une vraie fiche de contact, une ligne (`detailPage`) suffit et le
     libellé redevient « fiche complète » tout seul.
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
     détail dessous, barre pour les proportions) ou en **lignes** denses. ⚠️ L'alerte
     **« N ouverts > 60 j » a été retirée le 2026-08-07** : elle n'appelait aucun geste depuis
     l'accueil (le dossier se traite dans le bloc SAV) et occupait la tête du widget. Comme
     pour « priorité élevée », le calcul reste dans `savKpis` et la remettre ne demande que de
     ré-ajouter son entrée au registre — ceux qui l'avaient cochée la retrouveraient, le
     document n'étant jamais « réparé ».
   - **Indicateurs commerciaux** — rangée de tuiles : contrats signés, annulés (+ taux), CAPEX
     signé HT et kWc, installateurs actifs, et le pipeline **« à signer (30 j) »** avec son CAPEX
     restant. Période réglable, sauf le pipeline qui reste sur sa fenêtre glissante ; **clientèle**
     réglable aussi (2026-08-20).
   - **Podium CAPEX HT** — les trois premiers commerciaux, marches 2·1·3, période réglable
     (mois / année / tout) et **clientèle** réglable (2026-08-20) : « les trois premiers sur les
     dossiers pros » est une autre question, et elle a sa réponse ici.
   - **Classement des commerciaux** — le tableau du bloc KPI : rang, avatar et abonnement moyen,
     CAPEX HT avec barre, tendance, signés, annulés, taux de pose, délai de signature, courbe sur
     12 mois, installateurs. **Les en-têtes trient d'un clic**, et le tri est persisté.
     À poser en **pleine largeur** : dix colonnes ne tiennent pas dans une demi-colonne. **Clientèle**
     réglable (2026-08-20), comme sur « Tous les installateurs » — le calcul est le même, seul le
     regroupement change.
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

   > 🐛 **Corrigé le 2026-08-18 — la teinte s'arrêtait aux lignes.** Sur « Nouveaux dossiers
   > abonnés », changer la couleur repeignait la carte mais **pas les lignes** : leur fond
   > « non vu » était `T.brand050` **en dur**, un teal qui restait teal sur un widget rosé — et
   > comme cette liste ne contient que des lignes non vues, c'étaient **toutes** les lignes.
   > Elles prennent maintenant la nuance soutenue de la teinte (`tint.pill`). Même cause pour
   > le **survol** d'une ligne, qui ramenait du gris au milieu d'un widget coloré : il passe par
   > `--slb-row-hover`, une variable CSS publiée par la carte teintée et lue par la feuille §2
   > **comme par** le moteur de survol §2-bis — sans elle, ni l'un ni l'autre ne connaît la
   > teinte de l'instance. Le gris reste le défaut des listes sans teinte.
   > Ce que la teinte continue de **ne pas** toucher : les couleurs de **sens** (badges, alertes)
   > et les contenus délibérément blancs (tuiles de la synthèse SAV, saisie du pense-bête).

   **Ajouter un widget** se fait depuis une **galerie en feuille modale** : recherche, filtres
   par famille, et une **miniature** par modèle qui montre sa forme avant de le poser. Toute la
   disposition — titres et couleurs compris — est **persistée par utilisateur**.

   **2026-08-18 — le modèle « Dossiers du mois (indicateur) » a été retiré de la galerie** : il
   comptait sur **30 jours glissants** (`creeLe`) sous un titre qui annonçait « du mois ».
   Il est **masqué** (`hidden` sur son `PresetDesc`), pas effacé : la clé d'un preset est
   `"<source>:<index de déclaration>"`, donc supprimer la ligne décalerait les presets suivants
   et les widgets déjà posés pointeraient vers un autre modèle. ⚠️ Une instance **déjà posée**
   continue de s'afficher (sa cfg est autoportante) — elle se retire au ⋮ du widget.

   **⚠️ 2026-08-07 — le mode « Personnaliser » a été SUPPRIMÉ.** La barre du tableau de bord ne
   porte plus qu'un bouton, **« Ajouter un widget »** ; « Réinitialiser », « Annuler » et
   « Enregistrer » ont disparu avec le brouillon qu'ils servaient. **Tout se règle en direct** :
   glisser l'en-tête d'une carte pour réordonner, poignées de bord et du bas pour la taille,
   ⋮ pour le reste. Chaque geste est écrit aussitôt — silencieusement s'il réussit, avec un
   toast **« Réessayer »** s'il échoue. Contrepartie assumée : **il n'y a plus d'annulation
   globale**, seul le retrait d'un widget demande une confirmation.

## 4. Branchement Airtable — état au 2026-08-05

**`USE_MOCK = false` : le bloc lit Airtable en direct.** **Toutes** les sources du catalogue sont
connectées — `contactsIns` (l'annuaire des contacts partenaires) a rejoint le registre le
2026-08-19 : `CATALOG` ne porte de nouveau aucun `connected: false`.

### A — Datasources & champs (`Block.tsx` §6) ✅
`datasource.define` unique, IDs en **littéraux**. Les noms de champs ont été **revérifiés
contre le schéma Airtable le 2026-08-04**, avant l'ouverture de la lecture en direct.

| Alias (`DS.`) | Table Airtable (base)                       | Datasource ID | Champs (alias → nom Airtable exact) |
| ------------- | ------------------------------------------- | ------------- | ----------------------------------- |
| `abonnes`  | « Abonnés » (BDD Abonné)                        | ✅ `8fc957d0-…` | nom `Nom` · prenom `Prenom` · partenaire `Nom de l'entreprise (from Installateur )` · statut `Statut Dossiers` · offre `Type d installation` · creeLe `date de création` · **client `Champs IA Config client`** · **entreprise `Nom de l'entreprise`** ⚠️ *les DEUX à cocher côté Softr* |
| `notesIns` | « Suivi client » (Bdd Installateurs)           | ✅ `122fbc71-…` | nom `Installateur` · note `Notes` · date `Date ` *(espace final)* · **⚠️ à exposer** : proprio `Proprietaire (from Installateurs)` |
| `notesPro` | « Suivi propect » (BDD Propect)                | ✅ `dbd7e501-…` | nom `Nom` · note `Notes` · date `date ` *(espace final, createdTime)* · **⚠️ à exposer** : proprio `Propriétaire (from Propects)` *(lookup **créé le 2026-08-07**)* |
| `tachesPa` | « Taches » (Bdd Installateurs)                 | ✅ `7198b954-…` | desc `Description` · associe `Partenaire associé` · fin `date de fin` · fait `Fait` · **⚠️ à exposer** : assignee `Assignee` |
| `tachesPr` | « **Tâches** » (**BDD Propect Sunlib**) *(id confirmé le 2026-08-07)* | ✅ `9414183e-…` | desc `Description` · associe `Prospect associé` · fin `Date de fin` · fait `Fait` · **⚠️ à exposer** : assignee `Assignee` |
| `sav`      | « Tickets » (SAV) — *lecture seule*            | ✅ `3f5f8f6c-…` | 22 alias : ticket, client, installateur, dates, 12 catégories, fabricant, priorité, statut, tiers, coût |
| `comKpi`   | « Abonnés » **relue** — *lecture seule, paginée* | ✅ (même `8fc957d0-…`) | commercial `Propio SOFTR` · capex `Prix Installation HT total` · contratSigne `Contrat abonnement signe` *(pièce jointe)* · statutAbonne `Statut de l'abonné` · moisSignature `Mois de signature contrat` · aboMoyen `Prix En nombre` · etatFacture2 `Etat facture 2` · dateSignature `Date signature contrat` · dateCreation `date de création` · installateur `Nom de l'entreprise (from Installateur)` · **client `Champs IA Config client`** *(2026-08-20 — rien à cocher : même datasource qu`abonnes`)* |
| `parcAbo`  | « Abonnés » **relue en 1 champ**, paginée       | ✅ (même `8fc957d0-…`) | ref `Contrat abonné` — dénominateur « % du parc » |
| `notifC`   | « Notification Center » (BDD Abonné) — *écrivable*, **seule source du widget « Nouveaux dossiers abonnés »** | ✅ `fecd4e37-…` | liens `Liens BDD` · aLire `Statut de lecture` · etat `Statut de la notification` · creeLe `Created Date` · **⚠️ à exposer dans Softr** : texte `Notification` · nom `Nom (from Liens BDD)` · partenaire `Installateur (from Liens BDD)` · statut `Statut Dossiers (from Liens BDD)` · proprio `Proprietaire (from Installateur ) (from Liens BDD)` · **client `Champs IA Config client (from Liens BDD)`** *(2026-08-20)* |
| `excAbo`   | « Projet solaire » (Exception)                  | ✅ `b8340293-…` | exceptions **abonné** : dossier `SL- Dossier` · description · categorie · sousCategorie · service `Tag` · valideur · justificatif · installateur `BDD Installateur` · creeLe |
| `excPart`  | « Partenaire » (Exception)                      | ✅ `9cf1e459-…` | exceptions **partenaire** : nom `Name` + les mêmes champs, plus statut `Statut` |
| `parcPart` | « BDD Installateur » (Exception)                | ✅ `e82df933-…` | nom `Nom de l'entreprise` — dénominateur « % du parc partenaires » |
| `contactsIns` | « **Détails des contacts par installateur** » (Bdd Installateurs Sunlib, `appvD32dWRPmogRgn` · `tblplaeeb843AHLqo`, **1 266 lignes**) — *lecture seule, drainée* | ✅ `acc8398e-…` | nom `Nom` · prenom `Prénom` · entreprise `Nom Entreprise` *(lien)* · mail `Mail` · tel `Téléphone` · service `Service` *(multi-sélection)* · typeContact `Type de contact SunLib` *(multi-sélection)* · commentaire `Commentaire installateur` · proprio `Propriétaire TBD (from Nom Entreprise)` *(lookup)* · creeLe `Date de création` — **les 10 à cocher côté Softr** |

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

#### ⚠️ 2026-08-19 — `contactsIns` : UN prérequis avant de recoller le bloc

La source est branchée dans le code (id `acc8398e-…`, adapter, `connected: true`). Il reste **un
seul geste, côté Softr**, et il n'est pas optionnel :

> **Onglet *Sources* du bloc → connexion `contactsIns` → cocher les 10 champs** listés dans le
> tableau ci-dessus (`Nom`, `Prénom`, `Nom Entreprise`, `Mail`, `Téléphone`, `Service`, `Type de
> contact SunLib`, `Commentaire installateur`, `Propriétaire TBD (from Nom Entreprise)`,
> `Date de création`).

⚠️ Un champ lu par le code et **absent** de la datasource fait échouer la datasource **entière**,
donc **tout le bloc** (« does not match / Remap the fields ») — pas seulement ce widget. C'est le
piège qui a déjà coûté sur `notifC` et sur « Champs IA Config client ». Si l'éditeur signale un
champ manquant au collage, c'est ici qu'il faut regarder avant de toucher au code.

Vérifier ensuite dans cet ordre : `npm run build`, l'aperçu local (`npm run dev`), puis la page
**publiée en étant connecté** — l'aperçu « œil » de Softr n'a pas de session.

#### ⚠️ 2026-08-07 — filtres « mes fiches » : DEUX prérequis avant de recoller le bloc

Quatre widgets ne montrent plus que ce qui est **à soi** (rapprochement par le NOM, via
`ownerIsUser` : ces champs ne portent aucun e-mail). Le filtre est **réglable** et **actif par
défaut** ; décochable dans ⋮ → *Périmètre* pour les widgets `data`.

| Widget | Champ qui porte le propriétaire |
| ------ | ------------------------------- |
| Dernières notes — Installateurs | `Proprietaire (from Installateurs)` *(lookup existant)* |
| Dernières notes — Prospects | `Propriétaire (from Propects)` *(lookup **créé le 2026-08-07** dans « Suivi propect » : la table n'en avait aucun)* |
| Journal des tâches — onglet Prospects | `Assignee` |
| Journal des tâches — onglet Partenaires | `Assignee` |

1. **Exposer les 4 champs dans l'onglet *Sources* du bloc** (`notesIns`, `notesPro`, `tachesPa`,
   `tachesPr`). Un champ lu par le code mais absent de la datasource fait échouer **le bloc
   entier** (« does not match / Remap the fields »), pas seulement son widget.
2. ~~Vérifier la datasource `tachesPr`~~ — **fait le 2026-08-07** : l'id `9414183e-…` déjà en
   place désigne bien « **Tâches** » de **BDD Propect Sunlib** (`appKrZfi0alQwq7HX` ·
   `tblqcm9RYT1KgIe6K`), confirmé par le propriétaire du bloc ; la connexion Softr porte
   seulement le nom de l'ancienne table. ⚠️ **Si le journal affichait un jour des tâches
   étrangères aux prospects**, c'est le premier endroit à regarder : les cinq noms de champs
   existent dans **les deux** tables, donc une datasource repointée lirait **sans erreur**,
   simplement les mauvaises lignes. Signe distinctif : dans « Tâches » (BDD Propect),
   `Prospect associé` est un **lien** ; dans « Taches prospect », du **texte libre**.

Le **journal des tâches** gagne au passage un bouton **« Marquer comme faite »** par ligne
(écrit `Fait` = vrai ; disparition immédiate de la ligne, annulée avec un message si l'écriture
échoue), et ses pastilles de compteur baissent avec elle.

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

### C — Embeds Elfsight ✅ intégrés
Les trois embeds (fil LinkedIn `2df6db63-…`, bannière « À la une » `488a28ed-…`, barre d'annonces
`8f372b94-…`) passent par le composant **`ElfsightWidget`** (refonte du 2026-08-07) :

```tsx
<ElfsightWidget widgetId="488a28ed-f4b6-4f5b-af44-c16613885c98" />
```

Il rend une **iframe `srcDoc`** qui contient le snippet officiel — doctype, `body` sans marge,
le script `elfsightcdn.com/platform.js` en `async`, le `<div class="elfsight-app-…">` — et rien
d'autre. `width: 100%`, `border: 0`, `loading="lazy"`, hauteur `420` px par défaut (prop
`height`).

**Pourquoi cette forme** : le montage direct dans le document de l'app ne fonctionne pas, et trois
implémentations y ont échoué. Le test du 2026-08-07, en production, montre que le même widget
s'affiche dès qu'il a son propre document — ce qui **innocente** le widget, le compte, l'URL du CDN
et la **CSP** (un `srcdoc` hérite de la politique du parent). La cause résiduelle est le document
lui-même (shadow DOM du bloc `vibe code`, ou remontages React) : on ne la corrige pas, on l'isole.

⚠️ **La hauteur est fixe** — une iframe ne se dimensionne pas sur son contenu. Si le contenu de la
bannière change côté Elfsight, ajuster `ELFSIGHT_HEIGHT` dans `Block.tsx` ou passer `height`.

La prop `hideLabel` masque un texte rendu PAR Elfsight dans l'iframe — utilisée pour l'en-tête
« SunLib sur LinkedIn » de la bannière, qui doublonnait le titre de la carte. Le ciblage se fait sur
le **texte exact** et sur le nœud le plus profond qui le porte, jamais sur un sélecteur : les classes
d'Elfsight ne sont pas un contrat, et masquer `[class*="title"]` emporterait le titre du webinaire.
⚠️ **La voie propre reste côté Elfsight** : décocher l'affichage du titre dans l'éditeur du widget,
puis retirer la prop.

> ⛔ **Le Fil LinkedIn ne monte pas dans le bloc, y compris sur le domaine publié (2026-08-05).**
> Diagnostic en cours. Ce qui est **éliminé**, et par quelle observation :
>
> | Suspect | Écarté par |
> | --- | --- |
> | CSP, bloqueur de contenu | le runtime **se chargeait** (`onload` appelé) — relevé avec l'ancien loader, qui exposait cet état ; `ElfsightWidget` ne le suit plus (2026-08-07) |
> | Domaine, compte Elfsight | le même runtime sert un autre widget depuis un bloc « Custom Code » sur ce domaine |
> | URL du runtime | aligné sur `static.elfsight.com/platform/platform.js` le 2026-08-05, **repassé à `elfsightcdn.com/platform.js`** (snippet officiel) le 2026-08-07 — les deux servent le même runtime, mais une CSP qui liste des hôtes ne les vaut pas ; c'est la première chose à rebasculer |
> | `data-elfsight-app-lazy` manquant | attribut remis le 2026-08-05, **retiré de nouveau** : il n'a rien débloqué et lie le montage à la visibilité, or la grille est scrollable |
> | Injection par `innerHTML` (un `<script>` n'y s'exécute jamais) | **jamais utilisée ici** : le runtime a toujours été créé par `document.createElement` dans un `useEffect` |
> | Runtime chargé dans la page parente, div dans l'iframe | **non applicable** : le script est appendé au `document.body` de l'iframe, le même document que le div |
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
  risque tant que la table reste sous le plafond de drainage `COM_MAX_PAGES` : au-delà, la
  liste deviendrait silencieusement partielle et c'est **le plafond** qu'il faudrait relever.

> ⚠️ **`COM_MAX_PAGES` relevé de 40 à 120 le 2026-08-06.** Le bandeau « Calcul partiel »
> s'affichait sur le classement commercial alors que « Abonnés » ne compte que **1 774 lignes** :
> 40 pages n'ayant pas suffi, une page Softr fait donc **moins de 45 lignes** — pas les 100
> supposées. 120 pages couvrent 3 000 lignes à 25 par page. Le plafond reste indispensable (une
> boucle serveur doit pouvoir s'arrêter) mais coûte des allers-retours : les agrégats mettent
> plus longtemps à être justes. Une trace console donne désormais **pages, lignes et taille de
> page réelle** dès que le plafond est atteint, pour recalibrer sans deviner.

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
| `contactPartenaire` | `contact-partenaire` | ⚠️ raccourci **masqué** le 2026-08-18 (slug conservé) — **repris le 2026-08-19** comme `detailPage` *et* `listPage` du widget « Contact partenaire » |
| `sav` | `sav` | Pilotage SAV |
| `kpi` | `dashboard-kpi` | Tableau de bord KPI |

C'est précisément l'intérêt du registre : **le code parle métier** (`PAGES.partenaires`) là où
l'espace garde ses adresses historiques (`/clients-list`).

**✅ Plus aucune adresse manquante.** Outils externes, tous embarqués : Calculette d'abonnement
(`calculette-abonnement.vercel.app`, **adresse changée le 2026-08-18**), Map (`sunlib-carte-installateurs.vercel.app`), ERP
(`erp-sunlib.vercel.app`), Formulaire de contact (`formulairedecontact.vercel.app`), Bibliothèque
(`documentation-interne.vercel.app`) — plus `simulateurGrille`
(`simulateur-grille-v2.vercel.app`), présent au registre mais **masqué** côté tuile.
« Services Sellsy » a été **retiré** des Outils le 2026-08-04 ; **You Sign et Tik&Lib le
2026-08-18**, leurs adresses supprimées du registre.

Le mécanisme de repli reste en place pour la suite : une entrée vide est un **choix explicite**, la
tuile s'affiche alors **désactivée** (mention « bientôt ») au lieu de promettre un clic qui ne mène
nulle part.

⚠️ **Ne jamais coller dans ce registre une URL copiée depuis une barre d'adresse en cours de
session.** La règle vient de You Sign (retiré depuis) : son adresse avait été fournie sous la forme
d'une page de connexion Auth0 portant un jeton
(`auth.yousign.app/u/login/identifier?state=…`) — ces paramètres expirent, et le lien aurait mené
à une erreur d'authentification. C'est toujours la **racine** d'une app qu'on enregistre : elle
redirige d'elle-même vers le login, et ne périme pas.

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
### ⚡ 2026-08-19 — la page ne relit plus la base à chaque ouverture

**Ce qui existait** (`§6-ter`, 2026-08-18) était un cache d'**affichage** : il servait les lignes
de la dernière lecture complète, puis **relisait toujours**. Il supprimait l'attente, pas les
requêtes. Or les sources drainées coûtent des dizaines d'allers-retours **en série** chacune —
de l'ordre de **350 à 450 requêtes par visite** pour un accueil qui porte tous les widgets, à la
taille de page déduite de ~25 lignes. Sur la page la plus visitée du CRM.

**Ce qui a été arbitré** : la donnée doit être fraîche à la **première ouverture de la journée** ;
ensuite l'instantané suffit. La règle est **déclarée par source** (`fraicheur` sur `SourceDesc`),
parce que la réponse est métier et non technique :

| `fraicheur` | Sources | Effet |
| --- | --- | --- |
| `"jour"` *(défaut)* | Abonnés, podium/classement, parcs, exceptions, SAV, notes, **contacts partenaires** | La 1re ouverture du jour lit ; les suivantes servent l'instantané, **zéro requête** |
| `"ouverture"` | `notifC` (**Nouveaux dossiers abonnés**), `tachesPa` + `tachesPr` (**Journal des tâches**) | Relu à chaque ouverture — ce sont des **files à traiter** : un dossier notifié à 10 h doit se voir à 10 h 05 |

**Comment** (`§6-quater`) : `SourceFeed` calcule la clé du cache **avant** de monter l'adapter (d'où
la table `SELECT_OF`, la clé contenant le hash du select). Si l'instantané est du jour, l'adapter
n'est **pas monté** — `useRecords` n'existe pas, donc aucune requête ne part. Le **⟳ de chaque
carte** force la lecture quand on la veut : c'est la porte de sortie qui autorise une règle aussi
stricte.

Trois précautions qui font partie du mécanisme :
- **Règle calendaire, pas délai glissant.** Un TTL de 24 h laisserait quelqu'un qui ouvre à 8 h
  lundi puis 9 h mardi travailler sur les chiffres de la veille — 23 h d'écart, sous le seuil, et
  pourtant « hier ». C'est `memeJour`.
- **Rien n'est servi qui ne soit annoncé.** Les widgets d'agrégat affichent « Instantané » et le
  texte a été corrigé : « mise à jour en cours » devenait **faux** quand plus aucune lecture ne
  part, il dit maintenant « relire avec le ⟳ de la carte ». Les listes et tableaux datent leurs
  lignes dans leur sous-titre (« · données du 18/08 à 09:14 »).
- **L'attente de la session est nécessaire** (`SESSION_WAIT_MS = 400 ms`) : la clé du cache
  contient l'e-mail, que Softr rend souvent au **second** render. Décider dès le premier
  reviendrait à ne jamais trouver d'instantané — le cache serait écrit sans jamais servir.
  Pendant cette attente, le widget montre ses squelettes ; sans session du tout, on lit.

⚠️ **Deux limites connues, à vérifier en recette.** Une source dont l'instantané dépasse
`SNAP_MAX_CHARS` (900 000 caractères) n'est **jamais** mise en cache, donc relue à chaque fois : la
console le dit (`instantané NON gardé`), et `abonnes` est le candidat à surveiller depuis que son
select porte 23 alias. Et une source servie par le cache **n'expose pas `write`** : ses boutons
d'écriture disparaissent — c'est sans effet aujourd'hui puisque les trois sources dans lesquelles
le bloc écrit sont en `"ouverture"`, mais c'est le premier point à revoir le jour où une action est
ajoutée à une source en `"jour"`.

- **Recetter le cache d'instantanés** (2026-08-18, `Block.tsx` §6-ter — détail dans
  `ARCHITECTURE.md` §4). Rien ne s'en voit en local : le mock rend tout d'un coup, donc aucun
  instantané n'est jamais *servi*. Sur la page publiée, connecté :
  1. **1re visite** : squelettes normaux, puis remplissage. Dans l'inspecteur
     (Application → Local Storage), relever le **poids** des entrées `slb-home-snap:…` — c'est le
     chiffre qui valide ou non `SNAP_MAX_CHARS = 900 000` (estimé, jamais mesuré en production).
  2. **2e visite** (aller sur une autre page de l'espace, puis revenir) : la page doit être pleine
     **immédiatement**, le chip afficher « Actualisation… », les widgets d'agrégat « Instantané ».
  3. **Cliquer le ⟳ d'une carte** (en-tête, à gauche du ⋮ — présent uniquement sur les widgets qui
     lisent la base) : l'icône tourne, la **barre de chargement** s'allume sous l'en-tête, et
     l'onglet Réseau doit montrer des requêtes **repartir pour cette source seulement**. Vérifier
     aussi qu'un widget **sans source** (horloge, pense-bête) n'a **pas** ce bouton, et que celui
     des **Exceptions** — qui lit quatre sources — les relit bien toutes.
     ⚠️ **Corrigé le 2026-08-19** (« on a l'impression que le bouton ne fonctionne pas »), et c'était
     un défaut d'ACCUSÉ DE RÉCEPTION, pas de relecture. Au remontage de l'adapter, Softr rend
     immédiatement les lignes de son cache mémoire : `isLoading` reste donc **faux**, plus rien ne
     passait à « en cours », et sur des lignes identiques le clic ne produisait aucun signe visible.
     Deux ajouts : l'état **`fetching`** (`isFetching`, la relecture qui a déjà des données —
     distinct de `loading`, qui seul autorise les squelettes), et un **plancher de 650 ms**
     (`REFRESH_FLOOR_MS`) pendant lequel la carte se montre occupée, parce qu'une relecture servie
     par le cache dure 80 ms et disparaît avant d'être vue. Aucune donnée n'est inventée : seul
     l'accusé de réception est tenu assez longtemps pour être lu.
     ⚠️ Si le bouton paraît **toujours** inerte au-delà de ce plancher, ouvrir la console : une
     ligne « `refetch` absent de l'objet useRecords » signifie que Softr ne l'expose pas et que seul
     le remontage a eu lieu — la relecture dépend alors de son `staleTime`, qui ne nous appartient
     pas. C'est la seule hypothèse que le code ne peut pas trancher tout seul.
  4. **Contrôle de justesse** : comparer un agrégat servi depuis le cache, puis rafraîchi, avec le
     bloc métier correspondant (dossiers SAV ouverts vs « Pilotage SAV »). Le cache ne doit jamais
     figer un total partiel.
  5. **Navigation privée** : la page doit fonctionner exactement comme avant, sans erreur console.
- **Mener l'expérience `count`** (taille de page Softr) : `SOFTR_PAGE_SIZE` + `TRACE_PAGES` dans
  `Block.tsx`, à côté de `COM_MAX_PAGES` — mode d'emploi dans le commentaire. C'est le levier de
  performance le moins cher qui reste, et **il n'a jamais été testé**.
- **⚠️ BLOQUANT — cocher DEUX champs** dans l'onglet **Sources** du bloc, pour la datasource
  `abonnes` (2026-08-18) : **`Champs IA Config client`** et **`Nom de l'entreprise`**. Sans eux,
  Softr **refuse la datasource entière** (« does not match / Remap the fields ») dès que le bloc est
  recollé : les deux viennent d'être ajoutés à `SELECT_ABONNE`. C'est le même piège que les cinq
  champs de `notifC`.
  `Nom de l'entreprise` porte le **nom des clients pros** : dans la base, un dossier pro a un
  « Nom » **vide**. Sans ce champ, les listes de dossiers affichent une ligne sans titre pour les
  deux tiers de la file d'attente.
  Une fois coché, le réglage **« Clientèle »** apparaît dans le ⋮ de tout widget branché sur
  « Abonnés ». Il compte **cinq** périmètres depuis le 2026-08-20 : tous · **Pro** · **Particuliers
  (Solo + Duo)** · **Solo** · **Duo**. S'il reste sans effet et affiche « Filtre inactif », c'est que
  le champ n'est pas exposé — le widget le dit au lieu de se vider en silence.
- **⚠️ BLOQUANT — cocher UN champ de plus** dans l'onglet **Sources**, pour la datasource `notifC`
  (2026-08-20) : **`Champs IA Config client (from Liens BDD)`**. Même piège, même conséquence — non
  coché, il fait tomber le **bloc entier** (« does not match / Remap the fields »), pas seulement le
  widget. Le lookup **existe déjà** dans la table « Notification Center » (`fldEimoiZuVIvuMP7`,
  relevé par l'API le 2026-08-20) : rien à créer côté Airtable, seulement à exposer.
  C'est ce champ qui donne au widget **« Nouveaux dossiers abonnés »** son réglage de clientèle, et
  la pastille « Pro / Solo / Duo » sur chaque ligne (à cocher dans « Informations affichées »).
  Rien à faire en revanche pour les **quatre widgets commerciaux** (podium, deux classements,
  indicateurs) : leur lecture passe par la datasource `abonnes`, où le champ est déjà exposé.
- **Poser les deux nouveaux widgets** depuis « Ajouter un widget » → groupe des dossiers :
  **« En attente de solvabilité »** et **« Demandes d'infos »**. Ce sont des widgets **presque
  figés** : leur ⋮ ne propose que le nom, la couleur, l'**ordre** et la **clientèle** — pas de
  réglage de source, de statut ni de colonnes. Vérifier que le dossier le PLUS
  ANCIEN sort en tête (tri ascendant, c'est une file d'attente) et que le compte correspond à
  Airtable — **25 dossiers** « En attente de solvabilité » au 2026-08-18, 14 en « Demande d'infos ».
  Si le sous-titre affiche « N sur M », c'est que la file dépasse 50 dossiers : c'est dit, pas caché.
  Puis régler la clientèle sur **Particuliers**, puis sur **Duo** : le sous-titre doit annoncer le
  périmètre (« N dossiers · particuliers ») et le compte doit **baisser** à chaque cran. Ordre de
  grandeur attendu : sur les 39 dossiers en attente relevés le 2026-08-18, 31 étaient Pro, 7 Solo et
  1 Duo — donc une poignée de particuliers seulement, et **un seul** dossier sur le périmètre Duo.
  Ces nombres bougent chaque semaine : c'est la mécanique qu'on vérifie, pas le chiffre.

## 5. Règles Softr respectées

- `from` sur chaque hook data ; **un seul** `datasource.define`, IDs littéraux inline.
- `q.select({...})` littéral ; filtres/tri par **alias**.
- Update **enveloppé** `mutate({ recordId, fields })` ; lecture paginée `data.pages.flatMap(p => p.items)`.
- Iframe : `useCurrentUser()` (jamais `window.logged_in_user`) ; navigation inter-pages en `<a target="_top">`.
- `useCurrentUser()` renvoie `{ id, email, name }` — **pas** `firstName` : le prénom du héro est dérivé de `name`, avec repli sur l'e-mail si `name` est vide (fréquent en prod).
- Aucune dépendance externe, aucune Google Font (`Plus Jakarta Sans` en fallback `system-ui`).
- Accessibilité charte : focus visible teal, `prefers-reduced-motion`, statuts en badge couleur **+** icône, dates relatives avec date absolue en `title`, états vides guidants.
