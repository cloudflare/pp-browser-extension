import { keyToAttesterURI, refreshAttesterLookupByIssuerKey } from './attesters';
import { SERVICE_WORKER_MODE, getRawSettings, getSettings } from '../common';
import { BROWSERS, PRIVACY_PASS_API_REPLAY_HEADER, PRIVACY_PASS_API_REPLAY_URI } from './const';
import { getLogger } from './logger';
import { fetchPublicVerifToken } from './pubVerifToken';
import { REPLAY_STATE, getRequestID, setReplayDomainRule } from './replay';
import { getAuthorizationRule, getIdentificationRule, removeAuthorizationRule } from './rules';
import { QueryablePromise, isManifestV3, promiseToQueryable, uint8ToB64URL } from './util';

import { PrivateToken, TOKEN_TYPES } from '@cloudflare/privacypass-ts';

export { BROWSERS, PRIVACY_PASS_API_REPLAY_URI } from './const';

interface SessionCachedData {
    [key: string]: UrlOriginTabs;
}

interface UrlOriginTabs {
    [key: number]: OriginAttesterTabDetails;
}

interface OriginAttesterTabDetails {
    attesterTabId: number;
    attestationData: string;
}

const PENDING = REPLAY_STATE.PENDING;
type PENDING = typeof PENDING;
const TOKENS: Record<string, string | PENDING> = {};

const cachedTabs: Record<number, chrome.tabs.Tab> = {};

export const headerToToken = async (
    url: string,
    tabId: number,
    header: string,
    storage: chrome.storage.StorageArea,
): Promise<string | undefined> => {
    const { serviceWorkerMode: mode } = getSettings();
    const logger = getLogger(mode);

    const tokenDetails = PrivateToken.parse(header);
    if (tokenDetails.length === 0) {
        return undefined;
    }

    const td = tokenDetails.slice(-1)[0];
    switch (td.challenge.tokenType) {
        case TOKEN_TYPES.BLIND_RSA.value:
            logger.debug(`type of challenge: ${td.challenge.tokenType} is supported`);

            // Slow down if demo
            if (mode === SERVICE_WORKER_MODE.DEMO) {
                await new Promise((resolve) => setTimeout(resolve, 5 * 1000));
            }

            const tokenPublicKey: string = uint8ToB64URL(td.tokenKey);

            let attesterURI = await keyToAttesterURI(storage, tokenPublicKey);
            if (!attesterURI) {
                return undefined;
            }

            // API expects interactive Challenge at /challenge
            attesterURI = `${attesterURI}/challenge`;

            const tab: chrome.tabs.Tab = await new Promise((resolve) =>
                chrome.tabs.create({ url: attesterURI }, resolve),
            );

            // save this new tabId of attester tab to session storage under the originTabId

            const existing: SessionCachedData = await new Promise((resolve) =>
                storage.get(url, resolve),
            );

            if (existing[url][tabId]) {
                existing[url][tabId]['attesterTabId'] = tab.id!;
                storage.set({ [url]: existing[url] });
            }

            const token = await fetchPublicVerifToken(td, tabId, storage);

            const encodedToken = uint8ToB64URL(token.serialize());

            return encodedToken;

        default:
            logger.error(`unrecognized type of challenge: ${td.challenge.tokenType}`);
    }
    return undefined;
};

export const handleInstall =
    (storage: chrome.storage.StorageArea) => async (_details: chrome.runtime.InstalledDetails) => {
        const { serviceWorkerMode: mode } = await getRawSettings(storage);
        const logger = getLogger(mode);

        if (isManifestV3(chrome)) {
            chrome.declarativeNetRequest
                .updateSessionRules(removeAuthorizationRule())
                .catch((e: unknown) => logger.debug(`failed to remove session rules:`, e));
        }

        // Refresh lookup of attester by issuer key lookup used for auto selection of attester
        refreshAttesterLookupByIssuerKey(storage);
        getRequestID();
        setReplayDomainRule(REPLAY_STATE.NOT_FOUND);
    };

const pendingRequests: Map<string, QueryablePromise<void>> = new Map();

export const handleBeforeRequest = () => (details: chrome.webRequest.WebRequestBodyDetails) => {
    const settings = getSettings();
    const { serviceWorkerMode: mode } = settings;
    const logger = getLogger(mode);
    try {
        chrome.tabs.get(details.tabId, (tab) => (cachedTabs[details.tabId] = tab));
    } catch (err) {
        logger.debug(err);
    }

    // Handle active replay without generating a network request
    const url = new URL(details.url);
    if (url.origin !== PRIVACY_PASS_API_REPLAY_URI) {
        return;
    }
    const labels = url.pathname.split('/');
    if (labels.length !== 2 || labels[0] !== '' || labels[1] !== 'requestID') {
        return { redirectUrl: `data:text/plain,${REPLAY_STATE.NOT_FOUND}` };
    }

    const requestID = labels[2];
    const promise = pendingRequests.get(requestID);
    let state: REPLAY_STATE = REPLAY_STATE.NOT_FOUND;
    if (promise?.isFullfilled) {
        state = REPLAY_STATE.FULFILLED;
        pendingRequests.delete(requestID);
    }
    if (promise?.isPending) {
        state = REPLAY_STATE.PENDING;
    }
    return {
        redirectUrl: `data:text/plain,${state}`,
    };
};

export const handleBeforeSendHeaders =
    (storage: chrome.storage.StorageArea) =>
    (
        details: chrome.webRequest.WebRequestHeadersDetails,
    ): void | chrome.webRequest.BlockingResponse => {
        if (!details) {
            return;
        }

        const ppToken = TOKENS[details.url];
        if (ppToken === PENDING) {
            return;
        }
        if (ppToken && !chrome.declarativeNetRequest) {
            const headers = details.requestHeaders ?? [];
            headers.push({ name: 'Authorization', value: `PrivateToken token=${ppToken}` });
            delete TOKENS[details.url];
            return { requestHeaders: headers };
        }

        if (!details.requestHeaders) {
            return;
        }

        if (details.requestHeaders && details.url) {
            // check for an attestation data sent from attester
            const pp_hdr = details.requestHeaders.find(
                (x) => x.name.toLowerCase() === 'private-token-attester-data',
            )?.value;
            if (pp_hdr) {
                const callback = (url_tab_data: SessionCachedData) => {
                    // if we opened an attesterTab that matches the source of this data then store it
                    lookForAttesterTabId: for (const url in url_tab_data) {
                        for (const originTab of Object.values(url_tab_data[url])) {
                            const tabDetails: OriginAttesterTabDetails = originTab;
                            if (
                                tabDetails.attesterTabId &&
                                tabDetails.attesterTabId === details.tabId
                            ) {
                                originTab.attestationData = pp_hdr;
                                storage.set(url_tab_data);
                                // break to label above
                                break lookForAttesterTabId;
                            }
                        }
                    }
                };

                storage.get(null, callback);
            }
        }

        if (isManifestV3(chrome)) {
            const { serviceWorkerMode: mode } = getSettings();
            const logger = getLogger(mode);
            chrome.declarativeNetRequest
                .updateSessionRules(removeAuthorizationRule())
                .catch((e: unknown) => logger.debug(`failed to remove session rules:`, e));
        }

        return;
    };

export const handleHeadersReceived =
    (browser: BROWSERS, storage: chrome.storage.StorageArea) =>
    (
        details: chrome.webRequest.WebResponseHeadersDetails & {
            frameAncestors?: Array<{ url: string }>;
        },
    ): void | chrome.webRequest.BlockingResponse => {
        // if no header were received with request
        if (!details.responseHeaders) {
            return;
        }

        // Check if there's a valid PrivateToken header
        const privateTokenChl = details.responseHeaders.find(
            (x) => x.name.toLowerCase() == 'www-authenticate',
        )?.value;
        if (!privateTokenChl) {
            return;
        }
        if (PrivateToken.parse(privateTokenChl).length === 0) {
            return;
        }

        const settings = getSettings();
        if (Object.keys(settings).length === 0) {
            getRawSettings(storage);
            return;
        }
        const { attesters, serviceWorkerMode: mode } = settings;
        const logger = getLogger(mode);

        let initiator: string | undefined = undefined;
        if (details.frameId === 0) {
            initiator = details.url;
        } else {
            initiator =
                details.frameAncestors?.at(0)?.url ??
                cachedTabs[details.tabId]?.url ??
                details.initiator;
        }
        if (!initiator) {
            return;
        }
        const initiatorURL = new URL(initiator)?.origin;
        const isAttesterFrame = attesters.map((a) => new URL(a).origin).includes(initiatorURL);
        if (isAttesterFrame) {
            logger.info('PrivateToken support disabled on attester websites.');
            return;
        }

        if (TOKENS[details.url] === PENDING) {
            return;
        }

        if (isManifestV3(chrome)) {
            // TODO: convert to static rule for simplicity perhaps?
            chrome.declarativeNetRequest.updateSessionRules(getIdentificationRule(details.url));
        }

        // create a new entry storing this originTabId
        storage.get(details.url, (existing: UrlOriginTabs) => {
            existing[details.tabId] = { attesterTabId: -1, attestationData: '' };
            storage.set({ [details.url]: existing });
        });

        // turn this received header into a token (tab opening and attester handling within here)
        const w3HeaderValue = headerToToken(details.url, details.tabId, privateTokenChl, storage);

        // Add a rule to declarativeNetRequest here if you want to block
        // or modify a header from this request. The rule is registered and
        // changes are observed between the onBeforeSendHeaders and
        // onSendHeaders methods.
        if (!chrome.declarativeNetRequest) {
            TOKENS[details.url] = PENDING;
        }
        const redirectPromise = w3HeaderValue
            .then(async (value): Promise<void | chrome.webRequest.BlockingResponse> => {
                if (value === null) {
                    delete TOKENS[details.url];
                    return;
                }
                if (isManifestV3(chrome)) {
                    await chrome.declarativeNetRequest.updateSessionRules(
                        getAuthorizationRule(details.url, `PrivateToken token=${value}`),
                    );
                } else {
                    if (value) {
                        TOKENS[details.url] = value;
                    }
                }

                return { redirectUrl: details.url };
            })
            .catch((err) => {
                logger.error(`failed to retrieve PrivateToken token: ${err}`);
            });

        switch (browser) {
            case BROWSERS.FIREFOX:
                // typing is incorrect, but force it for Firefox because browser is compatible
                return redirectPromise as unknown as chrome.webRequest.BlockingResponse;
            case BROWSERS.CHROME:
                // Refresh tab in chrome.
                const requestID = getRequestID();
                setReplayDomainRule('pending', requestID);
                pendingRequests.set(
                    requestID,
                    promiseToQueryable(
                        redirectPromise.then(() => {
                            setReplayDomainRule(REPLAY_STATE.FULFILLED, requestID);
                        }),
                    ),
                );
                // Detect call context, and only refresh if it's a top level request
                redirectPromise.then(async () => {
                    if (details.type === 'main_frame') {
                        chrome.tabs.update(details.tabId, { url: details.url });
                    }
                });
                const responseHeaders = details.responseHeaders ?? [];
                responseHeaders.push({ name: PRIVACY_PASS_API_REPLAY_HEADER, value: requestID });
                return {
                    responseHeaders,
                };
        }
    };
