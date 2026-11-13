# syntax=docker/dockerfile:1
#
# Konzilo Demo in one image: Ampfield Energy's website on Konzilo, with Forgejo, Caddy and Typesense, run by a
# small supervisor, and started by
#
#   docker run --rm -p 127.0.0.1:8080-8083:8080-8083 ghcr.io/kntnt/konzilo-demo
#
# Build it with `npm run image:build`, never with `docker build` alone: image/build.mjs builds on a builder of its
# own and passes the core's source at the tag of the version the site pins as the named context `core`, this
# repository's image/ as `image`, the core's pinned versions from its versions.env, and what the image says of
# itself. The main context is the site, as a commit holds it (.dockerignore).
#
# Everything a first start of Konzilo's Compose project does (Forgejo's setup, the seed, the first build with
# its search index, the preview's copy of the site) is done here, once, on the build machine's own
# architecture, in the stage `prepare`; the state it leaves is copied into the image for each target, whose
# own work is only its Debian packages and its native npm packages. Everything runs as `node`, 1000:1000.

ARG NODE_RELEASE
ARG NODE_DIGEST
ARG FORGEJO
ARG FORGEJO_DIGEST
ARG CADDY
ARG CADDY_DIGEST
ARG TYPESENSE
ARG TYPESENSE_DIGEST

# The vendors' programs, by the core's pinned digests: for the target, and for the build machine, which runs
# them in `prepare`. Forgejo comes from data.forgejo.org, which serves the same digest as the core's
# codeberg.org, whose registry refuses pulls when it is under load.
FROM data.forgejo.org/forgejo/forgejo:${FORGEJO}-rootless@sha256:${FORGEJO_DIGEST} AS forgejo
FROM caddy:${CADDY}-alpine@sha256:${CADDY_DIGEST} AS caddy
FROM typesense/typesense:${TYPESENSE}@sha256:${TYPESENSE_DIGEST} AS typesense
FROM --platform=$BUILDPLATFORM data.forgejo.org/forgejo/forgejo:${FORGEJO}-rootless@sha256:${FORGEJO_DIGEST} AS forgejo-here
FROM --platform=$BUILDPLATFORM caddy:${CADDY}-alpine@sha256:${CADDY_DIGEST} AS caddy-here
FROM --platform=$BUILDPLATFORM typesense/typesense:${TYPESENSE}@sha256:${TYPESENSE_DIGEST} AS typesense-here

# Node on the build machine's architecture, for every stage that makes something.
FROM --platform=$BUILDPLATFORM node:${NODE_RELEASE}-bookworm-slim@sha256:${NODE_DIGEST} AS node-here
ENV npm_config_update_notifier=false npm_config_fund=false npm_config_audit=false

# The editor's static files, with the notices of what they bundle beside them, as the core's
# compose/web/Dockerfile makes them; the same for every target. It takes the core's scripts and source whole,
# so that what the editor's build reads may change in the core without a change here.
FROM node-here AS editor
WORKDIR /core
COPY --from=core package.json package-lock.json ./
RUN npm ci --ignore-scripts --loglevel=error
COPY --from=core scripts scripts
COPY --from=core src src
RUN node scripts/build-editor.js /editor

# Typesense's program without what only a debugger reads, a hundred megabytes less to download; the notices
# say what was done, with what and when.
FROM node-here AS strip
RUN apt-get update -qq \
	&& apt-get install -qq --no-install-recommends binutils-aarch64-linux-gnu binutils-x86-64-linux-gnu >/dev/null \
	&& rm -rf /var/lib/apt/lists/*
ARG TARGETARCH
COPY --from=typesense /opt/typesense-server /out/typesense-server
RUN case "$TARGETARCH" in arm64) tool=aarch64-linux-gnu-strip ;; amd64) tool=x86_64-linux-gnu-strip ;; *) echo "no strip for $TARGETARCH" >&2; exit 1 ;; esac \
	&& before=$(stat -c %s /out/typesense-server) \
	&& "$tool" --strip-unneeded /out/typesense-server \
	&& printf '{"tool":"%s","version":"%s","option":"--strip-unneeded","date":"%s","bytesBefore":%s,"bytesAfter":%s}\n' \
		"$tool" "$("$tool" --version | head -1)" "$(date -u +%Y-%m-%d)" "$before" "$(stat -c %s /out/typesense-server)" > /out/typesense-strip.json

# The core's source, at the tag of the version the site pins: its programs, compose/ and what builds the editor,
# which the package in the site's vendor/ does not hold. image/build.mjs has checked that every file of the
# package is the same file here. Where the image would need to change the core, the change would go here, in a
# step of its own that names the fault or the ticket it stands for; today there is none.
FROM node-here AS core-source
COPY --from=core . /konzilo

# The core with its own dependencies, as the builder's image holds it: for the build machine, and for the
# target, whose native packages npm chooses by the target's processor.
FROM node-here AS core-here
COPY --from=core-source /konzilo /konzilo
WORKDIR /konzilo
RUN npm ci --omit=dev --omit=peer --loglevel=error

FROM node-here AS core-target
ARG TARGETARCH
COPY --from=core-source /konzilo /konzilo
WORKDIR /konzilo
RUN cpu=$(case "$TARGETARCH" in amd64) echo x64 ;; *) echo "$TARGETARCH" ;; esac) \
	&& npm ci --omit=dev --omit=peer --loglevel=error --cpu="$cpu" --os=linux --libc=glibc

# The site as the image serves it, with what it makes of its design made here, its demo content and its logos,
# as a local copy makes them before its first build; its dependencies, the two packages in vendor/ among them,
# installed exactly as its lock says. The pictures in design/images/ are read only by
# scripts/demo-content.mjs, so they go once the demo content is made: the builder builds from the content
# repository, and neither it nor the preview runs that script with no content folder of its own. The demo
# content stays for the seed in `prepare`, and is left out of the image, where nothing reads it.
FROM node-here AS site
COPY . /site
WORKDIR /site
RUN HOME=/tmp/npm-home npm ci --loglevel=error \
	&& node scripts/demo-content.mjs \
	&& npm run --silent logos \
	&& rm -rf node_modules /tmp/npm-home design/images

# A Debian base with Git and tini, for the build machine (`prepare`) and for the target (the image).
FROM node-here AS base-here
COPY --from=image base.sh /tmp/base.sh
RUN sh /tmp/base.sh && rm /tmp/base.sh

FROM node:${NODE_RELEASE}-bookworm-slim@sha256:${NODE_DIGEST} AS base
COPY --from=image base.sh /tmp/base.sh
RUN sh /tmp/base.sh && rm /tmp/base.sh

# What a first start of Compose does, done once, here, on the build machine's own architecture: Forgejo's
# setup, the seed with the demo's three people, the sign-in pages' buttons, the builder's first build with
# the search index, and the preview's copy of the site. It needs the network, for npm. Its passwords are
# written to a tmpfs, never into a layer; the people's are in image/runtime/people.json and shown on the
# sign-in pages, and the instance's is made at random and kept nowhere.
FROM base-here AS prepare
COPY --from=forgejo-here /app/gitea/gitea /usr/local/bin/forgejo
COPY --from=caddy-here /usr/bin/caddy /usr/local/bin/caddy
COPY --from=typesense-here /opt/typesense-server /usr/local/bin/typesense-server
COPY --from=core-here /konzilo /konzilo
COPY --from=site /site /site
# Only what the preparation runs, so that a change to the supervisor does not prepare again.
COPY --from=image runtime/prepare.mjs runtime/programs.mjs runtime/app-ini.mjs runtime/people.json /konzilo-demo/
COPY --from=image runtime/buttons /konzilo-demo/buttons
# The core's init.sh copies Forgejo's templates from where Compose mounts them.
RUN ln -s /konzilo/compose/forgejo/templates /konzilo/templates && mkdir /prepared && chown node:node /prepared
USER node
RUN --mount=type=tmpfs,target=/run/secrets node /konzilo-demo/prepare.mjs /prepared/state.tar

# The record the core's prepare-site.sh keeps of what a copy's dependencies were installed from, as the target
# makes it: it holds the Node, the platform and the processor, so that a copy installed for another would be
# installed again at the first start. Made by the core's own installed-from.js, run by the target's Node.
FROM base AS installed-from
COPY --from=core-source /konzilo /konzilo
COPY --from=site /site /site
RUN cd /site && node /konzilo/compose/builder/installed-from.js . > /installed-from

# The state for the target: as `prepare` left it, with the site's dependencies in each of the builder's and
# the preview's copies chosen for the target's processor where it is not the build machine's, each with the
# record made for the target, and the files the two copies share stored once.
FROM node-here AS assemble
ARG TARGETARCH
ARG BUILDARCH
COPY --from=core-source /konzilo /konzilo
RUN --mount=type=bind,from=prepare,source=/prepared/state.tar,target=/tmp/state.tar \
	mkdir /out && tar -xf /tmp/state.tar -C /out
COPY --from=installed-from /installed-from /tmp/installed-from
RUN if [ "$TARGETARCH" != "$BUILDARCH" ]; then \
		cpu=$(case "$TARGETARCH" in amd64) echo x64 ;; *) echo "$TARGETARCH" ;; esac); \
		for work in /out/builder-work /out/preview-work; do \
			(cd "$work/site" && HOME=/tmp/npm-home npm install --install-links --loglevel=error --cpu="$cpu" --os=linux --libc=glibc) || exit 1; \
		done; \
		rm -rf /tmp/npm-home; \
	fi \
	&& for work in /out/builder-work /out/preview-work; do \
		test -f "$work/site/node_modules/.konzilo-installed-from" || { echo "prepare left no record in $work" >&2; exit 1; }; \
		cp /tmp/installed-from "$work/site/node_modules/.konzilo-installed-from" \
			&& chown 1000:1000 "$work/site/node_modules/.konzilo-installed-from" || exit 1; \
	done \
	&& hardlink --quiet --ignore-time /out/builder-work/site /out/preview-work/site

# The licence and notice files of each Go module Caddy is built from, at the version its build-info names, read
# from the module's source at the Go module proxy; a stage of its own, so that it is fetched again only when
# Caddy changes.
FROM node-here AS caddy-modules
COPY --from=caddy-here /usr/bin/caddy /in/caddy
COPY --from=image notices/caddy-modules.mjs /notices/caddy-modules.mjs
RUN node /notices/caddy-modules.mjs /in/caddy /out

# The notices: what the image owes for every part it holds, gathered from the parts themselves, with each
# license text and the address of each part's source at the version the image holds, into one folder. It
# fetches the build files that name what libvips and Typesense bundle, at their tags.
FROM node-here AS notices
COPY --from=image notices /notices
COPY --from=core-source /konzilo /in/konzilo
COPY --from=editor /editor /in/editor
COPY --from=strip /out/typesense-strip.json /in/typesense-strip.json
COPY --from=forgejo-here /app/gitea/gitea /in/forgejo
COPY --from=caddy-here /usr/bin/caddy /in/caddy
COPY --from=caddy-modules /out /in/caddy-modules
COPY --from=base /var/lib/dpkg/status /in/dpkg-status
COPY --from=base /usr/share/doc /in/doc
COPY --from=base /usr/local/LICENSE /in/node-LICENSE
COPY --from=base /usr/local/lib/node_modules /in/node-lib-node-modules
COPY --from=base /opt /in/opt
COPY --from=core-target /konzilo/node_modules /in/core-node-modules
COPY --from=assemble /out/builder-work/site/node_modules /in/site-node-modules
COPY --from=site /site /in/site
COPY design/images/credits.json /in/credits.json
ARG CORE_DESCRIBED
# Forgejo runs as no root, not even to hand over its list of licenses.
RUN mkdir -p /usr/share/doc/konzilo-demo && chown node:node /usr/share/doc/konzilo-demo
USER node
RUN --mount=type=bind,from=typesense-here,source=/opt/typesense-server,target=/in/typesense-server \
	CORE_DESCRIBED="$CORE_DESCRIBED" node /notices/gather.mjs /in /usr/share/doc/konzilo-demo

# What the image says of itself, which the supervisor prints and the labels repeat, made last, so that a new
# date changes no layer before it.
FROM node-here AS release
ARG IMAGE_VERSION
ARG IMAGE_CREATED
ARG IMAGE_REVISION
ARG CORE_DESCRIBED
RUN mkdir /out && node -e "const [version, created, revision, core] = process.argv.slice(1); if (!version || !created) throw new Error('image/build.mjs passes the version and the date'); require('node:fs').writeFileSync('/out/release.json', JSON.stringify({ version, created, revision, core }, null, 2) + '\n');" \
	"$IMAGE_VERSION" "$IMAGE_CREATED" "$IMAGE_REVISION" "$CORE_DESCRIBED"

FROM base
COPY --from=forgejo /app/gitea/gitea /usr/local/bin/forgejo
COPY --from=caddy /usr/bin/caddy /usr/local/bin/caddy
COPY --from=strip /out/typesense-server /usr/local/bin/typesense-server
COPY --from=core-target /konzilo /konzilo
COPY --from=editor /editor /srv/admin
COPY --from=site --exclude=demo-content /site /site
COPY --from=image runtime /konzilo-demo
COPY --from=image notices/walk.mjs notices/check.mjs notices/caddy-modules.mjs /konzilo-demo/notices/
COPY --from=assemble /out/ /
COPY --from=notices /usr/share/doc/konzilo-demo /usr/share/doc/konzilo-demo
COPY --from=release /out/release.json /konzilo-demo/release.json
USER node
WORKDIR /
EXPOSE 8080 8081 8082 8083
STOPSIGNAL SIGTERM
ENTRYPOINT ["tini", "--", "node", "/konzilo-demo/supervisor.mjs"]
ARG IMAGE_VERSION
ARG IMAGE_CREATED
ARG IMAGE_REVISION
LABEL org.opencontainers.image.title="Konzilo Demo" \
	org.opencontainers.image.description="A demonstration website on Konzilo, for the fictional Ampfield Energy, with its editor, live preview and Forgejo, in one image." \
	org.opencontainers.image.source="https://github.com/Kntnt/konzilo-demo" \
	org.opencontainers.image.url="https://github.com/Kntnt/konzilo-demo" \
	org.opencontainers.image.vendor="Kntnt Sweden AB" \
	org.opencontainers.image.licenses="AGPL-3.0-or-later" \
	org.opencontainers.image.version="${IMAGE_VERSION}" \
	org.opencontainers.image.created="${IMAGE_CREATED}" \
	org.opencontainers.image.revision="${IMAGE_REVISION}"
