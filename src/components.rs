pub(crate) mod app;
mod home;
mod spirit_details;

const CLASS_TEXTBF: &str = "textbf";
const CLASS_TEXTIT: &str = "textit";
const CLASS_TEXTSC: &str = "textsc";

pub(crate) use app::App;
use home::Home;
use spirit_details::SpiritDetails;
