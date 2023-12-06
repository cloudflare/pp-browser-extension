## Directory Structure

```
pp-browser-extension
├──📂 platform: Contains platform specific assets, such as manifest for browsers, or brackground and service worker script used by each platform.
├──📂 public: Contains all the assets which are neither the business logic files nor the style sheets.
└──📂 src: Contains all the business logic files and the style sheets.
    └──📂 background: The business logic of the extension service worker.
    └──📂 common: The shared logic between the extension background script and its options context.
    └──📂 options: The web app defining option page in the browser settings.
```
