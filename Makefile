override MAKEFLAGS += -rR --no-print-directory
rwildcard = $(strip $(foreach d,$(wildcard $(patsubst %/,%,$1)/*),$(filter $(subst *,%,$2),$(d)) $(call rwildcard,$(d)/,$2)))

OUTPUT_PREFIX ?= index

sed ?= sed
awk ?= awk
tr ?= tr
cargo ?= cargo
wasm_bindgen ?= wasm-bindgen
esbuild ?= esbuild


.EXTRA_PREREQS := Makefile

#SECTION Directories
out :
	mkdir -p $@
#!SECTION

#SECTION Rust
RUST_PACKAGE := $(shell $(awk) -F= '$$1=="CARGO_PKG_NAME"{print $$2}' rust.env)
RUST_TARGET := $(shell $(awk) -F= '$$1=="TARGET"{print $$2}' rust.env)

OUT_RUST_wasm := target/$(RUST_TARGET)/$(if $(RELEASE),release,debug)/$(RUST_PACKAGE).wasm
$(OUT_RUST_wasm) : $(call rwildcard,src/,*.rs)
	MAKE_DATA_PATH="$(patsubst out/%,./%,$(OUT_DATA))" \
	$(cargo) build $(if $(RELEASE),--release)
$(OUT_RUST_wasm) : .EXTRA_PREREQS := $(.EXTRA_PREREQS) Cargo.*
#!SECTION

#SECTION WASM-bindgen
OUT_WASMBG_wasm := out/$(OUTPUT_PREFIX)_bg.wasm
OUT_WASMBG_js := out/$(OUTPUT_PREFIX).js
OUT_WASMBG_js_snippets := $(call rwildcard,out/snippets/,*)
.INTERMEDIATE : $(OUT_WASMBG_js_snippets)
$(OUT_WASMBG_wasm) $(OUT_WASMBG_js) $(OUT_WASMBG_js_snippets) &: $(OUT_RUST_wasm) | out
	$(wasm_bindgen) \
		--target web \
		--reference-types \
		--weak-refs \
		$(if $(RELEASE),--remove-name-section,--debug --keep-debug) \
		--omit-default-module-path \
		--no-typescript \
		--out-dir $| \
		--out-name "$(OUTPUT_PREFIX)" \
		$<
ifdef RELEASE
	$(esbuild) \
		--log-level=warning \
		--target=es2021 \
		--format=esm \
		--minify \
		--outfile="$|/$(OUTPUT_PREFIX).js" \
		--allow-overwrite \
		"$|/$(OUTPUT_PREFIX).js"
endif
#!SECTION

#SECTION CSS
IN_CSS := assets/styles/$(OUTPUT_PREFIX).css
OUT_CSS := out/$(OUTPUT_PREFIX).css
$(OUT_CSS) : $(wildcard assets/styles/*.css) | out
ifdef RELEASE
	rm -f "$@"
	$(esbuild) --log-level=warning --bundle --minify --outfile="$@" "$(IN_CSS)"
else
	ln -srf "$(IN_CSS)" "$@"
endif
#!SECTION

#SECTION HTML
OUT_HTML := out/$(OUTPUT_PREFIX).html
$(OUT_HTML) : assets/$(OUTPUT_PREFIX).html | out
	$(sed) \
		$(if $(RELEASE),-e 's/^[ \t]*//g') \
		$(if $(RELEASE),-e 's/[ ]*\/>/\/>/g') \
		-e 's/{{CSS}}/$(patsubst $|/%,.\/%,$(OUT_CSS))/g' \
		-e 's/{{JS}}/$(patsubst $|/%,.\/%,$(OUT_WASMBG_js))/g' \
		-e 's/{{WASM}}/$(patsubst $|/%,.\/%,$(OUT_WASMBG_wasm))/g' \
		"$<" \
	| $(tr) -d '\r\n' > "$@"
#!SECTION

#SECTION Data
OUT_DATA := out/spirits.csv
$(OUT_DATA) : assets/spirits.csv | out
ifdef RELEASE
	cp --remove-destination -T "$<" "$@"
else
	ln -srf "$<" "$@"
endif
#!SECTION

.PHONY : all
all : $(OUT_WASMBG_wasm) $(OUT_WASMBG_js) $(OUT_CSS) $(OUT_HTML) $(OUT_DATA)
.DEFAULT_GOAL := all

.PHONY : clean
clean :
	rm -rf out
