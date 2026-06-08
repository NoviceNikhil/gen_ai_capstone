/**
 * Returns a professional portrait URL for a provider.
 * Uses realistic photos from randomuser.me to maintain a professional look.
 * Note: There are 200 unique photos available, so some duplication will occur in large datasets.
 * 
 * @param {string} providerId 
 * @param {string} specialty 
 * @returns {string} Portrait URL
 */
export function getProviderPortrait(providerId, specialty = "", name = "") {
  if (name && name.trim().length > 0) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=200&font-size=0.35&bold=true`;
  }
  
  if (specialty && specialty.trim().length > 0) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(specialty)}&background=random&size=200&font-size=0.35&bold=true`;
  }

  return `https://ui-avatars.com/api/?name=${encodeURIComponent("Provider")}&background=random&size=200&font-size=0.35&bold=true`;
}
