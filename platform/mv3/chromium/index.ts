import {
    BROWSERS,
    handleBeforeRequest,
    handleBeforeSendHeaders,
    handleHeadersReceived,
    handleInstall,
} from '../../../src/background';

const BROWSER = BROWSERS.CHROME;
const STORAGE = chrome.storage.local;

chrome.runtime.onInstalled.addListener(handleInstall(STORAGE));

chrome.webRequest.onBeforeRequest.addListener(handleBeforeRequest(), { urls: ['<all_urls>'] });

chrome.webRequest.onBeforeSendHeaders.addListener(
    handleBeforeSendHeaders(STORAGE),
    { urls: ['<all_urls>'] },
    ['requestHeaders'],
);

chrome.webRequest.onHeadersReceived.addListener(
    handleHeadersReceived(BROWSER, STORAGE),
    { urls: ['<all_urls>'] },
    ['responseHeaders'],
);
