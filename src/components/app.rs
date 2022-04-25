use crate::models::Spirit;
use std::rc::Rc;
use sycamore::prelude::*;
use wasm_bindgen::UnwrapThrowExt;

#[component]
pub(crate) fn App<'a, G: Html>(
	cx: Scope<'a>,
	data_sig: &'a ReadSignal<Vec<Rc<Spirit>>>,
) -> View<G> {
	use super::home::HomeProps;
	use crate::router::{self, HashRouter, Route};
	use sycamore::builder::prelude::*;

	let spoilers_sig = create_signal(cx, false);

	HashRouter(cx, move |cx, route: &ReadSignal<Route>| {
		let node_ref = create_node_ref(cx);
		h(div)
			.bind_ref(node_ref.clone())
			.dyn_attr("id", || {
				let route = route.get();
				Some(route.variant_name())
			})
			.dyn_c(move || {
				let node: DomNode = node_ref.try_get().unwrap_throw();
				node.remove_attribute("class");
				let route = route.get();
				if let Route::SpiritDetails {
					name,
					form: spirit_form,
				} = route.as_ref()
				{
					let data_vec = data_sig.get();
					if data_vec.len() > 0 {
						let spirit = data_vec
							.iter()
							.find(|spirit| {
								spirit.firstname.eq(name) && spirit.form_url().eq(spirit_form)
							})
							.cloned();
						if let Some(spirit) = spirit {
							node.set_class_name(&spirit.firstname);
							return super::SpiritDetails(cx, spirit);
						}
					} else {
						return View::empty(); //TODO Loading component (in Home as well?)
					}
				}
				router::navigate_replace("/");
				super::Home(
					cx,
					HomeProps {
						data_sig,
						spoilers_sig,
					},
				)
			})
			.view(cx)
	})
}
