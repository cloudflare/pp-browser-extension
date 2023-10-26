import { getRawSettings, saveSettings, SETTING_NAMES, SettingsKeys } from '../common';

const STORAGE = typeof browser !== 'undefined' ? browser.storage.local : chrome.storage.local;

// When the popup is loaded, load component that are stored in local/sync storage
const onload = async () => {
    // Load current settings from sync storage
    const settings = await getRawSettings(STORAGE);

    // Every setting has a dedicated input which we need to set the default value, and onchange behaviour
    for (const name in settings) {
        const dropdown = document.getElementById(name) as HTMLInputElement;

        dropdown.value = settings[name];
        dropdown.addEventListener('change', (event) => {
            const target = event.target as HTMLInputElement;
            if (!Object.values(SETTING_NAMES).includes(target.id as SettingsKeys)) {
                return;
            }
            saveSettings(STORAGE, target.id as SettingsKeys, target.value.trim());
        });
    }

    // Links won't open correctly within an extension popup. The following overwrite the default behaviour to open a new tab
    for (const a of [...document.getElementsByTagName('a')]) {
        a.addEventListener('click', (event) => {
            event.preventDefault();
            chrome.tabs.create({ url: a.href });
        });
    }
};

document.addEventListener('DOMContentLoaded', onload);
