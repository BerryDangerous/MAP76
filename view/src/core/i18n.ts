export async function initI18n(initialGameLanguage?: string) {
    let retries = 0;
    while (!window.PrismaL10N && retries < 10) {
        await new Promise(r => setTimeout(r, 10));
        retries++;
    }
    
    applyFormattingOptions();
    window.dispatchEvent(new Event('languageChanged'));
}

export function t(key: string, options?: any): string {
    if (window.PrismaL10N && window.PrismaL10N.t) {
        return window.PrismaL10N.t(key, options);
    }
    return key;
}

export function applyFormattingOptions() {
    const disableBold = String(t('settings.disableBold'));
    if (disableBold === 'true') {
        document.body.classList.add('disable-bold');
    } else {
        document.body.classList.remove('disable-bold');
    }

    const disableCondensed = String(t('settings.disableCondensed'));
    if (disableCondensed === 'true') {
        document.body.classList.add('disable-condensed');
    } else {
        document.body.classList.remove('disable-condensed');
    }
}
