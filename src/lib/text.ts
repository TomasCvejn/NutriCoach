// Case- and diacritics-insensitive matching: "sarka" finds "Šárka".
export const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
