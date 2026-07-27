/**
 * MOCK de @/lib/user fourni par Softr.
 * En prod, useCurrentUser() renvoie l'utilisateur Softr connecté (dans l'iframe,
 * window.logged_in_user n'existe PAS -> on passe toujours par ce hook).
 *
 * NB : en prod, `name` est SOUVENT vide (Softr ne le remplit pas toujours) — Block.tsx
 * se replie alors sur l'e-mail pour dériver le prénom du héro. On met ici un `name`
 * réaliste pour pouvoir tester ce chemin en local (USE_MOCK=false).
 */
export type CurrentUser = {
  id: string;
  email: string;
  name: string;
};

export function useCurrentUser(): CurrentUser {
  return {
    id: "usr_dev_local",
    email: "romain@sunlib.fr",
    name: "Frédéric Martin",
  };
}
