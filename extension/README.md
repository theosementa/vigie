# Vigie browser extension (Chrome, Manifest V3)

Adds the current page (toolbar button) or a right-clicked link (context menu, "Save to Vigie") to your Vigie library, with the same behaviour as the app's add-item flow. The result shows on the toolbar icon (check mark: saved or already there, "!": failed, hover for the reason).

## Security model

- **Token auth, no cookies.** In Vigie: Settings, Browser extension, create a token, paste it in the extension options with your instance address. Requests carry `Authorization: Bearer <token>` and `credentials: 'omit'`.
- The token is scoped to `items:add` (it can add items, nothing else), stored hashed server-side, shown once, and revocable from Settings. A revoked, unknown or missing token all get the same 401.
- **Minimal permissions:** `activeTab` (read the clicked tab's URL), `contextMenus`, `storage`. Access to your instance is an *optional* host permission, requested for that one origin when you save the options (and removed on disconnect or when the address changes).
- No remote code, no content scripts, no analytics. The token stays in `chrome.storage.local` (not synced).

## Try it locally

1. `chrome://extensions`, enable Developer mode, **Load unpacked**, pick this `extension/` folder.
2. Open the extension options, enter the instance address (`https://...`, or `http://localhost:...`) and the token.

## Publish to the Chrome Web Store

1. Zip the folder contents: `cd extension && zip -r ../vigie-extension.zip . -x README.md` (the manifest must be at the zip root).
2. Create a developer account (one-time fee) at the Chrome Web Store Developer Dashboard, add a new item, upload the zip.
3. Fill the listing: description, at least one 1280x800 screenshot, a 128 px icon (already included), category, and a privacy policy URL.
4. Privacy tab: single purpose ("add the current page or a link to the user's own Vigie instance"); justify each permission (`activeTab`, `contextMenus`, `storage`, optional host access to the user's own instance); declare that the extension handles an authentication token and sends page URLs to the user-configured server; certify no data is sold or used for unrelated purposes.
5. Submit for review. To ship an update, bump `version` in `manifest.json` and upload a new zip.
