import { io, str, math, list, vec, hashmap, hashset, deque, btreemap, btreeset, priority_queue, channel, async_channel, thread, sync, render, reactive, functor, applicative, monad, foldable, traversable, iter, map_vec, filter_vec, filter_option, zip_vec, enumerate_vec, flatten_vec, flat_map_vec, chunk_vec, window_vec, partition_vec, take_vec, skip_vec, any_vec, all_vec, find_vec, count_vec, sum_vec, sum_vec_f64, unique_vec, reverse_vec, sort_vec, sort_by_vec, sort_by_desc_vec, group_by_vec, intersperse_vec, join_vec, query, where_q, select_q, order_by_q, order_by_desc_q, limit_q, offset_q, group_by_q, count_q, first_q, to_vec_q, join_q, createSignal, get, set, createMemo, createEffect, vnode, text, mount_reactive, createDomRenderer, props_empty, props_class, props_on_click, props_on_click_delta, props_on_click_inc, props_on_click_dec, props_merge, props_id, props_style, props_value, props_placeholder, props_href, props_disabled, props_on_input, props_on_change, props_key, dom_get_element_by_id, fs, opfs, url, router, web_storage, dom, web_worker, web_streams, path, env, process, json, http, time, join_all, timeout, sab_channel, webgpu, regex, crypto, Result, Option, __set, formatValue, __lumina_stringify, __lumina_range, __lumina_slice, __lumina_index, __lumina_fixed_array, __lumina_array_bounds_check, __lumina_array_literal, __lumina_clone, __lumina_debug, __lumina_eq, __lumina_struct, __lumina_register_trait_impl, LuminaPanic } from "./lumina-runtime.js";
function __lumina_bundle_0_root(value, renderChildren) {
  return render.tabsRoot(value, renderChildren);
}
function __lumina_bundle_0_list(props, renderChildren) {
  return render.tabsList(props, renderChildren);
}
function __lumina_bundle_0_trigger(value, props, children) {
  return render.tabsTrigger(value, props, children);
}
function __lumina_bundle_0_panel(value, props, children) {
  return render.tabsPanel(value, props, children);
}
function panelCard(title, copy) {
  return vnode("article", props_class("panel-card"), vec.from([vnode("h2", props_class("panel-title"), vec.from([text(title)])), vnode("p", props_class("panel-copy"), vec.from([text(copy)]))]));
}
function tabsView(active) {
  return __lumina_bundle_0_root(active, function() {
  return vnode("div", props_class("workspace-shell"), vec.from([vnode("header", props_class("workspace-header"), vec.from([vnode("p", props_class("workspace-eyebrow"), vec.from([text("Headless tabs")])), vnode("h1", props_class("workspace-title"), vec.from([text("Lumina product workspace")])), vnode("p", props_class("workspace-copy"), vec.from([text("This example uses @std/tabs with reactive state, ARIA wiring, and portable render helpers.")])), vnode("p", props_class("workspace-active"), vec.from([text("Active tab: "), text(get(active))]))])), __lumina_bundle_0_list(props_class("workspace-tabs"), function() {
  return vec.from([__lumina_bundle_0_trigger("overview", props_class("workspace-tab"), vec.from([text("Overview")])), __lumina_bundle_0_trigger("activity", props_class("workspace-tab"), vec.from([text("Activity")])), __lumina_bundle_0_trigger("settings", props_class("workspace-tab"), vec.from([text("Settings")]))]);
}), __lumina_bundle_0_panel("overview", props_class("workspace-panel"), vec.from([panelCard("Overview", "Stable component frames and keyed identity make tab switches feel predictable instead of rebuilding local UI state.")])), __lumina_bundle_0_panel("activity", props_class("workspace-panel"), vec.from([panelCard("Activity", "Keyboard navigation works with Arrow keys, Home, and End while the selected tab stays in sync with the signal.")])), __lumina_bundle_0_panel("settings", props_class("workspace-panel"), vec.from([panelCard("Settings", "Because tabs are headless, styling stays local to the app while the runtime keeps the accessibility attributes coherent.")]))]));
});
}
function main() {
  const container = dom_get_element_by_id("app");
  const renderer = createDomRenderer();
  const active = createSignal("overview");
  const _mounted = mount_reactive(renderer, container, function() {
  return tabsView(active);
});
}
main();
export { io, str, math, list, vec, hashmap, hashset, deque, btreemap, btreeset, priority_queue, channel, async_channel, thread, sync, render, reactive, functor, applicative, monad, foldable, traversable, iter, map_vec, filter_vec, filter_option, zip_vec, enumerate_vec, flatten_vec, flat_map_vec, chunk_vec, window_vec, partition_vec, take_vec, skip_vec, any_vec, all_vec, find_vec, count_vec, sum_vec, sum_vec_f64, unique_vec, reverse_vec, sort_vec, sort_by_vec, sort_by_desc_vec, group_by_vec, intersperse_vec, join_vec, query, where_q, select_q, order_by_q, order_by_desc_q, limit_q, offset_q, group_by_q, count_q, first_q, to_vec_q, join_q, createSignal, get, set, createMemo, createEffect, vnode, text, mount_reactive, createDomRenderer, props_empty, props_class, props_on_click, props_on_click_delta, props_on_click_inc, props_on_click_dec, props_merge, props_id, props_style, props_value, props_placeholder, props_href, props_disabled, props_on_input, props_on_change, props_key, dom_get_element_by_id, fs, opfs, url, web_storage, dom, web_worker, web_streams, path, env, process, json, http, time, join_all, timeout, sab_channel, webgpu, regex, crypto, Result, Option, __set, formatValue, __lumina_stringify, __lumina_range, __lumina_slice, __lumina_index, __lumina_fixed_array, __lumina_array_bounds_check, __lumina_array_literal, __lumina_clone, __lumina_debug, __lumina_eq, __lumina_struct, __lumina_register_trait_impl, LuminaPanic };
