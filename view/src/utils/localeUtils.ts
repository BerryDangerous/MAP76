import i18next from 'i18next';

// Maps non-standard engine language codes to standard ISO 639 codes (e.g., 'cn' -> 'zh-CN')
const engineLanguageMap: Record<string, string> = {
    'cn': 'zh-CN',
    'zh': 'zh-CN',
    'zh-hans': 'zh-CN',
    'tw': 'zh-TW',
    'zh-hant': 'zh-TW',
    'por': 'pt-BR',
    'pt': 'pt-BR',
    'pt-pt': 'pt-BR',
    'sp': 'es',
    'es-la': 'es-MX',
    'mx': 'es-MX',
    'fr-ca': 'fr',
    'fr-fr': 'fr',
    'jp': 'ja',
    'jap': 'ja',
    'ru-ru': 'ru',
    'pl-pl': 'pl',
    'ger': 'de',
    'de-de': 'de',
    'it-it': 'it',
    'ar-sa': 'ar'
};

export function normalizeLanguageCode(code: string): string {
    if (!code) return 'en';
    const lower = code.toLowerCase().trim();
    
    for (const [key, val] of Object.entries(engineLanguageMap)) {
        if (key.toLowerCase() === lower) {
            return val;
        }
    }
    
    const prefix = lower.split('-')[0];
    for (const [key, val] of Object.entries(engineLanguageMap)) {
        if (key.toLowerCase() === prefix) {
            return val;
        }
    }

    return code;
}

export function getAvailableLanguages(): Array<{label: string, value: string}> {
    const options: Array<{label: string, value: string}> = [];
    const resources = i18next.options.resources;
    if (!resources) return [{ label: 'English', value: 'en' }];
    
    for (const [langKey, bundle] of Object.entries(resources)) {
        const translation = (bundle as any).translation || {};
        const settings = translation.settings || {};
        const label = settings.languageName || langKey;
        options.push({ label, value: langKey });
    }
    
    return options.sort((a, b) => a.label.localeCompare(b.label));
}
