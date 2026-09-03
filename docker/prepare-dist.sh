#!/bin/sh

# Stages the binary that docker/build.Dockerfile expects, so that
# `docker compose build` can run.
#
# build.Dockerfile compiles nothing: it only COPYs
# ${DIST_DIR}/docker/DNSGuard_${TARGETOS}_${TARGETARCH}_${TARGETVARIANT}.
# This script builds that one file for a single platform (the host's Docker
# architecture by default) — unlike scripts/make/build-docker.sh, which needs a
# full six-platform `make build-release` first.
#
# The binary is always built for Linux — GOOS is hardcoded below — so the only
# thing that varies is the architecture, and it defaults to whatever the local
# Docker daemon runs on.  On an Apple Silicon Mac that is arm64, which will not
# run on the usual x86-64 Linux server, so an explicit ARCH is needed there.
#
# Usage:
#	sh ./docker/prepare-dist.sh              # host arch
#	ARCH=amd64 sh ./docker/prepare-dist.sh   # for a typical Linux server
#	ARCH=arm64 sh ./docker/prepare-dist.sh   # explicit arch
#	ARCH=arm GOARM=7 sh ./docker/prepare-dist.sh
#
# This script only produces the binary.  To build the image too, use
# ./docker/build-image.sh, which runs this once per platform and passes the
# matching --platform to the builder — build.Dockerfile picks its binary by
# TARGETARCH, so the two have to agree.  `docker compose build` has no
# platform flag and always follows the host.
#
# Environment:
#	ARCH      GOARCH to build for.  Default: the host Docker architecture.
#	GOARM     ARM version, 6 or 7.  Only used when ARCH is 'arm'.  Default: 7.
#	CHANNEL   Version channel.  Default: 'development'.
#	GOTOOLCHAIN
#	          Default: 'auto', so that Go fetches the toolchain named in
#	          go.mod.  A local 'go' older than that fails otherwise.
#	DIST_DIR  Output root.  Default: 'dist'.
#	VERSION   Version string baked into the binary.  Default: a dev version
#	          derived from the current commit.
#	SKIP_JS   Set to 1 to skip the frontend build.

set -e -f -u

verbose="${VERBOSE:-0}"
if [ "$verbose" -gt '0' ]; then
	set -x
fi

channel="${CHANNEL:-development}"
# Default to 'auto' rather than inheriting a 'local' setting: go.mod pins a Go
# version newer than what is usually installed, and only 'auto' lets the go
# command fetch it.  Compare the GOTOOLCHAIN line in the Makefile.
gotoolchain="${GOTOOLCHAIN:-auto}"
dist_dir="${DIST_DIR:-dist}"
go="${GO:-go}"
readonly channel dist_dir go gotoolchain

# Detect the architecture Docker will build for, so that the produced file name
# matches the TARGETARCH/TARGETVARIANT that BuildKit passes to the Dockerfile.
arch="${ARCH:-}"
if [ "$arch" = '' ]; then
	arch="$(docker version --format '{{ .Server.Arch }}' 2>/dev/null || true)"
fi

if [ "$arch" = '' ]; then
	case "$(uname -m)" in
	'x86_64' | 'amd64') arch='amd64' ;;
	'aarch64' | 'arm64') arch='arm64' ;;
	'i386' | 'i686') arch='386' ;;
	'ppc64le') arch='ppc64le' ;;
	*)
		echo "cannot detect architecture, set ARCH explicitly" 1>&2
		exit 1
		;;
	esac
fi
readonly arch

# Mirror the naming in scripts/make/build-docker.sh.  DO NOT remove the trailing
# underscore for the non-ARM architectures: TARGETVARIANT is empty for them, and
# the Dockerfile joins the parts with underscores unconditionally.
goarm=''
case "$arch" in
'arm')
	goarm="${GOARM:-7}"
	variant="v${goarm}"
	;;
'386' | 'amd64' | 'arm64' | 'ppc64le')
	variant=''
	;;
*)
	echo "unsupported ARCH '$arch'" 1>&2
	exit 1
	;;
esac
readonly goarm variant

# scripts/make/version.sh only works on the upstream layout: it runs
# 'git rev-list --count master..HEAD' and expects release tags.  This fork is on
# 'main' and untagged, so compute a version here and pass it down — go-build.sh
# only falls back to version.sh when VERSION is empty or 'v0.0.0'.
version="${VERSION:-}"
if [ "$version" = '' ] || [ "$version" = 'v0.0.0' ]; then
	version="v0.0.0-dev+$(git rev-parse --short HEAD 2>/dev/null || echo 'nogit')"
fi
readonly version

out_dir="${dist_dir}/docker"
out="${out_dir}/DNSGuard_linux_${arch}_${variant}"
readonly out_dir out

# The Go binary embeds ./build, so the frontend has to exist first.
if [ "${SKIP_JS:-0}" -eq '0' ] && [ ! -f './build/index.html' ]; then
	echo 'building the frontend (set SKIP_JS=1 to skip)' 1>&2
	make js-deps js-build
fi

mkdir -p "$out_dir"

echo "building ${version} for linux/${arch}${variant:+/$variant} into ${out}" 1>&2

env \
	CHANNEL="$channel" \
	GOARM="$goarm" \
	GOOS='linux' \
	GOTOOLCHAIN="$gotoolchain" \
	GOARCH="$arch" \
	GO="$go" \
	OUT="$out" \
	VERBOSE="$verbose" \
	VERSION="$version" \
	sh ./scripts/make/go-build.sh

echo "done: ${out}" 1>&2
