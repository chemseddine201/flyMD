//! Deliverable Verifier for FlyMD Autonomous Agent Pipelines.
//! Performs deterministic, evidence-based integrity audits on files written to the workspace.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VerificationCheck {
    pub name: String,
    pub passed: bool,
    pub details: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct VerificationReport {
    pub passed: bool,
    #[serde(rename = "checkedFiles")]
    pub checked_files: Vec<String>,
    pub gaps: Vec<String>,
    pub checks: Vec<VerificationCheck>,
    pub summary: String,
}

/// Audits actual files modified or produced on disk during a pipeline task.
pub fn verify_deliverables(
    workspace_dir: &Path,
    modified_files: &[String],
    intent: &str,
    _contract_markdown: &str,
) -> VerificationReport {
    let mut checks = Vec::new();
    let mut gaps = Vec::new();
    let mut checked_files = Vec::new();

    // Check 1: Existence and non-zero size for all claimed modified files
    let mut files_exist_passed = true;
    let mut file_issues = Vec::new();
    for f in modified_files {
        let p = workspace_dir.join(f);
        if !p.exists() {
            files_exist_passed = false;
            let msg = format!("File `{}` was reported modified but does not exist on disk", f);
            file_issues.push(msg.clone());
            gaps.push(msg);
        } else {
            let len = p.metadata().map(|m| m.len()).unwrap_or(0);
            if len == 0 {
                files_exist_passed = false;
                let msg = format!("File `{}` is 0 bytes (empty)", f);
                file_issues.push(msg.clone());
                gaps.push(msg);
            } else {
                checked_files.push(f.clone());
            }
        }
    }
    checks.push(VerificationCheck {
        name: "File Existence & Size".to_string(),
        passed: files_exist_passed,
        details: if files_exist_passed {
            format!("All {} touched file(s) exist and have valid size on disk.", modified_files.len())
        } else {
            file_issues.join("; ")
        },
    });

    // Check 2: Code deliverables requirement for build/fix-bugs
    if intent == "build" || intent == "fix-bugs" {
        let has_code = modified_files.iter().any(|f| {
            let l = f.to_lowercase();
            l.ends_with(".js")
                || l.ends_with(".ts")
                || l.ends_with(".jsx")
                || l.ends_with(".tsx")
                || l.ends_with(".html")
                || l.ends_with(".css")
                || l.ends_with(".py")
                || l.ends_with(".rs")
                || l.ends_with(".php")
                || l.ends_with(".json")
        });
        if !has_code {
            let msg = format!("Intent `{}` requires functional code deliverables, but no code files were modified.", intent);
            gaps.push(msg.clone());
            checks.push(VerificationCheck {
                name: "Functional Code Deliverables".to_string(),
                passed: false,
                details: msg,
            });
        } else {
            checks.push(VerificationCheck {
                name: "Functional Code Deliverables".to_string(),
                passed: true,
                details: "Substantive code deliverables detected on disk.".to_string(),
            });
        }
    }

    // Check 3: HTML companion resolution (scripts & stylesheets)
    let index_html_path = workspace_dir.join("index.html");
    if index_html_path.exists() {
        if let Ok(html_content) = fs::read_to_string(&index_html_path) {
            let mut companion_passed = true;
            let mut companion_issues = Vec::new();

            // Check referenced <script src="...">
            for part in html_content.split("<script").skip(1) {
                let tag_open = part.split('>').next().unwrap_or("");
                if let Some(src_part) = tag_open.split("src=").nth(1) {
                    let q = src_part.chars().next().unwrap_or(' ');
                    if q == '"' || q == '\'' {
                        let rel: String = src_part.chars().skip(1).take_while(|&c| c != q).collect();
                        if !rel.is_empty() && !rel.starts_with("http") && !rel.starts_with("//") {
                            let script_file = workspace_dir.join(&rel);
                            if !script_file.exists() {
                                companion_passed = false;
                                let msg = format!("`index.html` references `<script src=\"{}\">`, but `{}` is missing on disk.", rel, rel);
                                companion_issues.push(msg.clone());
                                gaps.push(msg);
                            } else {
                                let sz = script_file.metadata().map(|m| m.len()).unwrap_or(0);
                                if sz < 80 {
                                    companion_passed = false;
                                    let msg = format!("`index.html` references script `{}`, but the file on disk is only {} bytes (incomplete).", rel, sz);
                                    companion_issues.push(msg.clone());
                                    gaps.push(msg);
                                }
                            }
                        }
                    }
                }
            }

            // Check referenced <link rel="stylesheet" href="...">
            for part in html_content.split("<link").skip(1) {
                let tag_open = part.split('>').next().unwrap_or("");
                if tag_open.contains("stylesheet") {
                    if let Some(href_part) = tag_open.split("href=").nth(1) {
                        let q = href_part.chars().next().unwrap_or(' ');
                        if q == '"' || q == '\'' {
                            let rel: String = href_part.chars().skip(1).take_while(|&c| c != q).collect();
                            if !rel.is_empty() && !rel.starts_with("http") && !rel.starts_with("//") {
                                let style_file = workspace_dir.join(&rel);
                                if !style_file.exists() {
                                    companion_passed = false;
                                    let msg = format!("`index.html` references stylesheet `<link href=\"{}\">`, but `{}` is missing on disk.", rel, rel);
                                    companion_issues.push(msg.clone());
                                    gaps.push(msg);
                                } else {
                                    let sz = style_file.metadata().map(|m| m.len()).unwrap_or(0);
                                    if sz < 80 {
                                        companion_passed = false;
                                        let msg = format!("`index.html` references stylesheet `{}`, but the file on disk is only {} bytes (incomplete).", rel, sz);
                                        companion_issues.push(msg.clone());
                                        gaps.push(msg);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            checks.push(VerificationCheck {
                name: "HTML Companion Assets".to_string(),
                passed: companion_passed,
                details: if companion_passed {
                    "All scripts and stylesheets referenced by `index.html` exist and are substantive.".to_string()
                } else {
                    companion_issues.join("; ")
                },
            });
        }
    }

    // Check 4: Anti-Stub Inspection (Detects fake handlers or placeholder code)
    let mut stub_passed = true;
    let mut stub_issues = Vec::new();
    for f in modified_files {
        let p = workspace_dir.join(f);
        if let Ok(code) = fs::read_to_string(&p) {
            let l = f.to_lowercase();
            if l.ends_with(".js") || l.ends_with(".ts") {
                // Check for FlyMD synthetic header
                if code.contains("FlyMD Automated Companion Logic Engine") {
                    stub_passed = false;
                    let msg = format!("`{}` contains synthetic FlyMD placeholder code instead of real agent deliverables.", f);
                    stub_issues.push(msg.clone());
                    gaps.push(msg);
                }
                // Check if all button handlers are merely console.log
                let action_count = code.matches("console.log('Action triggered:").count();
                if action_count >= 3 && code.lines().count() < 120 {
                    stub_passed = false;
                    let msg = format!("`{}` appears to be a stub script with {} empty `console.log` action handlers.", f, action_count);
                    stub_issues.push(msg.clone());
                    gaps.push(msg);
                }
            }
        }
    }
    checks.push(VerificationCheck {
        name: "Authentic Implementation (No Stubs)".to_string(),
        passed: stub_passed,
        details: if stub_passed {
            "Deliverables are free of synthetic stubs and placeholder action handlers.".to_string()
        } else {
            stub_issues.join("; ")
        },
    });

    let passed = gaps.is_empty();
    let summary = if passed {
        format!("Deliverable verification passed with {} check(s) green.", checks.len())
    } else {
        format!("Verification identified {} gap(s) requiring completion: {}", gaps.len(), gaps.join("; "))
    };

    VerificationReport {
        passed,
        checked_files,
        gaps,
        checks,
        summary,
    }
}
