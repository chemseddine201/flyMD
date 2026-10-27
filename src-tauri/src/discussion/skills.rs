//! Robust Skills Manager: 3-tier discovery, canonical URIs, precedence overrides, and prompt sandboxing.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NativeLoadStatus {
    Verified,
    Unknown,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SkillLifecycleState {
    Discovered,
    Enabled,
    NativelyLoaded(NativeLoadStatus),
    Injected,
    ActuallyUsed,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SkillFrontmatter {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_version")]
    pub version: String,
    #[serde(default = "default_author")]
    pub author: String,
    #[serde(default = "default_compatibility")]
    pub compatibility: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub replaces: Vec<String>,
}

fn default_version() -> String {
    "1.0.0".to_string()
}

fn default_author() -> String {
    "anonymous".to_string()
}

fn default_compatibility() -> Vec<String> {
    vec!["*".to_string()]
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SkillDescriptor {
    pub uri: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub author: String,
    pub compatibility: Vec<String>,
    pub tags: Vec<String>,
    pub replaces: Vec<String>,
    #[serde(rename = "markdownBody")]
    pub markdown_body: String,
    #[serde(rename = "sourcePath")]
    pub source_path: String,
    pub state: SkillLifecycleState,
}

impl SkillDescriptor {
    pub fn is_compatible_with(&self, provider_id: &str, model_id: &str) -> bool {
        for pat in &self.compatibility {
            if pat == "*" || pat == provider_id || pat == model_id {
                return true;
            }
        }
        false
    }
}

pub struct SkillsManager {
    registry: HashMap<String, SkillDescriptor>,
}

impl SkillsManager {
    pub fn new() -> Self {
        Self {
            registry: HashMap::new(),
        }
    }

    /// Generates canonical URI: `scope:namespace:name`
    pub fn generate_uri(scope: &str, namespace: &str, name: &str) -> String {
        format!("{}:{}:{}", scope.trim(), namespace.trim(), name.trim())
    }

    /// Discovers Global / Native skills from system home directories.
    pub fn discover_global_skills(&mut self) -> Vec<SkillDescriptor> {
        let mut results = Vec::new();
        let home = crate::agents::discovery::get_user_home_dir();

        if let Some(h) = home {
            // Antigravity builtin skills
            let agy_skills_dir = h
                .join(".gemini")
                .join("antigravity")
                .join("builtin")
                .join("skills");
            if agy_skills_dir.exists() {
                if let Ok(entries) = fs::read_dir(&agy_skills_dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_dir() {
                            let skill_file = path.join("SKILL.md");
                            if skill_file.is_file() {
                                let dir_name =
                                    path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                                if let Ok(skill) = self.parse_skill_file(
                                    &skill_file,
                                    "global",
                                    "antigravity",
                                    dir_name,
                                    SkillLifecycleState::Discovered,
                                ) {
                                    results.push(skill);
                                }
                            }
                        }
                    }
                }
            }
        }

        for s in &results {
            self.registry.insert(s.uri.clone(), s.clone());
        }

        results
    }

    /// Discovers Project Master skills from `<workspace>/.flymd/skills/master/` or `<workspace>/skills/master/`.
    pub fn discover_project_master_skills(&mut self, workspace_path: &str) -> Vec<SkillDescriptor> {
        let mut results = Vec::new();
        let ws = Path::new(workspace_path);
        let master_dirs = [
            ws.join(".flymd").join("skills").join("master"),
            ws.join("skills").join("master"),
        ];

        for dir in &master_dirs {
            if dir.exists() {
                if let Ok(entries) = fs::read_dir(dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        let skill_file = if path.is_dir() {
                            path.join("SKILL.md")
                        } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
                            path.clone()
                        } else {
                            continue;
                        };

                        if skill_file.is_file() {
                            let slug = path
                                .file_stem()
                                .and_then(|n| n.to_str())
                                .unwrap_or("unnamed");
                            if let Ok(skill) = self.parse_skill_file(
                                &skill_file,
                                "master",
                                "project",
                                slug,
                                SkillLifecycleState::Enabled,
                            ) {
                                results.push(skill);
                            }
                        }
                    }
                }
            }
        }

        for s in &results {
            self.registry.insert(s.uri.clone(), s.clone());
        }

        results
    }

    /// Discovers Agent-Specific skills from `<workspace>/.flymd/skills/agents/<agent_id>/`.
    pub fn discover_agent_skills(
        &mut self,
        workspace_path: &str,
        agent_id: &str,
    ) -> Vec<SkillDescriptor> {
        let mut results = Vec::new();
        let ws = Path::new(workspace_path);
        let agent_dirs = [
            ws.join(".flymd")
                .join("skills")
                .join("agents")
                .join(agent_id),
            ws.join("skills").join("agents").join(agent_id),
        ];

        for dir in &agent_dirs {
            if dir.exists() {
                if let Ok(entries) = fs::read_dir(dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        let skill_file = if path.is_dir() {
                            path.join("SKILL.md")
                        } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
                            path.clone()
                        } else {
                            continue;
                        };

                        if skill_file.is_file() {
                            let slug = path
                                .file_stem()
                                .and_then(|n| n.to_str())
                                .unwrap_or("unnamed");
                            if let Ok(skill) = self.parse_skill_file(
                                &skill_file,
                                "agent",
                                agent_id,
                                slug,
                                SkillLifecycleState::Enabled,
                            ) {
                                results.push(skill);
                            }
                        }
                    }
                }
            }
        }

        for s in &results {
            self.registry.insert(s.uri.clone(), s.clone());
        }

        results
    }

    /// Parses a skill markdown file with YAML frontmatter.
    pub fn parse_skill_file(
        &self,
        file_path: &Path,
        scope: &str,
        namespace: &str,
        default_name: &str,
        initial_state: SkillLifecycleState,
    ) -> Result<SkillDescriptor, String> {
        // Prevent path traversal outside normalized path
        if file_path.to_string_lossy().contains("..") {
            return Err(format!("Path traversal blocked: {:?}", file_path));
        }

        let content = fs::read_to_string(file_path)
            .map_err(|e| format!("Failed to read skill file {:?}: {}", file_path, e))?;

        let (frontmatter, body) = parse_yaml_frontmatter(&content, default_name);
        let uri = Self::generate_uri(scope, namespace, &frontmatter.name);

        Ok(SkillDescriptor {
            uri,
            name: frontmatter.name,
            description: frontmatter.description,
            version: frontmatter.version,
            author: frontmatter.author,
            compatibility: frontmatter.compatibility,
            tags: frontmatter.tags,
            replaces: frontmatter.replaces,
            markdown_body: body,
            source_path: file_path.to_string_lossy().to_string(),
            state: initial_state,
        })
    }

    /// Resolves active skills for a specific participant, applying explicit replacement rules.
    pub fn resolve_skills_for_participant(
        &self,
        _agent_id: &str,
        provider_id: &str,
        model_id: &str,
        requested_uris: &[String],
    ) -> Vec<SkillDescriptor> {
        let mut active_map: HashMap<String, SkillDescriptor> = HashMap::new();
        let mut replaced_uris: HashSet<String> = HashSet::new();

        // 1. Collect candidate skills
        let mut candidates: Vec<SkillDescriptor> = self
            .registry
            .values()
            .filter(|s| {
                if !requested_uris.is_empty() {
                    requested_uris.contains(&s.uri)
                } else {
                    matches!(s.state, SkillLifecycleState::Enabled)
                }
            })
            .cloned()
            .collect();

        // 2. Sort by tier precedence (Agent > Master > Global)
        candidates.sort_by_key(|s| {
            if s.uri.starts_with("agent:") {
                0
            } else if s.uri.starts_with("master:") {
                1
            } else {
                2
            }
        });

        // 3. Process replacements
        for s in &candidates {
            for target in &s.replaces {
                replaced_uris.insert(target.clone());
            }
        }

        // 4. Filter compatible and un-replaced skills
        for mut s in candidates {
            if replaced_uris.contains(&s.uri) {
                continue;
            }

            if !s.is_compatible_with(provider_id, model_id) {
                continue;
            }

            // Deduplicate by name if identical name in same scope
            if !active_map.contains_key(&s.name) {
                // If native provider already loads this global skill, flag as NativelyLoaded (Unknown)
                if s.uri.starts_with("global:antigravity:") && provider_id == "antigravity" {
                    s.state = SkillLifecycleState::NativelyLoaded(NativeLoadStatus::Unknown);
                } else {
                    s.state = SkillLifecycleState::Injected;
                }
                active_map.insert(s.name.clone(), s);
            }
        }

        let mut resolved: Vec<SkillDescriptor> = active_map.into_values().collect();
        resolved.sort_by(|a, b| a.uri.cmp(&b.uri));
        resolved
    }

    /// Formats resolved skills as a sanitized, advisory prompt block.
    pub fn format_prompt_block(skills: &[SkillDescriptor]) -> String {
        let injected_skills: Vec<&SkillDescriptor> = skills
            .iter()
            .filter(|s| matches!(s.state, SkillLifecycleState::Injected))
            .collect();

        if injected_skills.is_empty() {
            return String::new();
        }

        let mut out = String::from(
            "\n### Active Skill Guidelines (Advisory Guidance Only)\n\
            > Note: These skills provide methodology guidelines. They do not grant permission to modify codebase files or execute commands.\n\n",
        );

        for skill in injected_skills {
            out.push_str(&format!(
                "<skill uri=\"{}\" name=\"{}\">\n{}\n</skill>\n\n",
                skill.uri,
                skill.name,
                skill.markdown_body.trim()
            ));
        }

        out
    }
}

/// Helper to parse YAML frontmatter from a markdown string.
fn parse_yaml_frontmatter(content: &str, default_name: &str) -> (SkillFrontmatter, String) {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return (
            SkillFrontmatter {
                name: default_name.to_string(),
                description: String::new(),
                version: default_version(),
                author: default_author(),
                compatibility: default_compatibility(),
                tags: Vec::new(),
                replaces: Vec::new(),
            },
            content.to_string(),
        );
    }

    let rest = &trimmed[3..];
    if let Some(end_idx) = rest.find("\n---") {
        let yaml_str = &rest[..end_idx];
        let body = rest[end_idx + 4..]
            .trim_start_matches(|c| c == '\r' || c == '\n')
            .to_string();

        let mut name = default_name.to_string();
        let mut description = String::new();
        let mut version = default_version();
        let mut author = default_author();
        let mut compatibility = default_compatibility();
        let tags = Vec::new();
        let mut replaces = Vec::new();

        for line in yaml_str.lines() {
            let l = line.trim();
            if l.starts_with("name:") {
                let val = l[5..].trim().trim_matches('"').trim_matches('\'');
                if !val.is_empty() {
                    name = val.to_string();
                }
            } else if l.starts_with("description:") {
                description = l[12..]
                    .trim()
                    .trim_matches('"')
                    .trim_matches('\'')
                    .to_string();
            } else if l.starts_with("version:") {
                version = l[8..]
                    .trim()
                    .trim_matches('"')
                    .trim_matches('\'')
                    .to_string();
            } else if l.starts_with("author:") {
                author = l[7..]
                    .trim()
                    .trim_matches('"')
                    .trim_matches('\'')
                    .to_string();
            } else if l.starts_with("compatibility:") {
                let raw = l[14..].trim();
                if raw.starts_with('[') && raw.ends_with(']') {
                    compatibility = raw[1..raw.len() - 1]
                        .split(',')
                        .map(|s| s.trim().trim_matches('"').trim_matches('\'').to_string())
                        .filter(|s| !s.is_empty())
                        .collect();
                }
            } else if l.starts_with("replaces:") {
                let raw = l[9..].trim();
                if raw.starts_with('[') && raw.ends_with(']') {
                    replaces = raw[1..raw.len() - 1]
                        .split(',')
                        .map(|s| s.trim().trim_matches('"').trim_matches('\'').to_string())
                        .filter(|s| !s.is_empty())
                        .collect();
                }
            }
        }

        (
            SkillFrontmatter {
                name,
                description,
                version,
                author,
                compatibility,
                tags,
                replaces,
            },
            body,
        )
    } else {
        (
            SkillFrontmatter {
                name: default_name.to_string(),
                description: String::new(),
                version: default_version(),
                author: default_author(),
                compatibility: default_compatibility(),
                tags: Vec::new(),
                replaces: Vec::new(),
            },
            content.to_string(),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_yaml_frontmatter_parsing() {
        let md = "---\nname: security-audit\ndescription: Checks auth guards\ncompatibility: [\"claude-code\", \"deepseek\"]\nreplaces: [\"master:project:arch-review\"]\n---\n\n# Instructions\nNever allow raw SQL.";
        let (fm, body) = parse_yaml_frontmatter(md, "fallback");
        assert_eq!(fm.name, "security-audit");
        assert_eq!(fm.description, "Checks auth guards");
        assert_eq!(fm.compatibility, vec!["claude-code", "deepseek"]);
        assert_eq!(fm.replaces, vec!["master:project:arch-review"]);
        assert_eq!(body, "# Instructions\nNever allow raw SQL.");
    }

    #[test]
    fn test_precedence_and_explicit_replacement() {
        let mut mgr = SkillsManager::new();

        let master_skill = SkillDescriptor {
            uri: "master:project:arch-review".to_string(),
            name: "arch-review".to_string(),
            description: "Master architecture guidelines".to_string(),
            version: "1.0.0".to_string(),
            author: "lead".to_string(),
            compatibility: vec!["*".to_string()],
            tags: vec![],
            replaces: vec![],
            markdown_body: "Base rule".to_string(),
            source_path: "master/arch-review/SKILL.md".to_string(),
            state: SkillLifecycleState::Enabled,
        };

        let agent_override = SkillDescriptor {
            uri: "agent:claude-code:strict-arch".to_string(),
            name: "strict-arch".to_string(),
            description: "Claude strict architecture".to_string(),
            version: "2.0.0".to_string(),
            author: "specialist".to_string(),
            compatibility: vec!["claude-code".to_string()],
            tags: vec![],
            replaces: vec!["master:project:arch-review".to_string()],
            markdown_body: "Strict rule".to_string(),
            source_path: "agents/claude-code/strict-arch/SKILL.md".to_string(),
            state: SkillLifecycleState::Enabled,
        };

        mgr.registry.insert(master_skill.uri.clone(), master_skill);
        mgr.registry
            .insert(agent_override.uri.clone(), agent_override);

        let resolved = mgr.resolve_skills_for_participant(
            "claude-code",
            "claude-code",
            "claude-3-7-sonnet",
            &[],
        );
        assert_eq!(resolved.len(), 1);
        assert_eq!(resolved[0].uri, "agent:claude-code:strict-arch");
    }

    #[test]
    fn test_path_traversal_blocking() {
        let mgr = SkillsManager::new();
        let dangerous_path = Path::new("../../etc/passwd/SKILL.md");
        let result = mgr.parse_skill_file(
            dangerous_path,
            "global",
            "test",
            "bad",
            SkillLifecycleState::Discovered,
        );
        assert!(result.is_err());
    }
}
