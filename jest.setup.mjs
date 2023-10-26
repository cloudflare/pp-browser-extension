// Mocking crypto with Node WebCrypto API.
import { webcrypto } from 'node:crypto';

if (typeof crypto === 'undefined') {
    global.crypto = webcrypto;
}

if (typeof chrome === 'undefined') {
    global.chrome = {
        declarativeNetRequest: {
            ResourceType: {
                MAIN_FRAME: 'main_frame',
                SUB_FRAME: 'sub_frame',
                XMLHTTPREQUEST: 'xmlhttprequest',
            },
        },
    };
}
