export const SETTING_NAMES = {
    SERVICE_WORKER_MODE: 'serviceWorkerMode',
    ATTESTERS: 'attesters',
} as const;
export type SettingsKeys = (typeof SETTING_NAMES)[keyof typeof SETTING_NAMES];
export type RawSettings = {
    serviceWorkerMode: SERVICE_WORKER_MODE;
    attesters: string;
};

export type Settings = {
    serviceWorkerMode: SERVICE_WORKER_MODE;
    attesters: string[];
};

let settings: Settings = {} as unknown as Settings;

export const rawSettingToSettingAttester = (attestersRaw: string): string[] => {
    return attestersRaw
        .split(/[\n,]+/) // either split on new line or comma
        .filter((attester) => {
            try {
                new URL(attester);
                return true;
            } catch (_) {
                return false;
            }
        });
};

export function getRawSettings(storage: chrome.storage.StorageArea): Promise<RawSettings> {
    return new Promise((resolve) =>
        storage.get(Object.values(SETTING_NAMES), async (items) => {
            if (Object.entries(items).length < 2) {
                await resetSettings(storage);
                const settings = getSettings();
                resolve({
                    attesters: settings.attesters.join('\n'),
                    serviceWorkerMode: settings.serviceWorkerMode,
                });
            } else {
                const rawSettings = items as unknown as RawSettings;
                settings = {
                    serviceWorkerMode: rawSettings.serviceWorkerMode,
                    attesters: rawSettingToSettingAttester(rawSettings.attesters),
                };
                resolve(rawSettings);
            }
        }),
    );
}

export function getSettings(): Settings {
    return settings;
}

export function saveSettings(
    storage: chrome.storage.StorageArea,
    name: SettingsKeys,
    value: string,
): Promise<void> {
    switch (name) {
        case 'attesters':
            settings[name] = rawSettingToSettingAttester(value);
            break;
        case 'serviceWorkerMode':
            if (
                Object.values(SERVICE_WORKER_MODE)
                    .map((s) => s as string)
                    .includes(value)
            ) {
                settings[name] = value as SERVICE_WORKER_MODE;
            }
    }
    return storage.set({ [name]: value });
}

export async function resetSettings(storage: chrome.storage.StorageArea): Promise<void> {
    const DEFAULT = {
        serviceWorkerMode: SERVICE_WORKER_MODE.PRODUCTION,
        attesters: [
            'https://pp-attester-turnstile.research.cloudflare.com',
            'https://pp-attester-turnstile-dev.research.cloudflare.com',
        ],
    };
    await saveSettings(storage, 'serviceWorkerMode', DEFAULT.serviceWorkerMode);
    await saveSettings(storage, 'attesters', DEFAULT.attesters.join('\n'));
}

export const SERVICE_WORKER_MODE = {
    PRODUCTION: 'production',
    DEVELOPMENT: 'development',
    DEMO: 'demo',
} as const;
export type SERVICE_WORKER_MODE = (typeof SERVICE_WORKER_MODE)[keyof typeof SERVICE_WORKER_MODE];
