import { PRIVACY_PASS_API_REPLAY_URI } from './const';
import { getRedirectRule, getReplayRule } from './rules';
import { isManifestV3 } from './util';

export const REPLAY_STATE = {
    FULFILLED: 'fulfilled',
    NOT_FOUND: 'not-found',
    PENDING: 'pending',
} as const;
export type REPLAY_STATE = (typeof REPLAY_STATE)[keyof typeof REPLAY_STATE];

export const getRequestID = (() => {
    let requestID = crypto.randomUUID();

    return () => {
        const oldRequestID = requestID;
        requestID = crypto.randomUUID();
        if (isManifestV3(chrome)) {
            chrome.declarativeNetRequest.updateSessionRules(getReplayRule(requestID));
        }
        return oldRequestID;
    };
})();

type UUID = ReturnType<typeof crypto.randomUUID>;

export const setReplayDomainRule = (state: REPLAY_STATE, requestID?: UUID) => {
    if (!chrome.declarativeNetRequest) {
        return;
    }
    const filterSuffix = requestID ? `/requestID/${requestID}` : '/*';
    const urlFilter = `${PRIVACY_PASS_API_REPLAY_URI}${filterSuffix}`;

    chrome.declarativeNetRequest.updateSessionRules(
        getRedirectRule(urlFilter, `data:text/plain,${state}`),
    );
};
