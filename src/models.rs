use crate::utils::CharFlags;
use dal_spirits_proc::{
	Display_with_Serialize, EnumVariantIter, FromStr_with_Deserialize, TryFrom_with_FromStr,
};
use either::Either;
use enumflags2::bitflags;
use serde::{Deserialize, Serialize};
use std::{
	cmp::Ordering,
	fmt::{self, Display, Formatter},
	hash::Hash,
	str::FromStr,
};
use wasm_bindgen::UnwrapThrowExt;

const REPO_ROOT: &str = "https://raw.githubusercontent.com/n0k0m3/DateALiveData/master/res/basic";
const FANDOM_ROOT: &str = "https://date-a-live.fandom.com/wiki";
const WIKI_ROOT: &str = "https://wikipedia.org/wiki";

#[derive(
	Debug,
	Clone,
	Copy,
	PartialEq,
	Eq,
	Hash,
	PartialOrd,
	Ord,
	Deserialize,
	Serialize,
	Display_with_Serialize,
	EnumVariantIter,
)]
pub(crate) enum Series {
	#[serde(rename = "Date A Live", alias = "")]
	DateALive,
	#[serde(rename = "Date A Bullet")]
	DateABullet,
	Index,
	Neptunia,
	DanMachi,
	Bofuri,
}
impl Default for Series {
	#[inline(always)]
	fn default() -> Self {
		Self::DateALive
	}
}
impl Series {
	#[inline(always)]
	pub fn is_collab(&self) -> bool {
		*self != Self::DateALive && *self != Self::DateABullet
	}
}

#[derive(
	Debug, Clone, Copy, PartialEq, Eq, Hash, Deserialize, Serialize, Display_with_Serialize,
)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Gender {
	#[serde(alias = "")]
	Female,
	Male,
}
impl Default for Gender {
	#[inline(always)]
	fn default() -> Self {
		Self::Female
	}
}

#[bitflags]
#[derive(
	Debug,
	Clone,
	Copy,
	PartialEq,
	Eq,
	PartialOrd,
	Ord,
	Hash,
	Deserialize,
	Serialize,
	Display_with_Serialize,
)]
#[repr(u8)]
pub(crate) enum Medium {
	#[serde(alias = "l", rename = "Main Light Novels")]
	MainLightNovels,
	#[serde(alias = "s", rename = "Spin-off Light Novels")]
	SpinoffLightNovels,
	#[serde(alias = "a", rename = "Anime")]
	Anime,
	#[serde(alias = "m")]
	Movie,
	#[serde(alias = "v", rename = "Visual Novels")]
	VisualNovels,
	#[serde(alias = "g")]
	Gacha,
}
impl Default for Medium {
	#[inline(always)]
	fn default() -> Self {
		Self::MainLightNovels
	}
}

#[allow(clippy::enum_variant_names)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Display_with_Serialize)]
pub(crate) enum Codename {
	Codename,
	#[serde(rename = "Goddess Title")]
	GoddessTitle,
	Username,
}
impl Default for Codename {
	#[inline(always)]
	fn default() -> Self {
		Self::Codename
	}
}
impl From<Series> for Codename {
	#[inline]
	fn from(series: Series) -> Self {
		match series {
			Series::Neptunia => Self::GoddessTitle,
			Series::Bofuri => Self::Username,
			_ => Self::default(),
		}
	}
}

pub(crate) trait Attribute {
	type Wording: ToString;

	fn wording(&self) -> &Self::Wording;
	fn name(&self) -> &str;
	fn subtitle(&self) -> Option<&str>;
}

impl<W: ToString> Attribute for (W, &str) {
	type Wording = W;

	#[inline(always)]
	fn wording(&self) -> &Self::Wording {
		&self.0
	}

	#[inline(always)]
	fn name(&self) -> &str {
		self.1
	}

	#[inline(always)]
	fn subtitle(&self) -> Option<&str> {
		None
	}
}

#[derive(
	Debug, Clone, Copy, PartialEq, Eq, Hash, Deserialize, Serialize, Display_with_Serialize,
)]
pub(crate) enum SephiraWording {
	#[serde(alias = "s")]
	Sephira,
	#[serde(alias = "q")]
	Qlipha,
	#[serde(alias = "l")]
	Land,
}
impl Default for SephiraWording {
	#[inline(always)]
	fn default() -> Self {
		Self::Sephira
	}
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Deserialize, Serialize)]
pub(crate) struct Sephira {
	wording: SephiraWording,
	name: String,
	subtitle: Option<String>,
	rest0: Option<String>,
	rest1: Option<String>,
}
impl Attribute for Sephira {
	type Wording = SephiraWording;

	#[inline(always)]
	fn wording(&self) -> &Self::Wording {
		&self.wording
	}

	#[inline(always)]
	fn name(&self) -> &str {
		&self.name
	}

	#[inline]
	fn subtitle(&self) -> Option<&str> {
		self.subtitle.as_deref()
	}
}
impl Sephira {
	#[inline]
	pub fn link(&self) -> String {
		match self.wording {
			SephiraWording::Sephira => format!(
				"{WIKI_ROOT}/{path}",
				path = self.rest0.as_deref().unwrap_or(&self.name)
			),
			SephiraWording::Qlipha => format!(
				"{WIKI_ROOT}/{path}",
				path = self.rest1.as_deref().unwrap_or(&self.name)
			),
			SephiraWording::Land => {
				format!("https://neptunia.fandom.com/wiki/{path}", path = self.name)
			}
		}
	}

	#[inline]
	pub fn icon(&self) -> Option<String> {
		match self.wording {
			SephiraWording::Sephira => Some(format!(
				"{REPO_ROOT}/icon/equipType/{name}.png",
				name = self.name
			)),
			SephiraWording::Qlipha => self
				.rest0
				.as_deref()
				.map(|r| format!("{REPO_ROOT}/icon/equipType/{r}.png")),
			SephiraWording::Land => self.rest0.as_deref().map(|r| {
				format!(
					"https://static.wikia.nocookie.net/neptunia/images/{r}/{name}_Logo.png",
					name = self.name
				)
			}),
		}
	}

	#[inline]
	pub fn guardian(&self) -> Option<String> {
		match self.wording {
			SephiraWording::Sephira => match self.name() {
				"Chesed" => Some("40210_D1"),
				"Geburah" => Some("40105_weixiao"),
				"Tiphareth" => Some("40106_weixiao"),
				_ => None,
			}
			.map(|s| format!("{REPO_ROOT}/icon/battleDialog/btlPortrait_{s}.png")),
			SephiraWording::Qlipha => self
				.rest0
				.as_deref()
				.and_then(|r| match r {
					"Kether" => Some("40201_a1"),
					"Chokhmah" => Some("40202_a1"),
					"Binah" => Some("40203_a1"),
					"Chesed" => Some("40209_c1"),
					"Geburah" => Some("31001L_d1"),
					"Tiphareth" => Some("31101L_a1"),
					_ => None,
				})
				.map(|s| format!("{REPO_ROOT}/icon/battleDialog/btlPortrait_{s}.png")),
			SephiraWording::Land => match self.name() {
				"Planeptune" => Some("40214_b1"),
				"Lastation" => Some("40220_weixiao"),
				"Lowee" => Some("40216_a1"),
				"Leanbox" => Some("40218_daiji"),
				_ => None,
			}
			.map(|s| format!("{REPO_ROOT}/icon/battleDialog/btlPortrait_{s}.png")),
		}
	}
}

#[derive(
	Debug, Clone, Copy, PartialEq, Eq, Hash, Deserialize, Serialize, Display_with_Serialize,
)]
pub(crate) enum AngelWording {
	#[serde(alias = "a")]
	Angel,
	#[serde(alias = "w")]
	Weapon,
	#[serde(alias = "d")]
	Demon,
	#[serde(rename = "Unsigned Angel", alias = "u")]
	UnsignedAngel,
	#[serde(rename = "Esper Power", alias = "e")]
	EsperPower,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Deserialize, Serialize)]
pub(crate) struct Angel {
	wording: AngelWording,
	name: String,
	subtitle: Option<String>,
	rest0: Option<String>,
}
impl Attribute for Angel {
	type Wording = AngelWording;

	#[inline(always)]
	fn wording(&self) -> &Self::Wording {
		&self.wording
	}

	#[inline(always)]
	fn name(&self) -> &str {
		&self.name
	}

	#[inline]
	fn subtitle(&self) -> Option<&str> {
		self.subtitle.as_deref()
	}
}
impl Angel {
	#[inline]
	pub fn link(&self) -> Option<String> {
		(self.wording == AngelWording::Angel || self.wording == AngelWording::Demon).then(|| {
			format!(
				"{WIKI_ROOT}/{page}",
				page = self
					.rest0
					.as_deref()
					.and_then(|s| (!s.is_empty()).then(|| s))
					.unwrap_or(&self.name)
			)
		})
	}
}

#[derive(
	Debug, Clone, Copy, PartialEq, Eq, Hash, Deserialize, Serialize, Display_with_Serialize,
)]
pub(crate) enum AstralDressWording {
	#[serde(rename = "Astral Dress", alias = "ad")]
	AstralDress,
	#[serde(rename = "CR-Unit", alias = "cr")]
	CrUnit,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Deserialize, Serialize)]
pub(crate) struct AstralDress {
	wording: AstralDressWording,
	name: String,
	#[serde(with = "either::serde_untagged_optional")]
	number: Option<Either<u16, String>>,
}
impl Attribute for AstralDress {
	type Wording = AstralDressWording;

	#[inline(always)]
	fn wording(&self) -> &Self::Wording {
		&self.wording
	}

	#[inline(always)]
	fn name(&self) -> &str {
		&self.name
	}

	#[inline(always)]
	fn subtitle(&self) -> Option<&str> {
		None
	}
}
impl AstralDress {
	#[inline]
	pub fn subtitle(&self, spirit: &Spirit) -> Option<String> {
		self.number.as_ref().map(|n| {
			let n = match n {
				Either::Left(num) => crate::utils::ordinal_number(*num),
				Either::Right(txt) => txt.to_string(),
			};
			match spirit.form.as_str() {
				"Pseudo-Spirit" => format!("Incantation Spirit Dress, {n}"),
				"Quasi-Spirit" => format!("Stranded Spirit Dress, {n}",),
				_ => format!("Spirit Dress of God's Authority, {n}",),
			}
		})
	}

	#[inline]
	pub fn link(&self, spirit: &Spirit) -> Option<String> {
		(self.wording == AstralDressWording::AstralDress && spirit.form != "Quasi-Spirit")
			.then(|| format!("{WIKI_ROOT}/Names_of_God_in_Judaism"))
	}
}

#[derive(
	Debug,
	Clone,
	Copy,
	PartialEq,
	Eq,
	Hash,
	PartialOrd,
	Ord,
	Deserialize,
	Serialize,
	FromStr_with_Deserialize,
	Display_with_Serialize,
)]
pub(crate) enum Month {
	January,
	February,
	March,
	April,
	May,
	June,
	July,
	August,
	September,
	October,
	November,
	December,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Deserialize, Serialize, TryFrom_with_FromStr)]
#[serde(try_from = "String")]
pub(crate) struct Birthdate(Month, u8);
impl FromStr for Birthdate {
	type Err = &'static str;

	fn from_str(s: &str) -> Result<Self, Self::Err> {
		use once_cell::sync::Lazy;
		use regex::Regex;

		static RE: Lazy<Regex> =
			Lazy::new(|| Regex::new(r"(?P<month>\w+)\s+(?P<day>\d{1,2})").unwrap_throw());

		let caps = RE.captures(s).ok_or("could not find date")?;
		let month = caps
			.name("month")
			.unwrap_throw()
			.as_str()
			.parse()
			.map_err(|_err| "invalid month")?;
		let day: u8 = caps
			.name("day")
			.unwrap_throw()
			.as_str()
			.parse()
			.map_err(|_err| "invalid day")?;
		Ok(Birthdate(month, day))
	}
}
impl PartialOrd for Birthdate {
	#[inline]
	fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
		self.0.partial_cmp(&other.0).and_then(|ord| {
			if ord == Ordering::Equal {
				self.1.partial_cmp(&other.1)
			} else {
				Some(ord)
			}
		})
	}
}
impl Ord for Birthdate {
	fn cmp(&self, other: &Self) -> Ordering {
		let ord = self.0.cmp(&other.0);
		if ord == Ordering::Equal {
			self.1.cmp(&other.1)
		} else {
			ord
		}
	}
}
impl Display for Birthdate {
	fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
		write!(
			f,
			"{month} {n}",
			month = self.0,
			n = crate::utils::ordinal_number(self.1),
		)
	}
}

#[allow(clippy::upper_case_acronyms)]
#[derive(
	Debug,
	Clone,
	Copy,
	PartialEq,
	Eq,
	Hash,
	PartialOrd,
	Ord,
	Deserialize,
	Serialize,
	Display_with_Serialize,
)]
pub(crate) enum Class {
	D,
	C,
	B,
	A,
	AA,
	AAA,
	S,
	SS,
	SSS,
	Ex,
}
impl Class {
	pub fn icon(&self) -> (String, u8) {
		let (id, rep) = match self {
			Self::D => ("d", 1),
			Self::C => ("c", 1),
			Self::B => ("b", 1),
			Self::A => ("a", 1),
			Self::AA => ("a", 2),
			Self::AAA => ("a", 3),
			Self::S => ("aaa", 1),
			Self::SS => ("aaa", 2),
			Self::SSS => ("aaa", 3),
			Self::Ex => ("sss", 1),
		};
		(format!("{REPO_ROOT}/ui/common/hero/quality_{id}.png"), rep)
	}
}

#[bitflags]
#[derive(
	Debug, Clone, Copy, PartialEq, Eq, Hash, Deserialize, Serialize, Display_with_Serialize,
)]
#[repr(u16)]
pub(crate) enum Element {
	#[serde(alias = "p")]
	Physical,
	#[serde(alias = "m")]
	Magic,
	#[serde(alias = "f")]
	Fire,
	#[serde(alias = "l")]
	Lightning,
	#[serde(alias = "t")]
	Tempest,
	#[serde(alias = "i")]
	Frost,
	#[serde(alias = "h")]
	Holy,
	#[serde(alias = "d")]
	Dark,
	#[serde(alias = "s")]
	Spiritual,
	#[serde(alias = "v")]
	Space,
}
impl Element {
	#[inline]
	pub fn icon(&self) -> Option<String> {
		match self {
			Self::Physical => Some(5),
			Self::Magic => Some(1),
			Self::Fire => Some(2),
			Self::Lightning => Some(3),
			Self::Tempest => Some(4),
			Self::Frost => Some(6),
			Self::Holy => Some(7),
			Self::Dark => Some(8),
			_ => None,
		}
		.map(|id: u8| format!("{REPO_ROOT}/icon/element/{id}.png"))
	}
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub(crate) struct Spirit {
	series: Option<Series>,
	pub firstname: String,
	pub lastname: Option<String>,
	gender: Option<Gender>,
	codename: Option<String>,
	pub form: String,
	pub media: CharFlags<Medium>,
	icon_id: Option<String>,
	image_id: Option<String>,
	pub sephiras: Vec<Sephira>,
	pub angels: Vec<Angel>,
	pub astraldresses: Vec<AstralDress>,
	pub birthdate: Option<Birthdate>,
	pub height: Option<u8>,
	pub weight: Option<u8>,
	pub bust: Option<u8>,
	pub waist: Option<u8>,
	pub hips: Option<u8>,
	pub class: Option<Class>,
	pub spacequake_class: Option<Class>,
	pub angel_class: Option<Class>,
	pub astraldress_class: Option<Class>,
	pub strength: Option<u16>,
	pub consistency: Option<u16>,
	pub spirit_power: Option<u16>,
	pub agility: Option<u16>,
	pub intelligence: Option<u16>,
	pub rank: Option<Class>,
	pub attack: Option<u8>,
	pub combo: Option<u8>,
	pub support: Option<u8>,
	pub defense: Option<u8>,
	pub control: Option<u8>,
	pub damage: Option<u8>,
	pub elements: CharFlags<Element>,
	wiki_link: Option<String>,
	spoiler: Option<bool>,
}
impl Spirit {
	#[inline]
	pub fn series(&self) -> Series {
		self.series.unwrap_or_default()
	}

	pub fn form_url(&self) -> String {
		use once_cell::sync::Lazy;
		use regex::Regex;

		static RE_NOT_WORD: Lazy<Regex> = Lazy::new(|| Regex::new(r"\W").unwrap_throw());
		static RE_PARENTHESIS: Lazy<Regex> = Lazy::new(|| Regex::new(r"\((.+)\)").unwrap_throw());

		RE_NOT_WORD
			.replace_all(&RE_PARENTHESIS.replace_all(&self.form, "_$1"), "")
			.to_string()
	}

	#[inline]
	pub fn gender(&self) -> Gender {
		self.gender.unwrap_or_default()
	}

	#[inline]
	pub fn a11y(&self) -> String {
		format!("{form} {name}", form = self.form, name = self.firstname)
	}

	#[inline]
	pub fn codename(&self) -> Option<(Codename, &str)> {
		self.codename
			.as_ref()
			.map(|term| (self.series().into(), term.as_str()))
	}

	#[inline]
	pub fn icon(&self) -> Option<String> {
		self.icon_id
			.as_deref()
			.map(|id| format!("{REPO_ROOT}/icon/hero/face/{id}.png"))
	}

	#[inline]
	pub fn image(&self) -> Option<String> {
		use once_cell::sync::Lazy;
		use regex::Regex;

		self.image_id
			.as_deref()
			.map(|id| {
				static RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^\d+$").unwrap_throw());

				if RE.is_match(id) {
					format!("{REPO_ROOT}/icon/teampic/{id}.png")
				} else {
					format!("https://static.wikia.nocookie.net/date-a-live/images/{id}.png")
				}
			})
			.or_else(|| {
				self.icon_id
					.as_ref()
					.map(|id| format!("{REPO_ROOT}/icon/teampic/{id}.png"))
			})
	}

	#[inline]
	pub fn wiki_link(&self) -> Option<String> {
		self.wiki_link
			.as_ref()
			.map(|wiki_link| format!("{FANDOM_ROOT}/{wiki_link}"))
	}

	#[inline]
	pub fn spoiler(&self) -> bool {
		self.spoiler.unwrap_or_default()
	}
}
