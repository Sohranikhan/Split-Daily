import { router, type Href } from "expo-router";

/** Navigation helpers for dynamic paths (typed routes can't see ids built at runtime). */
export const go = (path: string) => router.push(path as Href);
export const replace = (path: string) => router.replace(path as Href);
export const back = (fallback = "/(tabs)") => (router.canGoBack() ? router.back() : router.replace(fallback as Href));
