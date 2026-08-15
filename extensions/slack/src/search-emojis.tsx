import { useCallback, useMemo, useState } from "react";
import { Action, ActionPanel, Grid, Icon, AI, environment } from "@raycast/api";
import { useAI, useCachedPromise } from "@raycast/utils";
import { withSlackClient } from "./shared/withSlackClient";
import { SlackClient } from "./shared/client";
import { usePagedItems } from "./shared/usePaging";

const DISPLAY_LIMIT = 1000;

function EmojiItem({ name, url }: { name: string; url: string }) {
  return (
    <Grid.Item
      content={url}
      title={name}
      actions={
        <ActionPanel>
          <Action.Paste content={name} />
          <Action.CopyToClipboard content={name} />
        </ActionPanel>
      }
    />
  );
}

function Command() {
  const [searchText, setSearchText] = useState("");

  const { data, isLoading } = useCachedPromise(SlackClient.getWorkspaceEmojis);

  const emojis = useMemo(() => Object.entries(data ?? {}), [data]);

  const filteredEmojis = useMemo(() => {
    if (!searchText) return emojis;
    return emojis.filter(([name]) => name.toLowerCase().includes(searchText.toLowerCase()));
  }, [searchText, emojis]);

  const executeAISearch = environment.canAccess(AI) && searchText.length > 0 && filteredEmojis.length === 0;

  // Only the AI fallback needs every name. Joining tens of thousands of them produces a string
  // measured in hundreds of kilobytes, so it is built solely on the path that sends it.
  const allEmojiNames = useMemo(
    () => (executeAISearch ? emojis.map(([name]) => name).join(", ") : ""),
    [emojis, executeAISearch],
  );
  const prompt = executeAISearch
    ? `Here is a list of all available emoji names: ${allEmojiNames}\nReturn the emoji names in the list, separated by commas and with no additional text, that best match the semantic meaning of the following description: ${searchText}\nYou should return at least one emoji name.`
    : "";
  const { data: modelResponse, isLoading: isAILoading } = useAI(prompt, {
    model: AI.Model["OpenAI_GPT4o-mini"],
    execute: executeAISearch,
  });

  const aiEmojiEntries = useMemo(() => {
    return modelResponse
      .split(",")
      .map((name) => name.trim())
      .filter((name) => !!data?.[name])
      .map((name) => [name, data?.[name]]) as Array<[string, string]>;
  }, [modelResponse, data]);

  const emojiEntries = useMemo(() => {
    if (!searchText) return emojis;
    if (executeAISearch) return aiEmojiEntries;
    return filteredEmojis;
  }, [searchText, emojis, filteredEmojis, aiEmojiEntries, executeAISearch]);

  const { visible: visibleEmojis, hiddenCount, showMore, reset } = usePagedItems(emojiEntries, DISPLAY_LIMIT);

  const handleSearchTextChange = useCallback(
    (text: string) => {
      setSearchText(text);
      reset();
    },
    [reset],
  );

  return (
    <Grid
      isLoading={isLoading || isAILoading}
      columns={8}
      inset={Grid.Inset.Medium}
      onSearchTextChange={handleSearchTextChange}
      throttle
    >
      {visibleEmojis.map(([name, url]) => (
        <EmojiItem key={name} name={name} url={url} />
      ))}

      {hiddenCount > 0 && (
        <Grid.Item
          content={Icon.Ellipsis}
          title="Show More"
          subtitle={`${hiddenCount} more`}
          actions={
            <ActionPanel>
              <Action title="Show More" onAction={showMore} />
            </ActionPanel>
          }
        />
      )}

      <Grid.EmptyView title={isAILoading ? "Searching Slack emojis with AI…" : "No emojis found"} />
    </Grid>
  );
}

export default withSlackClient(Command);
