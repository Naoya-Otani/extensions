import { Action, ActionPanel, Color, Icon, Image, List } from "@raycast/api";
import { useCachedPromise, useCachedState } from "@raycast/utils";
import { format, formatDistanceToNow } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import * as emoji from "node-emoji";
import { SendMessage } from "./send-message";

import { withSlackClient } from "./shared/withSlackClient";
import { getSlackWebClient } from "./shared/client/WebClient";
import { convertTimestampToDate, handleError } from "./shared/utils";
import { useChannels, useMe, type User } from "./shared/client";
import { usePagedItems } from "./shared/usePaging";
import { SearchMessagesArguments } from "@slack/web-api";

const FROM_PAGE_SIZE = 100;

/**
 * The "From" submenu is attached to the list *and* to every result, so every action it renders is
 * built once per result. Listing every workspace member there is what pushed large workspaces over
 * the extension's memory limit — tens of thousands of members multiplied by the number of results.
 * The members are now narrowed by the submenu's own search field and rendered a page at a time.
 */
function FromActions({
  users,
  meIcon,
  query,
  onQueryChange,
}: {
  users: User[] | undefined;
  meIcon: Image.ImageLike | undefined;
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const [userSearchText, setUserSearchText] = useState("");

  const matches = useMemo(() => {
    if (!users) {
      return [];
    }

    const normalized = userSearchText.trim().toLowerCase();

    if (!normalized) {
      return users;
    }

    return users.filter((user) => user.name.toLowerCase().includes(normalized));
  }, [users, userSearchText]);

  const { visible, hiddenCount, showMore, reset } = usePagedItems(matches, FROM_PAGE_SIZE);

  const handleUserSearchTextChange = useCallback(
    (text: string) => {
      setUserSearchText(text);
      reset();
    },
    [reset],
  );

  return (
    <>
      <Action
        title="From Me Only"
        icon={meIcon}
        shortcut={{ modifiers: ["cmd", "shift"], key: "i" }}
        onAction={() => onQueryChange(query ? `from:me ${query}` : "from:me ")}
      />

      <ActionPanel.Submenu
        icon={Icon.Person}
        title="From"
        shortcut={{ modifiers: ["cmd", "shift"], key: "u" }}
        onSearchTextChange={handleUserSearchTextChange}
        filtering={false}
        throttle
      >
        {visible.map((user) => (
          <Action
            key={user.id}
            title={user.name}
            icon={user.icon}
            onAction={() => onQueryChange(query ? `from:<@${user.id}> ${query}` : `from:<@${user.id}> `)}
          />
        ))}

        {hiddenCount > 0 && (
          <Action icon={Icon.Ellipsis} title={`Show More (${hiddenCount} more)`} onAction={showMore} />
        )}
      </ActionPanel.Submenu>
    </>
  );
}

function Search() {
  const [query, setQuery] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("");

  const [sortType, setSortType] = useCachedState<SearchMessagesArguments["sort"]>("search-sort-type", "timestamp");

  const { data: me } = useMe();
  const { data: channels } = useChannels();
  const users = channels?.[0];

  const meInfo = users?.find((u) => u.id === me?.id);

  const { data, isLoading } = useCachedPromise(
    async (query, channel, sort) => {
      const webClient = getSlackWebClient();

      const results = await webClient.search.messages({
        query: `${query}${channel ? ` in:${channel}` : ""}`,
        sort,
      });

      return results.messages?.matches ?? [];
    },
    [query, selectedChannel, sortType],
    {
      onError(error) {
        handleError(error);
      },
      execute: query.length > 0,
      keepPreviousData: true,
    },
  );

  const sortOptions: { title: string; sort: SearchMessagesArguments["sort"] }[] = [
    { title: "Newest", sort: "timestamp" },
    { title: "Most Relevant", sort: "score" },
  ];

  return (
    <List
      isLoading={isLoading}
      searchText={query}
      onSearchTextChange={setQuery}
      actions={
        <ActionPanel>
          <FromActions
            users={users}
            meIcon={meInfo ? meInfo.icon : Icon.Person}
            query={query}
            onQueryChange={setQuery}
          />
        </ActionPanel>
      }
      throttle
      isShowingDetail={data && data.length > 0}
      searchBarAccessory={
        <List.Dropdown tooltip="Search Channels" onChange={setSelectedChannel}>
          <List.Dropdown.Item value="" title="All Channels" />
          {channels ? (
            <List.Dropdown.Section>
              {channels.flat().map((c) => {
                return (
                  <List.Dropdown.Item
                    key={c.id}
                    icon={c.icon}
                    value={"username" in c ? c.username : "groupName" in c ? c.groupName : c.name}
                    title={c.name}
                  />
                );
              })}
            </List.Dropdown.Section>
          ) : null}
        </List.Dropdown>
      }
    >
      {data === undefined ? (
        <List.EmptyView
          title="Search Slack messages"
          description="Type something in the search bar to start searching."
        />
      ) : null}
      {data?.map((m) => {
        if (!m.text || !m.ts) return null;
        const user = users?.find((u) => u.id === m.user);
        const date = convertTimestampToDate(m.ts);
        const text = emoji.emojify(m.text);
        const formattedDate = format(date, "EEEE dd MMMM yyyy 'at' HH:mm");
        return (
          <List.Item
            key={m.iid}
            icon={{ value: user?.icon, tooltip: user?.name ?? "Unknown user" }}
            title={text}
            accessories={[{ date, tooltip: formattedDate }]}
            detail={
              <List.Item.Detail
                markdown={text}
                metadata={
                  <List.Item.Detail.Metadata>
                    {m.type === "message" && m.channel ? (
                      <List.Item.Detail.Metadata.Label title="Channel Name" icon={Icon.Hashtag} text={m.channel.name} />
                    ) : null}

                    {user ? <List.Item.Detail.Metadata.Label title="From" icon={user.icon} text={user.name} /> : null}

                    <List.Item.Detail.Metadata.Label
                      title="Posted"
                      icon={Icon.Clock}
                      text={formatDistanceToNow(date)}
                    />
                  </List.Item.Detail.Metadata>
                }
              />
            }
            actions={
              <ActionPanel>
                {m.permalink ? <Action.OpenInBrowser url={m.permalink} title="Open Message" /> : null}

                {m.permalink ? (
                  <Action.CopyToClipboard
                    content={m.permalink}
                    title="Copy Message URL"
                    shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                  />
                ) : null}

                {user && (
                  <Action.Push
                    title={`Message ${user.name}`}
                    icon={Icon.Message}
                    target={<SendMessage recipient={user?.id} />}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "s" }}
                  />
                )}

                <ActionPanel.Section>
                  <ActionPanel.Submenu
                    title="Sort by"
                    icon={Icon.ArrowUp}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "s" }}
                  >
                    {sortOptions.map((s) => (
                      <Action
                        key={s.sort}
                        autoFocus={sortType === s.sort}
                        icon={sortType === s.sort ? { source: Icon.CheckCircle, tintColor: Color.Green } : undefined}
                        title={s.title}
                        onAction={() => setSortType(s.sort)}
                      />
                    ))}
                  </ActionPanel.Submenu>

                  <FromActions
                    users={users}
                    meIcon={meInfo ? meInfo.icon : Icon.Person}
                    query={query}
                    onQueryChange={setQuery}
                  />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}

export default withSlackClient(Search);
