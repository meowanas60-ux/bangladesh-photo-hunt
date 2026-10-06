# Bangladesh Photo Hunt — Real / Deploy-ready build

## Included
- Premium Bangladesh-focused UI
- Interactive Bangladesh division map (Leaflet + GeoJSON)
- Real machine-readable Bangladesh hierarchy: division → district → upazila → union
- Search + cascading explorer
- GPS permission flow
- Supabase schema for real users, missions, submissions and leaderboard
- Cloudinary-ready configuration
- Admin role field
- No fake village/mouza names are generated

## Important data rule
The Bangladesh National Portal is the authoritative public reference for the administrative hierarchy. Its current portal snapshot reports 8 divisions, 64 districts, 500 upazilas and 4568 unions. The browser dataset used in this starter is a bilingual derived dataset and may have a different snapshot/count. Before production launch, import and validate the exact government snapshot you want to freeze.

Village and mouza are deliberately NOT treated as the same thing. Mauza is a cadastral/geographic concept and village is a settlement/geographic unit; a production database should import them as separate records with provenance.

## Real account / upload
1. Create a Supabase project.
2. Run `supabase/schema.sql`.
3. Add Supabase URL + anon key in `app.js` (or convert to env during bundling).
4. Create Cloudinary unsigned upload preset or, preferably, a server-side signed upload endpoint.
5. Never put a Cloudinary API secret in browser JavaScript.
6. Add an Edge Function/server endpoint to validate GPS distance, approve submissions and increment XP.

## Sources used
- Bangladesh National Portal: https://bangladesh.gov.bd/views/upazila-list/ and https://bangladesh.gov.bd/views/union-list/
- BBS / government pages for village examples and statistics
- DLRS for mouza counts/reference
- Browser hierarchy dataset: https://iqbalhasandev.github.io/bangladesh-geo-json/bangladesh-geo.json
- Boundary source: https://github.com/meetshaks/bangladesh-administrative-boundaries-json

This is intentionally deploy-ready architecture rather than pretending that private Supabase/Cloudinary credentials already exist.
