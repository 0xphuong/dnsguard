package home

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/AdguardTeam/golibs/logutil/slogutil"
	"github.com/AdguardTeam/golibs/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// writeConf creates an empty file called name inside dir.
func writeConf(t *testing.T, dir, name string) {
	t.Helper()

	require.NoError(t, os.WriteFile(filepath.Join(dir, name), []byte("{}\n"), 0o644))
}

func TestInitConfigFilename(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name    string
		cmdline string
		present []string
		want    string
	}{{
		name:    "default_only",
		cmdline: "",
		present: []string{defaultConfFilename},
		want:    defaultConfFilename,
	}, {
		name:    "legacy_only",
		cmdline: "",
		present: []string{legacyConfFilename},
		want:    legacyConfFilename,
	}, {
		name:    "both_prefers_default",
		cmdline: "",
		present: []string{defaultConfFilename, legacyConfFilename},
		want:    defaultConfFilename,
	}, {
		name:    "neither_is_first_run",
		cmdline: "",
		present: nil,
		want:    defaultConfFilename,
	}}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			workDir := t.TempDir()
			for _, n := range tc.present {
				writeConf(t, workDir, n)
			}

			ctx := testutil.ContextWithTimeout(t, testTimeout)
			got := initConfigFilename(ctx, slogutil.NewDiscardLogger(), options{
				confFilename: tc.cmdline,
			}, workDir)

			assert.Equal(t, filepath.Join(workDir, tc.want), got)
		})
	}

	t.Run("cmdline_existing_wins", func(t *testing.T) {
		t.Parallel()

		confDir := t.TempDir()
		writeConf(t, confDir, "custom.yaml")
		writeConf(t, confDir, legacyConfFilename)

		want := filepath.Join(confDir, "custom.yaml")
		ctx := testutil.ContextWithTimeout(t, testTimeout)
		got := initConfigFilename(ctx, slogutil.NewDiscardLogger(), options{
			confFilename: want,
		}, t.TempDir())

		assert.Equal(t, want, got)
	})

	// This is the Docker case: the image pins -c at conf/dnsguard.yaml, but a
	// container upgraded in place only has the legacy file there.
	t.Run("cmdline_missing_falls_back_to_sibling", func(t *testing.T) {
		t.Parallel()

		confDir := t.TempDir()
		writeConf(t, confDir, legacyConfFilename)

		ctx := testutil.ContextWithTimeout(t, testTimeout)
		got := initConfigFilename(ctx, slogutil.NewDiscardLogger(), options{
			confFilename: filepath.Join(confDir, defaultConfFilename),
		}, t.TempDir())

		assert.Equal(t, filepath.Join(confDir, legacyConfFilename), got)
	})

	t.Run("cmdline_missing_and_no_legacy", func(t *testing.T) {
		t.Parallel()

		want := filepath.Join(t.TempDir(), "custom.yaml")
		ctx := testutil.ContextWithTimeout(t, testTimeout)
		got := initConfigFilename(ctx, slogutil.NewDiscardLogger(), options{
			confFilename: want,
		}, t.TempDir())

		assert.Equal(t, want, got)
	})
}
