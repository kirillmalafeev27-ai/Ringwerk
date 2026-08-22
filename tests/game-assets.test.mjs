import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readWebp(relativePath) {
  const bytes = await readFile(new URL(relativePath, import.meta.url));
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP");
  assert.ok(bytes.byteLength > 8_000, "asset should contain real image data");
  assert.ok(bytes.byteLength < 18_500, "asset should stay within the web delivery budget");
  return bytes;
}

test("the generated Ringwerk WebP asset pack is complete and compact", async () => {
  const [floor, player, terminal, hazard, social] = await Promise.all([
    readWebp("../public/game-assets/arena-floor.webp"),
    readWebp("../public/game-assets/player-core.webp"),
    readWebp("../public/game-assets/terminal-core.webp"),
    readWebp("../public/game-assets/hazard-core.webp"),
    readWebp("../public/og.webp"),
  ]);

  for (const sprite of [player, terminal, hazard]) {
    assert.ok(
      sprite.includes(Buffer.from("ALPH")) || (sprite.includes(Buffer.from("VP8X")) && (sprite[20] & 0x10) !== 0),
      "game sprites must preserve transparency",
    );
  }

  assert.ok(floor.byteLength > player.byteLength);
  assert.ok(social.byteLength > player.byteLength);
});

test("asset documentation records the built-in generation workflow", async () => {
  const documentation = await readFile(
    new URL("../GAME_ASSETS.md", import.meta.url),
    "utf8",
  );

  assert.match(documentation, /built-in/i);
  assert.match(documentation, /arena-floor\.webp/);
  assert.match(documentation, /player-core\.webp/);
  assert.match(documentation, /terminal-core\.webp/);
  assert.match(documentation, /hazard-core\.webp/);
  assert.match(documentation, /public\/og\.webp/);
  assert.match(documentation, /512 x 341/);
});
