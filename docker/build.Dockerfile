# A docker file for scripts/make/build-docker.sh.

FROM alpine:3.23

ARG BUILD_DATE
ARG VERSION
ARG VCS_REF

LABEL \
	maintainer="0xphuong <me@binhphuong.io.vn>" \
	org.opencontainers.image.authors="0xphuong <me@binhphuong.io.vn>" \
	org.opencontainers.image.created=$BUILD_DATE \
	org.opencontainers.image.description="Network-wide ads & trackers blocking DNS server" \
	org.opencontainers.image.documentation="https://github.com/0xphuong/dnsguard/wiki/" \
	org.opencontainers.image.licenses="GPL-3.0" \
	org.opencontainers.image.revision=$VCS_REF \
	org.opencontainers.image.source="https://github.com/0xphuong/dnsguard" \
	org.opencontainers.image.title="DNSGuard" \
	org.opencontainers.image.url="https://github.com/0xphuong/dnsguard" \
	org.opencontainers.image.vendor="0xphuong" \
	org.opencontainers.image.version=$VERSION

# Update certificates.
RUN apk --no-cache add ca-certificates libcap tzdata && \
	mkdir -p /opt/dnsguard/conf /opt/dnsguard/work && \
	chown -R nobody: /opt/dnsguard

ARG DIST_DIR
ARG TARGETARCH
ARG TARGETOS
ARG TARGETVARIANT

COPY \
	--chmod=0755 \
	--chown=nobody:nogroup \
	./${DIST_DIR}/docker/DNSGuard_${TARGETOS}_${TARGETARCH}_${TARGETVARIANT} \
	/opt/dnsguard/DNSGuard

RUN setcap 'cap_net_bind_service=+eip' /opt/dnsguard/DNSGuard

# 53     : TCP, UDP : DNS
# 67     :      UDP : DHCP (server)
# 68     :      UDP : DHCP (client)
# 80     : TCP      : HTTP (main)
# 443    : TCP, UDP : HTTPS, DNS-over-HTTPS (incl. HTTP/3), DNSCrypt (main)
# 853    : TCP, UDP : DNS-over-TLS, DNS-over-QUIC
# 3000   : TCP, UDP : HTTP(S) (alt, incl. HTTP/3)
# 5443   : TCP, UDP : DNSCrypt (alt)
# 6060   : TCP      : HTTP (pprof)
EXPOSE 53/tcp 53/udp \
	67/udp \
	68/udp \
	80/tcp \
	443/tcp 443/udp \
	853/tcp 853/udp \
	3000/tcp 3000/udp \
	5443/tcp 5443/udp \
	6060/tcp

WORKDIR /opt/dnsguard/work

ENTRYPOINT ["/opt/dnsguard/DNSGuard"]

CMD [ \
	"--no-check-update", \
	"-c", "/opt/dnsguard/conf/dnsguard.yaml", \
	"-w", "/opt/dnsguard/work" \
]
