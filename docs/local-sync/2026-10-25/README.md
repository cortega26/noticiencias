# Preserved worktree drafts — 2026-10-25

These patches preserve original local edits without activating incomplete or obsolete implementations. Each patch was applied to a temporary Git index at its recorded base and reconstructed every selected source file byte for byte. The manifest records SHA-256 hashes and the exact base commit. Restore only in an isolated worktree for integration review.

The Buffer draft changes client contracts and lacks exports required by the current publisher. It is not a drop-in replacement and is not approved for live distribution.

Runtime outputs, screenshots, caches and dependency symlinks from the old worktrees are recorded in the restricted local backup. They are not promoted into application source. Existing running services were not stopped. No source functionality or hosted deployment is claimed for these drafts.
