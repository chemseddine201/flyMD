//! UTF-8 character-boundary safe string slicing and truncation utilities.

/// Truncates a UTF-8 string safely at a character boundary (never slicing mid-codepoint on
/// multi-byte Arabic, CJK, or emoji sequences), appending `"..."` if truncated.
pub fn truncate_utf8_chars(s: &str, max_chars: usize) -> String {
    match s.char_indices().nth(max_chars) {
        Some((byte_idx, _)) => format!("{}...", &s[..byte_idx]),
        None => s.to_string(),
    }
}

/// Safely returns up to the last `max_bytes` of a UTF-8 string on a valid character boundary.
pub fn safe_tail_utf8(content: &str, max_bytes: usize) -> String {
    if content.len() <= max_bytes {
        return content.to_string();
    }
    let min_start = content.len() - max_bytes;
    let start_idx = content
        .char_indices()
        .map(|(idx, _)| idx)
        .find(|&idx| idx >= min_start)
        .unwrap_or(content.len());
    content[start_idx..].to_string()
}

/// Returns a slice of `s` containing at most `byte_limit` bytes, sliced at a valid char boundary.
pub fn truncate_utf8_bytes_boundary(s: &str, byte_limit: usize) -> &str {
    if byte_limit >= s.len() {
        return s;
    }
    let mut limit = byte_limit;
    while limit > 0 && !s.is_char_boundary(limit) {
        limit -= 1;
    }
    &s[..limit]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_truncate_utf8_chars_multibyte() {
        let arabic = "تطوير المفهوم";
        let truncated = truncate_utf8_chars(arabic, 6);
        assert_eq!(truncated, "تطوير ...");

        let ascii = "Hello World";
        assert_eq!(truncate_utf8_chars(ascii, 5), "Hello...");
        assert_eq!(truncate_utf8_chars(ascii, 20), "Hello World");
    }

    #[test]
    fn test_safe_tail_utf8() {
        let text = "Hello 🌍 World";
        let tail = safe_tail_utf8(text, 7);
        assert!(tail.is_char_boundary(0));
        assert!(text.ends_with(&tail));
    }

    #[test]
    fn test_truncate_utf8_bytes_boundary() {
        let text = "مرحبا بالعالم";
        let sliced = truncate_utf8_bytes_boundary(text, 5);
        assert!(text.starts_with(sliced));
        assert!(sliced.len() <= 5);
    }
}
