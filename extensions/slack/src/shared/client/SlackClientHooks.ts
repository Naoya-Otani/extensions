import { handleError } from "../utils";
import { SlackClient } from "./SlackClient";
import { useCachedPromise } from "@raycast/utils";
import { useCallback } from "react";
import { SLACK_EMOJI_CODE_MAP } from "../../constants/emoji.constants";

export const useChannels = () =>
  useCachedPromise(
    () => Promise.all([SlackClient.getUsers(), SlackClient.getChannels(), SlackClient.getGroups()]),
    [],
    {
      onError(error) {
        handleError(error, "Failed to load channels");
      },
    },
  );

export const useMe = () => useCachedPromise(SlackClient.getMe);

export const useUnreadConversations = (conversationIds: string[] | undefined) =>
  useCachedPromise((ids) => SlackClient.getUnreadConversations(ids), [conversationIds ?? []]);

// SLACK_EMOJI_CODE_MAP is declared with literal keys; widen it to a lookup table so that an
// arbitrary `:name:` coming from Slack can index it.
const STANDARD_EMOJIS: Record<string, string> = SLACK_EMOJI_CODE_MAP;

export type EmojiEntry = { name: string; value: string };

/** Default cap on how many entries `search` hands back in one call. */
export const EMOJI_SEARCH_LIMIT = 1000;

/**
 * Access to the emoji catalog without exposing the catalog itself.
 *
 * `emoji.list` has no server-side paging, so the workspace's emojis are resolved in one call and
 * stay resident. What this hook avoids is everything *downstream* of that: no caller receives the
 * map, so no caller can copy it or render it whole. Workspaces with tens of thousands of custom
 * emojis otherwise exhaust the extension's JS heap.
 *
 * `execute: false` keeps the fetch from happening at all, which is what lets a command that only
 * needs a single name resolved stay off the expensive path.
 */
export function useEmojiCatalog(options?: { execute?: boolean; includeStandard?: boolean }) {
  const includeStandard = options?.includeStandard ?? false;

  const { data, isLoading } = useCachedPromise(SlackClient.getWorkspaceEmojis, [], {
    execute: options?.execute ?? true,
    onError(error) {
      handleError(error, "Failed to load emojis");
    },
  });

  // Resolve a single `:name:` without materializing a merged copy. Standard emojis take precedence,
  // matching the `{ ...workspaceEmojis, ...SLACK_EMOJI_CODE_MAP }` spread this replaces — the later
  // spread used to win, so flipping this order would silently change which glyph a name resolves to.
  const lookup = useCallback(
    (name: string) => (includeStandard ? STANDARD_EMOJIS[name] : undefined) ?? data?.[name],
    [data, includeStandard],
  );

  /**
   * Scans the whole catalog but returns at most `limit` entries, so the bound is enforced by the
   * signature rather than left to each caller to remember. `total` is the full match count, which
   * is what a "Show More" affordance needs to report how much is still hidden.
   */
  const search = useCallback(
    (query: string, limit: number = EMOJI_SEARCH_LIMIT): { items: EmojiEntry[]; total: number } => {
      const normalized = query.replace(/^:+/, "").trim().toLowerCase();
      const items: EmojiEntry[] = [];
      let total = 0;

      const consider = (name: string, value: string) => {
        if (normalized && !name.toLowerCase().includes(normalized)) {
          return;
        }

        total += 1;

        if (items.length < limit) {
          items.push({ name, value });
        }
      };

      if (includeStandard) {
        for (const name of Object.keys(STANDARD_EMOJIS)) {
          consider(name, STANDARD_EMOJIS[name]);
        }
      }

      if (data) {
        for (const name of Object.keys(data)) {
          // Standard emojis were already emitted above and take precedence over a workspace override.
          if (includeStandard && name in STANDARD_EMOJIS) {
            continue;
          }

          consider(name, data[name]);
        }
      }

      return { items, total };
    },
    [data, includeStandard],
  );

  return { isLoading, lookup, search };
}
