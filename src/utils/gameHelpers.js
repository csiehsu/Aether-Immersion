/**
 * Utility functions for game entity icons, item fallbacks, and formatting.
 */

const NPC_ICON_MAP = {
  Seagull: '🕊️',
  Crab: '🦀',
  Jellyfish: '🪼',
  Garrick: '👨‍🍳',
  Martha: '🛒',
  Vance: '🎣',
  Corinne: '👩‍🌾',
  Brock: '⛏️',
};

export const getNpcIcon = (npc) => {
  if (!npc) return '🐾';
  if (npc.icon) return npc.icon;
  const npcId = npc.npcId || npc.id;
  return NPC_ICON_MAP[npcId] || '🐾';
};

export const getItemIcon = (item, defaultIcon = '🐟') => {
  if (!item) return defaultIcon;
  return item.icon || defaultIcon;
};
