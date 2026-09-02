package updater_test

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"

	"github.com/0xphuong/dnsguard/internal/updater"
	"github.com/AdguardTeam/golibs/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// manifestPath is the published version manifest, relative to this package.
// [updater.DefaultVersionURL] serves it out of the repository, so a malformed
// manifest breaks the update check for every installation.
const manifestPath = "../../release/version.json"

// TestPublishedManifest feeds the committed manifest through the real parser,
// so that neither a hand edit nor a bad build-release run can ship a manifest
// that the updater rejects.
func TestPublishedManifest(t *testing.T) {
	t.Parallel()

	data, err := os.ReadFile(manifestPath)
	require.NoError(t, err)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write(data)
	}))
	t.Cleanup(srv.Close)

	srvURL, err := url.Parse(srv.URL)
	require.NoError(t, err)

	// The updater fails outright when the running platform has no download key,
	// so assert one exists for every platform the release script builds.
	platforms := []struct {
		goos   string
		goarch string
	}{
		{goos: "linux", goarch: "amd64"},
		{goos: "linux", goarch: "arm64"},
		{goos: "linux", goarch: "386"},
		{goos: "linux", goarch: "ppc64le"},
		{goos: "darwin", goarch: "amd64"},
		{goos: "darwin", goarch: "arm64"},
		{goos: "windows", goarch: "amd64"},
		{goos: "freebsd", goarch: "amd64"},
	}

	for _, p := range platforms {
		t.Run(p.goos+"_"+p.goarch, func(t *testing.T) {
			t.Parallel()

			wd := t.TempDir()
			u := updater.NewUpdater(&updater.Config{
				Client:             srv.Client(),
				Logger:             testLogger,
				CommandConstructor: testCmdCons,
				GOARCH:             p.goarch,
				GOOS:               p.goos,
				Version:            "v0.0.0",
				ConfName:           filepath.Join(wd, "dnsguard.yaml"),
				WorkDir:            wd,
				ExecPath:           filepath.Join(wd, "DNSGuard"),
				VersionCheckURL:    srvURL,
			})

			ctx := testutil.ContextWithTimeout(t, testTimeout)
			vi, err := u.VersionInfo(ctx, true)
			require.NoError(t, err)

			assert.NotEmpty(t, vi.NewVersion)
			assert.NotEmpty(t, vi.Announcement)
			assert.NotEmpty(t, vi.AnnouncementURL)
		})
	}
}
