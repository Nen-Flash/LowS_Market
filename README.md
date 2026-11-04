# LowS Market

A frontend prototype of a food rescue marketplace in Kazakhstan, based on the LowS Market project presentations. All screens, role portals, assistant prompts, notifications and generated reports are in English. Prices remain in Kazakhstani tenge (₸).

Built with HTML, CSS and JavaScript. No build step, backend, npm installation or API keys are required. Relative asset paths support GitHub Pages project URLs.

## Explore the prototype

- Browse Almaty, Astana and Shymkent; search, sort and filter listings.
- Check ingredients, allergens, storage instructions and use-by dates.
- Save favorites, manage the cart and place a simulated pickup or delivery order.
- View order history, confirm receipt, report quality issues and track your impact.
- Register a demo profile or use a quick demo account to explore four roles.

| Role | Features | Demo email |
| --- | --- | --- |
| Buyer | Catalog, favorites, cart, checkout, orders and impact | `buyer@demo.lows.example` |
| Merchant | Overview, listings, mystery bundles, inventory, orders, donations, reports and payouts | `merchant@demo.lows.example` |
| Charity (NPO) | Registration, verification, available donations, pickup reservations, donation receipts and impact | `ngo@demo.lows.example` |
| Administrator | Overview, moderation, partner vetting, category rules, users, analytics and security logs | `admin@demo.lows.example` |

All demo accounts use **`Demo1234`**. The simulated second admin step uses **`123456`**. Quick demo buttons are available in the sign-in form. Newly registered merchants and NPOs require administrator approval inside the demo.

Connected workflows include merchant registration → draft listing → approval → catalog; buyer order → merchant confirmation → pickup code; merchant donation → NPO reservation → receipt; and quality report → administrator review.

## LowS AI

Open the LowS AI button, the catalog suggestion banner, or the assistant banner in a role portal.

- Buyers receive suggestions based on budget, food preferences, delivery and available stock, with an option to add the selection to the cart.
- Merchants receive expiry priorities, price suggestions and mystery bundle ideas. Price changes require an explicit click.
- NPOs can prioritize available donations by city and use-by date, book a pickup, and review received donations.
- Administrators receive a summary of review queues. Approval, refund and moderation decisions remain manual.

Try **“Dinner under 3000 ₸ without milk”**, **“What can I cook under 2500 ₸?”**, **“Suggest prices for my surplus”**, or **“What is available in Astana?”**.

This is a **local, rule-based demonstration**, with no language model connected. Requests stay in the browser. Availability, prices and role access are checked again before actions. Ingredient matching cannot guarantee allergen safety: check the listing and seller information.

Merchant price suggestions target discounts of 70% for items expiring today, 60% tomorrow, and 50% later, within the project’s 40–70% range. They never increase the current price. This is an expiry rule, not a demand forecast. Donation suggestions do not calculate geographic routes.

The response contract lives in `ai.js`. A real AI integration would require a server endpoint that protects the API key and validates responses. Do not put secret keys in GitHub Pages files.

## Run locally

From the project folder:

```sh
python3 -m http.server 4173
```

Open [http://localhost:4173](http://localhost:4173). Press `Ctrl+C` to stop. Use a local server because `file://` may block JavaScript modules.

## Publish with GitHub Pages

1. Upload the project files to a GitHub repository, including `.github/workflows/deploy.yml` and `.nojekyll`.
2. In **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**.
3. Push to `main`, or run **Actions → Deploy LowS Market to GitHub Pages → Run workflow**.
4. When deployment completes, open the URL shown in **Settings → Pages**.

If your default branch has a different name, update `branches: [main]` in the workflow. The workflow publishes only the website files and assets; research materials, tests and documentation are excluded.

Alternatively, choose **Deploy from a branch**, branch **main**, folder **/(root)**. Disable the Actions workflow when using that publishing method. Branch publication can expose other tracked repository files; keep private materials out of the repository.

## Demo limitations

- Stores, listings, stock, addresses and partnerships are fictional examples.
- Accounts, cart, favorites, orders and changes are stored in this browser’s `localStorage`. They do not sync across devices.
- Login and roles are frontend demonstrations, not secure authorization. Test passwords use salted PBKDF2 hashes; real authentication needs a backend. Registration requires HTTPS or localhost.
- Orders are not sent to stores. Payments, refunds, delivery and payouts are simulated. The 10% commission example is illustrative.
- Organization documents store file names only. CSV reports and donation receipts are educational examples, not official tax or ESG documents.
- Maps are schematic; locations and distances are illustrative.
- Impact uses demo product weights and prices. CO₂ and meal counts are not estimated without a validated methodology.
- Known labels and city names from the earlier Russian version are migrated automatically. Custom user-entered text and uploaded file names are preserved.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Shop layout and content |
| `styles.css` | Shop styles and responsive layout |
| `data.js` | Demo catalog, icons and legacy label migration |
| `app.js` | Catalog, cart and order interactions |
| `portals.js`, `portals.css` | Registration and role portals |
| `ai.js`, `ai.css` | Demo assistant and suggestion interface |
| `assets/` | Local images, fonts and licenses |
| `.github/workflows/deploy.yml` | GitHub Pages deployment |

Photo credits are in [assets/images/SOURCES.md](assets/images/SOURCES.md). Manrope is distributed under the SIL Open Font License 1.1; see `assets/fonts/OFL.txt`.
