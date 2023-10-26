export const BROWSERS = {
    CHROME: 'Chrome',
    FIREFOX: 'Firefox',
    EDGE: 'Edge',
} as const;
export type BROWSERS = (typeof BROWSERS)[keyof typeof BROWSERS];

export const PRIVACY_PASS_API_REPLAY_HEADER = 'private-token-client-replay';
export const PRIVACY_PASS_API_REPLAY_URI = 'https://no-reply.private-token.research.cloudflare.com';

export const STORAGE_ID_ATTESTER_CONFIGURATION = 'attesters_by_issuer_key';
