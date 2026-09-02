package updater_test

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/0xphuong/dnsguard/internal/aghalg"
	"github.com/0xphuong/dnsguard/internal/aghtest"
	"github.com/0xphuong/dnsguard/internal/updater"
	"github.com/0xphuong/dnsguard/internal/version"
	"github.com/AdguardTeam/golibs/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpdater_VersionInfo(t *testing.T) {
	const jsonData = `{
  "version": "v0.103.0-beta.2",
  "announcement": "DNSGuard v0.103.0-beta.2 is now available!",
  "announcement_url": "https://github.com/0xphuong/dnsguard/internal/releases",
  "selfupdate_min_version": "v0.0",
  "download_windows_amd64": "https://github.com/0xphuong/dnsguard/releases/latest/download/AdGuardHome_windows_amd64.zip",
  "download_windows_386": "https://github.com/0xphuong/dnsguard/releases/latest/download/AdGuardHome_windows_386.zip",
  "download_darwin_amd64": "https://github.com/0xphuong/dnsguard/releases/latest/download/AdGuardHome_darwin_amd64.zip",
  "download_darwin_386": "https://github.com/0xphuong/dnsguard/releases/latest/download/AdGuardHome_darwin_386.zip",
  "download_linux_amd64": "https://github.com/0xphuong/dnsguard/releases/latest/download/AdGuardHome_linux_amd64.tar.gz",
  "download_linux_386": "https://github.com/0xphuong/dnsguard/releases/latest/download/AdGuardHome_linux_386.tar.gz",
  "download_linux_arm": "https://github.com/0xphuong/dnsguard/releases/latest/download/AdGuardHome_linux_armv6.tar.gz",
  "download_linux_armv5": "https://github.com/0xphuong/dnsguard/releases/latest/download/AdGuardHome_linux_armv5.tar.gz",
  "download_linux_armv6": "https://github.com/0xphuong/dnsguard/releases/latest/download/AdGuardHome_linux_armv6.tar.gz",
  "download_linux_armv7": "https://github.com/0xphuong/dnsguard/releases/latest/download/AdGuardHome_linux_armv7.tar.gz",
  "download_linux_arm64": "https://github.com/0xphuong/dnsguard/releases/latest/download/AdGuardHome_linux_arm64.tar.gz",
  "download_linux_mips": "https://github.com/0xphuong/dnsguard/releases/latest/download/AdGuardHome_linux_mips_softfloat.tar.gz",
  "download_linux_mipsle": "https://github.com/0xphuong/dnsguard/releases/latest/download/AdGuardHome_linux_mipsle_softfloat.tar.gz",
  "download_linux_mips64": "https://github.com/0xphuong/dnsguard/releases/latest/download/AdGuardHome_linux_mips64_softfloat.tar.gz",
  "download_linux_mips64le": "https://github.com/0xphuong/dnsguard/releases/latest/download/AdGuardHome_linux_mips64le_softfloat.tar.gz",
  "download_freebsd_386": "https://github.com/0xphuong/dnsguard/releases/latest/download/AdGuardHome_freebsd_386.tar.gz",
  "download_freebsd_amd64": "https://github.com/0xphuong/dnsguard/releases/latest/download/AdGuardHome_freebsd_amd64.tar.gz",
  "download_freebsd_arm": "https://github.com/0xphuong/dnsguard/releases/latest/download/AdGuardHome_freebsd_armv6.tar.gz",
  "download_freebsd_armv5": "https://github.com/0xphuong/dnsguard/releases/latest/download/AdGuardHome_freebsd_armv5.tar.gz",
  "download_freebsd_armv6": "https://github.com/0xphuong/dnsguard/releases/latest/download/AdGuardHome_freebsd_armv6.tar.gz",
  "download_freebsd_armv7": "https://github.com/0xphuong/dnsguard/releases/latest/download/AdGuardHome_freebsd_armv7.tar.gz",
  "download_freebsd_arm64": "https://github.com/0xphuong/dnsguard/releases/latest/download/AdGuardHome_freebsd_arm64.tar.gz"
}`

	counter := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		counter++
		_, _ = w.Write([]byte(jsonData))
	}))
	t.Cleanup(srv.Close)

	srvURL, err := url.Parse(srv.URL)
	require.NoError(t, err)

	fakeURL := srvURL.JoinPath("dnsguard", version.ChannelBeta, "version.json")

	u := updater.NewUpdater(&updater.Config{
		Client:             srv.Client(),
		Logger:             testLogger,
		CommandConstructor: testCmdCons,
		Version:            "v0.103.0-beta.1",
		Channel:            version.ChannelBeta,
		GOARCH:             "arm",
		GOOS:               "linux",
		VersionCheckURL:    fakeURL,
	})

	ctx := testutil.ContextWithTimeout(t, testTimeout)
	info, err := u.VersionInfo(ctx, false)
	require.NoError(t, err)

	assert.Equal(t, counter, 1)
	assert.Equal(t, "v0.103.0-beta.2", info.NewVersion)
	assert.Equal(t, "DNSGuard v0.103.0-beta.2 is now available!", info.Announcement)
	assert.Equal(t, "https://github.com/0xphuong/dnsguard/internal/releases", info.AnnouncementURL)
	assert.Equal(t, aghalg.NBTrue, info.CanAutoUpdate)

	t.Run("cache_check", func(t *testing.T) {
		_, err = u.VersionInfo(testutil.ContextWithTimeout(t, testTimeout), false)
		require.NoError(t, err)

		assert.Equal(t, counter, 1)
	})

	t.Run("force_check", func(t *testing.T) {
		_, err = u.VersionInfo(testutil.ContextWithTimeout(t, testTimeout), true)
		require.NoError(t, err)

		assert.Equal(t, counter, 2)
	})

	t.Run("api_fail", func(t *testing.T) {
		srv.Close()

		_, err = u.VersionInfo(testutil.ContextWithTimeout(t, testTimeout), true)
		var urlErr *url.Error
		assert.ErrorAs(t, err, &urlErr)
	})
}

func TestUpdater_VersionInfo_others(t *testing.T) {
	const jsonData = `{
  "version": "v0.103.0-beta.2",
  "announcement": "DNSGuard v0.103.0-beta.2 is now available!",
  "announcement_url": "https://github.com/0xphuong/dnsguard/internal/releases",
  "selfupdate_min_version": "v0.0",
  "download_linux_armv7": "https://github.com/0xphuong/dnsguard/releases/latest/download/AdGuardHome_linux_armv7.tar.gz",
  "download_linux_mips_softfloat": "https://github.com/0xphuong/dnsguard/releases/latest/download/AdGuardHome_linux_mips_softfloat.tar.gz"
}`

	handler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		pt := testutil.NewPanicT(t)

		_, err := w.Write([]byte(jsonData))
		require.NoError(pt, err)
	})

	fakeClient, fakeURL := aghtest.StartHTTPServer(t, handler)
	fakeURL = fakeURL.JoinPath("dnsguard", version.ChannelBeta, "version.json")

	testCases := []struct {
		name string
		arch string
		arm  string
		mips string
	}{{
		name: "ARM",
		arch: "arm",
		arm:  "7",
		mips: "",
	}, {
		name: "MIPS",
		arch: "mips",
		mips: "softfloat",
		arm:  "",
	}}

	for _, tc := range testCases {
		u := updater.NewUpdater(&updater.Config{
			Client:             fakeClient,
			Logger:             testLogger,
			CommandConstructor: testCmdCons,
			Version:            "v0.103.0-beta.1",
			Channel:            version.ChannelBeta,
			GOOS:               "linux",
			GOARCH:             tc.arch,
			GOARM:              tc.arm,
			GOMIPS:             tc.mips,
			VersionCheckURL:    fakeURL,
		})

		ctx := testutil.ContextWithTimeout(t, testTimeout)
		info, err := u.VersionInfo(ctx, false)
		require.NoError(t, err)

		assert.Equal(t, "v0.103.0-beta.2", info.NewVersion)
		assert.Equal(t, "DNSGuard v0.103.0-beta.2 is now available!", info.Announcement)
		assert.Equal(t, "https://github.com/0xphuong/dnsguard/internal/releases", info.AnnouncementURL)
		assert.Equal(t, aghalg.NBTrue, info.CanAutoUpdate)
	}
}
