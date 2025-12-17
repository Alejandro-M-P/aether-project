import { atom } from "nanostores";

export const searchQuery = atom("");
export const isLoggedIn = atom(false);
export const draftMessage = atom("");
export const mapKey = atom(0);
export const fetchTrigger = atom(0);
export const availableCategories = atom([]);
export const isPickingLocation = atom(false);
export const pickedCoordinates = atom(null);
