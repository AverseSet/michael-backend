# Netlify access and personal AI keys

The app asks everyone to sign in through the Netlify Function at `/.netlify/functions/auth`:

- Consumers enter `AA`. Their session lasts 24 hours.
- The owner enters the private admin key. The admin session lasts 30 days.

Configure these **server-side Netlify environment variables** in Site configuration → Environment variables:

- `MICHAEL_JWT_SECRET`: a random secret of at least 32 characters used to sign login sessions.
- `MICHAEL_ADMIN_ACCESS_KEY`: your private admin login key. Never add it to source code, a `VITE_` variable, the static build, or the APK.

The access form is a client-side app gate. Since the app is a public static site, this gate is not DRM and cannot prevent a determined visitor from loading the public files directly.

For the website, the login form calls the same-site Netlify Function automatically. For Android builds, set `VITE_NETLIFY_AUTH_URL` to `https://sage-manatee-3026ee.netlify.app/.netlify/functions/auth` before building so the APK can reach Netlify rather than its local WebView origin.

After login, each user adds their own provider key in **Settings → Set up AI provider**. AI keys are saved in that user's device/browser storage and sent directly from the app to the selected provider. They are not sent to Netlify. Users are responsible for their provider accounts, usage limits, and charges.

Choose **My API keys (on-device fallback)** to try configured providers in sequence, or select one provider to use only that provider. Live screenshot analysis requires an image-capable provider; in the fallback list, Google Gemini supports screenshots. Provider availability and browser CORS support may vary.

Netlify builds and publishes the static Vite site plus the auth Function. Do not use Render provider keys for app AI requests.
