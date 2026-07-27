import Block from "../Block";
import { __seed } from "@/lib/datasource";
import { SEED } from "@/dev/seed";

// Seed du store mock au chargement (dev uniquement) — utile seulement si tu passes
// Block.tsx en USE_MOCK=false pour tester le chemin Airtable réel en local.
__seed(SEED);

/**
 * Barre de dev + rendu de Block.tsx.
 * Ce fichier n'est JAMAIS livré à Softr (seul Block.tsx part).
 * La page d'accueil n'a pas de "record courant" à basculer : on rend Block tel quel.
 */
export default function App() {
  return (
    <div>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 16px",
          background: "#101A28",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          fontSize: 13,
        }}
      >
        <strong style={{ opacity: 0.7, fontWeight: 600 }}>DEV · Softr mock</strong>
        <span style={{ opacity: 0.5 }}>
          Page d'accueil — données mock (USE_MOCK dans Block.tsx)
        </span>
      </div>
      <Block />
    </div>
  );
}
