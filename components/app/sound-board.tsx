import { Button } from "@/components/system/button";

export type SoundEntry = {
  label: string;
  // What the sound marks, in a few words.
  moment: string;
  play: () => void;
};

// The app's sounds laid out to audition: one button per moment. Data in as
// props; the demo passes the real set from lib/sounds.ts.
export const SoundBoard = ({ sounds }: { sounds: SoundEntry[] }) => (
  <div className="flex flex-col gap-0.5">
    {sounds.map((sound) => (
      <div
        key={sound.label}
        className="flex h-row items-center gap-3 rounded-control px-2"
      >
        <Button
          variant="secondary"
          size="sm"
          className="w-28 justify-start"
          onClick={sound.play}
        >
          {sound.label}
        </Button>
        <span className="text-small text-muted-foreground">{sound.moment}</span>
      </div>
    ))}
  </div>
);
