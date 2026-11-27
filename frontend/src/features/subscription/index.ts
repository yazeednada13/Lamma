// Public API of the subscription feature (Phase 11-II): status display, banners, the subscription page and read-only UX.
export { TRIAL_LENGTH_DAYS, trialStatus, type TrialStatus } from "./trial";
export { SidebarBusinessCard } from "./components/SidebarBusinessCard";
export { SidebarTrialCard } from "./components/SidebarTrialCard";
export { TrialBanner } from "./components/TrialBanner";
export { ReadOnlyWatcher } from "./components/ReadOnlyWatcher";
export { subscriptionRoutes } from "./routes";
export { STATUS_LABEL, STATUS_TONE, PLAN_LABEL, dateLabel, daysText, statusDetail, statusLine, type SubscriptionStatus } from "./domain/subscriptionDomain";
