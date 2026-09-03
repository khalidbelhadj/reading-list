import { type Demo } from "@/components/system/demo";
import {
  playCardRated,
  playCardRevealed,
  playCardSkipped,
  playError,
  playItemCreated,
  playItemDeleted,
  playItemStarred,
  playItemUnstarred,
  playQueueFinished,
  playStackStarted,
} from "@/lib/sounds";

import { SoundBoard } from "./sound-board";

export const demo: Demo = {
  title: "Sound board",
  description:
    "Every sound the app makes, to audition: short Web Audio sine taps from one family (see Sounds in DESIGN.md). Click to play.",
  render: () => (
    <div className="max-w-md">
      <SoundBoard
        sounds={[
          {
            label: "Pasted",
            moment: "A url lands in the list",
            play: playItemCreated,
          },
          {
            label: "Reveal",
            moment: "The answer shows",
            play: playCardRevealed,
          },
          {
            label: "Again",
            moment: "Rated again",
            play: () => playCardRated("again"),
          },
          {
            label: "Hard",
            moment: "Rated hard",
            play: () => playCardRated("hard"),
          },
          {
            label: "Good",
            moment: "Rated good",
            play: () => playCardRated("good"),
          },
          {
            label: "Easy",
            moment: "Rated easy",
            play: () => playCardRated("easy"),
          },
          { label: "Skip", moment: "Card set aside", play: playCardSkipped },
          {
            label: "Finished",
            moment: "The queue is done",
            play: playQueueFinished,
          },
          {
            label: "Stack",
            moment: "A compiled stack starts",
            play: playStackStarted,
          },
          { label: "Star", moment: "Item starred", play: playItemStarred },
          {
            label: "Unstar",
            moment: "Item unstarred",
            play: playItemUnstarred,
          },
          { label: "Delete", moment: "Item deleted", play: playItemDeleted },
          { label: "Error", moment: "Something failed", play: playError },
        ]}
      />
    </div>
  ),
};
