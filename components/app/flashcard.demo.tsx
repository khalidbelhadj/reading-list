import React from "react";

import { type Demo } from "@/components/system/demo";

import { Flashcard } from "./flashcard";

const FRONT =
  "What does the MESI protocol's **E (Exclusive)** state guarantee?";
const BACK =
  "The line is present only in this cache and matches memory, so it can be written without a bus transaction.";

const Editable = ({ scale }: { scale?: "review" | "list" }) => {
  const [front, setFront] = React.useState(FRONT);
  const [back, setBack] = React.useState(BACK);
  return (
    <Flashcard
      scale={scale}
      front={front}
      back={back}
      onFrontChange={setFront}
      onBackChange={setBack}
    />
  );
};

export const demo: Demo = {
  title: "Flashcard",
  description:
    "The Sheet card (board round 10). Sides render markdown and edit in place — click into the text, blur commits; there is no edit mode. Reveal by clicking Show answer, or controlled by the review session.",
  render: () => (
    <div className="flex w-96 flex-col gap-3">
      <Editable scale="review" />
      <Editable />
    </div>
  ),
};
