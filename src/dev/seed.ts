import { DS_IDS, type Rec } from "@/lib/datasource";

/**
 * Données fictives pour le DEV LOCAL uniquement (jamais livrées).
 * Champs indexés par ALIAS (mêmes clés que les q.select de Block.tsx), afin que le
 * chemin Airtable réel (USE_MOCK=false) soit testable en local via useRecords + mappers.
 *
 * NB : Block.tsx tourne par défaut avec ses PROPRES mocks (USE_MOCK=true) ; ce seed
 * n'est donc pas nécessaire à l'aperçu.
 */

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
};

// « Abonnés » — nouveaux dossiers (aliases : nom / prenom / partenaire / statut / offre / creeLe)
const abonnes: Rec[] = [
  { id: "a1", fields: { prenom: "Quentin", nom: "LINDIMER", partenaire: "Soleil et Climat", statut: "Dossier incomplet pour instruction", offre: "PV seul", creeLe: daysAgo(0) } },
  { id: "a2", fields: { prenom: "", nom: "TSD BEL HABITAT", partenaire: "TSD BEL HABITAT", statut: "Dossier PRO en cours d'étude du service technique", offre: "PV + Batterie Virtuelle", creeLe: daysAgo(1) } },
  { id: "a3", fields: { prenom: "Marie", nom: "Dupont", partenaire: "A.D.W", statut: "Contrat signé", offre: "PV seul", creeLe: daysAgo(2) } },
];

// « Suivi client » — notes installateurs (aliases : nom / note / date)
const notesIns: Rec[] = [
  { id: "i1", fields: { nom: "WattElse Energies SAS", note: "Contact via LinkedIn, en attente de retour sur la présentation.", date: "2025-05-19" } },
  { id: "i2", fields: { nom: "3J Environnement", note: "Dossier admin à jour, RGE renouvelé.", date: "2025-11-25" } },
];

// « Suivi propect » — notes prospects (aliases : nom / note / date)
const notesPro: Rec[] = [
  { id: "p1", fields: { nom: "JS Energies", note: "Tentative d'appel, laissé message, à relancer.", date: "2026-03-25" } },
  { id: "p2", fields: { nom: "Aurora Energie", note: "Envoi de la plaquette et de la grille.", date: "2025-07-08" } },
];

// « Taches » — tâches partenaires (aliases : desc / associe / fin / fait)
const tachesPa: Rec[] = [
  { id: "t1", fields: { desc: "Relancer pour les pièces du dossier RGE", associe: "MC ENERGY", fin: inDays(-2), fait: false } },
  { id: "t2", fields: { desc: "Envoyer la grille tarifaire 2026", associe: "FLG SOLAR", fin: inDays(1), fait: false } },
  { id: "t3", fields: { desc: "Point mensuel pipeline", associe: "Neosoleil", fin: inDays(6), fait: true } },
];

// « Taches prospect » — tâches prospects (aliases : desc / associe / fin / fait)
const tachesPr: Rec[] = [
  { id: "tp1", fields: { desc: "Rappeler après le salon", associe: "Enecopro", fin: inDays(3), fait: false } },
];

export const SEED: Record<string, Rec[]> = {
  [DS_IDS.abonnes]: abonnes,
  [DS_IDS.notesIns]: notesIns,
  [DS_IDS.notesPro]: notesPro,
  [DS_IDS.tachesPa]: tachesPa,
  [DS_IDS.tachesPr]: tachesPr,
};
