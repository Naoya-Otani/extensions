import { FormValidation, useForm } from "@raycast/utils";
import { Action, ActionPanel, Form, useNavigation } from "@raycast/api";
import { useMemo, useState } from "react";
import { getExpirationTimestamp } from "../../utils/set-status/expiration.util";
import { EMOJI_SEARCH_LIMIT, useEmojiCatalog } from "../../shared/client";

type SlackStatusForm = {
  statusText: string;
  emoji: string;
  duration: string;
  customUntil: Date | null;
  expiration: number;
};

interface StatusFormProps {
  formInitialValues: SlackStatusForm;
  onSubmit: (form: SlackStatusForm) => void;
}

const DURATION_OPTIONS = [
  { value: "0", title: "Don't clear" },
  { value: "30", title: "30 Minutes" },
  { value: "60", title: "1 Hour" },
  { value: "240", title: "4 Hours" },
  { value: "today", title: "Until Today" },
  { value: "week", title: "Until this week" },
  { value: "custom", title: "Choose" },
];

function StatusForm({ formInitialValues, onSubmit }: StatusFormProps) {
  const { pop } = useNavigation();
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(formInitialValues.duration === "custom");
  const [emojiSearchText, setEmojiSearchText] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState(formInitialValues.emoji);

  // Pushed from the Set Status list, so the workspace emoji fetch starts when this form mounts.
  const { isLoading: isLoadingEmojis, lookup, search } = useEmojiCatalog({ includeStandard: true });

  const { handleSubmit, itemProps, setValidationError } = useForm<SlackStatusForm>({
    initialValues: formInitialValues,
    validation: {
      statusText: FormValidation.Required,
    },
    onSubmit: (form: SlackStatusForm) => {
      let finalTimestamp = 0;

      if (form.duration === "custom") {
        if (!form.customUntil) {
          setValidationError("customUntil", "Please select a date.");
          return;
        }
        finalTimestamp = Math.floor(form.customUntil.getTime() / 1000);
      } else {
        finalTimestamp = getExpirationTimestamp(form.duration);
      }

      const finalSubmitData: SlackStatusForm = {
        ...form,
        expiration: finalTimestamp,
      };

      onSubmit(finalSubmitData);
      pop();
    },
  });

  const { onChange: formOnChange, ...restDurationProps } = itemProps.duration;
  const { onChange: emojiFormOnChange, ...restEmojiProps } = itemProps.emoji;

  const emojiOptions = useMemo(() => {
    const { items } = search(emojiSearchText, EMOJI_SEARCH_LIMIT);

    // A Dropdown drops its value when the matching item disappears, so the current selection is
    // kept in the list even while a search excludes it.
    if (!selectedEmoji || items.some((item) => item.name === selectedEmoji)) {
      return items;
    }

    return [{ name: selectedEmoji, value: lookup(selectedEmoji) ?? "" }, ...items];
  }, [search, emojiSearchText, selectedEmoji, lookup]);

  return (
    <Form
      navigationTitle={"Set Status"}
      isLoading={isLoadingEmojis}
      actions={
        <ActionPanel>
          <Action.SubmitForm title={"Save Status"} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        {...restEmojiProps}
        title={"Emoji"}
        filtering={false}
        onSearchTextChange={setEmojiSearchText}
        onChange={(value) => {
          setSelectedEmoji(value);

          if (emojiFormOnChange) {
            emojiFormOnChange(value);
          }
        }}
      >
        {emojiOptions.map((emoji) => (
          <Form.Dropdown.Item key={emoji.name} icon={emoji.value || undefined} title={emoji.name} value={emoji.name} />
        ))}
      </Form.Dropdown>

      <Form.TextField {...itemProps.statusText} title={"Status Text"} placeholder={"What are you working on?"} />

      <Form.Dropdown
        {...restDurationProps}
        title={"Duration"}
        onChange={(value) => {
          setShowCustomDatePicker(value === "custom");

          if (formOnChange) {
            formOnChange(value);
          }
        }}
      >
        {DURATION_OPTIONS.map((duration) => (
          <Form.Dropdown.Item key={duration.value} title={duration.title} value={duration.value} />
        ))}
      </Form.Dropdown>

      {showCustomDatePicker && (
        <Form.DatePicker {...itemProps.customUntil} title={"Until"} type={Form.DatePicker.Type.DateTime} />
      )}
    </Form>
  );
}

StatusForm.displayName = "StatusForm";

export { type SlackStatusForm, StatusForm };
