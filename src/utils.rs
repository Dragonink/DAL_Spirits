use enumflags2::{BitFlag, BitFlags};
use serde::{de::IntoDeserializer, Deserialize, Deserializer};
use std::{
	fmt::{self, Debug, Formatter},
	ops::{Deref, DerefMut},
};

/// Format a number to its [ordinal form](https://en.wikipedia.org/wiki/Ordinal_numeral)
pub(crate) fn ordinal_number<N: Into<usize>>(n: N) -> String {
	let n = n.into();
	macro_rules! format_ordinal {
		($card:expr) => {
			format!("{n}{card}", card = $card)
		};
	}
	if n > 10 && n < 20 {
		format_ordinal!("th")
	} else {
		match n % 10 {
			1 => format_ordinal!("st"),
			2 => format_ordinal!("nd"),
			3 => format_ordinal!("rd"),
			_ => format_ordinal!("th"),
		}
	}
}

/// [`BitFlags`] wrapper to deserialize using [`String::chars`]
pub(crate) struct CharFlags<T: BitFlag>(BitFlags<T>);
impl<T: BitFlag> Deref for CharFlags<T> {
	type Target = BitFlags<T>;

	fn deref(&self) -> &Self::Target {
		&self.0
	}
}
impl<T: BitFlag> DerefMut for CharFlags<T> {
	fn deref_mut(&mut self) -> &mut Self::Target {
		&mut self.0
	}
}
impl<'de, T: BitFlag + Deserialize<'de>> Deserialize<'de> for CharFlags<T> {
	fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
	where
		D: Deserializer<'de>,
	{
		let mut bitflags = BitFlags::default();
		let s = String::deserialize(deserializer)?;
		for c in s.chars() {
			let flag = T::deserialize(c.to_string().into_deserializer())?;
			bitflags |= flag;
		}
		Ok(Self(bitflags))
	}
}
impl<T: BitFlag + Debug> Debug for CharFlags<T> {
	fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
		write!(f, "{}", self.0)
	}
}
impl<T: BitFlag + Clone> Clone for CharFlags<T> {
	fn clone(&self) -> Self {
		Self(self.0)
	}
}
impl<T: BitFlag + Copy> Copy for CharFlags<T> {}
impl<T: BitFlag + PartialEq> PartialEq for CharFlags<T> {
	fn eq(&self, other: &Self) -> bool {
		self.0 == other.0
	}
}
impl<T: BitFlag + Eq> Eq for CharFlags<T> {}
impl<T: BitFlag + PartialEq> PartialEq<BitFlags<T>> for CharFlags<T> {
	fn eq(&self, other: &BitFlags<T>) -> bool {
		self.0.eq(other)
	}
}
