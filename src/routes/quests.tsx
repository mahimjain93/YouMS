import { createFileRoute } from "@tanstack/react-router";
import { QuestList } from "@/components/QuestList";

export const Route = createFileRoute("/quests")({
  component: QuestList,
});
