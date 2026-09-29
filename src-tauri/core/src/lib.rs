//! `earl-core` holds Earl's pure logic: geometry, taskbar and fullscreen
//! classification, hit testing, settings validation and migration.
//!
//! It has no Tauri or Win32 dependency, so everything in it builds and tests
//! on Linux (`cargo test -p earl-core`). The platform layer in the app crate
//! feeds it plain data and acts on its answers.
//!
//! Empty until M1.0 adds the settings schema (see docs/V2_PLAN.md, section 3).
