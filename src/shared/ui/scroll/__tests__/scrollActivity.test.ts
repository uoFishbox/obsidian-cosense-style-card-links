import { afterEach, expect, it, vi } from "vitest";
import {
	isScrollActivityActive,
	isScrollerScrollActivityActive,
	markScrollActivityActive,
	markScrollActivityIdle,
	resetScrollActivityForTests,
	subscribeScrollActivity,
	subscribeScrollerScrollActivity,
} from "../scrollActivity";

afterEach(() => {
	resetScrollActivityForTests();
});

it("tracks each scroller while retaining global activity until all sources are idle", () => {
	const firstTarget = {} as Window;
	const secondTarget = {} as Window;
	const firstSource = {};
	const secondSource = {};
	const thirdSource = {};
	const onGlobalActivity = vi.fn();
	const onScrollerActivity = vi.fn();
	const unsubscribeGlobal = subscribeScrollActivity(onGlobalActivity);
	const unsubscribeScroller = subscribeScrollerScrollActivity(onScrollerActivity);

	markScrollActivityActive(firstSource, firstTarget);
	markScrollActivityActive(secondSource, firstTarget);
	markScrollActivityActive(thirdSource, secondTarget);
	expect(onGlobalActivity).toHaveBeenCalledTimes(1);
	expect(onScrollerActivity.mock.calls).toEqual([
		[firstTarget, true],
		[secondTarget, true],
	]);

	markScrollActivityIdle(firstSource);
	expect(isScrollerScrollActivityActive(firstTarget)).toBe(true);
	markScrollActivityIdle(secondSource);
	expect(isScrollerScrollActivityActive(firstTarget)).toBe(false);
	expect(isScrollActivityActive()).toBe(true);
	expect(onScrollerActivity).toHaveBeenLastCalledWith(firstTarget, false);

	markScrollActivityIdle(thirdSource);
	expect(isScrollActivityActive()).toBe(false);
	expect(onGlobalActivity.mock.calls).toEqual([[true], [false]]);
	unsubscribeScroller();
	unsubscribeGlobal();
});
