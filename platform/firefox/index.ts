import {
    BROWSERS,
    handleBeforeSendHeaders,
    handleHeadersReceived,
    handleInstall,
} from '../../src/background';

const BROWSER = BROWSERS.FIREFOX;
const STORAGE = browser.storage.local;

chrome.runtime.onInstalled.addListener(handleInstall(STORAGE));

chrome.webRequest.onBeforeSendHeaders.addListener(
    handleBeforeSendHeaders(STORAGE),
    { urls: ['<all_urls>'] },
    ['requestHeaders', 'blocking'],
);

chrome.webRequest.onHeadersReceived.addListener(
    handleHeadersReceived(BROWSER, STORAGE),
    { urls: ['<all_urls>'] },
    ['responseHeaders', 'blocking'],
);
