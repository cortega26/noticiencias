# Changelog

All notable changes to this project will be documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [0.1.0] - 2026-01-24

### Security

- **Lodash Vulnerability Fix**: Forced resolution of `lodash` to version `4.17.23` via `package.json` overrides to address prototype pollution vulnerability (GHSA-xxjr-mmjv-4gpg) introduced transitively by `@astrojs/check`.
