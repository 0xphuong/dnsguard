#!/bin/sh

# Builds a DNSGuard container image for one or more platforms.
#
# Wraps the two steps that have to agree and are easy to get wrong on their
# own: prepare-dist.sh cross-compiles a binary and names the file after its
# architecture, and build.Dockerfile picks that file by TARGETARCH.  Run
# either one with the wrong architecture and you get an image that will not
# start, with no error until it is deployed.
#
# Usage:
#	sh ./docker/build-image.sh --version v1.0.0
#	sh ./docker/build-image.sh -v v1.0.0 -p linux/amd64
#	sh ./docker/build-image.sh -v v1.0.0 -p linux/amd64,linux/arm64 --push
#	sh ./docker/build-image.sh -v v1.0.0 -r myuser/dnsguard -p linux/amd64
#
# Options:
#	-v, --version <v>   Version baked into the binary and the image labels.
#	                    Default: the most recent git tag, or a dev version
#	                    derived from the current commit when there is none.
#	-p, --platform <p>  Comma-separated list, e.g. linux/amd64,linux/arm/v7.
#	                    Default: this machine's Docker architecture, which on
#	                    an Apple Silicon Mac is arm64 and will not run on the
#	                    usual x86-64 server.
#	-c, --channel <c>   development | edge | beta | release | candidate.
#	                    Decides which version.json the updater consults.
#	                    Default: release.
#	-r, --repo <r>      Image repository.  Default: binhphuong/dnsguard.
#	-t, --tag <t>       Full image reference, overriding --repo and the
#	                    version.  Default: <repo>:<version>, with the
#	                    architecture appended for a local single-platform
#	                    build so two runs cannot overwrite each other; a
#	                    push keeps the plain <repo>:<version>.
#	-b, --builder <b>   buildx builder to use.  Default: the current one.
#	    --push          Push to a registry instead of loading locally.
#	                    Required for more than one platform: a local image
#	                    store cannot hold a multi-architecture manifest.
#	    --skip-js       Reuse ./build instead of rebuilding the frontend.
#	-h, --help          Print this and exit.

set -e -f -u

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
repo_dir=$(CDPATH='' cd -- "${script_dir}/.." && pwd)
readonly script_dir repo_dir

version=''
platforms=''
channel='release'
repo='binhphuong/dnsguard'
tag=''
builder=''
push='0'
skip_js='0'

# Prints the comment block at the top of this file, stopping at the first line
# that is not a comment, so the help text cannot drift out of date or bleed
# into the code the way a hardcoded line range does.
usage() {
	awk 'NR > 2 { if (!/^#/) exit; sub(/^# ?/, ""); print }' "$0"
}

die() {
	echo "error: $*" 1>&2
	exit 1
}

# Every option that takes a value goes through need_value, so a missing one
# reports itself by name rather than as a shell parameter error.
need_value() {
	[ "$2" -ge 2 ] || die "$1 needs a value; try --help"
}

while [ "$#" -gt 0 ]; do
	case "$1" in
	-v | --version) need_value "$1" "$#"; version="$2"; shift 2 ;;
	-p | --platform) need_value "$1" "$#"; platforms="$2"; shift 2 ;;
	-c | --channel) need_value "$1" "$#"; channel="$2"; shift 2 ;;
	-r | --repo) need_value "$1" "$#"; repo="$2"; shift 2 ;;
	-t | --tag) need_value "$1" "$#"; tag="$2"; shift 2 ;;
	-b | --builder) need_value "$1" "$#"; builder="$2"; shift 2 ;;
	--push) push='1'; shift ;;
	--skip-js) skip_js='1'; shift ;;
	-h | --help) usage; exit 0 ;;
	*) die "unknown option '$1'; try --help" ;;
	esac
done

case "$channel" in
'development' | 'edge' | 'beta' | 'release' | 'candidate') ;;
*) die "invalid channel '${channel}'; one of development, edge, beta, release, candidate" ;;
esac

# Default to the tag the repository is actually on, which is what someone
# cutting a release almost always wants, and fall back to a commit-derived dev
# version when the repository has no tags yet.
if [ "$version" = '' ]; then
	version=$(git -C "$repo_dir" describe --tags --abbrev=0 2>/dev/null || true)
	if [ "$version" = '' ]; then
		version="v0.0.0-dev+$(git -C "$repo_dir" rev-parse --short HEAD 2>/dev/null || echo 'nogit')"
	fi
	echo "no --version given, using ${version}" 1>&2
fi

if [ "$platforms" = '' ]; then
	platforms="linux/$(docker version --format '{{ .Server.Arch }}' 2>/dev/null || echo 'amd64')"
	echo "no --platform given, using ${platforms}" 1>&2
fi

platform_count=$(printf '%s' "$platforms" | tr ',' '\n' | grep -c . || true)
readonly platform_count

if [ "$platform_count" -gt 1 ] && [ "$push" = '0' ]; then
	die "$(printf '%s\n' \
		"--platform lists ${platform_count} platforms but --push was not given." \
		"  A local image store holds one architecture per tag, so buildx cannot" \
		"  load a multi-architecture manifest.  Either add --push, or build one" \
		"  platform at a time.")"
fi

cd "$repo_dir"

# The Go binary embeds ./build, so the frontend is built once here rather than
# once per platform.
if [ "$skip_js" = '0' ]; then
	echo '==> building the frontend' 1>&2
	make js-deps js-build
fi

for platform in $(printf '%s' "$platforms" | tr ',' ' '); do
	os=$(printf '%s' "$platform" | cut -d/ -f1)
	arch=$(printf '%s' "$platform" | cut -d/ -f2)
	variant=$(printf '%s' "$platform" | cut -d/ -f3)

	[ "$os" = 'linux' ] ||
		die "platform '${platform}': only linux is supported, the binary is built with GOOS=linux"
	[ "$arch" != '' ] ||
		die "platform '${platform}': missing architecture, expected e.g. linux/amd64"

	echo "==> building the ${platform} binary" 1>&2
	if [ "$arch" = 'arm' ]; then
		# linux/arm/v7 -> GOARM=7; bare linux/arm defaults to v7 downstream.
		env ARCH="$arch" GOARM="${variant#v}" VERSION="$version" CHANNEL="$channel" \
			SKIP_JS=1 sh ./docker/prepare-dist.sh
	else
		env ARCH="$arch" VERSION="$version" CHANNEL="$channel" \
			SKIP_JS=1 sh ./docker/prepare-dist.sh
	fi
done

if [ "$tag" = '' ]; then
	tag="${repo}:${version}"
	# A local build of one platform gets the architecture in its tag, so
	# building amd64 after arm64 does not silently replace it in the image
	# store.  A push does not: what lands in the registry should be the plain
	# version, and a multi-platform push publishes one manifest under it.
	if [ "$platform_count" -eq 1 ] && [ "$push" = '0' ]; then
		only_arch=$(printf '%s' "$platforms" | cut -d/ -f2)
		tag="${tag}-${only_arch}"
	fi
fi
readonly tag

set -- \
	--platform "$platforms" \
	--file ./docker/build.Dockerfile \
	--build-arg "DIST_DIR=dist" \
	--build-arg "VERSION=${version}" \
	--build-arg "BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
	--build-arg "VCS_REF=$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')" \
	--tag "$tag"

if [ "$builder" != '' ]; then
	set -- --builder "$builder" "$@"
fi

if [ "$push" = '1' ]; then
	set -- "$@" --push
else
	set -- "$@" --load
fi

echo "==> building image ${tag} for ${platforms}" 1>&2
docker buildx build "$@" .

if [ "$push" = '1' ]; then
	echo "pushed ${tag}" 1>&2
else
	echo "loaded ${tag} ($(docker image inspect "$tag" --format '{{.Os}}/{{.Architecture}}'))" 1>&2
fi
