use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{self, Read};
use std::path::{Component, Path, PathBuf};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, WebviewWindow, WindowEvent};
use walkdir::{DirEntry, WalkDir};

const MAX_MANIFEST_FILES: usize = 10_000;
const MAX_INDEXABLE_FILE_BYTES: u64 = 5 * 1024 * 1024;
const MAIN_WINDOW_LABEL: &str = "main";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ManifestFile {
    relative_path: String,
    file_name: String,
    extension: String,
    language: String,
    size_bytes: u64,
    sha256: Option<String>,
    excluded: bool,
    excluded_reason: Option<String>,
}

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanSummary {
    requested_file_count: usize,
    target_file_count: usize,
    excluded_file_count: usize,
    sensitive_file_count: usize,
    large_file_count: usize,
    generated_or_tooling_file_count: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectScanResult {
    root_name: String,
    root_path_alias: String,
    files: Vec<ManifestFile>,
    summary: ScanSummary,
}

#[tauri::command]
fn scan_project_manifest(root_path: String) -> Result<ProjectScanResult, String> {
    let root = fs::canonicalize(PathBuf::from(root_path))
        .map_err(|error| format!("프로젝트 폴더를 확인할 수 없습니다: {}", error))?;

    if !root.is_dir() {
        return Err("프로젝트 폴더만 선택할 수 있습니다.".to_string());
    }

    let root_name = root
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .filter(|value| !value.is_blank())
        .unwrap_or_else(|| "DevJarvis Project".to_string());

    let mut files = Vec::new();
    for entry in WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_entry(should_enter_directory)
    {
        let entry = entry.map_err(|error| format!("프로젝트 파일을 스캔할 수 없습니다: {}", error))?;
        if !entry.file_type().is_file() && !entry.file_type().is_symlink() {
            continue;
        }

        if files.len() >= MAX_MANIFEST_FILES {
            return Err(format!(
                "한 번에 스캔할 수 있는 파일은 최대 {}개입니다. 제외 규칙을 추가한 뒤 다시 시도해주세요.",
                MAX_MANIFEST_FILES
            ));
        }

        let Some(file) = build_manifest_file(&root, entry.path())? else {
            continue;
        };
        files.push(file);
    }

    files.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));

    let summary = summarize(&files);

    Ok(ProjectScanResult {
        root_name: root_name.clone(),
        root_path_alias: format!("LOCAL_PROJECT::{}", sanitize_alias(&root_name)),
        files,
        summary,
    })
}

#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<(), String> {
    show_main_window_by_app(&app).map_err(|error| error.to_string())
}

#[tauri::command]
fn hide_main_window(app: AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return Ok(());
    };

    hide_webview_window_to_tray(&window).map_err(|error| error.to_string())
}

fn build_manifest_file(root: &Path, path: &Path) -> Result<Option<ManifestFile>, String> {
    let relative_path = normalize_relative_path(root, path)?;
    if !is_safe_relative_path(&relative_path) {
        return Err(format!("안전하지 않은 상대 경로가 감지되었습니다: {}", relative_path));
    }

    let symlink_metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("파일 메타데이터를 읽을 수 없습니다: {}", error))?;
    let is_symlink = symlink_metadata.file_type().is_symlink();
    let size_bytes = symlink_metadata.len();
    let file_name = path
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_default();

    if file_name.is_blank() {
        return Ok(None);
    }

    let extension = path
        .extension()
        .map(|value| value.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default();
    let language = detect_language(&extension, &file_name);
    let excluded_reason = detect_excluded_reason(&relative_path, &file_name, &extension, size_bytes, is_symlink);
    let excluded = excluded_reason.is_some();
    let sha256 = if excluded {
        None
    } else {
        Some(calculate_sha256(path).map_err(|error| {
            format!("파일 해시를 계산할 수 없습니다: {} ({})", relative_path, error)
        })?)
    };

    Ok(Some(ManifestFile {
        relative_path,
        file_name,
        extension,
        language,
        size_bytes,
        sha256,
        excluded,
        excluded_reason: excluded_reason.map(str::to_string),
    }))
}

fn normalize_relative_path(root: &Path, path: &Path) -> Result<String, String> {
    let relative = path
        .strip_prefix(root)
        .map_err(|_| "프로젝트 루트 밖의 파일은 스캔할 수 없습니다.".to_string())?;

    Ok(relative.to_string_lossy().replace('\\', "/"))
}

fn is_safe_relative_path(relative_path: &str) -> bool {
    let path = Path::new(relative_path);
    if path.is_absolute() || relative_path.contains('\\') || relative_path.starts_with('/') {
        return false;
    }

    !path.components().any(|component| {
        matches!(
            component,
            Component::ParentDir | Component::RootDir | Component::Prefix(_) | Component::CurDir
        )
    })
}

fn should_enter_directory(entry: &DirEntry) -> bool {
    if !entry.file_type().is_dir() {
        return true;
    }

    let name = entry.file_name().to_string_lossy().to_ascii_lowercase();
    !matches!(
        name.as_str(),
        ".git"
            | ".hg"
            | ".svn"
            | ".idea"
            | ".vscode"
            | ".gradle"
            | ".pytest_cache"
            | ".mypy_cache"
            | ".ruff_cache"
            | ".venv"
            | ".venv-wsl"
            | "node_modules"
            | "dist"
            | "build"
            | "target"
            | "coverage"
            | "__pycache__"
    )
}

fn detect_excluded_reason(
    relative_path: &str,
    file_name: &str,
    extension: &str,
    size_bytes: u64,
    is_symlink: bool,
) -> Option<&'static str> {
    if is_symlink {
        return Some("SYMLINK");
    }

    if is_sensitive_file(relative_path, file_name, extension) {
        return Some("SENSITIVE_FILE_PATTERN");
    }

    if is_generated_or_tooling_file(relative_path, file_name, extension) {
        return Some("GENERATED_OR_TOOLING_FILE");
    }

    if is_binary_extension(extension) {
        return Some("BINARY_FILE");
    }

    if size_bytes > MAX_INDEXABLE_FILE_BYTES {
        return Some("LARGE_FILE");
    }

    None
}

fn is_sensitive_file(relative_path: &str, file_name: &str, extension: &str) -> bool {
    let lower_path = relative_path.to_ascii_lowercase();
    let lower_name = file_name.to_ascii_lowercase();

    lower_name == ".env"
        || lower_name.starts_with(".env.")
        || matches!(extension, "pem" | "key" | "p12" | "pfx" | "jks" | "keystore")
        || lower_path.contains("secret")
        || lower_path.contains("password")
        || lower_path.contains("token")
}

fn is_generated_or_tooling_file(relative_path: &str, file_name: &str, extension: &str) -> bool {
    let lower_path = relative_path.to_ascii_lowercase();
    let lower_name = file_name.to_ascii_lowercase();

    lower_path.ends_with(".min.js")
        || lower_path.ends_with(".min.css")
        || lower_name == "package-lock.json"
        || lower_name == "yarn.lock"
        || lower_name == "pnpm-lock.yaml"
        || lower_name == "cargo.lock"
        || lower_name == "gradle.lockfile"
        || matches!(extension, "class" | "o" | "obj" | "log" | "tmp")
}

fn is_binary_extension(extension: &str) -> bool {
    matches!(
        extension,
        "png"
            | "jpg"
            | "jpeg"
            | "gif"
            | "webp"
            | "ico"
            | "bmp"
            | "pdf"
            | "zip"
            | "7z"
            | "tar"
            | "gz"
            | "rar"
            | "jar"
            | "war"
            | "exe"
            | "dll"
            | "so"
            | "dylib"
            | "bin"
            | "onnx"
            | "safetensors"
            | "pt"
            | "pth"
    )
}

fn detect_language(extension: &str, file_name: &str) -> String {
    let lower_name = file_name.to_ascii_lowercase();
    let language = match extension {
        "java" => "java",
        "kt" | "kts" => "kotlin",
        "py" => "python",
        "rs" => "rust",
        "ts" | "tsx" => "typescript",
        "js" | "jsx" | "mjs" | "cjs" => "javascript",
        "html" => "html",
        "css" | "scss" | "sass" => "css",
        "sql" => "sql",
        "md" | "mdx" => "markdown",
        "json" => "json",
        "yaml" | "yml" => "yaml",
        "toml" => "toml",
        "xml" => "xml",
        "sh" | "bash" => "shell",
        "ps1" => "powershell",
        "bat" | "cmd" => "batch",
        "c" | "h" => "c",
        "cpp" | "cc" | "cxx" | "hpp" => "cpp",
        "cs" => "csharp",
        "go" => "go",
        "rb" => "ruby",
        "php" => "php",
        "swift" => "swift",
        "dockerfile" => "dockerfile",
        _ if lower_name == "dockerfile" => "dockerfile",
        _ if lower_name == "makefile" => "makefile",
        _ => "unknown",
    };

    language.to_string()
}

fn calculate_sha256(path: &Path) -> io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 16 * 1024];

    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }

    let digest = hasher.finalize();
    Ok(digest.iter().map(|byte| format!("{:02x}", byte)).collect())
}

fn summarize(files: &[ManifestFile]) -> ScanSummary {
    let mut summary = ScanSummary {
        requested_file_count: files.len(),
        ..ScanSummary::default()
    };

    for file in files {
        if file.excluded {
            summary.excluded_file_count += 1;
        } else {
            summary.target_file_count += 1;
        }

        match file.excluded_reason.as_deref() {
            Some("SENSITIVE_FILE_PATTERN") => summary.sensitive_file_count += 1,
            Some("LARGE_FILE") => summary.large_file_count += 1,
            Some("GENERATED_OR_TOOLING_FILE") => summary.generated_or_tooling_file_count += 1,
            _ => {}
        }
    }

    summary
}

fn sanitize_alias(value: &str) -> String {
    let sanitized: String = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.') {
                character
            } else {
                '_'
            }
        })
        .collect();

    let trimmed = sanitized.trim_matches('_');
    if trimmed.is_empty() {
        "project".to_string()
    } else {
        trimmed.chars().take(80).collect()
    }
}

fn configure_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let open_item = MenuItem::with_id(app, "open", "DevJarvis 열기", true, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "hide", "트레이로 숨기기", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open_item, &hide_item, &quit_item])?;

    let mut tray_builder = TrayIconBuilder::new()
        .tooltip("DevJarvis is running")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => {
                if let Err(error) = show_main_window_by_app(app) {
                    eprintln!("failed to show DevJarvis window: {}", error);
                }
            }
            "hide" => {
                if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                    if let Err(error) = hide_webview_window_to_tray(&window) {
                        eprintln!("failed to hide DevJarvis window: {}", error);
                    }
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Err(error) = show_main_window_by_app(app) {
                    eprintln!("failed to show DevJarvis window from tray: {}", error);
                }
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray_builder = tray_builder.icon(icon.clone());
    }

    tray_builder.build(app)?;
    Ok(())
}

fn show_main_window_by_app(app: &AppHandle) -> tauri::Result<()> {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return Ok(());
    };

    window.set_skip_taskbar(false)?;
    window.show()?;
    window.unminimize()?;
    window.set_focus()?;
    Ok(())
}

fn hide_webview_window_to_tray(window: &WebviewWindow) -> tauri::Result<()> {
    window.set_skip_taskbar(true)?;
    window.hide()?;
    Ok(())
}

fn hide_window_to_tray(window: &tauri::Window) -> tauri::Result<()> {
    window.set_skip_taskbar(true)?;
    window.hide()?;
    Ok(())
}

trait BlankCheck {
    fn is_blank(&self) -> bool;
}

impl BlankCheck for str {
    fn is_blank(&self) -> bool {
        self.trim().is_empty()
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            configure_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != MAIN_WINDOW_LABEL {
                return;
            }

            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if let Err(error) = hide_window_to_tray(window) {
                    eprintln!("failed to hide DevJarvis window to tray: {}", error);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            scan_project_manifest,
            show_main_window,
            hide_main_window
        ])
        .run(tauri::generate_context!())
        .expect("failed to run DevJarvis desktop app");
}
