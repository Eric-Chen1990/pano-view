import assert from "node:assert/strict";
import test from "node:test";
import { Euler, Vector3 } from "three";
import { captureLookDownPanelPose, lookDownPanelSize } from "../src/webvr/look-down-layout";
import { layoutVRMenu, VR_MENU_WIDTH } from "../src/webvr/menu-layout";
import { bindPanelGrip, hasPanelController } from "../src/webvr/panel-grip";

test("menu layout keeps labels in full rows and places at most three buttons per row", () => {
  const items = ["label", "button", "button", "button", "button", "label", "button"] as const;
  const { entries, height } = layoutVRMenu(items.map((kind, id) => ({ kind, id })));
  const [label, first, second, third, fourth, nextLabel, last] = entries;
  assert.ok(label && first && second && third && fourth && nextLabel && last);
  assert.equal(label.width, VR_MENU_WIDTH - 48);
  assert.equal(first.y, second.y);
  assert.equal(second.y, third.y);
  assert.ok(third.x > second.x && second.x > first.x);
  assert.ok(fourth.y > third.y && nextLabel.y > fourth.y && last.y > nextLabel.y);
  assert.equal(last.width, label.width);
  assert.equal(height, last.y + last.height + 24);
});

test("the same panel can fit narrow eye bounds and re-anchor to a new head direction", () => {
  const { width, height, drop } = lookDownPanelSize(0.34, 0.45, 0.8);
  assert.ok(width / 2 <= 0.34 && drop + height / 2 <= 0.45);
  assert.ok(drop - height / 2 >= 0);
  assert.equal(height, width * 0.8);
  const controllerPanel = lookDownPanelSize(1.2, 0.9, 0.8, true);
  assert.ok(controllerPanel.drop + controllerPanel.height / 2 <= 0.53);
  const origin = new Vector3(0, 1, 0);
  const position = new Vector3();
  const rotation = new Euler();
  captureLookDownPanelPose(position, rotation, origin, 0, -20, 0, drop);
  assert.deepEqual(position.toArray(), [0, 1 - drop, -2]);
  captureLookDownPanelPose(position, rotation, origin, 90, 0, 0, drop);
  assert.ok(position.x > 1.99 && Math.abs(position.z) < 1e-10);
});

test("grip toggles once per completed controller press and clears interrupted input", () => {
  const controller = { targetRayMode: "tracked-pointer", gripSpace: {} } as XRInputSource;
  const hand = { targetRayMode: "tracked-pointer", gripSpace: {}, hand: {} } as XRInputSource;
  const session = Object.assign(new EventTarget(), { inputSources: [controller, hand], visibilityState: "visible" });
  let available = true;
  let toggles = 0;
  let interruptions = 0;
  const binding = bindPanelGrip(session as unknown as XRSession, () => available, () => toggles++, () => interruptions++);
  const send = (type: string, inputSource = controller) => session.dispatchEvent(Object.assign(new Event(type), { inputSource }));

  assert.ok(hasPanelController(session.inputSources));
  assert.equal(hasPanelController([hand]), false);
  send("squeeze");
  send("squeezestart", hand);
  send("squeeze", hand);
  send("squeezestart");
  send("squeezestart");
  assert.equal(toggles, 0);
  send("squeeze");
  send("squeeze");
  assert.equal(toggles, 1);

  send("squeezestart");
  send("squeezeend");
  send("squeeze");
  send("squeezestart");
  available = false;
  send("squeeze");
  available = true;
  send("squeeze");
  send("squeezestart");
  session.visibilityState = "hidden";
  send("visibilitychange");
  send("squeeze");
  session.visibilityState = "visible";
  send("squeezestart");
  binding.reset();
  send("squeeze");
  send("squeezestart");
  session.dispatchEvent(Object.assign(new Event("inputsourceschange"), { removed: [controller] }));
  send("squeeze");
  assert.equal(toggles, 1);
  assert.equal(interruptions, 2);
  binding.dispose();
  send("squeezestart");
  send("squeeze");
  assert.equal(toggles, 1);
});
