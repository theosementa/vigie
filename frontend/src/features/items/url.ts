export const looksLikeUrl = (v: string) => /^https?:\/\/\S+$/i.test(v) || /^[^\s/]+\.[^\s/]{2,}(\/\S*)?$/.test(v)
