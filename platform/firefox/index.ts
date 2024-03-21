import {
    BROWSERS,
    handleBeforeSendHeaders,
    handleHeadersReceived,
    handleInstall,
    handleStartup,
} from '../../src/background';

const BROWSER = BROWSERS.FIREFOX;
const STORAGE = browser.storage.local;

chrome.runtime.onInstalled.addListener(handleInstall(STORAGE));

chrome.runtime.onStartup.addListener(handleStartup(STORAGE));

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
