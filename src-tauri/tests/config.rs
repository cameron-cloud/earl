//! Config tests (docs/V2_PLAN.md 4.12 and D28, D30). These pin the build and
//! bundle settings that Tauri would otherwise change silently: at the wrong
//! nesting level `installMode` is ignored and a per-machine installer ships,
//! and a wrong updater key or URL only shows up once an update fails in the
//! field.

use std::path::{Path, PathBuf};

use serde_json::Value;

const UPDATER_ENDPOINT: &str =
    "https://github.com/cameron-cloud/earl/releases/latest/download/latest.json";

/// Base64 of "untrusted comment: minisign public key:" (39 bytes, so the
/// encoding of this prefix never depends on what follows it).
const MINISIGN_PUBLIC_KEY_PREFIX: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6";

/// Base64 of "untrusted comment: rsign", the start of a Tauri private key file.
const PRIVATE_KEY_PREFIX: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IHJzaWdu";

/// The v1 updater public key id. v2 uses fresh keypairs (D28).
const V1_PUBLIC_KEY: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDQyRkZCRkU4QTM2QTJDNDUK";

fn manifest_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn read(path: &Path) -> String {
    std::fs::read_to_string(path).unwrap_or_else(|e| panic!("reading {}: {e}", path.display()))
}

fn json(name: &str) -> Value {
    let path = manifest_dir().join(name);
    serde_json::from_str(&read(&path)).unwrap_or_else(|e| panic!("parsing {name}: {e}"))
}

fn base() -> Value {
    json("tauri.conf.json")
}

fn str_at<'a>(value: &'a Value, pointer: &str) -> &'a str {
    value
        .pointer(pointer)
        .and_then(Value::as_str)
        .unwrap_or_else(|| panic!("{pointer} is missing or not a string"))
}

#[test]
fn schema_points_at_tauri_v2() {
    assert_eq!(
        str_at(&base(), "/$schema"),
        "https://schema.tauri.app/config/2"
    );
}

#[test]
fn bundle_is_a_per_user_nsis_installer() {
    let config = base();
    assert_eq!(
        config.pointer("/bundle/targets"),
        Some(&serde_json::json!(["nsis"])),
        "NSIS only (D28)"
    );
    assert_eq!(
        str_at(&config, "/bundle/windows/nsis/installMode"),
        "currentUser",
        "bundle.windows.nsis.installMode must be currentUser (4.12)"
    );
}

#[test]
fn updater_installs_passively_from_the_latest_release() {
    let config = base();
    assert_eq!(
        str_at(&config, "/plugins/updater/windows/installMode"),
        "passive"
    );
    assert_eq!(
        config.pointer("/plugins/updater/endpoints"),
        Some(&serde_json::json!([UPDATER_ENDPOINT]))
    );
}

#[test]
fn overlay_window_is_created_unfocused() {
    let config = base();
    let windows = config
        .pointer("/app/windows")
        .and_then(Value::as_array)
        .expect("app.windows");
    let label = |w: &Value| w.get("label").and_then(Value::as_str).map(str::to_owned);
    match windows.iter().find(|w| label(w).as_deref() == Some("overlay")) {
        Some(overlay) => assert_eq!(
            overlay.get("focus"),
            Some(&Value::Bool(false)),
            "the overlay must never take focus (4.1, 4.12)"
        ),
        // Until M1 replaces the v1 "main" strip with the v2 overlay, M0 keeps
        // v1 behavior unchanged. This check turns itself on when the overlay
        // window appears; an unknown layout fails instead of passing quietly.
        None => assert!(
            windows.iter().any(|w| label(w).as_deref() == Some("main")),
            "neither the v2 overlay nor the v1 main window is configured"
        ),
    }
}

#[test]
fn version_is_read_from_package_json_and_matches_cargo() {
    assert_eq!(str_at(&base(), "/version"), "../package.json");

    let package: Value = serde_json::from_str(&read(&manifest_dir().join("../package.json")))
        .expect("parsing package.json");
    let npm_version = str_at(&package, "/version");

    let cargo_toml = read(&manifest_dir().join("Cargo.toml"));
    let cargo_version = cargo_toml
        .split("[package]")
        .nth(1)
        .and_then(|package| {
            package
                .lines()
                .take_while(|line| !line.starts_with('['))
                .find_map(|line| line.strip_prefix("version = "))
        })
        .map(|v| v.trim().trim_matches('"'))
        .expect("[package] version in Cargo.toml");

    assert_eq!(
        npm_version, cargo_version,
        "package.json and Cargo.toml disagree; run scripts/bump-version.mjs"
    );
}

#[test]
fn csp_allows_no_remote_origins() {
    let config = base();
    let csp = str_at(&config, "/app/security/csp");
    assert!(csp.contains("default-src 'self'"), "{csp}");
    assert!(csp.contains("object-src 'none'"), "{csp}");
    let allowed_local = ["http://ipc.localhost", "http://asset.localhost"];
    for token in csp.split([' ', ';']).filter(|t| !t.is_empty()) {
        let remote = token.starts_with("http:") || token.starts_with("https:") || token == "*";
        assert!(
            !remote || allowed_local.contains(&token),
            "CSP allows a remote origin: {token}. The updater runs in Rust and needs none."
        );
    }
}

#[test]
fn updater_keys_only_ship_in_release_and_preview_builds() {
    let config = base();
    assert_eq!(
        str_at(&config, "/plugins/updater/pubkey"),
        "",
        "dev and branch builds carry no updater key (D28)"
    );
    assert_eq!(
        config.pointer("/bundle/createUpdaterArtifacts"),
        Some(&Value::Bool(false))
    );

    let release = json("tauri.release.conf.json");
    let preview = json("tauri.preview.conf.json");
    for (name, overlay) in [("release", &release), ("preview", &preview)] {
        let key = str_at(overlay, "/plugins/updater/pubkey");
        assert!(
            key.starts_with(MINISIGN_PUBLIC_KEY_PREFIX),
            "{name} pubkey is not a minisign public key"
        );
        assert!(
            !key.starts_with(V1_PUBLIC_KEY),
            "{name} still uses the v1 key"
        );
        assert_eq!(
            overlay.pointer("/bundle/createUpdaterArtifacts"),
            Some(&Value::Bool(true)),
            "{name} builds must produce signed updater artifacts"
        );
    }
    assert_ne!(
        str_at(&release, "/plugins/updater/pubkey"),
        str_at(&preview, "/plugins/updater/pubkey"),
        "preview and production must use separate keypairs (D28)"
    );
}

#[test]
fn no_private_key_is_committed_in_config() {
    for name in [
        "tauri.conf.json",
        "tauri.release.conf.json",
        "tauri.preview.conf.json",
    ] {
        assert!(
            !read(&manifest_dir().join(name)).contains(PRIVATE_KEY_PREFIX),
            "{name} contains a private updater key"
        );
    }
}

#[test]
fn single_instance_plugin_is_registered_first() {
    let lib = read(&manifest_dir().join("src/lib.rs"));
    let first_plugin = lib
        .find(".plugin(")
        .map(|at| &lib[at..])
        .expect("no plugins registered");
    assert!(
        first_plugin.starts_with(".plugin(tauri_plugin_single_instance::init("),
        "tauri-plugin-single-instance must be the first plugin (D30)"
    );
}
