# Security review — 2026-09-03

Reviewed at commit `b0c2e7f` (tag `v1.0.0`), against a running instance built
from that tree.

Nothing here has been changed. Each finding records what was measured, so it
can be re-checked rather than taken on trust, and the fix it would take. The
order is by severity, not by effort.

## How this was measured

Findings were taken from the code and from a live instance rather than from
reading alone: HTTP responses and headers with `curl`, the container's
identity and capabilities with `docker exec` and `docker inspect`, the
resolver's effective configuration from the config file the running server
wrote, and dependency advisories with `npm audit` followed by checking whether
the vulnerable code path is reachable at all.

## High

### 1. The compose file publishes the admin panel to every interface

`docker-compose.yml` maps ports `80` and `3000` with no host address, which
Docker binds to `0.0.0.0`. On a host with a public address, `docker compose up`
puts the login form for a network's DNS controller on the internet, over plain
HTTP: the password and the session token cross the network in the clear.

This is ours, not inherited — the compose file is a file this repository
added.

**Fix.** Bind the panel's published ports to a specific address, so the
default is reachable only from where an operator actually administers it, and
document putting TLS in front of it for anything wider. The DNS ports are a
separate decision, see finding 6.

### 2. The container runs as root

Measured: `docker exec dnsguard id` returns `uid=0(root)`, and PID 1 is
`DNSGuard` running as root.

Everything needed to avoid that is already in place. `docker/build.Dockerfile`
does `chown -R nobody: /opt/dnsguard`, copies the binary
`--chown=nobody:nogroup`, and sets a file capability — `getcap` inside the
container confirms `cap_net_bind_service=eip`, which is exactly what lets a
non-root process bind port 53. The `USER` directive is simply missing.

**Fix.** Add it. Two things make this less than a one-line change and should
be tested before it ships: the built-in DHCP server needs `NET_ADMIN` for raw
sockets, which a file capability does not carry, and bind-mounted host
directories need ownership that matches the new user or the server cannot
write its config.

## Medium

### 3. The session cookie is long-lived and never marked Secure

`internal/home/authhttp.go` sets `cookieTTL = 365 * timeutil.Day` as a
constant, so a stolen cookie is valid for a year and the lifetime cannot be
configured. The `http.Cookie` it builds has no `Secure` field at all, so the
cookie is not restricted to TLS even when the panel is served over HTTPS.

`HttpOnly` and `SameSite=Lax` are both set, which is right.

**Fix.** Set `Secure` when the request arrived over TLS, make the lifetime
configurable with a shorter default, and rename `agh_session` (see finding 7).

### 4. No security response headers

Measured on `GET /login.html`: `Content-Security-Policy`,
`Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy` and `Cross-Origin-Opener-Policy` are
all absent.

A policy matters more than usual here because the frontend has three places
that assign `innerHTML`: the blocked-service icons, the chart tooltip, and one
line in `index.tsx`. None of them currently receives untrusted data (see
"Verified sound"), but a policy is what keeps that true when someone adds the
fourth.

**Fix.** Send them from the web layer. Chart.js and the inline theme script in
the HTML shells will both constrain what the policy can say, so it needs
measuring rather than copying from elsewhere.

### 5. The update path verifies nothing beyond TLS

`internal/updater/updater.go` fetches its manifest and package over HTTPS, and
contains no `sha256`, `signature` or `checksum` anywhere. Whoever controls the
release assets controls the binary that replaces the running one.

This repository points the updater at its own `version.json`, which means the
GitHub account hosting it is now part of the security boundary: two-factor
authentication on that account is a control, not a convenience.

**Fix.** Publish a checksum file with each release and verify it before
unpacking; signing the manifest is the stronger version of the same idea.

### 6. Open-resolver posture

A fresh install writes `bind_hosts: [0.0.0.0]` and `allowed_clients: []`, and
an empty allowlist means every client is allowed. Combined with the compose
file publishing the DNS ports, a public host will answer recursive queries for
anyone.

Two mitigations are already on by default and worth crediting:
`ratelimit: 20` per IPv4 /24, and `refuse_any: true`, which refuses the query
type most used for amplification.

**Fix.** Decide deliberately: either bind the resolver to the interface that
serves the network, or set an allowlist. The compose file should say which it
assumes.

## Low

### 7. Rebrand leftovers with consequences

- `SECURITY.md` still asks for vulnerability reports at
  `security@adguard.com`. Someone finding a flaw in this fork would report it
  to people who do not maintain it, and would reasonably assume it had been
  received.
- The session cookie is still named `agh_session`, which also identifies the
  product to anyone looking.
- The install wizard still requires agreement to AdGuard's privacy policy and
  terms, linking to `link.adtidy.org`, before setup can continue.

### 8. `js-yaml` is an unused runtime dependency carrying two high advisories

It is declared in `dependencies`, imported nowhere in `client_v2/src`, and
absent from the built bundle. Removing it removes both advisories.

### 9. Advisories that exist but are not reachable

`npm audit --production` reports four. None is reachable as the code stands:

| Package | Advisory needs | This code does |
|---|---|---|
| `qs` | attacker-controlled input to `parse` | only ever calls `stringify` |
| `nanoid` | a negative `size` argument | calls `nanoid()` with no argument |
| `js-yaml` | parsing untrusted YAML | never imported, not bundled |
| `valibot` | `flatten()` on a crafted record | transitive, not called directly |

They should still be upgraded, but as maintenance rather than incident
response.

### 10. No Host or Origin validation

The panel answers requests with any `Host` header. This is a hardening gap
rather than a live vulnerability: every `/control/*` endpoint tested returns
401 without a session cookie, and a rebinding attack does not carry the
panel's cookie, so it reaches only the unauthenticated surface.

### 11. A latent hazard worth naming

`createExternalTooltipHandler` in `client_v2/src/helpers/useChart.ts` takes a
callback whose contract is "return a string to assign to `innerHTML`". Its one
caller interpolates a number and a client-generated date label, which is safe.
The next tooltip that shows a domain name from the query log would not be:
query names are chosen by whoever makes the query.

**Fix.** Change the contract to return nodes rather than markup, so the shape
of the helper stops inviting it.

### 12. Default blocklists come from AdGuard's registry

Two lists from `adguardteam.github.io/HostlistsRegistry` are enabled on a
fresh install. This is legitimate and over HTTPS, but it means another party
decides what this resolver blocks by default. Worth a deliberate decision now
that the product is maintained here.

### 13. A publicly known test key is in the tree

`internal/home/testdata/key.pem` is a 1024-bit RSA key from upstream, dated
2019 and self-signed as `CN=AdGuard Home`. It is a test fixture and is used
only by tests. It is listed here so nobody mistakes it for a key that could be
used.

## Verified sound

Recorded because knowing what was checked is as useful as knowing what failed.

| Checked | Result |
|---|---|
| Ten `/control/*` endpoints without a session | 401, zero-length body, every one |
| Password storage | bcrypt at default cost |
| Login brute force | rate limited; the sixth wrong attempt returns 429 |
| Session cookie flags | `HttpOnly` and `SameSite=Lax` both set |
| Profiling endpoint | not listening; only 80 and 53 are bound |
| Archive extraction in the updater | `filepath.Base` strips any path, and non-regular entries are skipped, so a crafted archive cannot write outside the target directory |
| Blocked-service SVG injection | the service list is code-generated into the binary, not fetched at runtime |
| Chart tooltip HTML | interpolates a number and a locally formatted date only |
| Secrets and internal hostnames in tracked files | none; the two matches a pattern search returned were a Node `os.networkInterfaces()` property and the upstream test key above |
| Unexpected outbound calls | none beyond the filter lists in finding 12 |
