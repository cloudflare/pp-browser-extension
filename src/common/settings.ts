import { IssuerConfig } from '@cloudflare/privacypass-ts';
import { STORAGE_ID_ATTESTER_CONFIGURATION } from './const';
import { getLogger } from './logger';

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
            } catch {
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

export const refreshAttesterLookupByIssuerKey = async (storage: chrome.storage.StorageArea) => {
    // Force reset associations between public keys and issuers that trust each attester that we know about
    const attestersByIssuerKey = new Map<string, string>();

    const { attesters, serviceWorkerMode: mode } = getSettings();
    const logger = getLogger(mode);

    // Populate issuer keys for issuers that trust our ATTESTERS
    for (const attester of attesters) {
        const nowTimestamp = Date.now();

        // Connect to each of the ATTESTERS we know about for their issuer directory
        const response = await fetch(`${attester}/v1/private-token-issuer-directory`);
        if (!response.ok) {
            logger.log(`"${attester}" issuer keys not available, attester will not be used.`);
            return;
        }

        const directory: Record<string, IssuerConfig> = await response.json();
        // for each attester in the directory
        for (const { 'token-keys': tokenKeys } of Object.values(directory)) {
            for (const key of tokenKeys) {
                const notBefore = key['not-before'];
                if (!notBefore || notBefore > nowTimestamp) {
                    continue;
                }
                attestersByIssuerKey.set(key['token-key'], attester);
            }
        }
        storage.set({
            [STORAGE_ID_ATTESTER_CONFIGURATION]: Object.fromEntries(attestersByIssuerKey),
        });
    }

    logger.info('Attester lookup by Issuer key populated');
};

export async function saveSettings(
    storage: chrome.storage.StorageArea,
    name: SettingsKeys,
    value: string,
): Promise<void> {
    switch (name) {
        case 'attesters':
            settings[name] = rawSettingToSettingAttester(value);
            await refreshAttesterLookupByIssuerKey(storage);
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
