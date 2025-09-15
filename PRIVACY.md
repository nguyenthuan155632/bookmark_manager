Privacy Policy for Memorize Bookmark Chrome Extension

Last updated: 2025-01-01

Overview
- This Chrome extension lets you save the current tab as a bookmark to your Memorize account.
- It communicates only with your Memorize server and does not send data to any third parties.

Data Collected
- Account credentials you provide (username and password) are sent directly to your Memorize server only to obtain a token. The extension does not store your password.
- An authentication token returned by your server is stored locally using chrome.storage.local.
- Bookmark data you explicitly submit (URL, title, description, tags, favorite flag, passcode, and generation options) is sent to your Memorize server.
- The extension does not collect analytics or usage telemetry.

Data Usage
- Your token and submitted bookmark data are used solely to authenticate and create bookmarks via your Memorize server API.
- No data is sold, shared, or transmitted to third parties by the extension.

Data Storage & Retention
- The authentication token is stored locally in chrome.storage.local on your device until you sign out or remove the extension.
- No personal data is stored by the extension’s publisher outside of your own Memorize server.

Permissions Justification
- storage: to store the server URL and authentication token locally.
- activeTab: to read the current tab’s URL and title when the popup is opened by you.
- notifications: to show success or error messages after actions.
- host permissions: restricted to your Memorize server domain in production to allow API requests.

User Controls
- Sign out at any time using the “Sign out” button in the popup (clears the token).
- Remove the extension to delete all local data stored by it.

Contact
- For privacy questions or requests, contact: nt.apple.it@gmail.com
