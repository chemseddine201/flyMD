//! Cross-module time utilities.

use std::time::SystemTime;

/// Returns current Unix epoch time in milliseconds.
#[inline]
pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_now_ms_is_positive() {
        assert!(now_ms() > 1_700_000_000_000);
    }
}
