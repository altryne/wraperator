import { Form, ActionPanel, Action, showToast, Toast, open } from "@raycast/api";
import React, { useState } from "react";

interface TaskFormValues {
  task: string;
}

export default function Command() {
  const [taskError, setTaskError] = useState<string | undefined>();

  function handleSubmit(values: TaskFormValues) {
    if (!values.task) {
      setTaskError("Please enter a task");
      return;
    }

    const encodedTask = encodeURIComponent(values.task);
    const url = `wraperator://schedule?task=${encodedTask}`;

    showToast({
      style: Toast.Style.Success,
      title: "Scheduling task",
      message: "Opening Wraperator..."
    });

    // Open the URL which will be handled by the Electron app
    open(url);
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Schedule Task" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text="Enter your task for Operator! " />
      <Form.Separator />
      {/* <Form.TextField id="textfield" title="Text field" placeholder="Enter text" defaultValue="Raycast" /> */}
      <Form.TextArea
        id="task"
        title="Task"
        placeholder="Enter your task description"
        error={taskError}
        onChange={() => setTaskError(undefined)}
        enableMarkdown
      />
    </Form>
  );
} 