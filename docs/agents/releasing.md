read when taking up a release of Konzilo or Konzilo Design, or building and publishing the image

What the scripts' own headers do not say. `image/build.mjs`, `image/checks/visitor.mjs`, `scripts/check.mjs` and `scripts/shoot.mjs` each say how they are run.

## Taking up a release

Both packages are pinned by a tarball in `vendor/`, each the asset of its release on GitHub: `kntnt-konzilo-<version>.tgz` and `kntnt-konzilo-design-<version>.tgz`.

The built site is the reference for the design: a release is judged by how the pages look beside how they looked before it.

1. Before anything else, `npm run build`, then `npm run shoot -- --all --out shots/before`: every page as it is.
2. Put the release's tarball in `vendor/`, name it in `package.json`, bring the lock up to it, and remove the old tarball. Then remove `node_modules` and run `npm ci`, so that the tree is what the lock says.
3. For Konzilo Design, run `konzilo-design resolve` on `design/site.design.json`.
4. `npm run check` and `npm run check:seed` pass with no refusal and no warning.
5. `npm run build`, then `npm run shoot -- --all --compare shots/before`, and look at each page beside its earlier self in `shots/compare/`, in the parts of about 2,000 px the script cuts a tall pair into. Compare what is drawn, not the pages' heights alone.
6. The image takes the core's source at the tag of the pinned tarball's version, from `~/Projects/konzilo` when that clone has the tag, else from GitHub, and stops unless every file of the tarball is the same at the tag (`image/lib/core.mjs`). So a core that is not released cannot go into an image.

## Publishing the image

The image is built from a commit, and its labels name that commit and the version given, so commit first. `X.Y.Z` is the image's version; the commit it names is tagged `vX.Y.Z` afterwards.

```
npm run image:test
npm run image:build -- --platform both --version X.Y.Z --tag kdemo-img-konzilo-demo:X.Y.Z
npm run image:check -- --no-build --tag kdemo-img-konzilo-demo:X.Y.Z
npm run image:check:arches -- --no-build --tag kdemo-img-konzilo-demo:X.Y.Z
gh auth token | docker login ghcr.io -u "$(gh api user --jq .login)" --password-stdin
npm run image:build -- --platform both --version X.Y.Z --tag ghcr.io/kntnt/konzilo-demo:X.Y.Z --tag ghcr.io/kntnt/konzilo-demo:latest --push
docker buildx imagetools inspect ghcr.io/kntnt/konzilo-demo:X.Y.Z
```

- The push builds again from the same builder's cache, so that what is pushed is what was proved, but for the step that writes the image's date. If `HEAD` has moved since the proof, give `--site <commit>` to both builds.
- Then prove what the registry holds: remove the local copies by name, run the README's command word for word, and run the two checks with `--no-build` against the pulled image.
- Leave Docker as it was: `docker logout ghcr.io`, and remove by name the pulled images, the local image, the builder (`docker buildx rm kdemo-img-builder`, which takes its cache with it) and `moby/buildkit:buildx-stable-1` when no other builder uses it. Never a prune.
- Publishing uses Thomas's `gh` token, which has `write:packages`. It is never printed.

## What was tried, and how

- **1.0.0**, 2026-11-13, at `4d203d5`: Docker Desktop on a Mac with Apple silicon, arm64 natively and amd64 emulated, in Chromium and Firefox.
- **With no sign-in**, once the package was public: the README's command with `DOCKER_CONFIG` set to an empty folder and `DOCKER_HOST` to Docker Desktop's socket, so that no stored sign-in could be used. It fetched the index the push had made and answered on all four addresses.
- **Podman and nerdctl** were tried inside Linux containers on that Mac, since neither is installed on it: rootless Podman in `quay.io/podman/stable`, privileged, with `vfs` storage, and nerdctl with containerd in `debian:bookworm-slim` with the native snapshotter, the image flattened to one layer for both, since their usual storage does not work on Docker Desktop's kernel. The Podman container leaves three anonymous volumes behind when it is removed; remove them by name.
- **Held to 2 GB of memory** (`image:check -- --limits`), the live preview has been killed while a save was built. The README asks for 4 GB.
- **Not tried:** Windows, Docker Engine on Linux, OrbStack, Colima, Rancher Desktop, WebKit.
