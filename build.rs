use std::io::{self, Write};

fn main() -> io::Result<()> {
	use std::fs::File;

	println!("cargo:rerun-if-changed=Cargo.toml");

	// Retrieve variables for Makefile
	let mut dotenv = File::create("rust.env")?;
	for var in ["CARGO_PKG_NAME", "CARGO_PKG_VERSION_MAJOR", "TARGET"] {
		dotenv.write_fmt(format_args!(
			"{var}={}\n",
			std::env::var(var).unwrap_or_else(|_| panic!("missing environment variable \"{var}\""))
		))?;
	}
	dotenv.flush()?;

	Ok(())
}
