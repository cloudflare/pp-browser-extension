import { Client, PrivateToken, Token, TokenResponse } from '@cloudflare/privacypass-ts';

export async function fetchPublicVerifToken(
    privateToken: PrivateToken,
    originTabId: number,
    storage: chrome.storage.StorageArea,
): Promise<Token> {
    let attesterIssuerProxyURI: string;

    const attesterToken: string = await new Promise((resolve) => {
        storage.onChanged.addListener(async (changes) => {
            for (const [, value] of Object.entries(changes)) {
                if (!value.newValue) {
                    continue;
                }
                const newValue = value.newValue;
                if (
                    newValue[originTabId] &&
                    newValue[originTabId].hasOwnProperty('attestationData') && // eslint-disable-line no-prototype-builtins
                    newValue[originTabId].attestationData != ''
                ) {
                    // before we close it retrieve the URL of the attester tab
                    const tab: chrome.tabs.Tab = await new Promise((resolve) =>
                        chrome.tabs.get(newValue[originTabId].attesterTabId, resolve),
                    );
                    if (!tab) {
                        continue;
                    }
                    attesterIssuerProxyURI = tab.url!;

                    // close the attester tab as we no longer need to interact with the attester front-end
                    chrome.tabs.remove(newValue[originTabId].attesterTabId);

                    resolve(newValue[originTabId].attestationData);
                }
            }
        });
    });

    chrome.tabs.update(originTabId, { active: true });

    // Create a TokenRequest.
    const client = new Client();
    const tokenRequest = await client.createTokenRequest(privateToken);

    // Send TokenRequest to Issuer (via Attester) as proxy
    const tokenResponse = await tokenRequest.send(
        attesterIssuerProxyURI!,
        TokenResponse,
        new Headers({ 'private-token-attester-data': attesterToken }),
    );

    // Produce a token by Finalizing the TokenResponse.
    const token = await client.finalize(tokenResponse);

    return token;
}
