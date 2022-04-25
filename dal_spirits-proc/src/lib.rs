use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, spanned::Spanned, DataEnum, DeriveInput};

fn require_enum<F: FnOnce(&DeriveInput, &DataEnum) -> TokenStream>(
	impl_name: &str,
	ast: DeriveInput,
	callback: F,
) -> TokenStream {
	use syn::Data;

	if let Data::Enum(ref enum_data) = ast.data {
		callback(&ast, enum_data)
	} else {
		syn::Error::new(
			ast.span(),
			format!("{impl_name} can only be derived on enums"),
		)
		.into_compile_error()
		.into()
	}
}

/// Implement [`FromStr`](std::str::FromStr) for a type, provided it implements [`serde::Deserialize`]
#[allow(non_snake_case)]
#[proc_macro_derive(FromStr_with_Deserialize)]
pub fn impl_FromStr_with_Deserialize(input: TokenStream) -> TokenStream {
	let ast: DeriveInput = parse_macro_input!(input as DeriveInput);
	let ident = &ast.ident;
	quote! {
		#[automatically_derived]
		impl<'de> std::str::FromStr for #ident
		where
			Self: serde::Deserialize<'de>,
		{
			type Err = serde::de::value::Error;

			#[inline]
			fn from_str(s: &str) -> Result<Self, Self::Err> {
				use serde::de::IntoDeserializer;

				Self::deserialize(s.into_deserializer())
			}
		}
	}
	.into()
}

/// Implement [`TryFrom<&str>`](TryFrom) and [`TryFrom<String>`](TryFrom) for a type, provided it implements [`FromStr`](std::str::FromStr)
#[allow(non_snake_case)]
#[proc_macro_derive(TryFrom_with_FromStr)]
pub fn impl_TryFrom_with_FromStr(input: TokenStream) -> TokenStream {
	let ast: DeriveInput = parse_macro_input!(input as DeriveInput);
	let ident = &ast.ident;
	quote! {
		#[automatically_derived]
		impl TryFrom<&str> for #ident
		where
			Self: std::str::FromStr,
		{
			type Error = <Self as std::str::FromStr>::Err;

			#[inline]
			fn try_from(s: &str) -> Result<Self, Self::Error> {
				s.parse()
			}
		}
		#[automatically_derived]
		impl TryFrom<String> for #ident
		where
			Self: std::str::FromStr,
		{
			type Error = <Self as std::str::FromStr>::Err;

			#[inline]
			fn try_from(s: String) -> Result<Self, Self::Error> {
				s.parse()
			}
		}
	}
	.into()
}

/// Implement [`Display`](std::fmt::Display) for a type, provided it implements [`serde::Serialize`]
#[allow(non_snake_case)]
#[proc_macro_derive(Display_with_Serialize)]
pub fn impl_Display_with_Serialize(input: TokenStream) -> TokenStream {
	let ast: DeriveInput = parse_macro_input!(input as DeriveInput);
	require_enum("Display_with_Serialize", ast, |ast, _| {
		let ident = &ast.ident;
		quote! {
			#[automatically_derived]
			impl std::fmt::Display for #ident {
				fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
					use wasm_bindgen::UnwrapThrowExt;

					write!(f, "{}", serde_variant::to_variant_name(self).unwrap_throw())
				}
			}
		}
		.into()
	})
}

/// Implement `Self::variants` which allows to list the variants
#[allow(non_snake_case)]
#[proc_macro_derive(EnumVariantIter)]
pub fn impl_EnumVariantIter(input: TokenStream) -> TokenStream {
	let ast: DeriveInput = parse_macro_input!(input as DeriveInput);
	require_enum("EnumVariantIter", ast, |ast, enum_data| {
		let ident = &ast.ident;
		let variants = enum_data
			.variants
			.iter()
			.map(|var| &var.ident)
			.collect::<Vec<_>>();
		let len = variants.len();
		quote! {
			#[automatically_derived]
			impl #ident {
				/// Get an array containing all variants of the enum
				#[inline(always)]
				pub const fn variants() -> [Self; #len] {
					[#(Self::#variants),*]
				}
			}
		}
		.into()
	})
}

/// Implement `Self::variant_name` which allows to get a variant's name
#[allow(non_snake_case)]
#[proc_macro_derive(EnumVariantStr)]
pub fn impl_EnumVariantStr(input: TokenStream) -> TokenStream {
	use syn::Fields;

	let ast: DeriveInput = parse_macro_input!(input as DeriveInput);
	require_enum("EnumVariantStr", ast, |ast, enum_data| {
		let ident = &ast.ident;
		let matching = enum_data
			.variants
			.iter()
			.map(|var| {
				let ident = &var.ident;
				let matched = quote! { => stringify!(#ident), };
				match var.fields {
					Fields::Unit => quote! { Self::#ident #matched },
					Fields::Unnamed(_) => quote! { Self::#ident(..) #matched },
					Fields::Named(_) => quote! { Self::#ident {..} #matched },
				}
			})
			.collect::<Vec<_>>();
		quote! {
			#[automatically_derived]
			impl #ident {
				/// Get the name of the variant
				#[inline]
				pub fn variant_name(&self) -> &'static str {
					match self {
						#(#matching)*
					}
				}
			}
		}
		.into()
	})
}
