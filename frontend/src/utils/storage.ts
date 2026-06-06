const PREFIX = 'flowmind:'

export const storage = {
  get: <T>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(PREFIX + key)
      if (item === null) {
        return defaultValue
      }
      return JSON.parse(item)
    } catch (e) {
      console.error('Failed to get from storage:', key, e)
      return defaultValue
    }
  },

  set: (key: string, value: unknown): void => {
    try {
      const serialized = JSON.stringify(value)
      localStorage.setItem(PREFIX + key, serialized)
    } catch (e) {
      console.error('Failed to save to storage:', key, e)
    }
  },

  remove: (key: string): void => {
    localStorage.removeItem(PREFIX + key)
  },

  clear: (): void => {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k))
  },
}
