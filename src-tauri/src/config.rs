use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EarlConfig {
    pub version: u32,
    pub display: DisplayConfig,
    pub sound: SoundConfig,
    pub behavior: BehaviorConfig,
    pub stats: StatsConfig,
    pub position: PositionConfig,
    #[serde(default)]
    pub mood: Option<MoodConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoodConfig {
    pub value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayConfig {
    pub size: u32,
    pub animation_speed: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoundConfig {
    pub enabled: bool,
    pub volume: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BehaviorConfig {
    pub launch_on_startup: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsConfig {
    pub first_launch_date: Option<String>,
    pub total_hops: u64,
    pub total_pixels_waddled: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PositionConfig {
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub on_taskbar: bool,
}

impl Default for EarlConfig {
    fn default() -> Self {
        Self {
            version: 1,
            display: DisplayConfig {
                size: 64,
                animation_speed: "normal".to_string(),
            },
            sound: SoundConfig {
                enabled: false,
                volume: 0.5,
            },
            behavior: BehaviorConfig {
                launch_on_startup: false,
            },
            stats: StatsConfig {
                first_launch_date: None,
                total_hops: 0,
                total_pixels_waddled: 0.0,
            },
            position: PositionConfig {
                x: None,
                y: None,
                on_taskbar: true,
            },
            mood: Some(MoodConfig { value: 50.0 }),
        }
    }
}

fn config_path(app: &tauri::AppHandle) -> PathBuf {
    let app_data = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data dir");
    app_data.join("config.json")
}

pub fn init_config(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let path = config_path(app);
    if !path.exists() {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut config = EarlConfig::default();
        config.stats.first_launch_date = Some(chrono_free_now());
        let json = serde_json::to_string_pretty(&config)?;
        fs::write(&path, json)?;
    }
    Ok(())
}

pub fn load_config(app: &tauri::AppHandle) -> Result<EarlConfig, Box<dyn std::error::Error>> {
    let path = config_path(app);
    if path.exists() {
        let data = fs::read_to_string(&path)?;
        let config: EarlConfig = serde_json::from_str(&data)?;
        Ok(config)
    } else {
        Ok(EarlConfig::default())
    }
}

pub fn write_config(
    app: &tauri::AppHandle,
    config: &EarlConfig,
) -> Result<(), Box<dyn std::error::Error>> {
    let path = config_path(app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(config)?;
    fs::write(&path, json)?;
    Ok(())
}

/// Simple ISO date string without pulling in chrono
fn chrono_free_now() -> String {
    // Use std::time — will give epoch seconds, format as basic ISO
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    // Convert to rough ISO date (good enough for "days since first launch")
    let days = now / 86400;
    let years = 1970 + days / 365;
    let remaining = days % 365;
    let month = remaining / 30 + 1;
    let day = remaining % 30 + 1;
    format!("{:04}-{:02}-{:02}T00:00:00Z", years, month, day)
}
