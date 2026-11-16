<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.

<!-- LOVABLE:END -->

## Project rules

- Local clinical text comes only from curated `leaflet_versions` published via the `publish_leaflet_version` RPC. External API text may be shown verbatim only in clearly separated, unvalidated external views; never generate, translate or infer medical content with AI. Why: zero-hallucination requirement.
- Privileged changes (publish, subscription review, entitlements, roles) live in SECURITY DEFINER SQL functions that check `has_role`; clients never write those tables directly. Why: backend-enforced authorization.
- Premium features are enforced by RLS via `is_premium()`, not only in the UI. Why: entitlements must not be bypassable.
- Medicine search goes through `searchMedicines`; fixed-host server adapters query medicamentos.api.br with a server-only key or openFDA without a key. External results stay separate and are never saved automatically as curated drafts or verified leaflets. Why: traceable sources without false validation.
- Prefer native form controls (select/radio/checkbox) and the shared `TextField`/`Notice`/`LiveRegion` components for accessibility. Why: predictable screen-reader behavior.
