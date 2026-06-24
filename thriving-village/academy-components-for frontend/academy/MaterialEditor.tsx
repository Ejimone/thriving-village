"use client";

import { useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { toast } from "@/components/ui/Toaster";
import { useCohort } from "@/components/academy/CohortProvider";

/**
 * Admin-only editor for a day's course material (lesson text + video link).
 * Remount per day via a `key` so the fields seed from the right material.
 */
export function MaterialEditor({
  courseId,
  day,
}: {
  courseId: string;
  day: number;
}) {
  const { getMaterial, setMaterial } = useCohort();
  const existing = getMaterial(courseId, day);
  const [text, setText] = useState(existing?.text ?? "");
  const [video, setVideo] = useState(existing?.video ?? "");

  const save = () => {
    setMaterial(courseId, day, { text, video });
    toast.success(`Material saved for Day ${day}.`);
  };
  const clear = () => {
    setText("");
    setVideo("");
    setMaterial(courseId, day, {});
    toast.success(`Material cleared for Day ${day}.`);
  };

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-sm border border-gray-200 bg-gray-50 p-4">
      <Input
        label="Video link"
        placeholder="https://… (YouTube, Vimeo, etc.)"
        value={video}
        onChange={(e) => setVideo(e.target.value)}
        inputMode="url"
      />
      <Textarea
        label="Lesson material"
        placeholder="The written lesson / transcript students read for this day."
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="inverse" iconLeft={<Save size={15} />} onClick={save}>
          Save material
        </Button>
        {(existing?.text || existing?.video) && (
          <Button size="sm" variant="text" iconLeft={<Trash2 size={15} />} onClick={clear}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
