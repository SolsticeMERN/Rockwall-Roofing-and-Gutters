# Rockwall Roofing & Gutters

Responsive Dallas roofing landing page with a floating sticky glass navbar, hero inspection form, project gallery, customer review carousel, inspection process, FAQs, and footer.

## Run locally

Requires Node.js 22 or newer. There are no runtime dependencies.

```sh
cp .env.example .env
npm run check
npm run build
python3 -m http.server 4173 --directory dist
```

Open http://localhost:4173. Edit files in `src/`, then rebuild. `dist/` is generated and ignored by Git.

## Deploy on Vercel

1. Import this GitHub repository into Vercel.
2. Keep the repository root as Root Directory and select **Other** as the framework preset. `vercel.json` specifies `npm run build` and output directory `dist`.
3. In Project Settings → Environment Variables, optionally set `SITE_URL` to your final HTTPS origin and `FORM_RECIPIENT_EMAIL` to the recipient address. The current address is the default. When `SITE_URL` is blank, the build uses the Vercel production URL (or deployment URL).
4. Deploy. Test both inspection forms, phone links, menu, carousel, and privacy page on the deployed domain.

`.env` and all `.env.*` files are ignored except `.env.example`. These two configuration values are public and appear in generated HTML/JS. Never put API keys or other secrets in client code. Unrelated environment values are not emitted by the build.

The local `.env`, build output, Vercel metadata, Sites identity, and Git credentials are not committed. Production secrets, if added for a future server integration, belong in Vercel's server-side environment settings.

## Form delivery

Forms use FormSubmit and send to the configured email address. The inbox owner must confirm the first-use activation email, and delivery must be tested before paid traffic starts. Provider acceptance does not confirm inbox delivery or book an appointment. No test submission has been sent as part of this repository preparation.

Both forms have validation, a spam honeypot, attribution fields, error recovery, and scoped feedback. A failed request preserves entered details. The build rewrites the fallback confirmation-page URL for your deployment origin.

## Content and measurement

- Dallas coverage and owner-answered calls were supplied by the client.
- Photographs are selected WebP originals from the supplied gallery. Project locations and dates are not claimed.
- Demo project scenarios are visibly labeled illustrative.
- Google review excerpts and the 5.0/135 aggregate are supplied snapshots, not a live API widget. Keep rating/count and relative review dates current.
- Specific material options, warranties, certification, and insurance assistance must be confirmed with the owner.
- `dataLayer` events are prepared for call clicks, form starts, request acceptance, and errors. No Google Analytics, Tag Manager, or Ads account is connected. Phone clicks are not connected calls; form acceptance is not a booked inspection.
- Configure the client's tracking/consent setup and record qualified and booked outcomes in the CRM to measure business results.

The optional fullscreen hero stylesheet is retained but not enabled. Current hero uses content-based height and extra desktop spacing.
