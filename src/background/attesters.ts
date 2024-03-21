export { refreshAttesterLookupByIssuerKey } from '../common';
import { STORAGE_ID_ATTESTER_CONFIGURATION } from './const';

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
