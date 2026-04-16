# Documentation Maintenance Policy

This file defines the minimum documentation updates required for every new Lumina feature.

## Rule

No feature is considered complete until docs are updated in the same PR/commit set.

## Required Updates Per Feature

For each user-facing feature, update:

1. `docs-content/CAPABILITIES.md`
- Set status (`Stable`, `Beta`, `Planned`)
- Add one-line notes on scope/limits

2. A focused guide
- Create or update topic doc (example: `docs-content/ERROR_HANDLING.md`, `docs-content/CONST_GENERICS.md`)
- Include syntax, examples, and current limitations

3. `docs-content/STDLIB.md` if runtime or stdlib API changed
- Add signatures
- Add behavior/return semantics
- Add minimal usage example

4. `README.md`
- Update highlights if feature is major
- Ensure docs links remain accurate

5. Examples
- Add or update under `examples/`
- Keep runnable by CLI commands shown in docs

6. Web app docs when relevant
- Update `docs-site/` if the docs shell or navigation changed
- Update `playground/` copy if editor or compiler behavior changed
- Rebuild `docs-site/public/docs-bundle.json` after markdown edits

## Source Of Truth

- `docs-content/` is the markdown source tree
- `docs-site/` is the docs portal shell and renderer
- `docs/` is generated publish output for GitHub Pages and should not be edited by hand
- Public docs routes are hash-based inside the docs app, for example `/docs/#/getting-started`

## Release Checklist

Before release:

1. Verify docs match shipped behavior
- Run sample commands in docs
- Remove stale roadmap claims from user-facing docs
- Check README links against the current docs slugs

2. Validate quality gates

```bash
npm run lint
npm test
npm run build
npm run docs:build-data
npm run web:build
```

3. Tag release notes
- Add brief section listing docs added/changed

## Doc Style

- Prefer executable examples over theory.
- Keep syntax examples small and runnable.
- Mark incomplete areas with explicit "Limitations" section.
- Avoid claiming support that is only parsed but not semantically/codegen supported.
- Keep docs examples aligned with syntax the browser playground and CLI both accept.

## Ownership

- Feature author updates docs.
- Reviewer verifies docs during code review.
- Release owner checks docs consistency before publish.
