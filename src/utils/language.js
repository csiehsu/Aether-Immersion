/**
 * Utility functions for multi-language text resolution across the application.
 */

/**
 * 依據目前語系取得物品、地點或 NPC 的在地化名稱。
 * @param {Object} item - 包含 name、nameEn、id 或 itemId 的物件。
 * @param {string} language - 語系代碼（'zh-TW' 或 'en'）。
 * @returns {string} 在地化名稱字串。
 */
export const getLocalizedName = (item, language) => {
  if (!item) return '';
  if (language === 'en') {
    return item.nameEn || item.name || item.id || item.itemId || '';
  }
  return item.name || item.nameEn || item.id || item.itemId || '';
};

/**
 * 依據目前語系取得物品、地點或 NPC 的在地化說明文字。
 * @param {Object} item - 包含 description、descriptionEn、desc 或 descEn 的物件。
 * @param {string} language - 語系代碼（'zh-TW' 或 'en'）。
 * @returns {string} 在地化說明文字字串。
 */
export const getLocalizedDesc = (item, language) => {
  if (!item) return '';
  if (language === 'en') {
    return item.descriptionEn || item.descEn || item.description || item.desc || '';
  }
  return item.description || item.desc || item.descriptionEn || item.descEn || '';
};

/**
 * 依據目前語系在中文文字與英文文字之間選擇對應字串。
 * @param {string} textZh - 中文文字。
 * @param {string} textEn - 英文文字。
 * @param {string} language - 語系代碼（'zh-TW' 或 'en'）。
 * @returns {string} 選擇後的在地化字串。
 */
export const getLocalizedText = (textZh, textEn, language) => {
  if (language === 'en') {
    return textEn || textZh || '';
  }
  return textZh || textEn || '';
};

