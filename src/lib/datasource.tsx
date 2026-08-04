import React from "react";

/**
 * ============================================================================
 *  MOCK de @/lib/datasource (API "vibe coding" de Softr) pour le DEV LOCAL.
 * ============================================================================
 *  Ce fichier N'EST JAMAIS LIVRÉ. En prod, Softr fournit sa propre implémentation
 *  de cette API. Le but ici : faire tourner Block.tsx en local (npm run dev)
 *  avec des données fictives, en respectant EXACTEMENT les signatures Softr :
 *
 *   - datasource.define({ alias: "datasourceId", ... })   (IDs littéraux)
 *   - useRecord({ from, recordId, select })            -> { data:{id,fields}, isLoading }
 *   - useRecords({ from, select, where, orderBy })      -> { data:{ pages:[{items:[{id,fields}]}] } }
 *   - useRecordUpdate() -> mutate({ recordId, fields })   (ENVELOPPÉ)
 *   - q.select({ alias: "Nom du champ Airtable" })
 *     q.text/number/date(alias).is/contains/...   (par ALIAS, pas nom de champ)
 *     q.asc/desc(alias)
 *
 *  Convention du mock : les données fictives sont indexées par ALIAS (les mêmes
 *  clés que celles utilisées dans Block.tsx). Le mock ignore la valeur "Nom du
 *  champ Airtable" du select (seule Softr en a besoin) et n'utilise que ses clés.
 *
 *  ⚠️ Ces IDs sont des PLACEHOLDERS de dev. En prod, seuls comptent les IDs
 *  littéraux du datasource.define de Block.tsx (à récupérer via l'onglet Chat
 *  du bloc Softr). Les valeurs ci-dessous ne servent qu'à faire correspondre
 *  le store mock au define local pour tester le chemin USE_MOCK=false.
 * ============================================================================
 */

/* ---- IDs de datasource (doivent matcher datasource.define de Block.tsx) ---- */
export const DS_IDS = {
  abonnes: "8fc957d0-232b-4b24-906e-d0be7c636f30", // BDD Abonné · « Abonnés »
  notesIns: "122fbc71-06e9-40ce-8b4d-01544c1ac022", // Bdd Installateurs · « Suivi client »
  notesPro: "dbd7e501-deba-482d-86f9-7b3a47abfe4f", // BDD Propect · « Suivi propect »
  tachesPa: "7198b954-7fdd-41a7-b92b-a114ff88009e", // Bdd Installateurs · « Taches »
  tachesPr: "9414183e-2624-4e6e-8d7c-89470546251b", // « Taches prospect »
  sav: "3f5f8f6c-c6af-4909-a8dc-46e2f123e9a6",      // SAV · « Tickets »
} as const;

/* ============================ Types ============================ */
export type Attachment = { url: string; filename: string };
export type Fields = Record<string, any>;
export type Rec = { id: string; fields: Fields };

/* ============================ Store réactif ============================ */
const store: Record<string, Rec[]> = {
  [DS_IDS.abonnes]: [],
  [DS_IDS.tachesPr]: [],
  [DS_IDS.tachesPa]: [],
  [DS_IDS.notesIns]: [],
  [DS_IDS.notesPro]: [],
  [DS_IDS.sav]: [],
};

let version = 0;
const listeners = new Set<() => void>();
function emit() {
  version++;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
function useVersion() {
  return React.useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
}

/* Helpers dev (utilisés par App.tsx, jamais par Block) */
export function __seed(seed: Record<string, Rec[]>) {
  Object.assign(store, seed);
  emit();
}

/* ============================ define() ============================ */
export const datasource = {
  /** Renvoie l'objet tel quel : DS.abonnes === "ds-abonnes" */
  define<T extends Record<string, string>>(map: T): T {
    return map;
  },
};

/* ============================ Query builder q ============================ */
type Filter = { alias: string; op: string; value?: any };
type Sort = { alias: string; dir: "asc" | "desc" };

function makeCmp(alias: string) {
  return {
    is: (value: any): Filter => ({ alias, op: "is", value }),
    isNot: (value: any): Filter => ({ alias, op: "isNot", value }),
    contains: (value: any): Filter => ({ alias, op: "contains", value }),
    doesNotContain: (value: any): Filter => ({ alias, op: "doesNotContain", value }),
    gt: (value: any): Filter => ({ alias, op: "gt", value }),
    lt: (value: any): Filter => ({ alias, op: "lt", value }),
    gte: (value: any): Filter => ({ alias, op: "gte", value }),
    lte: (value: any): Filter => ({ alias, op: "lte", value }),
    isEmpty: (): Filter => ({ alias, op: "isEmpty" }),
    isNotEmpty: (): Filter => ({ alias, op: "isNotEmpty" }),
    before: (value: any): Filter => ({ alias, op: "lt", value }),
    after: (value: any): Filter => ({ alias, op: "gt", value }),
  };
}

export const q = {
  /** Le mock n'utilise que les CLÉS (alias). Les valeurs (noms Airtable) sont pour Softr. */
  select: (map: Record<string, string>) => map,
  text: (alias: string) => makeCmp(alias),
  number: (alias: string) => makeCmp(alias),
  date: (alias: string) => makeCmp(alias),
  asc: (alias: string): Sort => ({ alias, dir: "asc" }),
  desc: (alias: string): Sort => ({ alias, dir: "desc" }),
};

/* ============================ Filtrage / tri ============================ */
function valToText(v: any): string {
  if (v == null) return "";
  if (Array.isArray(v))
    return v.map((x) => (x && typeof x === "object" ? x.name ?? x.filename ?? "" : x)).join(", ");
  if (typeof v === "object") return v.name ?? v.filename ?? "";
  return String(v);
}
function isEmptyVal(v: any): boolean {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "string") return v.trim() === "";
  return false;
}
function matchFilter(rec: Rec, f: Filter): boolean {
  const v = rec.fields[f.alias];
  const text = valToText(v).toLowerCase();
  const target = valToText(f.value).toLowerCase();
  switch (f.op) {
    case "is":
      return text === target;
    case "isNot":
      return text !== target;
    case "contains":
      return target === "" ? true : text.includes(target);
    case "doesNotContain":
      return !text.includes(target);
    case "gt":
      return Number(v) > Number(f.value);
    case "lt":
      return Number(v) < Number(f.value);
    case "gte":
      return Number(v) >= Number(f.value);
    case "lte":
      return Number(v) <= Number(f.value);
    case "isEmpty":
      return isEmptyVal(v);
    case "isNotEmpty":
      return !isEmptyVal(v);
    default:
      return true;
  }
}
function toArray<T>(x: T | T[] | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

/* ============================ Lecture ============================ */
export function useRecord(args: {
  from: string;
  recordId?: string;
  select?: Record<string, string>;
}): { data: Rec | null; isLoading: boolean; error: null } {
  useVersion();
  const rows = store[args.from] ?? [];
  const rec = rows.find((r) => r.id === args.recordId) ?? null;
  return { data: rec, isLoading: false, error: null };
}

export function useRecords(args: {
  from: string;
  select?: Record<string, string>;
  where?: Filter | Filter[];
  orderBy?: Sort | Sort[];
  count?: number;
}): {
  data: { pages: { items: Rec[] }[] };
  isLoading: boolean;
  error: null;
  fetchNextPage: () => void;
  hasNextPage: boolean;
} {
  useVersion();
  let rows = [...(store[args.from] ?? [])];
  const filters = toArray(args.where);
  rows = rows.filter((r) => filters.every((f) => matchFilter(r, f)));
  const sorts = toArray(args.orderBy);
  if (sorts.length) {
    rows.sort((a, b) => {
      for (const s of sorts) {
        const av = valToText(a.fields[s.alias]);
        const bv = valToText(b.fields[s.alias]);
        const cmp = av.localeCompare(bv, "fr", { numeric: true });
        if (cmp !== 0) return s.dir === "desc" ? -cmp : cmp;
      }
      return 0;
    });
  }
  if (args.count && args.count > 0) rows = rows.slice(0, args.count);
  return {
    data: { pages: [{ items: rows }] },
    isLoading: false,
    error: null,
    fetchNextPage: () => {},
    hasNextPage: false,
  };
}

/* ============================ Écriture ============================ */
type Mutation<TArg> = {
  mutate: (arg: TArg) => void;
  mutateAsync: (arg: TArg) => Promise<any>;
  isLoading: boolean;
  isPending: boolean;
};

function makeMutation<TArg>(fn: (arg: TArg) => any): Mutation<TArg> {
  return {
    mutate: (arg) => {
      fn(arg);
    },
    mutateAsync: async (arg) => fn(arg),
    isLoading: false,
    isPending: false,
  };
}

/** UPDATE : enveloppé -> mutate({ recordId, fields }).
 *  `fields` (q.select) déclare, côté Softr, les champs autorisés en écriture ;
 *  le mock l'ignore mais l'accepte pour rester iso avec l'API réelle. */
export function useRecordUpdate(args?: { from?: string; fields?: Record<string, string> }): Mutation<{
  recordId: string;
  fields: Fields;
}> {
  const from = args?.from;
  return makeMutation(({ recordId, fields }) => {
    const target = from ? [from] : Object.keys(store);
    for (const ds of target) {
      const rec = store[ds]?.find((r) => r.id === recordId);
      if (rec) {
        rec.fields = { ...rec.fields, ...fields };
        emit();
        return rec;
      }
    }
    return null;
  });
}

/** CREATE : enveloppé -> mutate({ fields }) (pas de recordId, il est généré).
 *  Symétrique de useRecordUpdate. `fields` sont indexés par ALIAS (mêmes clés
 *  que le q.select), comme pour l'update. Le mock pousse un nouvel enregistrement
 *  dans store[from] et renvoie { id, fields } (mutateAsync -> record créé).
 *  ⚠️ Signature à valider contre l'API Softr réelle (onglet Chat du bloc). */
let createSeq = 0;
/** CREATE (réel Softr) : mutate(fieldsParAlias) DIRECT — PAS d'enveloppe { fields }
 *  (contrairement à update qui est { recordId, fields }). Le mock reflète cette
 *  signature : l'argument EST l'objet de champs (clés = alias du q.select). */
export function useRecordCreate(args?: { from?: string; fields?: Record<string, string> }): Mutation<Fields> {
  const from = args?.from;
  return makeMutation((fields) => {
    if (!from) return null;
    const rec: Rec = { id: `rec_mock_${++createSeq}`, fields: { ...fields } };
    (store[from] ??= []).push(rec);
    emit();
    return rec;
  });
}

export default datasource;
