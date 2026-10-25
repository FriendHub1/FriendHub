# XOXO Safety BETA deployment activation

Deployment requested on 2026-10-25 after the owner configured the GitHub Actions BETA-only Cloudflare token, account ID and repository deployment flag.

This file is a trigger marker only. The isolated workflow validates the BETA bundle before any deployment and targets `xoxo-safety-beta`, never the production `friendhub` Worker. Confirm the deploy job and workers.dev URL from GitHub Actions logs before testing.
