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
const MAX_APPROVED_FILE_COUNT: usize = 8;
const MAX_APPROVED_FILE_BYTES: u64 = 32 * 1024;
const MAX_APPROVED_TOTAL_BYTES: u64 = 160 * 1024;
const MAX_DEEP_INDEX_FILES: usize = 72;
const MAX_DEEP_INDEX_FILE_BYTES: u64 = 24 * 1024;
const MAX_DEEP_INDEX_TOTAL_BYTES: u64 = 640 * 1024;
const MAX_EXTRACTED_ITEMS_PER_FILE: usize = 10;
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectFileReadItem {
    relative_path: String,
    file_name: String,
    extension: String,
    language: String,
    size_bytes: u64,
    truncated: bool,
    content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectFileReadRejectedItem {
    relative_path: String,
    reason: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectFileReadResult {
    files: Vec<ProjectFileReadItem>,
    rejected: Vec<ProjectFileReadRejectedItem>,
    total_bytes: u64,
    max_file_bytes: u64,
    max_total_bytes: u64,
}


#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectDeepIndexFile {
    relative_path: String,
    file_name: String,
    extension: String,
    language: String,
    size_bytes: u64,
    role: String,
    imports: Vec<String>,
    endpoints: Vec<String>,
    symbols: Vec<String>,
    content_excerpt: String,
    truncated: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectDeepIndexModule {
    name: String,
    file_count: usize,
    indexed_file_count: usize,
    runtime_files: Vec<String>,
    entrypoint_files: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectDeepIndexResult {
    root_name: String,
    requested_file_count: usize,
    indexable_file_count: usize,
    indexed_file_count: usize,
    skipped_file_count: usize,
    total_read_bytes: u64,
    max_indexed_files: usize,
    max_file_bytes: u64,
    max_total_bytes: u64,
    modules: Vec<ProjectDeepIndexModule>,
    files: Vec<ProjectDeepIndexFile>,
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
fn read_project_file_selection(root_path: String, relative_paths: Vec<String>) -> Result<ProjectFileReadResult, String> {
    let root = fs::canonicalize(PathBuf::from(root_path))
        .map_err(|_| "프로젝트 폴더를 확인할 수 없습니다.".to_string())?;

    if !root.is_dir() {
        return Err("프로젝트 폴더만 사용할 수 있습니다.".to_string());
    }

    let mut files = Vec::new();
    let mut rejected = Vec::new();
    let mut total_bytes = 0_u64;

    for relative_path in relative_paths.into_iter().take(MAX_APPROVED_FILE_COUNT) {
        if !is_safe_relative_path(&relative_path) {
            rejected.push(ProjectFileReadRejectedItem {
                relative_path,
                reason: "UNSAFE_RELATIVE_PATH".to_string(),
            });
            continue;
        }

        let path = root.join(&relative_path);
        let Ok(link_metadata) = fs::symlink_metadata(&path) else {
            rejected.push(ProjectFileReadRejectedItem {
                relative_path,
                reason: "NOT_FOUND".to_string(),
            });
            continue;
        };

        if link_metadata.file_type().is_symlink() {
            rejected.push(ProjectFileReadRejectedItem {
                relative_path,
                reason: "SYMLINK".to_string(),
            });
            continue;
        }

        let Ok(canonical_path) = fs::canonicalize(&path) else {
            rejected.push(ProjectFileReadRejectedItem {
                relative_path,
                reason: "NOT_FOUND".to_string(),
            });
            continue;
        };

        if !canonical_path.starts_with(&root) || !canonical_path.is_file() {
            rejected.push(ProjectFileReadRejectedItem {
                relative_path,
                reason: "OUT_OF_SCOPE".to_string(),
            });
            continue;
        }

        let Ok(metadata) = fs::metadata(&canonical_path) else {
            rejected.push(ProjectFileReadRejectedItem {
                relative_path,
                reason: "METADATA_UNAVAILABLE".to_string(),
            });
            continue;
        };

        let size_bytes = metadata.len();
        let file_name = canonical_path
            .file_name()
            .map(|value| value.to_string_lossy().to_string())
            .unwrap_or_default();
        let extension = canonical_path
            .extension()
            .map(|value| value.to_string_lossy().to_ascii_lowercase())
            .unwrap_or_default();

        if detect_excluded_reason(&relative_path, &file_name, &extension, size_bytes, false).is_some() {
            rejected.push(ProjectFileReadRejectedItem {
                relative_path,
                reason: "EXCLUDED_BY_POLICY".to_string(),
            });
            continue;
        }

        if total_bytes >= MAX_APPROVED_TOTAL_BYTES {
            rejected.push(ProjectFileReadRejectedItem {
                relative_path,
                reason: "TOTAL_BUDGET_EXCEEDED".to_string(),
            });
            continue;
        }

        let remaining_budget = MAX_APPROVED_TOTAL_BYTES.saturating_sub(total_bytes);
        let read_limit = MAX_APPROVED_FILE_BYTES.min(remaining_budget);
        let mut file = File::open(&canonical_path).map_err(|_| "선택 파일을 열 수 없습니다.".to_string())?;
        let mut buffer = vec![0_u8; read_limit as usize];
        let read = file.read(&mut buffer).map_err(|_| "선택 파일을 읽을 수 없습니다.".to_string())?;
        buffer.truncate(read);
        total_bytes += read as u64;

        let content = String::from_utf8_lossy(&buffer).to_string();
        let redacted = redact_sensitive_lines(&content);
        let truncated = size_bytes > read as u64;
        let language = detect_language(&extension, &file_name);

        files.push(ProjectFileReadItem {
            relative_path,
            file_name,
            extension,
            language,
            size_bytes,
            truncated,
            content: redacted,
        });
    }

    Ok(ProjectFileReadResult {
        files,
        rejected,
        total_bytes,
        max_file_bytes: MAX_APPROVED_FILE_BYTES,
        max_total_bytes: MAX_APPROVED_TOTAL_BYTES,
    })
}

#[tauri::command]
fn build_project_deep_index(root_path: String) -> Result<ProjectDeepIndexResult, String> {
    let root = fs::canonicalize(PathBuf::from(root_path))
        .map_err(|_| "프로젝트 폴더를 확인할 수 없습니다.".to_string())?;

    if !root.is_dir() {
        return Err("프로젝트 폴더만 사용할 수 있습니다.".to_string());
    }

    let root_name = root
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .filter(|value| !value.is_blank())
        .unwrap_or_else(|| "DevJarvis Project".to_string());

    let mut manifest_files = Vec::new();
    for entry in WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_entry(should_enter_directory)
    {
        let entry = entry.map_err(|error| format!("프로젝트 파일을 스캔할 수 없습니다: {}", error))?;
        if !entry.file_type().is_file() && !entry.file_type().is_symlink() {
            continue;
        }

        if manifest_files.len() >= MAX_MANIFEST_FILES {
            break;
        }

        let Some(file) = build_manifest_file(&root, entry.path())? else {
            continue;
        };
        manifest_files.push(file);
    }

    let indexable_file_count = manifest_files
        .iter()
        .filter(|file| is_deep_index_candidate(file))
        .count();

    let mut ranked_files = manifest_files
        .iter()
        .filter(|file| is_deep_index_candidate(file))
        .map(|file| (score_deep_index_candidate(file), file))
        .collect::<Vec<_>>();

    ranked_files.sort_by(|left, right| {
        right
            .0
            .cmp(&left.0)
            .then_with(|| left.1.relative_path.cmp(&right.1.relative_path))
    });

    let mut indexed_files = Vec::new();
    let mut total_read_bytes = 0_u64;

    for (_, file) in ranked_files.into_iter() {
        if indexed_files.len() >= MAX_DEEP_INDEX_FILES {
            break;
        }

        if total_read_bytes >= MAX_DEEP_INDEX_TOTAL_BYTES {
            break;
        }

        let read_budget = MAX_DEEP_INDEX_FILE_BYTES.min(MAX_DEEP_INDEX_TOTAL_BYTES - total_read_bytes);
        let Some(index_file) = read_deep_index_file(&root, file, read_budget)? else {
            continue;
        };
        total_read_bytes += index_file.content_excerpt.len() as u64;
        indexed_files.push(index_file);
    }

    let modules = build_deep_index_modules(&manifest_files, &indexed_files);
    let skipped_file_count = indexable_file_count.saturating_sub(indexed_files.len());

    Ok(ProjectDeepIndexResult {
        root_name,
        requested_file_count: manifest_files.len(),
        indexable_file_count,
        indexed_file_count: indexed_files.len(),
        skipped_file_count,
        total_read_bytes,
        max_indexed_files: MAX_DEEP_INDEX_FILES,
        max_file_bytes: MAX_DEEP_INDEX_FILE_BYTES,
        max_total_bytes: MAX_DEEP_INDEX_TOTAL_BYTES,
        modules,
        files: indexed_files,
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


fn redact_sensitive_lines(content: &str) -> String {
    content
        .lines()
        .map(|line| {
            if is_sensitive_line(line) {
                "[REDACTED]".to_string()
            } else {
                line.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn is_sensitive_line(line: &str) -> bool {
    let lower = line.to_ascii_lowercase();
    [
        "secret",
        "password",
        "passwd",
        "token",
        "api_key",
        "apikey",
        "access_key",
        "private_key",
        "client_secret",
        "authorization",
        "bearer ",
    ]
    .iter()
    .any(|marker| lower.contains(marker))
}


fn is_deep_index_candidate(file: &ManifestFile) -> bool {
    if file.excluded {
        return false;
    }

    is_source_or_config_extension(&file.extension, &file.file_name)
}

fn is_source_or_config_extension(extension: &str, file_name: &str) -> bool {
    let lower_name = file_name.to_ascii_lowercase();
    matches!(
        extension,
        "ts"
            | "tsx"
            | "js"
            | "jsx"
            | "mjs"
            | "cjs"
            | "java"
            | "py"
            | "rs"
            | "kt"
            | "kts"
            | "go"
            | "sql"
            | "json"
            | "yaml"
            | "yml"
            | "toml"
            | "xml"
            | "md"
            | "sh"
            | "cmd"
            | "bat"
            | "ps1"
    ) || matches!(lower_name.as_str(), "dockerfile" | "makefile")
}

fn score_deep_index_candidate(file: &ManifestFile) -> i32 {
    let path = file.relative_path.to_ascii_lowercase();
    let name = file.file_name.to_ascii_lowercase();
    let role = classify_project_file_role(&file.relative_path, &file.file_name, &file.extension);
    let mut score = 0;

    if role == "runtime-boundary" {
        score += 90;
    }
    if role == "entrypoint" {
        score += 80;
    }
    if role == "api-boundary" {
        score += 70;
    }
    if role == "service" {
        score += 62;
    }
    if role == "ui-boundary" {
        score += 58;
    }
    if role == "config" {
        score += 52;
    }
    if path.contains("/src/") {
        score += 15;
    }
    if path.contains("/app/") || path.contains("/main/") {
        score += 12;
    }
    if file.size_bytes > 0 && file.size_bytes <= 48 * 1024 {
        score += 8;
    }
    if name.contains("test") || path.contains("/tests/") || path.contains("/test/") {
        score -= 30;
    }

    score
}

fn read_deep_index_file(root: &Path, file: &ManifestFile, read_limit: u64) -> Result<Option<ProjectDeepIndexFile>, String> {
    if !is_safe_relative_path(&file.relative_path) {
        return Ok(None);
    }

    let path = root.join(&file.relative_path);
    let link_metadata = match fs::symlink_metadata(&path) {
        Ok(value) => value,
        Err(_) => return Ok(None),
    };

    if link_metadata.file_type().is_symlink() {
        return Ok(None);
    }

    let canonical_path = match fs::canonicalize(&path) {
        Ok(value) => value,
        Err(_) => return Ok(None),
    };

    if !canonical_path.starts_with(root) || !canonical_path.is_file() {
        return Ok(None);
    }

    let mut opened = File::open(&canonical_path).map_err(|_| "프로젝트 인덱스 파일을 열 수 없습니다.".to_string())?;
    let mut buffer = vec![0_u8; read_limit as usize];
    let read = opened
        .read(&mut buffer)
        .map_err(|_| "프로젝트 인덱스 파일을 읽을 수 없습니다.".to_string())?;
    buffer.truncate(read);

    if looks_binary(&buffer) {
        return Ok(None);
    }

    let content = String::from_utf8_lossy(&buffer).to_string();
    let redacted = redact_sensitive_lines(&content);
    let role = classify_project_file_role(&file.relative_path, &file.file_name, &file.extension);
    let imports = extract_import_lines(&redacted);
    let endpoints = extract_endpoint_literals(&redacted);
    let symbols = extract_symbol_lines(&redacted);

    Ok(Some(ProjectDeepIndexFile {
        relative_path: file.relative_path.clone(),
        file_name: file.file_name.clone(),
        extension: file.extension.clone(),
        language: file.language.clone(),
        size_bytes: file.size_bytes,
        role,
        imports,
        endpoints,
        symbols,
        content_excerpt: redacted,
        truncated: file.size_bytes > read as u64,
    }))
}

fn looks_binary(buffer: &[u8]) -> bool {
    buffer.iter().take(2048).any(|byte| *byte == 0)
}

fn classify_project_file_role(relative_path: &str, file_name: &str, extension: &str) -> String {
    let path = relative_path.to_ascii_lowercase();
    let name = file_name.to_ascii_lowercase();

    if matches!(
        name.as_str(),
        "package.json"
            | "cargo.toml"
            | "pyproject.toml"
            | "requirements.txt"
            | "build.gradle"
            | "settings.gradle"
            | "pom.xml"
            | "dockerfile"
            | "docker-compose.yml"
            | "tauri.conf.json"
    ) {
        return "runtime-boundary".to_string();
    }

    if matches!(name.as_str(), "main.tsx" | "main.ts" | "app.tsx" | "app.ts" | "main.rs" | "main.py")
        || path.ends_with("application.java")
    {
        return "entrypoint".to_string();
    }

    if path.contains("/controller/") || path.contains("/api/") || path.contains("/routes/") || name.contains("controller") {
        return "api-boundary".to_string();
    }

    if path.contains("/service/") || name.contains("service") {
        return "service".to_string();
    }

    if path.contains("/repository/") || name.contains("repository") {
        return "repository".to_string();
    }

    if path.contains("/components/") || matches!(extension, "tsx" | "jsx") {
        return "ui-boundary".to_string();
    }

    if name.starts_with("vite.config.")
        || name.starts_with("tsconfig")
        || name.starts_with("application.")
        || matches!(extension, "json" | "yaml" | "yml" | "toml" | "xml")
    {
        return "config".to_string();
    }

    "source".to_string()
}

fn extract_import_lines(content: &str) -> Vec<String> {
    let mut values = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("import ")
            || trimmed.starts_with("from ")
            || trimmed.starts_with("use ")
            || trimmed.starts_with("package ")
        {
            push_unique_limited(&mut values, trimmed, MAX_EXTRACTED_ITEMS_PER_FILE);
        }
    }
    values
}

fn extract_symbol_lines(content: &str) -> Vec<String> {
    let mut values = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("export function ")
            || trimmed.starts_with("function ")
            || trimmed.starts_with("export class ")
            || trimmed.starts_with("class ")
            || trimmed.starts_with("interface ")
            || trimmed.starts_with("type ")
            || trimmed.starts_with("def ")
            || trimmed.starts_with("async def ")
            || trimmed.starts_with("fn ")
            || trimmed.contains(" class ")
            || trimmed.contains(" interface ")
        {
            push_unique_limited(&mut values, trimmed, MAX_EXTRACTED_ITEMS_PER_FILE);
        }
    }
    values
}

fn extract_endpoint_literals(content: &str) -> Vec<String> {
    let mut values = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.contains("Mapping")
            || trimmed.contains("fetch(")
            || trimmed.contains("axios")
            || trimmed.contains("APIRouter")
            || trimmed.contains("router.")
            || trimmed.contains("invoke(")
        {
            for literal in extract_quoted_literals(trimmed) {
                if literal.starts_with('/') || literal.contains("127.0.0.1") || literal.contains("localhost") {
                    push_unique_limited(&mut values, &literal, MAX_EXTRACTED_ITEMS_PER_FILE);
                }
            }
            if values.len() < MAX_EXTRACTED_ITEMS_PER_FILE {
                push_unique_limited(&mut values, trimmed, MAX_EXTRACTED_ITEMS_PER_FILE);
            }
        }
    }
    values
}

fn extract_quoted_literals(line: &str) -> Vec<String> {
    let mut values = Vec::new();
    for quote in ['\'', '"'] {
        let mut current = String::new();
        let mut inside = false;
        for character in line.chars() {
            if character == quote {
                if inside && !current.is_empty() {
                    values.push(current.clone());
                    current.clear();
                }
                inside = !inside;
                continue;
            }

            if inside {
                current.push(character);
            }
        }
    }
    values
}

fn push_unique_limited(values: &mut Vec<String>, value: &str, limit: usize) {
    if values.len() >= limit {
        return;
    }

    let normalized = value.trim();
    if normalized.is_empty() || values.iter().any(|existing| existing == normalized) {
        return;
    }

    values.push(normalized.chars().take(180).collect());
}

fn build_deep_index_modules(manifest_files: &[ManifestFile], indexed_files: &[ProjectDeepIndexFile]) -> Vec<ProjectDeepIndexModule> {
    let mut names = Vec::<String>::new();
    for file in manifest_files.iter().filter(|item| !item.excluded) {
        let name = top_level_name(&file.relative_path, &file.file_name);
        if !names.iter().any(|existing| existing == &name) {
            names.push(name);
        }
    }

    let mut modules = names
        .into_iter()
        .map(|name| {
            let file_count = manifest_files
                .iter()
                .filter(|file| !file.excluded && top_level_name(&file.relative_path, &file.file_name) == name)
                .count();
            let indexed_in_module = indexed_files
                .iter()
                .filter(|file| top_level_name(&file.relative_path, &file.file_name) == name)
                .collect::<Vec<_>>();
            let runtime_files = indexed_in_module
                .iter()
                .filter(|file| file.role == "runtime-boundary")
                .map(|file| file.relative_path.clone())
                .take(6)
                .collect::<Vec<_>>();
            let entrypoint_files = indexed_in_module
                .iter()
                .filter(|file| file.role == "entrypoint")
                .map(|file| file.relative_path.clone())
                .take(6)
                .collect::<Vec<_>>();

            ProjectDeepIndexModule {
                name,
                file_count,
                indexed_file_count: indexed_in_module.len(),
                runtime_files,
                entrypoint_files,
            }
        })
        .collect::<Vec<_>>();

    modules.sort_by(|left, right| {
        right
            .indexed_file_count
            .cmp(&left.indexed_file_count)
            .then_with(|| right.file_count.cmp(&left.file_count))
            .then_with(|| left.name.cmp(&right.name))
    });
    modules.truncate(16);
    modules
}

fn top_level_name(relative_path: &str, file_name: &str) -> String {
    relative_path
        .split('/')
        .next()
        .filter(|value| !value.is_empty())
        .unwrap_or(file_name)
        .to_string()
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
            read_project_file_selection,
            build_project_deep_index,
            show_main_window,
            hide_main_window
        ])
        .run(tauri::generate_context!())
        .expect("failed to run DevJarvis desktop app");
}
