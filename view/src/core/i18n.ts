import i18next from 'i18next';
import en from '@/locales/en.json';
import { appSettings } from './settings.js';
import { normalizeLanguageCode } from '@/utils/localeUtils.js';

i18next.init({
    lng: 'en',
    fallbackLng: 'en',
    resources: {
        en: { translation: en }
    },
    interpolation: {
        escapeValue: false 
    }
});

export function loadExternalLocales(localesObj?: Record<string, any>) {
    if (!localesObj) return;
    for (const [lang, resources] of Object.entries(localesObj)) {
        i18next.addResourceBundle(lang, 'translation', resources, true, true);
    }
}

export async function initI18n(initialGameLanguage?: string) {
    let langCode = initialGameLanguage || 'en';
    langCode = normalizeLanguageCode(langCode);
    const defaultLanguage = appSettings.language || langCode;
    if (i18next.language !== defaultLanguage) {
        await changeLanguage(defaultLanguage);
    } else {
        applyFormattingOptions();
        window.dispatchEvent(new Event('languageChanged'));
    }
}

export function t(key: string, options?: any): string {
    return i18next.t(key, options) as string;
}

export function applyFormattingOptions() {
    const disableBold = String(i18next.t('settings.disableBold'));
    if (disableBold === 'true') {
        document.body.classList.add('disable-bold');
    } else {
        document.body.classList.remove('disable-bold');
    }

    const disableCondensed = String(i18next.t('settings.disableCondensed'));
    if (disableCondensed === 'true') {
        document.body.classList.add('disable-condensed');
    } else {
        document.body.classList.remove('disable-condensed');
    }
}

export async function changeLanguage(lng: string) {
    await i18next.changeLanguage(lng);
    applyFormattingOptions();
    window.dispatchEvent(new Event('languageChanged'));
}
