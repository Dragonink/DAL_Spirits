#![forbid(unsafe_code)]
#![deny(unused_must_use)]

#[macro_use]
extern crate constcat;
use wasm_bindgen::{prelude::*, JsCast, UnwrapThrowExt};
use web_sys::Performance;
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

const PERF_MARK_START: &str = "::start";
const PERF_MARK_END: &str = "::end";
const PERF_MEASURE_FETCH: &str = "fetch";
const PERF_MARK_FETCH_START: &str = constcat!(PERF_MEASURE_FETCH, PERF_MARK_START);
const PERF_MARK_FETCH_END: &str = constcat!(PERF_MEASURE_FETCH, PERF_MARK_END);
const PERF_MEASURE_DESER: &str = "deser";
const PERF_MARK_DESER_START: &str = constcat!(PERF_MEASURE_DESER, PERF_MARK_START);
const PERF_MARK_DESER_END: &str = constcat!(PERF_MEASURE_DESER, PERF_MARK_END);

#[wasm_bindgen(start)]
pub fn start() {
	use components::App;
	use std::rc::Rc;
	use sycamore::{futures, prelude::*};
	use web_sys::{console, PerformanceMeasure};

	#[cfg(target_arch = "wasm32")]
	std::panic::set_hook(Box::new(console_error_panic_hook::hook));

	sycamore::render(|cx| {
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
					.dyn_ref::<PerformanceMeasure>()
					.map(|measure| measure.duration())
			};
			match fetch_data(env!("MAKE_DATA_PATH"), &perf).await {
				Ok(vec) => {
					data.set(vec.into_iter().map(Rc::new).collect());
					let measure_fetch = measure(
						PERF_MEASURE_FETCH,
						PERF_MARK_FETCH_START,
						PERF_MARK_FETCH_END,
					)
					.unwrap_throw();
					console::debug_1(
						&format!("Fetched character data in {measure_fetch}ms").into(),
					);
					let measure_deser = measure(
						PERF_MEASURE_DESER,
						PERF_MARK_DESER_START,
						PERF_MARK_DESER_END,
					)
					.unwrap_throw();
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
	});
}

async fn fetch_data(url: &str, perf: &Performance) -> Result<Vec<Spirit>, JsValue> {
	use serdenom_csv::de::{DeserializerBuilder, Separators};
	use wasm_bindgen_futures::JsFuture;
	use web_sys::{Request, RequestInit, Response};

	let set_perf_mark = |name: &str| {
		perf.mark(name).unwrap_throw();
	};

	let mut req = RequestInit::new();
	req.method("GET");
	let req = Request::new_with_str_and_init(url, &req).unwrap_throw();
	req.headers().set("Accept", "text/csv").unwrap_throw();
	set_perf_mark(PERF_MARK_FETCH_START);
	let res: Response = JsFuture::from(web_sys::window().unwrap_throw().fetch_with_request(&req))
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
