use std::fs;
use std::io;
use std::path::{Path, PathBuf};

fn file_name(slot: &str) -> io::Result<&'static str> {
    match slot {
        "primary" => Ok("IdleMineBeyond.json"),
        "backup" => Ok("IdleMineBeyondBackup.json"),
        _ => Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Unknown Remix save slot.",
        )),
    }
}

fn slot_path(root: &Path, slot: &str) -> io::Result<PathBuf> {
    Ok(root.join(file_name(slot)?))
}

fn temporary_path(root: &Path, slot: &str) -> io::Result<PathBuf> {
    Ok(root.join(format!("{}.tmp", file_name(slot)?)))
}

pub(crate) fn read_slot(root: &Path, slot: &str) -> io::Result<Option<String>> {
    let path = slot_path(root, slot)?;
    match fs::read_to_string(path) {
        Ok(serialized) => Ok(Some(serialized)),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error),
    }
}

pub(crate) fn write_slot(root: &Path, slot: &str, serialized: &str) -> io::Result<()> {
    let path = slot_path(root, slot)?;
    let temporary = temporary_path(root, slot)?;
    fs::create_dir_all(root)?;
    fs::write(&temporary, serialized)?;

    // Windows does not replace an existing destination during rename. The
    // persistence coordinator has already written the previous primary to the
    // backup slot before replacing it.
    if path.exists() {
        fs::remove_file(&path)?;
    }
    if let Err(error) = fs::rename(&temporary, &path) {
        let _ = fs::remove_file(&temporary);
        return Err(error);
    }
    Ok(())
}

pub(crate) fn clear_slots(root: &Path) -> io::Result<()> {
    if !root.exists() {
        return Ok(());
    }

    for name in [
        "IdleMineBeyondBackup.json.tmp",
        "IdleMineBeyond.json.tmp",
        "IdleMineBeyondBackup.json",
        "IdleMineBeyond.json",
    ] {
        let path = root.join(name);
        match fs::remove_file(path) {
            Ok(()) => {}
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(error),
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{clear_slots, read_slot, write_slot};
    use std::fs;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};

    static NEXT_ROOT: AtomicU64 = AtomicU64::new(0);

    struct TemporaryRoot(PathBuf);

    impl TemporaryRoot {
        fn new() -> Self {
            let sequence = NEXT_ROOT.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir().join(format!(
                "idle-mine-beyond-native-storage-{}-{sequence}",
                std::process::id()
            ));
            fs::create_dir_all(&path).expect("temporary save directory should be created");
            Self(path)
        }
    }

    impl Drop for TemporaryRoot {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn save_slots_round_trip_and_replace_existing_files() {
        let root = TemporaryRoot::new();

        assert_eq!(read_slot(&root.0, "primary").unwrap(), None);
        write_slot(&root.0, "primary", "first").unwrap();
        write_slot(&root.0, "backup", "backup").unwrap();
        write_slot(&root.0, "primary", "replacement").unwrap();

        assert_eq!(
            read_slot(&root.0, "primary").unwrap(),
            Some("replacement".into())
        );
        assert_eq!(read_slot(&root.0, "backup").unwrap(), Some("backup".into()));
    }

    #[test]
    fn only_known_slots_are_writable_and_clear_preserves_other_app_data() {
        let root = TemporaryRoot::new();
        fs::write(root.0.join("unrelated.json"), "keep").unwrap();

        assert!(write_slot(&root.0, "../../unrelated.json", "replace").is_err());
        write_slot(&root.0, "primary", "save").unwrap();
        write_slot(&root.0, "backup", "backup").unwrap();
        clear_slots(&root.0).unwrap();

        assert_eq!(read_slot(&root.0, "primary").unwrap(), None);
        assert_eq!(read_slot(&root.0, "backup").unwrap(), None);
        assert_eq!(
            fs::read_to_string(root.0.join("unrelated.json")).unwrap(),
            "keep"
        );
    }

    #[test]
    fn failed_backup_removal_keeps_the_primary_save() {
        let root = TemporaryRoot::new();
        write_slot(&root.0, "primary", "keep until reset can finish").unwrap();
        fs::create_dir(root.0.join("IdleMineBeyondBackup.json")).unwrap();

        assert!(clear_slots(&root.0).is_err());
        assert_eq!(
            read_slot(&root.0, "primary").unwrap(),
            Some("keep until reset can finish".into())
        );
    }
}
