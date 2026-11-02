//! Context-Aware Smart Deliverable File Naming & Multilingual Slugification.
//!
//! Generates clean, collision-free, version-preserved filenames across platforms,
//! translating Arabic/multilingual phrases and preventing file overwrite accidents.

use std::path::{Path, PathBuf};

/// Common Arabic keyword to English mapping for high-fidelity semantic slugs.
const ARABIC_KEYWORD_PAIRS: &[(&str, &str)] = &[
    ("مشروع", "Project"),
    ("خطة", "Plan"),
    ("تقرير", "Report"),
    ("تصميم", "Design"),
    ("بحث", "Research"),
    ("مراجعة", "Review"),
    ("تحليل", "Analysis"),
    ("الفيزياء", "Physics"),
    ("فيزياء", "Physics"),
    ("الضوء", "Light"),
    ("ضوء", "Light"),
    ("تطوير", "Development"),
    ("تطور", "Evolution"),
    ("محاكاة", "Simulation"),
    ("هندسة", "Engineering"),
    ("برمجة", "Programming"),
    ("نظام", "System"),
    ("واجهة", "UI"),
    ("أمان", "Security"),
    ("اختبار", "Testing"),
    ("إصلاح", "Fix"),
];

/// Translates Arabic Unicode characters and common Arabic terms into clean, safe ASCII phonemes.
pub fn transliterate_arabic_to_ascii(input: &str) -> String {
    let mut text = input.to_string();

    // 1. Replace common semantic keywords
    for &(ar, en) in ARABIC_KEYWORD_PAIRS {
        if text.contains(ar) {
            text = text.replace(ar, en);
        }
    }

    // 2. Transliterate remaining Arabic codepoints
    let mut out = String::with_capacity(text.len() * 2);
    for ch in text.chars() {
        match ch {
            'ا' | 'أ' | 'إ' | 'آ' | 'ء' | 'ى' => out.push('a'),
            'ب' => out.push('b'),
            'ت' | 'ة' => out.push('t'),
            'ث' => out.push_str("th"),
            'ج' => out.push('j'),
            'ح' => out.push('h'),
            'خ' => out.push_str("kh"),
            'د' => out.push('d'),
            'ذ' => out.push_str("dh"),
            'ر' => out.push('r'),
            'ز' => out.push('z'),
            'س' => out.push('s'),
            'ش' => out.push_str("sh"),
            'ص' => out.push_str("ss"),
            'ض' => out.push_str("dd"),
            'ط' => out.push_str("tt"),
            'ظ' => out.push_str("dh"),
            'ع' => out.push('a'),
            'غ' => out.push_str("gh"),
            'ف' => out.push('f'),
            'ق' => out.push('q'),
            'ك' => out.push('k'),
            'ل' => out.push('l'),
            'م' => out.push('m'),
            'ن' => out.push('n'),
            'ه' => out.push('h'),
            'و' => out.push('w'),
            'ي' => out.push('y'),
            other => out.push(other),
        }
    }

    out
}

/// Normalizes arbitrary user text into a clean, filesystem-safe alphanumeric slug.
/// Collapses spaces/punctuation into single underscores and avoids Windows reserved words.
pub fn slugify_semantic_title(input: &str, max_len: usize) -> String {
    let ascii_converted = transliterate_arabic_to_ascii(input);

    let mut slug = String::with_capacity(ascii_converted.len());
    let mut last_was_delim = true;

    for ch in ascii_converted.chars() {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch);
            last_was_delim = false;
        } else if (ch == ' ' || ch == '_' || ch == '-' || ch == '.') && !last_was_delim {
            slug.push('_');
            last_was_delim = true;
        }
    }

    // Trim trailing delimiters
    while slug.ends_with('_') || slug.ends_with('-') || slug.ends_with('.') {
        slug.pop();
    }

    // Cap maximum length safely at character boundary
    if slug.len() > max_len {
        let mut limit = max_len;
        while limit > 0 && !slug.is_char_boundary(limit) {
            limit -= 1;
        }
        slug.truncate(limit);
        while slug.ends_with('_') || slug.ends_with('-') {
            slug.pop();
        }
    }

    // Guard Windows-reserved filenames (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
    let upper = slug.to_ascii_uppercase();
    const RESERVED: &[&str] = &[
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7",
        "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];

    if RESERVED.contains(&upper.as_str()) || slug.is_empty() {
        format!("Doc_{}", slug)
    } else {
        slug
    }
}

/// Context passed into the deliverable naming composer.
#[derive(Debug, Clone, Default)]
pub struct DeliverableNamingContext<'a> {
    pub project_name: Option<&'a str>,
    pub subproject_name: Option<&'a str>,
    pub topic_or_prompt: Option<&'a str>,
    pub intent_or_kind: &'a str,
    pub fallback_name: Option<&'a str>,
}

/// Composes a structured, context-rich Markdown deliverable filename.
/// Pattern: `[Project]_[SubProject]_[Topic]_[Kind].md`
pub fn compose_smart_deliverable_name(ctx: &DeliverableNamingContext) -> String {
    let mut parts: Vec<String> = Vec::new();

    // 1. Project name prefix
    if let Some(p) = ctx.project_name {
        let p_slug = slugify_semantic_title(p, 30);
        if !p_slug.is_empty() && p_slug != "Default" && p_slug != "Workspace" {
            parts.push(p_slug);
        }
    }

    // 2. Subproject prefix
    if let Some(sp) = ctx.subproject_name {
        let sp_slug = slugify_semantic_title(sp, 25);
        if !sp_slug.is_empty() && !parts.iter().any(|p| p.eq_ignore_ascii_case(&sp_slug)) {
            parts.push(sp_slug);
        }
    }

    // 3. Topic or Prompt excerpt
    if let Some(top) = ctx.topic_or_prompt {
        // Strip code block backticks or leading markdown headers
        let cleaned = top.trim().trim_start_matches('#').trim();
        let first_line = cleaned.lines().next().unwrap_or(cleaned);
        let top_slug = slugify_semantic_title(first_line, 40);
        if !top_slug.is_empty() && !parts.iter().any(|p| p.eq_ignore_ascii_case(&top_slug)) {
            parts.push(top_slug);
        }
    }

    // 4. Intent / Deliverable Kind suffix
    let kind_suffix = match ctx.intent_or_kind {
        "refine-plan" | "plan" => "Plan",
        "review" | "audit" => "AuditReport",
        "build" => "BuildReport",
        "fix-bugs" => "FixReport",
        "consensus-report" | "discussion" => "ConsensusReport",
        "explain" => "Explanation",
        "test" => "TestReport",
        custom if !custom.is_empty() => custom,
        _ => "Deliverable",
    };

    if !parts.iter().any(|p| p.eq_ignore_ascii_case(kind_suffix)) {
        parts.push(kind_suffix.to_string());
    }

    // If no context parts were produced, use fallback name
    if parts.is_empty() {
        if let Some(fb) = ctx.fallback_name {
            if fb.to_lowercase().ends_with(".md") {
                return fb.to_string();
            }
            return format!("{}.md", fb);
        }
        return "Deliverable.md".to_string();
    }

    format!("{}.md", parts.join("_"))
}

/// Resolves a non-colliding filepath in `target_dir` by scanning for existing files
/// and incrementing `-v2.md`, `-v3.md` if the target already exists.
pub fn resolve_unique_deliverable_path(target_dir: &Path, candidate_filename: &str) -> PathBuf {
    let raw_name = candidate_filename.trim();
    let (stem, ext) = if let Some(dot_idx) = raw_name.rfind('.') {
        (&raw_name[..dot_idx], &raw_name[dot_idx..])
    } else {
        (raw_name, ".md")
    };

    let initial_path = target_dir.join(format!("{}{}", stem, ext));
    if !initial_path.exists() {
        return initial_path;
    }

    // If candidate ends with existing -vN, detect the base stem
    let mut base_stem = stem;
    let mut start_version: u32 = 2;

    if let Some(dash_v) = stem.rfind("-v") {
        if let Ok(num) = stem[dash_v + 2..].parse::<u32>() {
            base_stem = &stem[..dash_v];
            start_version = num + 1;
        }
    }

    for v in start_version..1000 {
        let next_path = target_dir.join(format!("{}-v{}{}", base_stem, v, ext));
        if !next_path.exists() {
            return next_path;
        }
    }

    // Ultra-fallback if 1000 versions exist: append timestamp
    target_dir.join(format!("{}-{}{}", base_stem, crate::common::time::now_ms(), ext))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_transliterate_arabic_and_keywords() {
        let arabic = "مشروع تطور مفهوم الضوء في الفيزياء";
        let transliterated = transliterate_arabic_to_ascii(arabic);
        assert!(transliterated.contains("Project"));
        assert!(transliterated.contains("Physics"));
        assert!(transliterated.contains("Light"));
        assert!(transliterated.contains("Evolution"));
    }

    #[test]
    fn test_slugify_semantic_title_clean() {
        let title = "Fly10: Optical Wave Simulation & Analysis (2026)!";
        let slug = slugify_semantic_title(title, 40);
        assert_eq!(slug, "Fly10_Optical_Wave_Simulation_Analysis_2");

        // Windows reserved guard
        let reserved = slugify_semantic_title("CON", 20);
        assert_eq!(reserved, "Doc_CON");
    }

    #[test]
    fn test_compose_smart_deliverable_name() {
        let ctx = DeliverableNamingContext {
            project_name: Some("OpticsEngine"),
            subproject_name: Some("Waveguide"),
            topic_or_prompt: Some("Implement Fresnel transmission coefficient"),
            intent_or_kind: "refine-plan",
            fallback_name: None,
        };

        let name = compose_smart_deliverable_name(&ctx);
        assert_eq!(
            name,
            "OpticsEngine_Waveguide_Implement_Fresnel_transmission_coefficie_Plan.md"
        );
    }

    #[test]
    fn test_resolve_unique_deliverable_path_anti_collision() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_test_naming_{}", crate::common::time::now_ms()));
        fs::create_dir_all(&temp_dir).unwrap();

        let initial = resolve_unique_deliverable_path(&temp_dir, "Architecture_Plan.md");
        assert_eq!(initial.file_name().unwrap(), "Architecture_Plan.md");
        fs::write(&initial, "v1").unwrap();

        let second = resolve_unique_deliverable_path(&temp_dir, "Architecture_Plan.md");
        assert_eq!(second.file_name().unwrap(), "Architecture_Plan-v2.md");
        fs::write(&second, "v2").unwrap();

        let third = resolve_unique_deliverable_path(&temp_dir, "Architecture_Plan.md");
        assert_eq!(third.file_name().unwrap(), "Architecture_Plan-v3.md");

        fs::remove_dir_all(&temp_dir).ok();
    }
}
