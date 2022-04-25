use dal_spirits_proc::EnumVariantStr;
use std::{cell::RefCell, fmt::Debug};
use sycamore::prelude::*;
use sycamore_router::Route as IRoute;
use wasm_bindgen::{JsCast, UnwrapThrowExt};

#[derive(Debug, Clone, PartialEq, Eq, IRoute, EnumVariantStr)]
pub(crate) enum Route {
	#[to("/")]
	#[not_found]
	Home,
	#[to("/spirits/<name>/<form>")]
	SpiritDetails { name: String, form: String },
}
impl Default for Route {
	#[inline(always)]
	fn default() -> Self {
		Self::Home
	}
}

thread_local! {
	static HASH_PATH: RefCell<Option<RcSignal<String>>> = RefCell::new(None);
}

#[component]
pub(crate) fn HashRouter<'a, G: Html, R, F>(cx: Scope<'a>, view: F) -> View<G>
where
	R: IRoute + PartialEq + 'a,
	F: FnOnce(Scope<'a>, &'a ReadSignal<R>) -> View<G> + 'a,
{
	use wasm_bindgen::closure::Closure;

	let window = web_sys::window().unwrap_throw();
	let location = window.location();
	let get_hash_path = move || {
		location
			.hash()
			.unwrap_throw()
			.strip_prefix('#')
			.unwrap_or("/")
			.to_string()
	};

	HASH_PATH.with(|hash_path| {
		assert!(
			hash_path.borrow().is_none(),
			"cannot have more than one HashRouter component"
		);
		*hash_path.borrow_mut() = Some(create_rc_signal(get_hash_path()));
	});
	on_cleanup(cx, || {
		HASH_PATH.with(|hash_path| {
			*hash_path.borrow_mut() = None;
		});
	});

	let path_sig = HASH_PATH.with(|hash_path| hash_path.borrow().clone().unwrap_throw());
	let closure = Closure::wrap({
		let path_sig = path_sig.clone();
		Box::new(move || {
			path_sig.set(get_hash_path());
		})
	} as Box<dyn FnMut()>);
	window
		.add_event_listener_with_callback("popstate", closure.as_ref().unchecked_ref())
		.unwrap_throw();
	window
		.add_event_listener_with_callback("hashchange", closure.as_ref().unchecked_ref())
		.unwrap_throw();
	closure.forget();
	let route_sig = create_selector(cx, move || R::match_path(&path_sig.get()));
	view(cx, route_sig)
}

pub(crate) fn navigate_replace(hash: &str) {
	use wasm_bindgen::JsValue;

	HASH_PATH.with(|hash_path| {
		assert!(
			hash_path.borrow().is_some(),
			"navigate_replace can only be used with a HashRouter"
		);
		let path_sig = hash_path.borrow().clone().unwrap_throw();
		if hash != path_sig.get_untracked().as_ref() {
			path_sig.set(hash.to_string());
		}
		web_sys::window()
			.unwrap_throw()
			.history()
			.and_then(|history| {
				history.replace_state_with_url(&JsValue::NULL, "", Some(&("#".to_owned() + hash)))
			})
			.unwrap_throw();
	});
}
