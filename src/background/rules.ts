import { PRIVACY_PASS_API_REPLAY_HEADER } from './const';

// First size digits of md5 of 'privacy-pass-extension-identification' as integer
export const PRIVACY_PASS_EXTENSION_RULE_OFFSET = 11943591;
export function getRuleID(x: number) {
    return PRIVACY_PASS_EXTENSION_RULE_OFFSET + x;
}

const RULE_IDS = {
    IDENTIFICATION: getRuleID(1),
    AUTHORIZATION: getRuleID(2),
    REPLAY: getRuleID(3),
    REDIRECT: getRuleID(4),
};

const EXTENSION_SUPPORTED_RESOURCE_TYPES = chrome.declarativeNetRequest
    ? [
          chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
          chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
          chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
      ]
    : [];

export function getIdentificationRule(url: string): chrome.declarativeNetRequest.UpdateRuleOptions {
    // TODO: convert to static rule for simplicity perhaps?
    return {
        removeRuleIds: [RULE_IDS.IDENTIFICATION],
        addRules: [
            {
                action: {
                    type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
                    responseHeaders: [
                        // Use Server-Timimg header because Set-Cookie is unreliable in this context in Chrome
                        {
                            header: 'Server-Timing',
                            operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                            value: 'PrivacyPassExtensionV; desc=4',
                        },
                    ],
                },
                condition: {
                    urlFilter: new URL(url).toString(),
                    resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
                },
                id: RULE_IDS.IDENTIFICATION,
                priority: 1,
            },
        ],
    };
}

export function getAuthorizationRule(
    url: string,
    authorizationHeader: string,
): chrome.declarativeNetRequest.UpdateRuleOptions {
    return {
        removeRuleIds: [RULE_IDS.AUTHORIZATION],
        addRules: [
            {
                id: RULE_IDS.AUTHORIZATION,
                priority: 1,
                action: {
                    type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
                    requestHeaders: [
                        {
                            header: 'Authorization',
                            operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                            value: authorizationHeader,
                        },
                    ],
                },
                condition: {
                    // Note: The urlFilter must be composed of only ASCII characters.
                    urlFilter: new URL(url).toString(),
                    resourceTypes: EXTENSION_SUPPORTED_RESOURCE_TYPES,
                },
            },
        ],
    };
}

export function removeAuthorizationRule(): chrome.declarativeNetRequest.UpdateRuleOptions {
    return {
        removeRuleIds: [RULE_IDS.AUTHORIZATION],
    };
}

export function getReplayRule(
    replayHeader: string,
): chrome.declarativeNetRequest.UpdateRuleOptions {
    return {
        removeRuleIds: [RULE_IDS.REPLAY],
        addRules: [
            {
                id: RULE_IDS.REPLAY,
                priority: 10,
                action: {
                    type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
                    responseHeaders: [
                        {
                            header: PRIVACY_PASS_API_REPLAY_HEADER,
                            operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                            value: replayHeader,
                        },
                    ],
                },
                condition: {
                    // Chrome declarativeNetRequest have to be defined before the request is made. Given a PP request can be made from any URL, returning a responseID for all URLs is required.
                    urlFilter: '*',
                    resourceTypes: EXTENSION_SUPPORTED_RESOURCE_TYPES,
                },
            },
        ],
    };
}

export function getRedirectRule(
    urlFilter: string,
    redirectURL: string,
): chrome.declarativeNetRequest.UpdateRuleOptions {
    return {
        removeRuleIds: [RULE_IDS.REDIRECT],
        addRules: [
            {
                id: RULE_IDS.REDIRECT,
                priority: 5,
                action: {
                    type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
                    redirect: { url: redirectURL },
                },
                condition: {
                    urlFilter,
                    resourceTypes: EXTENSION_SUPPORTED_RESOURCE_TYPES,
                },
            },
        ],
    };
}
