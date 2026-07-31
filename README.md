# Page d'accueil du CRM — Bloc in-page « vibe code » Softr ↔ Airtable

Bloc de la **page d'accueil** du CRM SunLib, rendu dans le bloc *vibe coding* de Softr
(iframe), connecté à Airtable. Calqué sur les gabarits `abo-detail-inpage` et
`partenaire-detail-inpage`.

> 📐 **[`ARCHITECTURE.md`](ARCHITECTURE.md)** — état des lieux détaillé : contraintes Softr,
> mécanique des widgets (couches + registre des types + sources), modèle de layout,
> **persistance** (table `Preferences` + field IDs) et limites connues.
> 🎯 **[`ARCHITECTURE-V2.md`](ARCHITECTURE-V2.md)** — la cible du système de widgets et son
> plan de migration en 5 phases, avec la **recette « j'ai une table, j'en veux un widget »**.

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

1. **Héro** — dégradé de marque `#13A3AC → #3CAE68` (seule exception validée), « Bienvenue {prénom} ! », date du jour, 2 chips (dossiers à traiter / tâches urgentes), logo `logo_Blanc_rond.svg` à droite.
2. **PageNavBar** (sticky) — onglets-**liens** `<a target="_top">` vers les pages de l'espace : Accueil (actif), Prospects, Partenaires, Contact Partenaire, Abonnés, Bibliothèque, KPI.
3. **Outils** — 6 tuiles (You Sign, Calculette *ambre*, Simulateur Grille *ambre*, Sellsy, Tik&Lib, Formulaire), chevron animé au survol.
4. **SunLib sur Linkedin** — slot pour l'embed LinkedIn existant, intégré **tel quel**.
5. **Tableau de bord** — grille 2 colonnes de widgets indépendants et scrollables :
   - **Nouveaux dossiers Abonné** — avatar dégradé, badge offre + statut, temps relatif, actions Détail / Marquer comme lue, « Tout marquer comme lu ».
   - **Journal des tâches** — onglets denses Prospects | Partenaires (pastilles compteur), badge d'échéance par seuil (vert > 14 j, ambre 3–14 j, rouge < 3 j).
   - **Dernières notes — Installateurs** et **— Prospects**.

## 4. Branchement Airtable — les 4 zones `[À COMPLÉTER]`

Tant que `USE_MOCK = true` (en tête de `Block.tsx`), l'aperçu tourne sur les données
mock du prototype. Pour passer en réel :

### A — Datasources & champs (`Block.tsx` §6)
`datasource.define` unique, IDs en **littéraux**. Chaque widget lit **une** table.
Les noms de champs ci-dessous sont **vérifiés contre le schéma Airtable réel**.

| Alias (`DS.`) | Table Airtable (base)                       | Datasource ID | Champs (alias → nom Airtable exact) |
| ------------- | ------------------------------------------- | ------------- | ----------------------------------- |
| `abonnes`  | « Abonnés » (BDD Abonné)                        | ✅ `8fc957d0-…` | nom `Nom` · prenom `Prenom` · partenaire `Nom de l'entreprise (from Installateur )` · statut `Statut Dossiers` · offre `Type d installation` · creeLe `date de création` |
| `notesIns` | « Suivi client » (Installateurs)               | ⏳ **à fournir** | nom `Installateur` · note `Notes` · date `Date ` *(espace final)* |
| `notesPro` | « Suivi propect » (BDD Propect)                | ⏳ **à fournir** | nom `Nom` · note `Notes` · date `date ` *(espace final)* |
| `tachesPa` | « Taches » (Installateurs, *Partenaire associé*)| ⏳ **à fournir** | desc `Description` · associe `Partenaire associé` · fin `date de fin` · fait `Fait` |
| `tachesPr` | « Taches prospect » (Installateurs)            | ⏳ **à fournir** | desc `Description` · associe `Prospect associé` · fin `Date de fin` · fait `Fait` |

> ⚠️ **Les datasources `Installateurs` et `Prospects` (tables principales) fournies au
> départ ne sont utilisées par AUCUN widget** : les notes/tâches vivent dans les 4 tables
> enfants ci-dessus. Il faut donc connecter **ces 4 tables enfants** comme datasources
> (onglet *Sources* du bloc) et me passer leurs IDs (onglet *Chat*).

Détails du choix :
- **Notifs** = table `Abonnés` : 12 derniers dossiers par `date de création`. Pas de
  champ « Lu » → « marquer comme lu » = **masquage local** (non persistant, cf. §4-D).
  L'« offre » Duo/Solo/Pro du prototype n'existe pas → remplacée par `Type d installation`.
- **Tâches** : seules celles non cochées `Fait` sont affichées.

Une fois les **4 IDs enfants** renseignés dans `DS` (§6) → **passer `USE_MOCK` à `false`**.

### B — URLs (`Block.tsx` §7)
- `NAV_TABS[].href` : pages de l'espace (gardent `target="_top"`).
- `QUICK_LINKS[].href` : outils. Ajouter `target="_blank" rel="noopener"` (outil externe) ou `target="_top"` (page de l'espace) selon la cible.

### C — Embed LinkedIn ✅ intégré
Widget **Elfsight** (bannière SunLib) `elfsight-app-488a28ed-…` intégré tel quel dans
`LinkedInSection` : le `<div>` cible est rendu sans restyle et `platform.js` est chargé
une fois via `useEffect` (un `<script>` en JSX ne s'exécute pas). Rien à faire, sinon
vérifier que `elfsightcdn.com` est autorisé par la CSP de l'iframe Softr.

### D — « Marquer comme lue »
La table `Abonnés` n'ayant pas de champ « Lu », le « marquer comme lu » est un **masquage
local** (retour visuel immédiat, **non persistant** : réapparaît au rechargement).
Pour une lecture **persistante**, deux voies : (1) basculer la source sur la table
`Notification Center` (case native `Statut de lecture`), ou (2) ajouter un champ `Lu`
coché par une automation. Dis-moi si tu veux l'une des deux — c'est rapide à brancher.

## 5. Règles Softr respectées

- `from` sur chaque hook data ; **un seul** `datasource.define`, IDs littéraux inline.
- `q.select({...})` littéral ; filtres/tri par **alias**.
- Update **enveloppé** `mutate({ recordId, fields })` ; lecture paginée `data.pages.flatMap(p => p.items)`.
- Iframe : `useCurrentUser()` (jamais `window.logged_in_user`) ; navigation inter-pages en `<a target="_top">`.
- `useCurrentUser()` renvoie `{ id, email, name }` — **pas** `firstName` : le prénom du héro est dérivé de `name`, avec repli sur l'e-mail si `name` est vide (fréquent en prod).
- Aucune dépendance externe, aucune Google Font (`Plus Jakarta Sans` en fallback `system-ui`).
- Accessibilité charte : focus visible teal, `prefers-reduced-motion`, statuts en badge couleur **+** icône, dates relatives avec date absolue en `title`, états vides guidants.
