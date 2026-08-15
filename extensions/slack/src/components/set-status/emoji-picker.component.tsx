import { Action, ActionPanel, Icon, List, useNavigation } from "@raycast/api";
import { useCallback, useMemo, useState } from "react";
import { EMOJI_SEARCH_LIMIT, type EmojiEntry, useEmojiCatalog } from "../../shared/client";
import { usePaging } from "../../shared/usePaging";

interface EmojiPickerProps {
  onSelect: (emoji: EmojiEntry) => void;
}

function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const { pop } = useNavigation();

  const [searchText, setSearchText] = useState("");
  const { limit, showMore, reset } = usePaging(EMOJI_SEARCH_LIMIT);

  // This component is only mounted once pushed, so the workspace emoji fetch starts here rather
  // than when the Set Status command opens.
  const { isLoading, search } = useEmojiCatalog({ includeStandard: true });

  const { items, total } = useMemo(() => search(searchText, limit), [search, searchText, limit]);
  const hiddenCount = total - items.length;

  const handleSearchTextChange = useCallback(
    (text: string) => {
      setSearchText(text);
      reset();
    },
    [reset],
  );

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={handleSearchTextChange}
      searchBarPlaceholder={"Search emoji (e.g. :smile)"}
      throttle
    >
      {items.map((emoji) => (
        <List.Item
          key={emoji.name}
          title={emoji.name}
          icon={emoji.value}
          actions={
            <ActionPanel>
              <Action
                title={"Select Emoji"}
                onAction={async () => {
                  onSelect(emoji);
                  pop();
                }}
              />
            </ActionPanel>
          }
        />
      ))}

      {hiddenCount > 0 && (
        <List.Item
          icon={Icon.Ellipsis}
          title={"Show More"}
          subtitle={`${hiddenCount} more`}
          actions={
            <ActionPanel>
              <Action title={"Show More"} onAction={showMore} />
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}

EmojiPicker.displayName = "EmojiPicker";

export { EmojiPicker };
