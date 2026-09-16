# Core principles of XY motion

An interactive CoreXY explainer built with plain HTML, CSS, SVG, and JavaScript. Start with an ordinary belt drive, unlock one degree of freedom, and discover how two belt-length constraints become two diagonal coordinates.

The page is a standalone file that works offline. No framework, build step, or runtime dependencies are required.

## Try it locally

Clone this repository and open [index.html](index.html) in your browser:

```sh
git clone https://github.com/srinathava/corexy.git
cd corexy
```

Alternatively, serve the directory with `python3 -m http.server 8000` and visit `http://localhost:8000`.

## Explore the mechanism

The seven experiments introduce one mechanical idea at a time:

1. **Ordinary belt drive:** turn a motor and watch the carriage follow the belt.
2. **Rearrange the routing:** replay the setup change, then confirm motion is still horizontal.
3. **Unlock the idler pair:** move the pair vertically with the motor locked and observe the carriage's horizontal response.
4. **Reveal the virtual guide:** discover the diagonal constraint imposed by the belt.
5. **Move the guide:** turn the motor to translate the allowed diagonal.
6. **Add a second belt:** place the carriage at the intersection of two diagonal constraints.
7. **Explore Cartesian motion:** link the two motors and reveal the coordinate transform.

Drag the carriage or unlocked Y handle, or use the keyboard-accessible sliders. Play animates the current experiment; Reset centers it. The interface adapts to narrow screens and respects reduced-motion preferences.

In the final experiment, selecting a motion mode preserves the current position and leaves playback stopped:

| Mode | Behavior |
| --- | --- |
| Independent | Adjust either motor separately. |
| Motor A / B only | Hold the other motor fixed. |
| Pure X | Either slider moves both by the same amount, preserving `A − B` and therefore Y. |
| Pure Y | Either slider moves both by opposite amounts, preserving `A + B` and therefore X. |

Linked motors stop together when either reaches its travel limit. Press Play explicitly to animate the selected mode.

## How the model works

Coordinates are relative to the centered carriage, with X rightward and Y upward. A and B are signed belt displacements in drawing units.

The first rerouted belt's path from the fixed motor to a carriage clamp contains a vertical span, a horizontal span, and constant pulley wraps. Its length changes by `x + y`. Motor travel A supplies that change:

```text
x + y = A
```

With A locked, increasing Y forces an equal decrease in X. The full closed-loop length remains constant because one vertical leg grows as the other shrinks.

Mirroring the routing supplies the second constraint. Together:

```text
x + y = A          x = (A + B) / 2
x − y = B          y = (A − B) / 2
```

The belt is idealized as taut and inextensible, with rigid clamps and ideal pulleys. Real machines require guides and must account for belt stretch, tension, and compliance.

The rerouting animation represents a setup operation, not motion under tension. Two idlers are added, and the fixed upper return span is adjusted so the settled loop lengths match. Pulley arcs use cubic circle approximations. Sparse painted markers are sampled by arc length and retain their material coordinates during operating motion. The second belt is offset slightly to distinguish the belt planes.

## Design references and files

The original [handoff document](corexy_interactive_handoff.md) records the design intent and longer, nine-stage storyline. The implementation combines the repeated introductory stages into seven experiments.

| Initial rectangular routing | Rearranged routing |
| --- | --- |
| ![Hand-drawn rectangular belt drive](initial.jpg) | ![Hand-drawn return routing with the carriage between two idlers](rearranged.jpg) |

- [index.html](index.html): the complete interactive page, including styles and kinematics.
- [corexy_interactive_handoff.md](corexy_interactive_handoff.md): original design handoff.
- [initial.jpg](initial.jpg) and [rearranged.jpg](rearranged.jpg): reference sketches.
- [tests/browser.cjs](tests/browser.cjs): browser interaction and kinematic checks.

## Development checks

Only the tests need Node.js 20 or newer, npm, and an installed Google Chrome:

```sh
npm ci
npm test
```

To use a different Chromium executable:

```sh
CHROME_PATH=/path/to/chromium npm test
```

The checks cover all seven experiments, settled belt lengths, tracer attachment, motor constraints, linked sliders and travel limits, projected dragging, playback, reset, mobile overflow, and reduced motion. Screenshots are saved as `corexy-*.png` in the operating system's temporary directory.

There is no build output to publish: `index.html` can be served directly by any static host.
