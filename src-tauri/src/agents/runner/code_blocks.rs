//! Markdown code-fence parsing, filename deduction, and file persistence.

use std::fs;
use std::path::Path;

/// Parses language and optional filename attribute from markdown fence tags (e.g. ```javascript:app.js, ```js filename="app.js").
pub fn parse_fence_tag(tag_line: &str) -> (String, Option<String>) {
    let clean = tag_line.trim_start_matches('`').trim();
    if clean.is_empty() {
        return (String::new(), None);
    }

    if let Some((lang, name)) = clean.split_once(':') {
        let lang = lang.trim().to_lowercase();
        let name = name
            .trim()
            .trim_matches(|c| c == '"' || c == '\'' || c == '`')
            .to_string();
        if !name.is_empty() {
            return (lang, Some(name));
        }
    }

    let tokens: Vec<&str> = clean.split_whitespace().collect();
    let lang = tokens.first().map(|s| s.to_lowercase()).unwrap_or_default();

    for token in tokens.iter().skip(1) {
        if let Some((k, v)) = token.split_once('=') {
            let k_low = k.to_lowercase();
            if k_low == "filename" || k_low == "title" || k_low == "file" || k_low == "path" {
                let v_clean = v
                    .trim_matches(|c| c == '"' || c == '\'' || c == '`')
                    .to_string();
                if !v_clean.is_empty() {
                    return (lang, Some(v_clean));
                }
            }
        } else {
            let v_clean = token.trim_matches(|c| {
                c == '"' || c == '\'' || c == '`' || c == '(' || c == ')'
            });
            if v_clean.ends_with(".js")
                || v_clean.ends_with(".css")
                || v_clean.ends_with(".html")
                || v_clean.ends_with(".ts")
                || v_clean.ends_with(".json")
                || v_clean.ends_with(".py")
            {
                if !v_clean.is_empty() {
                    return (lang, Some(v_clean.to_string()));
                }
            }
        }
    }

    (lang, None)
}

/// Checks up to 4 non-empty preceding lines for explicit filename cues (e.g. `### File: app.js`, `**app.js**`).
pub fn find_filename_in_preceding_lines(lines: &[&str], fence_idx: usize) -> Option<String> {
    let mut check_idx = fence_idx;
    let mut scanned = 0;
    while check_idx > 0 && scanned < 4 {
        check_idx -= 1;
        let line = lines[check_idx].trim();
        if line.is_empty() {
            continue;
        }
        scanned += 1;
        let stripped = line
            .trim_start_matches('#')
            .trim_start_matches(|c| c == '*' || c == '_' || c == '`' || c == '-')
            .trim_end_matches(|c| c == '*' || c == '_' || c == '`')
            .trim();

        for word in stripped.split_whitespace() {
            let clean_word = word.trim_matches(|c| {
                c == '`' || c == '"' || c == '\'' || c == ':' || c == '(' || c == ')'
            });
            if clean_word.ends_with(".js")
                || clean_word.ends_with(".css")
                || clean_word.ends_with(".html")
                || clean_word.ends_with(".ts")
                || clean_word.ends_with(".json")
                || clean_word.ends_with(".py")
            {
                let clean_name = clean_word
                    .split('/')
                    .last()
                    .unwrap_or(clean_word)
                    .split('\\')
                    .last()
                    .unwrap_or(clean_word);
                return Some(clean_name.to_string());
            }
        }
    }
    None
}

/// Checks the first line inside a code block for inline comments specifying the filename (e.g. `// app.js`, `/* styles.css */`).
pub fn extract_filename_from_comment(first_line: &str) -> Option<String> {
    let trimmed = first_line.trim();
    let comment_body = if let Some(rest) = trimmed.strip_prefix("//") {
        rest.trim()
    } else if let Some(rest) = trimmed.strip_prefix("/*") {
        rest.trim_end_matches("*/").trim()
    } else if let Some(rest) = trimmed.strip_prefix('#') {
        rest.trim()
    } else if let Some(rest) = trimmed.strip_prefix("<!--") {
        rest.trim_end_matches("-->").trim()
    } else {
        return None;
    };

    let stripped = comment_body
        .trim_start_matches("File:")
        .trim_start_matches("file:")
        .trim_start_matches("filename:")
        .trim_start_matches("Filename:")
        .trim();

    for word in stripped.split_whitespace() {
        let clean_word = word.trim_matches(|c| {
            c == '`' || c == '"' || c == '\'' || c == ':' || c == '(' || c == ')'
        });
        if clean_word.ends_with(".js")
            || clean_word.ends_with(".css")
            || clean_word.ends_with(".html")
            || clean_word.ends_with(".ts")
            || clean_word.ends_with(".json")
            || clean_word.ends_with(".py")
        {
            let clean_name = clean_word
                .split('/')
                .last()
                .unwrap_or(clean_word)
                .split('\\')
                .last()
                .unwrap_or(clean_word);
            return Some(clean_name.to_string());
        }
    }
    None
}

/// Fallback filename generator when no filename is found in fence tag, preceding lines, or inline comments.
pub fn generate_fallback_filename(
    lang: &str,
    block_index: usize,
    created_files: &[String],
    source_filename: &str,
) -> String {
    let ext = match lang {
        "html" | "htm" => "html",
        "css" => "css",
        "javascript" | "js" | "mjs" | "cjs" => "js",
        "typescript" | "ts" => "ts",
        "jsx" => "jsx",
        "tsx" => "tsx",
        "python" | "py" => "py",
        "rust" | "rs" => "rs",
        "json" => "json",
        _ => "txt",
    };

    if ext == "html" && !created_files.iter().any(|f| f == "index.html") {
        return "index.html".to_string();
    }
    if ext == "css" && !created_files.iter().any(|f| f == "styles.css") {
        return "styles.css".to_string();
    }
    if ext == "js" && !created_files.iter().any(|f| f == "app.js") {
        return "app.js".to_string();
    }

    let base_stem = Path::new(source_filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output");
    let clean_stem = base_stem
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect::<String>();

    if block_index == 0 {
        format!("{}.{}", clean_stem, ext)
    } else {
        format!("{}_{}.{}", clean_stem, block_index, ext)
    }
}

/// Extracts fenced code blocks from markdown text and writes each block to its target file in `exec_dir`.
pub fn extract_and_write_code_blocks(
    exec_dir: &str,
    source_filename: &str,
    markdown: &str,
) -> Vec<String> {
    let lines: Vec<&str> = markdown.lines().collect();
    let mut in_block = false;
    let mut current_lang = String::new();
    let mut current_file: Option<String> = None;
    let mut current_lines: Vec<&str> = Vec::new();
    let mut block_index: usize = 0;
    let mut created_files: Vec<String> = Vec::new();

    let exec_path = Path::new(exec_dir);

    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        if trimmed.starts_with("```") {
            if in_block {
                in_block = false;
                let target_name = current_file.unwrap_or_else(|| {
                    generate_fallback_filename(
                        &current_lang,
                        block_index,
                        &created_files,
                        source_filename,
                    )
                });

                let lower_name = target_name.to_lowercase();
                let is_safe = !lower_name.starts_with('/')
                    && !lower_name.starts_with('\\')
                    && !lower_name.contains("..")
                    && (lower_name.ends_with(".html")
                        || lower_name.ends_with(".htm")
                        || lower_name.ends_with(".css")
                        || lower_name.ends_with(".js")
                        || lower_name.ends_with(".ts")
                        || lower_name.ends_with(".mjs")
                        || lower_name.ends_with(".cjs")
                        || lower_name.ends_with(".jsx")
                        || lower_name.ends_with(".tsx")
                        || lower_name.ends_with(".py")
                        || lower_name.ends_with(".rs")
                        || lower_name.ends_with(".json"));

                if is_safe {
                    let full_path = exec_path.join(&target_name);
                    if let Some(parent) = full_path.parent() {
                        let _ = fs::create_dir_all(parent);
                    }
                    let content = current_lines.join("\n");
                    if fs::write(&full_path, content.as_bytes()).is_ok() {
                        if !created_files.contains(&target_name) {
                            created_files.push(target_name);
                        }
                    }
                }

                current_lines.clear();
                current_lang.clear();
                current_file = None;
                block_index += 1;
            } else {
                in_block = true;
                let (lang, filename_from_tag) = parse_fence_tag(trimmed);
                current_lang = lang;
                current_file = filename_from_tag
                    .or_else(|| find_filename_in_preceding_lines(&lines, i));
            }
        } else if in_block {
            if current_lines.is_empty() && current_file.is_none() {
                if let Some(fn_comment) = extract_filename_from_comment(trimmed) {
                    current_file = Some(fn_comment);
                }
            }
            current_lines.push(line);
        }
    }

    created_files
}

/// Recursively scans `ws_path` for files modified since `since_epoch_ms`.
pub fn scan_workspace_modified_files(ws_path: &str, since_epoch_ms: i64) -> Vec<String> {
    let mut files = Vec::new();

    fn walk(base: &Path, dir: &Path, since: i64, out: &mut Vec<String>) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.starts_with('.')
                        || name == "node_modules"
                        || name == "target"
                        || name == "dist"
                    {
                        continue;
                    }
                }
                if path.is_dir() {
                    walk(base, &path, since, out);
                } else if path.is_file() {
                    if let Ok(meta) = path.metadata() {
                        if let Ok(mtime) = meta.modified() {
                            let mtime_ms = mtime
                                .duration_since(std::time::UNIX_EPOCH)
                                .map(|d| d.as_millis() as u64)
                                .unwrap_or(0);
                            if (mtime_ms as i64) + 5000 >= since {
                                if let Ok(rel) = path.strip_prefix(base) {
                                    out.push(rel.to_string_lossy().to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let p = Path::new(ws_path);
    walk(p, p, since_epoch_ms, &mut files);
    files
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_fence_tag_variations() {
        assert_eq!(
            parse_fence_tag("```javascript:app.js"),
            ("javascript".to_string(), Some("app.js".to_string()))
        );
        assert_eq!(
            parse_fence_tag("```html filename=\"index.html\""),
            ("html".to_string(), Some("index.html".to_string()))
        );
        assert_eq!(
            parse_fence_tag("```css (styles.css)"),
            ("css".to_string(), Some("styles.css".to_string()))
        );
        assert_eq!(
            parse_fence_tag("```python"),
            ("python".to_string(), None)
        );
    }

    #[test]
    fn test_extract_and_write_multi_file_blocks() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_test_multi_{}", crate::common::time::now_ms()));
        fs::create_dir_all(&temp_dir).unwrap();

        let md = r#"
# Implementation

### HTML Skeleton
```html:index.html
<!DOCTYPE html><html><head><link rel="stylesheet" href="styles.css"></head><body><button id="runBtn">Run</button><script src="app.js"></script></body></html>
```

### Styles
```css:styles.css
body { background: #000; color: #fff; }
```

### Application Logic
```js:app.js
console.log("Interactive Physics Ready");
```
"#;

        let created = extract_and_write_code_blocks(temp_dir.to_str().unwrap(), "test.md", md);
        assert!(created.contains(&"index.html".to_string()));
        assert!(created.contains(&"styles.css".to_string()));
        assert!(created.contains(&"app.js".to_string()));

        assert!(temp_dir.join("index.html").exists());
        assert!(temp_dir.join("styles.css").exists());
        assert!(temp_dir.join("app.js").exists());

        fs::remove_dir_all(&temp_dir).ok();
    }
}
