import { test } from "node:test";
import assert from "node:assert/strict";
import { streamLessonManifest } from "./pipeline.ts";
import type { LessonRequest } from "./validate.ts";
import type { Msg } from "./llm.ts";

test("streamLessonManifest executes upfront pedagogy, parallel audio, and yields compiled steps", async () => {
  const req: LessonRequest = {
    topic: "Cell Nucleus",
    persona: "teacher",
    level: "middle",
    lang: "en",
    style: "",
    fromQuestion: false,
  };

  // Mock LLM function
  const mockAsk = async (msgs: Msg[]): Promise<string> => {
    const lastMsg = msgs[msgs.length - 1].content;

    // Pedagogy prompt response
    if (lastMsg.includes("StepWise Pedagogy Agent")) {
      return JSON.stringify({
        title: "The Cell Nucleus",
        subtitle: "How the nucleus commands the cell",
        steps: [
          {
            say: "The nucleus is the control center of the cell.",
            visualIntent: {
              concept: "Nucleus structure",
              keyTerms: ["nucleus", "cell"],
              boardEndState: "Circle labeled Nucleus",
            },
          },
        ],
      });
    }

    // Choreographer prompt response
    if (lastMsg.includes("StepWise Choreographer Agent")) {
      return JSON.stringify({
        stepIndex: 0,
        labels: { lbl_nuc: "Nucleus" },
        commands: [
          {
            id: "elem_nucleus",
            action: "DRAW",
            anchor: { wordIndex: 1, offsetMs: -100 },
            semanticObject: { type: "circle", size: "md", zone: "center" },
            color: "purple",
          },
        ],
      });
    }

    return "{}";
  };

  const generator = streamLessonManifest(req, mockAsk);

  // Read first streamed step
  const first = await generator.next();
  assert.equal(first.done, false);
  assert.ok(first.value);

  const step0 = first.value;
  assert.equal(step0.stepIndex, 0);
  assert.equal(step0.commands.length, 1);
  assert.equal(step0.commands[0].id, "elem_nucleus");
  assert.equal(step0.commands[0].action, "DRAW");
  assert.ok(step0.commands[0].durationMs >= 300);

  // Read end manifest
  const final = await generator.next();
  assert.equal(final.done, true);
  assert.ok(final.value);
  assert.equal(final.value.title, "The Cell Nucleus");
  assert.equal(final.value.steps.length, 1);
});
