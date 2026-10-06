import { createFileRoute } from "@tanstack/react-router";
import { IdeaBoard } from "@/components/board/IdeaBoard";

export const Route = createFileRoute("/board/$boardId")({
  head: () => ({
    meta: [
      { title: "Board — Idea Board" },
      { name: "description", content: "Your visual idea canvas: notes, images, links, lists and more." },
      { property: "og:title", content: "Board — Idea Board" },
      { property: "og:description", content: "Your visual idea canvas: notes, images, links, lists and more." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BoardPage,
});

function BoardPage() {
  const { boardId } = Route.useParams();
  return <IdeaBoard initialBoardId={boardId} />;
}
