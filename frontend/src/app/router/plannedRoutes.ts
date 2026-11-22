// Modules planned for later phases. Each path renders the shared ComingSoonPage (D-085) until its phase ships;
// when a module is built, its route moves into the feature's routes.tsx and its entry is removed here.

/** Routes of modules planned for later phases (title, phase). */
export const COMING_SOON_ROUTES: readonly { path: string; title: string; phase: number }[] = [
  { path: "subscription", title: "الاشتراك", phase: 11 },
];
