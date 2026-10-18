import { afterEach, describe, expect, it } from "vitest";
import { useInspectorStore } from "./inspector-store.ts";

const initialState = useInspectorStore.getState();

describe("inspector store", () => {
  afterEach(() => {
    useInspectorStore.setState(initialState, true);
  });

  it("does not follow the selection at first", () => {
    expect(useInspectorStore.getState().isFollowing).toBe(false);
  });

  it("remembers whether the camera follows the selection", () => {
    useInspectorStore.getState().setFollowing(true);

    expect(useInspectorStore.getState().isFollowing).toBe(true);

    useInspectorStore.getState().setFollowing(false);

    expect(useInspectorStore.getState().isFollowing).toBe(false);
  });
});
