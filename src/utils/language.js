/**
 * Utility functions for multi-language text resolution across the application.
 */

export const getLocalizedName = (item, language) => {
  if (!item) return '';
  if (language === 'en') {
    return item.nameEn || item.name || item.id || item.itemId || '';
  }
  return item.name || item.nameEn || item.id || item.itemId || '';
};

export const getLocalizedDesc = (item, language) => {
  if (!item) return '';
  if (language === 'en') {
    return item.descriptionEn || item.descEn || item.description || item.desc || '';
  }
  return item.description || item.desc || item.descriptionEn || item.descEn || '';
};

export const getLocalizedText = (textZh, textEn, language) => {
  if (language === 'en') {
    return textEn || textZh || '';
  }
  return textZh || textEn || '';
};
