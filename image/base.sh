#!/bin/sh
# The Debian base of the image and of its build stage `prepare`, run as root in each: Git and Git LFS, which
# Forgejo, the seed and the builder use, CA certificates, and tini, the image's PID 1. Then every folder
# Compose has a volume for, given to `node` (1000:1000), who runs everything, and the web server's names for
# three of them, as Compose mounts them.
set -eu

apt-get update -qq
apt-get install -qq --no-install-recommends git git-lfs ca-certificates tini >/dev/null
rm -rf /var/lib/apt/lists/* /var/cache/apt/*

folders="/var/lib/gitea /typesense-data /typesense-secret /state /builder-secret /preview-secret /editors-secret
	/builder-work /preview-work /public /admin-config /control /thumbnails /search-route /service-data /caddy"
# shellcheck disable=SC2086
mkdir -p $folders
# shellcheck disable=SC2086
chown node:node $folders
mkdir -p /srv
ln -s /public /srv/site
ln -s /search-route /srv/search
ln -s /admin-config /srv/admin-config
