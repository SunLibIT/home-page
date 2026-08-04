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
   lente** via la Web Animations API, « Bienvenue {prénom} ! », date du jour, 2 chips (dossiers à
   traiter / tâches urgentes), **sunburst SVG animé** à droite (le logo rond distant, reconstruit
   pour pouvoir l'animer rayon par rayon).
2. **PageNavBar** (sticky) — onglets **in-block** : Accueil (le tableau de bord) + 3 apps Vercel
   publiques embarquées en iframe (Formulaire de contact, Simulateur Grille, Bibliothèque).
3. **Outils** — tuiles : pages de l'espace en `target="_top"` + outils externes (URLs à compléter).
4. **Tableau de bord** — grille de widgets **indépendants, redimensionnables et déplaçables**, qui
   **se tasse** (un petit widget ne laisse plus de trou sous lui) :
   - **Derniers dossiers Abonné** — avatar dégradé, badges statut et type d'installation, temps
     relatif, lien « Détail », pastille « Non lu » et bouton « Vu » (dès que `notifC` est connectée),
     et un ⋮ Options pour choisir les informations affichées et le nombre de lignes.
   - **Journal des tâches** — onglets denses Prospects | Partenaires (pastilles compteur), badge
     d'échéance par seuil (vert > 14 j, ambre 3–14 j, rouge < 3 j), case **« Fait » qui écrit en base**.
   - **Dernières notes — Installateurs** et **— Prospects** (widgets `data` génériques).
   - **Pilotage SAV — synthèse**, **embeds Elfsight** (à la une, annonces),
     et les **utilitaires sans source** : Heure, Pense-bête, Liste à cocher.

   Chaque widget se règle par son ⋮ ; « Personnaliser » ouvre la galerie (dépliants par famille,
   un exemplaire par modèle), et toute la disposition est **persistée par utilisateur**.

## 4. Branchement Airtable — état au 2026-08-04

**`USE_MOCK = false` : le bloc lit Airtable en direct.** 6 des 7 sources du catalogue sont
connectées ; il reste `notifC` et les URLs des outils.

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
| `notifC`   | « Notification Center » (BDD Abonné)           | ⏳ **à fournir** | liens `Liens BDD` · aLire `Statut de lecture` · etat `Statut de la notification` · creeLe `Created Date` |

> ⚠️ **Les datasources `Installateurs` et `Propects` (tables principales) ne sont utilisées par
> AUCUN widget** : les notes/tâches vivent dans les tables enfants ci-dessus.
> ⚠️ **Un id de datasource appartient à UNE connexion d'UN bloc**, pas à une table : « Notification
> Center » est déjà lue par deux blocs de page, il faut néanmoins la connecter à **celui-ci**
> (onglet *Sources*), puis relever son id (onglet *Chat*).
> ⚠️ **Les champs exposés sont choisis à la connexion** : la datasource de « Taches » n'en expose
> que 3 sur 12 à ses blocs de page. Si l'éditeur signale « you have a field in your source code X
> which is not present in your datasource » au collage, il faut **remapper la source**.

Détails du choix :
- **Derniers dossiers** = table `Abonnés`, par `date de création`. L'état lu / non lu vient de
  `Notification Center` (cf. §4-D). L'« offre » Duo/Solo/Pro du prototype n'existe pas →
  remplacée par `Type d installation`.
- **Tâches** : seules celles non cochées `Fait` sont affichées, et **cocher « Fait » écrit
  réellement en base** — c'est la première écriture métier du bloc.
- **SAV** : lecture seule. Un dossier se saisit dans le bloc « Pilotage SAV », qui porte les
  validations de cohérence. « Total interventions » est un champ **formule**, volontairement hors
  select : le déclarer ferait échouer l'écriture du record entier.
- **Pas de création de note ni de tâche depuis l'accueil** : le rattachement passe par un champ
  **lien** Airtable, qui attend un record id et non un nom — une ligne créée d'ici n'apparaîtrait
  sur la fiche de personne.

### B — URLs (`Block.tsx` §7)
- `NAV_TABS[].href` : pages de l'espace (gardent `target="_top"`).
- `QUICK_LINKS[].href` : outils. Ajouter `target="_blank" rel="noopener"` (outil externe) ou `target="_top"` (page de l'espace) selon la cible.

### C — Embed LinkedIn ✅ intégré
Widget **Elfsight** (bannière SunLib) `elfsight-app-488a28ed-…` intégré tel quel dans
`LinkedInSection` : le `<div>` cible est rendu sans restyle et `platform.js` est chargé
une fois via `useEffect` (un `<script>` en JSX ne s'exécute pas). Rien à faire, sinon
vérifier que `elfsightcdn.com` est autorisé par la CSP de l'iframe Softr.

### D — « Marquer comme vu » ⏳ code prêt, datasource manquante
Le masquage local a été retiré (il ne survivait pas au rechargement, donc il faisait croire
qu'on avait traité quelque chose). L'état vit maintenant dans **`Notification Center`**, joint
par le **record id** de l'abonné : il ne reste qu'à connecter la table à ce bloc.

⚠️ Trois particularités de cette table, **subies et non corrigées** (d'autres écrans consomment
ses formules) :
- **La case est inversée** : `Statut de lecture` **cochée** = « non lue ». D'où l'alias `aLire`,
  et une écriture de `false` pour marquer comme vu.
- **Deux lignes par événement** : on retient en priorité celle encore « à lire ».
- **L'état est global, pas par utilisateur** (aucun champ destinataire) : cocher vaut pour tout
  le monde — à dire aux utilisateurs.

Tant que la table n'est pas connectée, le widget s'affiche **sans pastille « Non lu » ni bouton
« Vu »** : dégradation prévue, pas une panne.

### E — Reste à faire
- Les **9 URLs** de `QUICK_LINKS` et `SAV_PAGE_HREF`, encore `#` (§7 de `Block.tsx`).
- **Confirmer le nom du paramètre** de la page « Détail » d'un abonné (`ABONNE_PAGE_PARAM`,
  `"recordId"` par convention) : ouvrir une fiche depuis l'app et lire son URL.
- **Vérifier à l'écran**, sur la page publiée et connecté, ce qui ne se manifeste qu'à la souris
  et en session : cocher « Fait », glisser un widget par son en-tête, régler une poignée.

## 5. Règles Softr respectées

- `from` sur chaque hook data ; **un seul** `datasource.define`, IDs littéraux inline.
- `q.select({...})` littéral ; filtres/tri par **alias**.
- Update **enveloppé** `mutate({ recordId, fields })` ; lecture paginée `data.pages.flatMap(p => p.items)`.
- Iframe : `useCurrentUser()` (jamais `window.logged_in_user`) ; navigation inter-pages en `<a target="_top">`.
- `useCurrentUser()` renvoie `{ id, email, name }` — **pas** `firstName` : le prénom du héro est dérivé de `name`, avec repli sur l'e-mail si `name` est vide (fréquent en prod).
- Aucune dépendance externe, aucune Google Font (`Plus Jakarta Sans` en fallback `system-ui`).
- Accessibilité charte : focus visible teal, `prefers-reduced-motion`, statuts en badge couleur **+** icône, dates relatives avec date absolue en `title`, états vides guidants.
