# Changesets

Add one changeset for each user-facing package change:

```bash
pnpm changeset
```

Choose `@ericchen1990/pano-view`, select the appropriate semver bump, and
describe the change. Commit the generated markdown file with the code change.

Before publishing a release:

```bash
pnpm version-packages
pnpm release
```

`version-packages` consumes pending changesets, updates package versions and
changelogs, and refreshes the lockfile. `release` builds the workspace and
publishes packages that have a new version.
