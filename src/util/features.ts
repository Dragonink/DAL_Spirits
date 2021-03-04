export const localStorage: boolean = (() => {
	try {
		const TEST_ITEM = "__test__";
		window.localStorage.setItem(TEST_ITEM, TEST_ITEM);
		window.localStorage.removeItem(TEST_ITEM);
		return true;
	} catch (error) {
		return false;
	}
})();

export const indexedDB: boolean = window.indexedDB ? true : false;
