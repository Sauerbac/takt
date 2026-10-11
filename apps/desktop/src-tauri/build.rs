fn main() {
    // Re-embed the generated icon whenever it changes.
    println!("cargo:rerun-if-changed=icons/icon.ico");
    tauri_build::build()
}
