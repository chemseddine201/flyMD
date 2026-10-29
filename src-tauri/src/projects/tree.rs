//! Pure domain logic for hierarchical project tree operations, cycle prevention, and traversal.

use super::types::ProjectNode;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

/// Nested tree representation of a project node for client-side rendering.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProjectTreeNode {
    #[serde(flatten)]
    pub node: ProjectNode,
    pub children: Vec<ProjectTreeNode>,
}

/// In-memory indexed hierarchy tree.
#[derive(Clone, Debug, Default)]
pub struct ProjectTree {
    nodes: HashMap<String, ProjectNode>,
}

impl ProjectTree {
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
        }
    }

    pub fn from_nodes(nodes: Vec<ProjectNode>) -> Self {
        let mut map = HashMap::new();
        for n in nodes {
            map.insert(n.id.clone(), n);
        }
        Self { nodes: map }
    }

    pub fn len(&self) -> usize {
        self.nodes.len()
    }

    pub fn is_empty(&self) -> bool {
        self.nodes.is_empty()
    }

    pub fn get(&self, id: &str) -> Option<&ProjectNode> {
        self.nodes.get(id)
    }

    pub fn get_all(&self) -> Vec<ProjectNode> {
        self.nodes.values().cloned().collect()
    }

    /// Insert or update a project node after validating hierarchy constraints (no self-parenting, no cycles).
    pub fn insert(&mut self, node: ProjectNode) -> Result<(), String> {
        if let Some(ref p_id) = node.parent_id {
            if p_id == &node.id {
                return Err(format!("Project '{}' cannot be its own parent", node.id));
            }
            if !self.nodes.contains_key(p_id) {
                return Err(format!("Parent project '{}' does not exist", p_id));
            }
            if self.is_descendant_of(&node.id, p_id) {
                return Err(format!(
                    "Cycle detected: project '{}' is already an ancestor of '{}'",
                    node.id, p_id
                ));
            }
        }
        self.nodes.insert(node.id.clone(), node);
        Ok(())
    }

    /// Removes a project node and all of its recursive child projects.
    /// Returns the list of removed node IDs.
    pub fn remove_subtree(&mut self, root_id: &str) -> Vec<String> {
        let mut to_remove = Vec::new();
        let mut queue = vec![root_id.to_string()];

        while let Some(current_id) = queue.pop() {
            if self.nodes.contains_key(&current_id) {
                to_remove.push(current_id.clone());
                // Find direct children of current_id
                for n in self.nodes.values() {
                    if n.parent_id.as_deref() == Some(&current_id) {
                        queue.push(n.id.clone());
                    }
                }
            }
        }

        for id in &to_remove {
            self.nodes.remove(id);
        }

        to_remove
    }

    /// Returns direct children of the specified parent ID (or root nodes if parent_id is None).
    pub fn get_children(&self, parent_id: Option<&str>) -> Vec<ProjectNode> {
        self.nodes
            .values()
            .filter(|n| n.parent_id.as_deref() == parent_id)
            .cloned()
            .collect()
    }

    /// Returns all ancestor nodes ordered from immediate parent up to the root project.
    pub fn get_ancestors(&self, start_id: &str) -> Vec<ProjectNode> {
        let mut ancestors = Vec::new();
        let mut current_id = start_id;
        let mut visited = HashSet::new();

        while let Some(node) = self.nodes.get(current_id) {
            if let Some(ref p_id) = node.parent_id {
                if visited.contains(p_id) {
                    break; // prevent infinite loop if data was corrupted
                }
                visited.insert(p_id.clone());
                if let Some(parent_node) = self.nodes.get(p_id) {
                    ancestors.push(parent_node.clone());
                    current_id = p_id;
                } else {
                    break;
                }
            } else {
                break;
            }
        }

        ancestors
    }

    /// Checks if `candidate_child` is a descendant of `ancestor_id`.
    fn is_descendant_of(&self, ancestor_id: &str, candidate_child: &str) -> bool {
        let mut curr = candidate_child;
        let mut visited = HashSet::new();

        while let Some(node) = self.nodes.get(curr) {
            if let Some(ref p_id) = node.parent_id {
                if p_id == ancestor_id {
                    return true;
                }
                if visited.contains(p_id) {
                    break;
                }
                visited.insert(p_id.clone());
                curr = p_id;
            } else {
                break;
            }
        }

        false
    }

    /// Builds a nested recursive tree view starting from all root projects.
    pub fn build_nested_hierarchy(&self) -> Vec<ProjectTreeNode> {
        let root_nodes = self.get_children(None);
        root_nodes
            .into_iter()
            .map(|root| self.build_subtree(root))
            .collect()
    }

    fn build_subtree(&self, node: ProjectNode) -> ProjectTreeNode {
        let children = self
            .get_children(Some(&node.id))
            .into_iter()
            .map(|child| self.build_subtree(child))
            .collect();
        ProjectTreeNode { node, children }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::projects::types::ProjectStatus;

    fn make_test_node(id: &str, parent: Option<&str>, name: &str) -> ProjectNode {
        ProjectNode {
            id: id.to_string(),
            parent_id: parent.map(|s| s.to_string()),
            name: name.to_string(),
            description: String::new(),
            scope_paths: vec![],
            status: ProjectStatus::Idle,
            active_debate_id: None,
            active_pipeline_id: None,
            created_at: 100,
            updated_at: 100,
        }
    }

    #[test]
    fn test_tree_hierarchy_and_children() {
        let mut tree = ProjectTree::new();
        tree.insert(make_test_node("root-1", None, "Root")).unwrap();
        tree.insert(make_test_node("sub-1", Some("root-1"), "Sub 1"))
            .unwrap();
        tree.insert(make_test_node("sub-2", Some("root-1"), "Sub 2"))
            .unwrap();
        tree.insert(make_test_node("leaf-1", Some("sub-1"), "Leaf 1"))
            .unwrap();

        assert_eq!(tree.get_children(None).len(), 1);
        assert_eq!(tree.get_children(Some("root-1")).len(), 2);
        assert_eq!(tree.get_children(Some("sub-1")).len(), 1);

        let ancestors = tree.get_ancestors("leaf-1");
        assert_eq!(ancestors.len(), 2);
        assert_eq!(ancestors[0].id, "sub-1");
        assert_eq!(ancestors[1].id, "root-1");
    }

    #[test]
    fn test_cycle_detection() {
        let mut tree = ProjectTree::new();
        tree.insert(make_test_node("A", None, "A")).unwrap();
        tree.insert(make_test_node("B", Some("A"), "B")).unwrap();
        tree.insert(make_test_node("C", Some("B"), "C")).unwrap();

        // Trying to set A's parent to C should fail due to cycle
        let bad_a = make_test_node("A", Some("C"), "A");
        let result = tree.insert(bad_a);
        assert!(result.is_err());
    }

    #[test]
    fn test_remove_subtree() {
        let mut tree = ProjectTree::new();
        tree.insert(make_test_node("root", None, "Root")).unwrap();
        tree.insert(make_test_node("sub", Some("root"), "Sub"))
            .unwrap();
        tree.insert(make_test_node("leaf", Some("sub"), "Leaf"))
            .unwrap();

        let removed = tree.remove_subtree("sub");
        assert_eq!(removed.len(), 2);
        assert!(tree.get("sub").is_none());
        assert!(tree.get("leaf").is_none());
        assert!(tree.get("root").is_some());
    }
}
