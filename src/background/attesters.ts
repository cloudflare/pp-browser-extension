import { getSettings } from '../common';
import { STORAGE_ID_ATTESTER_CONFIGURATION } from './const';
import { getLogger } from './logger';

import { IssuerConfig } from '@cloudflare/privacypass-ts';

// return an attester challenge URI based on the public key presented in 401 response
export const keyToAttesterURI = async (
    storage: chrome.storage.StorageArea,
    key: string,
): Promise<string | undefined> => {
    // get attester hostname that corresponds to this key
    const storageItem: Record<string, Record<string, string>> = await new Promise((resolve) =>
        storage.get([STORAGE_ID_ATTESTER_CONFIGURATION], resolve),
    );

    const attestersByIssuerKey: Record<string, string> =
        storageItem[STORAGE_ID_ATTESTER_CONFIGURATION];

    return attestersByIssuerKey[key];
};

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
