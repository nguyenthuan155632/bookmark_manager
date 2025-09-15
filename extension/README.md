# Memorize Bookmark Chrome Extension

This extension lets users save the current tab to their Memorize account.

Overview
- Opens a popup with a Create form (URL, name, description, tags, favorite, passcode, AI options).
- Signs in once to obtain a token, stored locally.
- Sends bookmark data to the Memorize API you control.

Permissions
- storage: Save server URL and auth token locally.
- activeTab: Read the current tab’s URL and title when the popup opens (user gesture).
- notifications: Not requested (success/error is shown inline in the popup).
- host_permissions: Restricted to the production API origin (optional localhost for dev in the dev manifest).

Data Handling
- Password is sent directly to the server only for login (token exchange). Passwords are not stored.
- Token is stored in chrome.storage.local until the user signs out or removes the extension.
- Bookmark data is only sent to the configured Memorize server.
- No analytics or third‑party data sharing.

Privacy Policy
- See the repository PRIVACY.md for full policy and contact.

Build/Pack
- Manifests:
  - `manifest.dev.json`: Development (allows optional localhost host permission).
  - `manifest.prod.json`: Production (only the production API origin).
- Switch the active manifest:
  - Dev: `npm run ext:manifest:dev`
  - Prod: `npm run ext:manifest:prod`
- Then load the extension from the `extension/` folder, or pack it via Chrome’s Extensions page.

Store Listing License Notice
- This extension is distributed under the MIT License. See the included `extension/LICENSE` file for details.

Branding/Icons
- Toolbar icons: `icon-16.png`, `icon-32.png`.
- Store/listing icon: `icon-128.png`.

Reviewer Notes
- The extension has no background service worker and no content scripts.
- It only performs network requests to the configured Memorize server.
- The popup closes automatically after a successful create operation.

Contact
- For review questions or user support: nt.apple.it@gmail.com
