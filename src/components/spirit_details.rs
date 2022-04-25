use crate::models::{Attribute, Spirit};
use std::{fmt::Display, marker::PhantomData, rc::Rc};
use sycamore::{builder::ElementBuilderOrView, prelude::*};
use wasm_bindgen::UnwrapThrowExt;

#[component]
pub(super) fn SpiritDetails<G: Html>(cx: Scope, spirit: Rc<Spirit>) -> View<G> {
	use sycamore::builder::prelude::*;

	fragment([Header(cx, spirit.clone()), Main(cx, spirit)])
}

#[component]
fn Header<G: Html>(cx: Scope, spirit: Rc<Spirit>) -> View<G> {
	use sycamore::builder::prelude::*;

	let spirit_form = create_ref(cx, spirit.form.clone());
	let firstname = create_ref(cx, spirit.firstname.clone());
	let lastname = create_ref(cx, spirit.lastname.as_ref().cloned().unwrap_or_default());
	let a11y = create_ref(cx, spirit.a11y());

	h(header)
		.c(h(h1)
			.c(h(span).class(super::CLASS_TEXTIT).t(spirit_form))
			.t(" · ")
			.t(firstname)
			.t(" ")
			.c(h(span).class(super::CLASS_TEXTSC).t(lastname)))
		.c(h(img)
			.attr("src", spirit.image().unwrap_or_default())
			.attr("alt", format!("{a11y} full body")))
		.view(cx)
}

#[component]
fn Main<G: Html>(cx: Scope, spirit: Rc<Spirit>) -> View<G> {
	use crate::models::Medium;
	use sycamore::builder::prelude::*;

	let wiki_link = create_ref(cx, spirit.wiki_link());
	let is_spirit =
		spirit.media.contains(Medium::MainLightNovels) && !spirit.form.contains("Wizard");
	let is_gacha = spirit.media.contains(Medium::Gacha);
	let spirit_clone = spirit.clone();

	h(main)
		.dyn_if(
			|| wiki_link.is_some(),
			|| {
				h(a).attr("rel", "external")
					.attr("target", "_blank")
					.attr("hreflang", "en")
					.attr("href", wiki_link.as_ref().unwrap_throw())
					.t("Open Fandom wiki")
			},
			View::empty,
		)
		.c(MediaSection(cx, spirit.clone()))
		.c(AttributesSection(cx, spirit.clone()))
		.c(PersonalInfoSection(cx, spirit.clone()))
		.dyn_if(
			move || is_spirit,
			move || LoreStatsSection(cx, spirit_clone.clone()),
			View::empty,
		)
		.dyn_if(
			move || is_gacha,
			move || GachaStatsSection(cx, spirit.clone()),
			View::empty,
		)
		.view(cx)
}

#[component]
fn MediaSection<G: Html>(cx: Scope, spirit: Rc<Spirit>) -> View<G> {
	use sycamore::builder::prelude::*;

	let mut media = spirit.media.iter().collect::<Vec<_>>();
	media.sort_unstable();

	h(section)
		.id("media")
		.c(View::new_fragment(
			media
				.into_iter()
				.map(|medium| {
					let class = create_ref(cx, format!("{medium:?}"));
					let medium = create_ref(cx, medium.to_string());

					h(span)
						.class(class)
						.attr("title", format!("This character appears in the {medium}"))
						.t(medium)
						.view(cx)
				})
				.collect(),
		))
		.view(cx)
}

#[component]
fn AttributesSection<G: Html>(cx: Scope, spirit: Rc<Spirit>) -> View<G> {
	use crate::models::{Angel, AstralDress, Sephira};
	use sycamore::builder::prelude::*;

	macro_rules! attribute_fragment {
		($attributes:expr, $get_subtitle:expr, $get_link:expr) => {
			View::new_fragment(
				$attributes
					.iter()
					.map(|attribute| {
						let wording = create_ref(cx, attribute.wording().to_string());
						let name = create_ref(cx, attribute.name().to_owned());
						let el = $get_link(attribute)
							.as_ref()
							.map(|attribute_link| {
								let angel_link = create_ref(cx, attribute_link.clone());
								h(a).attr("rel", "external")
									.attr("target", "_blank")
									.attr("hreflang", "en")
									.attr("href", angel_link)
									.t(name)
									.view(cx)
							})
							.unwrap_or_else(|| t(name));

						h(tr)
							.c(h(th).attr("scope", "row").t(wording))
							.c(
								h(tr).c(if let Some(ref subtitle) = $get_subtitle(attribute) {
									let subtitle = create_ref(cx, subtitle.clone());

									fragment([el, t(" — "), t(subtitle)])
								} else {
									fragment([el])
								}),
							)
							.view(cx)
					})
					.collect(),
			)
		};
		($attributes:expr, $get_subtitle:expr, $get_link:expr, $details_builder:expr) => {
			View::new_fragment(
				$attributes
					.iter()
					.map(|attribute| {
						let wording = create_ref(cx, attribute.wording().to_string());
						let name = create_ref(cx, attribute.name().to_owned());
						let el = $get_link(attribute)
							.as_ref()
							.map(|attribute_link| {
								let attribute_link = create_ref(cx, attribute_link.clone());
								h(a).attr("rel", "external")
									.attr("target", "_blank")
									.attr("hreflang", "en")
									.attr("href", attribute_link)
									.t(name)
									.view(cx)
							})
							.unwrap_or_else(|| t(name));
						let frag = if let Some(ref subtitle) = $get_subtitle(attribute) {
							let subtitle = create_ref(cx, subtitle.clone());

							fragment([el, t(" — "), t(subtitle)])
						} else {
							fragment([el])
						};

						h(tr)
							.c(h(th).attr("scope", "row").t(wording))
							.c(h(tr).c(h(details)
								.c(h(summary).c(frag))
								.c($details_builder(attribute))))
							.view(cx)
					})
					.collect(),
			)
		};
	}

	const SEC_ID: &str = "attributes-hd";
	let codename = create_ref(
		cx,
		spirit
			.codename()
			.map(|(term, name)| (term.to_string(), name.to_string())),
	);

	h(section)
		.id("attributes")
		.attr("aria-labelledby", SEC_ID)
		.c(h(h2).id(SEC_ID).t("Attributes"))
		.c(h(table)
			.dyn_if(
				|| codename.is_some(),
				move || {
					let (wording, name) = codename.as_ref().unwrap_throw();

					h(tr)
						.c(h(th).attr("scope", "row").t(wording))
						.c(h(td).t(name))
				},
				View::empty,
			)
			.c(attribute_fragment!(
				&spirit.sephiras,
				|sephira: &Sephira| sephira.subtitle().map(|subtitle| subtitle.to_string()),
				|sephira: &Sephira| Some(sephira.link()),
				|sephira: &Sephira| {
					let icon = create_ref(cx, sephira.icon());
					let guardian = create_ref(cx, sephira.guardian());

					h(table)
						.c(h(thead).c(h(tr)
							.c(h(th).attr("scope", "col").t("Icon"))
							.c(h(th).attr("scope", "col").t("Guardian"))))
						.c(h(tbody).c(h(tr)
							.c(h(td).c(h(img).dyn_attr("src", || icon.as_ref())))
							.c(h(td).c(h(img).dyn_attr("src", || guardian.as_ref())))))
				}
			))
			.c(attribute_fragment!(
				&spirit.angels,
				|angel: &Angel| angel.subtitle().map(|subtitle| subtitle.to_string()),
				|angel: &Angel| angel.link()
			))
			.c(attribute_fragment!(
				&spirit.astraldresses,
				|astral_dress: &AstralDress| astral_dress.subtitle(&spirit),
				|astral_dress: &AstralDress| astral_dress.link(&spirit)
			)))
		.view(cx)
}

#[derive(Prop)]
struct TableRowProps<'a, V, G, O, F>
where
	V: 'a,
	G: GenericNode,
	O: ElementBuilderOrView<'a, G> + 'a,
	F: FnMut(&'a V) -> O + 'a,
{
	name: &'static str,
	val: &'a Option<V>,
	el_builder: F,
	_phantom: PhantomData<G>,
}
impl<'a, V, G, O, F> TableRowProps<'a, V, G, O, F>
where
	V: 'a,
	G: GenericNode,
	O: ElementBuilderOrView<'a, G> + 'a,
	F: FnMut(&'a V) -> O + 'a,
{
	#[inline(always)]
	pub fn new(name: &'static str, val: &'a Option<V>, el_builder: F) -> Self {
		Self {
			name,
			val,
			el_builder,
			_phantom: PhantomData,
		}
	}
}
#[component]
fn TableRow<'a, V, O, F, G: Html>(cx: Scope<'a>, props: TableRowProps<'a, V, G, O, F>) -> View<G>
where
	V: 'a,
	O: ElementBuilderOrView<'a, G> + 'a,
	F: FnMut(&'a V) -> O + 'a,
{
	use sycamore::builder::prelude::*;

	let TableRowProps {
		name,
		val,
		mut el_builder,
		..
	} = props;

	h(tr)
		.c(h(th).attr("scope", "row").t(name))
		.c(h(td).dyn_if(
			|| val.is_some(),
			move || el_builder(val.as_ref().unwrap_throw()), //|| t(val.as_ref().unwrap_throw()),
			|| h(i).t("Unknown"),
		))
		.view(cx)
}

#[component]
fn PersonalInfoSection<G: Html>(cx: Scope, spirit: Rc<Spirit>) -> View<G> {
	use crate::models::Gender;
	use sycamore::builder::prelude::*;

	const SEC_ID: &str = "personal-info";
	let gender = create_ref(cx, spirit.gender());
	let birthdate = create_ref(cx, spirit.birthdate.map(|val| val.to_string()));
	let height = create_ref(cx, spirit.height.map(|val| val.to_string() + " cm"));
	let weight = create_ref(cx, spirit.weight.map(|val| val.to_string() + " kg"));
	let bwh = create_ref(
		cx,
		spirit
			.bust
			.zip(spirit.waist)
			.zip(spirit.hips)
			.map(|((bust, waist), hips)| format!("{bust}·{waist}·{hips} cm")),
	);

	let el_builder = |val| t(val);
	h(section)
		.attr("aria-labelledby", SEC_ID)
		.c(h(h2).id(SEC_ID).t("Personal info"))
		.c(h(table)
			.c(TableRow(
				cx,
				TableRowProps::new("Birthdate", birthdate, el_builder),
			))
			.c(TableRow(
				cx,
				TableRowProps::new("Height", height, el_builder),
			))
			.c(TableRow(
				cx,
				TableRowProps::new("Weight", weight, el_builder),
			))
			.dyn_if(
				|| Gender::Female.eq(gender),
				move || TableRow(cx, TableRowProps::new("B·W·H", bwh, el_builder)),
				View::empty,
			))
		.view(cx)
}

#[derive(Prop)]
struct StatGraphProps<'r, N> {
	stats: &'r [(&'static str, &'static str, N)],
	max_value: N,
}
#[component]
fn StatGraph<N: Into<f32> + Copy + Display, G: Html>(
	cx: Scope,
	props: StatGraphProps<N>,
) -> View<G> {
	use std::f32::consts::PI;
	use sycamore::builder::prelude::*;

	const SCALE: f32 = 100f32;
	const MARGIN: f32 = 50f32;
	const CLASS_WIREFRAME: &str = "wireframe";
	let StatGraphProps { stats, max_value } = props;
	let max_value = max_value.into();
	let len = stats.len();
	let get_coords = |point_idx: f32| {
		let (mut y, mut x) = ((1f32 / 2f32 + 2f32 * point_idx / len as f32) * PI).sin_cos();
		x *= SCALE;
		y *= -SCALE;
		(x, y)
	};
	let acc_points = |acc: String, (x, y): (f32, f32)| acc + &format!(" {x},{y}");

	h(svg)
		.attr(
			"viewBox",
			format!(
				"-{min} -{min} {size} {size}",
				min = SCALE + MARGIN,
				size = 2f32 * (SCALE + MARGIN)
			),
		)
		.c(h(polygon).class(CLASS_WIREFRAME).attr(
			"points",
			(0..len)
				.map(|idx| get_coords(idx as f32))
				.fold(String::new(), acc_points),
		))
		.c(View::new_fragment(
			(0..len)
				.map(|idx| {
					let (x, y) = get_coords(idx as f32);

					h(line)
						.class(CLASS_WIREFRAME)
						.attr("x1", "0")
						.attr("y1", "0")
						.attr("x2", x.to_string())
						.attr("y2", y.to_string())
						.view(cx)
				})
				.collect(),
		))
		.c(h(polygon).attr(
			"points",
			stats
				.iter()
				.enumerate()
				.map(|(idx, (_, _, val))| {
					let (mut x, mut y) = get_coords(idx as f32);
					let val = (*val).into();
					if val <= max_value {
						let ratio = val / max_value;
						x *= ratio;
						y *= ratio;
					}
					(x, y)
				})
				.fold(String::new(), acc_points),
		))
		.c(View::new_fragment(
			stats
				.iter()
				.enumerate()
				.map(|(idx, (name, abbrev, val))| {
					const RATIO: f32 = 1.05;
					const X_LIMIT: f32 = 90f32;
					const Y_LIMIT: f32 = 50f32;

					let (mut x, mut y) = get_coords(idx as f32);
					x *= RATIO;
					y *= RATIO;
					let name = create_ref(cx, name.to_string());
					let abbrev = create_ref(cx, format!("{abbrev} "));
					let val = create_ref(cx, val.to_string());

					h(text)
						.attr("x", x.to_string())
						.attr("y", y.to_string())
						.dyn_class("anchor-x-middle", move || x.abs() < X_LIMIT)
						.dyn_class("anchor-x-end", move || x <= -X_LIMIT)
						.dyn_class("anchor-y-top", move || y >= Y_LIMIT)
						.c(h(title).t(name))
						.c(h(tspan).class(super::CLASS_TEXTBF).t(abbrev))
						.t(val)
						.view(cx)
				})
				.collect(),
		))
		.view(cx)
}

#[component]
fn LoreStatsSection<'a, G: Html>(cx: Scope<'a>, spirit: Rc<Spirit>) -> View<G> {
	use sycamore::builder::prelude::*;

	const SEC_ID: &str = "lore-stats-hd";
	let spirit_class = create_ref(cx, spirit.class.map(|class| class.icon()));
	let spacequake_class = create_ref(cx, spirit.spacequake_class.map(|class| class.icon()));
	let angel_class = create_ref(cx, spirit.angel_class.map(|class| class.icon()));
	let astraldress_class = create_ref(cx, spirit.astraldress_class.map(|class| class.icon()));
	let stats = create_ref(
		cx,
		spirit
			.strength
			.zip(spirit.consistency)
			.zip(spirit.spirit_power)
			.zip(spirit.agility)
			.zip(spirit.intelligence)
			.map(
				|((((strength, consistency), spirit_power), agility), intelligence)| {
					[
						("Strength", "STR", strength),
						("Consistency", "CST", consistency),
						("Spiritual Power", "SPI", spirit_power),
						("Agility", "AGI", agility),
						("Intelligence", "INT", intelligence),
					]
				},
			),
	);

	let el_builder = move |(src, rep): &'a (String, u8)| {
		View::new_fragment(
			(0..*rep)
				.map(|_| h(img).attr("src", src).view(cx))
				.collect(),
		)
	};
	h(section)
		.id("lore-stats")
		.attr("aria-labelledby", SEC_ID)
		.c(h(h2).id(SEC_ID).t("Lore stats"))
		.c(h(div)
			.c(h(table)
				.c(TableRow(
					cx,
					TableRowProps::new("Class", spirit_class, el_builder),
				))
				.c(TableRow(
					cx,
					TableRowProps::new("Spacequake class", spacequake_class, el_builder),
				))
				.c(TableRow(
					cx,
					TableRowProps::new("Angel class", angel_class, el_builder),
				))
				.c(TableRow(
					cx,
					TableRowProps::new("Astral Dress class", astraldress_class, el_builder),
				)))
			.dyn_if(
				|| stats.is_some(),
				move || {
					StatGraph(
						cx,
						StatGraphProps {
							stats: &stats.unwrap_throw(),
							max_value: 300,
						},
					)
				},
				View::empty,
			))
		.view(cx)
}

#[component]
fn GachaStatsSection<G: Html>(cx: Scope, spirit: Rc<Spirit>) -> View<G> {
	use sycamore::builder::prelude::*;

	const SEC_ID: &str = "gacha-stats-hd";
	let rank = create_ref(
		cx,
		spirit.rank.map(|class| (class.to_string(), class.icon())),
	);
	let stats = create_ref(
		cx,
		spirit
			.attack
			.zip(spirit.combo)
			.zip(spirit.support)
			.zip(spirit.defense)
			.zip(spirit.control)
			.zip(spirit.damage)
			.map(
				|(((((attack, combo), support), defense), control), damage)| {
					[
						("Attack", "ATK", attack),
						("Combination", "CMB", combo),
						("Support", "SUP", support),
						("Defense", "DEF", defense),
						("Control", "CTL", control),
						("Damage", "DMG", damage),
					]
				},
			),
	);

	h(section)
		.id("gacha-stats")
		.attr("aria-labelledby", SEC_ID)
		.c(h(h2).id(SEC_ID).t("Gacha stats"))
		.c(h(div)
			.c(h(table)
				.c(TableRow(
					cx,
					TableRowProps::new("Rank", rank, move |(a11y, (src, rep))| {
						View::new_fragment(
							(0..*rep)
								.map(|_| h(img).attr("src", src).attr("alt", a11y).view(cx))
								.collect(),
						)
					}),
				))
				.c(h(tr).c(h(th).attr("scope", "row").t("Elements")).c(h(td).c(
					View::new_fragment(
						spirit
							.elements
							.iter()
							.map(|el| {
								let icon = create_ref(cx, el.icon());
								let el = create_ref(cx, el.to_string());

								h(span)
									.class(format!("element {el}"))
									.dyn_if(
										|| icon.is_some(),
										move || {
											h(img)
												.attr("src", icon.as_ref().unwrap_throw())
												.attr("alt", format!("{el} element icon"))
										},
										View::empty,
									)
									.t(el)
									.view(cx)
							})
							.collect(),
					),
				))))
			.dyn_if(
				|| stats.is_some(),
				move || {
					StatGraph(
						cx,
						StatGraphProps {
							stats: &stats.unwrap_throw(),
							max_value: 100,
						},
					)
				},
				View::empty,
			))
		.view(cx)
}
