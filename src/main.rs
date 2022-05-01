#![forbid(unsafe_code)]
#![deny(unused_must_use)]

#[macro_use]
extern crate constcat;
use wasm_bindgen::{prelude::*, JsCast, UnwrapThrowExt};
use wee_alloc::WeeAlloc;

#[cfg(target_arch = "wasm32")]
#[global_allocator]
static ALLOC: WeeAlloc = WeeAlloc::INIT;

#[allow(unused_macros)]
#[cfg(target_arch = "wasm32")]
macro_rules! console_debug {
	($($arg:tt)*) => {
		if cfg!(debug_assertions) {
			web_sys::console::debug_1(&format!(
				"[{file}:{line}] {msg}",
				file = file!(),
				line = line!(),
				msg = format!($($arg)*)
			).into());
		}
	};
}

mod components;
mod models;
mod router;
mod utils;

use models::Spirit;
use sycamore::{
	generic_node::DomNode,
	prelude::{Scope, View},
};

const PERF_MARK_START: &str = "::start";
const PERF_MARK_END: &str = "::end";
const PERF_MEASURE_FETCH: &str = "fetch";
const PERF_MARK_FETCH_START: &str = constcat!(PERF_MEASURE_FETCH, PERF_MARK_START);
const PERF_MARK_FETCH_END: &str = constcat!(PERF_MEASURE_FETCH, PERF_MARK_END);
const PERF_MEASURE_DESER: &str = "deser";
const PERF_MARK_DESER_START: &str = constcat!(PERF_MEASURE_DESER, PERF_MARK_START);
const PERF_MARK_DESER_END: &str = constcat!(PERF_MEASURE_DESER, PERF_MARK_END);

fn render(cx: Scope) -> View<DomNode> {
	use components::App;
	use std::rc::Rc;
	use sycamore::{futures, prelude::*};
	use web_sys::{console, PerformanceMeasure};

	let data = create_signal(cx, Vec::with_capacity(0));

	futures::spawn_local_scoped(cx, async {
		let perf = web_sys::window()
			.and_then(|window| window.performance())
			.unwrap_throw();
		let measure = |measure_name: &str, start_mark: &str, end_mark: &str| {
			perf.measure_with_start_mark_and_end_mark(measure_name, start_mark, end_mark)
				.unwrap_throw();
			perf.get_entries_by_name_with_entry_type(measure_name, "measure")
				.get(0)
				.unchecked_ref::<PerformanceMeasure>()
				.duration()
		};

		match fetch_data(env!("MAKE_DATA_PATH")).await {
			Ok(vec) => {
				data.set(
					vec.into_iter()
						.inspect(cache_resources)
						.map(Rc::new)
						.collect(),
				);
				let measure_fetch = measure(
					PERF_MEASURE_FETCH,
					PERF_MARK_FETCH_START,
					PERF_MARK_FETCH_END,
				);
				console::debug_1(&format!("Fetched character data in {measure_fetch}ms").into());
				let measure_deser = measure(
					PERF_MEASURE_DESER,
					PERF_MARK_DESER_START,
					PERF_MARK_DESER_END,
				);
				console::debug_1(
					&format!("Deserialized character data in {measure_deser}ms").into(),
				);
				console::info_1(
					&format!("Loaded data of {len} characters", len = data.get().len()).into(),
				);
			}
			Err(err) => console::error_1(&err),
		}
	});

	App(cx, data)
}

#[wasm_bindgen(start)]
pub fn start() {
	use sycamore::futures;
	use wasm_bindgen_futures::JsFuture;
	use web_sys::{console, ServiceWorkerRegistration};

	#[cfg(target_arch = "wasm32")]
	std::panic::set_hook(Box::new(console_error_panic_hook::hook));

	futures::spawn_local(async {
		let sw_container = web_sys::window()
			.unwrap_throw()
			.navigator()
			.service_worker();

		match JsFuture::from(sw_container.register("./cache.worker.js")).await {
			Ok(registration) => {
				let _ = JsFuture::from(
					registration
						.unchecked_into::<ServiceWorkerRegistration>()
						.update()
						.unwrap_throw(),
				)
				.await;
				let _ = JsFuture::from(sw_container.ready().unwrap_throw()).await;
			}
			Err(err) => {
				console::warn_1(&err);
			}
		}

		sycamore::render(render);
	});
}

async fn fetch_data(url: &str) -> Result<Vec<Spirit>, JsValue> {
	use serdenom_csv::de::{DeserializerBuilder, Separators};
	use wasm_bindgen_futures::JsFuture;
	use web_sys::{Request, RequestInit, Response};

	let window = web_sys::window().unwrap_throw();
	let perf = window.performance().unwrap_throw();
	let set_perf_mark = |name: &str| {
		perf.mark(name).unwrap_throw();
	};

	let mut req = RequestInit::new();
	req.method("GET");
	let req = Request::new_with_str_and_init(url, &req).unwrap_throw();
	req.headers().set("Accept", "text/csv").unwrap_throw();
	set_perf_mark(PERF_MARK_FETCH_START);
	let res: Response = JsFuture::from(window.fetch_with_request(&req))
		.await?
		.unchecked_into();
	set_perf_mark(PERF_MARK_FETCH_END);
	let csv = JsFuture::from(res.text().unwrap_throw())
		.await?
		.as_string()
		.unwrap_throw();

	let deserializer =
		DeserializerBuilder::default().separators([Separators::default(), Separators(';', ':')]);
	set_perf_mark(PERF_MARK_DESER_START);
	let res = deserializer
		.deserialize(&csv)
		.map_err(|err| JsValue::from_str(&err.to_string()));
	set_perf_mark(PERF_MARK_DESER_END);
	res
}

fn cache_resources(spirit: &Spirit) {
	use js_sys::Array;
	use sycamore::futures;
	use wasm_bindgen_futures::JsFuture;
	use web_sys::ServiceWorkerRegistration;

	let sw_container = web_sys::window()
		.unwrap_throw()
		.navigator()
		.service_worker();

	let res = Array::new();
	macro_rules! push_res {
		($opt:expr) => {
			if let Some(href) = $opt {
				res.push(&href.into());
			}
		};
	}
	push_res!(spirit.icon());
	push_res!(spirit.image());
	spirit.sephiras.iter().for_each(|sephira| {
		push_res!(sephira.icon());
		push_res!(sephira.guardian());
	});
	macro_rules! push_class {
		($prop:ident) => {
			push_res!(spirit.$prop.map(|class| class.icon().0));
		};
	}
	push_class!(class);
	push_class!(spacequake_class);
	push_class!(angel_class);
	push_class!(astraldress_class);
	push_class!(rank);
	spirit.elements.iter().for_each(|element| {
		push_res!(element.icon());
	});

	futures::spawn_local(async move {
		let registration: ServiceWorkerRegistration =
			JsFuture::from(sw_container.get_registration())
				.await
				.unwrap_throw()
				.unchecked_into();
		let sw = registration.active().unwrap_throw();
		sw.post_message(&res).unwrap_throw();
	});
}
