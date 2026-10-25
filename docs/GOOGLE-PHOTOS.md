# Google Photos in Cutroom

Cutroom uses the **Google Photos Picker API** to import only the photos and videos you explicitly select. The Gemini API key does not authorize access to a Google Photos account. A separate Google OAuth web application client is required.

## One-time setup

1. In a Google Cloud project you control, enable **Google Photos Picker API** (`photospicker.googleapis.com`). A restricted hackathon project may require its administrator to enable it; a personal Cloud project can supply the Photos connection while the existing hackathon Gemini key remains unchanged.
2. In **Google Auth Platform**, configure Branding, Audience and Data Access. Add `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`. While the app is in Testing, add the Google account containing your photos as a test user. Google may require verification for broader distribution; the development client is intended for your own local use.
3. Create an OAuth client with application type **Web application**. Register the redirect URI shown in Cutroom's Google Photos dialog. With the default URL it is exactly `http://127.0.0.1:4317/api/google-photos/oauth/callback`. If you use `localhost` instead, register `http://localhost:4317/api/google-photos/oauth/callback` too. The scheme, host, port and path must match.
4. In Cutroom choose **Google Photos**, paste the client ID and client secret, and save. Alternatively set `GOOGLE_PHOTOS_CLIENT_ID` and `GOOGLE_PHOTOS_CLIENT_SECRET` in the ignored `.env` and restart the server when no edit is running. Environment values take precedence over the dialog.
5. Choose **Connect Google Photos**, then **Continue with Google**. Sign into the account that contains your media and grant the Picker permission. You can return to the original Cutroom tab once the callback says connected.

## Pick and import

Choose **Choose photos & videos**, then open the Google Photos picker in a new tab. Select items and press **Done** in Google Photos. Cutroom follows Google's polling interval, detects completion, and enables **Import selected moments**. Import is explicit; selecting media alone does not download it. Imports wait for running edits and keep the local source library unchanged except for appending successfully imported items.

The imported media enters the same local thumbnail, color normalization, analysis, planning and reel-editing pipeline as SSD footage. Capture dates use Google's creation metadata. Google supplies high-quality transcoded videos (`=dv`), not guaranteed original camera files. Photos (`=d`) retain available metadata except location metadata. The current build supports its existing photo/video formats, clips of 0.5–120 seconds, at most 250 MB per file, 2 GB per import and 100 personal assets in the combined library. The picker caps selections at the remaining capacity. Per-item failures are shown; successful items remain usable. Re-selecting an already imported Google item skips a duplicate.

Imported items are local copies in ignored `.cutroom/assets/`. SSD rescans and source-folder changes preserve them. Google originals are never changed. The normal Argon workflow sends compact previews for analysis only when you run planning/editing; importing does not automatically start an AI edit.

## Connection and privacy

OAuth client settings, access and refresh tokens stay server-side in `.cutroom/google-photos-private.json`, with filesystem permissions `0600`; they are excluded from Git. This is local disk storage, not a managed secret vault. No access tokens or media base URLs are sent to the React UI. Authorization uses a browser-bound, expiring state cookie and PKCE. Downloads accept only Google's HTTPS media host, cap response size, and validate redirects before attaching bearer authorization.

Disconnect revokes the Google token when reachable and removes local tokens. Already imported media remains local and usable. The picker selection itself is ephemeral: restart or expiration requires selecting again, while imported files persist. OAuth apps in Testing can have short-lived refresh authorization; reconnect when Google expires it. If revocation cannot be confirmed, remove the app in your Google Account's third-party connections.

A live account connection cannot be verified without an OAuth client and the account owner's consent. The included automated tests mock Google endpoints, exercise OAuth/state/refresh, download real synthetic photo bytes through the ingestion pipeline, and cover duplicate imports, folder rescans, download bounds and hostile redirects.

Official references: [Picker scopes](https://developers.google.com/photos/overview/authorization), [session lifecycle](https://developers.google.com/photos/picker/guides/sessions), [media downloads](https://developers.google.com/photos/picker/guides/media-items), [OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server).
