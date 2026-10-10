//! Filesystem boundary. Hashes detect edits, not distributed writer locks.
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

/// Windows sharing locks are released by the OS when a process exits, including crashes.
#[derive(Default)]
pub struct RecoveryLeases {
    held: HashMap<String, std::fs::File>,
}
impl RecoveryLeases {
    pub fn acquire(&mut self, store: &Store, id: &str) -> Result<bool, String> {
        if self.held.contains_key(id) {
            return Ok(true);
        }
        let mut options = OpenOptions::new();
        options.read(true).write(true).create(true);
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            options.share_mode(0);
        }
        let path = store.recovery_path(id)?.with_extension("lock");
        match options.open(path) {
            Ok(file) => {
                self.held.insert(id.to_owned(), file);
                Ok(true)
            }
            Err(error) if matches!(error.raw_os_error(), Some(32 | 33)) => Ok(false),
            Err(error) => Err(error.to_string()),
        }
    }
    pub fn claim(
        &mut self,
        store: &Store,
        record: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let source = record["id"]
            .as_str()
            .ok_or("Invalid recovery ID")?
            .to_owned();
        let live = self.held.contains_key(&source) || !self.acquire(store, &source)?;
        // Home's listed copy may predate edits or Save As in a live process.
        // Reading after acquiring an interrupted source's lease also keeps its identity stable.
        let mut record = match store.read_recovery(&source) {
            Ok(record) => record,
            Err(error) => {
                if !live {
                    self.release(&source);
                }
                return Err(error);
            }
        };
        if live {
            record["id"] = uuid::Uuid::new_v4().to_string().into();
        }
        let id = record["id"].as_str().unwrap();
        if !self.acquire(store, id)? {
            return Err("Recovery is being edited in another process".into());
        }
        if let Err(error) = store.write_recovery(record.clone()) {
            self.release(id);
            return Err(error);
        }
        Ok(record)
    }
    pub fn release(&mut self, id: &str) {
        self.held.remove(id);
    }
    pub fn abandon(&mut self, store: &Store, claimed: &str, source: &str) -> Result<(), String> {
        // Never delete an unowned record or the original interrupted source.
        if !self.held.contains_key(claimed) {
            return Ok(());
        }
        let result = if claimed != source {
            store.remove_recovery(claimed)
        } else {
            Ok(())
        };
        self.release(claimed);
        result
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenedFile {
    pub path: String,
    pub bytes: String,
    pub revision: String,
}
#[derive(Debug, Serialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum SavedFile {
    Success { path: String, revision: String },
    Conflict,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentFile {
    pub path: String,
    pub name: String,
    pub folder: String,
}
pub fn revision(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
pub fn read(path: &Path) -> Result<OpenedFile, String> {
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    let hash = revision(&bytes);
    let bytes = String::from_utf8(bytes).map_err(|e| e.to_string())?;
    Ok(OpenedFile {
        path: path.to_string_lossy().into_owned(),
        bytes,
        revision: hash,
    })
}
pub fn save(
    path: &Path,
    bytes: &str,
    expected: Option<&str>,
    overwrite: bool,
) -> Result<SavedFile, String> {
    let installed = atomic_write_checked(path, bytes.as_bytes(), || {
        if !overwrite {
            if let Some(expected) = expected {
                return match fs::read(path) {
                    Ok(current) => Ok(revision(&current) == expected),
                    Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
                    Err(e) => Err(e.to_string()),
                };
            }
        }
        Ok(true)
    })?;
    if !installed {
        return Ok(SavedFile::Conflict);
    }
    let installed = fs::read(path).map_err(|e| e.to_string())?;
    if installed != bytes.as_bytes() {
        return Err("The file changed again immediately after saving. Your edits are still available; save another copy.".into());
    }
    Ok(SavedFile::Success {
        path: path.to_string_lossy().into_owned(),
        revision: revision(&installed),
    })
}
/// Flush a unique sibling, then atomically replace. Never delete the destination first.
pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    atomic_write_checked(path, bytes, || Ok(true)).map(|_| ())
}
fn atomic_write_checked(
    path: &Path,
    bytes: &[u8],
    check: impl FnOnce() -> Result<bool, String>,
) -> Result<bool, String> {
    let parent = path.parent().ok_or("File has no parent folder")?;
    let temporary = parent.join(format!(".takt-{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|e| e.to_string())?;
        file.write_all(bytes).map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        drop(file);
        if !check()? {
            return Ok(false);
        }
        replace(&temporary, path)?;
        Ok(true)
    })();
    if !matches!(result, Ok(true)) {
        let _ = fs::remove_file(&temporary);
    }
    result
}
#[cfg(windows)]
fn replace(from: &Path, to: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };
    let from: Vec<u16> = from.as_os_str().encode_wide().chain(Some(0)).collect();
    let to: Vec<u16> = to.as_os_str().encode_wide().chain(Some(0)).collect();
    if unsafe {
        MoveFileExW(
            from.as_ptr(),
            to.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    } == 0
    {
        Err(std::io::Error::last_os_error().to_string())
    } else {
        Ok(())
    }
}
#[cfg(not(windows))]
fn replace(from: &Path, to: &Path) -> Result<(), String> {
    fs::rename(from, to).map_err(|e| e.to_string())
}

pub struct Store {
    pub root: PathBuf,
}
impl Store {
    pub fn new(root: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(root.join("recovery")).map_err(|e| e.to_string())?;
        fs::create_dir_all(root.join("recents")).map_err(|e| e.to_string())?;
        Ok(Self { root })
    }
    fn recovery_path(&self, id: &str) -> Result<PathBuf, String> {
        if id.is_empty() || !id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-') {
            return Err("Invalid recovery ID".into());
        }
        Ok(self.root.join("recovery").join(format!("{id}.json")))
    }
    pub fn write_recovery(&self, record: serde_json::Value) -> Result<(), String> {
        let id = record
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or("Missing recovery ID")?;
        atomic_write(
            &self.recovery_path(id)?,
            &serde_json::to_vec(&record).map_err(|e| e.to_string())?,
        )
    }
    pub fn read_recovery(&self, id: &str) -> Result<serde_json::Value, String> {
        let bytes = fs::read(self.recovery_path(id)?).map_err(|e| e.to_string())?;
        let record: serde_json::Value =
            serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
        if record["id"].as_str() != Some(id) {
            return Err("Recovery record ID does not match its source".into());
        }
        Ok(record)
    }
    pub fn remove_recovery(&self, id: &str) -> Result<(), String> {
        remove(&self.recovery_path(id)?)
    }
    pub fn list_recovery(&self) -> Result<Vec<serde_json::Value>, String> {
        let mut records = self.read_records("recovery")?;
        records.sort_by(|a, b| b["updatedAt"].as_str().cmp(&a["updatedAt"].as_str()));
        Ok(records)
    }
    fn read_records(&self, folder: &str) -> Result<Vec<serde_json::Value>, String> {
        let mut result = vec![];
        for entry in fs::read_dir(self.root.join(folder)).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            if entry.path().extension().and_then(|v| v.to_str()) != Some("json") {
                continue;
            }
            let record =
                serde_json::from_slice(&fs::read(entry.path()).map_err(|e| e.to_string())?)
                    .map_err(|e| format!("Could not read {}: {e}", entry.path().display()))?;
            result.push(record);
        }
        Ok(result)
    }
    pub fn remember(&self, path: &str) -> Result<(), String> {
        let file = Path::new(path);
        let record = serde_json::json!({ "path":path, "name":file.file_name().unwrap_or_default().to_string_lossy(), "folder":file.parent().unwrap_or(Path::new("")).to_string_lossy(), "openedAt":std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() });
        atomic_write(
            &self
                .root
                .join("recents")
                .join(format!("{}.json", revision(path.as_bytes()))),
            &serde_json::to_vec(&record).unwrap(),
        )
    }
    pub fn recents(&self) -> Result<Vec<RecentFile>, String> {
        let mut records = self.read_records("recents")?;
        records.sort_by(|a, b| b["openedAt"].as_u64().cmp(&a["openedAt"].as_u64()));
        records
            .into_iter()
            .map(|v| serde_json::from_value(v).map_err(|e| e.to_string()))
            .collect()
    }
    pub fn remove_recent(&self, path: &str) -> Result<(), String> {
        remove(
            &self
                .root
                .join("recents")
                .join(format!("{}.json", revision(path.as_bytes()))),
        )
    }
}
fn remove(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(windows)]
    #[test]
    fn claim_rereads_latest_live_source_content_and_file_identity() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::new(dir.path().into()).unwrap();
        let old = serde_json::json!({"id":"source","version":1,"updatedAt":"old","snapshot":{"title":"Old work"},"baseline":"old baseline","file":{"path":"old.takt","revision":"old revision"}});
        store.write_recovery(old.clone()).unwrap();
        let listed = store.list_recovery().unwrap().remove(0);
        let mut owner = RecoveryLeases::default();
        assert!(owner.acquire(&store, "source").unwrap());
        let latest = serde_json::json!({"id":"source","version":1,"updatedAt":"new","snapshot":{"title":"Latest work"},"baseline":"new baseline","file":{"path":"save-as.takt","revision":"new revision"}});
        store.write_recovery(latest.clone()).unwrap();
        let mut recovering = RecoveryLeases::default();
        let mut fork = recovering.claim(&store, listed).unwrap();
        assert_ne!(fork["id"], "source");
        fork["id"] = "source".into();
        assert_eq!(fork, latest);
        assert_eq!(store.read_recovery("source").unwrap(), latest);
    }
    #[cfg(windows)]
    #[test]
    fn invalid_claim_sources_fail_without_leaking_leases_or_replacing_records() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::new(dir.path().into()).unwrap();
        let mut recovering = RecoveryLeases::default();
        let mut other = RecoveryLeases::default();
        for (id, bytes) in [
            ("missing", None),
            ("corrupt", Some(b"{".as_slice())),
            ("mismatch", Some(br#"{"id":"another"}"#.as_slice())),
        ] {
            if let Some(bytes) = bytes {
                fs::write(store.recovery_path(id).unwrap(), bytes).unwrap();
            }
            assert!(recovering
                .claim(&store, serde_json::json!({"id":id}))
                .is_err());
            assert!(other.acquire(&store, id).unwrap());
            if let Some(bytes) = bytes {
                assert_eq!(fs::read(store.recovery_path(id).unwrap()).unwrap(), bytes);
            }
        }
    }
    #[cfg(windows)]
    #[test]
    fn abandoned_claim_releases_source_and_deletes_only_fork() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::new(dir.path().into()).unwrap();
        let record = serde_json::json!({"id":"source","updatedAt":"2026-10-10"});
        store.write_recovery(record.clone()).unwrap();
        let mut first = RecoveryLeases::default();
        let same = first.claim(&store, record.clone()).unwrap();
        assert_eq!(same["id"], "source");
        first.abandon(&store, "source", "source").unwrap();
        assert_eq!(store.list_recovery().unwrap().len(), 1);
        let mut second = RecoveryLeases::default();
        assert!(second.acquire(&store, "source").unwrap());
        let fork = first.claim(&store, record).unwrap();
        let fork_id = fork["id"].as_str().unwrap();
        assert_ne!(fork_id, "source");
        first.abandon(&store, fork_id, "source").unwrap();
        assert_eq!(store.list_recovery().unwrap().len(), 1);
        assert_eq!(store.list_recovery().unwrap()[0]["id"], "source");
        assert!(second.acquire(&store, fork_id).unwrap());
    }
    #[cfg(windows)]
    #[test]
    fn recovery_lock_child() {
        let Some(root) = std::env::var_os("TAKT_RECOVERY_LOCK_TEST") else {
            return;
        };
        let store = Store::new(PathBuf::from(root)).unwrap();
        let mut leases = RecoveryLeases::default();
        assert!(leases.acquire(&store, "interrupted").unwrap());
        store
            .write_recovery(serde_json::json!({"id":"interrupted","updatedAt":"2026-10-10"}))
            .unwrap();
        fs::write(store.root.join("ready"), "ready").unwrap();
        for _ in 0..500 {
            if store.root.join("release").exists() {
                return;
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        panic!("Recovery lease parent did not release helper");
    }
    #[cfg(windows)]
    #[test]
    fn live_process_recovery_forks_but_interrupted_recovery_is_claimed_and_discarded() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::new(dir.path().into()).unwrap();
        let mut child = std::process::Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "files::tests::recovery_lock_child",
                "--nocapture",
            ])
            .env("TAKT_RECOVERY_LOCK_TEST", dir.path())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .unwrap();
        for _ in 0..500 {
            if dir.path().join("ready").exists() {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        if !dir.path().join("ready").exists() {
            let _ = child.kill();
            panic!("Recovery lock helper did not become ready");
        }
        let record = store.list_recovery().unwrap().remove(0);
        let mut leases = RecoveryLeases::default();
        let live = leases.claim(&store, record.clone()).unwrap();
        assert_ne!(live["id"], record["id"]);
        assert_eq!(store.list_recovery().unwrap().len(), 2);
        // Abrupt process termination releases Windows handles without cleanup hooks.
        child.kill().unwrap();
        child.wait().unwrap();
        let interrupted = leases.claim(&store, record).unwrap();
        assert_eq!(interrupted["id"], "interrupted");
        store.remove_recovery("interrupted").unwrap();
        leases.release("interrupted");
        assert!(!store
            .list_recovery()
            .unwrap()
            .iter()
            .any(|item| item["id"] == "interrupted"));
    }
    #[test]
    fn safe_save_and_external_revision() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("project.takt");
        save(&path, "first", None, false).unwrap();
        let first = read(&path).unwrap();
        fs::write(&path, "other").unwrap();
        assert!(matches!(
            save(&path, "mine", Some(&first.revision), false).unwrap(),
            SavedFile::Conflict
        ));
        assert_eq!(fs::read_to_string(&path).unwrap(), "other");
        save(&path, "mine", Some(&first.revision), true).unwrap();
        assert_eq!(read(&path).unwrap().revision, revision(b"mine"));
    }
    #[test]
    fn failed_replace_preserves_original() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("file.takt");
        fs::write(&path, "original").unwrap();
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            let _lock = OpenOptions::new()
                .read(true)
                .share_mode(1)
                .open(&path)
                .unwrap();
            assert!(save(&path, "new", None, true).is_err());
            assert_eq!(fs::read_to_string(&path).unwrap(), "original");
        }
    }
    #[test]
    fn independent_recovery_and_unbounded_recents() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::new(dir.path().into()).unwrap();
        for id in ["process-one", "process-two"] {
            store
                .write_recovery(serde_json::json!({"id":id,"updatedAt":"2026-10-10"}))
                .unwrap();
        }
        store.remove_recovery("process-one").unwrap();
        assert_eq!(store.list_recovery().unwrap().len(), 1);
        assert!(store.remove_recovery("../escape").is_err());
        for i in 0..15 {
            store.remember(&format!("C:/files/{i}.takt")).unwrap();
        }
        assert_eq!(store.recents().unwrap().len(), 15);
        let project = dir.path().join("keep.takt");
        fs::write(&project, "keep").unwrap();
        store.remember(project.to_str().unwrap()).unwrap();
        store.remove_recent(project.to_str().unwrap()).unwrap();
        assert_eq!(fs::read_to_string(project).unwrap(), "keep");
    }
}
