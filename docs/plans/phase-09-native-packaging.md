# Phase 9 — Native packaging

Status: Not started; explicitly outside the web `parity-v1` gate.

## Outcome

Package the shared web application with Tauri 2 and implement only platform adapters required by target stores.

## Entry evidence

Web `parity-v1` is reviewed first. Platform permissions and distribution requirements have current official references for the target being packaged.

## Validation

Build and launch each supported native target, verify native save location and recovery in the running WebView, and run platform E2E checks. These are native-release gates, not web `parity-v1` requirements. Android/iOS require their current SDKs and signing setup.
