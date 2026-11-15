/** People and places the AI marks in its answers (ticket 839c4446): [[Wikipedia title|shown text]] or [[Title]]. */
export const ENTITY = /\[\[([^\]|\n]{1,80})(?:\|([^\]\n]{1,80}))?\]\]/g;
export const stripEntities = (s: string) => s.replace(ENTITY, (_, t: string, shown?: string) => shown ?? t);
