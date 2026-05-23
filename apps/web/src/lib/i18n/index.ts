/**
 * Tiny i18n facade. Today this is a Persian-only shim — every other
 * locale would route through the same `t` helper, but we ship a single
 * dictionary for now to avoid premature complexity.
 *
 * Usage:
 *   import { t } from '@/lib/i18n';
 *   <h1>{t.auth.login.title}</h1>
 *   <p>{t.dashboard.hero.greeting(user.displayName)}</p>
 */
export { fa as t } from './fa';
export type { FaDict } from './fa';
export { translateServerError } from './server-errors';
