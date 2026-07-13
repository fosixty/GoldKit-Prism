import Store from 'electron-store'
import type { Preferences } from '../shared/types'
import { DEFAULT_PREFERENCES } from '../shared/constants'
import { validatePreferencesPartial } from './security/preferences'

const store = new Store<Preferences>({
  name: 'prism-preferences',
  defaults: DEFAULT_PREFERENCES,
})

export function getPreferences(): Preferences {
  return { ...DEFAULT_PREFERENCES, ...store.store }
}

export function setPreferences(partial: Partial<Preferences>): Preferences {
  const validated = validatePreferencesPartial(partial)
  for (const [key, value] of Object.entries(validated)) {
    if (value !== undefined) {
      store.set(key as keyof Preferences, value)
    }
  }
  return getPreferences()
}
