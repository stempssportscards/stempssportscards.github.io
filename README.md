# Stemp's Sports Cards

A private shelf for a handful of people. Each person signs in with Google and the app stores **their** cards in **their** Google Drive. There is no server and no database. Hosting is a free static site.

What you can do:

- Add a card from the camera or the photo library.
- Read the card with Gemini (player, year, set, number, parallel, grade) and edit the result.
- Track buy price, asking price, sold price and date, and status (owned / for sale / sold).
- See profit automatically: sold minus buy once it sells, or asking minus buy as potential before that.
- Open eBay sold listings and a 130point search for that card. No eBay API.
- See counts, cost, asking value, and realized profit, and filter the shelf.
- Publish a buyer link. Buyers do not sign in. They see photo, details, and asking price only.

## Cost

| Item | Cost |
| --- | --- |
| This app, GitHub Pages, Google Drive, Google sign-in | $0 |
| Gemini, if the AI Studio project has **no billing account** | $0 until the free quota runs out, then the request fails instead of charging |
| eBay and 130point | $0. They are normal links, not APIs |
| A custom domain | Optional, about $7/year at a registrar. Skip it and use the free `github.io` address |

Do not attach a billing account to the Google Cloud project or the AI Studio project.

## Run it on this phone or computer

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4317`.

**Try the demo on this phone** stores the shelf in this browser only. Use it to learn the app. A demo buyer link does not work on someone else's phone.

`npm test` checks profit math, the buyer file, comp links, and the Gemini sample read. `npm run build` writes `dist/`.

## 1. Google sign-in and Drive

The app only asks for `drive.file` (files this app creates), plus email and profile so it can show who is signed in. It does not see the rest of the Drive.

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project, for example `Stemp's Sports Cards`. Leave billing off.
2. **APIs & Services → Library**. Enable **Google Drive API**.
3. **Google Auth Platform → Branding** (this used to be called the OAuth consent screen):
   - User type: **External**
   - App name: `Stemp's Sports Cards`
   - Support email: your Gmail
4. **Google Auth Platform → Data access / Scopes**. Add:
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `openid`
5. **Audience**. While the app is in **Testing**, only listed test users can sign in (up to 100). Add every Gmail address that will use the shelf, including yours. `drive.file` is a non-sensitive scope, so you can later click **Publish app** and skip Google's restricted-scope review. Publishing lets any Google account sign in. Testing is enough for a few friends.
6. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **Web application**
   - Name: `Stemp's Sports Cards web`
   - **Authorized JavaScript origins** (no trailing slash, no path):
     - `http://127.0.0.1:4317`
     - `http://localhost:4317`
     - `https://YOURNAME.github.io`
     - `https://your-domain.com` if you add one
   - **Authorized redirect URIs**: leave this empty. Sign-in uses a Google popup and checks the JavaScript origin, not a redirect URI.
7. Copy the client ID. It ends in `.apps.googleusercontent.com`.
8. On the phone, open the app, paste that ID into **Google OAuth client ID**, and tap **Sign in with Google**. Allow pop-ups if the phone blocks the Google window.

The first sign-in creates a Drive folder named **Stemp's Sports Cards**. `collection.json` and the photos stay private to that Google account.

You can also put the client ID in `public/config.json` so every visitor's phone already has it, then rebuild. The client ID is not a secret. The Gemini key is. Never put the Gemini key in that file.

## 2. Buyer links (Google API key)

Buyers do not sign in. The app reads the public `for-sale.json` with a browser API key.

1. In the same Cloud project: **Credentials → Create credentials → API key**.
2. Edit the key.
   - Application restrictions: **HTTP referrers**.
   - Add the same sites as the OAuth origins, with a path wildcard:
     - `http://127.0.0.1:4317/*`
     - `http://localhost:4317/*`
     - `https://YOURNAME.github.io/*`
     - `https://your-domain.com/*`
   - API restrictions: **Restrict key** → **Google Drive API** only.
3. Put the key in `public/config.json`:

```json
{
  "googleClientId": "YOUR_ID.apps.googleusercontent.com",
  "googleApiKey": "YOUR_BROWSER_KEY"
}
```

4. Rebuild and redeploy. A key typed only into Settings works on that phone. Other people need the key in `config.json`.

Publishing a buyer link sets `for-sale.json`, and the photos of cards marked **For sale**, to **anyone with the link**. Taking a card off sale removes that public permission from its photo. The public file is built from an allow-list: player, year, set, number, parallel, grade, asking price, photo. Cost, sold price, notes, and profit are not written.

The link looks like `https://YOURNAME.github.io/stemps-sports-cards/#/s/FILE_ID`. The hash works on GitHub Pages without extra server rules.

## 3. Gemini (optional personal key)

The live site can read cards through a hidden free-tier relay. After that Apps Script web app is deployed, put its URL in `public/config.json` as `geminiRelayUrl` and rebuild. Never put the Gemini key in that file.

A personal key is optional. Add one in Settings if the shared scanner hits today's free limit, or if you want to use your own:

1. Open [Google AI Studio](https://aistudio.google.com/apikey) while signed into the Google account that should pay nothing.
2. Create an API key in a project with **no billing account**.
3. In the app: **Settings → Gemini API key (optional) → Save Gemini key**.
4. Optional, after Google sign-in: check **Also keep a copy in my Drive** so a second phone can load it. That file is private. It is not the buyer file.

The default model is `gemini-3.5-flash-lite`. If Google rejects the name, set the model to `gemini-3.8-flash` and save again. If there is no personal key and no relay URL, **Read the card** fills a labeled sample so the rest of the form can be tried. Edit the sample before saving.

## 4. Free hosting

The site is a static build (`npm run build` → `dist/`). The same setup as Stone Creek Pickleball is a **free Render static site** built from GitHub. `render.yaml` is the Blueprint.

In the Render dashboard, if you create it by hand:

1. **New → Static Site**. Do not choose a Web Service. Static sites are $0.
2. Connect this repository, branch `main`.
3. Build command: `npm ci && npm run build`
4. Publish directory: `dist`
5. Add a rewrite: source `/*`, destination `/index.html`, action **Rewrite**. Render skips that rule when a real file exists, so JS, CSS, and images still load.

After the first deploy, add the `https://….onrender.com` origin (no path) to the Google OAuth client and to the API key's HTTP referrers, then put both values in `public/config.json` and push again.

### GitHub Pages

1. Create a **public** GitHub repository and push this project to `main`. Private GitHub Pages is not free.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow in `.github/workflows/pages.yml` runs the tests and publishes `dist/`.
4. The address is `https://YOURNAME.github.io/REPO_NAME/`.
5. Add that origin (`https://YOURNAME.github.io`, no path) to the OAuth client and the API key referrers, then put both values in `public/config.json` and push again.

### Cloudflare Pages or Netlify

Create a free project, framework preset **Vite**, build command `npm run build`, output directory `dist`. Add the deployed `https://…` origin the same way as GitHub Pages. Do not pick a paid plan.

### Custom domain

Point the domain at the host's free instructions (GitHub Pages or Cloudflare). Add `https://your-domain.com` as an Authorized JavaScript origin and an API-key referrer. The domain registration is the only optional cost.

## iPhone

The app is built for a phone, including iPhone Chrome. Add it to the Home Screen from the browser menu if you want the SSC icon. Use **Take photo** for the camera. If a HEIC photo will not open, set the iPhone camera to **Most Compatible**, or choose the photo from the library as a JPEG.

## What is still a human step

The app cannot create these for you, and nothing here was purchased:

1. Create the Google Cloud OAuth client and paste the client ID.
2. Create the referrer-restricted Drive API key and put it in `public/config.json` if buyers on other phones should open the link.
3. Deploy the Apps Script Gemini relay and put its web app URL in `public/config.json` as `geminiRelayUrl`. A personal Gemini key in Settings is optional.
4. Create the public GitHub (or Cloudflare / Netlify) project and add its origin to the OAuth client.
5. Optional: buy a domain yourself, about $7/year.

The original logo is `brand/source.png`. `npm run brand` writes the header and buyer-page wordmark (crown, SSC shield, and "Stemp's Sports Cards") and the app icons (crown and shield). The "$1 Football Cards" promo is not included.
