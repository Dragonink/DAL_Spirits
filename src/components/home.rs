use crate::models::{Series, Spirit};
use std::rc::Rc;
use sycamore::prelude::*;
use wasm_bindgen::{JsCast, UnwrapThrowExt};

#[derive(Prop)]
pub(super) struct HomeProps<'a> {
	pub data_sig: &'a ReadSignal<Vec<Rc<Spirit>>>,
	pub spoilers_sig: &'a Signal<bool>,
}
#[component]
pub(super) fn Home<'a, G: Html>(cx: Scope<'a>, props: HomeProps<'a>) -> View<G> {
	use sycamore::builder::prelude::*;

	use web_sys::{Event, HtmlInputElement};

	let HomeProps {
		data_sig,
		spoilers_sig,
	} = props;

	fragment([
		h(header).attr("role", "banner")
			.c(h(img)
				.attr(
					"src",
					"https://vignette4.wikia.nocookie.net/date-a-live/images/8/89/Wiki-wordmark.png",
				)
				.attr("alt", "'Date A Live' Spirits"))
			.view(cx),
		h(main)
			.c(h(nav).attr("aria-label", "Spirits").c(View::new_fragment(
				Series::variants()
					.into_iter()
					.map(|series| {
						let data_sig = data_sig.map(cx, move |spirits| {
							spirits
								.iter()
								.filter(|spirit| {
									spirit.series() == series
										&& (*spoilers_sig.get() || !spirit.spoiler())
								})
								.cloned()
								.collect()
						});
						NavSeries(cx, NavSeriesProps { series, data_sig })
					})
					.collect(),
			)))
			.c(h(hr))
			.c(h(div)
				.attr("aria-label", "Navigation options")
				.id("nav-options")
				.c(h(label)
					.c(h(input).attr("type", "checkbox").on("input", |ev: Event| {
						spoilers_sig.set(!*spoilers_sig.get() && web_sys::window()
							.unwrap_throw()
							.confirm_with_message("Are you sure? Enabling this option will reveal heavy spoilers from the end of the 'Date A Live' story.")
							.unwrap_or_default());
						ev.target().unwrap_throw().unchecked_into::<HtmlInputElement>().set_checked(*spoilers_sig.get());
					}))
					.t("Enable spoilers")))
			.view(cx)
	])
}

#[derive(Prop)]
struct NavSeriesProps<'a> {
	series: Series,
	data_sig: &'a ReadSignal<Vec<Rc<Spirit>>>,
}
#[component]
fn NavSeries<'a, G: Html>(cx: Scope<'a>, props: NavSeriesProps<'a>) -> View<G> {
	use std::collections::HashMap;
	use sycamore::{builder::prelude::*, component::Prop};

	let NavSeriesProps { series, data_sig } = props;
	let id = create_ref(cx, format!("{series:?}"));
	let series_txt = create_ref(cx, series.to_string());
	let split_data_sig = create_signal(cx, HashMap::new());
	let chara_order_sig = create_signal(cx, Vec::new());
	create_effect(cx, move || {
		let mut split_data_sig = split_data_sig.modify();
		split_data_sig
			.values_mut()
			.for_each(|vec_sig: &mut &Signal<Vec<Rc<Spirit>>>| {
				vec_sig.modify().clear();
			});
		let mut chara_order_sig = chara_order_sig.modify();
		chara_order_sig.clear();
		data_sig.get().iter().for_each(|spirit| {
			let k = (spirit.firstname.clone(), spirit.lastname.clone());
			if !chara_order_sig.contains(&k) {
				chara_order_sig.push(k.clone());
			}
			if !split_data_sig.contains_key(&k) {
				split_data_sig.insert(k.clone(), create_signal(cx, Vec::new()));
			}
			split_data_sig
				.get_mut(&k)
				.unwrap_throw()
				.modify()
				.push(spirit.clone());
		});
	});
	let split_data_sig = create_memo(cx, || {
		chara_order_sig
			.get()
			.iter()
			.filter_map(|(firstname, lastname)| {
				let k = (firstname.clone(), lastname.clone());
				split_data_sig.get().get(&k).map(|sig| (k, *sig))
			})
			.collect::<Vec<_>>()
	});

	h(div)
		.attr("aria-labelledby", id)
		.class("series")
		.dyn_c(move || {
			let el = h(h2).attr("id", id).t(series_txt);
			if series.is_collab() {
				el.c(h(span).t("COLLAB").attr("title", "These characters are not from the 'Date A Live' lore. They were added in the 'Spirit Pledge' game during collaboration events.")).view(cx)
			} else {
				el.view(cx)
			}
		})
		.dyn_c(move || {
			let props = KeyedProps::builder()
				.iterable(split_data_sig)
				.key(|(k, _)| k.clone())
				.view(|cx, ((firstname, lastname), data_sig)| {
					NavChara(cx, NavCharaProps {
						firstname,
						lastname,
						data_sig,
					})
				})
				.build();
			Keyed(cx, props)
		})
		.view(cx)
}

#[derive(Prop)]
struct NavCharaProps<'a> {
	firstname: String,
	lastname: Option<String>,
	data_sig: &'a ReadSignal<Vec<Rc<Spirit>>>,
}
#[component]
fn NavChara<'a, G: Html>(cx: Scope<'a>, props: NavCharaProps<'a>) -> View<G> {
	use sycamore::{builder::prelude::*, component::Prop};

	let NavCharaProps {
		firstname,
		lastname,
		data_sig,
	} = props;
	let firstname = create_ref(cx, firstname);
	let lastname = create_ref(cx, lastname.unwrap_or_default());
	let class = create_ref(cx, format!("chara {firstname}"));

	h(div)
		.attr("aria-labelledby", firstname)
		.class(class)
		.c(h(h3)
			.attr("id", firstname)
			.t(firstname)
			.t(" ")
			.c(h(span).class(super::CLASS_TEXTSC).t(lastname)))
		.c(h(div).dyn_c(move || {
			let props = KeyedProps::builder()
				.iterable(data_sig)
				.key(|spirit| spirit.form.clone())
				.view(|cx, spirit| NavItem(cx, spirit))
				.build();
			Keyed(cx, props)
		}))
		.view(cx)
}

#[component]
fn NavItem<G: Html>(cx: Scope, item: Rc<Spirit>) -> View<G> {
	use sycamore::builder::prelude::*;

	let href = create_ref(
		cx,
		format!(
			"#/spirits/{name}/{form}",
			name = item.firstname,
			form = item.form_url()
		),
	);
	let spirit_form = create_ref(cx, item.form.clone());
	let a11y = create_ref(cx, item.a11y());
	let icon = create_ref(cx, item.icon());

	h(a).attr("href", href)
		.attr("aria-label", a11y)
		.c(h(p).t(spirit_form))
		.dyn_if(
			|| icon.is_some(),
			move || {
				h(img)
					.attr("src", icon.as_ref().unwrap_throw())
					.attr("alt", format!("{a11y} face"))
			},
			|| h(div).class("icon-placeholder"),
		)
		.view(cx)
}
